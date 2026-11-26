import { Plugin, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { keepPluginViews, reconfigurePlugins } from '../src/plugin-views';

/**
 * A regression: loading lazy parts (table mechanics, plugins by name) rebuilds the plugin set,
 * and ProseMirror recreated the views of all plugins: an open slash menu
 * closed in the middle of typing (the "fires after a space" test failed depending on timing).
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

describe('plugin views when the set is rebuilt', () => {
  it('an open list of slash commands stays open', async () => {
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

  it('a view is created once, updated, destroyed when the plugin is removed and on close', async () => {
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

  it("keepPluginViews is idempotent: preparing again doesn't wrap twice", () => {
    const view = vi.fn(() => ({}));
    const plugin = new Plugin({ view });
    keepPluginViews([plugin]);
    const once = plugin.spec.view;
    keepPluginViews([plugin]);
    expect(plugin.spec.view).toBe(once);
  });
});
