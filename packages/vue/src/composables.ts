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

/** Опции композабла: всё из `EditorOptions`, кроме `element` — его даёт `el`. */
export type UseEditorOptions = Omit<EditorOptions, 'element'> & {
  /** Вызывается сразу после создания экземпляра. */
  onCreate?: (editor: Editor) => void;
  /** Вызывается перед уничтожением экземпляра. */
  onDestroy?: (editor: Editor) => void;
};

export interface UseEditorResult {
  /** Template ref для контейнера: `<div ref="el" />` (верните `el` из setup). */
  el: Ref<HTMLElement | null>;
  /** Экземпляр редактора; `null` до монтирования и на сервере. */
  editor: ShallowRef<Editor | null>;
  /**
   * Виды узлов на Vue (vueNodeView): отрисуйте рядом с контейнером — `<component :is="nodeViews" />`.
   * Компоненты видов получают provide/inject того места, где он стоит.
   */
  nodeViews: Component;
}

/**
 * Создаёт редактор в элементе `el`, когда он появляется в DOM, и уничтожает при размонтировании.
 * Опции читаются в момент создания. На сервере ничего не делает: watch с `flush: 'post'`
 * не срабатывает при SSR.
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

/** Поверхностное сравнение: подходит для селекторов вида `e => ({ bold: ..., italic: ... })`. */
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
 * Реактивное состояние редактора для своего UI. Значение обновляется только когда результат
 * `selector` изменился по `isEqual` (по умолчанию — поверхностное сравнение).
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
  /** Применима ли команда в текущем выделении. */
  enabled: ComputedRef<boolean>;
  /** Активна ли команда (выделение уже в этом формате). */
  active: ComputedRef<boolean>;
  /** Выполнить команду (`false`, если редактора нет или команда неприменима). */
  run: () => boolean;
}

/**
 * Состояние и запуск именованной команды — для своей кнопки тулбара.
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
