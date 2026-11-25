import type { Editor, EditorOptions } from '@novaprose/core';
import { defineComponent, h, ref, watch, type PropType } from 'vue';
import { useEditor, type UseEditorOptions } from './composables';

/** Опции редактора без тех, что задаются отдельными пропсами компонента. */
export type NovaProseInit = Omit<EditorOptions, 'element' | 'content' | 'onChange'>;

/**
 * Vue-компонент редактора NovaProse.
 *
 * ```vue
 * <NovaProseEditor v-model="html" :init="{ menubar: true }" />
 * ```
 *
 * SSR-безопасен: на сервере рендерит пустой контейнер, редактор создаётся после монтирования.
 * Атрибуты (`class`, `style`, `id`, `aria-*`) уходят на контейнер.
 */
export const NovaProseEditor = defineComponent({
  name: 'NovaProseEditor',
  inheritAttrs: false,
  props: {
    /** HTML для `v-model`. Без него — uncontrolled-режим с начальным значением `defaultValue`. */
    modelValue: { type: String, default: undefined },
    defaultValue: { type: String, default: undefined },
    /** Любые опции ядра. Читаются при монтировании; чтобы применить новые — смените `key`. */
    init: { type: Object as PropType<NovaProseInit>, default: undefined },
    // Для Boolean явный default: undefined, иначе Vue превращает отсутствующий проп в false.
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
    /** Имя поля обычной HTML-формы: рядом рендерится `<input type="hidden">` с актуальным HTML. */
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
    // Пока применяем внешний modelValue, не эмитим update: иначе reset формы вернулся бы «эхом».
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
    const { el, editor } = useEditor(options);

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

    /** Экземпляр `Editor` через template ref: `editorRef.value.editor`. */
    expose({
      get editor() {
        return editor.value;
      },
      focus: () => editor.value?.focus(),
    });

    return () => {
      const container = h('div', { ...attrs, ref: el });
      if (props.name === undefined) return container;
      return [
        container,
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
