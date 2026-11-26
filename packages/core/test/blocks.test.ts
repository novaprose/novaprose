import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { duplicateBlock } from '../src/blocks';
import { moveBlockTo } from '../src/plugins/draghandle';

/**
 * Перемещение блоков: Alt+Shift+↑/↓ (команды moveBlockUp / moveBlockDown) и копия блока.
 * Единица — пункт списка или блок верхнего уровня; выделение через несколько блоков двигает их вместе.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function mount(content: string, options: Partial<EditorOptions> = {}): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, ...options });
  editor.focus();
  return editor;
}

/** Позиция сразу после текста `text`. */
function posAfter(e: Editor, text: string): number {
  let pos = -1;
  e.view.state.doc.descendants((node, at) => {
    if (pos < 0 && node.isText && node.text!.includes(text)) {
      pos = at + node.text!.indexOf(text) + text.length;
    }
  });
  if (pos < 0) throw new Error(`нет текста ${text}`);
  return pos;
}

function cursorAfter(e: Editor, text: string): void {
  e.view.dispatch(
    e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, posAfter(e, text))),
  );
}

function press(e: Editor, key: 'ArrowUp' | 'ArrowDown'): void {
  e.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key, altKey: true, shiftKey: true, bubbles: true }),
  );
}

describe('Alt+Shift+↑/↓ — блок выше или ниже', () => {
  it('абзац меняется местами с соседом, курсор остаётся в нём', () => {
    const e = mount('<p>one</p><p>two</p><p>three</p>');
    cursorAfter(e, 'tw');
    press(e, 'ArrowUp');
    expect(e.getHTML()).toBe('<p>two</p><p>one</p><p>three</p>');
    e.view.dispatch(e.view.state.tr.insertText('!'));
    expect(e.getHTML()).toBe('<p>tw!o</p><p>one</p><p>three</p>');
    press(e, 'ArrowDown');
    press(e, 'ArrowDown');
    expect(e.getHTML()).toBe('<p>one</p><p>three</p><p>tw!o</p>');
  });

  it('первый блок вверх и последний вниз — ничего не происходит', () => {
    const e = mount('<p>one</p><p>two</p>');
    cursorAfter(e, 'one');
    expect(e.exec('moveBlockUp')).toBe(false);
    cursorAfter(e, 'two');
    expect(e.can('moveBlockDown')).toBe(false);
    expect(e.getHTML()).toBe('<p>one</p><p>two</p>');
  });

  it('одна отмена возвращает порядок', () => {
    const e = mount('<h2>Title</h2><p>text</p>');
    cursorAfter(e, 'text');
    e.exec('moveBlockUp');
    expect(e.getHTML()).toBe('<p>text</p><h2>Title</h2>');
    e.exec('undo');
    expect(e.getHTML()).toBe('<h2>Title</h2><p>text</p>');
  });

  it('пункт списка — среди своих пунктов, вложенный — среди вложенных', () => {
    const e = mount(
      '<ul><li><p>a</p></li><li><p>b</p><ul><li><p>b1</p></li><li><p>b2</p></li></ul></li></ul>',
    );
    cursorAfter(e, 'b2');
    e.exec('moveBlockUp');
    expect(e.getHTML()).toBe(
      '<ul><li><p>a</p></li><li><p>b</p><ul><li><p>b2</p></li><li><p>b1</p></li></ul></li></ul>',
    );
    // Первый во вложенном списке — выше некуда (из списка не выносим).
    expect(e.exec('moveBlockUp')).toBe(false);
    cursorAfter(e, 'a');
    e.exec('moveBlockDown');
    expect(e.getHTML()).toBe(
      '<ul><li><p>b</p><ul><li><p>b2</p></li><li><p>b1</p></li></ul></li><li><p>a</p></li></ul>',
    );
  });

  it('выделение через несколько абзацев двигает их вместе', () => {
    const e = mount('<p>one</p><p>two</p><p>three</p><p>four</p>');
    const { doc } = e.view.state;
    e.view.dispatch(
      e.view.state.tr.setSelection(TextSelection.create(doc, posAfter(e, 't'), posAfter(e, 'thr'))),
    );
    e.exec('moveBlockDown');
    expect(e.getHTML()).toBe('<p>one</p><p>four</p><p>two</p><p>three</p>');
    // Выделение переехало вместе с абзацами.
    const { from, to } = e.view.state.selection;
    expect(e.view.state.doc.textBetween(from, to, '|')).toBe('wo|thr');
  });

  it('в ячейке таблицы — нет (строки не блоки); список в ячейке — да', () => {
    const e = mount(
      '<p>before</p><table><tbody><tr><td><p>cell</p><ul><li><p>x</p></li><li><p>y</p></li></ul></td></tr></tbody></table>',
    );
    cursorAfter(e, 'cell');
    expect(e.exec('moveBlockUp')).toBe(false);
    cursorAfter(e, 'y');
    expect(e.exec('moveBlockUp')).toBe(true);
    expect(e.getHTML()).toContain('<ul><li><p>y</p></li><li><p>x</p></li></ul>');
  });

  it('выделенная таблица или картинка двигается целиком', () => {
    const e = mount(
      '<p>top</p><table><tbody><tr><td><p>cell</p></td></tr></tbody></table><p>bottom</p>',
    );
    let tablePos = -1;
    e.view.state.doc.forEach((node, offset) => {
      if (node.type.name === 'table') tablePos = offset;
    });
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, tablePos)));
    e.exec('moveBlockDown');
    expect(e.getHTML()).toMatch(/^<p>top<\/p><p>bottom<\/p><table/);
    expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
  });

  it('копия блока — сразу под ним и выделена; таблица из ячейки — только выделенная', () => {
    const e = mount('<p>one</p><p>two</p>');
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, 0)));
    expect(e.exec(duplicateBlock)).toBe(true);
    expect(e.getHTML()).toBe('<p>one</p><p>one</p><p>two</p>');
    expect((e.view.state.selection as NodeSelection).from).toBe(5);
    e.setContent('<table><tbody><tr><td><p>cell</p></td></tr></tbody></table>');
    cursorAfter(e, 'cell');
    expect(e.can(duplicateBlock)).toBe(false);
  });

  it('справка по клавишам показывает сочетания стрелками', () => {
    const e = mount('<p>a</p>');
    e.exec('undo');
    // Подписи команд переводятся (ключи ядра), сочетание — со стрелками, не «ArrowUp».
    expect(e.ui.t('moveBlockUp')).toBe('Move block up');
    return import('../src/ui/dom').then(({ formatShortcut }) => {
      expect(formatShortcut('Alt-Shift-ArrowUp')).toMatch(/↑$/);
    });
  });
});

