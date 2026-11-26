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

  it('sorts by dependencies', () => {
    const { ordered, errors } = orderPlugins([p('c', ['b']), p('b', ['a']), p('a')]);
    expect(ordered.map((x) => x.name)).toEqual(['a', 'b', 'c']);
    expect(errors).toEqual([]);
  });

  it('a missing dependency excludes only that plugin', () => {
    const { ordered, errors } = orderPlugins([p('a'), p('b', ['missing']), p('c', ['b'])]);
    expect(ordered.map((x) => x.name)).toEqual(['a']);
    expect(errors[0]).toContain('"b" requires "missing"');
  });

  it('a cycle is detected', () => {
    const { ordered, errors } = orderPlugins([p('a', ['b']), p('b', ['a']), p('ok')]);
    expect(ordered.map((x) => x.name)).toEqual(['ok']);
    expect(errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  it('a dependency on an already attached plugin', () => {
    const { ordered } = orderPlugins([p('b', ['a'])], new Set(['a']));
    expect(ordered.map((x) => x.name)).toEqual(['b']);
  });
});

describe('plugins in the editor', () => {
  it('a synchronous plugin: a button, a ProseMirror plugin, cleanup on destroy', () => {
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

  it('an error in setup is isolated: the editor works, the other plugins are attached', () => {
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

  it('an unregistered name: an error in the console, the editor is created', () => {
    const spy = silenceErrors();
    const e = mount({ plugins: ['no-such-plugin'] });
    expect(e.getHTML()).toBe('<p>a</p>');
    expect(spy.mock.calls[0]![0]).toContain('"no-such-plugin" is not registered');
  });

  it('a lazy plugin: its button appears in the toolbar after editor.ready', async () => {
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
    expect(warn).not.toHaveBeenCalled(); // while the plugin loads, an unknown button isn't an error
    await e.ready;
    expect(e.hasPlugin('lazy')).toBe(true);
    expect(button('lazybtn')).not.toBeNull();
    // After the toolbar is rebuilt the handlers aren't doubled: one toolbar button has tabindex=0.
    expect(e.root.querySelectorAll('.nova-toolbar button[tabindex="0"]')).toHaveLength(1);
    warn.mockRestore();
  });

  it("a lazy plugin that failed to load doesn't break ready", async () => {
    silenceErrors();
    const e = mount({ plugins: [() => Promise.reject(new Error('network'))] });
    await expect(e.ready).resolves.toBeUndefined();
  });

  it('registration by name (like PluginManager.add)', () => {
    registerPlugin('test-named', definePlugin({ name: 'test-named', setup: () => {} }));
    expect(isPluginRegistered('test-named')).toBe(true);
    expect(mount({ plugins: ['test-named'] }).hasPlugin('test-named')).toBe(true);
  });
});

describe('plugin buttons in the default toolbar', () => {
  it("are added when toolbar isn't set, and don't touch an explicit config", async () => {
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

describe('the built-in insertdatetime plugin', () => {
  it('is registered, loads lazily and inserts the date', async () => {
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

describe('plugins: overriding commands and a custom history', () => {
  it('commands override undo for exec, buttons and Mod-z; replaceHistory turns the built-in history off', () => {
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
    // There is no built-in history: redo (not overridden) is unavailable.
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

describe('a plugin that changes the document on init', () => {
  it("a transaction inside the EditorView constructor doesn't break the editor (regression: this.view not set yet)", () => {
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

  it('a transaction from a plugin timer after destroy() is ignored (regression: a crash in updateState)', () => {
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
