import type { Command } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, setStyle, type Editor } from '../src';

/** Цепочки команд: одна правка, «всё или ничего», честная проверка can(). */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(content = '<p>text</p>'): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content });
  return editor;
}

function selectAll(e: Editor): void {
  const { doc } = e.view.state;
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
}

/** Шаг, который проходит только в заголовке: видит ли он результат предыдущих шагов. */
const inHeading: Command = (state) => state.selection.$from.parent.type.name === 'heading';

describe('editor.chain()', () => {
  it('шаги — одной правкой: одно событие change, одна отмена', () => {
    const e = mount();
    const changes = vi.fn();
    e.on('change', changes);
    expect(e.chain().exec('h2').exec('alignCenter').run()).toBe(true);
    expect(e.getHTML()).toBe('<h2 style="text-align: center;">text</h2>');
    expect(changes).toHaveBeenCalledTimes(1);
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>text</p>');
  });

  it('каждый шаг видит результат предыдущих; команды с параметрами', () => {
    const e = mount();
    selectAll(e);
    const ok = e.chain().exec(setStyle('color', '#ff0000')).exec('bold').exec('h3').run();
    expect(ok).toBe(true);
    expect(e.getHTML()).toBe('<h3><strong><span style="color: #ff0000;">text</span></strong></h3>');
    expect(e.chain().exec('h2').exec(inHeading).run()).toBe(true);
  });

  it('insertContent — шаг цепочки: следующие шаги применяются к вставленному', () => {
    const e = mount('<p>a</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    expect(e.chain().insertContent('<p>new</p>').exec('h3').run()).toBe(true);
    expect(e.getHTML()).toBe('<p>a</p><h3>new</h3>');
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>a</p>');
  });

  it('всё или ничего: шаг не удался — документ и история не меняются', () => {
    const e = mount();
    const changes = vi.fn();
    e.on('change', changes);
    expect(
      e
        .chain()
        .exec('h2')
        .exec(() => false)
        .exec('alignCenter')
        .run(),
    ).toBe(false);
    expect(e.getHTML()).toBe('<p>text</p>');
    expect(changes).not.toHaveBeenCalled();
    expect(e.can('undo')).toBe(false);
  });

  it('can() проверяет цепочку по шагам и ничего не меняет', () => {
    const e = mount();
    expect(e.chain().exec(inHeading).can()).toBe(false);
    expect(e.chain().exec('h2').exec(inHeading).can()).toBe(true);
    expect(e.getHTML()).toBe('<p>text</p>');
    expect(e.can('undo')).toBe(false);
    // Одну и ту же цепочку можно проверить и выполнить.
    const chain = e.chain().exec('h2').exec(inHeading);
    expect(chain.can()).toBe(true);
    expect(chain.run()).toBe(true);
    expect(e.getHTML()).toBe('<h2>text</h2>');
  });

  it('отмена и повтор — не шаги цепочки; своя транзакция в шаге — отказ', () => {
    const e = mount();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    e.exec('bold');
    expect(
      e
        .chain()
        .exec('undo' as never)
        .run(),
    ).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"undo" runs on its own'));
    const foreign: Command = (_state, dispatch, view) => {
      dispatch?.(view!.state.tr.insertText('x', 1));
      return true;
    };
    expect(e.chain().exec('h2').exec(foreign).run()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('own transaction'));
    expect(e.getHTML()).toBe('<p>text</p>');
  });

  it('только чтение: insertContent в цепочке не проходит; после destroy — false', () => {
    const e = mount();
    e.setEditable(false);
    expect(e.chain().insertContent('<p>x</p>').run()).toBe(false);
    expect(e.getHTML()).toBe('<p>text</p>');
    e.setEditable(true);
    const chain = e.chain().exec('h2');
    e.destroy();
    editor = null;
    expect(chain.run()).toBe(false);
    expect(chain.can()).toBe(false);
  });
});

describe('неизвестная команда (вызов из JavaScript без типов, из CDN)', () => {
  it('exec, can и шаг цепочки — false и одно предупреждение, а не исключение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount();
    const before = e.getHTML();
    expect(e.exec('selectAll' as never)).toBe(false);
    expect(e.exec('selectAll' as never)).toBe(false);
    expect(e.can('toString' as never)).toBe(false);
    expect(
      e
        .chain()
        .exec('bold')
        .exec('nope' as never)
        .run(),
    ).toBe(false);
    expect(e.getHTML()).toBe(before);
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((m) => m.includes('"selectAll"'))).toHaveLength(1);
    expect(messages.some((m) => m.includes('"toString"'))).toBe(true);
  });
});
