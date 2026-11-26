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
 * Node views in React. The component renders through a portal inside your tree (at <NovaProseEditor> or
 * {nodeViews} from useEditor), so it has the app context: theme, translations, store.
 *
 *   function Callout({ node, updateAttributes }: NodeViewProps) {
 *     return <div className="callout"><NodeViewContent /></div>;
 *   }
 *   definePlugin({ name: 'callout', nodes: { callout: {…} }, nodeViews: { callout: reactNodeView(Callout) } });
 */

/** The node view portals of one editor. */
export class NodeViewPortals {
  /** The portal host is rendered (otherwise the views never appear, so we warn). */
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
/** Portals of the editor being created right now (node views are built inside createEditor). */
let creating: NodeViewPortals | null = null;

/** Creates an editor whose node views render through portals in `portals`. */
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

/** Renders the node view portals; useEditor returns it as `nodeViews`. */
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
    // The editor was created without a NovaProse wrapper (createEditor directly): its own React root.
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
        // A root can't be unmounted in the middle of a React render, so it happens after it.
        if (current) setTimeout(() => current.unmount());
      },
    };
  }, options);
}
