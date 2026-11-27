import { TextSelection } from 'prosemirror-state';
import { registerLanguage } from '@novaprose/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTinymce, type CompatEditor } from '../src';

/** tinymce.init() and the editor API: scenarios of typical integrations (from the public documentation). */

let tinymce = createTinymce();
afterEach(() => {
  tinymce.remove();
  tinymce = createTinymce();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function page(html: string) {
  document.body.innerHTML = html;
}

/**
 * The content CSS an editor attached: a constructed style sheet where the environment supports it (browsers,
 * jsdom 31+), otherwise a <style> element in the container.
 */
function contentCssText(container: HTMLElement): string {
  const root = container.getRootNode() as Document | ShadowRoot;
  const adopted = (root.adoptedStyleSheets ?? []).flatMap((sheet) =>
    [...sheet.cssRules].map((rule) => rule.cssText),
  );
  const styles = [...container.querySelectorAll('style')].map((style) => style.textContent ?? '');
  return [...adopted, ...styles].join('\n');
}

describe('tinymce.init', () => {
  it('replaces <textarea>: initial content, a hidden textarea, getContent/setContent', async () => {
    page(
      '<form id="f"><textarea id="post" name="body"><p>Hello <b>world</b></p></textarea></form>',
    );
    const [editor] = await tinymce.init({
      selector: '#post',
      plugins: 'lists link',
      toolbar: 'bold italic',
    });
    expect(editor!.id).toBe('post');
    expect(editor!.getContent()).toBe('<p>Hello <strong>world</strong></p>');
    expect(document.querySelector<HTMLTextAreaElement>('#post')!.hidden).toBe(true);
    expect(tinymce.get('post')).toBe(editor);
    expect(tinymce.activeEditor).toBe(editor);
    editor!.setContent('<p>New</p>');
    expect(editor!.getContent({ format: 'text' })).toBe('New');
  });

  it('language with a loader (as in the CDN build): init waits for the pack, the interface is translated at once', async () => {
    registerLanguage('qy-QY', async () => ({ bold: 'B (qy)' }));
    page('<textarea id="t"></textarea>');
    const [editor] = await tinymce.init({ selector: '#t', toolbar: 'bold', language: 'qy_QY' });
    expect(editor).toBeDefined();
    expect(document.querySelector('[data-control="bold"]')?.getAttribute('aria-label')).toBe(
      'B (qy)',
    );
  });

  it('order: setup → init events → init_instance_callback; the promise gives the editors', async () => {
    page('<textarea class="rich"></textarea><textarea class="rich"></textarea>');
    const calls: string[] = [];
    const editors = await tinymce.init({
      selector: 'textarea.rich',
      setup: (editor) => {
        calls.push('setup');
        editor.on('init', () => calls.push('init'));
      },
      init_instance_callback: () => calls.push('callback'),
    });
    expect(editors).toHaveLength(2);
    expect(calls).toEqual(['setup', 'init', 'callback', 'setup', 'init', 'callback']);
    expect(editors[1]!.id).toMatch(/^mce_/);
  });

  it('submitting the form writes the HTML into the textarea; triggerSave and isDirty', async () => {
    page('<form><textarea id="t"><p>a</p></textarea></form>');
    const [editor] = await tinymce.init({ selector: '#t' });
    editor!.setContent('<p>b</p>');
    expect(editor!.isDirty()).toBe(true);
    const textarea = document.querySelector<HTMLTextAreaElement>('#t')!;
    textarea.form!.dispatchEvent(new Event('submit'));
    expect(textarea.value).toBe('<p>b</p>');
    expect(editor!.isDirty()).toBe(false);
    editor!.setContent('<p>c</p>');
    tinymce.triggerSave();
    expect(textarea.value).toBe('<p>c</p>');
  });

  it('execCommand and queryCommandState by TinyMCE command names', async () => {
    page('<textarea id="t"><p>text</p></textarea>');
    const [editor] = await tinymce.init({ selector: '#t' });
    const onExec = vi.fn();
    editor!.on('ExecCommand', onExec);
    editor!.execCommand('SelectAll');
    expect(editor!.execCommand('Bold')).toBe(true);
    expect(editor!.queryCommandState('bold')).toBe(true);
    editor!.execCommand('FormatBlock', false, 'h2');
    expect(editor!.getContent()).toBe('<h2><strong>text</strong></h2>');
    expect(editor!.execCommand('mceNoSuchCommand')).toBe(false);
    expect(onExec).toHaveBeenCalledWith(expect.objectContaining({ command: 'Bold' }));
    editor!.execCommand('Undo');
    expect(editor!.getContent()).toBe('<p><strong>text</strong></p>');
  });

  it('insertContent inserts HTML with the same cleanup as paste', async () => {
    page('<textarea id="t"><p>a</p></textarea>');
    const [editor] = await tinymce.init({ selector: '#t' });
    editor!.execCommand('SelectAll');
    editor!.selection.collapse(false);
    editor!.insertContent('<em>b</em><script>alert(1)</script>');
    expect(editor!.getContent()).toBe('<p>a<em>b</em></p>');
  });

  it('insertContent with a block (<p>) in the middle of a paragraph inserts a new paragraph', async () => {
    page('<textarea id="t"><p>Hello world</p></textarea>');
    const [editor] = await tinymce.init({ selector: '#t' });
    editor!.execCommand('SelectAll');
    editor!.selection.collapse(false);
    editor!.insertContent('<p>Signature</p>');
    expect(editor!.getContent()).toBe('<p>Hello world</p><p>Signature</p>');
  });

  it('PluginManager.add: a plugin registers a button and a command, as in TinyMCE', async () => {
    tinymce.PluginManager.add('signature', (editor) => {
      editor.addCommand('insertSignature', () => editor.insertContent('<p>— Anna</p>'));
      editor.ui.registry.addButton('signature', {
        text: 'Signature',
        onAction: () => editor.execCommand('insertSignature'),
      });
    });
    page('<textarea id="t"><p>Hi</p></textarea>');
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'signature',
      toolbar: 'bold signature',
    });
    const button = editor!
      .getContainer()
      .querySelector<HTMLButtonElement>('[data-control="signature"]')!;
    expect(button.textContent).toContain('Signature');
    editor!.selection.collapse(false);
    button.click();
    expect(editor!.getContent()).toContain('— Anna');
  });

  it('addToggleButton with onSetup and api.setActive; icons by TinyMCE names', async () => {
    page('<textarea id="t"></textarea>');
    let teardown = false;
    const [editor] = await tinymce.init({
      selector: '#t',
      toolbar: 'mytoggle',
      setup: (e: unknown) => {
        const ed = e as CompatEditor;
        ed.ui.registry.addToggleButton('mytoggle', {
          icon: 'bold',
          tooltip: 'Toggle',
          onAction: (api) =>
            (api as { setActive(v: boolean): void; isActive(): boolean }).setActive(
              !(api as { isActive(): boolean }).isActive(),
            ),
          onSetup: () => () => (teardown = true),
        });
      },
    });
    const button = editor!
      .getContainer()
      .querySelector<HTMLButtonElement>('[data-control="mytoggle"]')!;
    expect(button.querySelector('svg')).not.toBeNull();
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    editor!.remove();
    expect(teardown).toBe(true);
  });

  it("events: input on every change, change when focus leaves, keydown is the browser's event", async () => {
    page('<textarea id="t"><p>a</p></textarea>');
    const [editor] = await tinymce.init({ selector: '#t' });
    const input = vi.fn();
    const change = vi.fn();
    const keydown = vi.fn();
    editor!.on('input', input).on('Change', change).on('keydown', keydown);
    editor!.getBody().dispatchEvent(new FocusEvent('focus'));
    editor!.setContent('<p>b</p>');
    expect(input).toHaveBeenCalledTimes(1);
    editor!.getBody().dispatchEvent(new FocusEvent('blur'));
    expect(change).toHaveBeenCalledTimes(1);
    editor!.getBody().dispatchEvent(new KeyboardEvent('keydown', { key: 'a', keyCode: 65 }));
    expect(keydown.mock.calls[0]![0]).toBeInstanceOf(KeyboardEvent);
  });

  it('options: readonly, placeholder, height, content_style, images_upload_handler', async () => {
    page('<textarea id="t"></textarea>');
    const handler = vi.fn(async (info: { filename(): string; base64(): string }) => {
      expect(info.filename()).toBe('a.png');
      expect(info.base64()).toBe(btoa('png'));
      return 'https://cdn.example.com/a.png';
    });
    const [editor] = await tinymce.init({
      selector: '#t',
      readonly: true,
      placeholder: 'Type…',
      height: 300,
      content_style: 'body { font-family: Georgia; }',
      images_upload_handler: handler,
    });
    expect(editor!.mode.isReadOnly()).toBe(true);
    editor!.mode.set('design');
    expect(editor!.mode.get()).toBe('design');
    expect(editor!.getContainer().style.height).toBe('300px');
    expect(editor!.getBody().getAttribute('data-placeholder')).toBe('Type…');
    expect(contentCssText(editor!.getContainer())).toMatch(
      /\.nova-prosemirror\s*\{\s*font-family: Georgia;\s*\}/,
    );
    const upload = editor!.core.options.uploadImage!;
    await expect(upload(new File(['png'], 'a.png', { type: 'image/png' }), () => {})).resolves.toBe(
      'https://cdn.example.com/a.png',
    );
  });

  it('formats, style_formats, valid_classes and formatter.register, as in the TinyMCE documentation', async () => {
    page(
      '<textarea id="a"><p class="lead">a</p><p class="other">b</p></textarea>' +
        '<textarea id="b"><p class="lead other">x</p></textarea>',
    );
    const [a] = await tinymce.init({
      selector: '#a',
      toolbar: 'styles',
      formats: {
        lead: { block: 'p', classes: 'lead' },
        red: { inline: 'span', styles: { color: '#ff0000' } },
        boxed: [{ selector: 'p', classes: 'boxed' }],
        wrapper: { block: 'div', wrapper: true },
      },
      style_formats: [
        { title: 'Lead', format: 'lead' },
        { title: 'Inline', items: [{ title: 'Marker', inline: 'span', classes: 'marker' }] },
        { title: 'Callout', block: 'div', classes: 'callout' },
      ],
      setup: (editor) => {
        editor.formatter.register('note', { block: 'p', classes: 'note' });
      },
    });
    // Without valid_classes TinyMCE keeps every class, and so do we.
    expect(a!.getContent()).toBe('<p class="lead">a</p><p class="other">b</p>');
    expect(a!.core.options.styleFormats).toEqual([
      { title: 'Lead', format: 'lead' },
      { title: 'Inline', items: [{ title: 'Marker', inline: 'span', classes: 'marker' }] },
    ]);
    expect(a!.formatter.get('wrapper')).toBeUndefined();
    a!.selection.setCursorLocation(a!.getBody().querySelector('p')!, 0);
    expect(a!.formatter.match('lead')).toBe(true);
    // A format adds its own class and leaves other ones alone; removing it removes only its class.
    a!.formatter.apply('note');
    expect(a!.getContent()).toContain('<p class="lead note">a</p>');
    a!.formatter.toggle('note');
    expect(a!.getContent()).toContain('<p class="lead">a</p>');

    // valid_classes limits the classes; format classes are always allowed.
    const [b] = await tinymce.init({
      selector: '#b',
      valid_classes: { p: 'other' },
      formats: { lead: { block: 'p', classes: 'lead' } },
    });
    expect(b!.getContent()).toBe('<p class="lead other">x</p>');
    b!.setContent('<p class="junk other">y</p>');
    expect(b!.getContent()).toBe('<p class="other">y</p>');
  });

  it('extended_valid_elements and custom_elements: icons, heading ids, custom elements', async () => {
    const html =
      '<h2 id="faq">FAQ</h2><div class="note">Tip <i class="fa fa-info"></i></div>' +
      '<my-card data-id="3"><p>Card</p></my-card>';
    page(`<textarea id="t">${html}</textarea>`);
    const [editor] = await tinymce.init({
      selector: '#t',
      extended_valid_elements: 'h2[id],div[class],i[class]',
      custom_elements: 'my-card',
    });
    expect(editor!.getContent()).toBe(html);
  });

  it('addSidebar: onSetup draws the panel, the button and ToggleSidebar toggle it', async () => {
    page('<textarea id="t"><p>x</p></textarea>');
    const shown: string[] = [];
    const [editor] = await tinymce.init({
      selector: '#t',
      toolbar: 'bold mysidebar',
      setup: (ed: CompatEditor) => {
        ed.ui.registry.addSidebar('mysidebar', {
          tooltip: 'My sidebar',
          onSetup: (api) => {
            api.element().textContent = 'Hello from sidebar';
          },
          onShow: () => shown.push('show'),
          onHide: () => shown.push('hide'),
        });
      },
    });
    const button = document.querySelector<HTMLButtonElement>('[data-control="mysidebar"]')!;
    expect(button.getAttribute('aria-label')).toBe('My sidebar');
    editor!.execCommand('ToggleSidebar', false, 'mysidebar');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('[data-sidebar="mysidebar"]')!.textContent).toContain(
      'Hello from sidebar',
    );
    expect(editor!.queryCommandValue('ToggleSidebar')).toBe('mysidebar');
    button.click();
    expect(editor!.queryCommandValue('ToggleSidebar')).toBe('');
    expect(shown).toEqual(['show', 'hide']);
  });

  it('options: block_formats, disabled (and options.set on the fly), resize', async () => {
    page('<textarea id="a"></textarea><textarea id="b"></textarea>');
    const [a] = await tinymce.init({
      selector: '#a',
      block_formats: 'Paragraph=p; Heading 2=h2; Weird=marquee',
      disabled: true,
    });
    expect(a!.core.options.blockFormats).toEqual([
      { label: 'Paragraph', block: 'p' },
      { label: 'Heading 2', block: 'h2' },
    ]);
    expect(a!.core.isDisabled()).toBe(true);
    a!.options.set('disabled', false);
    expect(a!.core.isDisabled()).toBe(false);
    expect(a!.core.isEditable()).toBe(true);
    // resize: a vertical handle by default, as in TinyMCE.
    expect(a!.getContainer().querySelector('.nova-resize-handle')).not.toBeNull();
    const [b] = await tinymce.init({ selector: '#b', resize: false });
    expect(b!.getContainer().querySelector('.nova-resize-handle')).toBeNull();
  });

  it('file_picker_callback and file_picker_types: a custom file manager in dialogs', async () => {
    page('<textarea id="t"></textarea>');
    const calls: unknown[] = [];
    const [editor] = await tinymce.init({
      selector: '#t',
      file_picker_types: 'image',
      file_picker_callback: (
        callback: (url: string, meta?: object) => void,
        value: string,
        meta: { filetype: string },
      ) => {
        calls.push([value, meta.filetype]);
        callback('https://cdn.example.com/cat.png', { alt: 'Cat' });
      },
    });
    const picker = editor!.core.options.filePicker!;
    expect(editor!.core.options.filePickerTypes).toEqual(['image']);
    await expect(picker({ type: 'image', value: 'old.png' })).resolves.toEqual({
      url: 'https://cdn.example.com/cat.png',
      alt: 'Cat',
    });
    expect(calls).toEqual([['old.png', 'image']]);
  });

  it('codesample: TinyMCE markup, highlighting, codesample_languages, the CodeSample command', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page(
      '<textarea id="t"><pre class="language-javascript"><code>const a = 1;</code></pre></textarea>',
    );
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'codesample',
      toolbar: 'codesample',
      codesample_languages: [
        { text: 'HTML/XML', value: 'markup' },
        { text: 'JavaScript', value: 'javascript' },
      ],
      codesample_global_prismjs: true,
    });
    // The language from the <pre> class is kept: on output it is on <code>, where Prism and highlight.js expect it.
    expect(editor!.getContent()).toBe(
      '<pre><code class="language-javascript">const a = 1;</code></pre>',
    );
    const { core } = editor!;
    await vi.waitFor(() =>
      expect(core.root.querySelector('.nova-prosemirror .hljs-keyword')?.textContent).toBe('const'),
    );
    expect(core.root.querySelector('[data-control="codesample"]')).not.toBeNull();
    // The language list comes from codesample_languages (with "Plain text" first).
    core.view.dispatch(
      core.view.state.tr.setSelection(TextSelection.create(core.view.state.doc, 2)),
    );
    const menu = core.ui.registry.get('codelanguage');
    if (menu?.type !== 'menu') throw new Error('no language menu');
    const labels = menu
      .items(core)
      .flatMap((i) => ('label' in i && i.type !== 'heading' ? [i.label] : []));
    expect(labels).toEqual(['Plain text', 'HTML/XML', 'JavaScript']);
    expect(editor!.execCommand('CodeSample')).toBe(true);
    await vi.waitFor(() => expect(core.root.querySelector('.nova-dialog')).not.toBeNull());
    // The codesample options are understood: no warnings about them.
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/codesample/);
  });

  it('accordion: <details>, details_*_state, InsertAccordion / ToggleAccordion / ToggleAllAccordions', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page(
      '<textarea id="t"><details open><summary>Q</summary><p>A</p></details><p>text</p></textarea>',
    );
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'accordion',
      toolbar: 'accordion',
      details_initial_state: 'collapsed',
      details_serialized_state: 'inherited',
    });
    // Loaded collapsed (details_initial_state), the output is as in the editor.
    expect(editor!.getContent()).toBe('<details><summary>Q</summary><p>A</p></details><p>text</p>');
    const { core } = editor!;
    expect(core.root.querySelector('[data-control="accordion"]')).not.toBeNull();
    // The cursor into the title: "expand" by command.
    core.view.dispatch(
      core.view.state.tr.setSelection(TextSelection.create(core.view.state.doc, 3)),
    );
    expect(editor!.execCommand('ToggleAccordion', false, true)).toBe(true);
    expect(editor!.getContent()).toContain('<details open="">');
    expect(editor!.execCommand('ToggleAllAccordions', false, false)).toBe(true);
    expect(editor!.getContent()).toContain('<details><summary>');
    // Inserting around the "text" paragraph and removing the frame.
    const end = core.view.state.doc.content.size - 1;
    core.view.dispatch(
      core.view.state.tr.setSelection(TextSelection.create(core.view.state.doc, end)),
    );
    expect(editor!.execCommand('InsertAccordion')).toBe(true);
    expect(editor!.getContent()).toContain(
      '<details open=""><summary></summary><p>text</p></details>',
    );
    expect(editor!.execCommand('RemoveAccordion')).toBe(true);
    expect(editor!.getContent()).toMatch(/<\/details><p>text<\/p>$/);
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/accordion|details_/);
  });

  it('tableofcontents: div.mce-toc with h2, tableofcontents_*, mceInsertToc / mceUpdateToc', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const toc =
      '<div class="mce-toc"><h2>Table of Contents</h2><ul><li><a href="#mcetoc_a">Alpha</a></li></ul></div>';
    page(`<textarea id="t">${toc}<h2 id="mcetoc_a">Alpha</h2><h3>Beta</h3></textarea>`);
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'tableofcontents',
      toolbar: 'tableofcontents tableofcontentsupdate',
      tableofcontents_depth: 2,
    });
    // The class and title as in TinyMCE (site styles for .mce-toc work); h3 is deeper than depth.
    expect(editor!.getContent()).toBe(
      '<nav class="mce-toc" data-toc=""><h2>Table of Contents</h2><ul><li><a href="#mcetoc_a">Alpha</a></li></ul></nav>' +
        '<h2 id="mcetoc_a">Alpha</h2><h3>Beta</h3>',
    );
    expect(editor!.execCommand('mceUpdateToc')).toBe(true);
    const { core } = editor!;
    core.view.dispatch(core.view.state.tr.setSelection(TextSelection.atEnd(core.view.state.doc)));
    expect(editor!.execCommand('mceInsertToc')).toBe(true);
    expect(editor!.getContent().match(/data-toc/g)).toHaveLength(2);
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/tableofcontents/);
  });

  it('casechange, formatpainter, permanentpen: their options and mce* commands', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"><p>the lord of the rings</p></textarea>');
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'casechange formatpainter permanentpen',
      toolbar: 'casechange formatpainter permanentpen',
      casechange_title_case_minors: ['of'],
      permanentpen_properties: { italic: true },
    });
    const { core } = editor!;
    const { state } = core.view;
    core.view.dispatch(
      state.tr.setSelection(TextSelection.create(state.doc, 1, state.doc.content.size - 1)),
    );
    expect(editor!.queryCommandSupported('mceTitleCase')).toBe(true);
    expect(editor!.execCommand('mceTitleCase')).toBe(true);
    expect(editor!.getContent()).toBe('<p>The Lord of The Rings</p>');
    expect(editor!.execCommand('mceUpperCase')).toBe(true);
    expect(editor!.getContent()).toBe('<p>THE LORD OF THE RINGS</p>');

    expect(editor!.execCommand('mceToggleFormatPainter')).toBe(true);
    expect(editor!.queryCommandState('mceToggleFormatPainter')).toBe(true);
    expect(editor!.execCommand('mceToggleFormatPainter')).toBe(true);
    expect(editor!.queryCommandState('mceToggleFormatPainter')).toBe(false);

    core.view.dispatch(core.view.state.tr.setSelection(TextSelection.atEnd(core.view.state.doc)));
    expect(editor!.execCommand('mceTogglePermanentPen')).toBe(true);
    expect(editor!.queryCommandState('mceTogglePermanentPen')).toBe(true);
    core.view.dispatch(core.view.state.tr.insertText('!'));
    expect(editor!.getContent()).toBe('<p>THE LORD OF THE RINGS<em>!</em></p>');
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/casechange|permanentpen/);
  });

  it('save and visualchars: save_* callbacks with the TinyMCE editor, mceSave/mceCancel, mceVisualChars', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"><p>start</p></textarea>');
    const saved: string[] = [];
    let canceledBy: unknown = null;
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'save visualchars',
      toolbar: 'save cancel visualchars',
      visualchars_default_state: true,
      save_onsavecallback: (e: CompatEditor) => {
        // The content is already in the <textarea>, as in TinyMCE.
        saved.push((document.getElementById('t') as HTMLTextAreaElement).value);
        expect(e).toBe(editor);
      },
      save_oncancelcallback: (e: CompatEditor) => (canceledBy = e),
    });
    const { core } = editor!;
    core.view.dispatch(core.view.state.tr.insertText('new ', 1));
    expect(editor!.execCommand('mceSave')).toBe(true);
    await vi.waitFor(() => expect(saved).toEqual(['<p>new start</p>']));
    core.view.dispatch(core.view.state.tr.insertText('more ', 1));
    expect(editor!.execCommand('mceCancel')).toBe(true);
    expect(editor!.getContent()).toBe('<p>new start</p>');
    expect(canceledBy).toBe(editor);

    expect(core.view.dom.querySelectorAll('.nova-visualchar')).toHaveLength(0);
    core.view.dispatch(core.view.state.tr.insertText(String.fromCharCode(0xa0), 4, 5));
    expect(core.view.dom.querySelectorAll('.nova-visualchar')).toHaveLength(1);
    expect(editor!.execCommand('mceVisualChars')).toBe(true);
    expect(core.view.dom.querySelectorAll('.nova-visualchar')).toHaveLength(0);
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/save|visualchars/);
  });

  it('importcss: content_style classes in the Styles menu, importcss_selector_filter', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"><p>text</p></textarea>');
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'importcss',
      toolbar: 'styles',
      content_style: 'p.brand-lead { font-size: 20px } .other { color: red }',
      importcss_selector_filter: '.brand-',
    });
    const { core } = editor!;
    await vi.waitFor(() =>
      expect(core.ui.registry.getStyleFormats().items.map((f) => f.title)).toEqual(['brand-lead']),
    );
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/importcss/);
  });

  it('unknown options and plugins give a warning, not an error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"></textarea>');
    await tinymce.init({ selector: '#t', plugins: 'lists nosuchplugin', some_future_option: 1 });
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).toMatch(/nosuchplugin/);
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).toMatch(/some_future_option/);
  });

  it('inline: editing right in the element; remove brings back the original textarea', async () => {
    page('<div id="inline"><p>Inline text</p></div><textarea id="t"><p>x</p></textarea>');
    const [inline] = await tinymce.init({ selector: '#inline', inline: true });
    expect(document.querySelector('#inline .nova-prosemirror')).not.toBeNull();
    expect(inline!.getContent()).toBe('<p>Inline text</p>');

    const [editor] = await tinymce.init({ selector: '#t' });
    editor!.setContent('<p>saved on remove</p>');
    tinymce.remove('#t');
    const textarea = document.querySelector<HTMLTextAreaElement>('#t')!;
    expect(textarea.hidden).toBe(false);
    expect(textarea.value).toBe('<p>saved on remove</p>');
    expect(tinymce.get('t')).toBeNull();
    expect(document.querySelector('.nova-compat')).toBeNull();
  });

  it('notificationManager and windowManager.alert/confirm', async () => {
    page('<textarea id="t"></textarea>');
    const [editor] = await tinymce.init({ selector: '#t' });
    editor!.notificationManager.open({ text: 'Saved', type: 'success' });
    expect(editor!.getContainer().textContent).toContain('Saved');
    const answer = vi.fn();
    editor!.windowManager.confirm('Delete?', answer);
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Delete?');
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(answer).toHaveBeenCalledWith(true);
  });
});
