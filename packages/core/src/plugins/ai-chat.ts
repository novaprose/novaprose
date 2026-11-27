import { Plugin, PluginKey, Selection, TextSelection } from 'prosemirror-state';
import { Mapping } from 'prosemirror-transform';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Editor } from '../editor';
import { h, uniqueId } from '../ui/dom';
import type { LABELS } from './ai';
import {
  aiOptions,
  around,
  askModel,
  documentText,
  failureKind,
  INSTRUCTIONS,
  MAX_DOCUMENT,
  type AiMessage,
  type QuickAction,
} from './ai-core';
import {
  blockEditsTransaction,
  blocksText,
  blockText,
  currentBlock,
  editableBlocks,
  hasEditableText,
  rangeText,
  readBlocks,
  suggestInsert,
  suggestRewrite,
} from './ai-edit';
import {
  listSuggestions,
  OWN,
  resolveSuggestions,
  suggestTransaction,
  type SuggestionAuthor,
} from './suggestions';

/**
 * The AI chat panel (the aichat sidebar). Ask: questions about the document, answered in the panel,
 * and an answer goes into the text with Insert or Replace selection. Edit: the model changes the
 * document (or the selected paragraphs) block by block, and its changes arrive as suggestions,
 * accepted or rejected all at once from the panel or one by one in the text.
 */

export type Labels = (typeof LABELS)['en'];

// ---------- edits of the document ----------

export interface EditResult {
  /** Blocks that got suggestions. */
  changed: number;
  /** Blocks the model changed that someone changed while it was writing: left as they are. */
  skipped: number;
  /** Ids of the suggestions the edit made. */
  ids: string[];
  /** The answer had no blocks and wasn't "NO CHANGES": it couldn't be matched to the document. */
  unmatched: boolean;
  /** done, or why it ended early. */
  status: 'done' | 'stopped' | 'tooLong' | 'notConfigured' | 'failed' | 'noText';
}

/**
 * Changes the selected blocks (the whole document without a selection) as the instruction asks. The
 * blocks the model changed are applied as suggestions as soon as each one arrives.
 */
export async function runEdit(
  editor: Editor,
  instruction: string,
  author: SuggestionAuthor,
  signal: AbortSignal,
  {
    messages = [],
    onProgress,
  }: { messages?: AiMessage[]; onProgress?: (changed: number) => void } = {},
): Promise<EditResult> {
  const { doc, selection } = editor.view.state;
  const whole = selection.empty;
  const blocks = editableBlocks(
    doc,
    whole ? 0 : selection.from,
    whole ? doc.content.size : selection.to,
  );
  const result: EditResult = { changed: 0, skipped: 0, ids: [], unmatched: false, status: 'done' };
  if (!blocks.length) {
    // Nothing but code (or empty blocks): no request, and the panel says why.
    result.status = 'noText';
    return result;
  }
  const max = aiOptions(editor).maxDocument ?? MAX_DOCUMENT;
  if (blocks.reduce((sum, block) => sum + block.text.length, 0) > max) {
    result.status = 'tooLong';
    return result;
  }
  const known = new Set(listSuggestions(doc).map((s) => s.id));
  // Positions of the blocks as they were sent → positions now (typing, collaborators, our own edits).
  const mapping = new Mapping();
  const off = editor.on('change', (_e, { transaction }) =>
    mapping.appendMapping(transaction.mapping),
  );
  const seen = new Set<number>();
  let read = 0;
  const apply = (answer: string) => {
    const { blocks: edits, end } = readBlocks(answer, read);
    read = end;
    for (const [id, next] of edits) {
      const sent = blocks[id - 1];
      if (!sent || seen.has(id)) continue;
      seen.add(id);
      const text = blockText(sent.text, next);
      if (text === sent.text) continue;
      const state = editor.view.state;
      const segment = editor.isEditable()
        ? currentBlock(state.doc, mapping.map(sent.from, -1), sent.text)
        : null;
      if (!segment) {
        result.skipped += 1;
        continue;
      }
      const tr = blockEditsTransaction(state, [{ segment, text }]);
      if (!tr.docChanged) continue;
      editor.view.dispatch(suggestTransaction(tr, state, author).setMeta(OWN, true));
      result.changed += 1;
      onProgress?.(result.changed);
    }
  };
  let answer = '';
  try {
    const context = whole ? {} : around(doc, blocks[0]!.from, blocks[blocks.length - 1]!.to);
    answer = await askModel(
      editor,
      { action: 'edit', instruction, text: blocksText(blocks), ...context, messages },
      signal,
      apply,
    );
    if (signal.aborted) result.status = 'stopped';
  } catch (error) {
    if (!signal.aborted) console.error('[nova] ai:', error);
    result.status = signal.aborted ? 'stopped' : failureKind(error);
  } finally {
    off();
  }
  const ids = listSuggestions(editor.view.state.doc)
    .filter((s) => !known.has(s.id) && s.author.id === author.id)
    .map((s) => s.id);
  result.ids = [...new Set(ids)];
  result.unmatched =
    result.status === 'done' &&
    !seen.size &&
    !!answer.trim() &&
    !/^\W*no changes\W*$/i.test(answer.trim());
  return result;
}

