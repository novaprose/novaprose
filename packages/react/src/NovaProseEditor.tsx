import type { Editor, EditorOptions } from '@novaprose/core';
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import { useEditor, type UseEditorOptions } from './useEditor';

/** Editor options except those set through separate component props. */
export type NovaProseInit = Omit<EditorOptions, 'element' | 'content' | 'onChange'>;

export interface NovaProseEditorProps {
  /** The controlled value (HTML). Together with onChange, the controlled mode. */
  value?: string;
  /** The initial value for the uncontrolled mode. */
  defaultValue?: string;
  onChange?: (html: string, editor: Editor) => void;
  /** Called once, when the editor instance has been created. */
  onReady?: (editor: Editor) => void;
  onFocus?: (editor: Editor) => void;
  onBlur?: (editor: Editor) => void;
  /**
   * Any core options (`toolbar`, `menubar`, `plugins`, `uploadImage`, `validElements`…). Read on
   * mount; to apply new ones, change the component's `key`.
   */
  init?: NovaProseInit;
  editable?: boolean;
  placeholder?: string;
  toolbar?: EditorOptions['toolbar'];
  plugins?: EditorOptions['plugins'];
  prosemirrorPlugins?: EditorOptions['prosemirrorPlugins'];
  language?: string;
  /**
   * Field name for a plain HTML form: an `<input type="hidden">` with the current HTML is rendered
   * next to the editor, so `FormData` and server-side forms work without JS handlers.
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
 * The NovaProse editor component for React.
 *
 * SSR-safe: renders an empty container on the server; the editor is created on the client.
 * `ref` gives the `Editor` instance (it has `focus()`, so React Hook Form can focus the field on a
 * validation error).
 */
export const NovaProseEditor = forwardRef<Editor | null, NovaProseEditorProps>(
  function NovaProseEditor(props, ref) {
    const propsRef = useRef(props);
    propsRef.current = props;
    const inputRef = useRef<HTMLInputElement>(null);
    // While an external value is being applied, onChange isn't called: otherwise a form reset() would echo back.
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
    const { ref: containerRef, editor, nodeViews } = useEditor(options);

    useImperativeHandle(ref, () => editor as Editor, [editor]);

    // Events are subscribed separately: callbacks are always fresh and the editor isn't recreated.
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

    // Controlled: sync the external value without cluttering the undo history.
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
    if (props.name === undefined)
      return (
        <>
          {container}
          {nodeViews}
        </>
      );
    return (
      <>
        {container}
        {nodeViews}
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
