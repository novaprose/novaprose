import { r as e, s as t } from './style.jq9nI6HT.js';
import './chunk-3UQTYDSY.0j1Eea0P.js';
import { A as n, O as r, k as i } from './chunk-N3URGMQ5.BakyJphD.js';
import { m as a } from './chunk-MTSFB6UL.BsO1pwz8.js';
import { i as o } from './chunk-YZ7YYYBN.B2vxnPKW.js';
import { t as s } from './chunk-NPKAIW34.BN8oA196.js';
import { t as c } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import { a as l, r as u } from './chunk-HZRIBOPW.C3RYobae.js';
import { T as d, n as f } from './dist.DtV7jSsK.js';
var p = 2e6;
function m(e) {
  let t = [];
  return (
    e.descendants((n, r) => {
      if (!n.isTextblock) return !0;
      let i = ``,
        a = [];
      return (
        n.forEach((e, t) => {
          let n = r + 1 + t;
          if (e.isText) {
            for (let t = 0; t < e.text.length; t += 1) a.push(n + t);
            i += e.text;
          } else {
            let t = e.type.spec.leafText?.(e) ?? ` `;
            for (let e = 0; e < t.length; e += 1) a.push(n);
            i += t;
          }
        }),
        t.push({
          pos: r,
          end: r + n.nodeSize - 1,
          depth: e.resolve(r).depth,
          type: n.type.name,
          text: i,
          chars: a,
        }),
        !1
      );
    }),
    t
  );
}
function h(e, t, n) {
  let r = e.length,
    i = t.length;
  if ((r + 1) * (i + 1) > p) return null;
  let a = new Uint32Array((r + 1) * (i + 1)),
    o = (e, t) => e * (i + 1) + t;
  for (let s = r - 1; s >= 0; --s)
    for (let r = i - 1; r >= 0; --r)
      a[o(s, r)] = n(e[s], t[r])
        ? a[o(s + 1, r + 1)] + 1
        : Math.max(a[o(s + 1, r)], a[o(s, r + 1)]);
  let s = [],
    c = 0,
    l = 0;
  for (; c < r && l < i;)
    n(e[c], t[l])
      ? (s.push([c, l]), (c += 1), (l += 1))
      : a[o(c + 1, l)] >= a[o(c, l + 1)]
        ? (c += 1)
        : (l += 1);
  return s;
}
var g = (e) => e.split(/(\s+)/).filter(Boolean);
function _(e, t, n) {
  if (t >= n) return;
  let r = e.added[e.added.length - 1];
  r && r.to >= t ? (r.to = Math.max(r.to, n)) : e.added.push({ from: t, to: n });
}
function v(e, t, n) {
  if (t.text === n.text) {
    t.text && _(e, t.chars[0], t.end);
    return;
  }
  let r = g(t.text),
    i = g(n.text),
    a = h(r, i, (e, t) => e === t);
  if (!a) {
    (t.text && _(e, t.chars[0], t.end),
      n.text && e.removed.push({ pos: t.end, text: n.text, block: !1 }));
    return;
  }
  let o = [],
    s = 0;
  for (let e of r) (o.push(s), (s += e.length));
  let c = (e) => (e < t.chars.length ? t.chars[e] : t.end),
    l = 0,
    u = 0,
    d = (n, a) => {
      let s = i.slice(u, n).join(``);
      if (s.trim()) {
        let n = a < r.length ? c(o[a]) : t.end;
        e.removed.push({ pos: n, text: s, block: !1 });
      }
      u = n;
    };
  for (let [t, n] of [...a, [r.length, i.length]]) {
    for (; l < t; l += 1) {
      if (!r[l].trim()) continue;
      let t = o[l];
      _(e, c(t), c(t + r[l].length - 1) + 1);
    }
    (d(n, t), (l = t + 1), (u = n + 1));
  }
}
function y(e, t, n) {
  return t ? (n >= t.depth ? t.pos : e.resolve(t.pos).before(n + 1)) : e.content.size;
}
function b(e, t) {
  let n = { added: [], removed: [] },
    r = m(e),
    i = m(t),
    a = h(r, i, (e, t) => e.type === t.type && e.text === t.text) ?? [],
    o = 0,
    s = 0;
  for (let [t, c] of [...a, [r.length, i.length]]) {
    let a = r.slice(o, t),
      l = i.slice(s, c),
      u = Math.min(a.length, l.length);
    for (let e = 0; e < u; e += 1) v(n, a[e], l[e]);
    for (let e of a.slice(u)) e.text && _(n, e.chars[0], e.end);
    for (let i of l.slice(u))
      i.text.trim() && n.removed.push({ pos: y(e, r[t], i.depth), text: i.text, block: !0 });
    ((o = t + 1), (s = c + 1));
  }
  return n;
}
var x = {
    en: {
      button: `Version history`,
      title: `Version history`,
      current: `Current version`,
      restore: `Restore this version`,
      close: `Close`,
      save: `Save version`,
      saved: `Version saved`,
      highlight: `Highlight changes`,
      onlyHere: `Only in this version`,
      onlyNow: `Only in the current text`,
      loading: `Loading…`,
      failed: `Could not load the version history.`,
      retry: `Try again`,
      empty: `No saved versions yet.`,
      restored: `Restored the version from {date}. Undo with Ctrl+Z.`,
      versions: `Versions`,
    },
    ru: {
      button: `История версий`,
      title: `История версий`,
      current: `Текущая версия`,
      restore: `Восстановить эту версию`,
      close: `Закрыть`,
      save: `Сохранить версию`,
      saved: `Версия сохранена`,
      highlight: `Показывать изменения`,
      onlyHere: `Только в этой версии`,
      onlyNow: `Только в текущем тексте`,
      loading: `Загрузка…`,
      failed: `Не удалось загрузить историю версий.`,
      retry: `Повторить`,
      empty: `Сохранённых версий пока нет.`,
      restored: `Восстановлена версия от {date}. Отменить — Ctrl+Z.`,
      versions: `Версии`,
    },
  },
  S = s.history,
  C = new e();
