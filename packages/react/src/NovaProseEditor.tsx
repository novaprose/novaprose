import type { Editor, EditorOptions } from '@novaprose/core';
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import { useEditor, type UseEditorOptions } from './useEditor';

/** Опции редактора без тех, что задаются отдельными пропсами компонента. */
export type NovaProseInit = Omit<EditorOptions, 'element' | 'content' | 'onChange'>;

export interface NovaProseEditorProps {
  /** Контролируемое значение (HTML). Вместе с onChange — controlled-режим. */
  value?: string;
  /** Начальное значение для uncontrolled-режима. */
  defaultValue?: string;
  onChange?: (html: string, editor: Editor) => void;
  /** Вызывается один раз, когда экземпляр редактора создан. */
  onReady?: (editor: Editor) => void;
  onFocus?: (editor: Editor) => void;
  onBlur?: (editor: Editor) => void;
  /**
   * Любые опции ядра (`toolbar`, `menubar`, `plugins`, `uploadImage`, `validElements`…).
   * Читаются при монтировании; чтобы применить новые — смените `key` компонента.
   */
  init?: NovaProseInit;
  editable?: boolean;
  placeholder?: string;
  toolbar?: EditorOptions['toolbar'];
  plugins?: EditorOptions['plugins'];
  prosemirrorPlugins?: EditorOptions['prosemirrorPlugins'];
  language?: string;
  /**
   * Имя поля для обычной HTML-формы: рядом рендерится `<input type="hidden">` с актуальным HTML,
   * так что `FormData` и серверные формы работают без JS-обработчиков.
   */
  name?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

function pick<T extends object>(source: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * React-компонент редактора NovaProse.
 *
 * SSR-безопасен: на сервере рендерит пустой контейнер, редактор создаётся на клиенте.
 * `ref` отдаёт экземпляр `Editor` (у него есть `focus()`, поэтому React Hook Form может
 * фокусировать поле при ошибке валидации).
 */
export const NovaProseEditor = forwardRef<Editor | null, NovaProseEditorProps>(
  function NovaProseEditor(props, ref) {
    const propsRef = useRef(props);
    propsRef.current = props;
    const inputRef = useRef<HTMLInputElement>(null);
    // Пока применяем внешний value, onChange не зовём: иначе reset() формы вернулся бы «эхом».
    const syncingRef = useRef(false);

    const initial = props;
    const options: UseEditorOptions = {
      ...initial.init,
      ...pick({
        editable: initial.editable,
        placeholder: initial.placeholder,
        toolbar: initial.toolbar,
        plugins: initial.plugins,
        prosemirrorPlugins: initial.prosemirrorPlugins,
        language: initial.language,
      }),
      content: initial.value ?? initial.defaultValue ?? '',
      onCreate: (editor) => {
        if (inputRef.current) inputRef.current.value = editor.getHTML();
        propsRef.current.onReady?.(editor);
      },
    };
    const { ref: containerRef, editor } = useEditor(options);

    useImperativeHandle(ref, () => editor as Editor, [editor]);

    // События подписываем отдельно: колбэки всегда свежие, редактор не пересоздаётся.
    useEffect(() => {
      if (!editor) return;
      const offs = [
        editor.on('change', (e) => {
          const html = e.getHTML();
          if (inputRef.current) inputRef.current.value = html;
          if (!syncingRef.current) propsRef.current.onChange?.(html, e);
        }),
        editor.on('focus', (e) => propsRef.current.onFocus?.(e)),
        editor.on('blur', (e) => propsRef.current.onBlur?.(e)),
      ];
      return () => offs.forEach((off) => off());
    }, [editor]);

    // Controlled: синхронизируем внешний value, не засоряя историю undo.
    useEffect(() => {
      if (!editor || props.value === undefined) return;
      if (editor.getHTML() !== props.value) {
        syncingRef.current = true;
        try {
          editor.setContent(props.value, { addToHistory: false });
        } finally {
          syncingRef.current = false;
        }
        if (inputRef.current) inputRef.current.value = editor.getHTML();
      }
    }, [editor, props.value]);

    useEffect(() => {
      if (editor && props.editable !== undefined) editor.setEditable(props.editable);
    }, [editor, props.editable]);

    const container = (
      <div ref={containerRef} id={props.id} className={props.className} style={props.style} />
    );
    if (props.name === undefined) return container;
    return (
      <>
        {container}
        <input
          ref={inputRef}
          type="hidden"
          name={props.name}
          defaultValue={props.value ?? props.defaultValue ?? ''}
        />
      </>
    );
  },
);
