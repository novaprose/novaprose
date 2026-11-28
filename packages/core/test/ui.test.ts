import { TextSelection } from 'prosemirror-state';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyLink,
  countWords,
  createEditor,
  getStyle,
  normalizeUrl,
  registerLanguage,
  setLineHeight,
  setStyle,
  uploadImages,
  type Editor,
  type EditorOptions,
} from '../src';
import { createTranslator } from '../src/i18n';
import dePack from '../src/i18n/packs/de';
import { parseToolbar } from '../src/ui/toolbar';

// A language pack (not built into the core): registered the way a customer does it.
registerLanguage('de', dePack);

let editor: Editor | null = null;

function mount(content = '', options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

function select(e: Editor, from: number, to: number) {
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, from, to)));
}

function selectAll(e: Editor) {
  select(e, 1, e.view.state.doc.content.size - 1);
}

const control = (e: Editor, name: string) =>
  e.root.querySelector<HTMLButtonElement>(`[data-control="${name}"]`)!;

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeAll(() => {
  // jsdom doesn't implement blob URLs.
  let n = 0;
  URL.createObjectURL ??= () => `blob:test/${++n}`;
  URL.revokeObjectURL ??= () => {};
});

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('text styles', () => {
  it.each([
    '<p><span style="color: #ff0000;">red</span></p>',
    '<p><span style="background-color: yellow;">highlight</span></p>',
    '<p><span style="font-size: 18pt;">large</span></p>',
    '<p><span style="font-family: Georgia, serif;">font</span></p>',
    '<p style="line-height: 1.5;">spacing</p>',
    '<h2 style="text-align: center; line-height: 2;">both styles</h2>',
  ])('keeps %s', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('normalizes colors to #rrggbb', () => {
    expect(
      mount(
        '<p><span style="color: rgb(255, 0, 0)">a</span><span style="background-color: #ABC">b</span></p>',
      ).getHTML(),
    ).toBe(
      '<p><span style="color: #ff0000;">a</span><span style="background-color: #aabbcc;">b</span></p>',
    );
  });

  it('drops dangerous and invalid style values', () => {
    const html = mount(
      '<p><span style="font-size: expression(alert(1))">a</span><span style="color: url(javascript:x)">b</span></p>',
    ).getHTML();
    expect(html).toBe('<p>ab</p>');
  });

  it("doesn't output an invalid style that came through JSON", () => {
    const e = mount();
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'color', attrs: { value: 'red; position: fixed' } }],
            },
          ],
        },
      ],
    });
    expect(e.getHTML()).toBe('<p><span>x</span></p>');
  });

  it('setStyle sets, changes and removes a color', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    e.exec(setStyle('color', '#ff0000'));
    expect(e.getHTML()).toBe('<p><span style="color: #ff0000;">text</span></p>');
    expect(getStyle(e.view.state, 'color')).toBe('#ff0000');
    e.exec(setStyle('color', '#00ff00'));
    expect(e.getHTML()).toBe('<p><span style="color: #00ff00;">text</span></p>');
    e.exec(setStyle('color', null));
    expect(e.getHTML()).toBe('<p>text</p>');
  });

  it('setStyle refuses an invalid value', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    expect(e.exec(setStyle('font_size', '12px; color: red'))).toBe(false);
  });

  it('line height', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    e.exec(setLineHeight('1.5'));
    expect(e.getHTML()).toBe('<p style="line-height: 1.5;">text</p>');
    e.exec('h1');
    expect(e.getHTML()).toBe('<h1 style="line-height: 1.5;">text</h1>');
  });

  it('clearing formatting removes styles too', () => {
    const e = mount('<p><strong><span style="color: red;">text</span></strong></p>');
    selectAll(e);
    e.exec('clearFormatting');
    expect(e.getHTML()).toBe('<p>text</p>');
  });
});

