import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, registerHtmlRules, type Editor, type EditorOptions } from '../src';
import { toMarkdown } from '../src/markdown';
import { htmlRules } from '../src/html-rules';

registerHtmlRules(htmlRules);

/**
 * Правила элементов и атрибутов: validElements с атрибутами, extendedValidElements, customElements.
 * Главное свойство — HTML клиента, разрешённый правилами, проходит туда-обратно без изменений,
 * а безопасность правилами не отключается.
 */

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(options: Partial<EditorOptions>, content = ''): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

/** HTML после загрузки и после повторной загрузки собственного вывода — должен совпасть. */
function roundTrip(options: Partial<EditorOptions>, html: string): string {
  const e = mount(options, html);
  const first = e.getHTML();
  e.setContent(first);
  expect(e.getHTML()).toBe(first);
  return first;
}

describe('extendedValidElements: атрибуты встроенных элементов', () => {
  it('id у заголовков (оглавление) сохраняется', () => {
    const html = '<h2 id="intro">Intro</h2><p>Text</p>';
    expect(roundTrip({ extendedValidElements: 'h2[id]' }, html)).toBe(html);
  });

  it('без правила атрибут, как и раньше, не сохраняется', () => {
    // id у заголовка встроенный (оглавление, ссылки #раздел), title — нет.
    expect(roundTrip({}, '<h2 title="intro">Intro</h2>')).toBe('<h2>Intro</h2>');
  });

  it('список атрибутов ссылки заменяет встроенный: data-* и rel остаются, title снят', () => {
    const out = roundTrip(
      { extendedValidElements: 'a[href|rel|data-*]' },
      '<p><a href="https://a.io" rel="sponsored" data-track="cta" title="T">x</a></p>',
    );
    expect(out).toBe('<p><a href="https://a.io" rel="sponsored" data-track="cta">x</a></p>');
  });

  it('@[...] — атрибуты для всех элементов', () => {
    const html = '<p id="a">x</p><ul><li id="b"><p>y</p></li></ul>';
    expect(roundTrip({ extendedValidElements: '@[id]' }, html)).toBe(html);
  });

  it('встроенное значение не дублируется: изменённый title не возвращается к старому', () => {
    const e = mount(
      { extendedValidElements: 'a[href|title|data-x]' },
      '<p><a href="https://a.io" title="Old" data-x="1">x</a></p>',
    );
    const link = e.view.state.schema.marks.link!;
    const { state } = e.view;
    e.view.dispatch(
      state.tr
        .removeMark(0, state.doc.content.size, link)
        .addMark(1, 2, link.create({ href: 'https://a.io', title: null })),
    );
    expect(e.getHTML()).toBe('<p><a href="https://a.io">x</a></p>');
  });

  it('p[class] без validClasses сохраняет классы встроенных элементов', () => {
    const html = '<p class="lead">x</p>';
    expect(roundTrip({ extendedValidElements: 'p[class]' }, html)).toBe(html);
  });
});

describe('validElements: список атрибутов — полный список', () => {
  it('a[href] снимает title и target, href сохраняется всегда', () => {
    const out = roundTrip(
      { validElements: 'p,a[href]' },
      '<p><a href="https://a.io" title="T" target="_blank">x</a></p>',
    );
    expect(out).toBe('<p><a href="https://a.io">x</a></p>');
  });

  it('элемент без [...] сохраняет встроенные атрибуты', () => {
    const html = '<p><a href="https://a.io" title="T">x</a></p>';
    expect(roundTrip({ validElements: 'p,a' }, html)).toBe(html);
  });

  it('img[src|alt]: размеры сняты', () => {
    expect(
      roundTrip(
        { validElements: 'p,img[src|alt]' },
        '<p><img src="/a.png" alt="A" width="40"></p>',
      ),
    ).toBe('<p><img src="/a.png" alt="A"></p>');
  });

  it('extendedValidElements дополняет validElements', () => {
    expect(
      roundTrip(
        { validElements: 'p', extendedValidElements: 'h2[id]' },
        '<h2 id="x">T</h2><h3>U</h3>',
      ),
    ).toBe('<h2 id="x">T</h2><p>U</p>');
  });
});

describe('значения атрибутов', () => {
  it(':v — всегда, =v — по умолчанию, <a?b — только из списка', () => {
    const out = roundTrip(
      { extendedValidElements: 'a[href|target:_blank],ol[start|type<1?a],img[src|alt=]' },
      '<p><a href="https://a.io">x</a><img src="/a.png"></p><ol type="I"><li><p>y</p></li></ol>',
    );
    expect(out).toBe(
      '<p><a href="https://a.io" target="_blank" rel="noopener noreferrer">x</a>' +
        '<img src="/a.png" alt=""></p><ol><li><p>y</p></li></ol>',
    );
  });

  it('!name — без обязательного атрибута элемент не распознаётся, текст остаётся', () => {
    expect(
      roundTrip(
        { extendedValidElements: 'abbr[!title]' },
        '<p><abbr>A</abbr> <abbr title="B">B</abbr></p>',
      ),
    ).toBe('<p>A <abbr title="B">B</abbr></p>');
  });
});

