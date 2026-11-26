import {
  defineNodeView,
  type Editor,
  type NodeViewFactory,
  type NodeViewOptions,
  type NodeViewProps,
} from '@novaprose/core';
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ComponentType,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  type ReactPortal,
} from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * Виды узлов на React. Компонент рисуется порталом внутри вашего дерева (у <NovaProseEditor> или
 * {nodeViews} из useEditor) — ему доступен контекст приложения: тема, переводы, хранилище.
 *
 *   function Callout({ node, updateAttributes }: NodeViewProps) {
 *     return <div className="callout"><NodeViewContent /></div>;
 *   }
 *   definePlugin({ name: 'callout', nodes: { callout: {…} }, nodeViews: { callout: reactNodeView(Callout) } });
 */

/** Порталы видов узлов одного редактора. */
export class NodeViewPortals {
  /** Хост порталов отрисован (иначе виды не появятся — предупреждаем). */
  mounted = false;
  private readonly portals = new Map<string, ReactPortal>();
  private snapshot: ReactPortal[] = [];
  private readonly listeners = new Set<() => void>();

  set(key: string, portal: ReactPortal): void {
    this.portals.set(key, portal);
    this.emit();
  }

  delete(key: string): void {
    if (this.portals.delete(key)) this.emit();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): ReactPortal[] => this.snapshot;

  private emit(): void {
    this.snapshot = [...this.portals.values()];
    this.listeners.forEach((listener) => listener());
  }
}

const hosts = new WeakMap<Editor, NodeViewPortals>();
/** Порталы редактора, который создаётся прямо сейчас (виды узлов строятся внутри createEditor). */
let creating: NodeViewPortals | null = null;

/** Создать редактор так, чтобы его виды узлов рисовались порталами в `portals`. */
export function createWithPortals(portals: NodeViewPortals, create: () => Editor): Editor {
  creating = portals;
  try {
    const editor = create();
    hosts.set(editor, portals);
    return editor;
  } finally {
    creating = null;
  }
}

/** Рисует порталы видов узлов; useEditor отдаёт его как `nodeViews`. */
export function NodeViewHost({ portals }: { portals: NodeViewPortals }): ReactNode {
  useIsomorphicLayoutEffect(() => {
    portals.mounted = true;
    return () => {
      portals.mounted = false;
    };
  }, [portals]);
  return useSyncExternalStore(portals.subscribe, portals.getSnapshot, portals.getSnapshot);
}

const NodeViewContext = createContext<NodeViewProps | null>(null);

/** Node view props in nested components (the same as the view component's). */
export function useNodeView(): NodeViewProps {
  const props = useContext(NodeViewContext);
  if (!props) throw new Error('[nova] useNodeView() works only inside a node view component');
  return props;
}

export type NodeViewContentProps = HTMLAttributes<HTMLElement> & {
  /** Tag of the content wrapper (div by default; span for inline nodes). */
  as?: ElementType;
};

/** Where the node's editable content goes in the component's markup. */
export function NodeViewContent({ as, ...rest }: NodeViewContentProps): ReactNode {
  const props = useContext(NodeViewContext);
  const contentDOM = props?.contentDOM ?? null;
  const Tag = as ?? (props?.node.isInline ? 'span' : 'div');
  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (element && contentDOM && contentDOM.parentElement !== element) element.append(contentDOM);
    },
    [contentDOM],
  );
  return <Tag {...rest} ref={ref} data-node-view-content="" />;
}

let counter = 0;
let warned = false;

/** A node view from a React component, for a plugin's `nodeViews`. */
export function reactNodeView(
  Component: ComponentType<NodeViewProps>,
  options?: NodeViewOptions,
): NodeViewFactory {
  return defineNodeView((editor) => {
    const portals = hosts.get(editor) ?? creating;
    const key = `nova-node-view-${++counter}`;
    let dom: HTMLElement;
    // Редактор создан без обёртки NovaProse (createEditor напрямую) — свой корень React.
    let root: Root | null = null;

    const render = (props: NodeViewProps) => {
      const element = (
        <NodeViewContext.Provider value={props}>
          <Component {...props} />
        </NodeViewContext.Provider>
      );
      if (portals) portals.set(key, createPortal(element, dom, key));
      else (root ??= createRoot(dom)).render(element);
    };

    return {
      mount(target, props) {
        dom = target;
        render(props);
        if (portals && !warned)
          queueMicrotask(() => {
            if (portals.mounted || warned) return;
            warned = true;
            console.warn(
              '[nova] reactNodeView: render {nodeViews} from useEditor() next to the editor, or node views stay empty',
            );
          });
      },
      update: render,
      destroy() {
        portals?.delete(key);
        const current = root;
        root = null;
        // Размонтировать корень посреди отрисовки React нельзя — после неё.
        if (current) setTimeout(() => current.unmount());
      },
    };
  }, options);
}