// ---------- the selection while focus is in the panel ----------

/**
 * While focus is in the panel the browser doesn't show the text's selection, yet "the selection" is
 * what the panel works on: a decoration keeps it visible.
 */
export const contextKey = new PluginKey<boolean>('nova-ai-context');

export function contextPlugin(): Plugin<boolean> {
  return new Plugin<boolean>({
    key: contextKey,
    state: {
      init: () => false,
      apply: (tr, value) => (tr.getMeta(contextKey) as boolean | undefined) ?? value,
    },
    props: {
      decorations(state) {
        if (!contextKey.getState(state) || state.selection.empty) return null;
        const { from, to } = state.selection;
        return DecorationSet.create(state.doc, [
          Decoration.inline(from, to, { class: 'nova-ai-context' }),
        ]);
      },
    },
  });
}

// ---------- the panel ----------

interface Entry {
  role: 'user' | 'assistant';
  mode: 'ask' | 'edit';
  /** The user's message as shown, or the answer. */
  text: string;
  /** What a user message sent: a suggestion of the edit mode sends a ready instruction in English. */
  instruction?: string;
  status: 'writing' | 'done' | 'stopped' | 'failed';
  error?: string;
  progress?: number;
  edit?: EditResult;
  el: HTMLElement;
}

type Mode = 'ask' | 'edit';

const ASK_SUGGESTIONS = ['askSummarize', 'askKeyPoints', 'askTitle', 'askUnclear'] as const;
const EDIT_SUGGESTIONS: QuickAction[] = ['fix', 'improve', 'formal', 'simplify', 'shorter'];
/** The conversation sent with a message: the latest messages, up to this many characters. */
const HISTORY = 20_000;

