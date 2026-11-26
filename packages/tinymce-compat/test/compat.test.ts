import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTinymce, type CompatEditor } from '../src';

/** tinymce.init() и API редактора — сценарии типичных интеграций (по публичной документации). */

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

describe('tinymce.init', () => {
  it('заменяет <textarea>: начальное содержимое, скрытый textarea, getContent/setContent', async () => {
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

  it('порядок: setup → события init → init_instance_callback; промис отдаёт редакторы', async () => {
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

  it('отправка формы записывает HTML в textarea; triggerSave и isDirty', async () => {
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

  it('execCommand и queryCommandState по именам команд TinyMCE', async () => {
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

  it('insertContent вставляет HTML с той же очисткой, что и вставка', async () => {
    page('<textarea id="t"><p>a</p></textarea>');
    const [editor] = await tinymce.init({ selector: '#t' });
    editor!.execCommand('SelectAll');
    editor!.selection.collapse(false);
    editor!.insertContent('<em>b</em><script>alert(1)</script>');
    expect(editor!.getContent()).toBe('<p>a<em>b</em></p>');
  });

  it('insertContent с блоком (<p>) посреди абзаца вставляет новый абзац', async () => {
    page('<textarea id="t"><p>Hello world</p></textarea>');
    const [editor] = await tinymce.init({ selector: '#t' });
    editor!.execCommand('SelectAll');
    editor!.selection.collapse(false);
    editor!.insertContent('<p>Signature</p>');
    expect(editor!.getContent()).toBe('<p>Hello world</p><p>Signature</p>');
  });

  it('PluginManager.add: плагин регистрирует кнопку и команду, как в TinyMCE', async () => {
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

  it('addToggleButton с onSetup и api.setActive; иконки по именам TinyMCE', async () => {
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

  it('события: input на каждое изменение, change при уходе фокуса, keydown — событие браузера', async () => {
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

  it('опции: readonly, placeholder, height, content_style, images_upload_handler', async () => {
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
    expect(editor!.getContainer().querySelector('style')!.textContent).toContain(
      '.nova-prosemirror{ font-family: Georgia; }',
    );
    const upload = editor!.core.options.uploadImage!;
    await expect(upload(new File(['png'], 'a.png', { type: 'image/png' }), () => {})).resolves.toBe(
      'https://cdn.example.com/a.png',
    );
  });

  it('formats, style_formats, valid_classes и formatter.register — как в документации TinyMCE', async () => {
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
    // Без valid_classes TinyMCE сохраняет все классы — и мы тоже.
    expect(a!.getContent()).toBe('<p class="lead">a</p><p class="other">b</p>');
    expect(a!.core.options.styleFormats).toEqual([
      { title: 'Lead', format: 'lead' },
      { title: 'Inline', items: [{ title: 'Marker', inline: 'span', classes: 'marker' }] },
    ]);
    expect(a!.formatter.get('wrapper')).toBeUndefined();
    a!.selection.setCursorLocation(a!.getBody().querySelector('p')!, 0);
    expect(a!.formatter.match('lead')).toBe(true);
    // Формат добавляет свой класс и не трогает чужие; снятие убирает только его.
    a!.formatter.apply('note');
    expect(a!.getContent()).toContain('<p class="lead note">a</p>');
    a!.formatter.toggle('note');
    expect(a!.getContent()).toContain('<p class="lead">a</p>');

    // valid_classes ограничивает классы, классы форматов разрешены всегда.
    const [b] = await tinymce.init({
      selector: '#b',
      valid_classes: { p: 'other' },
      formats: { lead: { block: 'p', classes: 'lead' } },
    });
    expect(b!.getContent()).toBe('<p class="lead other">x</p>');
    b!.setContent('<p class="junk other">y</p>');
    expect(b!.getContent()).toBe('<p class="other">y</p>');
  });

  it('extended_valid_elements и custom_elements: иконки, id заголовков, свои элементы', async () => {
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

  it('addSidebar: onSetup рисует панель, кнопка и ToggleSidebar переключают её', async () => {
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

  it('опции: block_formats, disabled (и options.set на лету), resize', async () => {
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
    // resize: по умолчанию ручка по высоте, как в TinyMCE.
    expect(a!.getContainer().querySelector('.nova-resize-handle')).not.toBeNull();
    const [b] = await tinymce.init({ selector: '#b', resize: false });
    expect(b!.getContainer().querySelector('.nova-resize-handle')).toBeNull();
  });

  it('file_picker_callback и file_picker_types: свой менеджер файлов в диалогах', async () => {
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

  it('незнакомые опции и плагины — предупреждение, а не ошибка', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    page('<textarea id="t"></textarea>');
    await tinymce.init({ selector: '#t', plugins: 'lists nosuchplugin', some_future_option: 1 });
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).toMatch(/nosuchplugin/);
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).toMatch(/some_future_option/);
  });

  it('inline: редактирование прямо в элементе; remove возвращает исходный textarea', async () => {
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

  it('notificationManager и windowManager.alert/confirm', async () => {
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
