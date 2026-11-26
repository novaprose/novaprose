import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h } from '../ui/dom';
import type { MenuEntry } from '../ui/menu';
import css from './ai.css?raw';
import { rangeText, suggestInsert, suggestRewrite } from './ai-edit';
import { pickLabels } from './shared';

/**
 * The ai plugin: an AI assistant whose edits arrive as suggestions, like a co-author's. Select text →
 * "Improve", "Shorter", your own request → the changed words appear as suggestions, each of which can be accepted
 * or rejected (the suggestions plugin). Without a selection, text at the cursor ("Continue").
 *
 * The model is yours: `pluginOptions.ai.request` sends the request to your server (an API key must never
 * live in the browser) and returns text or a stream of text chunks. `plugins: ['suggestions', 'ai']`.
 * Buttons as in TinyMCE: aidialog (the window) and aishortcuts (quick actions).
 */

export const LABELS = {
  en: {
    dialog: 'AI assistant',
    shortcuts: 'AI shortcuts',
    prompt: 'What should AI do?',
    placeholder: 'For example: make it more formal',
    send: 'Send',
    actions: 'Quick actions',
    writing: 'AI is writing…',
    done: 'AI suggested changes — review them in the text.',
    nothing: 'AI suggested no changes.',
    failed: 'The AI request failed.',
    notConfigured: 'AI is not connected to this editor.',
    improve: 'Improve writing',
    fix: 'Fix spelling and grammar',
    shorter: 'Make shorter',
    longer: 'Make longer',
    simplify: 'Simplify language',
    formal: 'Make it formal',
    friendly: 'Make it friendly',
    summarize: 'Summarize',
    continue: 'Continue writing',
    author: 'AI',
  },
};

export type AiAction =
  | 'improve'
  | 'fix'
  | 'shorter'
  | 'longer'
  | 'simplify'
  | 'formal'
  | 'friendly'
  | 'summarize'
  | 'continue'
  | 'custom';

export interface AiRequest {
  /** What to do — text for the model (for quick actions, a ready instruction in English). */
  instruction: string;
  /** The quick action, or custom for the user's own request. */
  action: AiAction;
  /** The selected text (paragraphs separated by a blank line); empty — the model writes at the cursor. */
  text: string;
  /** Text before and after the selection (up to 1,500 characters), for context. */
  before: string;
  after: string;
  /** The editor's UI language (for example, en). */
  language: string;
  /** Cancellation: the user closed the dialog. */
  signal: AbortSignal;
}

export interface AiOptions {
  /**
   * The request to the model through your server. Return the answer's text, or a stream of pieces
   * (AsyncIterable) to show it as it is written. The answer is plain text: paragraphs separated by a blank line.
   */
  request?: (request: AiRequest) => Promise<string> | AsyncIterable<string>;
  /** Author name on the suggestions ("AI" in the UI language by default). */
  name?: string;
}

/** Instructions of the quick actions for the model. */
export const INSTRUCTIONS: Record<Exclude<AiAction, 'custom'>, string> = {
  improve:
    'Improve the writing: make it clearer and more natural. Keep the meaning and the language.',
  fix: 'Fix spelling, grammar and punctuation. Change nothing else.',
  shorter: 'Make the text shorter. Keep the key points and the language.',
  longer: 'Make the text longer with relevant detail. Keep the style and the language.',
  simplify: 'Rewrite the text in plain, simple words. Keep the meaning and the language.',
  formal: 'Rewrite the text in a formal, professional tone. Keep the language.',
  friendly: 'Rewrite the text in a friendly, conversational tone. Keep the language.',
  summarize: 'Summarize the text in two or three sentences, in the same language.',
  continue:
    'Continue the text from where it ends: one or two paragraphs in the same style and language.',
};

/** Actions that need a selection (rewrite or summarize what is selected). */
const NEEDS_SELECTION: AiAction[] = [
  'improve',
  'fix',
  'shorter',
  'longer',
  'simplify',
  'formal',
  'friendly',
  'summarize',
];

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.94 14.06 4 20"/><path d="m15 4 1.2 2.8L19 8l-2.8 1.2L15 12l-1.2-2.8L11 8l2.8-1.2z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 15v4"/><path d="M17 17h4"/></svg>';

const CONTEXT = 1500;

function isIterable(value: unknown): value is AsyncIterable<string> {
  return !!value && typeof (value as AsyncIterable<string>)[Symbol.asyncIterator] === 'function';
}

