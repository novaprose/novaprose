import {
  defineNodeView,
  type Editor,
  type NodeViewFactory,
  type NodeViewOptions,
  type NodeViewProps,
} from '@novaprose/core';
import {
  defineComponent,
  h,
  inject,
  markRaw,
  onBeforeUnmount,
  onMounted,
  provide,
  render,
  shallowRef,
  Teleport,
  watch,
  type Component,
  type InjectionKey,
  type PropType,
  type ShallowRef,
} from 'vue';

/**
 * Vue node views. The component renders through Teleport inside your app (in <NovaProseEditor>, or in
 * <component :is="nodeViews" /> from useEditor), so provide/inject, the router, translations and
 * stores are available to it.
 *
 *   const Callout = defineComponent({ props: nodeViewProps, setup(props) { … h(NodeViewContent) … } });
 *   definePlugin({ name: 'callout', nodes: { callout: {…} }, nodeViews: { callout: vueNodeView(Callout) } });
 */

/** Node view props for a component's `props` (like the core's NodeViewProps). */
export const nodeViewProps = {
  editor: { type: Object as PropType<Editor>, required: true },
  node: { type: Object as PropType<NodeViewProps['node']>, required: true },
  selected: { type: Boolean, required: true },
  getPos: { type: Function as PropType<NodeViewProps['getPos']>, required: true },
  updateAttributes: {
    type: Function as PropType<NodeViewProps['updateAttributes']>,
    required: true,
  },
  deleteNode: { type: Function as PropType<NodeViewProps['deleteNode']>, required: true },
  contentDOM: { type: Object as PropType<HTMLElement | null>, default: null },
} as const;

interface Item {
  key: string;
  dom: HTMLElement;
  component: Component;
  props: NodeViewProps;
}

/** The node views of one editor that the host renders. */
export class NodeViewTeleports {
  /** The host is rendered (otherwise the views never appear, so we warn). */
  mounted = false;
  readonly items: ShallowRef<Item[]> = shallowRef([]);
  private readonly map = new Map<string, Item>();

  set(item: Item): void {
    this.map.set(item.key, item);
    this.items.value = [...this.map.values()];
  }

  delete(key: string): void {
    if (this.map.delete(key)) this.items.value = [...this.map.values()];
  }
}

const hosts = new WeakMap<Editor, NodeViewTeleports>();
/** Views of the editor being created right now (node views are built inside createEditor). */
let creating: NodeViewTeleports | null = null;

/** Creates an editor whose node views are rendered by the `teleports` host. */
export function createWithTeleports(teleports: NodeViewTeleports, create: () => Editor): Editor {
  creating = teleports;
  try {
    const editor = create();
    hosts.set(editor, teleports);
    return editor;
  } finally {
    creating = null;
  }
}

const NODE_VIEW: InjectionKey<ShallowRef<NodeViewProps>> = Symbol('nova-node-view');

/** Node view props in nested components. */
export function useNodeView(): Readonly<ShallowRef<NodeViewProps>> {
  const props = inject(NODE_VIEW, null);
  if (!props) throw new Error('[nova] useNodeView() works only inside a node view component');
  return props;
}

/** Only the props the component declares: the rest would land as attributes on its root. */
function declaredProps(component: Component, props: NodeViewProps): Record<string, unknown> {
  const declared = (component as { props?: string[] | Record<string, unknown> }).props;
  if (!declared) return {};
  const names = Array.isArray(declared) ? declared : Object.keys(declared);
  return Object.fromEntries(
    names.filter((name) => name in props).map((name) => [name, props[name as keyof NodeViewProps]]),
  );
}

/** Passes the view's props to nested components and renders the component itself. */
const NodeViewProvider = defineComponent({
  name: 'NovaNodeView',
  props: {
    component: { type: [Object, Function] as PropType<Component>, required: true },
    view: { type: Object as PropType<NodeViewProps>, required: true },
  },
  setup(props) {
    const current = shallowRef(props.view);
    watch(
      () => props.view,
      (view) => {
        current.value = view;
      },
    );
    provide(NODE_VIEW, current);
    return () => h(props.component, declaredProps(props.component, current.value));
  },
});

/** The node view host: useEditor returns it as `nodeViews`. */
export const NodeViewHost = defineComponent({
  name: 'NovaNodeViews',
  props: { teleports: { type: Object as PropType<NodeViewTeleports>, required: true } },
  setup(props) {
    onMounted(() => {
      props.teleports.mounted = true;
    });
    onBeforeUnmount(() => {
      props.teleports.mounted = false;
    });
    return () =>
      props.teleports.items.value.map((item) =>
        h(Teleport, { to: item.dom, key: item.key }, [
          h(NodeViewProvider, { component: item.component, view: item.props }),
        ]),
      );
  },
});

/** Where the node's editable content goes in the component's markup. */
export const NodeViewContent = defineComponent({
  name: 'NodeViewContent',
  props: {
    /** Tag of the content wrapper (div by default; span for inline nodes). */
    as: { type: String, default: undefined },
  },
  setup(props) {
    const view = inject(NODE_VIEW, null);
    const place = (element: unknown) => {
      const contentDOM = view?.value.contentDOM;
      if (element instanceof HTMLElement && contentDOM && contentDOM.parentElement !== element)
        element.append(contentDOM);
    };
    return () =>
      h(props.as ?? (view?.value.node.isInline ? 'span' : 'div'), {
        ref: place,
        'data-node-view-content': '',
      });
  },
});

let counter = 0;
let warned = false;

/** A node view from a Vue component, for a plugin's `nodeViews`. */
export function vueNodeView(component: Component, options?: NodeViewOptions): NodeViewFactory {
  const raw = markRaw(component);
  return defineNodeView((editor) => {
    const teleports = hosts.get(editor) ?? creating;
    const key = `nova-node-view-${++counter}`;
    let dom: HTMLElement;

    const show = (props: NodeViewProps) => {
      if (teleports) {
        teleports.set({ key, dom, component: raw, props });
        return;
      }
      // The editor was created without a NovaProse wrapper (createEditor directly): its own Vue root.
      render(h(NodeViewProvider, { component: raw, view: props }), dom);
    };

    return {
      mount(target, props) {
        dom = target;
        show(props);
        if (teleports && !warned)
          setTimeout(() => {
            if (teleports.mounted || warned) return;
            warned = true;
            console.warn(
              '[nova] vueNodeView: render <component :is="nodeViews" /> from useEditor() next to the editor, or node views stay empty',
            );
          });
      },
      update: show,
      destroy() {
        if (teleports) teleports.delete(key);
        else render(null, dom);
      },
    };
  }, options);
}
