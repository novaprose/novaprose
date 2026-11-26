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

/** Hook options: everything from `EditorOptions` except `element`, which `ref` provides. */
export type UseEditorOptions = Omit<EditorOptions, 'element'> & {
  /** Called right after the instance is created. */
  onCreate?: (editor: Editor) => void;
  /** Called before the instance is destroyed. */
  onDestroy?: (editor: Editor) => void;
};

export interface UseEditorResult {
  /** Callback ref for the container: `<div ref={ref} />`. */
  ref: (element: HTMLElement | null) => void;
  /** The editor instance; `null` before mounting and on the server. */
  editor: Editor | null;
  /**
   * React node views (reactNodeView): render them next to the container — `<div ref={ref} />
   * {nodeViews}`. View components get the context of the place where this element is rendered.
   */
  nodeViews: ReactNode;
}

/**
 * Creates the editor in the container `ref` is attached to and destroys it on unmount.
 *
 * Options are read when the editor is created. Callbacks (`onChange`, `onCreate`, `onDestroy`) are
 * always the latest ones, so arrow functions are fine. To recreate the editor with new options,
 * pass `deps` (as with `useEffect`).
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
    // onDestroy isn't passed to the core: we call it ourselves in the cleanup, always fresh from optionsRef.
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
