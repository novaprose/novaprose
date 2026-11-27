import { baseKeymap, chainCommands, exitCode } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { splitListItem } from 'prosemirror-schema-list';
import type { Command, EditorState, Plugin } from 'prosemirror-state';
import { spokenCommand as spoken } from './announce';
import { commands, listIndent, listOutdent, nodesOf, type CommandName } from './commands';
import { exitImageCaption } from './image';

const mac = typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

const insertHardBreak: Command = chainCommands(exitCode, (state, dispatch) => {
  dispatch?.(state.tr.replaceSelectionWith(nodesOf(state).hard_break.create()).scrollIntoView());
  return true;
});

/** Keyboard shortcuts in the spirit of Word / Google Docs. Mod = Cmd on macOS, Ctrl elsewhere. */
/** A command by name, with plugin overrides applied (see Editor.resolveCommand). */
type Resolve = (name: CommandName) => Command;
const byName =
  (resolve: Resolve, name: CommandName): Command =>
  (state, dispatch, view) =>
    resolve(name)(state, dispatch, view);

export function buildKeymap(resolve: Resolve = (name) => commands[name]): Plugin[] {
  const keys: Record<string, Command> = {
    'Mod-z': byName(resolve, 'undo'),
    'Shift-Mod-z': byName(resolve, 'redo'),
    // Formatting shortcuts say what they did to screen readers ("Bold on", "Heading 2"): announce.ts.
    'Mod-b': spoken('bold'),
    'Mod-i': spoken('italic'),
    'Mod-u': spoken('underline'),
    'Mod-Shift-x': spoken('strike'),
    'Mod-e': spoken('code'),
    'Mod-,': spoken('subscript'),
    'Mod-.': spoken('superscript'),
    'Mod-Alt-0': spoken('paragraph'),
    'Mod-Alt-1': spoken('h1'),
    'Mod-Alt-2': spoken('h2'),
    'Mod-Alt-3': spoken('h3'),
    'Mod-Alt-4': spoken('h4'),
    'Mod-Alt-5': spoken('h5'),
    'Mod-Alt-6': spoken('h6'),
    'Mod-Shift-7': spoken('orderedList'),
    'Mod-Shift-8': spoken('bulletList'),
    'Mod-Shift-l': spoken('alignLeft'),
    'Mod-Shift-e': spoken('alignCenter'),
    'Mod-Shift-r': spoken('alignRight'),
    'Mod-Shift-j': spoken('alignJustify'),
    'Mod-\\': spoken('clearFormatting'),
    'Shift-Enter': insertHardBreak,
    Enter: chainCommands(exitImageCaption, (state, dispatch) => {
      // A new checklist item is unchecked (not a copy of a checked one and not a regular item).
      const item = parentListItem(state);
      const attrs = typeof item?.attrs.checked === 'boolean' ? { checked: false } : undefined;
      return splitListItem(nodesOf(state).list_item, attrs)(state, dispatch);
    }),
    // Tab is for lists only (in a paragraph it still moves focus). A paragraph indent is Mod-] / Mod-[.
    Tab: listIndent,
    'Shift-Tab': listOutdent,
    'Mod-]': commands.indent,
    'Mod-[': commands.outdent,
    // Move a block (a list item, a paragraph, a table), as in Word.
    'Alt-Shift-ArrowUp': commands.moveBlockUp,
    'Alt-Shift-ArrowDown': commands.moveBlockDown,
  };
  if (!mac) keys['Mod-y'] = byName(resolve, 'redo');
  return [keymap(keys), keymap(baseKeymap)];
}

/** The nearest list item around the cursor. */
function parentListItem(state: EditorState) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type === nodesOf(state).list_item) return node;
  }
  return null;
}
