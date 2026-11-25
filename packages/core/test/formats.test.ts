import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { cleanPastedHTML } from '../src/paste-office';

/** Форматы и стили (formats / style_formats): классы в схеме, применение к выделению, меню. */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(content: string, options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

const select = (e: Editor, from: number, to = from) =>
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, from, to)));

const FORMATS: EditorOptions['formats'] = {
  note: { block: 'p', classes: 'note' },
  title: { block: 'h2', classes: ['title', 'big'] },
  quote: { block: 'blockquote', classes: 'pull' },
  hl: { inline: 'span', classes: 'hl' },
  red: { inline: 'span', styles: { color: '#ff0000' } },
  important: { inline: 'strong', classes: 'imp' },
  centered: { selector: 'p,h1,h2', styles: { 'text-align': 'center' }, classes: 'c' },
  imgLeft: { selector: 'img', classes: 'img-left' },
};

describe('классы в схеме', () => {
  it('HTML с классами форматов — туда и обратно без изменений', () => {
    const html =
      '<p class="note">a</p><h2 class="title big" style="text-align: center;">b</h2>' +
      '<blockquote class="pull"><p>c</p></blockquote>' +
      '<p><span class="hl">d</span> <img src="https://example.com/a.png" class="img-left"></p>';
    const e = mount(html, { formats: FORMATS });
    expect(e.getHTML()).toBe(html);
    e.setContent(e.getHTML());
    expect(e.getHTML()).toBe(html);
  });

  it('по умолчанию классы не сохраняются — вывод как раньше', () => {
    const e = mount('<p class="MsoNormal">a <span class="x">b</span></p>');
    expect(e.getHTML()).toBe('<p>a b</p>');
  });

  it('чужие классы отбрасываются, разрешённые остаются; validClasses: список и true', () => {
    const html = '<p class="note junk">a</p><p class="extra">b</p>';
    expect(mount(html, { formats: FORMATS }).getHTML()).toBe('<p class="note">a</p><p>b</p>');
    editor!.destroy();
    expect(mount(html, { formats: FORMATS, validClasses: ['extra'] }).getHTML()).toBe(
      '<p class="note">a</p><p class="extra">b</p>',
    );
    editor!.destroy();
    expect(mount(html, { validClasses: true }).getHTML()).toBe(
      '<p class="note junk">a</p><p class="extra">b</p>',
    );
  });

  it('некорректные имена классов из JSON не выводятся', () => {
    const e = mount('', { validClasses: true });
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { class: 'ok "><script>x' },
          content: [{ type: 'text', text: 'a' }],
        },
      ],
    });
    expect(e.getHTML()).toBe('<p class="ok">a</p>');
  });

  it('formatter.register в setup: классы нового формата сохраняются при разборе', () => {
    const e = mount('', {
      setup: (ed) => ed.formatter.register('lead', { block: 'p', classes: 'lead' }),
    });
    e.setContent('<p class="lead">x</p>');
    expect(e.getHTML()).toBe('<p class="lead">x</p>');
  });

  it('вставка из Word: классы Office снимаются (их стили уже перенесены в style)', () => {
    const html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"><body><p class="MsoNormal">a</p></body></html>';
    expect(cleanPastedHTML(html)).not.toContain('MsoNormal');
  });
});

