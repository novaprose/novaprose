import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import type { Editor } from '@novaprose/core';
import { NovaProseEditor } from '../src';

afterEach(cleanup);

describe('<NovaProseEditor>', () => {
  it('монтирует редактор с defaultValue и отдаёт экземпляр через ref', () => {
    const ref = createRef<Editor | null>();
    const onReady = vi.fn();
    const { container } = render(
      <NovaProseEditor ref={ref} defaultValue="<p>привет</p>" onReady={onReady} />,
    );
    expect(container.querySelector('.nova-editor')).not.toBeNull();
    expect(ref.current?.getHTML()).toBe('<p>привет</p>');
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('controlled value обновляет содержимое без записи в историю', () => {
    const ref = createRef<Editor | null>();
    const { rerender } = render(<NovaProseEditor ref={ref} value="<p>a</p>" />);
    rerender(<NovaProseEditor ref={ref} value="<p>b</p>" />);
    expect(ref.current?.getHTML()).toBe('<p>b</p>');
    expect(ref.current?.can('undo')).toBe(false);
  });

  it('onChange получает HTML', () => {
    const ref = createRef<Editor | null>();
    const onChange = vi.fn();
    render(<NovaProseEditor ref={ref} defaultValue="<p>a</p>" onChange={onChange} />);
    act(() => ref.current?.setContent('<p>b</p>'));
    expect(onChange).toHaveBeenCalledWith('<p>b</p>', ref.current);
  });

  it('уничтожает редактор при размонтировании', () => {
    const { container, unmount } = render(<NovaProseEditor defaultValue="<p>a</p>" />);
    const root = container.querySelector('.nova-editor');
    unmount();
    expect(root?.isConnected).toBe(false);
  });
});
