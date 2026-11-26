import {
  createEditor,
  type CommandName,
  type Editor,
  type EditorEvent,
  type EditorOptions,
} from '@novaprose/core';
import {
  computed,
  defineComponent,
  h,
  markRaw,
  onBeforeUnmount,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  type Component,
  type ShallowRef,
} from 'vue';
import { createWithTeleports, NodeViewHost, NodeViewTeleports } from './nodeViews';

/** Composable options: everything from `EditorOptions` except `element`, which `el` provides. */
export type UseEditorOptions = Omit<EditorOptions, 'element'> & {
  /** Called right after the instance is created. */
  onCreate?: (editor: Editor) => void;
  /** Called before the instance is destroyed. */
  onDestroy?: (editor: Editor) => void;
};

export interface UseEditorResult {
  /** Template ref for the container: `<div ref="el" />` (return `el` from setup). */
  el: Ref<HTMLElement | null>;
  /** The editor instance; `null` before mounting and on the server. */
  editor: ShallowRef<Editor | null>;
  /**
   * Vue node views (vueNodeView): render them next to the container — `<component :is="nodeViews" />`.
   * View components get the provide/inject of the place where it is rendered.
   */
  nodeViews: Component;
}

/**
 * Creates the editor in the `el` element when it appears in the DOM and destroys it on unmount.
 * Options are read when the editor is created. Does nothing on the server: a watch with
 * `flush: 'post'` doesn't run during SSR.
 */
export function useEditor(options: UseEditorOptions = {}): UseEditorResult {
  const el = shallowRef<HTMLElement | null>(null);
  const editor = shallowRef<Editor | null>(null);
  const teleports = new NodeViewTeleports();

  const destroy = () => {
    const instance = editor.value;
    if (!instance) return;
    options.onDestroy?.(instance);
    instance.destroy();
    editor.value = null;
  };

  watch(
    el,
    (element) => {
      destroy();
      if (!element) return;
      const { onCreate, onDestroy, ...rest } = options;
      void onDestroy;
      const instance = createWithTeleports(teleports, () => createEditor({ ...rest, element }));
      editor.value = instance;
      onCreate?.(instance);
    },
    { flush: 'post' },
  );

  onBeforeUnmount(destroy);
  const nodeViews = markRaw(
    defineComponent({
      name: 'NovaNodeViewsHost',
      setup: () => () => h(NodeViewHost, { teleports }),
    }),
  );
  return { el, editor, nodeViews };
}

const STATE_EVENTS: EditorEvent[] = [
  'change',
  'selectionChange',
  'focus',
  'blur',
  'editableChange',
];

/** Shallow comparison: fits selectors like `e => ({ bold: ..., italic: ... })`. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * Reactive editor state for your own UI. The value updates only when the result of `selector`
 * changes by `isEqual` (shallow comparison by default).
 *
 * ```ts
 * const state = useEditorState(editor, (e) => ({ bold: e.isActive('bold'), canUndo: e.can('undo') }));
 * ```
 */
export function useEditorState<T>(
  editor: MaybeRefOrGetter<Editor | null>,
  selector: (editor: Editor) => T,
  isEqual: (a: T, b: T) => boolean = shallowEqual,
): Readonly<ShallowRef<T | undefined>> {
  const state = shallowRef<T | undefined>(undefined);

  const update = (instance: Editor | null) => {
    const next = instance ? selector(instance) : undefined;
    const prev = state.value;
    if (prev !== undefined && next !== undefined && isEqual(prev, next)) return;
    state.value = next;
  };

  const stop = watch(
    () => toValue(editor),
    (instance, _old, onCleanup) => {
      update(instance);
      if (!instance) return;
      const onEvent = () => update(instance);
      const offs = STATE_EVENTS.map((event) => instance.on(event, onEvent));
      onCleanup(() => offs.forEach((off) => off()));
    },
    { immediate: true },
  );
  onScopeDispose(stop);
  return state;
}

export interface UseCommandResult {
  /** Whether the command applies to the current selection. */
  enabled: ComputedRef<boolean>;
  /** Whether the command is active (the selection already has this format). */
  active: ComputedRef<boolean>;
  /** Run the command (`false` when there is no editor or the command doesn't apply). */
  run: () => boolean;
}

/**
 * The state of a named command and a way to run it, for your own toolbar button.
 *
 * ```vue
 * <button :aria-pressed="bold.active.value" :disabled="!bold.enabled.value" @click="bold.run">B</button>
 * ```
 */
export function useCommand(
  editor: MaybeRefOrGetter<Editor | null>,
  command: CommandName,
): UseCommandResult {
  const state = useEditorState(editor, (e) => ({
    enabled: e.isEditable() && e.can(command),
    active: e.isActive(command),
  }));
  return {
    enabled: computed(() => state.value?.enabled ?? false),
    active: computed(() => state.value?.active ?? false),
    run: () => toValue(editor)?.exec(command) ?? false,
  };
}
