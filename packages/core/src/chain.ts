import type { Command, EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { CommandName } from './commands';

/**
 * Цепочка команд: несколько шагов — одна правка (одно действие отмены, одно событие change).
 *
 *   editor.chain().exec('h2').exec('alignCenter').run();
 *   editor.chain().insertContent('<p>Note</p>').exec(setStyle('color', '#e03e2d')).run();
 *
 * Шаги работают с общей транзакцией: каждый видит документ и выделение после предыдущих (как
 * цепочки в других редакторах на ProseMirror). Отличие — «всё или ничего»: шаг не удался —
 * документ не меняется, run() возвращает false. can() проверяет цепочку честно: шаги выполняются
 * на черновике транзакции, который не применяется.
 */

/** Именованные команды для цепочки: отмена и повтор работают только отдельно (editor.exec). */
export type ChainCommandName = Exclude<CommandName, 'undo' | 'redo'>;

export interface CommandChain {
  /** Шаг — именованная команда или команда ProseMirror (setStyle(…), applyLink(…), своя). */
  exec(command: ChainCommandName | Command): CommandChain;
  /** Шаг — вставить HTML в позицию курсора, как editor.insertContent(). */
  insertContent(html: string): CommandChain;
  /** Выполнить шаги одной правкой. Шаг не удался — документ не меняется, ответ false. */
  run(): boolean;
  /** Получится ли run() сейчас (для кнопок). Документ не меняется. */
  can(): boolean;
}

export interface ChainHost {
  /** Представление редактора; null — редактор уничтожен. */
  view(): EditorView | null;
  resolve(name: CommandName): Command;
  insertContent(html: string): Command;
}

/**
 * Состояние для шага цепочки: документ, выделение и сохранённые марки — из общей транзакции,
 * `state.tr` — она сама. Остальное (схема, плагины, их состояния) — от исходного состояния.
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
      // Шаг меняет общую транзакцию (state.tr); dispatch здесь — только знак согласия.
      const dispatch = (dispatched: Transaction) => {
        if (dispatched !== tr) foreign = true;
      };
      if (!step(chainableState(state, tr), dispatch, view)) return false;
      if (foreign) {
        // Своя транзакция (view.state.tr) не видит предыдущих шагов — смешать нельзя.
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
