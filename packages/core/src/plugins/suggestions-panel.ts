import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { Editor } from '../editor';
import type { MessageKey } from '../i18n';
import { COMMENT_MAX_LENGTH, newCommentId, type CommentThread } from '../comments';
import { activeElement, h, uniqueId } from '../ui/dom';
import { getComments } from './comments';
import css from './suggestions-panel.css?raw';
import {
  listSuggestions,
  resolveSuggestions,
  suggestionColor,
  type BlockBefore,
  type SuggestionAuthor,
} from './suggestions';

/**
 * The suggestions panel (loads on first open): every suggestion as a card — who, when, what — with
 * Accept and Reject; a filter by author, and "Accept shown" / "Reject shown" for what the filter shows
 * (all of one person's suggestions at once). With the comments plugin, a suggestion is discussed on
 * its card: the replies are a comment thread linked to the suggestion, and it is resolved when the
 * suggestion is accepted or rejected. User data goes only through textContent (h()), never
 * innerHTML: other people write the suggestions and the replies.
 */

export interface SuggestionCard {
  /** Ids of the suggestions on the card (a replacement has two: the deletion and the insertion). */
  ids: string[];
  kind: 'insert' | 'delete' | 'replace' | 'format' | 'block';
  author: SuggestionAuthor;
  time: number;
  /** Where the card's text starts and ends in the document. */
  from: number;
  to: number;
  /** Deleted text (delete, replace) and inserted text (insert, replace); the formatted text (format). */
  removed: string;
  added: string;
  /** format: the mark names the text got and lost. */
  marks?: { added: string[]; removed: string[] };
  /** block: what the block was and what it is now. */
  block?: { before: BlockBefore; after: BlockBefore };
}

export interface SuggestionsPanelLabels {
  author: string;
  allAuthors: string;
  authorCount: string;
  kindInsert: string;
  kindDelete: string;
  kindReplace: string;
  kindFormat: string;
  accept: string;
  reject: string;
  acceptShown: string;
  rejectShown: string;
  acceptedCount: string;
  rejectedCount: string;
  none: string;
  noneFrom: string;
  guest: string;
  nonText: string;
}

/** Whose suggestion: the id, or the name for authors without one (a Word document). */
export const authorKey = (author: SuggestionAuthor): string => author.id || author.name;

/**
 * The suggestions as cards, in document order: the parts of one suggestion (in several paragraphs)
 * together, and a deletion right before an insertion by the same author as one replacement.
 */
export function suggestionCards(doc: PMNode): SuggestionCard[] {
  const cards: SuggestionCard[] = [];
  const byPart = new Map<string, SuggestionCard>();
  for (const s of listSuggestions(doc)) {
    const key = `${s.kind}:${s.id}`;
    const known = byPart.get(key);
    if (known) {
      if (s.kind === 'delete') known.removed += ` ${s.text}`;
      else known.added += ` ${s.text}`;
      if (known.marks) {
        for (const name of s.added ?? [])
          if (!known.marks.added.includes(name)) known.marks.added.push(name);
        for (const name of s.removed ?? [])
          if (!known.marks.removed.includes(name)) known.marks.removed.push(name);
      }
      known.to = Math.max(known.to, s.to);
      continue;
    }
    const last = cards[cards.length - 1];
    if (
      s.kind === 'insert' &&
      last?.kind === 'delete' &&
      last.to === s.from &&
      authorKey(last.author) === authorKey(s.author)
    ) {
      last.kind = 'replace';
      last.ids.push(s.id);
      last.added = s.text;
      last.to = s.to;
      byPart.set(key, last);
      continue;
    }
    const card: SuggestionCard = {
      ids: [s.id],
      kind: s.kind,
      author: s.author,
      time: s.time,
      from: s.from,
      to: s.to,
      removed: s.kind === 'delete' ? s.text : '',
      added: s.kind === 'delete' ? '' : s.text,
      ...(s.kind === 'format'
        ? { marks: { added: [...(s.added ?? [])], removed: [...(s.removed ?? [])] } }
        : {}),
      ...(s.kind === 'block'
        ? { block: { before: s.before!, after: blockNow(doc, s.from - 1) } }
        : {}),
    };
    cards.push(card);
    byPart.set(key, card);
  }
  return cards;
}

