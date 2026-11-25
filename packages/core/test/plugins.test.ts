import { Plugin as PMPlugin } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditor,
  definePlugin,
  isPluginRegistered,
  registerPlugin,
  type Editor,
  type EditorOptions,
} from '../src';
import { orderPlugins } from '../src/plugins';

let editor: Editor | null = null;
let errorSpy: ReturnType<typeof vi.spyOn> | null = null;

function mount(options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content: '<p>a</p>', ...options });
  return editor;
}

const button = (name: string) =>
  editor!.root.querySelector<HTMLButtonElement>(`[data-control="${name}"]`);

afterEach(() => {
  editor?.destroy();
  editor = null;
  errorSpy?.mockRestore();
  errorSpy = null;
  document.body.innerHTML = '';
});

function silenceErrors() {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return errorSpy;
}

describe('orderPlugins', () => {
  const p = (name: string, requires: string[] = []) => definePlugin({ name, requires });

  it('сортирует по зависимостям', () => {
    const { ordered, errors } = orderPlugins([p('c', ['b']), p('b', ['a']), p('a')]);
    expect(ordered.map((x) => x.name)).toEqual(['a', 'b', 'c']);
    expect(errors).toEqual([]);
  });

  it('отсутствующая зависимость исключает только этот плагин', () => {
    const { ordered, errors } = orderPlugins([p('a'), p('b', ['missing']), p('c', ['b'])]);
    expect(ordered.map((x) => x.name)).toEqual(['a']);
    expect(errors[0]).toContain('"b" requires "missing"');
  });

  it('цикл обнаруживается', () => {
    const { ordered, errors } = orderPlugins([p('a', ['b']), p('b', ['a']), p('ok')]);
    expect(ordered.map((x) => x.name)).toEqual(['ok']);
    expect(errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  it('зависимость от уже подключённого плагина', () => {
    const { ordered } = orderPlugins([p('b', ['a'])], new Set(['a']));
    expect(ordered.map((x) => x.name)).toEqual(['b']);
  });
});

describe('плагины в редакторе', () => {
  it('синхронный плагин: кнопка, ProseMirror-плагин, очистка при destroy', () => {
    const cleanup = vi.fn();
    const seen: string[] = [];
    const plugin = definePlugin({
      name: 'hello',
      setup(e) {
        e.ui.registry.addButton('hello', { text: 'Hi', tooltip: 'Hello', onAction: () => {} });
        return cleanup;
      },
      prosemirrorPlugins: () => [
        new PMPlugin({
          view: () => ({ update: (view) => void seen.push(view.state.doc.textContent) }),
        }),
      ],
    });
    const e = mount({ plugins: [plugin], toolbar: 'bold hello' });
    expect(e.hasPlugin('hello')).toBe(true);
    expect(button('hello')).not.toBeNull();
    e.setContent('<p>b</p>');
    expect(seen).toContain('b');
    e.destroy();
    editor = null;
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('ошибка в setup изолирована: редактор работает, остальные плагины подключены', () => {
    const spy = silenceErrors();
    const broken = definePlugin({
      name: 'broken',
      setup() {
        throw new Error('boom');
      },
    });
    const good = definePlugin({ name: 'good', setup: () => {} });
    const e = mount({ plugins: [broken, good] });
    expect(e.hasPlugin('broken')).toBe(false);
    expect(e.hasPlugin('good')).toBe(true);
    e.setContent('<p>still works</p>');
    expect(e.getHTML()).toBe('<p>still works</p>');
    expect(spy.mock.calls[0]![0]).toContain('"broken" failed during setup');
  });

  it('незарегистрированное имя — ошибка в консоли, редактор создаётся', () => {
    const spy = silenceErrors();
    const e = mount({ plugins: ['no-such-plugin'] });
    expect(e.getHTML()).toBe('<p>a</p>');
    expect(spy.mock.calls[0]![0]).toContain('"no-such-plugin" is not registered');
  });

  it('ленивый плагин: кнопка появляется в тулбаре после editor.ready', async () => {
    const lazy = () =>
      Promise.resolve({
        default: definePlugin({
          name: 'lazy',
          setup: (e) =>
            e.ui.registry.addButton('lazybtn', { text: 'L', tooltip: 'Lazy', onAction: () => {} }),
        }),
      });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount({ plugins: [lazy], toolbar: 'bold lazybtn' });
    expect(button('lazybtn')).toBeNull();
    expect(warn).not.toHaveBeenCalled(); // пока плагин грузится, неизвестная кнопка — не ошибка
    await e.ready;
    expect(e.hasPlugin('lazy')).toBe(true);
    expect(button('lazybtn')).not.toBeNull();
    // После перестройки тулбара обработчики не задвоились: в тулбаре одна кнопка с tabindex=0.
    expect(e.root.querySelectorAll('.nova-toolbar button[tabindex="0"]')).toHaveLength(1);
    warn.mockRestore();
  });

  it('ленивый плагин, который не загрузился, не ломает ready', async () => {
    silenceErrors();
    const e = mount({ plugins: [() => Promise.reject(new Error('network'))] });
    await expect(e.ready).resolves.toBeUndefined();
  });

  it('регистрация по имени (как PluginManager.add)', () => {
    registerPlugin('test-named', definePlugin({ name: 'test-named', setup: () => {} }));
    expect(isPluginRegistered('test-named')).toBe(true);
    expect(mount({ plugins: ['test-named'] }).hasPlugin('test-named')).toBe(true);
  });
});

describe('кнопки плагинов в тулбаре по умолчанию', () => {
  it('добавляются, если toolbar не задан, и не трогают явный конфиг', async () => {
    const plugin = definePlugin({
      name: 'extra',
      toolbar: 'extrabtn',
      setup: (e) =>
        e.ui.registry.addButton('extrabtn', { text: 'X', tooltip: 'Extra', onAction: () => {} }),
    });
    mount({ plugins: [plugin] });
    expect(button('extrabtn')).not.toBeNull();
    editor!.destroy();
    mount({ plugins: [plugin], toolbar: 'bold' });
    expect(button('extrabtn')).toBeNull();
  });
});

describe('встроенный плагин insertdatetime', () => {
  it('зарегистрирован, грузится лениво и вставляет дату', async () => {
    expect(isPluginRegistered('insertdatetime')).toBe(true);
    const e = mount({
      language: 'en',
      plugins: ['insertdatetime'],
      toolbar: 'insertdatetime',
      pluginOptions: { insertdatetime: { now: () => new Date(2026, 10, 24, 9, 30) } },
    });
    await e.ready;
    button('insertdatetime')!.click();
    const item = e.root.querySelector<HTMLButtonElement>('.nova-menu [data-id="long"]')!;
    expect(item.textContent).toContain('November 24, 2026');
    item.click();
    expect(e.getText()).toContain('November 24, 2026');
  });
});

describe('плагины: переопределение команд и своя история', () => {
  it('commands переопределяют undo для exec, кнопок и Mod-z; replaceHistory отключает встроенную историю', () => {
    const calls: string[] = [];
    const custom = definePlugin({
      name: 'custom-history',
      replaceHistory: true,
      commands: {
        undo: (_state, dispatch) => {
          if (dispatch) calls.push('undo');
          return true;
        },
      },
    });
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({ element, content: '<p>a</p>', plugins: [custom] });
    // Встроенной истории нет: redo (не переопределён) недоступен.
    editor.view.dispatch(editor.view.state.tr.insertText('b'));
    expect(editor.can('redo')).toBe(false);
    expect(editor.exec('undo')).toBe(true);
    editor.view.someProp('handleKeyDown', (f) =>
      f(editor.view, new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })),
    );
    expect(calls).toEqual(['undo', 'undo']);
    editor.destroy();
  });
});

describe('плагин, меняющий документ при инициализации', () => {
  it('транзакция внутри конструктора EditorView не ломает редактор (регрессия: this.view ещё не задан)', () => {
    const init = definePlugin({
      name: 'init-dispatch',
      prosemirrorPlugins: () => [
        new PMPlugin({
          view(view) {
            view.dispatch(view.state.tr.insertText('ready '));
            return {};
          },
        }),
      ],
    });
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({
      element,
      content: '<p>text</p>',
      plugins: [init],
      onChange: () => {},
    });
    expect(editor.getHTML()).toBe('<p>ready text</p>');
    editor.destroy();
  });

  it('транзакция по таймеру плагина после destroy() игнорируется (регрессия: падение в updateState)', () => {
    let late: (() => void) | undefined;
    const timer = definePlugin({
      name: 'late-dispatch',
      prosemirrorPlugins: () => [
        new PMPlugin({
          view(view) {
            late = () => view.dispatch(view.state.tr.insertText('late'));
            return {};
          },
        }),
      ],
    });
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({ element, plugins: [timer] });
    editor.destroy();
    expect(() => late!()).not.toThrow();
  });
});
