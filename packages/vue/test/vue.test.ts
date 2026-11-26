import { mount } from '@vue/test-utils';
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import type { Editor } from '@novaprose/core';
import { NovaProseEditor, shallowEqual, useCommand, useEditor, useEditorState } from '../src';

const mounted: Array<{ unmount(): void }> = [];
function track<T extends { unmount(): void }>(wrapper: T): T {
  mounted.push(wrapper);
  return wrapper;
}
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = '';
});

function selectAllText(editor: Editor): void {
  const { state } = editor.view;
  editor.view.dispatch(
    state.tr.setSelection(TextSelection.create(state.doc, 1, state.doc.content.size - 1)),
  );
}

type Exposed = { editor: Editor | null };

describe('<NovaProseEditor>', () => {
  it('mounts the editor, returns the instance through ref and the ready event', async () => {
    const wrapper = track(
      mount(NovaProseEditor, { props: { defaultValue: '<p>hello</p>' }, attachTo: document.body }),
    );
    await nextTick();
    expect(wrapper.find('.nova-editor').exists()).toBe(true);
    const editor = (wrapper.vm as unknown as Exposed).editor!;
    expect(editor.getHTML()).toBe('<p>hello</p>');
    expect(wrapper.emitted('ready')).toHaveLength(1);
  });

  it('v-model: typing emits update:modelValue, an external value comes without an echo and without history', async () => {
    const wrapper = track(
      mount(NovaProseEditor, { props: { modelValue: '<p>a</p>' }, attachTo: document.body }),
    );
    await nextTick();
    const editor = (wrapper.vm as unknown as Exposed).editor!;
    editor.setContent('<p>b</p>');
    expect(wrapper.emitted('update:modelValue')).toEqual([['<p>b</p>']]);

    await wrapper.setProps({ modelValue: '<p>c</p>' });
    expect(editor.getHTML()).toBe('<p>c</p>');
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
  });

  it('init passes core options through, explicit props win, attributes go to the container', async () => {
    const wrapper = track(
      mount(NovaProseEditor, {
        props: {
          init: { menubar: true, statusbar: false, placeholder: 'from init' },
          placeholder: 'from the prop',
        },
        attrs: { id: 'body', class: 'field' },
        attachTo: document.body,
      }),
    );
    await nextTick();
    expect(wrapper.find('.nova-menubar').exists()).toBe(true);
    expect(wrapper.find('.nova-statusbar').exists()).toBe(false);
    expect(wrapper.html()).toContain('from the prop');
    expect(wrapper.html()).not.toContain('from init');
    expect(wrapper.find('#body.field .nova-editor').exists()).toBe(true);
  });

  it('name renders a hidden field with the current HTML for FormData', async () => {
    const editorRef = ref<Exposed | null>(null);
    const Form = defineComponent(
      () => () =>
        h('form', [h(NovaProseEditor, { ref: editorRef, name: 'body', defaultValue: '<p>a</p>' })]),
    );
    const wrapper = track(mount(Form, { attachTo: document.body }));
    await nextTick();
    const form = wrapper.find('form').element as HTMLFormElement;
    expect(new FormData(form).get('body')).toBe('<p>a</p>');
    editorRef.value!.editor!.setContent('<p>b</p>');
    expect(new FormData(form).get('body')).toBe('<p>b</p>');
  });

  it('editable toggles through a prop', async () => {
    const wrapper = track(
      mount(NovaProseEditor, { props: { defaultValue: '<p>a</p>' }, attachTo: document.body }),
    );
    await nextTick();
    await wrapper.setProps({ editable: false });
    expect((wrapper.vm as unknown as Exposed).editor!.isEditable()).toBe(false);
  });

  it('destroys the editor on unmount', async () => {
    const wrapper = mount(NovaProseEditor, { attachTo: document.body });
    await nextTick();
    const editor = (wrapper.vm as unknown as Exposed).editor!;
    const onDestroy = vi.fn();
    editor.on('destroy', onDestroy);
    wrapper.unmount();
    expect(onDestroy).toHaveBeenCalledOnce();
  });
});

describe('composables', () => {
  it('useEditor + useCommand: a custom button reflects and changes the format', async () => {
    let editorRef: Ref<Editor | null> | null = null;
    let renders = 0;
    const App = defineComponent(() => {
      const { el, editor } = useEditor({ content: '<p>hello</p>', toolbar: false });
      editorRef = editor;
      const bold = useCommand(editor, 'bold');
      return () => {
        renders++;
        return h('div', [
          h(
            'button',
            {
              'aria-pressed': String(bold.active.value),
              disabled: !bold.enabled.value,
              onClick: bold.run,
            },
            'B',
          ),
          h('div', { ref: el }),
        ]);
      };
    });
    const wrapper = track(mount(App, { attachTo: document.body }));
    await nextTick();
    const editor = editorRef!.value!;
    const button = wrapper.find('button');
    expect(button.attributes('aria-pressed')).toBe('false');

    selectAllText(editor);
    await button.trigger('click');
    expect(editor.getHTML()).toBe('<p><strong>hello</strong></p>');
    expect(button.attributes('aria-pressed')).toBe('true');

    editor.setEditable(false);
    await nextTick();
    expect(button.attributes('disabled')).toBeDefined();

    // Events that don't change the selector's result don't re-render the component.
    const before = renders;
    selectAllText(editor);
    await nextTick();
    expect(renders).toBe(before);
  });

  it('useEditorState with an object selector', async () => {
    let editorRef: Ref<Editor | null> | null = null;
    let words: Readonly<Ref<{ words: number } | undefined>> | null = null;
    const App = defineComponent(() => {
      const { el, editor } = useEditor({ content: '<p>a b</p>' });
      editorRef = editor;
      words = useEditorState(editor, (e) => ({
        words: e.getText().trim().split(/\s+/).length,
      }));
      return () => h('div', { ref: el });
    });
    track(mount(App, { attachTo: document.body }));
    await nextTick();
    expect(words!.value).toEqual({ words: 2 });
    editorRef!.value!.setContent('<p>a b c</p>');
    expect(words!.value).toEqual({ words: 3 });
  });

  it('shallowEqual', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});
