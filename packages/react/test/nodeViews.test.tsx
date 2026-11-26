import { createEditor, definePlugin, type Editor } from '@novaprose/core';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createContext, createRef, useContext } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NodeViewContent,
  NovaProseEditor,
  reactNodeView,
  useEditor,
  useNodeView,
  type NodeViewProps,
} from '../src';

/** Виды узлов на React: портал внутри дерева приложения (контекст доступен), правка атрибутов. */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const Theme = createContext('no theme');

function ToneLabel() {
  const { node } = useNodeView();
  return <b className="tone">{String(node.attrs.tone)}</b>;
}

function Callout({ node, updateAttributes, selected }: NodeViewProps) {
  const theme = useContext(Theme);
  return (
    <div className="callout" data-theme={theme} data-selected={selected}>
      <select
        value={String(node.attrs.tone)}
        onChange={(event) => updateAttributes({ tone: event.target.value })}
      >
        <option value="info">info</option>
        <option value="warning">warning</option>
      </select>
      <ToneLabel />
      <NodeViewContent className="callout-body" />
    </div>
  );
}

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
  nodeViews: { callout: reactNodeView(Callout) },
});

const CONTENT = '<div data-callout="" data-tone="info"><p>Hello</p></div>';

describe('reactNodeView', () => {
  it('в <NovaProseEditor>: компонент с контекстом приложения, содержимое на своём месте', () => {
    const ref = createRef<Editor | null>();
    const onChange = vi.fn();
    const { container } = render(
      <Theme.Provider value="dark">
        <NovaProseEditor ref={ref} plugins={[callout]} defaultValue={CONTENT} onChange={onChange} />
      </Theme.Provider>,
    );
    const view = container.querySelector('[data-node-view="callout"] .callout')!;
    expect(view.getAttribute('data-theme')).toBe('dark');
    expect(view.querySelector('.tone')!.textContent).toBe('info');
    expect(view.querySelector('.callout-body[data-node-view-content] p')!.textContent).toBe(
      'Hello',
    );
    expect(ref.current!.getHTML()).toBe(CONTENT);

    act(() => {
      fireEvent.change(view.querySelector('select')!, { target: { value: 'warning' } });
    });
    expect(onChange).toHaveBeenLastCalledWith(
      '<div data-callout="" data-tone="warning"><p>Hello</p></div>',
      ref.current,
    );
    expect(view.querySelector('.tone')!.textContent).toBe('warning');
    act(() => {
      ref.current!.exec('undo');
    });
    expect(container.querySelector('.tone')!.textContent).toBe('info');
  });

  it('useEditor: {nodeViews} рядом с контейнером; без него — предупреждение', async () => {
    function App({ withViews }: { withViews: boolean }) {
      const { ref, nodeViews } = useEditor({ plugins: [callout], content: CONTENT });
      return (
        <Theme.Provider value="light">
          <div ref={ref} />
          {withViews && nodeViews}
        </Theme.Provider>
      );
    }
    const { container, unmount } = render(<App withViews />);
    expect(container.querySelector('.callout')!.getAttribute('data-theme')).toBe('light');
    unmount();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const second = render(<App withViews={false} />);
    await act(() => Promise.resolve());
    expect(second.container.querySelector('.callout')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('render {nodeViews}'));
  });

  it('createEditor без обёртки — свой корень React', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    let editor!: Editor;
    await act(async () => {
      editor = createEditor({ element, content: CONTENT, plugins: [callout] });
    });
    expect(element.querySelector('.callout .tone')!.textContent).toBe('info');
    expect(element.querySelector('.callout-body p')!.textContent).toBe('Hello');
    await act(async () => editor.destroy());
    element.remove();
  });

  it('удалённый узел убирает свой портал', () => {
    const ref = createRef<Editor | null>();
    const { container } = render(
      <NovaProseEditor ref={ref} plugins={[callout]} defaultValue={CONTENT} />,
    );
    expect(container.querySelectorAll('.callout')).toHaveLength(1);
    act(() => {
      ref.current!.setContent('<p>plain</p>');
    });
    expect(container.querySelectorAll('.callout')).toHaveLength(0);
  });
});