export function createChatPanel(
  editor: Editor,
  labels: Labels,
  author: () => SuggestionAuthor,
): { el: HTMLElement; refresh: () => void; focus: () => void; destroy: () => void } {
  let mode: Mode = 'ask';
  const entries: Entry[] = [];
  let controller: AbortController | null = null;
  /** The conversation is scrolled to its end (follows new text). */
  let pinned = true;
  const label = (template: string, count: number) => template.replace('{count}', String(count));

  // Mode: Ask or Edit.
  const group = uniqueId('nova-ai-mode');
  const radio = (value: Mode, text: string) => {
    const input = h('input', {
      type: 'radio',
      name: group,
      value,
      className: 'nova-ai-mode-input',
      checked: value === mode,
    });
    input.addEventListener('change', () => input.checked && setMode(value));
    return h('label', { className: 'nova-ai-mode' }, input, h('span', {}, text));
  };
  const askRadio = radio('ask', labels.modeAsk);
  const editRadio = radio('edit', labels.modeEdit);
  const modes = h(
    'fieldset',
    { className: 'nova-ai-modes' },
    h('legend', { className: 'nova-visually-hidden' }, labels.mode),
    askRadio,
    editRadio,
  );
  const scope = h('p', { className: 'nova-ai-scope' });

  const hint = h('p', { className: 'nova-ai-hint' });
  const chips = h('div', {
    className: 'nova-ai-chips',
    role: 'group',
    'aria-label': labels.examples,
  });
  const empty = h('div', { className: 'nova-ai-empty' }, hint, chips);
  const log = h('section', { className: 'nova-ai-log', 'aria-label': labels.conversation }, empty);

  const input = h('textarea', {
    className: 'nova-input nova-ai-input',
    rows: '2',
    'aria-label': labels.message,
  });
  const send = h(
    'button',
    { type: 'button', className: 'nova-button nova-button-primary nova-ai-send' },
    labels.send,
  );
  const stop = h('button', { type: 'button', className: 'nova-button nova-ai-stop' }, labels.stop);
  stop.hidden = true;
  const reset = h(
    'button',
    { type: 'button', className: 'nova-button nova-ai-new' },
    labels.newChat,
  );
  const composer = h(
    'div',
    { className: 'nova-ai-composer' },
    input,
    h('div', { className: 'nova-ai-composer-row' }, reset, stop, send),
  );
  const el = h('div', { className: 'nova-ai-chat' }, modes, scope, log, composer);

  // ---------- state of the controls ----------

  function setMode(next: Mode): void {
    mode = next;
    askRadio.querySelector('input')!.checked = next === 'ask';
    editRadio.querySelector('input')!.checked = next === 'edit';
    input.placeholder = next === 'ask' ? labels.askPlaceholder : labels.editPlaceholder;
    renderEmpty();
    refresh();
  }

  function renderEmpty(): void {
    hint.textContent = mode === 'ask' ? labels.askHint : labels.editHint;
    chips.replaceChildren(
      ...(mode === 'ask'
        ? ASK_SUGGESTIONS.map((key) => chip(labels[key], labels[key]))
        : EDIT_SUGGESTIONS.map((id) => chip(labels[id], INSTRUCTIONS[id]))),
    );
    empty.hidden = entries.length > 0;
  }

  function chip(text: string, instruction: string): HTMLButtonElement {
    const button = h('button', { type: 'button', className: 'nova-button nova-ai-chip' }, text);
    button.addEventListener('click', () => void submit(text, instruction));
    return button;
  }

  /** What the panel works on, the buttons that depend on the selection, busy or not. */
  function refresh(): void {
    const { selection } = editor.view.state;
    const editable = editor.isEditable();
    scope.textContent =
      mode === 'ask'
        ? selection.empty
          ? labels.scopeDocument
          : labels.scopeSelection
        : selection.empty
          ? labels.editScopeDocument
          : labels.editScopeSelection;
    const busy = controller !== null;
    send.disabled = busy;
    send.hidden = busy;
    stop.hidden = !busy;
    for (const radio of [askRadio, editRadio]) radio.querySelector('input')!.disabled = busy;
    if (!editable && mode === 'edit') setMode('ask');
    editRadio.querySelector('input')!.disabled = busy || !editable;
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-ai-needs]')) {
      const needs = button.dataset.aiNeeds;
      // Replace selection needs text outside code: code can't carry suggestions.
      button.disabled = !editable || (needs === 'selection' && !hasEditableText(editor.view.state));
    }
  }

  // ---------- messages ----------

  function add(entry: Omit<Entry, 'el'>): Entry {
    const full = {
      ...entry,
      el: h('article', { className: `nova-ai-msg nova-ai-msg-${entry.role}` }),
    };
    entries.push(full);
    log.append(full.el);
    empty.hidden = true;
    render(full);
    return full;
  }

  function render(entry: Entry): void {
    const who = h(
      'p',
      { className: 'nova-ai-who' },
      entry.role === 'user' ? labels.you : labels.author,
    );
    const body: (Node | null)[] = [];
    if (entry.role === 'user') {
      body.push(h('div', { className: 'nova-ai-text' }, entry.text));
    } else if (entry.mode === 'ask') {
      if (entry.status === 'failed') {
        body.push(h('p', { className: 'nova-ai-error' }, entry.error ?? labels.failed));
      } else {
        const writing = entry.status === 'writing' && !entry.text;
        body.push(
          h(
            'div',
            { className: `nova-ai-text${writing ? ' nova-ai-pending' : ''}` },
            writing ? labels.writing : entry.text,
          ),
        );
        if (entry.status === 'stopped')
          body.push(h('p', { className: 'nova-ai-note' }, labels.stopped));
        if (entry.status !== 'writing' && entry.text.trim()) body.push(answerActions(entry));
      }
    } else {
      body.push(...editSummary(entry));
    }
    entry.el.replaceChildren(who, ...body.filter((node): node is Node => node !== null));
    refresh();
    // The newest message stays in view as it is written, unless the user scrolled up to read.
    if (entry === entries[entries.length - 1] && pinned) log.scrollTop = log.scrollHeight;
  }

  function answerActions(entry: Entry): HTMLElement {
    const button = (text: string, onClick: () => void, needs?: 'editable' | 'selection') => {
      const b = h('button', { type: 'button', className: 'nova-button nova-ai-msg-action' }, text);
      if (needs) b.dataset.aiNeeds = needs;
      b.addEventListener('click', onClick);
      return b;
    };
    return h(
      'div',
      { className: 'nova-ai-msg-actions' },
      button(labels.insert, () => insertAnswer(entry.text), 'editable'),
      button(labels.replace, () => replaceSelection(entry.text), 'selection'),
      button(labels.copy, () => copy(entry.text)),
    );
  }

  /** What an edit did, line by line: for the panel, for screen readers and for the conversation. */
  function editLines(result: EditResult): Array<{ text: string; kind: 'error' | 'note' | 'text' }> {
    const lines: Array<{ text: string; kind: 'error' | 'note' | 'text' }> = [];
    if (result.status === 'tooLong') lines.push({ text: labels.tooLong, kind: 'error' });
    else if (result.status === 'noText') lines.push({ text: labels.noText, kind: 'note' });
    else if (result.status === 'notConfigured' || result.status === 'failed')
      lines.push({ text: labels[result.status], kind: 'error' });
    else if (result.unmatched) lines.push({ text: labels.editUnmatched, kind: 'error' });
    else if (result.changed)
      lines.push({ text: label(labels.editDone, result.changed), kind: 'text' });
    else if (result.status === 'done') lines.push({ text: labels.editNothing, kind: 'text' });
    if (result.skipped)
      lines.push({ text: label(labels.editSkipped, result.skipped), kind: 'note' });
    if (result.status === 'stopped') lines.push({ text: labels.stopped, kind: 'note' });
    return lines;
  }

  function editSummary(entry: Entry): HTMLElement[] {
    const result = entry.edit;
    if (entry.status === 'writing' || !result) {
      const lines = [h('p', { className: 'nova-ai-pending' }, labels.editing)];
      if (entry.progress)
        lines.push(
          h('p', { className: 'nova-ai-note' }, label(labels.editProgress, entry.progress)),
        );
      return lines;
    }
    const lines = editLines(result).map(({ text, kind }) =>
      h('p', kind === 'text' ? {} : { className: `nova-ai-${kind}` }, text),
    );
    const left = remaining(result.ids);
    if (left.length) {
      const button = (text: string, onClick: () => void) => {
        const b = h(
          'button',
          { type: 'button', className: 'nova-button nova-ai-msg-action' },
          text,
        );
        b.dataset.aiNeeds = 'editable';
        b.addEventListener('click', onClick);
        return b;
      };
      lines.push(
        h(
          'div',
          { className: 'nova-ai-msg-actions' },
          button(labels.show, () => showChange(left)),
          button(labels.acceptAll, () => resolve('accept', result.ids)),
          button(labels.rejectAll, () => resolve('reject', result.ids)),
        ),
      );
    } else if (result.ids.length) {
      lines.push(h('p', { className: 'nova-ai-note' }, labels.reviewed));
    }
    return lines;
  }

  /** What an entry says in the conversation sent to the model. */
  function asMessage(entry: Entry): AiMessage | null {
    if (entry.role === 'user') return { role: 'user', text: entry.instruction ?? entry.text };
    if (entry.status === 'failed' || entry.status === 'writing') return null;
    if (entry.mode === 'ask')
      return entry.text.trim() ? { role: 'assistant', text: entry.text } : null;
    const text = entry.edit
      ? editLines(entry.edit)
          .map((line) => line.text)
          .join(' ')
      : '';
    return text ? { role: 'assistant', text } : null;
  }

  function history(before: Entry): AiMessage[] {
    const out: AiMessage[] = [];
    let size = 0;
    for (const entry of entries.slice(0, entries.indexOf(before)).reverse()) {
      const message = asMessage(entry);
      if (!message) continue;
      size += message.text.length;
      if (size > HISTORY) break;
      out.unshift(message);
    }
    // The conversation starts with the user's message.
    while (out[0]?.role === 'assistant') out.shift();
    return out;
  }

  // ---------- sending ----------

  async function submit(text: string, instruction = text): Promise<void> {
    if (controller || !text.trim()) return;
    const sentMode = mode;
    pinned = true;
    const user = add({
      role: 'user',
      mode: sentMode,
      text: text.trim(),
      instruction: instruction.trim(),
      status: 'done',
    });
    const reply = add({ role: 'assistant', mode: sentMode, text: '', status: 'writing' });
    input.value = '';
    const current = new AbortController();
    controller = current;
    refresh();
    editor.ui.announce(sentMode === 'ask' ? labels.writing : labels.editing);
    const messages = history(user);
    try {
      if (sentMode === 'ask') await ask(reply, instruction.trim(), messages, current.signal);
      else await edit(reply, instruction.trim(), messages, current.signal);
    } finally {
      if (controller === current) controller = null;
      render(reply);
    }
  }

  async function ask(
    reply: Entry,
    instruction: string,
    messages: AiMessage[],
    signal: AbortSignal,
  ): Promise<void> {
    const { doc, selection } = editor.view.state;
    try {
      const max = aiOptions(editor).maxDocument ?? MAX_DOCUMENT;
      const answer = await askModel(
        editor,
        {
          action: 'chat',
          instruction,
          text: selection.empty ? '' : rangeText(doc, selection.from, selection.to),
          document: documentText(doc, max),
          messages,
        },
        signal,
        (text) => {
          reply.text = text;
          render(reply);
        },
      );
      if (signal.aborted) {
        reply.status = 'stopped';
        return;
      }
      reply.text = answer.trim();
      reply.status = 'done';
      editor.ui.announce(reply.text.length <= 600 ? reply.text : labels.answered);
    } catch (error) {
      if (signal.aborted) {
        reply.status = 'stopped';
        return;
      }
      const kind = failureKind(error);
      if (kind === 'failed') console.error('[nova] ai:', error);
      reply.status = 'failed';
      reply.error = labels[kind];
      editor.ui.announce(reply.error);
    }
  }

  async function edit(
    reply: Entry,
    instruction: string,
    messages: AiMessage[],
    signal: AbortSignal,
  ): Promise<void> {
    const result = await runEdit(editor, instruction, author(), signal, {
      messages,
      onProgress: (changed) => {
        reply.progress = changed;
        render(reply);
      },
    });
    reply.edit = result;
    reply.status = result.status === 'stopped' ? 'stopped' : 'done';
    render(reply);
    editor.ui.announce(
      editLines(result)
        .map((line) => line.text)
        .join(' '),
    );
  }

  // ---------- what an answer does in the text ----------

  function insertAnswer(text: string): void {
    const state = editor.view.state;
    let pos = state.selection.to;
    // A selected image or table: the nearest place for text after it.
    if (!state.doc.resolve(pos).parent.isTextblock) {
      const near =
        Selection.findFrom(state.doc.resolve(pos), 1, true) ??
        Selection.findFrom(state.doc.resolve(pos), -1, true);
      if (!near) return;
      pos = near.from;
    }
    const $pos = state.doc.resolve(pos);
    // At the end of a paragraph with text the answer starts a new paragraph; in an empty one it goes in.
    const newParagraph =
      $pos.parent.isTextblock && $pos.parent.content.size > 0 && pos === $pos.end();
    const tr = suggestInsert(state, pos, text, author(), { newParagraph });
    if (!tr.docChanged) return;
    editor.view.dispatch(tr.scrollIntoView());
    editor.ui.announce(labels.done);
  }

  function replaceSelection(text: string): void {
    const state = editor.view.state;
    const { from, to } = state.selection;
    if (!hasEditableText(state)) return;
    const tr = suggestRewrite(state, from, to, text, author());
    if (!tr.docChanged) {
      editor.ui.announce(labels.nothing);
      return;
    }
    editor.view.dispatch(tr.scrollIntoView());
    editor.ui.announce(labels.done);
  }

  function copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(
      () => editor.ui.announce(labels.copied),
      () => undefined,
    );
  }

  function remaining(ids: readonly string[]): string[] {
    if (!ids.length) return [];
    const live = new Set(listSuggestions(editor.view.state.doc).map((s) => s.id));
    return ids.filter((id) => live.has(id));
  }

  function resolve(action: 'accept' | 'reject', ids: readonly string[]): void {
    const left = remaining(ids);
    if (!left.length) return;
    editor.view.dispatch(resolveSuggestions(editor.view.state, action, left));
    editor.ui.announce(label(action === 'accept' ? labels.accepted : labels.rejected, left.length));
  }

  function showChange(ids: readonly string[]): void {
    const { doc } = editor.view.state;
    const first = listSuggestions(doc).find((s) => ids.includes(s.id));
    if (!first) return;
    editor.view.dispatch(
      editor.view.state.tr
        .setSelection(TextSelection.create(doc, first.from, first.to))
        .scrollIntoView(),
    );
    editor.focus();
  }

  log.addEventListener('scroll', () => {
    pinned = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  });

  // ---------- events ----------

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void submit(input.value);
  });
  send.addEventListener('click', () => void submit(input.value));
  stop.addEventListener('click', () => {
    controller?.abort();
    input.focus();
  });
  reset.addEventListener('click', () => {
    controller?.abort();
    controller = null;
    for (const entry of entries) entry.el.remove();
    entries.length = 0;
    renderEmpty();
    refresh();
    input.focus();
  });

  // The text's selection stays visible while focus is in the panel.
  const highlight = (on: boolean) => {
    if (contextKey.getState(editor.view.state) === on) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(contextKey, on).setMeta('addToHistory', false),
    );
  };
  el.addEventListener('focusin', () => highlight(true));
  el.addEventListener('focusout', (event) => {
    if (!el.contains(event.relatedTarget as Node | null)) highlight(false);
  });

  // Counts of edits follow accepting and rejecting in the text.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const offChange = editor.on('change', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const entry of entries)
        if (entry.mode === 'edit' && entry.role === 'assistant' && entry.edit) render(entry);
    }, 150);
  });
  const offSelection = editor.on('selectionChange', () => refresh());
  const offEditable = editor.on('editableChange', () => refresh());

  setMode('ask');
  return {
    el,
    refresh,
    focus: () => input.focus(),
    destroy() {
      controller?.abort();
      clearTimeout(timer);
      offChange();
      offSelection();
      offEditable();
    },
  };
}