/** A block's type and attributes now (without its suggestion). */
function blockNow(doc: PMNode, pos: number): BlockBefore {
  const node = doc.nodeAt(pos);
  const attrs: BlockBefore['attrs'] = {};
  for (const [key, value] of Object.entries(node?.attrs ?? {})) {
    if (
      key !== 'suggestion' &&
      (value === null || ['string', 'number', 'boolean'].includes(typeof value))
    )
      attrs[key] = value as string | number | boolean | null;
  }
  return { type: node?.type.name ?? '', attrs };
}

/** UI strings of block alignments. */
const ALIGN_LABELS: Record<string, MessageKey> = {
  left: 'alignLeft',
  center: 'alignCenter',
  right: 'alignRight',
  justify: 'alignJustify',
};

/** UI strings of the formatting a suggested format changes (mark names of the schema). */
const MARK_LABELS: Record<string, MessageKey> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strike',
  code: 'code',
  subscript: 'subscript',
  superscript: 'superscript',
  link: 'link',
  color: 'textColor',
  background: 'backgroundColor',
  font_family: 'fontFamily',
  font_size: 'fontSize',
  span_class: 'styles',
};

/** At most `max` characters of a suggestion's text, on one line. */
function excerpt(text: string, max = 140): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function createSuggestionsPanel(
  editor: Editor,
  labels: SuggestionsPanelLabels,
  canReview: boolean,
) {
  editor.ui.addStyles('nova-suggestions-panel', css);
  const lang = editor.options.language ?? 'en';
  const relative = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const absolute = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
  const selectId = uniqueId('nova-sugg-author');
  // The filter: an author key, or '' for everyone. Names of the authors seen, for an author whose
  // suggestions are all resolved while the filter shows them.
  let shownAuthor = '';
  const names = new Map<string, string>();
  let cards: SuggestionCard[] = [];
  // Discussions (the comments plugin): open reply boxes and what was typed in them, by card, kept
  // across redraws (a collaborator's edit redraws the panel while you type).
  const comments = getComments(editor);
  const drafts = new Map<string, { text: string; start: number; end: number }>();
  const offThreads = comments?.store.subscribe(() => render()) ?? (() => {});

  const select = h('select', { className: 'nova-input nova-sugg-select', id: selectId });
  select.addEventListener('change', () => {
    shownAuthor = select.value;
    render();
  });
  const list = h('ul', { className: 'nova-sugg-list' });
  const empty = h('p', { className: 'nova-sugg-empty', hidden: true });
  const acceptShown = h(
    'button',
    { type: 'button', className: 'nova-button', onClick: () => resolveShown('accept') },
    labels.acceptShown,
  );
  const rejectShown = h(
    'button',
    { type: 'button', className: 'nova-button', onClick: () => resolveShown('reject') },
    labels.rejectShown,
  );
  const el = h(
    'div',
    { className: 'nova-sugg-panel' },
    h(
      'div',
      { className: 'nova-sugg-filter' },
      h('label', { for: selectId }, labels.author),
      select,
    ),
    list,
    empty,
    canReview ? h('div', { className: 'nova-sugg-bulk' }, acceptShown, rejectShown) : null,
  );

  const nameOf = (author: SuggestionAuthor) => author.name || labels.guest;
  const shown = () =>
    shownAuthor ? cards.filter((card) => authorKey(card.author) === shownAuthor) : cards;

  function when(time: number): HTMLTimeElement | null {
    if (!time) return null;
    const seconds = Math.round((time - Date.now()) / 1000);
    const abs = Math.abs(seconds);
    const text =
      abs < 45
        ? relative.format(0, 'second')
        : abs < 3600
          ? relative.format(Math.round(seconds / 60), 'minute')
          : abs < 86400
            ? relative.format(Math.round(seconds / 3600), 'hour')
            : abs < 86400 * 7
              ? relative.format(Math.round(seconds / 86400), 'day')
              : absolute.format(time);
    return h(
      'time',
      { dateTime: new Date(time).toISOString(), title: absolute.format(time) },
      text,
    );
  }

  function resolve(action: 'accept' | 'reject', ids: string[], count: number): void {
    if (!ids.length || !editor.isEditable()) return;
    editor.view.dispatch(resolveSuggestions(editor.view.state, action, ids));
    editor.ui.announce(
      (action === 'accept' ? labels.acceptedCount : labels.rejectedCount).replace(
        '{count}',
        String(count),
      ),
    );
  }

  function resolveShown(action: 'accept' | 'reject'): void {
    const chosen = shown();
    resolve(
      action,
      chosen.flatMap((card) => card.ids),
      chosen.length,
    );
  }

  /** The suggestion in the text: selected and scrolled to (focus stays here, for the keyboard). */
  function goTo(card: SuggestionCard): void {
    const { state } = editor.view;
    const to = Math.min(card.to, state.doc.content.size);
    try {
      editor.view.dispatch(
        state.tr.setSelection(TextSelection.create(state.doc, card.from, to)).scrollIntoView(),
      );
    } catch {
      // Not a text position (the document changed meanwhile): nothing to show.
    }
  }

  /** A block type's name: Paragraph, Heading 2, Code block. */
  function blockName(block: BlockBefore): string {
    if (block.type === 'paragraph') return editor.ui.t('paragraph');
    if (block.type === 'code_block') return editor.ui.t('codeBlock');
    if (block.type === 'heading') {
      const level = Math.min(6, Math.max(1, Math.trunc(Number(block.attrs.level)) || 1));
      return editor.ui.t(`h${level}` as MessageKey);
    }
    return block.type;
  }

  /** What a block suggestion changes: "Paragraph → Heading 2", "Align center", "Increase indent". */
  function blockChanges({ before, after }: { before: BlockBefore; after: BlockBefore }): string[] {
    const out: string[] = [];
    // A missing attribute is its default (HTML saved elsewhere may leave defaults out).
    const value = (block: BlockBefore, key: string) =>
      block.attrs[key] ??
      (
        editor.view.state.schema.nodes[block.type]?.spec.attrs?.[key] as
          { default?: unknown } | undefined
      )?.default ??
      null;
    const differs = (key: string) => value(before, key) !== value(after, key);
    if (before.type !== after.type || differs('level'))
      out.push(`${blockName(before)} → ${blockName(after)}`);
    if (differs('align'))
      out.push(editor.ui.t(ALIGN_LABELS[String(after.attrs.align)] ?? 'alignLeft'));
    if (differs('indent'))
      out.push(
        editor.ui.t(
          Number(after.attrs.indent) > Number(before.attrs.indent) ? 'indent' : 'outdent',
        ),
      );
    if (differs('lineHeight'))
      out.push(`${editor.ui.t('lineHeight')}: ${after.attrs.lineHeight ?? editor.ui.t('default')}`);
    if (differs('dir')) out.push(after.attrs.dir === 'rtl' ? 'RTL' : 'LTR');
    return out.length ? out : [blockName(after)];
  }

  function cardElement(card: SuggestionCard, active: boolean): HTMLElement {
    const key = card.ids[0]!;
    const summaryId = uniqueId('nova-sugg-summary');
    const kind = {
      insert: labels.kindInsert,
      delete: labels.kindDelete,
      replace: labels.kindReplace,
      format: labels.kindFormat,
      block: labels.kindFormat,
    }[card.kind];
    const text = (value: string, tag: 'ins' | 'del' | 'span') =>
      value.trim()
        ? h(tag, { className: 'nova-sugg-text' }, excerpt(value))
        : h('span', { className: 'nova-sugg-text is-object' }, labels.nonText);
    // A suggested format: "+Bold −Italic" (the formatting the text got and lost).
    const markName = (name: string) => (MARK_LABELS[name] ? editor.ui.t(MARK_LABELS[name]) : name);
    const changes = card.marks
      ? h(
          'span',
          { className: 'nova-sugg-changes' },
          [
            ...card.marks.added.map((name) => `+${markName(name)}`),
            ...card.marks.removed.map((name) => `−${markName(name)}`),
          ].join(' '),
        )
      : card.block
        ? h('span', { className: 'nova-sugg-changes' }, blockChanges(card.block).join(' · '))
        : null;
    const summary = h(
      'button',
      {
        type: 'button',
        id: summaryId,
        className: 'nova-sugg-summary',
        'data-key': key,
        'data-action': 'go',
        onClick: () => goTo(card),
      },
      h('span', { className: 'nova-sugg-kind' }, kind),
      card.kind === 'delete' || card.kind === 'replace' ? text(card.removed, 'del') : null,
      card.kind === 'insert' || card.kind === 'replace' ? text(card.added, 'ins') : null,
      card.kind === 'format' || card.kind === 'block' ? text(card.added, 'span') : null,
      changes,
    );
    const editable = editor.isEditable();
    const action = (name: 'accept' | 'reject') =>
      h(
        'button',
        {
          type: 'button',
          className: `nova-button nova-sugg-${name}`,
          'data-key': key,
          'data-action': name,
          'aria-describedby': summaryId,
          disabled: !editable,
          onClick: () => resolve(name, card.ids, 1),
        },
        name === 'accept' ? labels.accept : labels.reject,
      );
    const item = h(
      'li',
      {
        className: `nova-sugg-card${active ? ' is-active' : ''}`,
        'aria-current': active ? 'true' : null,
      },
      h(
        'div',
        { className: 'nova-sugg-head' },
        h('span', { className: 'nova-sugg-dot', 'aria-hidden': 'true' }),
        h('span', { className: 'nova-sugg-author' }, nameOf(card.author)),
        when(card.time),
      ),
      summary,
      discussion(card, key, summaryId),
      canReview
        ? h('div', { className: 'nova-sugg-actions' }, action('accept'), action('reject'))
        : null,
    );
    item.style.setProperty('--nova-suggestion', suggestionColor(authorKey(card.author)));
    return item;
  }

  /** The comment thread about a card's suggestion (a replacement has two ids: either one). */
  function threadOf(card: SuggestionCard): CommentThread | undefined {
    return comments?.store
      .threads()
      .find((thread) => thread.suggestion !== undefined && card.ids.includes(thread.suggestion));
  }

  /** Focus a control of a card after a redraw (compared as strings: ids from JSON can be anything). */
  function focusControl(key: string, action: string): void {
    [...list.querySelectorAll<HTMLElement>('[data-action]')]
      .find((el) => el.getAttribute('data-key') === key && el.dataset.action === action)
      ?.focus();
  }

  /** The replies about a suggestion and a box to add one (with the comments plugin). */
  function discussion(card: SuggestionCard, key: string, summaryId: string): HTMLElement | null {
    const c = comments;
    if (!c) return null;
    const thread = threadOf(card);
    const replies = thread?.comments ?? [];
    const replyList = replies.length
      ? h(
          'ul',
          { className: 'nova-sugg-replies' },
          ...replies.map((comment) => {
            const textId = uniqueId('nova-sugg-reply');
            return h(
              'li',
              { className: 'nova-sugg-reply' },
              h(
                'div',
                { className: 'nova-sugg-reply-head' },
                h(
                  'span',
                  { className: 'nova-sugg-reply-author' },
                  comment.author.name || labels.guest,
                ),
                when(comment.createdAt),
                thread && c.canEdit(comment)
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'nova-sugg-reply-delete',
                        'data-key': key + ':' + comment.id,
                        'data-action': 'delete-reply',
                        'aria-describedby': textId,
                        onClick: () => {
                          if (thread.comments.length > 1)
                            c.store.deleteComment(thread.id, comment.id);
                          else c.store.deleteThread(thread.id);
                          focusControl(key, 'reply');
                        },
                      },
                      c.labels.remove,
                    )
                  : null,
              ),
              h('p', { className: 'nova-sugg-reply-text', id: textId }, comment.text),
            );
          }),
        )
      : null;
    const label = thread ? c.labels.reply : c.labels.comment;
    const draft = drafts.get(key);
    if (!draft) {
      return h(
        'div',
        { className: 'nova-sugg-discussion' },
        replyList,
        h(
          'button',
          {
            type: 'button',
            className: 'nova-button nova-sugg-reply-open',
            'data-key': key,
            'data-action': 'reply',
            'aria-describedby': summaryId,
            onClick: () => {
              drafts.set(key, { text: '', start: 0, end: 0 });
              render();
              focusControl(key, 'draft');
            },
          },
          label,
        ),
      );
    }
    const placeholder = thread ? c.labels.replyPlaceholder : c.labels.placeholder;
    const input = h('textarea', {
      className: 'nova-input nova-sugg-reply-input',
      rows: 2,
      maxLength: COMMENT_MAX_LENGTH,
      placeholder,
      'aria-label': placeholder,
      'aria-describedby': summaryId,
      'data-key': key,
      'data-action': 'draft',
    }) as HTMLTextAreaElement;
    input.value = draft.text;
    const remember = () =>
      drafts.set(key, { text: input.value, start: input.selectionStart, end: input.selectionEnd });
    input.addEventListener('input', remember);
    input.addEventListener('select', remember);
    input.addEventListener('keyup', remember);
    const cancel = () => {
      drafts.delete(key);
      render();
      focusControl(key, 'reply');
    };
    const send = () => {
      const text = input.value.trim().slice(0, COMMENT_MAX_LENGTH);
      if (!text) return input.focus();
      drafts.delete(key);
      const current = threadOf(card);
      if (current) c.reply(current.id, text);
      else {
        const now = Date.now();
        c.store.createThread({
          id: newCommentId('t'),
          createdAt: now,
          resolved: null,
          suggestion: key,
          comments: [{ id: newCommentId(), author: c.author, text, createdAt: now }],
        });
      }
      render();
      focusControl(key, 'reply');
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        send();
      } else if (event.key === 'Escape') {
        // The reply box closes, not the panel.
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    });
    return h(
      'div',
      { className: 'nova-sugg-discussion' },
      replyList,
      h(
        'div',
        { className: 'nova-sugg-reply-box' },
        input,
        h(
          'div',
          { className: 'nova-sugg-reply-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'nova-button',
              'data-key': key,
              'data-action': 'cancel',
              onClick: cancel,
            },
            c.labels.cancel,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'nova-button nova-button-primary',
              'data-key': key,
              'data-action': 'send',
              onClick: send,
            },
            label,
          ),
        ),
      ),
    );
  }

  function renderFilter(): void {
    const counts = new Map<string, { name: string; count: number }>();
    for (const card of cards) {
      const key = authorKey(card.author);
      const entry = counts.get(key) ?? { name: nameOf(card.author), count: 0 };
      entry.count++;
      counts.set(key, entry);
      names.set(key, entry.name);
    }
    // The chosen author stays chosen with nothing left: "No suggestions from Ann", not everyone's.
    if (shownAuthor && !counts.has(shownAuthor)) {
      counts.set(shownAuthor, { name: names.get(shownAuthor) ?? '', count: 0 });
    }
    const options = [
      h('option', { value: '' }, labels.allAuthors.replace('{count}', String(cards.length))),
      ...[...counts].map(([key, { name, count }]) =>
        h(
          'option',
          { value: key },
          labels.authorCount.replace('{name}', name).replace('{count}', String(count)),
        ),
      ),
    ];
    select.replaceChildren(...options);
    select.value = shownAuthor;
  }

  function render(): void {
    // Focus survives the redraw: the same control of the same card, or the next card.
    const focused = activeElement(el);
    const focusKey = focused && el.contains(focused) ? focused.getAttribute('data-key') : null;
    const focusAction = focused?.getAttribute('data-action') ?? null;
    const oldKeys = [...list.querySelectorAll('[data-action="go"]')].map((b) =>
      b.getAttribute('data-key'),
    );

    cards = suggestionCards(editor.view.state.doc);
    renderFilter();
    const visible = shown();
    const { from, to } = editor.view.state.selection;
    list.replaceChildren(
      ...visible.map((card) =>
        cardElement(card, from <= card.to && to >= card.from && (from < card.to || to > card.from)),
      ),
    );
    empty.hidden = visible.length > 0;
    empty.textContent = shownAuthor
      ? labels.noneFrom.replace('{name}', names.get(shownAuthor) ?? '')
      : labels.none;
    const editable = editor.isEditable();
    acceptShown.disabled = rejectShown.disabled = !visible.length || !editable;
    // A disabled button loses focus: it goes to the filter instead of the page.
    if ((focused === acceptShown || focused === rejectShown) && acceptShown.disabled) {
      select.focus();
    }

    if (focusKey) {
      // Compared as strings, not in a selector: an id from JSON can be anything.
      const same = [...list.querySelectorAll<HTMLElement>('[data-action]')].find(
        (b) => b.getAttribute('data-key') === focusKey && b.dataset.action === focusAction,
      );
      if (same && !(same as HTMLButtonElement).disabled) {
        same.focus();
        // A reply box: the caret where it was.
        const draft = focusAction === 'draft' ? drafts.get(focusKey) : undefined;
        if (draft) (same as HTMLTextAreaElement).setSelectionRange(draft.start, draft.end);
      } else {
        // The card went (accepted or rejected): the card that took its place, or the last one.
        const index = oldKeys.indexOf(focusKey);
        const buttons = [...list.querySelectorAll<HTMLElement>('[data-action="go"]')];
        const next = buttons[Math.min(Math.max(index, 0), buttons.length - 1)];
        if (next) next.focus();
        else select.focus();
      }
    }
  }

  const offChange = editor.on('change', () => render());
  const offSelection = editor.on('selectionChange', () => {
    const { from, to } = editor.view.state.selection;
    list.querySelectorAll('.nova-sugg-card').forEach((item, index) => {
      const card = shown()[index];
      const active =
        !!card && from <= card.to && to >= card.from && (from < card.to || to > card.from);
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
  });
  const offEditable = editor.on('editableChange', () => render());

  return {
    el,
    render,
    destroy() {
      offChange();
      offSelection();
      offEditable();
      offThreads();
    },
  };
}
