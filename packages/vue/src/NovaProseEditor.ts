import type { Editor, EditorOptions } from '@novaprose/core';
import { defineComponent, h, ref, watch, type PropType } from 'vue';
import { useEditor, type UseEditorOptions } from './composables';

/** Editor options except those set through separate component props. */
export type NovaProseInit = Omit<EditorOptions, 'element' | 'content' | 'onChange'>;

/**
 * The NovaProse editor component for Vue.
 *
 * ```vue
 * <NovaProseEditor v-model="html" :init="{ menubar: true }" />
 * ```
 *
 * SSR-safe: renders an empty container on the server; the editor is created after mounting.
 * Attributes (`class`, `style`, `id`, `aria-*`) go to the container.
 */
export const NovaProseEditor = defineComponent({
  name: 'NovaProseEditor',
  inheritAttrs: false,
  props: {
    /** HTML for `v-model`. Without it, the uncontrolled mode with the initial value `defaultValue`. */
    modelValue: { type: String, default: undefined },
    defaultValue: { type: String, default: undefined },
    /** Any core options. Read on mount; to apply new ones, change `key`. */
    init: { type: Object as PropType<NovaProseInit>, default: undefined },
    // An explicit default: undefined for Boolean, otherwise Vue turns a missing prop into false.
    editable: { type: Boolean, default: undefined },
    placeholder: { type: String, default: undefined },
    toolbar: {
      type: [String, Array, Boolean] as PropType<EditorOptions['toolbar']>,
      default: undefined,
    },
    plugins: { type: Array as PropType<EditorOptions['plugins']>, default: undefined },
    prosemirrorPlugins: {
      type: Array as PropType<EditorOptions['prosemirrorPlugins']>,
      default: undefined,
    },
    language: { type: String, default: undefined },
    /** Field name for a plain HTML form: an `<input type="hidden">` with the current HTML is rendered next to it. */
    name: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (html: string) => typeof html === 'string',
    ready: (editor: Editor) => !!editor,
    focus: (editor: Editor) => !!editor,
    blur: (editor: Editor) => !!editor,
  },
  setup(props, { emit, expose, attrs }) {
    const input = ref<HTMLInputElement | null>(null);
    // While an external modelValue is being applied, update isn't emitted: otherwise a form reset would echo back.
    let syncing = false;

    const explicit = Object.fromEntries(
      Object.entries({
        editable: props.editable,
        placeholder: props.placeholder,
        toolbar: props.toolbar,
        plugins: props.plugins,
        prosemirrorPlugins: props.prosemirrorPlugins,
        language: props.language,
      }).filter(([, value]) => value !== undefined),
    );
    const options: UseEditorOptions = {
      ...props.init,
      ...explicit,
      content: props.modelValue ?? props.defaultValue ?? '',
      onCreate: (editor) => {
        if (input.value) input.value.value = editor.getHTML();
        editor.on('change', (e) => {
          const html = e.getHTML();
          if (input.value) input.value.value = html;
          if (!syncing) emit('update:modelValue', html);
        });
        editor.on('focus', (e) => emit('focus', e));
        editor.on('blur', (e) => emit('blur', e));
        emit('ready', editor);
      },
    };
    const { el, editor, nodeViews } = useEditor(options);

    watch(
      () => props.modelValue,
      (value) => {
        const instance = editor.value;
        if (!instance || value === undefined || instance.getHTML() === value) return;
        syncing = true;
        try {
          instance.setContent(value, { addToHistory: false });
        } finally {
          syncing = false;
        }
        if (input.value) input.value.value = instance.getHTML();
      },
    );

    watch(
      () => props.editable,
      (value) => {
        if (value !== undefined) editor.value?.setEditable(value);
      },
    );

    /** The `Editor` instance through a template ref: `editorRef.value.editor`. */
    expose({
      get editor() {
        return editor.value;
      },
      focus: () => editor.value?.focus(),
    });

    return () => {
      const container = h('div', { ...attrs, ref: el });
      if (props.name === undefined) return [container, h(nodeViews)];
      return [
        container,
        h(nodeViews),
        h('input', {
          ref: input,
          type: 'hidden',
          name: props.name,
          value: props.modelValue ?? props.defaultValue ?? '',
        }),
      ];
    };
  },
});
