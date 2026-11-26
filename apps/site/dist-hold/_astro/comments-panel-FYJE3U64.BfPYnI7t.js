import { t as e } from './style.jq9nI6HT.js';
import { a as t, n, r } from './chunk-HZRIBOPW.C3RYobae.js';
var i = [`#2563eb`, `#db2777`, `#16a34a`, `#ea580c`, `#7c3aed`, `#0891b2`, `#ca8a04`, `#dc2626`];
function a(e) {
  let t = 0;
  for (let n of e) t = (t * 31 + n.charCodeAt(0)) | 0;
  return i[Math.abs(t) % i.length];
}
function o(e) {
  return (
    e
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((e) => [...e][0].toUpperCase())
      .join(``) || `?`
  );
}
function s(i) {
  let { editor: s, store: c, labels: l } = i,
    u = s.options.language ?? `en`,
    d = new Intl.RelativeTimeFormat(u, { numeric: `auto` }),
    f = new Intl.DateTimeFormat(u, { dateStyle: `medium`, timeStyle: `short` }),
    p = t(`nova-comments-title`),
    m = new Map(),
    h = new Map(),
    g = null,
    _ = !1,
    v = r(`div`, { className: `nova-comments-list` }),
    y = r(`span`, { className: `nova-comments-count` }),
    b = r(`input`, { type: `checkbox` });
  b.addEventListener(`change`, () => {
    ((_ = b.checked), k());
  });
  let x = r(
    `aside`,
    {
      className: `nova-comments`,
      'aria-labelledby': p,
      hidden: !0,
      onKeydown: (e) => {
        e.key === `Escape` &&
          (e.stopPropagation(), i.pending() ? i.cancelPending() : i.closePanel());
      },
    },
    r(
      `div`,
      { className: `nova-comments-head` },
      r(`h2`, { id: p, className: `nova-comments-title` }, l.panel),
      y,
      r(
        `button`,
        {
          type: `button`,
          className: `nova-btn nova-comments-close`,
          'aria-label': l.close,
          title: l.close,
          onClick: () => i.closePanel(),
        },
        `×`,
      ),
    ),
    r(`label`, { className: `nova-comments-filter` }, b, l.showResolved),
    v,
  );
  function S(e) {
    let t = Math.round((e - Date.now()) / 1e3),
      n = Math.abs(t),
      i =
        n < 45
          ? d.format(0, `second`)
          : n < 3600
            ? d.format(Math.round(t / 60), `minute`)
            : n < 86400
              ? d.format(Math.round(t / 3600), `hour`)
              : n < 604800
                ? d.format(Math.round(t / 86400), `day`)
                : f.format(e);
    return r(`time`, { dateTime: new Date(e).toISOString(), title: f.format(e) }, i);
  }
  function C(e, t) {
    let n = r(`span`, { className: `nova-comment-avatar`, 'aria-hidden': `true` }, o(t));
    return ((n.style.backgroundColor = a(e || t)), n);
  }
  function w(n) {
    let a = t(`nova-mention-list`),
      o = r(`textarea`, {
        className: `nova-input nova-comment-input`,
        rows: 2,
        maxlength: e,
        placeholder: n.placeholder,
        'aria-label': n.placeholder,
        'data-draft': n.key,
      });
    o.value = m.get(n.key) ?? n.initial ?? ``;
    let s = h.get(n.key) ?? new Map((n.initialMentions ?? []).map((e) => [e.id, e]));
    h.set(n.key, s);
    let c = r(
        `button`,
        { type: `button`, className: `nova-button nova-button-primary` },
        n.submitLabel,
      ),
      u = r(`ul`, {
        id: a,
        className: `nova-mention-list`,
        role: `listbox`,
        'aria-label': l.people,
        hidden: !0,
      }),
      d = [],
      f = 0,
      p = null,
      g = 0;
    i.findUsers &&
      (o.setAttribute(`role`, `combobox`),
      o.setAttribute(`aria-autocomplete`, `list`),
      o.setAttribute(`aria-controls`, a),
      o.setAttribute(`aria-expanded`, `false`));
    let _ = () => {
        ((p = null),
          (d = []),
          (u.hidden = !0),
          u.replaceChildren(),
          o.setAttribute(`aria-expanded`, `false`),
          o.removeAttribute(`aria-activedescendant`));
      },
      v = () => {
        if (!p) return _();
        (u.replaceChildren(
          ...(d.length
            ? d.map((e, t) => {
                let n = r(
                  `li`,
                  {
                    id: `${a}-${t}`,
                    role: `option`,
                    className: `nova-mention-option`,
                    'aria-selected': String(t === f),
                  },
                  C(e.id, e.name),
                  r(`span`, { className: `nova-mention-name` }, e.name),
                  e.description
                    ? r(`span`, { className: `nova-mention-detail` }, e.description)
                    : null,
                );
                return (
                  n.addEventListener(`mousedown`, (e) => {
                    (e.preventDefault(), b(t));
                  }),
                  n
                );
              })
            : [r(`li`, { className: `nova-mention-empty`, role: `presentation` }, l.noPeople)]),
        ),
          (u.hidden = !1),
          o.setAttribute(`aria-expanded`, `true`),
          d.length
            ? o.setAttribute(`aria-activedescendant`, `${a}-${f}`)
            : o.removeAttribute(`aria-activedescendant`));
      },
      y = () => {
        let e = i.findUsers;
        if (!e) return;
        let t = o.selectionStart ?? 0,
          n = o.value.slice(0, t),
          r = /(?:^|\s)@([\p{L}\p{N}_.-]{0,30})$/u.exec(n);
        if (!r) return _();
        let a = r[1] ?? ``;
        p = { start: t - a.length - 1, end: t };
        let s = ++g;
        e(a).then((e) => {
          s === g && p && ((d = e), (f = 0), v());
        });
      },
      b = (e) => {
        let t = d[e];
        if (!t || !p) return;
        let n = `@${t.name} `;
        o.value = o.value.slice(0, p.start) + n + o.value.slice(p.end);
        let r = p.start + n.length;
        (o.setSelectionRange(r, r), s.set(t.id, { id: t.id, name: t.name }), _(), x(), o.focus());
      },
      x = () => {
        (m.set(n.key, o.value), (c.disabled = o.value.trim() === ``));
      },
      S = () => {
        let e = o.value;
        e.trim() && (m.delete(n.key), h.delete(n.key), n.onSubmit(e, [...s.values()]));
      };
    (o.addEventListener(`input`, () => {
      (x(), y());
    }),
      o.addEventListener(`click`, y),
      o.addEventListener(`blur`, () => setTimeout(_, 0)),
      o.addEventListener(`keydown`, (e) => {
        if (p && !u.hidden) {
          if (e.key === `ArrowDown` || e.key === `ArrowUp`) {
            if ((e.preventDefault(), !d.length)) return;
            ((f = (f + (e.key === `ArrowDown` ? 1 : -1) + d.length) % d.length), v());
            return;
          }
          if (((e.key === `Enter` && !e.ctrlKey && !e.metaKey) || e.key === `Tab`) && d.length) {
            (e.preventDefault(), b(f));
            return;
          }
          if (e.key === `Escape`) {
            (e.preventDefault(), e.stopPropagation(), _());
            return;
          }
        }
        e.key === `Enter` && (e.ctrlKey || e.metaKey) && (e.preventDefault(), S());
      }),
      c.addEventListener(`click`, S),
      x());
    let w = n.onCancel
      ? r(
          `button`,
          {
            type: `button`,
            className: `nova-button`,
            onClick: () => {
              (m.delete(n.key), h.delete(n.key), n.onCancel());
            },
          },
          l.cancel,
        )
      : null;
    return r(
      `div`,
      { className: `nova-comment-composer` },
      r(`div`, { className: `nova-mention-wrap` }, o, u),
      r(`div`, { className: `nova-comment-actions` }, w, c),
    );
  }
  function T(e) {
    let t = r(`p`, { className: `nova-comment-text` }),
      n = (e.mentions ?? []).map((e) => `@${e.name}`).sort((e, t) => t.length - e.length);
    if (!n.length) return ((t.textContent = e.text), t);
    let i = n.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)),
      a = e.text.split(RegExp(`(${i.join(`|`)})`, `g`));
    return (
      t.append(
        ...a.map((e) => (n.includes(e) ? r(`span`, { className: `nova-comment-mention` }, e) : e)),
      ),
      t
    );
  }
  function E(e, t, n) {
    let a = i.canEdit(t),
      o = g?.threadId === e.id && g.commentId === t.id && a,
      s = t.author.id === i.author.id,
      u = r(
        `div`,
        { className: `nova-comment-head` },
        C(t.author.id, t.author.name),
        r(
          `span`,
          { className: `nova-comment-author` },
          t.author.name || l.guest,
          s ? r(`span`, { className: `nova-comment-you` }, ` (${l.you})`) : null,
        ),
        S(t.createdAt),
        t.editedAt ? r(`span`, { className: `nova-comment-edited` }, l.edited) : null,
      ),
      d = o
        ? w({
            key: `edit:${e.id}:${t.id}`,
            placeholder: l.placeholder,
            submitLabel: l.save,
            initial: t.text,
            initialMentions: t.mentions ?? [],
            onSubmit: (n) => {
              ((g = null), c.editComment(e.id, t.id, n.trim()));
            },
            onCancel: () => {
              ((g = null), k());
            },
          })
        : T(t),
      f =
        a && !o
          ? r(
              `div`,
              { className: `nova-comment-tools` },
              r(
                `button`,
                {
                  type: `button`,
                  className: `nova-link-btn`,
                  onClick: () => {
                    ((g = { threadId: e.id, commentId: t.id }), k(), O(`edit:${e.id}:${t.id}`));
                  },
                },
                l.edit,
              ),
              n > 0
                ? r(
                    `button`,
                    {
                      type: `button`,
                      className: `nova-link-btn`,
                      onClick: () => c.deleteComment(e.id, t.id),
                    },
                    l.remove,
                  )
                : null,
            )
          : null;
    return r(`div`, { className: `nova-comment-item` }, u, d, f);
  }
  function D(e) {
    let t = i.active() === e.id,
      n = i.quote(e.id),
      a = e.comments[0],
      o = !a || i.canEdit(a),
      s = r(
        `article`,
        {
          className: [
            `nova-thread`,
            t ? `is-active` : ``,
            e.resolved ? `is-resolved` : ``,
            n ? `` : `is-orphan`,
          ]
            .filter(Boolean)
            .join(` `),
          'data-thread': e.id,
          tabindex: `-1`,
          'aria-current': t ? `true` : null,
        },
        n
          ? r(`blockquote`, { className: `nova-thread-quote` }, n.slice(0, 140))
          : r(`p`, { className: `nova-thread-orphan` }, l.orphan),
        e.comments.map((t, n) => E(e, t, n)),
        e.resolved
          ? r(
              `p`,
              { className: `nova-thread-resolved` },
              l.resolvedBy.replace(`{name}`, e.resolved.by.name || l.guest),
            )
          : null,
        t && !e.resolved
          ? w({
              key: `reply:${e.id}`,
              placeholder: l.replyPlaceholder,
              submitLabel: l.reply,
              onSubmit: (t, n) => i.reply(e.id, t, n),
            })
          : null,
        r(
          `div`,
          { className: `nova-thread-tools` },
          r(
            `button`,
            {
              type: `button`,
              className: `nova-button`,
              onClick: () => i.setResolved(e.id, !e.resolved),
            },
            e.resolved ? l.reopen : l.resolve,
          ),
          o
            ? r(
                `button`,
                {
                  type: `button`,
                  className: `nova-button nova-button-danger`,
                  onClick: () => i.deleteThread(e.id),
                },
                l.deleteThread,
              )
            : null,
        ),
      );
    return (
      s.addEventListener(`click`, (t) => {
        t.target.closest(`button, textarea, input, a`) ||
          (i.active() !== e.id && i.setActive(e.id, !0));
      }),
      s
    );
  }
  function O(e) {
    let t = v.querySelector(`textarea[data-draft="${e}"]`);
    t && (t.focus(), t.setSelectionRange(t.value.length, t.value.length));
  }
  function k() {
    let e = v.contains(document.activeElement)
        ? document.activeElement.getAttribute(`data-draft`)
        : null,
      t = [...c.threads()].sort(
        (e, t) => i.positionOf(e.id) - i.positionOf(t.id) || e.createdAt - t.createdAt,
      ),
      a = t.filter((e) => !e.resolved),
      o = _ ? t : a;
    ((y.textContent = a.length ? String(a.length) : ``),
      y.setAttribute(`aria-label`, l.count.replace(`{count}`, String(a.length))));
    let s = [];
    (i.pending() &&
      s.push(
        r(
          `article`,
          { className: `nova-thread is-active is-new` },
          r(
            `div`,
            { className: `nova-comment-head` },
            C(i.author.id, i.author.name),
            r(`span`, { className: `nova-comment-author` }, i.author.name),
          ),
          w({
            key: `new`,
            placeholder: l.placeholder,
            submitLabel: l.comment,
            onSubmit: (e, t) => i.submitPending(e, t),
            onCancel: () => i.cancelPending(),
          }),
        ),
      ),
      s.push(...o.map(D)),
      s.length === 0 &&
        s.push(
          r(
            `p`,
            { className: `nova-comments-empty` },
            l.empty.replace(`{shortcut}`, n(i.shortcut)),
          ),
        ),
      v.replaceChildren(...s),
      e && O(e),
      v.querySelector(`.nova-thread.is-active`)?.scrollIntoView?.({ block: `nearest` }));
  }
  return { el: x, render: k, focusComposer: () => O(`new`), destroy: () => x.remove() };
}
export { s as createCommentsPanel };
