import type { Mark, MarkType, Node as PMNode, NodeType } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { pickLabels } from './shared';

/**
 * The formatpainter plugin (named as in TinyMCE): copy the formatting of one place and apply it to
 * another.
 *
 * - The `formatpainter` button copies the formatting at the cursor; the next selection made with the
 *   mouse gets it, then the painter turns off. A double click keeps it on for several selections, until
 *   the button again or Escape.
 * - Keyboard: Ctrl+Alt+C (⌘⌥C on a Mac) copies, Ctrl+Alt+V (⌘⌥V) applies to the selection; repeat as
 *   often as needed.
 *
 * Copied: text formatting (bold, italic, underline, strikethrough, inline code, subscript, superscript,
 * text and background color, font, size, style classes) and the block's kind and layout (paragraph or
 * heading level, alignment, line height, indent). Links, comments and suggestions are not formatting:
 * they stay where they are. Block formatting is applied when the target is a cursor, several blocks or
 * a whole block; part of one block gets only the text formatting. A cursor in a word paints the word.
 */

export const LABELS = {
  en: {
    button: 'Format painter',
    copied: 'Format copied. Select the text to apply it to.',
    sticky: 'Format painter stays on. Press Escape to stop.',
    stored: 'Format copied',
    applied: 'Format applied',
    off: 'Format painter off',
  },
};

/** Marks that are formatting (copied and replaced); the rest (links, comments…) stay. */
const FORMAT_MARKS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'subscript',
  'superscript',
  'color',
  'background',
  'font_family',
  'font_size',
  'span_class',
];
/** Block attributes that are layout (copied with the block's kind). */
const BLOCK_ATTRS = ['align', 'lineHeight', 'indent'];

export interface CopiedFormat {
  marks: readonly Mark[];
  /** The source block's kind (paragraph, heading) and its layout attributes. */
  block: { type: NodeType; attrs: Record<string, unknown> } | null;
}

const formatMarkTypes = (state: EditorState): MarkType[] =>
  FORMAT_MARKS.flatMap((name) => state.schema.marks[name] ?? []);

const isFormatMark = (mark: Mark) => FORMAT_MARKS.includes(mark.type.name);

/** The formatting at the cursor, or of the first letter of the selection. */
export function copyFormat(state: EditorState): CopiedFormat {
  const { selection } = state;
  let marks: readonly Mark[] = selection.empty
    ? (state.storedMarks ?? selection.$from.marks())
    : [];
  if (!selection.empty) {
    state.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (node.isText && !marks.length) marks = node.marks;
      return !marks.length;
    });
  }
  const source = selection.$from.parent;
  const block =
    source.isTextblock && !source.type.spec.code
      ? {
          type: source.type,
          attrs: Object.fromEntries(
            Object.entries(source.attrs).filter(
              ([key]) => key === 'level' || BLOCK_ATTRS.includes(key),
            ),
          ),
        }
      : null;
  return { marks: marks.filter(isFormatMark), block };
}

/** The word at a cursor, or null. */
function wordAt(state: EditorState): { from: number; to: number } | null {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) return null;
  const text = $from.parent.textBetween(0, $from.parent.content.size, undefined, '￼');
  const word = /[\p{L}\p{N}\p{M}'’]/u;
  let start = $from.parentOffset;
  let end = start;
  while (start > 0 && word.test(text[start - 1]!)) start--;
  while (end < text.length && word.test(text[end]!)) end++;
  return start === end ? null : { from: $from.start() + start, to: $from.start() + end };
}

/** The block's new kind and attributes, or null when it can't take the copied kind here. */
function blockMarkup(
  tr: Transaction,
  pos: number,
  node: PMNode,
  block: NonNullable<CopiedFormat['block']>,
): { type: NodeType; attrs: Record<string, unknown> } {
  const $pos = tr.doc.resolve(pos);
  const index = $pos.index();
  const canChange = $pos.parent.canReplaceWith(index, index + 1, block.type);
  const type = canChange ? block.type : node.type;
  const attrs: Record<string, unknown> = {};
  for (const key of Object.keys(type.spec.attrs ?? {})) {
    attrs[key] =
      key in block.attrs && (key !== 'level' || canChange) ? block.attrs[key] : node.attrs[key];
  }
  return { type, attrs };
}

