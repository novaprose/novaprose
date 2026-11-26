import type { Command, EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { CommandName } from './commands';

/**
 * A command chain: several steps as one edit (one undo step, one change event).
 *
 *   editor.chain().exec('h2').exec('alignCenter').run();
 *   editor.chain().insertContent('<p>Note</p>').exec(setStyle('color', '#e03e2d')).run();
 *
 * Steps work on a shared transaction: each sees the document and the selection after the previous
 * ones (like chains in other ProseMirror editors). The difference is all-or-nothing: if a step
 * fails, the document doesn't change and run() returns false. can() checks the chain honestly: the
 * steps run on a draft transaction that is never applied.
 */

/** Named commands for a chain: undo and redo only work on their own (editor.exec). */
export type ChainCommandName = Exclude<CommandName, 'undo' | 'redo'>;

export interface CommandChain {
  /** A step: a named command or a ProseMirror command (setStyle(…), applyLink(…), your own). */
  exec(command: ChainCommandName | Command): CommandChain;
  /** A step: insert HTML at the cursor, like editor.insertContent(). */
  insertContent(html: string): CommandChain;
  /** Run the steps as one edit. If a step fails, the document doesn't change and the result is false. */
  run(): boolean;
  /** Whether run() would succeed now (for buttons). The document doesn't change. */
  can(): boolean;
}

export interface ChainHost {
  /** The editor view; null when the editor is destroyed. */
  view(): EditorView | null;
  resolve(name: CommandName): Command;
  insertContent(html: string): Command;
}

/**
 * The state for a chain step: the document, the selection and stored marks come from the shared transaction,
 * and `state.tr` is that transaction. The rest (schema, plugins, their states) comes from the original state.
 */
function chainableState(state: EditorState, tr: Transaction): EditorState {
  let { selection, doc, storedMarks } = tr;
  return Object.create(state, {
    doc: { get: () => doc },
    selection: { get: () => selection },
    storedMarks: { get: () => storedMarks },
    tr: {
      get: () => {
        ({ selection, doc, storedMarks } = tr);
        return tr;
      },
    },
  }) as EditorState;
}

function warn(message: string): void {
  console.warn(`[nova] chain: ${message}`);
}

export function createChain(host: ChainHost): CommandChain {
  const steps: Command[] = [];

  const attempt = (apply: boolean): boolean => {
    const view = host.view();
    if (!view) return false;
    const { state } = view;
    const tr = state.tr;
    for (const step of steps) {
      let foreign = false;
      // A step changes the shared transaction (state.tr); dispatch here is only a sign of consent.
      const dispatch = (dispatched: Transaction) => {
        if (dispatched !== tr) foreign = true;
      };
      if (!step(chainableState(state, tr), dispatch, view)) return false;
      if (foreign) {
        // Its own transaction (view.state.tr) doesn't see the previous steps: they can't be mixed.
        warn('a command dispatched its own transaction; build it from state.tr');
        return false;
      }
    }
    if (apply) {
      view.dispatch(tr);
      view.focus();
    }
    return true;
  };

  const chain: CommandChain = {
    exec(command) {
      if (command === ('undo' as string) || command === ('redo' as string)) {
        warn(`"${command as string}" runs on its own — use editor.exec()`);
        steps.push(() => false);
      } else {
        steps.push(typeof command === 'string' ? host.resolve(command) : command);
      }
      return chain;
    },
    insertContent(html) {
      steps.push(host.insertContent(html));
      return chain;
    },
    run: () => attempt(true),
    can: () => attempt(false),
  };
  return chain;
}