describe('сброс блока ручкой (moveBlockTo)', () => {
  /** Узел, содержащий текст `text` (самый внутренний пункт списка или блок верхнего уровня). */
  function source(e: Editor, text: string) {
    const $pos = e.view.state.doc.resolve(posAfter(e, text));
    for (let depth = $pos.depth; depth > 0; depth--) {
      const node = $pos.node(depth);
      if (node.type.name === 'list_item' || depth === 1) {
        return {
          node,
          pos: $pos.before(depth),
          list: node.type.name === 'list_item' ? $pos.node(depth - 1) : null,
        };
      }
    }
    throw new Error(text);
  }
  /** Позиция перед блоком верхнего уровня с номером index. */
  const before = (e: Editor, index: number) => {
    let pos = 0;
    for (let i = 0; i < index; i++) pos += e.view.state.doc.child(i).nodeSize;
    return pos;
  };
  const drop = (e: Editor, text: string, target: number, copy = false) => {
    const tr = moveBlockTo(e.view.state, source(e, text), target, copy);
    if (tr) e.view.dispatch(tr);
    return tr;
  };

  it('абзац — между блоками; на своё место — без изменений', () => {
    const e = mount('<p>one</p><p>two</p><p>three</p>');
    drop(e, 'one', before(e, 3));
    expect(e.getHTML()).toBe('<p>two</p><p>three</p><p>one</p>');
    expect(drop(e, 'three', before(e, 1))).toBeNull();
    expect(drop(e, 'three', before(e, 2))).toBeNull();
    // Перенесённый блок выделен.
    expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
  });

  it('копия (с Ctrl) оставляет исходный блок', () => {
    const e = mount('<p>one</p><p>two</p>');
    drop(e, 'one', before(e, 2), true);
    expect(e.getHTML()).toBe('<p>one</p><p>two</p><p>one</p>');
  });

  it('пункт чек-листа вне списка — снова чек-лист; рядом с таким же списком — в него', () => {
    const tasks =
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li>' +
      '<li data-type="taskItem" data-checked="false"><p>todo</p></li></ul>';
    const done = '<li data-type="taskItem" data-checked="true"><p>done</p></li>';
    const todo = '<li data-type="taskItem" data-checked="false"><p>todo</p></li>';
    const e = mount(`${tasks}<p>after</p><p>end</p>`);
    // Между абзацами «after» и «end».
    drop(e, 'done', before(e, 2));
    expect(e.getHTML()).toBe(
      `<ul data-type="taskList">${todo}</ul><p>after</p><ul data-type="taskList">${done}</ul><p>end</p>`,
    );
    // Сразу после первого чек-листа — пункт уходит в его конец, а не в новый список;
    // опустевший список исчезает.
    drop(e, 'done', before(e, 1));
    expect(e.getHTML()).toBe(`<ul data-type="taskList">${todo}${done}</ul><p>after</p><p>end</p>`);
  });

  it('последний пункт уносится — пустой список исчезает; абзац между пунктами — новый пункт', () => {
    const e = mount('<ol><li><p>only</p></li></ol><p>text</p>');
    drop(e, 'only', before(e, 2));
    expect(e.getHTML()).toBe('<p>text</p><ol><li><p>only</p></li></ol>');
    const listItemEnd = posAfter(e, 'only') + 2; // после </p></li> — внутри списка
    drop(e, 'text', listItemEnd);
    expect(e.getHTML()).toBe('<ol><li><p>only</p></li><li><p>text</p></li></ol>');
  });
});

describe('плагин draghandle', () => {
  it('подключается лениво: место под ручку и скрытая ручка в области текста', async () => {
    const e = mount('<p>one</p>', { plugins: ['draghandle'] });
    await e.ready;
    expect(e.root.classList.contains('nova-has-draghandle')).toBe(true);
    const handle = e.root.querySelector<HTMLElement>('.nova-content > .nova-drag-handle')!;
    expect(handle.hidden).toBe(true);
    expect(handle.getAttribute('draggable')).toBe('true');
    expect(handle.getAttribute('aria-hidden')).toBe('true');
    e.destroy();
    expect(document.querySelector('.nova-drag-handle')).toBeNull();
    editor = null;
  });
});