/** Applies a copied format to the selection; null when there is nothing to change. */
export function applyFormat(state: EditorState, format: CopiedFormat): Transaction | null {
  const { selection } = state;
  const tr = state.tr;
  const range = selection.empty ? wordAt(state) : { from: selection.from, to: selection.to };
  if (range) {
    for (const type of formatMarkTypes(state)) tr.removeMark(range.from, range.to, type);
    for (const mark of format.marks) tr.addMark(range.from, range.to, mark);
  } else if (selection.empty) {
    // An empty line: what is typed next gets the format.
    const keep = (state.storedMarks ?? selection.$from.marks()).filter((m) => !isFormatMark(m));
    tr.setStoredMarks([...keep, ...format.marks]);
  }
  const { $from, $to } = selection;
  const wholeBlock =
    $from.sameParent($to) &&
    $from.parentOffset === 0 &&
    $to.parentOffset === $to.parent.content.size;
  if (format.block && (selection.empty || !$from.sameParent($to) || wholeBlock)) {
    const block = format.block;
    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (!node.isTextblock) return true;
      if (node.type.spec.code) return false;
      const mapped = tr.mapping.map(pos);
      const { type, attrs } = blockMarkup(tr, mapped, node, block);
      const same =
        type === node.type && Object.keys(attrs).every((key) => attrs[key] === node.attrs[key]);
      if (!same) tr.setNodeMarkup(mapped, type, attrs, node.marks);
      return false;
    });
  }
  return tr.docChanged || tr.storedMarksSet ? tr.scrollIntoView() : null;
}

type Mode = 'off' | 'once' | 'sticky';

/** The painter of one editor: shared by its keys (created first) and its button. */
interface Painter {
  format: CopiedFormat | null;
  mode: Mode;
  armedAt: number;
}

const painters = new WeakMap<Editor, Painter>();

function painterOf(editor: Editor): Painter {
  let painter = painters.get(editor);
  if (!painter) {
    painter = { format: null, mode: 'off', armedAt: 0 };
    painters.set(editor, painter);
  }
  return painter;
}

function setMode(editor: Editor, mode: Mode): void {
  painterOf(editor).mode = mode;
  editor.view.dom.style.cursor = mode === 'off' ? '' : 'copy';
  editor.updateUI();
}

function paint(editor: Editor): boolean {
  const { format } = painterOf(editor);
  if (!format) return false;
  const tr = applyFormat(editor.view.state, format);
  if (tr) editor.view.dispatch(tr);
  editor.ui.announce(pickLabels(editor, 'formatpainter', LABELS).applied);
  return true;
}

export default definePlugin({
  name: 'formatpainter',
  toolbar: 'formatpainter',
  prosemirrorPlugins: (editor) => [
    keymap({
      'Mod-Alt-c': (state) => {
        painterOf(editor).format = copyFormat(state);
        editor.ui.announce(pickLabels(editor, 'formatpainter', LABELS).stored);
        return true;
      },
      'Mod-Alt-v': () => editor.isEditable() && paint(editor),
      Escape: () => {
        if (painterOf(editor).mode === 'off') return false;
        setMode(editor, 'off');
        editor.ui.announce(pickLabels(editor, 'formatpainter', LABELS).off);
        return true;
      },
    }),
  ],
  setup(editor: Editor) {
    const labels = pickLabels(editor, 'formatpainter', LABELS);
    const painter = painterOf(editor);

    const onMouseUp = () => {
      if (painter.mode === 'off') return;
      // After mouseup the browser still finishes the selection: let ProseMirror read it first.
      setTimeout(() => {
        if (painter.mode === 'off' || !editor.view.dom.isConnected) return;
        paint(editor);
        if (painter.mode === 'once') setMode(editor, 'off');
      }, 0);
    };
    editor.view.dom.addEventListener('mouseup', onMouseUp);

    /** On (copying the format at the cursor) or off. */
    const toggle = (e: Editor) => {
      if (painter.mode !== 'off') {
        setMode(e, 'off');
        e.ui.announce(labels.off);
      } else {
        painter.format = copyFormat(e.view.state);
        painter.armedAt = Date.now();
        setMode(e, 'once');
        e.ui.announce(labels.copied);
      }
      e.focus();
    };
    const isActive = () => painter.mode !== 'off';
    const isEnabled = (e: Editor) => e.isEditable();

    editor.ui.registry.addButton('formatpainter', {
      icon: icons.formatPainter,
      tooltip: labels.button,
      isActive,
      isEnabled,
      onAction: (e) => {
        if (painter.mode === 'once' && Date.now() - painter.armedAt < 500) {
          // The second click of a double click: keep painting.
          setMode(e, 'sticky');
          e.ui.announce(labels.sticky);
          e.focus();
        } else toggle(e);
      },
    });
    // The menu item (and mceToggleFormatPainter) is a plain on/off: a menu has no double click.
    editor.ui.registry.addMenuItem('formatpainter', {
      text: labels.button,
      icon: icons.formatPainter,
      isActive,
      isEnabled,
      onAction: toggle,
    });

    return () => {
      editor.view.dom.removeEventListener('mouseup', onMouseUp);
      painters.delete(editor);
    };
  },
});