describe('links', () => {
  it.each([
    ['example.com', 'https://example.com'],
    ['www.example.com/path?q=1', 'https://www.example.com/path?q=1'],
    ['user@mail.ru', 'mailto:user@mail.ru'],
    ['https://a.b', 'https://a.b'],
    ['/docs', '/docs'],
    ['#top', '#top'],
  ])('normalizeUrl(%s) = %s', (input, output) => {
    expect(normalizeUrl(input)).toBe(output);
  });

  it('applyLink on a selection', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    e.exec(applyLink({ href: 'example.com', target: '_blank' }));
    expect(e.getHTML()).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">text</a></p>',
    );
  });

  it('applyLink without a selection inserts the link text', () => {
    const e = mount('<p>a</p>');
    select(e, 2, 2);
    e.exec(applyLink({ href: 'https://x.io', text: ' site' }));
    expect(e.getHTML()).toBe('<p>a<a href="https://x.io"> site</a></p>');
  });

  it('applyLink changes the text and keeps bold', () => {
    const e = mount('<p><strong>old</strong></p>');
    selectAll(e);
    e.exec(applyLink({ href: 'https://x.io', text: 'new' }));
    expect(e.getHTML()).toBe('<p><a href="https://x.io"><strong>new</strong></a></p>');
  });

  it('applyLink refuses javascript:', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    expect(e.exec(applyLink({ href: 'javascript:alert(1)' }))).toBe(false);
  });

  it('link dialog: Mod-k opens it, submitting inserts the link', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    control(e, 'link').click();
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    expect(dialog).not.toBeNull();
    const [url] = dialog.querySelectorAll<HTMLInputElement>('input');
    url!.value = 'example.com';
    dialog.requestSubmit();
    return flush().then(() => {
      expect(e.root.querySelector('.nova-dialog')).toBeNull();
      expect(e.getHTML()).toBe('<p><a href="https://example.com">text</a></p>');
    });
  });

  it("link dialog shows an error for an unsafe address and doesn't close", async () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    control(e, 'link').click();
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    dialog.querySelector<HTMLInputElement>('input')!.value = 'javascript:alert(1)';
    dialog.requestSubmit();
    await flush();
    expect(e.root.querySelector('.nova-dialog')).not.toBeNull();
    expect(dialog.querySelector('.nova-dialog-error')!.textContent).not.toBe('');
    expect(e.getHTML()).toBe('<p>text</p>');
  });

  it('Escape closes the dialog', () => {
    const e = mount('<p>text</p>');
    control(e, 'link').click();
    const dialog = e.root.querySelector('.nova-dialog')!;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(e.root.querySelector('.nova-dialog')).toBeNull();
  });

  it('an Escape a field inside used itself keeps the dialog open', () => {
    const e = mount('<p>text</p>');
    control(e, 'link').click();
    const input = e.root.querySelector<HTMLInputElement>('.nova-dialog input')!;
    input.addEventListener('keydown', (event) => event.preventDefault());
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(e.root.querySelector('.nova-dialog')).not.toBeNull();
  });

  it("two editors' dialogs open at once don't pull the focus back and forth", () => {
    const first = mount('<p>one</p>');
    const element = document.createElement('div');
    document.body.appendChild(element);
    const second = createEditor({ element, content: '<p>two</p>' });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    control(first, 'link').click();
    control(second, 'link').click();
    // The newest dialog keeps the focus.
    expect(second.root.contains(document.activeElement)).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    second.destroy();
    errors.mockRestore();
  });
});

