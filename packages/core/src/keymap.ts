import { baseKeymap, chainCommands, exitCode } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { splitListItem } from 'prosemirror-schema-list';
import type { Command, Plugin } from 'prosemirror-state';
import { commands, listIndent, listOutdent, nodesOf, type CommandName } from './commands';
import { exitImageCaption } from './image';

const mac = typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

const insertHardBreak: Command = chainCommands(exitCode, (state, dispatch) => {
  dispatch?.(state.tr.replaceSelectionWith(nodesOf(state).hard_break.create()).scrollIntoView());
  return true;
});

/** Горячие клавиши в духе Word / Google Docs. Mod = Cmd на macOS, Ctrl на остальных. */
/** Команда по имени — с учётом переопределений плагинов (см. Editor.resolveCommand). */
type Resolve = (name: CommandName) => Command;
const byName =
  (resolve: Resolve, name: CommandName): Command =>
  (state, dispatch, view) =>
    resolve(name)(state, dispatch, view);

export function buildKeymap(resolve: Resolve = (name) => commands[name]): Plugin[] {
  const keys: Record<string, Command> = {
    'Mod-z': byName(resolve, 'undo'),
    'Shift-Mod-z': byName(resolve, 'redo'),
    'Mod-b': commands.bold,
    'Mod-i': commands.italic,
    'Mod-u': commands.underline,
    'Mod-Shift-x': commands.strike,
    'Mod-e': commands.code,
    'Mod-,': commands.subscript,
    'Mod-.': commands.superscript,
    'Mod-Alt-0': commands.paragraph,
    'Mod-Alt-1': commands.h1,
    'Mod-Alt-2': commands.h2,
    'Mod-Alt-3': commands.h3,
    'Mod-Alt-4': commands.h4,
    'Mod-Alt-5': commands.h5,
    'Mod-Alt-6': commands.h6,
    'Mod-Shift-7': commands.orderedList,
    'Mod-Shift-8': commands.bulletList,
    'Mod-Shift-l': commands.alignLeft,
    'Mod-Shift-e': commands.alignCenter,
    'Mod-Shift-r': commands.alignRight,
    'Mod-Shift-j': commands.alignJustify,
    'Mod-\\': commands.clearFormatting,
    'Shift-Enter': insertHardBreak,
    Enter: chainCommands(exitImageCaption, (state, dispatch) =>
      splitListItem(nodesOf(state).list_item)(state, dispatch),
    ),
    // Tab — только для списков (в абзаце остаётся переходом фокуса). Отступ абзаца — Mod-] / Mod-[.
    Tab: listIndent,
    'Shift-Tab': listOutdent,
    'Mod-]': commands.indent,
    'Mod-[': commands.outdent,
  };
  if (!mac) keys['Mod-y'] = byName(resolve, 'redo');
  return [keymap(keys), keymap(baseKeymap)];
}
