import { NodeSelection, TextSelection } from 'prosemirror-state';
import type { NodeView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditor,
  defineNodeView,
  definePlugin,
  type Editor,
  type NodeViewProps,
  type NovaPlugin,
} from '../src';

/**
 * Виды узлов из своего отрисовщика (defineNodeView): ядро ведёт ProseMirror, отрисовщик — разметку.
 * Здесь — обычный DOM; React и Vue проверяют свои пакеты и e2e/node-views.spec.ts.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const log: string[] = [];
let lastProps: NodeViewProps | null = null;

/** Блок-выноска: список «тон» и редактируемое содержимое в своей обёртке. */
const calloutView = defineNodeView(() => {
  let select: HTMLSelectElement;
  let current: NodeViewProps;
  return {
    mount(dom, props) {
      log.push('mount');
      select = document.createElement('select');
      for (const tone of ['info', 'warning']) select.add(new Option(tone, tone));
      select.addEventListener('change', () => current.updateAttributes({ tone: select.value }));
      const body = document.createElement('div');
      body.className = 'body';
      if (props.contentDOM) body.append(props.contentDOM);
      dom.append(select, body);
      this.update(props);
    },
    update(props) {
      log.push(`update:${props.node.attrs.tone as string}:${props.node.textContent}`);
      current = props;
      select.value = props.node.attrs.tone as string;
      select.dataset.selected = String(props.selected);
    },
    destroy() {
      log.push('destroy');
    },
  };
});

/** Значок без содержимого (атом). */
const badgeView = defineNodeView(
  () => ({
    mount(dom, props) {
      dom.textContent = `#${props.node.attrs.label as string}`;
      lastProps = props;
    },
    update(props) {
      lastProps = props;
      if (props.selected) log.push('badge:selected');
    },
    destroy() {},
  }),
  { className: 'badge-view' },
);

const callout: NovaPlugin = definePlugin({
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
      toDOM: (node) => ['div', { 'data-callout': '', 'data-tone': node.attrs.tone as string }, 0],
    },
    badge: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: { label: { default: '' } },
      parseDOM: [
        {
          tag: 'span[data-badge]',
          getAttrs: (dom) => ({ label: (dom as HTMLElement).textContent }),
        },
      ],
      toDOM: (node) => ['span', { 'data-badge': '' }, node.attrs.label as string],
    },
  },
  nodeViews: { callout: calloutView, badge: badgeView },
});

const CONTENT =
  '<div data-callout="" data-tone="info"><p>Hello</p></div><p>Tag <span data-badge="">new</span></p>';

function mount(content = CONTENT): Editor {
  log.length = 0;
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, plugins: [callout] });
  return editor;
}

function viewOf(dom: Element): NodeView {
  // Внутреннее поле ProseMirror: описание вида у его корня — только чтобы проверить решения вида.
  return (dom as unknown as { pmViewDesc: { spec: NodeView } }).pmViewDesc.spec;
}

describe('defineNodeView', () => {
  it('рисует узел своей разметкой; содержимое — в её месте; HTML — из toDOM', () => {
    const e = mount();
    const dom = e.root.querySelector('[data-node-view="callout"]')!;
    expect(dom.querySelector('select')!.value).toBe('info');
    expect(dom.querySelector('.body > div')!.textContent).toBe('Hello');
    expect(e.root.querySelector('.badge-view')!.textContent).toBe('#new');
    expect(e.getHTML()).toBe(CONTENT);
    expect(log).toEqual(['mount', 'update:info:Hello']);
  });

  it('updateAttributes — одна правка с отменой; ввод в содержимое обновляет вид', () => {
    const e = mount();
    const select = e.root.querySelector('select')!;
    select.value = 'warning';
    select.dispatchEvent(new Event('change'));
    expect(e.getHTML()).toContain('data-tone="warning"');
    expect(select.value).toBe('warning');
    e.exec('undo');
    expect(e.getHTML()).toContain('data-tone="info"');
    expect(e.root.querySelector('select')!.value).toBe('info');
    e.view.dispatch(e.view.state.tr.insertText('!', 7));
    expect(log.at(-1)).toBe('update:info:Hello!');
  });

  it('выделение узла и deleteNode', () => {
    const e = mount();
    let badgePos = -1;
    e.view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'badge') badgePos = pos;
    });
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, badgePos)));
    expect(lastProps!.selected).toBe(true);
    expect(e.root.querySelector('.badge-view')!.classList).toContain('ProseMirror-selectednode');
    lastProps!.deleteNode();
    expect(e.getHTML()).toBe(
      '<div data-callout="" data-tone="info"><p>Hello</p></div><p>Tag&nbsp;</p>',
    );
    // Уже удалённый узел: действия молча ничего не делают.
    lastProps!.updateAttributes({ label: 'x' });
    expect(lastProps!.getPos()).toBeUndefined();
  });

  it('события своих полей вида — его; содержимое и перетаскивание — редактора', () => {
    const e = mount();
    const dom = e.root.querySelector('[data-node-view="callout"]')!;
    const view = viewOf(dom);
    const on = (target: Element, type: string) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, 'target', { value: target });
      return view.stopEvent!(event);
    };
    expect(on(dom.querySelector('select')!, 'keydown')).toBe(true);
    expect(on(dom.querySelector('select')!, 'dragstart')).toBe(false);
    expect(on(dom.querySelector('.body p')!, 'keydown')).toBe(false);
    expect(on(dom, 'mousedown')).toBe(false);
    // Мутации своей разметки — не правка документа; внутри содержимого — правка.
    const mutation = (target: Node) => ({ type: 'childList', target }) as unknown as MutationRecord;
    expect(view.ignoreMutation!(mutation(dom.querySelector('.body')!))).toBe(true);
    expect(view.ignoreMutation!(mutation(dom.querySelector('.body p')!))).toBe(false);
    expect(viewOf(e.root.querySelector('.badge-view')!).ignoreMutation!(mutation(dom))).toBe(true);
  });

  it('сбой отрисовщика не ломает редактор; destroy зовётся при уничтожении', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = definePlugin({
      ...callout,
      name: 'broken',
      nodeViews: {
        callout: defineNodeView(() => ({
          mount() {
            throw new Error('boom');
          },
          update() {},
          destroy() {},
        })),
      },
    });
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({ element, content: CONTENT, plugins: [broken] });
    expect(errors).toHaveBeenCalledWith(
      '[nova] Node view for "callout" failed to render',
      expect.any(Error),
    );
    const e = editor;
    e.view.dispatch(
      e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 7)).insertText('!'),
    );
    expect(e.getHTML()).toContain('<p>Hello!</p>');
    e.destroy();
    editor = null;

    const second = mount();
    second.destroy();
    editor = null;
    expect(log).toContain('destroy');
  });
});