/** Runs the request and applies the answer as suggestions; errors and cancelling leave the text unchanged. */
async function runAi(
  editor: Editor,
  action: AiAction,
  instruction: string,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<'done' | 'nothing'> {
  const options = (editor.options.pluginOptions?.ai ?? {}) as AiOptions;
  if (!options.request) throw new Error('not-configured');
  const labels = pickLabels(editor, 'ai', LABELS);
  const author = { id: 'ai', name: String(options.name || labels.author).slice(0, 80) };
  const { state } = editor.view;
  const { from: start, to: end, empty } = state.selection;
  // Selection positions are mapped through edits that arrive while the model writes (co-authors, autosave).
  let from = start;
  let to = end;
  const off = editor.on('change', (_e, { transaction }) => {
    from = transaction.mapping.map(from, -1);
    to = transaction.mapping.map(to, 1);
  });
  try {
    const doc = state.doc;
    const result = options.request({
      instruction,
      action,
      text: empty ? '' : rangeText(doc, start, end),
      before: doc.textBetween(Math.max(0, start - CONTEXT), start, '\n\n', ' '),
      after: doc.textBetween(end, Math.min(doc.content.size, end + CONTEXT), '\n\n', ' '),
      language: editor.options.language ?? 'en',
      signal,
    });
    let text = '';
    if (isIterable(result)) {
      for await (const chunk of result) {
        if (signal.aborted) break;
        text += String(chunk);
        onText(text);
      }
    } else {
      text = String((await result) ?? '');
      onText(text);
    }
    if (signal.aborted || !text.trim()) return 'nothing';
    const now = editor.view.state;
    let tr;
    if (action === 'summarize') {
      // A summary goes as a new paragraph after the selection.
      tr = suggestInsert(now, now.doc.resolve(to).end(), text, author, { newParagraph: true });
    } else if (empty || action === 'continue') {
      tr = suggestInsert(now, to, text, author);
    } else {
      tr = suggestRewrite(now, from, to, text, author);
    }
    if (!tr.docChanged) return 'nothing';
    editor.view.dispatch(tr.scrollIntoView());
    return 'done';
  } finally {
    off();
  }
}

/** The assistant window: your own request, quick actions, the answer as it is written. */
function openAiDialog(editor: Editor, preset?: AiAction): void {
  const labels = pickLabels(editor, 'ai', LABELS);
  const empty = editor.view.state.selection.empty;
  const controller = new AbortController();
  let running = false;

  const input = h('input', {
    type: 'text',
    className: 'nova-input',
    placeholder: labels.placeholder,
    'aria-label': labels.prompt,
  });
  const preview = h('output', {
    className: 'nova-ai-preview',
    'aria-live': 'polite',
  });
  preview.hidden = true;
  const actions = h('div', {
    className: 'nova-ai-actions',
    role: 'group',
    'aria-label': labels.actions,
  });
  const ids = Object.keys(INSTRUCTIONS) as Array<Exclude<AiAction, 'custom'>>;
  const available = (id: AiAction) => !(empty && NEEDS_SELECTION.includes(id));
  const buttons = ids.map((id) => {
    const button = h(
      'button',
      { type: 'button', className: 'nova-button nova-ai-action' },
      labels[id],
    );
    button.disabled = !available(id);
    button.addEventListener('click', () => void run(id, INSTRUCTIONS[id]));
    actions.append(button);
    return button;
  });

  const run = async (action: AiAction, instruction: string): Promise<boolean | string> => {
    if (running || !instruction.trim()) return false;
    running = true;
    handle.setBusy(true);
    handle.setError(null);
    for (const button of buttons) button.disabled = true;
    preview.hidden = false;
    preview.textContent = labels.writing;
    try {
      const result = await runAi(editor, action, instruction, controller.signal, (text) => {
        preview.textContent = text;
      });
      if (controller.signal.aborted) return false;
      handle.close();
      editor.ui.notify({ text: result === 'done' ? labels.done : labels.nothing, type: 'info' });
      editor.focus();
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      const message =
        error instanceof Error && error.message === 'not-configured'
          ? labels.notConfigured
          : labels.failed;
      if (!(error instanceof Error && error.message === 'not-configured'))
        console.error('[nova] ai:', error);
      handle.setError(message);
      preview.hidden = true;
      return false;
    } finally {
      running = false;
      if (!controller.signal.aborted) {
        handle.setBusy(false);
        buttons.forEach((button, index) => (button.disabled = !available(ids[index]!)));
      }
    }
  };

  const body = h('div', { className: 'nova-ai' }, input, actions, preview);
  const handle = editor.ui.openDialog({
    title: labels.dialog,
    body,
    submitLabel: labels.send,
    initialFocus: input,
    onSubmit: () => {
      void run('custom', input.value);
      return false;
    },
    onClose: () => controller.abort(),
  });
  if (preset) void run(preset, INSTRUCTIONS[preset as Exclude<AiAction, 'custom'>]);
}

export default definePlugin({
  name: 'ai',
  requires: ['suggestions'],
  toolbar: 'aidialog',
  setup(editor) {
    editor.ui.addStyles('nova-ai', css);
    const labels = pickLabels(editor, 'ai', LABELS);
    const enabled = (e: Editor) => e.isEditable();
    editor.ui.registry.addButton('aidialog', {
      icon: ICON,
      tooltip: labels.dialog,
      isEnabled: enabled,
      onAction: () => openAiDialog(editor),
    });
    editor.ui.registry.addMenuItem('aidialog', {
      icon: ICON,
      text: labels.dialog,
      isEnabled: enabled,
      onAction: () => openAiDialog(editor),
    });
    editor.ui.registry.addMenuButton('aishortcuts', {
      text: labels.shortcuts,
      tooltip: labels.shortcuts,
      isEnabled: enabled,
      items: (): MenuEntry[] => {
        const empty = editor.view.state.selection.empty;
        return (Object.keys(INSTRUCTIONS) as Array<Exclude<AiAction, 'custom'>>).map((id) => ({
          id,
          label: labels[id],
          disabled: empty && NEEDS_SELECTION.includes(id),
          onSelect: () => openAiDialog(editor, id),
        }));
      },
    });
  },
});
