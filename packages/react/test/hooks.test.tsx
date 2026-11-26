import { act, cleanup, render } from '@testing-library/react';
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@novaprose/core';
import { shallowEqual, useCommand, useEditor, useEditorState } from '../src';

afterEach(cleanup);

function selectAllText(editor: Editor): void {
  const { state } = editor.view;
  editor.view.dispatch(
    state.tr.setSelection(TextSelection.create(state.doc, 1, state.doc.content.size - 1)),
  );
}

describe('useEditor', () => {
  it('creates an editor in the container and destroys it on unmount', () => {
    let editor: Editor | null = null;
    const onDestroy = vi.fn();
    function App() {
      const result = useEditor({ content: '<p>a</p>', toolbar: false, onDestroy });
      editor = result.editor;
      return <div ref={result.ref} />;
    }
    const { unmount, container } = render(<App />);
    expect(editor!.getHTML()).toBe('<p>a</p>');
    expect(container.querySelector('.nova-toolbar')).toBeNull();
    unmount();
    expect(onDestroy).toHaveBeenCalledOnce();
  });

  it('onChange always calls the fresh callback', () => {
    let editor: Editor | null = null;
    const calls: string[] = [];
    function App({ tag }: { tag: string }) {
      const result = useEditor({ content: '<p>a</p>', onChange: () => calls.push(tag) });
      editor = result.editor;
      return <div ref={result.ref} />;
    }
    const { rerender } = render(<App tag="first" />);
    rerender(<App tag="second" />);
    act(() => editor!.setContent('<p>b</p>'));
    expect(calls).toEqual(['second']);
  });

  it('deps recreate the editor', () => {
    const created = vi.fn();
    function App({ lang }: { lang: string }) {
      const { ref } = useEditor({ language: lang, onCreate: created }, [lang]);
      return <div ref={ref} />;
    }
    const { rerender } = render(<App lang="en" />);
    rerender(<App lang="en" />);
    expect(created).toHaveBeenCalledTimes(1);
    rerender(<App lang="ru" />);
    expect(created).toHaveBeenCalledTimes(2);
  });
});

describe('useEditorState / useCommand', () => {
  it('a custom button: active/enabled update, run runs the command', () => {
    let editor: Editor | null = null;
    let renders = 0;
    function BoldButton({ editor }: { editor: Editor | null }) {
      const bold = useCommand(editor, 'bold');
      renders++;
      return (
        <button aria-pressed={bold.active} disabled={!bold.enabled} onClick={bold.run}>
          B
        </button>
      );
    }
    function App() {
      const result = useEditor({ content: '<p>hello</p>', toolbar: false });
      editor = result.editor;
      return (
        <>
          <BoldButton editor={result.editor} />
          <div ref={result.ref} />
        </>
      );
    }
    const { getByText } = render(<App />);
    const button = getByText('B') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.disabled).toBe(false);

    act(() => selectAllText(editor!));
    act(() => button.click());
    expect(editor!.getHTML()).toBe('<p><strong>hello</strong></p>');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    act(() => editor!.setEditable(false));
    expect(button.disabled).toBe(true);

    // Events that don't change the selector's result don't re-render the component.
    const before = renders;
    act(() => selectAllText(editor!));
    expect(renders).toBe(before);
  });

  it('useEditorState with an object selector', () => {
    let editor: Editor | null = null;
    let state: { words: number } | undefined;
    function App() {
      const result = useEditor({ content: '<p>a b</p>' });
      editor = result.editor;
      state = useEditorState(result.editor, (e) => ({
        words: e.getText().trim().split(/\s+/).length,
      }));
      return <div ref={result.ref} />;
    }
    render(<App />);
    expect(state).toEqual({ words: 2 });
    act(() => editor!.setContent('<p>a b c</p>'));
    expect(state).toEqual({ words: 3 });
  });

  it('shallowEqual', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual({ a: 1 }, [1])).toBe(false);
  });
});
