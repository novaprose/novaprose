import { act, cleanup, render } from '@testing-library/react';
import { StrictMode, createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@novaprose/core';
import { NovaProseEditor } from '../src';

afterEach(cleanup);

describe('<NovaProseEditor>: options and forms', () => {
  it('init passes any core option through, explicit props win', () => {
    const { container } = render(
      <NovaProseEditor
        defaultValue=""
        init={{ toolbar: 'bold', menubar: true, statusbar: false, placeholder: 'from init' }}
        placeholder="from the prop"
      />,
    );
    expect(container.querySelector('.nova-menubar')).not.toBeNull();
    expect(container.querySelector('.nova-statusbar')).toBeNull();
    expect(container.innerHTML).toContain('from the prop');
    expect(container.innerHTML).not.toContain('from init');
  });

  it('name renders a hidden field with the current HTML for FormData', () => {
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

  it('the React Hook Form field contract: ref with focus(), reset() from outside without an echo in onChange', () => {
    // Controller gives field = { value, onChange, onBlur, ref }: this imitates it.
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
    // User input reaches the form.
    act(() => fieldRef!.setContent('<p>new</p>'));
    expect(onChange).toHaveBeenLastCalledWith('<p>new</p>');
  });

  it('editable toggles through a prop', () => {
    const ref = createRef<Editor | null>();
    const { rerender } = render(<NovaProseEditor ref={ref} defaultValue="<p>a</p>" />);
    rerender(<NovaProseEditor ref={ref} defaultValue="<p>a</p>" editable={false} />);
    expect(ref.current?.isEditable()).toBe(false);
  });

  it('StrictMode: a double mount leaves exactly one editor', () => {
    const onReady = vi.fn();
    const { container } = render(
      <StrictMode>
        <NovaProseEditor defaultValue="<p>a</p>" onReady={onReady} />
      </StrictMode>,
    );
    expect(container.querySelectorAll('.nova-editor').length).toBe(1);
  });
});
