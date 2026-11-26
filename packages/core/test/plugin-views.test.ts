import { Plugin, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { keepPluginViews, reconfigurePlugins } from '../src/plugin-views';

/**
 * Регрессия: догрузка ленивых частей (механика таблиц, плагины по имени) перестраивает набор
 * плагинов, и ProseMirror пересоздавал представления всех плагинов — открытое слэш-меню
 * закрывалось посреди ввода (тест «после пробела срабатывает» падал в зависимости от времени).
 */

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function mount(): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content: '<p></p>' });
  editor.focus();
  return editor;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('представления плагинов при перестройке набора', () => {
  it('открытый список слэш-команд остаётся открытым', async () => {
    const e = mount();
    await e.ready;
    const { state } = e.view;
    e.view.dispatch(state.tr.setSelection(TextSelection.atEnd(state.doc)).insertText('/hea'));
    await flush();
    const list = e.root.querySelector<HTMLElement>('.nova-ac')!;
    expect(list.hidden).toBe(false);
    reconfigurePlugins(e.view, [...e.view.state.plugins, new Plugin({})]);
    expect(e.root.querySelector('.nova-ac')).toBe(list);
    expect(list.hidden).toBe(false);
  });

  it('представление создаётся один раз, обновляется, уничтожается при удалении плагина и закрытии', async () => {
    const e = mount();
    await e.ready;
    const create = vi.fn();
    const update = vi.fn();
    const destroy = vi.fn();
    const make = () =>
      new Plugin({
        view: () => {
          create();
          return { update, destroy };
        },
      });
    const a = make();
    const b = make();
    reconfigurePlugins(e.view, [...e.view.state.plugins, a, b]);
    expect(create).toHaveBeenCalledTimes(2);
    reconfigurePlugins(e.view, [...e.view.state.plugins, new Plugin({})]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(destroy).not.toHaveBeenCalled();
    e.view.dispatch(e.view.state.tr.insertText('x'));
    expect(update).toHaveBeenCalledTimes(2);
    reconfigurePlugins(
      e.view,
      e.view.state.plugins.filter((p) => p !== b),
    );
    expect(destroy).toHaveBeenCalledTimes(1);
    e.destroy();
    editor = null;
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('keepPluginViews идемпотентен: повторная подготовка не оборачивает дважды', () => {
    const view = vi.fn(() => ({}));
    const plugin = new Plugin({ view });
    keepPluginViews([plugin]);
    const once = plugin.spec.view;
    keepPluginViews([plugin]);
    expect(plugin.spec.view).toBe(once);
  });
});
