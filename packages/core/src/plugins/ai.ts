import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import type { DialogHandle } from '../ui/dialog';
import { h } from '../ui/dom';
import { setAltTextSuggester } from '../image';
import type { MenuEntry } from '../ui/menu';
import css from './ai.css?raw';
import { contextPlugin, createChatPanel } from './ai-chat';
import { autocompletePlugin, stopAutocomplete } from './ai-complete';
import {
  aiOptions,
  around,
  askModel,
  DESCRIBE_INSTRUCTION,
  failureKind,
  INSTRUCTIONS,
  NEEDS_SELECTION,
  type AiAction,
  type AiImage,
  type AiShortcut,
  type QuickAction,
} from './ai-core';
import { hasEditableText, rangeText, suggestInsert, suggestRewrite } from './ai-edit';
import { pickLabels } from './shared';
import type { SuggestionAuthor } from './suggestions';

export type { AiAction, AiImage, AiMessage, AiOptions, AiRequest, AiShortcut } from './ai-core';
export { INSTRUCTIONS } from './ai-core';

/**
 * The ai plugin: an AI assistant whose edits arrive as suggestions, like a co-author's.
 *
 * - The assistant window (aidialog) and quick actions (aishortcuts): select text → "Improve",
 *   "Shorter", your own request → the changed words appear as suggestions, each accepted or rejected
 *   on its own. Without a selection, text at the cursor ("Continue").
 * - The chat panel (aichat): questions about the document; in Edit mode the model changes the whole
 *   document (or the selected paragraphs), again as suggestions.
 * - Autocomplete (the autocomplete option): grey text after the cursor, Tab accepts it.
 *
 * The model is yours: `pluginOptions.ai.request` sends the request to your server (an API key must
 * never live in the browser) and returns text or a stream of text pieces. `plugins: ['suggestions', 'ai']`.
 * Button names as in TinyMCE: aidialog and aishortcuts.
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
    chat: 'AI chat',
    mode: 'Mode',
    modeAsk: 'Ask',
    modeEdit: 'Edit',
    scopeDocument: 'Context: the whole document',
    scopeSelection: 'Context: the selected text',
    editScopeDocument: 'Changes: the whole document',
    editScopeSelection: 'Changes: the selected paragraphs',
    askPlaceholder: 'Ask about the document',
    editPlaceholder: 'What should change? For example: make it more formal',
    askHint:
      'AI reads the document and answers here. Put an answer into the text with Insert or Replace selection.',
    editHint: 'AI changes the document as suggestions: you accept or reject each change.',
    examples: 'Examples',
    askSummarize: 'Summarize the document',
    askKeyPoints: 'List the key points',
    askTitle: 'Suggest a title',
    askUnclear: 'Find unclear sentences',
    conversation: 'Conversation',
    message: 'Message to AI',
    you: 'You',
    stop: 'Stop',
    stopped: 'Stopped.',
    newChat: 'New chat',
    answered: 'AI answered.',
    insert: 'Insert',
    replace: 'Replace selection',
    copy: 'Copy',
    copied: 'Copied.',
    editing: 'AI is editing the document…',
    editProgress: 'Paragraphs changed so far: {count}',
    editDone: 'Paragraphs with suggested changes: {count}',
    editNothing: 'AI found nothing to change.',
    editSkipped: 'Left as they are (changed while AI was writing): {count}',
    editUnmatched: "AI's answer didn't match the document. Try again.",
    tooLong: 'The document is too long for one request: select a part of it.',
    inCode: "AI doesn't change code: what it writes goes after the code block.",
    noText: "There's no text to change here: AI doesn't change code blocks.",
    show: 'Show in the text',
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    accepted: 'Changes accepted: {count}',
    rejected: 'Changes rejected: {count}',
    reviewed: 'All changes reviewed.',
    modeReview: 'Review',
    reviewScopeDocument: 'Review: the whole document',
    reviewScopeSelection: 'Review: the selected paragraphs',
    reviewPlaceholder: 'What should AI check? For example: the tone of a business letter',
    reviewHint:
      'AI lists its remarks, each with the reason. A fix arrives as a suggestion in the text: accept or reject each one.',
    reviewAll: 'Review the document',
    reviewClarity: 'Check clarity',
    reviewConsistency: 'Check consistency',
    reviewing: 'AI is reviewing the document…',
    reviewProgress: 'Remarks so far: {count}',
    reviewFound: 'Remarks: {count}',
    reviewNone: 'AI has no remarks.',
    reviewUnmatched: "AI's answer couldn't be read as a list of remarks. Try again.",
    accept: 'Accept',
    reject: 'Reject',
    findingDone: 'Reviewed',
    findingRemark: 'No change proposed',
    findingLost: 'Not found in the text',
    autocomplete: 'AI autocomplete',
    completion: 'Suggestion: {text}. Press Tab to accept.',
    completionHint: 'Tab or a click accepts, Esc dismisses',
    describeImage: 'Describe with AI',
    describing: 'Describing…',
    describeFailed: 'AI could not describe the image. Try again, or write the text yourself.',
  },
};

/** The image for a describe request: its address, and its bytes when the browser can read them. */
export async function imageForModel(src: string): Promise<AiImage> {
  const embedded = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(src);
  if (embedded) return { mimeType: embedded[1]!.toLowerCase(), data: embedded[2]! };
  const image: AiImage = /^https?:/i.test(src) ? { src } : {};
  if (!/^(blob:|https?:)/i.test(src)) return image;
  try {
    // A blob: preview of an upload, or an address the page may read (same site, or allowed by CORS).
    const blob = await (await fetch(src)).blob();
    if (!blob.type.startsWith('image/') || blob.size > 5_000_000) return image;
    const url = await new Promise<string>((done, fail) => {
      const reader = new FileReader();
      reader.onload = () => done(String(reader.result));
      reader.onerror = () => fail(reader.error);
      reader.readAsDataURL(blob);
    });
    return { ...image, mimeType: blob.type, data: url.slice(url.indexOf(',') + 1) };
  } catch {
    return image;
  }
}

