import type { Comment, CommentAuthor, CommentThread } from '../comments';
import { COMMENT_MAX_LENGTH } from '../comments';
import { activeElement, formatShortcut, h, uniqueId } from '../ui/dom';
import type { CommentsController } from './comments';
import type { MentionUser } from './mentions';
import css from './comments-panel.css?raw';

/**
 * Панель обсуждений (грузится лениво при первом открытии). Все данные пользователей — только через
 * textContent (h()), без innerHTML: комментарии пишут другие люди.
 */

const PALETTE = [
  '#2563eb',
  '#db2777',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
];

function colorFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => [...word][0]!.toUpperCase()).join('') || '?';
}

export function createCommentsPanel(controller: CommentsController) {
  const { editor, store, labels } = controller;
  editor.ui.addStyles('nova-comments-panel', css);
  const lang = editor.options.language ?? 'en';
  const relative = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const absolute = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
  const titleId = uniqueId('nova-comments-title');

  // Черновики ответов и правок переживают перерисовку (приходят чужие комментарии).
  const drafts = new Map<string, string>();
  const draftMentions = new Map<string, Map<string, CommentAuthor>>();
  let editing: { threadId: string; commentId: string } | null = null;
  let showResolved = false;

  const list = h('div', { className: 'nova-comments-list' });
  const countEl = h('span', { className: 'nova-comments-count' });
  const resolvedToggle = h('input', { type: 'checkbox' });
  resolvedToggle.addEventListener('change', () => {
    showResolved = resolvedToggle.checked;
    render();
  });

  const el = h(
    'aside',
    {
      className: 'nova-comments',
      'aria-labelledby': titleId,
      hidden: true,
      onKeydown: ((event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        if (controller.pending()) controller.cancelPending();
        else controller.closePanel();
      }) as EventListener,
    },
    h(
      'div',
      { className: 'nova-comments-head' },
      h('h2', { id: titleId, className: 'nova-comments-title' }, labels.panel),
      countEl,
      h(
        'button',
        {
          type: 'button',
          className: 'nova-btn nova-comments-close',
          'aria-label': labels.close,
          title: labels.close,
          onClick: () => controller.closePanel(),
        },
        '×',
      ),
    ),
    h('label', { className: 'nova-comments-filter' }, resolvedToggle, labels.showResolved),
    list,
  );

  function when(time: number): HTMLTimeElement {
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

  function avatar(id: string, name: string) {
    const span = h(
      'span',
      { className: 'nova-comment-avatar', 'aria-hidden': 'true' },
      initials(name),
    );
    span.style.backgroundColor = colorFor(id || name);
    return span;
  }

  /**
   * Поле ввода с кнопками; Ctrl/Cmd+Enter — отправить. «@» — список людей (combobox: стрелки, Enter/Tab,
   * Esc), выбранный человек вставляется как «@Имя» и попадает в mentions комментария.
   */
  function composer(opts: {
    key: string;
    placeholder: string;
    submitLabel: string;
    onSubmit: (text: string, mentions: CommentAuthor[]) => void;
    onCancel?: () => void;
    initial?: string;
    initialMentions?: CommentAuthor[];
  }) {
    const listId = uniqueId('nova-mention-list');
    const textarea = h('textarea', {
      className: 'nova-input nova-comment-input',
      rows: 2,
      maxlength: COMMENT_MAX_LENGTH,
      placeholder: opts.placeholder,
      'aria-label': opts.placeholder,
      'data-draft': opts.key,
    });
    textarea.value = drafts.get(opts.key) ?? opts.initial ?? '';
    const chosen =
      draftMentions.get(opts.key) ?? new Map((opts.initialMentions ?? []).map((m) => [m.id, m]));
    draftMentions.set(opts.key, chosen);
    const submitBtn = h(
      'button',
      { type: 'button', className: 'nova-button nova-button-primary' },
      opts.submitLabel,
    );

    // ----- «@»-подсказки -----
    const list = h('ul', {
      id: listId,
      className: 'nova-mention-list',
      role: 'listbox',
      'aria-label': labels.people,
      hidden: true,
    });
    let users: MentionUser[] = [];
    let active = 0;
    let query: { start: number; end: number } | null = null;
    let request = 0;
    if (controller.findUsers) {
      textarea.setAttribute('role', 'combobox');
      textarea.setAttribute('aria-autocomplete', 'list');
      textarea.setAttribute('aria-controls', listId);
      textarea.setAttribute('aria-expanded', 'false');
    }
    const closeList = () => {
      query = null;
      users = [];
      list.hidden = true;
      list.replaceChildren();
      textarea.setAttribute('aria-expanded', 'false');
      textarea.removeAttribute('aria-activedescendant');
    };
    const renderList = () => {
      if (!query) return closeList();
      list.replaceChildren(
        ...(users.length
          ? users.map((user, index) => {
              const option = h(
                'li',
                {
                  id: `${listId}-${index}`,
                  role: 'option',
                  className: 'nova-mention-option',
                  'aria-selected': String(index === active),
                },
                avatar(user.id, user.name),
                h('span', { className: 'nova-mention-name' }, user.name),
                user.description
                  ? h('span', { className: 'nova-mention-detail' }, user.description)
                  : null,
              );
              // mousedown: поле не теряет фокус до выбора.
              option.addEventListener('mousedown', (event) => {
                event.preventDefault();
                pick(index);
              });
              return option;
            })
          : [h('li', { className: 'nova-mention-empty', role: 'presentation' }, labels.noPeople)]),
      );
      list.hidden = false;
      textarea.setAttribute('aria-expanded', 'true');
      if (users.length) textarea.setAttribute('aria-activedescendant', `${listId}-${active}`);
      else textarea.removeAttribute('aria-activedescendant');
    };
    const updateQuery = () => {
      const findUsers = controller.findUsers;
      if (!findUsers) return;
      const caret = textarea.selectionStart ?? 0;
      const before = textarea.value.slice(0, caret);
      const match = /(?:^|\s)@([\p{L}\p{N}_.-]{0,30})$/u.exec(before);
      if (!match) return closeList();
      const text = match[1] ?? '';
      query = { start: caret - text.length - 1, end: caret };
      const id = ++request;
      void findUsers(text).then((result) => {
        if (id !== request || !query) return;
        users = result;
        active = 0;
        renderList();
      });
    };
    const pick = (index: number) => {
      const user = users[index];
      if (!user || !query) return;
      const insert = `@${user.name} `;
      textarea.value =
        textarea.value.slice(0, query.start) + insert + textarea.value.slice(query.end);
      const caret = query.start + insert.length;
      textarea.setSelectionRange(caret, caret);
      chosen.set(user.id, { id: user.id, name: user.name });
      closeList();
      sync();
      textarea.focus();
    };

    const sync = () => {
      drafts.set(opts.key, textarea.value);
      submitBtn.disabled = textarea.value.trim() === '';
    };
    const submit = () => {
      const text = textarea.value;
      if (!text.trim()) return;
      drafts.delete(opts.key);
      draftMentions.delete(opts.key);
      opts.onSubmit(text, [...chosen.values()]);
    };
    textarea.addEventListener('input', () => {
      sync();
      updateQuery();
    });
    textarea.addEventListener('click', updateQuery);
    textarea.addEventListener('blur', () => setTimeout(closeList, 0));
    textarea.addEventListener('keydown', (event) => {
      if (query && !list.hidden) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!users.length) return;
          active = (active + (event.key === 'ArrowDown' ? 1 : -1) + users.length) % users.length;
          renderList();
          return;
        }
        if ((event.key === 'Enter' && !event.ctrlKey && !event.metaKey) || event.key === 'Tab') {
          if (users.length) {
            event.preventDefault();
            pick(active);
            return;
          }
        }
        if (event.key === 'Escape') {
          // Закрыть только список, не панель и не черновик.
          event.preventDefault();
          event.stopPropagation();
          closeList();
          return;
        }
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submit();
      }
    });
    submitBtn.addEventListener('click', submit);
    sync();
    const cancel = opts.onCancel
      ? h(
          'button',
          {
            type: 'button',
            className: 'nova-button',
            onClick: () => {
              drafts.delete(opts.key);
              draftMentions.delete(opts.key);
              opts.onCancel!();
            },
          },
          labels.cancel,
        )
      : null;
    return h(
      'div',
      { className: 'nova-comment-composer' },
      h('div', { className: 'nova-mention-wrap' }, textarea, list),
      h('div', { className: 'nova-comment-actions' }, cancel, submitBtn),
    );
  }

  /** Текст комментария: «@Имя» упомянутых — отдельным span (только textContent, без разметки). */
  function commentText(comment: Comment) {
    const p = h('p', { className: 'nova-comment-text' });
    const names = (comment.mentions ?? [])
      .map((m) => `@${m.name}`)
      .sort((a, b) => b.length - a.length);
    if (!names.length) {
      p.textContent = comment.text;
      return p;
    }
    const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const parts = comment.text.split(new RegExp(`(${escaped.join('|')})`, 'g'));
    p.append(
      ...parts.map((part) =>
        names.includes(part) ? h('span', { className: 'nova-comment-mention' }, part) : part,
      ),
    );
    return p;
  }

  function commentView(thread: CommentThread, comment: Comment, index: number) {
    const mine = controller.canEdit(comment);
    const isEditing = editing?.threadId === thread.id && editing.commentId === comment.id && mine;
    const isSelf = comment.author.id === controller.author.id;
    const head = h(
      'div',
      { className: 'nova-comment-head' },
      avatar(comment.author.id, comment.author.name),
      h(
        'span',
        { className: 'nova-comment-author' },
        comment.author.name || labels.guest,
        isSelf ? h('span', { className: 'nova-comment-you' }, ` (${labels.you})`) : null,
      ),
      when(comment.createdAt),
      comment.editedAt ? h('span', { className: 'nova-comment-edited' }, labels.edited) : null,
    );
    const body = isEditing
      ? composer({
          key: `edit:${thread.id}:${comment.id}`,
          placeholder: labels.placeholder,
          submitLabel: labels.save,
          initial: comment.text,
          initialMentions: comment.mentions ?? [],
          onSubmit: (text) => {
            editing = null;
            store.editComment(thread.id, comment.id, text.trim());
          },
          onCancel: () => {
            editing = null;
            render();
          },
        })
      : commentText(comment);
    const actions =
      mine && !isEditing
        ? h(
            'div',
            { className: 'nova-comment-tools' },
            h(
              'button',
              {
                type: 'button',
                className: 'nova-link-btn',
                onClick: () => {
                  editing = { threadId: thread.id, commentId: comment.id };
                  render();
                  focusDraft(`edit:${thread.id}:${comment.id}`);
                },
              },
              labels.edit,
            ),
            // Первый комментарий удаляется вместе с обсуждением.
            index > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'nova-link-btn',
                    onClick: () => store.deleteComment(thread.id, comment.id),
                  },
                  labels.remove,
                )
              : null,
          )
        : null;
    return h('div', { className: 'nova-comment-item' }, head, body, actions);
  }

  function threadView(thread: CommentThread) {
    const active = controller.active() === thread.id;
    const quote = controller.quote(thread.id);
    const first = thread.comments[0];
    const canDeleteThread = first ? controller.canEdit(first) : true;
    const card = h(
      'article',
      {
        className: [
          'nova-thread',
          active ? 'is-active' : '',
          thread.resolved ? 'is-resolved' : '',
          quote ? '' : 'is-orphan',
        ]
          .filter(Boolean)
          .join(' '),
        'data-thread': thread.id,
        tabindex: '-1',
        'aria-current': active ? 'true' : null,
      },
      quote
        ? h('blockquote', { className: 'nova-thread-quote' }, quote.slice(0, 140))
        : h('p', { className: 'nova-thread-orphan' }, labels.orphan),
      thread.comments.map((comment, index) => commentView(thread, comment, index)),
      thread.resolved
        ? h(
            'p',
            { className: 'nova-thread-resolved' },
            labels.resolvedBy.replace('{name}', thread.resolved.by.name || labels.guest),
          )
        : null,
      active && !thread.resolved
        ? composer({
            key: `reply:${thread.id}`,
            placeholder: labels.replyPlaceholder,
            submitLabel: labels.reply,
            onSubmit: (text, mentions) => controller.reply(thread.id, text, mentions),
          })
        : null,
      h(
        'div',
        { className: 'nova-thread-tools' },
        h(
          'button',
          {
            type: 'button',
            className: 'nova-button',
            onClick: () => controller.setResolved(thread.id, !thread.resolved),
          },
          thread.resolved ? labels.reopen : labels.resolve,
        ),
        canDeleteThread
          ? h(
              'button',
              {
                type: 'button',
                className: 'nova-button nova-button-danger',
                onClick: () => controller.deleteThread(thread.id),
              },
              labels.deleteThread,
            )
          : null,
      ),
    );
    // Клик по карточке — выделить её фрагмент в тексте (кнопки и поля работают как обычно).
    card.addEventListener('click', (event) => {
      if ((event.target as Element).closest('button, textarea, input, a')) return;
      if (controller.active() !== thread.id) controller.setActive(thread.id, true);
    });
    return card;
  }

  function focusDraft(key: string) {
    const field = list.querySelector<HTMLTextAreaElement>(`textarea[data-draft="${key}"]`);
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }

  function render() {
    // Фокус в поле ввода сохраняется при перерисовке (пришёл чужой комментарий, пока вы пишете).
    const active = activeElement(list);
    const focused = list.contains(active)
      ? (active as HTMLElement).getAttribute('data-draft')
      : null;
    const threads = [...store.threads()].sort(
      (a, b) =>
        controller.positionOf(a.id) - controller.positionOf(b.id) || a.createdAt - b.createdAt,
    );
    const open = threads.filter((t) => !t.resolved);
    const visible = showResolved ? threads : open;
    countEl.textContent = open.length ? String(open.length) : '';
    countEl.setAttribute('aria-label', labels.count.replace('{count}', String(open.length)));

    const children: HTMLElement[] = [];
    if (controller.pending()) {
      children.push(
        h(
          'article',
          { className: 'nova-thread is-active is-new' },
          h(
            'div',
            { className: 'nova-comment-head' },
            avatar(controller.author.id, controller.author.name),
            h('span', { className: 'nova-comment-author' }, controller.author.name),
          ),
          composer({
            key: 'new',
            placeholder: labels.placeholder,
            submitLabel: labels.comment,
            onSubmit: (text, mentions) => controller.submitPending(text, mentions),
            onCancel: () => controller.cancelPending(),
          }),
        ),
      );
    }
    children.push(...visible.map(threadView));
    if (children.length === 0) {
      children.push(
        h(
          'p',
          { className: 'nova-comments-empty' },
          labels.empty.replace('{shortcut}', formatShortcut(controller.shortcut)),
        ),
      );
    }
    list.replaceChildren(...children);
    if (focused) focusDraft(focused);
    list.querySelector('.nova-thread.is-active')?.scrollIntoView?.({ block: 'nearest' });
  }

  return {
    el,
    render,
    focusComposer: () => focusDraft('new'),
    destroy: () => el.remove(),
  };
}
