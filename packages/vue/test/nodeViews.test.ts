import { createEditor, definePlugin, type Editor } from '@novaprose/core';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, inject, nextTick, provide } from 'vue';
import {
  NodeViewContent,
  NovaProseEditor,
  nodeViewProps,
  useEditor,
  useNodeView,
  vueNodeView,
} from '../src';

/** Виды узлов на Vue: Teleport внутри приложения (provide/inject работают), правка атрибутов. */

const mounted: Array<{ unmount(): void }> = [];
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const THEME = Symbol('theme');

const ToneLabel = defineComponent({
  setup() {
    const view = useNodeView();
    return () => h('b', { class: 'tone' }, String(view.value.node.attrs.tone));
  },
});

const Callout = defineComponent({
  props: nodeViewProps,
  setup(props) {
    const theme = inject(THEME, 'no theme');
    return () =>
      h('div', { class: 'callout', 'data-theme': theme, 'data-selected': String(props.selected) }, [
        h(
          'select',
          {
            value: String(props.node.attrs.tone),
            onChange: (event: Event) =>
              props.updateAttributes({ tone: (event.target as HTMLSelectElement).value }),
          },
          ['info', 'warning'].map((tone) => h('option', { value: tone }, tone)),
        ),
        h(ToneLabel),
        h(NodeViewContent, { class: 'callout-body' }),
      ]);
  },
});

const callout = definePlugin({
  name: 'callout',
  nodes: {
    callout: {
      group: 'block',
      content: 'paragraph+',
      attrs: { tone: { default: 'info' } },
      parseDOM: [
        {
          tag: 'div[data-callout]',
          getAttrs: (dom) => ({ tone: (dom as HTMLElement).dataset.tone ?? 'info' }),
        },
      ],
      toDOM: (node) => ['div', { 'data-callout': '', 'data-tone': String(node.attrs.tone) }, 0],
    },
  },
  nodeViews: { callout: vueNodeView(Callout) },
});

const CONTENT = '<div data-callout="" data-tone="info"><p>Hello</p></div>';

/** Обёртка с provide — проверить, что вид видит контекст приложения. */
function themed(theme: string, child: () => ReturnType<typeof h>) {
  return defineComponent({
    setup() {
      provide(THEME, theme);
      return child;
    },
  });
}

async function settle(): Promise<void> {
  await nextTick();
  await nextTick();
}

describe('vueNodeView', () => {
  it('в <NovaProseEditor>: provide/inject приложения, содержимое на своём месте, правка с отменой', async () => {
    let editor: Editor | null = null;
    const App = themed('dark', () =>
      h(NovaProseEditor, {
        plugins: [callout],
        defaultValue: CONTENT,
        onReady: (e: Editor) => (editor = e),
      }),
    );
    const wrapper = mount(App, { attachTo: document.body });
    mounted.push(wrapper);
    await settle();
    const view = document.querySelector('[data-node-view="callout"] .callout')!;
    expect(view.getAttribute('data-theme')).toBe('dark');
    expect(view.querySelector('.tone')!.textContent).toBe('info');
    expect(view.querySelector('.callout-body[data-node-view-content] p')!.textContent).toBe(
      'Hello',
    );
    // Необъявленные свойства не уходят атрибутами в корень компонента.
    expect(view.hasAttribute('node')).toBe(false);

    const select = view.querySelector('select')!;
    select.value = 'warning';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(editor!.getHTML()).toBe('<div data-callout="" data-tone="warning"><p>Hello</p></div>');
    expect(document.querySelector('.tone')!.textContent).toBe('warning');
    editor!.exec('undo');
    await settle();
    expect(document.querySelector('.tone')!.textContent).toBe('info');
  });

  it('useEditor: <component :is="nodeViews" />; без него — предупреждение', async () => {
    const Host = (withViews: boolean) =>
      defineComponent({
        setup() {
          provide(THEME, 'light');
          const { el, nodeViews } = useEditor({ plugins: [callout], content: CONTENT });
          return () => [h('div', { ref: el }), withViews ? h(nodeViews) : null];
        },
      });
    const first = mount(Host(true), { attachTo: document.body });
    mounted.push(first);
    await settle();
    expect(document.querySelector('.callout')!.getAttribute('data-theme')).toBe('light');
    first.unmount();
    mounted.length = 0;

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mounted.push(mount(Host(false), { attachTo: document.body }));
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.callout')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nodeViews'));
  });

  it('createEditor без обёртки — свой корень Vue', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = createEditor({ element, content: CONTENT, plugins: [callout] });
    expect(element.querySelector('.callout .tone')!.textContent).toBe('info');
    expect(element.querySelector('.callout-body p')!.textContent).toBe('Hello');
    editor.destroy();
  });
});
