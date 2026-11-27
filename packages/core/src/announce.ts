import { Plugin, PluginKey, type Command, type EditorState } from 'prosemirror-state';
import { commands, isCommandActive, type CommandName } from './commands';
import type { MessageKey } from './i18n/en';
import type { Translator } from './i18n';

/**
 * Spoken feedback for changes a sighted person sees at once but a screen reader doesn't report by itself:
 * a format switched with a shortcut (Ctrl+B says "Bold on") and a Markdown shortcut that turned the line
 * into something else (typing "- " says "Bulleted list"). The text goes to the editor's hidden polite
 * live region (editor.ui.announce), so focus and the caret stay where they are.
 */

type Spoken = { command: CommandName } | { typed: true };

/** Transaction meta: the named command ran from a keyboard shortcut. */
export const announceKey = new PluginKey<Spoken | null>('nova-announce');

/** A shortcut whose result is spoken: its transaction carries the command's name. */
export function spokenCommand(name: CommandName): Command {
  return (state, dispatch, view) =>
    commands[name](state, dispatch && ((tr) => dispatch(tr.setMeta(announceKey, name))), view);
}

/** Formats with an on/off state: the line says which. */
const TOGGLES: ReadonlySet<CommandName> = new Set<CommandName>([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'subscript',
  'superscript',
  'bulletList',
  'orderedList',
]);
const BLOCK_TYPES: ReadonlySet<CommandName> = new Set<CommandName>([
  'paragraph',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);
const ALIGNMENTS: readonly CommandName[] = [
  'alignLeft',
  'alignCenter',
  'alignRight',
  'alignJustify',
];

/** The structure around the cursor, outermost first, as label keys: lists, quotes, headings, code. */
function blockKeys(state: EditorState): MessageKey[] {
  const { $from } = state.selection;
  const keys: MessageKey[] = [];
  for (let depth = 1; depth <= $from.depth; depth++) {
    const node = $from.node(depth);
    const name = node.type.name;
    if (name === 'bullet_list') keys.push('bulletList');
    else if (name === 'ordered_list') keys.push('orderedList');
    else if (name === 'blockquote') keys.push('blockquote');
    else if (name === 'code_block') keys.push('codeBlock');
    else if (name === 'heading')
      keys.push(`h${Math.min(6, Math.max(1, Number(node.attrs.level) || 1))}` as MessageKey);
  }
  return keys;
}

/** What a shortcut changed, in words. */
export function describeCommand(state: EditorState, command: CommandName, t: Translator): string {
  if (TOGGLES.has(command)) {
    return t(isCommandActive(state, command) ? 'announce.on' : 'announce.off', {
      name: t(command as MessageKey),
    });
  }
  if (BLOCK_TYPES.has(command)) {
    const heading = blockKeys(state)
      .filter((key) => /^h[1-6]$/.test(key))
      .pop();
    return t(heading ?? 'paragraph');
  }
  if (ALIGNMENTS.includes(command)) {
    return t(ALIGNMENTS.find((align) => isCommandActive(state, align)) ?? 'alignLeft');
  }
  return t(command as MessageKey);
}

/** What a typed Markdown shortcut turned the line into, or null when the structure didn't change ("..." → "…"). */
export function describeTyped(
  before: EditorState,
  after: EditorState,
  t: Translator,
): string | null {
  const old = blockKeys(before);
  const now = blockKeys(after);
  const changed = now.findIndex((key, i) => key !== old[i]);
  return changed < 0 ? null : t(now[changed]!);
}

/** Watches transactions and says what changed. `say` writes to the live region. */
export function announcePlugin(t: Translator, say: (text: string) => void): Plugin<Spoken | null> {
  return new Plugin<Spoken | null>({
    key: announceKey,
    state: {
      init: () => null,
      apply(tr, _value, _old, state) {
        const command = tr.getMeta(announceKey) as CommandName | undefined;
        if (command) return { command };
        // Markdown shortcuts come from input-rule plugins (ours and plugins'): their transactions carry the plugin as meta.
        if (state.plugins.some((plugin) => plugin.spec.isInputRules && tr.getMeta(plugin)))
          return { typed: true };
        return null;
      },
    },
    view: () => ({
      update(view, prevState) {
        const spoken = announceKey.getState(view.state);
        if (!spoken || spoken === announceKey.getState(prevState)) return;
        const text =
          'command' in spoken
            ? describeCommand(view.state, spoken.command, t)
            : describeTyped(prevState, view.state, t);
        if (text) say(text);
      },
    }),
  });
}
