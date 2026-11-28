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

  it('template: templates with a callback, template_replace_values, mceInsertTemplate, mceTemplate', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"><p>end</p></textarea>');
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'template',
      toolbar: 'template',
      templates: (done: (list: unknown[]) => void) =>
        done([{ title: 'Greeting', content: '<p>Hi {$name}</p>' }]),
      template_replace_values: { name: 'Ann' },
    });
    const { core } = editor!;
    core.view.dispatch(core.view.state.tr.setSelection(TextSelection.atStart(core.view.state.doc)));
    expect(editor!.execCommand('mceInsertTemplate', false, '<p>Hi {$name}</p>')).toBe(true);
    expect(editor!.getContent()).toBe('<p>Hi Ann</p><p>end</p>');
    expect(editor!.queryCommandSupported('mceTemplate')).toBe(true);
    const dialog = vi.spyOn(core.ui, 'dialog').mockResolvedValue(null);
    expect(editor!.execCommand('mceTemplate')).toBe(true);
    await vi.waitFor(() => expect(dialog).toHaveBeenCalled());
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/template/);
  });

  it('footnotes: the plugin, its buttons, mceInsertFootnote and mceUpdateFootnotes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"><p>Text</p></textarea>');
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'footnotes',
      toolbar: 'footnotes footnotesupdate',
    });
    const { core } = editor!;
    core.view.dispatch(core.view.state.tr.setSelection(TextSelection.atEnd(core.view.state.doc)));
    expect(editor!.queryCommandSupported('mceInsertFootnote')).toBe(true);
    expect(editor!.queryCommandSupported('mceUpdateFootnotes')).toBe(true);
    expect(editor!.execCommand('mceInsertFootnote')).toBe(true);
    core.view.dispatch(core.view.state.tr.insertText('A note'));
    expect(editor!.getContent()).toMatch(
      /^<p>Text<sup class="mce-footnote"><a href="#footnote-[\w-]+" id="footnote-ref-[\w-]+" role="doc-noteref">1<\/a><\/sup><\/p><div class="mce-footnotes" role="doc-endnotes"><hr><ol><li id="footnote-[\w-]+">.*A note<\/span><\/li><\/ol><\/div>$/,
    );
    expect(editor!.execCommand('mceUpdateFootnotes')).toBe(true);
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/footnote/);
  });

  it('tinymcespellchecker: its options and commands, checking through your own service', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"><p>teh Nova teh</p></textarea>');
    const check = vi.fn(async ({ text }: { text: string }) =>
      [...text.matchAll(/\b(teh|Nova)\b/g)].map((m) => ({
        offset: m.index!,
        length: m[0].length,
        replacements: ['the'],
      })),
    );
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'tinymcespellchecker',
      toolbar: 'spellchecker spellcheckdialog',
      spellchecker_language: 'en_US',
      spellchecker_languages: 'US English=en_US,German=de',
      spellchecker_ignore_list: { en_US: ['Nova'] },
      spellchecker_check: check,
    });
    const { core } = editor!;
    const marks = () => core.view.dom.querySelectorAll('.nova-spell').length;
    await vi.waitFor(() => expect(marks()).toBe(2), { timeout: 3000 });
    expect(check.mock.calls[0]![0]).toMatchObject({ language: 'en-US' });
    const menu = core.ui.registry.get('spellchecker') as unknown as {
      items: (e: unknown) => { label?: string }[];
    };
    expect(menu.items(core).map((item) => item.label)).toContain('German');
    expect(editor!.queryCommandSupported('mceSpellcheckDisable')).toBe(true);
    expect(editor!.execCommand('mceSpellcheckDisable')).toBe(true);
    expect(marks()).toBe(0);
    expect(editor!.execCommand('mceSpellcheckEnable')).toBe(true);
    await vi.waitFor(() => expect(marks()).toBe(2));
    expect(editor!.execCommand('mceSpellcheckDialog')).toBe(true);
    expect(document.querySelector('.nova-spell-bubble')).not.toBeNull();
    expect(editor!.execCommand('mceSpellcheckDialogClose')).toBe(true);
    expect(document.querySelector('.nova-spell-bubble')).toBeNull();
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/spellchecker/);
  });

  it('a11ychecker: the a11ycheck button and the a11ychecker_* options', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page(
      '<textarea id="t"><h2>A</h2><h4>B</h4><p><img src="https://example.com/x.png" alt=""></p></textarea>',
    );
    const filtered: string[] = [];
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'a11ychecker',
      toolbar: 'a11ycheck',
      a11ychecker_level: 'AA',
      a11ychecker_ignored_rules: 'D1, N1',
      a11ychecker_filter_issue: (issue: { id: string; contentID: string }) => {
        filtered.push(`${issue.id}:${issue.contentID}`);
        return true;
      },
    });
    const { core } = editor!;
    expect(core.ui.registry.has('a11ycheck')).toBe(true);
    await core.ui.sidebar.show('a11ychecker');
    const panel = await vi.waitFor(() => {
      const el = core.root.querySelector<HTMLElement>('.nova-a11y-panel');
      if (!el) throw new Error('no panel');
      return el;
    });
    // As in TinyMCE, alt="" is flagged (I1) unless decorative images are allowed.
    expect(filtered).toEqual(['D2:B', 'I1:x.png']);
    expect(panel.querySelectorAll('.nova-a11y-card')).toHaveLength(2);
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/a11ychecker/);
  });

  it('ai: ai_request with respondWith.string, the AI events, mceAiDialog; edits as suggestions', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"><p>The quick brown fox</p></textarea>');
    const seen: Array<Record<string, unknown>> = [];
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'ai',
      toolbar: 'aidialog aishortcuts',
      ai_request: (
        request: Record<string, unknown>,
        respondWith: { string: (cb: (signal: AbortSignal) => Promise<string>) => void },
      ) => {
        seen.push(request);
        respondWith.string(async (signal) => {
          expect(signal).toBeInstanceOf(AbortSignal);
          return 'The quick red fox';
        });
      },
    });
    const { core } = editor!;
    const events: string[] = [];
    editor!.on('AIRequest AIResponse AIError AIDialogOpen AIDialogClose', (event) => {
      events.push(String(event.type));
    });
    // The suggestions plugin comes along: the assistant's edits are suggestions.
    expect(core.hasPlugin('suggestions')).toBe(true);
    expect(editor!.queryCommandSupported('mceAiDialog')).toBe(true);
    core.view.dispatch(
      core.view.state.tr.setSelection(TextSelection.create(core.view.state.doc, 1, 20)),
    );
    editor!.execCommand('mceAiDialog', false, { prompt: 'Change the color', generate: true });
    await vi.waitFor(() => expect(events).toContain('aidialogclose'));
    expect(events).toEqual(['aidialogopen', 'airequest', 'airesponse', 'aidialogclose']);
    expect(seen[0]).toMatchObject({
      query: 'Change the color',
      context: 'The quick brown fox',
      thread: [],
    });
    expect(String(seen[0]!.prompt)).toContain('Instruction: Change the color');
    expect((seen[0]!.system as string[]).length).toBeGreaterThan(2);
    expect(editor!.getContent()).toContain('<del');
    expect(editor!.getContent()).toContain('>red</ins>');
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).not.toMatch(/ai_request|ai_shortcuts/);
  });

  it('ai: respondWith.stream pieces, an HTML answer becomes text, a failure fires AIError', async () => {
    page('<textarea id="t"><p>Start.</p></textarea>');
    let mode: 'stream' | 'html' | 'fail' = 'stream';
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'ai',
      ai_shortcuts: [
        { title: 'Continue', prompt: 'Continue the text' },
        {
          title: 'Tone',
          subprompts: [{ title: 'Formal', prompt: 'Make it formal', selection: true }],
        },
      ],
      ai_request: (
        _request: unknown,
        respondWith: {
          stream: (
            cb: (signal: AbortSignal, message: (text: string) => void) => Promise<void>,
          ) => void;
        },
      ) =>
        respondWith.stream(async (_signal, message) => {
          if (mode === 'fail') throw new Error('Quota exceeded');
          if (mode === 'html') {
            message('<p>One more ');
            message('line.</p>');
            return;
          }
          message(' Next');
          message(' words.');
        }),
    });
    const { core } = editor!;
    const errors: unknown[] = [];
    editor!.on('AIError', (event) => errors.push(event.error));
    core.view.dispatch(core.view.state.tr.setSelection(TextSelection.atEnd(core.view.state.doc)));
    const menu = core.ui.registry.get('aishortcuts');
    if (menu?.type !== 'menu') throw new Error('no aishortcuts');
    const labels = menu
      .items(core)
      .map((e) => (e.type === 'heading' ? `# ${e.label}` : 'label' in e ? e.label : '-'));
    expect(labels).toEqual(['Continue', '-', '# Tone', 'Formal']);
    const run = async () => {
      const item = menu.items(core)[0]!;
      if (item.type === 'separator' || item.type === 'heading') throw new Error();
      item.onSelect();
      await vi.waitFor(() => expect(core.root.querySelector('.nova-dialog')).toBeNull());
    };
    await run();
    expect(editor!.getContent({ format: 'text' })).toBe('Start. Next words.');
    mode = 'html';
    core.setContent('<p>Start.</p>');
    core.view.dispatch(core.view.state.tr.setSelection(TextSelection.atEnd(core.view.state.doc)));
    await run();
    expect(editor!.getContent({ format: 'text' })).toBe('Start. One more line.');
    mode = 'fail';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const item = menu.items(core)[0]!;
    if (item.type === 'separator' || item.type === 'heading') throw new Error();
    item.onSelect();
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(String(errors[0])).toContain('Quota exceeded');
    await vi.waitFor(() =>
      expect(core.root.querySelector('.nova-dialog-error')?.textContent).toBe(
        'The AI request failed.',
      ),
    );
    expect(error).toHaveBeenCalled();
    editor!.execCommand('mceAiDialogClose');
    expect(core.root.querySelector('.nova-dialog')).toBeNull();
  });

  it('inlinecss: getContent() gives the content with its styles inline; the filters and InlineCSS work', async () => {
    page('<textarea id="t"><p class="lead">Hello <a href="/x">link</a></p></textarea>');
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'inlinecss lists nosuchemailplugin',
      valid_classes: 'lead',
      content_style: '.lead { color: #7c3aed } a { color: red } .skip { color: blue }',
      inlinecss_selector_filter: (selector: string) => selector !== '.skip',
    });
    const events: string[] = [];
    editor!.on('InlineCSS', (event) => events.push(String(event.type)));
    const inlinecss = editor!.plugins.inlinecss as { getContent(): Promise<{ html: string }> };
    const { html } = await inlinecss.getContent();
    expect(events).toEqual(['inlinecss']);
    expect(html).toContain('<p class="lead" style="margin: 0 0 12px; color: #7c3aed">');
    expect(html).toMatch(
      /<a href="http[^"]*\/x" style="text-decoration: underline; color: red">link<\/a>/,
    );
    // editor.plugins: what is listed and works; not what is missing.
    expect(Object.keys(editor!.plugins).sort()).toEqual(['inlinecss', 'lists']);
  });

  it('typography: the options and mceTypography', async () => {
    page('<textarea id="t"><p>"Hallo" -- <code>"x"</code> ...</p></textarea>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'typography',
      typography_default_lang: ['de'],
      typography_langs: ['de', 'en-US'],
      typography_rules: ['common/punctuation/quote', 'en-US/dash/main'],
      typography_ignore: ['code'],
    });
    expect(warn.mock.calls.flat().join(' ')).not.toContain('typography');
    editor!.execCommand('mceTypography');
    // German quotes and dash; the ellipsis rule wasn't listed; code is left alone.
    expect(editor!.getContent()).toBe('<p>„Hallo“ – <code>"x"</code> ...</p>');
    localStorage.removeItem('novaprose-typography');
  });

  it('toolbar_mode: floating, sliding, scrolling and wrap, each as it is', async () => {
    for (const mode of ['floating', 'sliding', 'scrolling', 'wrap'] as const) {
      page('<textarea id="t"></textarea>');
      const [editor] = await tinymce.init({ selector: '#t', toolbar_mode: mode });
      expect(
        editor!.core.root.querySelector('.nova-toolbar[role="toolbar"]')!.classList,
        mode,
      ).toContain(`nova-toolbar-${mode}`);
      editor!.remove();
    }
  });

  it('text_patterns: a list of TinyMCE patterns, its formats and commands; text_patterns_lookup', async () => {
    page('<textarea id="t"></textarea>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [editor] = await tinymce.init({
      selector: '#t',
      text_patterns: [
        { start: '*', end: '*', format: 'italic' },
        { start: '#', format: 'h1', trigger: 'space' },
        { start: '>', cmd: 'mceBlockQuote' },
        { start: '---', cmd: 'InsertHorizontalRule' },
        { start: '(c)', replacement: '©' },
        { start: 'sig', replacement: '<strong>Ann</strong>' },
      ],
      text_patterns_lookup: (ctx: { text: string }) =>
        ctx.text.endsWith('@today') ? [{ start: '@today', replacement: '28.11.2026' }] : [],
    });
    expect(warn.mock.calls.flat().join(' ')).not.toContain('text_patterns');
    const view = editor!.core.view;
    const type = (text: string) => {
      for (const ch of text) {
        const { from, to } = view.state.selection;
        const handled = view.someProp('handleTextInput', (f) =>
          f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)),
        );
        if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
      }
    };
    const fresh = () => {
      editor!.setContent('<p></p>');
      editor!.selection.setCursorLocation(editor!.getBody().firstChild as Node, 0);
    };
    fresh();
    type('# Title');
    expect(editor!.getContent()).toBe('<h1>Title</h1>');
    fresh();
    type('a *b* (c) sig @today ');
    expect(editor!.getContent()).toBe(
      '<p>a <em>b</em> © <strong>Ann</strong> 28.11.2026&nbsp;</p>',
    );
    fresh();
    type('> quote');
    expect(editor!.getContent()).toBe('<blockquote><p>quote</p></blockquote>');
    fresh();
    type('--- ');
    expect(editor!.getContent()).toContain('<hr>');
  });

  it('linkchecker: the service address and preprocess, without a warning', async () => {
    page('<textarea id="t"><p><a href="https://example.com/gone?k=1">x</a></p></textarea>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ results: { 'https://example.com/gone': 'invalid' } })),
      );
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'linkchecker',
      linkchecker_service_url: '/check-links',
      linkchecker_preprocess: (data: { url: string }) => ({ url: data.url.split('?')[0] }),
      linkchecker_content_css: '/linkchecker.css',
    });
    await vi.waitFor(() =>
      expect(editor!.core.view.dom.querySelector('.nova-link-broken')).not.toBeNull(),
    );
    expect(fetch.mock.calls[0]![0]).toBe('/check-links');
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({
      urls: ['https://example.com/gone'],
    });
    expect(warn.mock.calls.flat().join(' ')).not.toContain('linkchecker');
  });

  it('pageembed: TinyMCE classes stay, sizes from tiny_pageembed_classes, without a warning', async () => {
    page(
      '<textarea id="t"><div class="tiny-pageembed tiny-pageembed--16by9">' +
        '<iframe src="https://example.com/map" title="Map"></iframe></div></textarea>',
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'pageembed',
      tiny_pageembed_classes: [
        { text: 'Wide', value: 'tiny-pageembed--16by9' },
        { text: 'Square', value: 'tiny-pageembed--1by1' },
      ],
      tiny_pageembed_inline_styles: false,
    });
    const html = editor!.getContent();
    expect(html).toContain(
      '<div class="tiny-pageembed tiny-pageembed--16by9"><iframe src="https://example.com/map" title="Map" sandbox=',
    );
    expect(html).not.toContain('padding-top');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('pageembed');
  });

  it('advtable: the numbers column and sorting through TinyMCE commands, your series', async () => {
    page(
      '<textarea id="t"><table><tbody><tr><th><p>Fruit</p></th><th><p>Price</p></th></tr>' +
        '<tr><td><p>Pear</p></td><td><p>3</p></td></tr>' +
        '<tr><td><p>Apple</p></td><td><p>12</p></td></tr></tbody></table></textarea>',
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'table advtable',
      advtable_value_series: {
        roman: {
          title: 'Roman',
          generator: (_info: unknown, row: number) => ({ value: ['i', 'ii', 'iii'][row] }),
        },
      },
    });
    const { core } = editor!;
    await core.ready;
    const cursorIn = (text: string) => {
      let pos = -1;
      core.view.state.doc.descendants((node, p) => {
        if (pos < 0 && node.isText && node.text === text) pos = p;
        return pos < 0;
      });
      core.view.dispatch(
        core.view.state.tr.setSelection(TextSelection.create(core.view.state.doc, pos)),
      );
    };
    const column = (index: number) =>
      [...core.view.dom.querySelectorAll('tr')].map((tr) => tr.children[index]?.textContent);
    cursorIn('Pear');
    expect(editor!.execCommand('mceTableToggleSeries', false, { name: 'roman' })).toBe(true);
    expect(editor!.getContent()).toContain('data-series="roman"><p>i</p></td>');
    // By price (the third column now), descending.
    editor!.execCommand('mceSortTableAdvanced', false, {
      sortby: 'column',
      roworcol: '2',
      sort: 'table',
      order: 'descending',
    });
    expect(column(1)).toEqual(['Fruit', 'Apple', 'Pear']);
    expect(column(0)).toEqual(['', 'i', 'ii']);
    cursorIn('Pear');
    editor!.execCommand('mceSortTableByColumnDesc');
    expect(column(1)).toEqual(['Fruit', 'Pear', 'Apple']);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('advtable');
  });

  it('advcode: mceCodeEditor opens the code editor; getContent laid out on request', async () => {
    page('<textarea id="t"><ul><li><p>a</p></li></ul></textarea>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'advcode',
      advcode_prettify_getcontent: true,
      advcode_prettify_editor: true,
      advcode_inline: false,
    });
    await editor!.core.ready;
    expect(editor!.getContent()).toBe('<ul>\n  <li>\n    <p>a</p>\n  </li>\n</ul>');
    expect(editor!.execCommand('mceCodeEditor')).toBe(true);
    await vi.waitFor(() => expect(editor!.core.root.querySelector('.cm-editor')).not.toBeNull(), {
      timeout: 5000,
    });
    expect(warn.mock.calls.flat().join(' ')).not.toContain('advcode');
  });

  it('text_patterns: false turns off the typing shortcuts, without a warning', async () => {
    page('<textarea id="t"></textarea>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [editor] = await tinymce.init({ selector: '#t', text_patterns: false });
    expect(warn.mock.calls.flat().join(' ')).not.toContain('text_patterns');
    const view = editor!.core.view;
    for (const ch of '# Title') {
      const { from, to } = view.state.selection;
      const handled = view.someProp('handleTextInput', (f) =>
        f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)),
      );
      if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
    }
    expect(editor!.getContent()).toBe('<p># Title</p>');
  });

  it('autocorrect: the options, the Tools menu items and their Start/End events', async () => {
    page('<textarea id="t"></textarea>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'autocorrect',
      menubar: 'tools',
      autocorrect_capitalize: true,
      autocorrect_service_url: 'https://spelling.example.com/',
    });
    expect(warn.mock.calls.flat().join(' ')).not.toContain('autocorrect');
    const core = editor!.core;
    const events: string[] = [];
    editor!.on('AutocorrectStart AutocorrectEnd CapitalizeStart CapitalizeEnd', (event) =>
      events.push(String(event.type)),
    );
    const item = (name: string) => core.ui.registry.getMenuItem(name)!;
    expect(item('autocorrect').isActive!(core)).toBe(true);
    expect(item('capitalization').isActive!(core)).toBe(true);
    item('autocorrect').onAction(core);
    item('capitalization').onAction(core);
    item('autocorrect').onAction(core);
    expect(events).toEqual(['autocorrectend', 'capitalizeend', 'autocorrectstart']);
    // The Tools menu holds them, under TinyMCE's names.
    const tools = core.root.querySelector<HTMLButtonElement>('[data-menu="tools"]')!;
    tools.click();
    const labels = [...document.querySelectorAll('.nova-popover-menu [role^="menuitem"]')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual([
      'Correct typos as you type',
      'Capitalize the first letter of sentences',
    ]);
    localStorage.removeItem('novaprose-autocorrect');
  });

  it('editor.plugins holds what your own plugin returns, as in TinyMCE', async () => {
    page('<textarea id="t"></textarea>');
    tinymce.PluginManager.add('greeter', () => ({ hello: () => 'hi' }));
    const [editor] = await tinymce.init({ selector: '#t', plugins: 'greeter' });
    expect((editor!.plugins.greeter as { hello(): string }).hello()).toBe('hi');
  });

  it('ai_shortcuts: false hides the shortcuts', async () => {
    page('<textarea id="t"></textarea>');
    const [editor] = await tinymce.init({
      selector: '#t',
      plugins: 'ai',
      ai_shortcuts: false,
      ai_request: () => undefined,
    });
    expect(editor!.core.ui.registry.has('aishortcuts')).toBe(false);
    expect(editor!.core.ui.registry.has('aidialog')).toBe(true);
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