describe('toolbar', () => {
  it('parses a string config with groups', () => {
    expect(parseToolbar('undo redo |  bold italic | | link')).toEqual([
      ['undo', 'redo'],
      ['bold', 'italic'],
      ['link'],
    ]);
    expect(parseToolbar(['bold', '|', 'link'])).toEqual([['bold'], ['link']]);
  });

  it('renders buttons from the config and skips unknown ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount('<p>a</p>', { toolbar: 'bold italic | nonexistent link' });
    const names = [...e.root.querySelectorAll('[data-control]')].map((b) =>
      b.getAttribute('data-control'),
    );
    expect(names).toEqual(['bold', 'italic', 'link']);
    expect(e.root.querySelectorAll('.nova-tb-group')).toHaveLength(2);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('a custom button through setup and the registry', () => {
    const onAction = vi.fn();
    const e = mount('<p>a</p>', {
      toolbar: 'bold mybutton',
      setup: (ed) =>
        ed.ui.registry.addButton('myButton', { text: 'Hi', tooltip: 'Mine', onAction }),
    });
    control(e, 'mybutton').click();
    expect(onAction).toHaveBeenCalledWith(e);
  });

  it('the bold button reflects its state in aria-pressed', () => {
    const e = mount('<p><strong>a</strong>b</p>');
    select(e, 1, 2);
    expect(control(e, 'bold').getAttribute('aria-pressed')).toBe('true');
    select(e, 3, 3);
    expect(control(e, 'bold').getAttribute('aria-pressed')).toBe('false');
  });

  it('the block style menu shows the current style and applies the chosen one', () => {
    const e = mount('<h2>heading</h2>', { language: 'de' });
    select(e, 2, 2);
    const blocks = control(e, 'blocks');
    expect(blocks.textContent).toContain('Überschrift 2');
    blocks.click();
    expect(blocks.getAttribute('aria-expanded')).toBe('true');
    const menu = e.root.querySelector('.nova-menu')!;
    expect(menu.querySelector('[aria-checked="true"]')?.textContent).toContain('Überschrift 2');
    menu.querySelector<HTMLButtonElement>('[data-id="paragraph"]')!.click();
    expect(e.getHTML()).toBe('<p>heading</p>');
    expect(e.root.querySelector('.nova-menu')).toBeNull();
    expect(blocks.getAttribute('aria-expanded')).toBe('false');
  });

  it('menu: arrow navigation', () => {
    const e = mount('<p>a</p>');
    control(e, 'blocks').click();
    const menu = e.root.querySelector<HTMLElement>('.nova-menu')!;
    const items = menu.querySelectorAll<HTMLButtonElement>('.nova-menu-item');
    expect(document.activeElement).toBe(items[0]); // the checked "Paragraph"
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(items[items.length - 1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
  });

  it('the color palette applies a color', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    control(e, 'forecolor').click();
    e.root.querySelector<HTMLButtonElement>('.nova-swatch[aria-label="#3b82f6"]')!.click();
    expect(e.getHTML()).toBe('<p><span style="color: #3b82f6;">text</span></p>');
    expect(e.root.querySelector('.nova-color-panel')).toBeNull();
  });

  it('roving tabindex: only one toolbar button has tabindex=0', () => {
    const e = mount('<p>a</p>');
    const tabbable = e.root.querySelectorAll('.nova-toolbar button[tabindex="0"]');
    expect(tabbable).toHaveLength(1);
  });
});

describe('i18n', () => {
  it('English by default, another language through language', () => {
    expect(control(mount('<p>a</p>'), 'bold').getAttribute('aria-label')).toBe('Bold');
    editor!.destroy();
    expect(control(mount('<p>a</p>', { language: 'de' }), 'bold').getAttribute('aria-label')).toBe(
      'Fett',
    );
  });

  it('fallback: pt-BR → pt → en, overrides and parameters', () => {
    registerLanguage('pt', { bold: 'Negrito' });
    expect(createTranslator('pt-BR')('bold')).toBe('Negrito');
    expect(createTranslator('pt-BR')('italic')).toBe('Italic');
    expect(createTranslator('xx')('bold')).toBe('Bold');
    expect(createTranslator('en', { bold: 'B' })('bold')).toBe('B');
    expect(createTranslator('de')('status.words', { count: 5 })).toBe('Wörter: 5');
  });
});

describe('statusbar', () => {
  it.each([
    ['', 0],
    ['Hello, world!', 2],
    ["don't stop-motion 2026 year", 4],
    ['  many   spaces  ', 2],
    // Chinese and Japanese have no spaces: every character is a word (as in word processors).
    ['日本語の文章です', 8],
    ['你好，世界', 4],
    ['Hello 世界 and カタカナ', 8],
    // Korean is written with spaces between words.
    ['한국어 문장입니다', 2],
  ])('countWords(%j) = %i', (text, count) => {
    expect(countWords(text)).toBe(count);
  });

  it('shows the path to the element', () => {
    const e = mount('<ul><li><p><strong>a</strong></p></li></ul>');
    select(e, 4, 4);
    expect(e.root.querySelector('.nova-path')!.textContent).toBe('ul › li › p › strong');
  });

  it('can be turned off', () => {
    expect(
      mount('<p>a</p>', { statusbar: false }).root.querySelector('.nova-statusbar'),
    ).toBeNull();
  });
});

describe('image upload', () => {
  const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' });

  it('through uploadImage: shows the blob, then swaps in the server URL', async () => {
    let resolve!: (url: string) => void;
    const uploadImage = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const e = mount('<p>a</p>', { uploadImage });
    select(e, 2, 2);
    uploadImages(e, [png()]);
    expect(e.getHTML()).toMatch(/<img src="blob:/);
    // The file is prepared first (imageOptimize, on by default), then handed to uploadImage.
    await vi.waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    resolve('https://cdn.example.com/a.png');
    await flush();
    expect(e.getHTML()).toBe('<p>a<img src="https://cdn.example.com/a.png"></p>');
    // Swapping src doesn't create a separate undo step: one undo removes the whole image.
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>a</p>');
  });

  describe('upload failure', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => vi.useRealTimers());

    /** A handler that fails `fails` times, then returns the address. */
    const flaky = (fails: number) => {
      let calls = 0;
      return vi.fn(() =>
        ++calls <= fails
          ? Promise.reject(new Error('503'))
          : Promise.resolve(`https://cdn.example.com/${calls}.png`),
      );
    };
    const errorBox = (e: Editor) => e.root.querySelector('.nova-notification-error');
    const action = (e: Editor, label: string) =>
      [...e.root.querySelectorAll<HTMLButtonElement>('.nova-notification-action')].find(
        (b) => b.textContent === label,
      )!;

    it('a temporary failure: an automatic retry, the image uploads without the user', async () => {
      const uploadImage = flaky(2);
      const e = mount('<p>a</p>', { uploadImage, imageOptimize: false });
      select(e, 2, 2);
      uploadImages(e, [png()]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(uploadImage).toHaveBeenCalledTimes(3);
      expect(e.getHTML()).toBe('<p>a<img src="https://cdn.example.com/3.png"></p>');
      expect(errorBox(e)).toBeNull();
    });

    it('a persistent failure: the image stays, "Retry" uploads it', async () => {
      const uploadImage = flaky(3);
      const e = mount('<p>a</p>', { uploadImage, imageOptimize: false });
      select(e, 2, 2);
      uploadImages(e, [png()]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(uploadImage).toHaveBeenCalledTimes(3);
      expect(e.getHTML()).toMatch(/<img src="blob:/);
      expect(errorBox(e)).not.toBeNull();
      action(e, 'Retry').click();
      await vi.advanceTimersByTimeAsync(0);
      expect(e.getHTML()).toBe('<p>a<img src="https://cdn.example.com/4.png"></p>');
      expect(errorBox(e)).toBeNull();
    });

    it('"Remove image" and closing the notification remove it (blob: never reaches the document)', async () => {
      for (const how of ['remove', 'close'] as const) {
        const e = mount('<p>a</p>', { uploadImage: flaky(99), imageOptimize: false });
        select(e, 2, 2);
        uploadImages(e, [png()]);
        await vi.advanceTimersByTimeAsync(5000);
        if (how === 'remove') action(e, 'Remove image').click();
        else errorBox(e)!.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click();
        expect(e.getHTML()).toBe('<p>a</p>');
      }
    });

    it("an unsafe address from the server isn't retried", async () => {
      const uploadImage = vi.fn(() => Promise.resolve('javascript:alert(1)'));
      const e = mount('<p>a</p>', { uploadImage });
      uploadImages(e, [png()]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(uploadImage).toHaveBeenCalledTimes(1);
      expect(errorBox(e)).not.toBeNull();
    });

    it('the image was deleted during the upload: no errors and no retries', async () => {
      const uploadImage = flaky(99);
      const e = mount('<p>a</p>', { uploadImage });
      select(e, 2, 2);
      uploadImages(e, [png()]);
      e.setContent('<p>other</p>');
      await vi.advanceTimersByTimeAsync(5000);
      expect(uploadImage).toHaveBeenCalledTimes(1);
      expect(errorBox(e)).toBeNull();
    });
  });

  it('ignores non-images', () => {
    const e = mount('<p>a</p>');
    uploadImages(e, [new File(['x'], 'a.txt', { type: 'text/plain' })]);
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});