function w(e, n) {
  let r = typeof n == `string` ? n : C.serializeFragment(d.fromJSON(e.schema, n).content);
  return t(e.schema, r);
}
function T(e, t) {
  let s = o(e, `revisionhistory`, x),
    c = e.options.language ?? `en`,
    d = new Intl.DateTimeFormat(c, { dateStyle: `medium`, timeStyle: `short` }),
    p = l(`nova-history-title`),
    m = [],
    h = null,
    g = null,
    _ = !0,
    v = null,
    y = 0,
    S = u(`ol`, { className: `nova-history-list`, 'aria-label': s.versions }),
    C = u(`div`, { className: `nova-history-preview` }),
    T = u(`p`, { className: `nova-history-status`, role: `status` }),
    E = u(
      `button`,
      { type: `button`, className: `nova-button nova-button-primary`, disabled: !0 },
      s.restore,
    ),
    D = u(`input`, { type: `checkbox`, checked: !0 }),
    O = u(
      `div`,
      { className: `nova-history-legend` },
      u(`label`, { className: `nova-history-toggle` }, D, s.highlight),
      u(`span`, { className: `nova-history-swatch is-added` }, s.onlyHere),
      u(`span`, { className: `nova-history-swatch is-removed` }, s.onlyNow),
    ),
    k = t.save ? u(`button`, { type: `button`, className: `nova-button` }, s.save) : null,
    A = u(`button`, { type: `button`, className: `nova-button` }, s.close),
    j = u(
      `section`,
      { className: `nova-history`, role: `region`, 'aria-labelledby': p },
      u(
        `header`,
        { className: `nova-history-head` },
        u(`h2`, { id: p, className: `nova-history-title` }, s.title),
        O,
        u(`span`, { className: `nova-history-spacer` }),
        k,
        E,
        A,
      ),
      u(
        `div`,
        { className: `nova-history-body` },
        C,
        u(`aside`, { className: `nova-history-side` }, T, S),
      ),
    ),
    M = (t) => {
      if (!_ || !h) return i.empty;
      let { added: n, removed: a } = b(t, e.view.state.doc),
        o = [
          ...n.map((e) => r.inline(e.from, e.to, { class: `nova-diff-added` })),
          ...a.map((e) =>
            r.widget(
              e.pos,
              () => u(e.block ? `div` : `span`, { className: `nova-diff-removed` }, e.text),
              { side: -1, ignoreSelection: !0 },
            ),
          ),
        ];
      return i.create(t, o);
    },
    N = (e) => {
      g = e;
      let t = f.create({ doc: e }),
        r = M(e);
      v
        ? v.setProps({ state: t, decorations: () => r })
        : (v = new n(C, {
            state: t,
            editable: () => !1,
            decorations: () => r,
            attributes: {
              class: `nova-prosemirror nova-history-doc`,
              'aria-label': s.title,
              'aria-readonly': `true`,
            },
          }));
    },
    P = () => {
      let e = [
        { revision: null, title: s.current, detail: `` },
        ...[...m]
          .sort((e, t) => t.createdAt - e.createdAt)
          .map((e) => ({
            revision: e,
            title: d.format(e.createdAt),
            detail: (e.authors ?? []).join(`, `),
            ...(e.label ? { label: e.label } : {}),
          })),
      ];
      S.replaceChildren(
        ...e.map((e) => {
          let t = e.revision?.id === h?.id && !!e.revision == !!h,
            n = u(
              `button`,
              {
                type: `button`,
                className: `nova-history-item`,
                'aria-current': t ? `true` : null,
                tabindex: t ? `0` : `-1`,
                'data-revision': e.revision?.id ?? `current`,
              },
              u(`span`, { className: `nova-history-time` }, e.title),
              e.label ? u(`span`, { className: `nova-history-label` }, e.label) : null,
              e.detail ? u(`span`, { className: `nova-history-authors` }, e.detail) : null,
            );
          return (
            n.addEventListener(`click`, () => {
              (I(e.revision), F());
            }),
            u(`li`, {}, n)
          );
        }),
      );
    };
  function F() {
    S.querySelector(`.nova-history-item[aria-current="true"]`)?.focus();
  }
  async function I(n) {
    ((h = n), P(), (E.disabled = !0));
    let r = ++y;
    if (!n) N(e.view.state.doc);
    else {
      T.textContent = s.loading;
      try {
        let i = await t.load(n, e);
        if (r !== y) return;
        (N(w(e, i)), (T.textContent = ``), (E.disabled = !e.isEditable()));
      } catch {
        r === y && (T.textContent = s.failed);
      }
    }
  }
  async function L() {
    T.textContent = s.loading;
    try {
      ((m = (await t.list()).filter((e) => e && typeof e.id == `string`)),
        (T.textContent = m.length ? `` : s.empty),
        P());
    } catch {
      T.replaceChildren(
        s.failed,
        ` `,
        u(
          `button`,
          { type: `button`, className: `nova-link-btn`, onClick: () => void L() },
          s.retry,
        ),
      );
    }
  }
  function R() {
    (v?.destroy(), j.remove(), e.root.classList.remove(`nova-history-open`), e.focus());
  }
  return (
    E.addEventListener(`click`, () => {
      if (!h || !g) return;
      let n = h,
        { state: r } = e.view;
      (e.view.dispatch(a(r.tr.replaceWith(0, r.doc.content.size, g.content))),
        t.onRestore?.(n),
        e.ui.notify({ text: s.restored.replace(`{date}`, d.format(n.createdAt)), type: `success` }),
        R());
    }),
    k?.addEventListener(`click`, async () => {
      k.disabled = !0;
      try {
        (await t.save(), e.ui.notify({ text: s.saved, type: `success` }), await L(), F());
      } finally {
        k.disabled = !1;
      }
    }),
    A.addEventListener(`click`, R),
    D.addEventListener(`change`, () => {
      ((_ = D.checked), g && N(g));
    }),
    j.addEventListener(`keydown`, (e) => {
      if (e.key === `Escape`) {
        (e.preventDefault(), R());
        return;
      }
      let t = e.target;
      if (
        !t.classList.contains(`nova-history-item`) ||
        (e.key !== `ArrowDown` && e.key !== `ArrowUp`)
      )
        return;
      e.preventDefault();
      let n = [...S.querySelectorAll(`.nova-history-item`)],
        r = n[n.indexOf(t) + (e.key === `ArrowDown` ? 1 : -1)];
      (r?.click(), S.querySelector(`[data-revision="${r?.dataset.revision}"]`)?.focus());
    }),
    e.ui.closeOverlays(),
    e.root.classList.add(`nova-history-open`),
    e.root.append(j),
    I(null),
    L().then(() => {
      S.querySelector(`.nova-history-item`)?.focus();
    }),
    { close: R, element: j }
  );
}
var E = c({
  name: `revisionhistory`,
  toolbar: `revisionhistory`,
  setup(e) {
    let t = e.options.pluginOptions?.revisionhistory;
    if (!t?.list || !t.load) {
      console.warn(`[nova] revisionhistory: set pluginOptions.revisionhistory.list and .load`);
      return;
    }
    let n = o(e, `revisionhistory`, x),
      r = null,
      i = () => {
        r?.element.isConnected || (r = T(e, t));
      };
    return (
      e.ui.registry.addButton(`revisionhistory`, { icon: S, tooltip: n.button, onAction: i }),
      e.ui.registry.addMenuItem(`revisionhistory`, { text: n.button, icon: S, onAction: i }),
      () => r?.close()
    );
  },
});
export { x as LABELS, E as default };