describe('formatter', () => {
  it('block: тип блока, классы и match; remove возвращает абзац', () => {
    const e = mount('<p>a</p>', { formats: FORMATS });
    select(e, 1);
    expect(e.formatter.match('title')).toBe(false);
    e.formatter.apply('title');
    expect(e.getHTML()).toBe('<h2 class="title big">a</h2>');
    expect(e.formatter.match('title')).toBe(true);
    e.formatter.remove('title');
    expect(e.getHTML()).toBe('<p>a</p>');
    e.formatter.toggle('note');
    expect(e.getHTML()).toBe('<p class="note">a</p>');
    e.formatter.toggle('note');
    expect(e.getHTML()).toBe('<p>a</p>');
  });

  it('blockquote: оборачивает с классом и снимает', () => {
    const e = mount('<p>a</p>', { formats: FORMATS });
    select(e, 1);
    e.formatter.apply('quote');
    expect(e.getHTML()).toBe('<blockquote class="pull"><p>a</p></blockquote>');
    expect(e.formatter.match('quote')).toBe(true);
    e.formatter.remove('quote');
    expect(e.getHTML()).toBe('<p>a</p>');
  });

  it('inline: span с классом, стиль цветом, тег с классом; снятие только своих классов', () => {
    const e = mount('<p>hello</p>', { formats: FORMATS });
    select(e, 1, 6);
    e.formatter.apply('hl');
    e.formatter.apply('red');
    expect(e.getHTML()).toContain('class="hl"');
    expect(e.getHTML()).toContain('color: #ff0000;');
    expect(e.formatter.match('hl')).toBe(true);
    expect(e.formatter.match('red')).toBe(true);
    e.formatter.remove('hl');
    e.formatter.remove('red');
    expect(e.getHTML()).toBe('<p>hello</p>');
    e.formatter.apply('important');
    expect(e.formatter.match('important')).toBe(true);
    expect(e.getHTML()).toContain('<strong>');
    expect(e.getHTML()).toContain('class="imp"');
  });

  it('selector: выравнивание и класс существующим блокам; картинке — класс, выделение остаётся', () => {
    const e = mount('<p>a</p><h2>b</h2><p><img src="https://example.com/a.png"></p>', {
      formats: FORMATS,
    });
    select(e, 1, 5);
    e.formatter.apply('centered');
    expect(e.getHTML()).toContain('<p class="c" style="text-align: center;">a</p>');
    expect(e.getHTML()).toContain('<h2 class="c" style="text-align: center;">b</h2>');
    e.formatter.remove('centered');
    expect(e.getHTML()).toContain('<p>a</p><h2>b</h2>');
    let imagePos = -1;
    e.view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imagePos = pos;
    });
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, imagePos)));
    e.formatter.apply('imgLeft');
    expect(e.getHTML()).toContain('<img src="https://example.com/a.png" class="img-left">');
    expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
    expect(e.root.querySelector('.nova-image img')!.className).toBe('img-left');
  });

  it('неизвестный формат и неподдерживаемый стиль — предупреждение, не ошибка', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount('<p>a</p>');
    select(e, 1, 2);
    expect(e.formatter.apply('nope')).toBe(false);
    e.formatter.apply({ inline: 'span', styles: { 'text-shadow': '1px 1px red' } });
    expect(warn.mock.calls.join('\n')).toMatch(/nope/);
    expect(warn.mock.calls.join('\n')).toMatch(/text-shadow/);
  });

  it('только чтение: форматы не применяются', () => {
    const e = mount('<p>a</p>', { formats: FORMATS, editable: false });
    select(e, 1);
    expect(e.formatter.apply('note')).toBe(false);
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});

describe('меню «Стили»', () => {
  const open = (e: Editor) => {
    e.root.querySelector<HTMLButtonElement>('[data-control="styles"]')!.click();
    return e.root.querySelector<HTMLElement>('.nova-menu')!;
  };

  it('по умолчанию — группы заголовков, текста, блоков и выравнивания', () => {
    const e = mount('<h2>a</h2>', { toolbar: 'styles' });
    select(e, 1);
    const button = e.root.querySelector('[data-control="styles"]')!;
    expect(button.textContent).toContain('Heading 2');
    const menu = open(e);
    expect([...menu.querySelectorAll('.nova-menu-heading')].map((h) => h.textContent)).toEqual([
      'Headings',
      'Inline',
      'Blocks',
      'Align',
    ]);
    [...menu.querySelectorAll<HTMLButtonElement>('.nova-menu-item')]
      .find((b) => b.textContent?.includes('Align center'))!
      .click();
    expect(e.getHTML()).toBe('<h2 style="text-align: center;">a</h2>');
  });

  it('свои styleFormats: группы, ссылки на formats, отметка текущего', () => {
    const e = mount('<p class="note">a</p>', {
      toolbar: 'styles',
      formats: FORMATS,
      styleFormats: [
        { title: 'Note', format: 'note' },
        { title: 'Text', items: [{ title: 'Marker', inline: 'span', classes: 'marker' }] },
      ],
    });
    select(e, 1);
    expect(e.root.querySelector('[data-control="styles"]')!.textContent).toContain('Note');
    const menu = open(e);
    const items = [...menu.querySelectorAll<HTMLButtonElement>('.nova-menu-item')];
    expect(items.map((i) => i.querySelector('.nova-menu-label')?.textContent)).toEqual([
      'Note',
      'Marker',
    ]);
    expect(items[0]!.getAttribute('aria-checked')).toBe('true');
    // Классы из styleFormats сохраняются при разборе.
    e.setContent('<p><span class="marker">x</span></p>');
    expect(e.getHTML()).toBe('<p><span class="marker">x</span></p>');
  });
});
