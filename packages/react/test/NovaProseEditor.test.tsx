import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import type { Editor } from '@novaprose/core';
import { NovaProseEditor } from '../src';

afterEach(cleanup);

describe('<NovaProseEditor>', () => {
  it('mounts the editor with defaultValue and returns the instance through ref', () => {
    const ref = createRef<Editor | null>();
    const onReady = vi.fn();
    const { container } = render(
      <NovaProseEditor ref={ref} defaultValue="<p>hello</p>" onReady={onReady} />,
    );
    expect(container.querySelector('.nova-editor')).not.toBeNull();
    expect(ref.current?.getHTML()).toBe('<p>hello</p>');
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('a controlled value updates the content without a history entry', () => {
    const ref = createRef<Editor | null>();
    const { rerender } = render(<NovaProseEditor ref={ref} value="<p>a</p>" />);
    rerender(<NovaProseEditor ref={ref} value="<p>b</p>" />);
    expect(ref.current?.getHTML()).toBe('<p>b</p>');
    expect(ref.current?.can('undo')).toBe(false);
  });

  it('onChange gets the HTML', () => {
    const ref = createRef<Editor | null>();
    const onChange = vi.fn();
    render(<NovaProseEditor ref={ref} defaultValue="<p>a</p>" onChange={onChange} />);
    act(() => ref.current?.setContent('<p>b</p>'));
    expect(onChange).toHaveBeenCalledWith('<p>b</p>', ref.current);
  });

  it('destroys the editor on unmount', () => {
    const { container, unmount } = render(<NovaProseEditor defaultValue="<p>a</p>" />);
    const root = container.querySelector('.nova-editor');
    unmount();
    expect(root?.isConnected).toBe(false);
  });
});
