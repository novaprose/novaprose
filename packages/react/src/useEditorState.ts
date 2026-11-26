import type { CommandName, Editor, EditorEvent } from '@novaprose/core';
import { useCallback, useRef, useSyncExternalStore } from 'react';

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
 * Subscribe to the editor's state for your own UI (headless mode). The component re-renders only
 * when the result of `selector` changes by `isEqual` (shallow comparison by default).
 *
 * ```tsx
 * const { bold, canUndo } = useEditorState(editor, (e) => ({
 *   bold: e.isActive('bold'),
 *   canUndo: e.can('undo'),
 * }));
 * ```
 */
export function useEditorState<T>(
  editor: Editor | null,
  selector: (editor: Editor) => T,
  isEqual: (a: T, b: T) => boolean = shallowEqual,
): T | undefined {
  const versionRef = useRef(0);
  const cacheRef = useRef<{ editor: Editor | null; version: number; value: T | undefined } | null>(
    null,
  );
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;

  const subscribe = useCallback(
    (notify: () => void) => {
      if (!editor) return () => {};
      const onEvent = () => {
        versionRef.current++;
        notify();
      };
      const offs = STATE_EVENTS.map((event) => editor.on(event, onEvent));
      return () => offs.forEach((off) => off());
    },
    [editor],
  );

  const getSnapshot = (): T | undefined => {
    const cache = cacheRef.current;
    if (cache && cache.editor === editor && cache.version === versionRef.current)
      return cache.value;
    const next = editor ? selectorRef.current(editor) : undefined;
    const value =
      cache &&
      cache.value !== undefined &&
      next !== undefined &&
      isEqualRef.current(cache.value, next)
        ? cache.value
        : next;
    cacheRef.current = { editor, version: versionRef.current, value };
    return value;
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}

export interface UseCommandResult {
  /** Run the command (returns `false` when there is no editor or the command doesn't apply). */
  run: () => boolean;
  /** Whether the command applies to the current selection. */
  enabled: boolean;
  /** Whether the command is active (for marks and nodes: the selection already has this format). */
  active: boolean;
}

/**
 * The state of a named command and a way to run it, for your own toolbar button.
 *
 * ```tsx
 * const bold = useCommand(editor, 'bold');
 * <button aria-pressed={bold.active} disabled={!bold.enabled} onClick={bold.run}>B</button>
 * ```
 */
export function useCommand(editor: Editor | null, command: CommandName): UseCommandResult {
  const state = useEditorState(editor, (e) => ({
    enabled: e.isEditable() && e.can(command),
    active: e.isActive(command),
  }));
  const run = useCallback(() => (editor ? editor.exec(command) : false), [editor, command]);
  return { run, enabled: state?.enabled ?? false, active: state?.active ?? false };
}
