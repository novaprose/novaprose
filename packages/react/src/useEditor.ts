import { createEditor, type Editor, type EditorOptions } from '@novaprose/core';
import {
  createElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type DependencyList,
  type ReactNode,
} from 'react';
import { createWithPortals, NodeViewHost, NodeViewPortals } from './nodeViews';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

export { useIsomorphicLayoutEffect };

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
  /**
   * Виды узлов на React (reactNodeView): отрисуйте рядом с контейнером — `<div ref={ref} />
   * {nodeViews}`. Компоненты видов получают контекст того места, где стоит этот элемент.
   */
  nodeViews: ReactNode;
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
  const [portals] = useState(() => new NodeViewPortals());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useIsomorphicLayoutEffect(() => {
    if (!element) return;
    // onDestroy в ядро не передаём: его вызываем сами в очистке, всегда свежий из optionsRef.
    const { onCreate, onDestroy, onChange, ...rest } = optionsRef.current;
    void onDestroy;
    const instance = createWithPortals(portals, () =>
      createEditor({
        ...rest,
        element,
        ...(onChange ? { onChange: (e: Editor) => optionsRef.current.onChange?.(e) } : {}),
      }),
    );
    setEditor(instance);
    onCreate?.(instance);
    return () => {
      optionsRef.current.onDestroy?.(instance);
      instance.destroy();
      setEditor((current) => (current === instance ? null : current));
    };
  }, [element, ...deps]);

  const ref = useCallback((node: HTMLElement | null) => setElement(node), []);
  const nodeViews = useMemo(() => createElement(NodeViewHost, { portals }), [portals]);
  return { ref, editor, nodeViews };
}
