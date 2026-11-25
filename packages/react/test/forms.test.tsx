import { act, cleanup, render } from '@testing-library/react';
import { StrictMode, createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@novaprose/core';
import { NovaProseEditor } from '../src';

afterEach(cleanup);

describe('<NovaProseEditor> — опции и формы', () => {
  it('init пробрасывает любые опции ядра, явные пропсы важнее', () => {
    const { container } = render(
      <NovaProseEditor
        defaultValue=""
        init={{ toolbar: 'bold', menubar: true, statusbar: false, placeholder: 'из init' }}
        placeholder="из пропса"
      />,
    );
    expect(container.querySelector('.nova-menubar')).not.toBeNull();
    expect(container.querySelector('.nova-statusbar')).toBeNull();
    expect(container.innerHTML).toContain('из пропса');
    expect(container.innerHTML).not.toContain('из init');
  });

  it('name рендерит скрытое поле с актуальным HTML для FormData', () => {
    const ref = createRef<Editor | null>();
    const { container } = render(
      <form>
        <NovaProseEditor ref={ref} name="body" defaultValue="<p>a</p>" />
      </form>,
    );
    const form = container.querySelector('form')!;
    expect(new FormData(form).get('body')).toBe('<p>a</p>');
    act(() => ref.current?.setContent('<p>b</p>'));
    expect(new FormData(form).get('body')).toBe('<p>b</p>');
  });

  it('контракт поля React Hook Form: ref с focus(), reset() снаружи без эха в onChange', () => {
    // Controller отдаёт field = { value, onChange, onBlur, ref } — имитируем его.
    let fieldRef: Editor | null = null;
    const onChange = vi.fn();
    const onBlur = vi.fn();
    function Field({ value }: { value: string }) {
      return (
        <NovaProseEditor
          value={value}
          onChange={(html) => onChange(html)}
          onBlur={() => onBlur()}
          ref={(instance) => {
            fieldRef = instance;
          }}
        />
      );
    }
    const { rerender } = render(<Field value="<p>a</p>" />);
    expect(typeof fieldRef!.focus).toBe('function');
    rerender(<Field value="" />);
    expect(fieldRef!.getHTML()).toBe('<p></p>');
    expect(onChange).not.toHaveBeenCalled();
    // Ввод пользователя доходит до формы.
    act(() => fieldRef!.setContent('<p>новое</p>'));
    expect(onChange).toHaveBeenLastCalledWith('<p>новое</p>');
  });

  it('editable переключается пропсом', () => {
    const ref = createRef<Editor | null>();
    const { rerender } = render(<NovaProseEditor ref={ref} defaultValue="<p>a</p>" />);
    rerender(<NovaProseEditor ref={ref} defaultValue="<p>a</p>" editable={false} />);
    expect(ref.current?.isEditable()).toBe(false);
  });

  it('StrictMode: двойной mount оставляет ровно один редактор', () => {
    const onReady = vi.fn();
    const { container } = render(
      <StrictMode>
        <NovaProseEditor defaultValue="<p>a</p>" onReady={onReady} />
      </StrictMode>,
    );
    expect(container.querySelectorAll('.nova-editor').length).toBe(1);
  });
});