/** The model's answer as alternative text: one line, no quotes around it, at most 250 characters. */
export function cleanAltText(answer: string): string {
  const text = answer
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”«»„]+|["'“”«»„]+$/g, '')
    .trim();
  if (text.length <= 250) return text;
  const cut = text.slice(0, 250);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 200))}…`;
}

type Labels = (typeof LABELS)['en'];

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.94 14.06 4 20"/><path d="m15 4 1.2 2.8L19 8l-2.8 1.2L15 12l-1.2-2.8L11 8l2.8-1.2z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 15v4"/><path d="M17 17h4"/></svg>';
const CHAT_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5z"/><path d="m12.5 8 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>';
const COMPLETE_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h7"/><path d="M4 12h4"/><path d="M11 5v14"/><path d="M15 12h1"/><path d="M19 12h1"/></svg>';

export const CHAT = 'aichat';

/** A quick action of the menu and the window: built in, or one of yours (custom). */
interface QuickItem {
  label: string;
  action: AiAction;
  instruction: string;
  /** true: needs a selection; false: only without one; undefined: always. */
  selection?: boolean;
  /** The title of its group, for your own grouped shortcuts. */
  group?: string;
}

/** The quick actions: yours (pluginOptions.ai.shortcuts, groups flattened) or the built-in ones; null: none. */
export function quickActions(editor: Editor, labels: Labels): QuickItem[] | null {
  const { shortcuts } = aiOptions(editor);
  if (shortcuts === false) return null;
  if (!Array.isArray(shortcuts)) {
    return (Object.keys(INSTRUCTIONS) as QuickAction[]).map((id) => ({
      label: labels[id],
      action: id,
      instruction: INSTRUCTIONS[id],
      ...(NEEDS_SELECTION.includes(id) ? { selection: true } : {}),
    }));
  }
  const out: QuickItem[] = [];
  const walk = (items: readonly unknown[], group?: string) => {
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as AiShortcut;
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title) continue;
      if (Array.isArray(item.items)) walk(item.items, group ? `${group} › ${title}` : title);
      else if (typeof item.prompt === 'string' && item.prompt.trim()) {
        out.push({
          label: title,
          action: 'custom',
          instruction: item.prompt,
          ...(typeof item.selection === 'boolean' ? { selection: item.selection } : {}),
          ...(group ? { group } : {}),
        });
      }
    }
  };
  walk(shortcuts);
  // An empty list hides the menu, like false.
  return out.length ? out : null;
}

const available = (item: QuickItem, empty: boolean) =>
  item.selection === undefined || item.selection === !empty;

export function aiAuthor(editor: Editor, labels: Labels): SuggestionAuthor {
  return { id: 'ai', name: String(aiOptions(editor).name || labels.author).slice(0, 80) };
}

/** Runs the request and applies the answer as suggestions; errors and cancelling leave the text unchanged. */
async function runAi(
  editor: Editor,
  action: AiAction,
  instruction: string,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<'done' | 'nothing'> {
  const author = aiAuthor(editor, pickLabels(editor, 'ai', LABELS));
  const { state } = editor.view;
  const { from: start, to: end } = state.selection;
  // Only code selected counts as no selection: AI writes after the code block, code stays as it is.
  const empty = !hasEditableText(state);
  // Selection positions are mapped through edits that arrive while the model writes (co-authors, autosave).
  let from = start;
  let to = end;
  const off = editor.on('change', (_e, { transaction }) => {
    from = transaction.mapping.map(from, -1);
    to = transaction.mapping.map(to, 1);
  });
  try {
    const doc = state.doc;
    const text = await askModel(
      editor,
      {
        action,
        instruction,
        text: empty ? '' : rangeText(doc, start, end, { skipCode: true }),
        ...around(doc, start, end),
      },
      signal,
      onText,
    );
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

export interface AiDialogOptions {
  /** Run this quick action right away. */
  preset?: QuickItem;
  /** Text for the request field. */
  prompt?: string;
  /** Send `prompt` right away. */
  generate?: boolean;
  /** false: no request field and quick actions, only the answer as it is written. */
  display?: boolean;
  onClose?: () => void;
}

/** The assistant window: your own request, quick actions, the answer as it is written. */
function openAiDialog(editor: Editor, options: AiDialogOptions = {}): DialogHandle {
  const labels = pickLabels(editor, 'ai', LABELS);
  const { state } = editor.view;
  const empty = !hasEditableText(state);
  // The cursor or the whole selection in code: say where AI's text goes instead.
  const inCode = state.selection.empty ? !!state.selection.$from.parent.type.spec.code : empty;
  const controller = new AbortController();
  const show = options.display !== false;
  let running = false;

  const input = h('input', {
    type: 'text',
    className: 'nova-input',
    placeholder: labels.placeholder,
    'aria-label': labels.prompt,
  });
  input.value = options.prompt ?? '';
  input.hidden = !show;
  const preview = h('output', {
    className: 'nova-ai-preview',
    'aria-live': 'polite',
  });
  preview.hidden = true;
  const items = quickActions(editor, labels) ?? [];
  const buttons: Array<[HTMLButtonElement, QuickItem]> = [];
  const actions = h('div', {
    className: 'nova-ai-actions',
    role: 'group',
    'aria-label': labels.actions,
  });
  let group: HTMLElement = actions;
  let groupName: string | undefined;
  for (const item of items) {
    if (item.group !== groupName) {
      groupName = item.group;
      group = groupName
        ? h(
            'div',
            { className: 'nova-ai-actions-group', role: 'group', 'aria-label': groupName },
            h('p', { className: 'nova-ai-actions-title', 'aria-hidden': 'true' }, groupName),
          )
        : actions;
      if (group !== actions) actions.append(group);
    }
    const button = h(
      'button',
      { type: 'button', className: 'nova-button nova-ai-action' },
      item.label,
    );
    button.disabled = !available(item, empty);
    button.addEventListener('click', () => void run(item.action, item.instruction));
    group.append(button);
    buttons.push([button, item]);
  }
  actions.hidden = !show || !items.length;

  const run = async (action: AiAction, instruction: string): Promise<boolean> => {
    if (running || !instruction.trim()) return false;
    running = true;
    handle.setBusy(true);
    handle.setError(null);
    for (const [button] of buttons) button.disabled = true;
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
      const kind = failureKind(error);
      if (kind === 'failed') console.error('[nova] ai:', error);
      handle.setError(labels[kind]);
      preview.hidden = true;
      return false;
    } finally {
      running = false;
      if (!controller.signal.aborted) {
        handle.setBusy(false);
        for (const [button, item] of buttons) button.disabled = !available(item, empty);
      }
    }
  };

  const note = inCode ? h('p', { className: 'nova-ai-note' }, labels.inCode) : null;
  const body = h('div', { className: 'nova-ai' }, note, input, actions, preview);
  const handle = editor.ui.openDialog({
    title: labels.dialog,
    body,
    ...(show ? { submitLabel: labels.send } : {}),
    initialFocus: show ? input : undefined,
    onSubmit: () => {
      void run('custom', input.value);
      return false;
    },
    onClose: () => {
      controller.abort();
      options.onClose?.();
    },
  });
  if (options.preset) void run(options.preset.action, options.preset.instruction);
  else if (options.generate && input.value.trim()) void run('custom', input.value);
  return handle;
}

/** Per editor: whether autocomplete is on (the aiautocomplete toggle). */
const autocompleteOn = new WeakMap<Editor, boolean>();

function autocompleteDelay(editor: Editor): number | null {
  const setting = aiOptions(editor).autocomplete;
  if (!setting) return null;
  const delay = typeof setting === 'object' ? Number(setting.delay) : NaN;
  return Number.isFinite(delay) ? Math.max(200, delay) : 700;
}

export default definePlugin({
  name: 'ai',
  requires: ['suggestions'],
  toolbar: 'aidialog aichat',
  prosemirrorPlugins: (editor) => {
    const delay = autocompleteDelay(editor);
    if (delay !== null) autocompleteOn.set(editor, true);
    return [
      contextPlugin(),
      ...(delay === null
        ? []
        : [
            autocompletePlugin(editor, {
              delay,
              enabled: () => autocompleteOn.get(editor) === true,
              // "Suggestion: and so on. Press Tab…": the label ends the sentence itself.
              announcement: (text) =>
                pickLabels(editor, 'ai', LABELS).completion.replace(
                  '{text}',
                  text.replace(/[.!?…]+$/, ''),
                ),
              hint: () => pickLabels(editor, 'ai', LABELS).completionHint,
            }),
          ]),
    ];
  },
  setup(editor) {
    editor.ui.addStyles('nova-ai', css);
    const labels = pickLabels(editor, 'ai', LABELS);
    const enabled = (e: Editor) => e.isEditable();

    // ---------- alternative text for images ----------
    if (typeof aiOptions(editor).request === 'function')
      setAltTextSuggester(editor, {
        label: labels.describeImage,
        busy: labels.describing,
        failed: labels.describeFailed,
        run: async (image, signal) =>
          cleanAltText(
            await askModel(
              editor,
              {
                action: 'describe',
                instruction: DESCRIBE_INSTRUCTION,
                before: image.before,
                after: image.after,
                image: await imageForModel(image.src),
              },
              signal,
            ),
          ),
      });

    // ---------- the assistant window ----------
    let dialog: DialogHandle | null = null;
    const signal = (name: string) => editor.root.dispatchEvent(new CustomEvent(name));
    const open = (options: AiDialogOptions = {}) => {
      if (dialog || !editor.isEditable()) return;
      signal('nova-ai-dialogopen');
      dialog = openAiDialog(editor, {
        ...options,
        onClose: () => {
          dialog = null;
          signal('nova-ai-dialogclose');
        },
      });
    };
    editor.ui.registry.addButton('aidialog', {
      icon: ICON,
      tooltip: labels.dialog,
      isEnabled: enabled,
      onAction: () => open(),
    });
    editor.ui.registry.addMenuItem('aidialog', {
      icon: ICON,
      text: labels.dialog,
      isEnabled: enabled,
      onAction: () => open(),
    });
    if (quickActions(editor, labels)) {
      editor.ui.registry.addMenuButton('aishortcuts', {
        text: labels.shortcuts,
        tooltip: labels.shortcuts,
        isEnabled: enabled,
        items: (): MenuEntry[] => {
          const empty = !hasEditableText(editor.view.state);
          const entries: MenuEntry[] = [];
          let group: string | undefined;
          (quickActions(editor, labels) ?? []).forEach((item, index) => {
            if (item.group !== group) {
              group = item.group;
              if (entries.length) entries.push({ type: 'separator' });
              if (group) entries.push({ type: 'heading', label: group });
            }
            entries.push({
              id: `ai-${index}`,
              label: item.label,
              disabled: !available(item, empty),
              onSelect: () => open({ preset: item }),
            });
          });
          return entries;
        },
      });
    }
    // The TinyMCE compatibility layer opens and closes the window (mceAiDialog, mceAiDialogClose).
    const onOpen = (event: Event) => open((event as CustomEvent<AiDialogOptions>).detail ?? {});
    const onClose = () => dialog?.close();
    editor.root.addEventListener('nova-ai-dialog', onOpen);
    editor.root.addEventListener('nova-ai-dialog-close', onClose);

    // ---------- the chat panel ----------
    let panel: ReturnType<typeof createChatPanel> | null = null;
    editor.ui.registry.addSidebar(CHAT, {
      title: labels.chat,
      button: false,
      render: (container) => {
        panel = createChatPanel(editor, labels, () => aiAuthor(editor, labels));
        container.append(panel.el);
        return () => panel?.destroy();
      },
      onShow: () => panel?.refresh(),
    });
    const toggleChat = () => {
      const opening = !editor.ui.sidebar.isOpen(CHAT);
      void editor.ui.sidebar.toggle(CHAT).then(() => {
        if (opening && editor.ui.sidebar.isOpen(CHAT)) panel?.focus();
      });
    };
    editor.ui.registry.addToggleButton(CHAT, {
      icon: CHAT_ICON,
      tooltip: labels.chat,
      isActive: (e) => e.ui.sidebar.isOpen(CHAT),
      onAction: toggleChat,
    });
    editor.ui.registry.addMenuItem(CHAT, {
      icon: CHAT_ICON,
      text: labels.chat,
      onAction: toggleChat,
    });

    // ---------- autocomplete ----------
    if (autocompleteOn.has(editor)) {
      const toggle = () => {
        const on = !autocompleteOn.get(editor);
        autocompleteOn.set(editor, on);
        if (!on) stopAutocomplete(editor.view);
        editor.ui.announce(
          editor.ui.t(on ? 'announce.on' : 'announce.off').replace('{name}', labels.autocomplete),
        );
        editor.updateUI();
      };
      const isActive = () => autocompleteOn.get(editor) === true;
      editor.ui.registry.addToggleButton('aiautocomplete', {
        icon: COMPLETE_ICON,
        tooltip: labels.autocomplete,
        isActive,
        onAction: toggle,
      });
      editor.ui.registry.addMenuItem('aiautocomplete', {
        icon: COMPLETE_ICON,
        text: labels.autocomplete,
        isActive,
        onAction: toggle,
      });
    }

    return () => {
      editor.root.removeEventListener('nova-ai-dialog', onOpen);
      editor.root.removeEventListener('nova-ai-dialog-close', onClose);
      dialog?.close();
    };
  },
});
