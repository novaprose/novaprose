import { Plugin, TextSelection, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { CommandName } from './commands';
import type { Editor } from './editor';

/**
 * Your own typing shortcuts (`textPatterns: [...]`), in place of the built-in ones. Three kinds:
 *  - at the start of a block: `{ start: '#', format: 'h1' }`, `{ start: '1.', command: 'orderedList' }`
 *    — when a space follows the start (or Enter, `trigger: 'enter'`);
 *  - between two markers: `{ start: '*', end: '*', format: 'italic' }` — when the end marker is typed
 *    and a space or Enter follows it;
 *  - a replacement: `{ start: '(c)', replacement: '©' }` — when a space or Enter follows it.
 * `format` is a format registered with `formats` (`editor.formatter`) or a built-in one: bold, italic,
 * underline, strikethrough, code, subscript, superscript, p, h1–h6, blockquote, pre. `command` is a
 * named command or a function that gets the editor and `value`.
 */
export type TextPattern = InlinePattern | BlockPattern | ReplacementPattern;

/** A command a pattern runs: a named one, or your own function. */
export type TextPatternCommand = CommandName | ((editor: Editor, value?: unknown) => void);

export interface InlinePattern {
  start: string;
  end: string;
  format?: string;
  command?: TextPatternCommand;
  value?: unknown;
}

export interface BlockPattern {
  start: string;
  format?: string;
  command?: TextPatternCommand;
  value?: unknown;
  /** What completes the pattern: a space after it (default) or Enter at the end of the block. */
  trigger?: 'space' | 'enter';
}

export interface ReplacementPattern {
  start: string;
  replacement: string;
}

/** What `textPatternsLookup` gets on every attempt: the block's text before the cursor and its element. */
export interface TextPatternContext {
  text: string;
  block: HTMLElement | null;
}

/** Built-in format names and the commands that make them. */
const FORMATS: Record<string, CommandName> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strike',
  strike: 'strike',
  code: 'code',
  subscript: 'subscript',
  superscript: 'superscript',
  p: 'paragraph',
  paragraph: 'paragraph',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  blockquote: 'blockquote',
  pre: 'codeBlock',
};

/** Patterns from options can be anything: only well-formed ones are kept. */
function clean(list: readonly unknown[]): TextPattern[] {
  const out: TextPattern[] = [];
  for (const raw of list) {
    const p = raw as Partial<InlinePattern & BlockPattern & ReplacementPattern> | null;
    if (!p || typeof p.start !== 'string' || !p.start || p.start.length > 40) continue;
    if (typeof p.replacement === 'string') out.push({ start: p.start, replacement: p.replacement });
    else if (typeof p.format !== 'string' && !p.command) continue;
    else if (typeof p.end === 'string' && p.end) out.push(p as InlinePattern);
    else out.push(p as BlockPattern);
  }
  // The longest first: "**" before "*".
  return out.sort((a, b) => b.start.length - a.start.length);
}

/** The block's text before the cursor, one character for each non-text node (positions stay exact). */
function textBefore(state: EditorState): string | null {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  if ($from.marks().some((m) => m.type.spec.code)) return null;
  return $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
}

/** Runs a pattern's format or command on the current selection. */
function run(editor: Editor, pattern: InlinePattern | BlockPattern): void {
  const { format, command, value } = pattern;
  if (typeof command === 'function') command(editor, value);
  else if (typeof command === 'string') editor.exec(command);
  else if (format && editor.formatter.has(format)) editor.formatter.apply(format);
  else if (format && FORMATS[format]) editor.exec(FORMATS[format]);
}

export function textPatternsPlugin(
  editor: Editor,
  patterns: readonly unknown[],
  lookup?: (context: TextPatternContext) => unknown[],
): Plugin {
  const fixed = clean(patterns);
  const all = (view: EditorView, text: string): TextPattern[] => {
    if (!lookup) return fixed;
    const { $from } = view.state.selection;
    const dom = view.nodeDOM($from.before());
    let extra: unknown = [];
    try {
      extra = lookup({ text, block: dom instanceof HTMLElement ? dom : null });
    } catch (error) {
      console.error('[nova] textPatternsLookup failed:', error);
    }
    return Array.isArray(extra) ? clean([...fixed, ...extra]) : fixed;
  };

  /** Tries the patterns at the cursor: the kind of the one applied, or null. */
  const attempt = (
    view: EditorView,
    trigger: 'space' | 'enter',
  ): 'block' | 'inline' | 'replacement' | null => {
    const text = textBefore(view.state);
    if (text === null || !editor.isEditable()) return null;
    const { $from } = view.state.selection;
    const start = $from.start();
    for (const pattern of all(view, text)) {
      if ('replacement' in pattern) {
        if (!text.endsWith(pattern.start)) continue;
        const from = $from.pos - pattern.start.length;
        if (/<[a-z]/i.test(pattern.replacement)) {
          // HTML: put in through the schema, like any inserted content.
          view.dispatch(view.state.tr.delete(from, $from.pos));
          editor.insertContent(pattern.replacement);
          // Its formatting doesn't go on into the text typed next.
          view.dispatch(view.state.tr.setStoredMarks([]));
        } else view.dispatch(view.state.tr.insertText(pattern.replacement, from, $from.pos));
        return 'replacement';
      }
      if ('end' in pattern) {
        if (!text.endsWith(pattern.end)) continue;
        const inner = text.lastIndexOf(pattern.start, text.length - pattern.end.length - 1);
        const contentStart = inner + pattern.start.length;
        const contentEnd = text.length - pattern.end.length;
        // Something between the markers, not starting or ending with a space ("2 * 3 * 4" stays).
        if (inner < 0 || contentEnd <= contentStart) continue;
        if (/^\s|\s$/.test(text.slice(contentStart, contentEnd))) continue;
        const tr = view.state.tr
          .delete(start + contentEnd, start + text.length)
          .delete(start + inner, start + contentStart);
        const from = start + inner;
        const to = from + (contentEnd - contentStart);
        view.dispatch(tr.setSelection(TextSelection.create(tr.doc, from, to)));
        run(editor, pattern);
        const { state } = view;
        view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, state.selection.to)));
        // The format doesn't go on into the text typed next.
        view.dispatch(view.state.tr.setStoredMarks([]));
        return 'inline';
      }
      if ((pattern.trigger ?? 'space') !== trigger) continue;
      // Space: the block's text before the cursor is the start; Enter: the block starts with it.
      const matches =
        trigger === 'space'
          ? text === pattern.start
          : $from.parent.textContent.startsWith(pattern.start) &&
            $from.parentOffset === $from.parent.content.size;
      if (!matches) continue;
      view.dispatch(view.state.tr.delete(start, start + pattern.start.length));
      run(editor, pattern);
      return 'block';
    }
    return null;
  };

  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (text !== ' ' || from !== to) return false;
        // A block pattern takes the space (the start and the space go); the others keep it.
        const kind = attempt(view, 'space');
        if (!kind) return false;
        if (kind !== 'block') view.dispatch(view.state.tr.insertText(' '));
        return true;
      },
      handleKeyDown(view, event) {
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey) return false;
        // The pattern is applied, then Enter goes on as usual (a new line).
        attempt(view, 'enter');
        return false;
      },
    },
  });
}
