import { createEditor, type Editor, type EditorOptions } from '@novaprose/core';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DependencyList,
} from 'react';

// На сервере useLayoutEffect выдаёт предупреждение — там он всё равно не нужен.
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Опции хука: всё из `EditorOptions`, кроме `element` — его даёт `ref`. */
export type UseEditorOptions = Omit<EditorOptions, 'element'> & {
  /** Вызывается сразу после создания экземпляра. */
  onCreate?: (editor: Editor) => void;
  /** Вызывается перед уничтожением экземпляра. */
  onDestroy?: (editor: Editor) => void;
};

export interface UseEditorResult {
  /** Callback-ref для контейнера: `<div ref={ref} />`. */
  ref: (element: HTMLElement | null) => void;
  /** Экземпляр редактора; `null` до монтирования и на сервере. */
  editor: Editor | null;
}

/**
 * Создаёт редактор в контейнере, к которому привязан `ref`, и уничтожает при размонтировании.
 *
 * Опции читаются в момент создания. Колбэки (`onChange`, `onCreate`, `onDestroy`) всегда берутся
 * свежие — их можно передавать стрелочными функциями. Чтобы пересоздать редактор с новыми опциями,
 * передайте `deps` (как у `useEffect`).
 */
export function useEditor(
  options: UseEditorOptions = {},
  deps: DependencyList = [],
): UseEditorResult {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useIsomorphicLayoutEffect(() => {
    if (!element) return;
    // onDestroy в ядро не передаём: его вызываем сами в очистке, всегда свежий из optionsRef.
    const { onCreate, onDestroy, onChange, ...rest } = optionsRef.current;
    void onDestroy;
    const instance = createEditor({
      ...rest,
      element,
      ...(onChange ? { onChange: (e: Editor) => optionsRef.current.onChange?.(e) } : {}),
    });
    setEditor(instance);
    onCreate?.(instance);
    return () => {
      optionsRef.current.onDestroy?.(instance);
      instance.destroy();
      setEditor((current) => (current === instance ? null : current));
    };
  }, [element, ...deps]);

  const ref = useCallback((node: HTMLElement | null) => setElement(node), []);
  return { ref, editor };
}