describe('новые элементы', () => {
  it('div с классом: и текстовый блок, и контейнер блоков', () => {
    const html =
      '<div class="note">Short note</div>' +
      '<div class="callout"><p>Title</p><ul><li><p>a</p></li></ul></div>';
    expect(roundTrip({ extendedValidElements: 'div[class]' }, html)).toBe(html);
  });

  it('вложенные блоки и смысловые элементы', () => {
    const html =
      '<section id="s"><h2>T</h2><details><summary>More</summary><p>Hidden</p></details></section>' +
      '<p><abbr title="HyperText Markup Language">HTML</abbr> and <kbd>Ctrl</kbd>+<kbd>K</kbd></p>';
    expect(
      roundTrip({ extendedValidElements: 'section[id],details,summary,abbr[title],kbd' }, html),
    ).toBe(html);
  });

  it('иконки: пустой <i class> сохраняется, обычный <i> — по-прежнему курсив', () => {
    const out = roundTrip(
      { extendedValidElements: 'i[class]' },
      '<p>Rate <i class="fa fa-star"></i> <i>now</i> <i class="hl">this</i></p>',
    );
    expect(out).toBe('<p>Rate <i class="fa fa-star"></i> <em>now</em> <i class="hl">this</i></p>');
  });

  it('span с data-атрибутом — отдельно от цвета', () => {
    const out = roundTrip(
      { extendedValidElements: 'span[data-id]' },
      '<p><span data-id="7">a</span><span data-id="8" style="color: #ff0000;">b</span></p>',
    );
    expect(out).toContain('<span data-id="7">a</span>');
    expect(out).toContain('data-id="8"');
    expect(out).toContain('color: #ff0000;');
  });

  it('свои элементы: блочный и строчный (~)', () => {
    const html = '<my-widget data-id="42"></my-widget><p>Hi <my-chip user="ann">Ann</my-chip>!</p>';
    expect(roundTrip({ customElements: 'my-widget,~my-chip' }, html)).toBe(html);
  });

  it('в новый текстовый блок можно печатать, Enter делит его', () => {
    const e = mount({ extendedValidElements: 'div[class]' }, '<div class="note">ab</div>');
    const { state } = e.view;
    e.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 2)));
    e.view.dispatch(e.view.state.tr.insertText('X'));
    expect(e.getHTML()).toBe('<div class="note">aXb</div>');
  });

  it('Markdown: новые элементы дают свой текст', () => {
    const e = mount(
      { extendedValidElements: 'div[class],abbr[title],i[class]' },
      '<div class="c"><p>One <abbr title="t">two</abbr><i class="fa"></i></p></div><div>Three</div>',
    );
    expect(toMarkdown(e)).toBe('One two\n\nThree');
  });
});

describe('style не удваивается (найдено property-based тестом)', () => {
  it('цветной span при span[*] остаётся одним span', () => {
    const out = roundTrip({ extendedValidElements: 'span[*]' }, '<p style="color: red">!</p>');
    expect(out).toBe('<p><span style="color: red;">!</span></p>');
  });

  it('style нового элемента остаётся на нём, а не становится марками содержимого', () => {
    const html =
      '<div style="color: red;">a</div><p><abbr title="t" style="color: blue;">b</abbr></p>';
    expect(roundTrip({ extendedValidElements: 'div[style],abbr[style|title]' }, html)).toBe(html);
  });
});

describe('несколько редакторов на странице', () => {
  // Регрессия: кэш отрисовки марок был общим по имени марки — второй редактор получал ссылку,
  // отрисованную по правилам первого.
  it('одинаковая ссылка выводится по правилам своего редактора', () => {
    const html = '<p><a href="https://a.io">x</a></p>';
    const plain = mount({}, html);
    expect(plain.getHTML()).toBe(html);
    const element = document.createElement('div');
    document.body.append(element);
    const forced = createEditor({
      element,
      content: html,
      extendedValidElements: 'a[href|target:_blank]',
    });
    expect(forced.getHTML()).toContain('target="_blank"');
    expect(plain.getHTML()).toBe(html);
    forced.destroy();
  });
});

describe('безопасность не отключается правилами', () => {
  it('script, iframe, формы не разрешаются; предупреждение в консоли', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = roundTrip(
      { extendedValidElements: 'script[src],iframe[src],form[action],div[*]' },
      '<script src="https://evil.io/x.js"></script><form action="/x"><div>in</div></form>',
    );
    expect(out).toBe('<div>in</div>');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<script>'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('media plugin'));
  });

  it('div[*]: обработчики, srcdoc, contenteditable, опасные адреса и CSS — не сохраняются', () => {
    const out = roundTrip(
      { extendedValidElements: 'div[*],a[*],abbr[*]' },
      '<div onclick="alert(1)" contenteditable="true" data-ok="1" style="background:url(javascript:x)">t</div>' +
        '<p><abbr cite="javascript:alert(1)" title="ok">a</abbr><a href="javascript:alert(1)">b</a></p>',
    );
    expect(out).toBe('<div data-ok="1">t</div><p><abbr title="ok">a</abbr>b</p>');
  });

  it('JSON в обход разбора: чужой тег, обработчики и мусор в атрибутах не выводятся', () => {
    const e = mount({ extendedValidElements: 'div[data-*],abbr[title]' });
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'html_textblock',
          attrs: { tag: 'script', htmlAttrs: { onclick: 'x', 'data-a': 5, 'data-b': {}, bad: 1 } },
          content: [{ type: 'text', text: 'x' }],
        },
        { type: 'html_textblock', attrs: { tag: 7, htmlAttrs: 'junk' } },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'y',
              marks: [{ type: 'html_inline', attrs: { tag: 'img', htmlAttrs: null } }],
            },
          ],
        },
      ],
    });
    expect(e.getHTML()).toBe('<div data-a="5">x</div><div></div><p><abbr>y</abbr></p>');
  });
});
