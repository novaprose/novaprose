import {
  C as e,
  D as t,
  E as n,
  S as r,
  T as i,
  _ as a,
  b as o,
  c as s,
  d as c,
  f as l,
  g as u,
  h as d,
  i as f,
  l as p,
  m,
  o as h,
  p as g,
  u as _,
  v,
  w as ee,
  x as y,
  y as b,
} from './chunk-N3URGMQ5.BakyJphD.js';
import {
  c as x,
  d as S,
  f as C,
  i as te,
  l as w,
  r as ne,
  u as T,
} from './chunk-MTSFB6UL.BsO1pwz8.js';
import { t as E } from './chunk-NPKAIW34.BN8oA196.js';
import { a as D, i as O, r as k, t as A } from './chunk-HZRIBOPW.C3RYobae.js';
import { C as j, a as M, c as N, i as P, r as F } from './dist.DtV7jSsK.js';
import { n as re } from './dist.FSNhl50G.js';
function I(e, t, n, r) {
  let { filePicker: i, filePickerTypes: a } = e.options;
  if (!i || (a && !a.includes(n))) return;
  let { input: o } = t,
    s = k(
      `button`,
      {
        type: `button`,
        className: `nova-btn nova-input-action`,
        'aria-label': e.ui.t(`dialog.browse`),
        title: e.ui.t(`dialog.browse`),
      },
      O(E.browse),
    ),
    c = k(`div`, { className: `nova-input-group` });
  (o.replaceWith(c),
    c.append(o, s),
    s.addEventListener(`click`, async () => {
      s.disabled = !0;
      try {
        let e = await i({ type: n, value: o.value });
        if (!e?.url) return;
        ((o.value = e.url), o.removeAttribute(`aria-invalid`), r?.(e));
      } catch (e) {
        console.error(`[nova] filePicker failed:`, e);
      } finally {
        ((s.disabled = !1), o.isConnected && o.focus());
      }
    }));
}
function ie(e) {
  let t = D(`nova-dialog-title`),
    n = k(`p`, { className: `nova-dialog-error`, role: `alert`, hidden: !0 }),
    r = k(
      `button`,
      { type: `submit`, className: `nova-button nova-button-primary`, hidden: !e.submitLabel },
      e.submitLabel ?? ``,
    ),
    i = k(`button`, { type: `button`, className: `nova-button` }, e.cancelLabel),
    a = k(
      `button`,
      { type: `button`, className: `nova-btn nova-dialog-close`, 'aria-label': e.closeLabel },
      O(E.close),
    ),
    o = k(
      `form`,
      {
        className: e.size === `large` ? `nova-dialog nova-dialog-large` : `nova-dialog`,
        role: `dialog`,
        'aria-modal': `true`,
        'aria-labelledby': t,
        novalidate: !0,
      },
      k(`header`, { className: `nova-dialog-header` }, k(`h2`, { id: t }, e.title), a),
      k(`div`, { className: `nova-dialog-body` }, e.body, n),
      k(`footer`, { className: `nova-dialog-footer` }, i, r),
    ),
    s = k(`div`, { className: `nova-dialog-backdrop` }, o);
  e.host.append(s);
  let c = !1,
    l = () => {
      c ||
        ((c = !0),
        s.remove(),
        document.removeEventListener(`focusin`, f, !0),
        e.onClose?.(),
        e.returnFocus?.());
    },
    u = (e) => {
      ((n.hidden = !e), (n.textContent = e ?? ``));
    },
    d = (e) => {
      ((r.disabled = e), o.setAttribute(`aria-busy`, String(e)));
    };
  (o.addEventListener(`submit`, async (t) => {
    (t.preventDefault(), u(null), d(!0));
    try {
      let t = !e.onSubmit || (await e.onSubmit());
      typeof t == `string` ? u(t) : t !== !1 && l();
    } finally {
      c || d(!1);
    }
  }),
    i.addEventListener(`click`, l),
    a.addEventListener(`click`, l),
    s.addEventListener(`mousedown`, (e) => {
      e.target === s && l();
    }),
    o.addEventListener(`keydown`, (e) => {
      if (e.key === `Escape`) (e.preventDefault(), e.stopPropagation(), l());
      else if (e.key === `Tab`) {
        let t = [...o.querySelectorAll(A)].filter((e) => !e.hidden),
          n = t[0],
          r = t[t.length - 1];
        if (!n || !r) return;
        e.shiftKey && document.activeElement === n
          ? (e.preventDefault(), r.focus())
          : !e.shiftKey && document.activeElement === r && (e.preventDefault(), n.focus());
      }
    }));
  let f = (e) => {
    o.contains(e.target) ||
      (
        o.querySelector(
          `a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`,
        ) ?? o
      ).focus();
  };
  return (
    document.addEventListener(`focusin`, f, !0),
    (
      e.initialFocus ??
      o.querySelector(`.nova-dialog-body input, .nova-dialog-body textarea`) ??
      (e.submitLabel ? r : i)
    ).focus(),
    { el: o, close: l, setError: u, setBusy: d }
  );
}
function L(e) {
  let t = D(`nova-field`),
    n = e.hint ? `${t}-hint` : void 0,
    r = k(`input`, {
      id: t,
      type: e.type ?? `text`,
      className: `nova-input`,
      value: e.value ?? ``,
      placeholder: e.placeholder,
      required: e.required ?? !1,
      autocomplete: e.autocomplete ?? `off`,
      spellcheck: `false`,
      'aria-describedby': n,
    });
  return (
    (r.value = e.value ?? ``),
    {
      el: k(
        `div`,
        { className: `nova-field` },
        k(`label`, { for: t, className: `nova-label` }, e.label),
        r,
        e.hint ? k(`p`, { id: n, className: `nova-hint` }, e.hint) : null,
      ),
      input: r,
    }
  );
}
function ae(e, t = !1) {
  let n = D(`nova-check`),
    r = k(`input`, { id: n, type: `checkbox`, className: `nova-checkbox` });
  return (
    (r.checked = t),
    {
      el: k(`div`, { className: `nova-field nova-field-inline` }, r, k(`label`, { for: n }, e)),
      input: r,
    }
  );
}
function oe(e) {
  let t = D(`nova-field`),
    n = k(
      `select`,
      { id: t, className: `nova-input nova-select` },
      ...e.options.map((e) => k(`option`, { value: e.value }, e.label)),
    );
  return (
    (n.value = e.value),
    {
      el: k(
        `div`,
        { className: `nova-field` },
        k(`label`, { for: t, className: `nova-label` }, e.label),
        n,
      ),
      select: n,
    }
  );
}
var se = /^image\/(png|jpe?g|gif|webp|avif|bmp)$/;
function R(e) {
  return se.test(e.type);
}
function z(e) {
  return new Promise((t, n) => {
    let r = new FileReader();
    ((r.onload = () => t(String(r.result))),
      (r.onerror = () => n(r.error ?? Error(`FileReader failed`))),
      r.readAsDataURL(e));
  });
}
function B(e, t) {
  let n = null;
  return (
    e.state.doc.descendants(
      (r, i) => n === null && (r.type === C(e.state).image && r.attrs.src === t && (n = i), !0),
    ),
    n
  );
}
function V(e, t, n) {
  let r = t.filter(R),
    i = e.view;
  for (let t of r) {
    let r = URL.createObjectURL(t),
      a = C(i.state).image.create({ src: r, alt: null }),
      o = i.state.tr;
    (n === void 0 ? o.replaceSelectionWith(a) : o.insert(Math.min(n, o.doc.content.size), a),
      i.dispatch(o.scrollIntoView()));
    let s = e.options.uploadImage,
      c = s ? e.ui.notify({ text: e.ui.t(`image.uploading`), timeout: 0 }) : null;
    (s ? s(t, (t) => c?.setText(`${e.ui.t(`image.uploading`)} ${Math.round(t)}%`)) : z(t))
      .then((e) => {
        if (!x(e)) throw Error(`Unsafe image URL returned: ${e}`);
        let t = B(i, r);
        if (t === null) return;
        let n = i.state.doc.nodeAt(t);
        i.dispatch(
          i.state.tr.setNodeMarkup(t, void 0, { ...n.attrs, src: e }).setMeta(`addToHistory`, !1),
        );
      })
      .catch((t) => {
        console.error(`[nova] image upload failed`, t);
        let n = B(i, r);
        (n !== null && i.dispatch(i.state.tr.delete(n, n + 1).setMeta(`addToHistory`, !1)),
          e.ui.notify({ text: e.ui.t(`image.uploadFailed`), type: `error` }));
      })
      .finally(() => {
        (c?.close(), URL.revokeObjectURL(r));
      });
  }
}
var H = /^data:(image\/(?:png|jpe?g|gif|webp|avif|bmp));base64,(.+)$/i;
function U(e, t = `pasted-image`) {
  let n = e.match(H);
  if (!n) return null;
  let r = n[1].toLowerCase();
  try {
    let e = atob(n[2]),
      i = new Uint8Array(e.length);
    for (let t = 0; t < e.length; t++) i[t] = e.charCodeAt(t);
    let a = r.split(`/`)[1].replace(`jpeg`, `jpg`);
    return new File([i], `${t}.${a}`, { type: r });
  } catch {
    return null;
  }
}
function W(e, t, n) {
  let r = e.state.tr;
  (e.state.doc.descendants((i, a) => {
    i.type === C(e.state).image &&
      i.attrs.src === t &&
      r.setNodeMarkup(a, void 0, { ...i.attrs, src: n });
  }),
    r.docChanged && e.dispatch(r.setMeta(`addToHistory`, !1)));
}
async function G(e, t) {
  let n = e.options.uploadImage,
    r = n ? U(t) : null;
  if (!n || !r) return;
  let i = e.ui.notify({ text: e.ui.t(`image.uploading`), timeout: 0 });
  try {
    let a = await n(r, (t) => i.setText(`${e.ui.t(`image.uploading`)} ${Math.round(t)}%`));
    if (!x(a)) throw Error(`Unsafe image URL returned: ${a}`);
    W(e.view, t, a);
  } catch (t) {
    (console.error(`[nova] embedded image upload failed`, t),
      e.ui.notify({ text: e.ui.t(`image.uploadFailed`), type: `error` }));
  } finally {
    i.close();
  }
}
function K(e, t) {
  let n = new Set();
  return (
    e.descendants((e) => {
      e.type === t && H.test(e.attrs.src) && n.add(e.attrs.src);
    }),
    n
  );
}
function ce(e) {
  return new P({
    key: new M(`nova-embedded-image-upload`),
    appendTransaction(t, n, r) {
      if (
        !e.options.uploadImage ||
        !t.some((e) => [`paste`, `drop`].includes(e.getMeta(`uiEvent`))) ||
        !t.some((e) => e.docChanged)
      )
        return null;
      let i = C(r).image,
        a = K(n.doc, i),
        o = [...K(r.doc, i)].filter((e) => !a.has(e));
      return (o.length && queueMicrotask(() => o.forEach((t) => void G(e, t))), null);
    },
  });
}
function le(e) {
  return new P({
    key: new M(`nova-image-drop-paste`),
    props: {
      handlePaste(t, n) {
        if (!e.isAllowed(`image`)) return !1;
        let r = n.clipboardData;
        if (!r || r.getData(`text/html`)) return !1;
        let i = [...r.files].filter(R);
        return i.length ? (V(e, i), !0) : !1;
      },
      handleDrop(t, n) {
        if (!e.isAllowed(`image`)) return !1;
        let r = [...(n.dataTransfer?.files ?? [])].filter(R);
        return r.length
          ? (n.preventDefault(),
            V(e, r, t.posAtCoords({ left: n.clientX, top: n.clientY })?.pos),
            !0)
          : !1;
      },
    },
  });
}
function ue(e) {
  let { t } = e.ui,
    n = k(`input`, {
      type: `file`,
      accept: `image/png,image/jpeg,image/gif,image/webp,image/avif`,
      className: `nova-visually-hidden`,
      tabindex: `-1`,
      'aria-label': t(`image.drop`),
      'aria-hidden': `true`,
    }),
    r = k(
      `button`,
      { type: `button`, className: `nova-dropzone` },
      O(E.upload),
      k(`span`, {}, t(`image.drop`)),
    ),
    i = L({ label: t(`image.url`), type: `url`, placeholder: `https://` }),
    a = L({ label: t(`image.alt`), hint: t(`image.altHint`) });
  I(e, i, `image`, (e) => {
    e.alt && (a.input.value = e.alt);
  });
  let o = k(
      `div`,
      { className: `nova-form` },
      r,
      n,
      k(`div`, { className: `nova-divider` }, k(`span`, {}, t(`image.or`))),
      i.el,
      a.el,
    ),
    s = e.ui.openDialog({
      title: t(`image.title`),
      body: o,
      submitLabel: t(`dialog.insert`),
      initialFocus: i.input,
      onSubmit: () => {
        let n = i.input.value.trim();
        return !n || !x(n)
          ? (i.input.setAttribute(`aria-invalid`, `true`), i.input.focus(), t(`image.invalid`))
          : (e.exec(te(n, a.input.value.trim() || void 0)), !0);
      },
    }),
    c = (t) => {
      let n = t.filter(R);
      n.length && (s.close(), V(e, n));
    };
  (r.addEventListener(`click`, () => n.click()),
    n.addEventListener(`change`, () => c([...(n.files ?? [])])),
    r.addEventListener(`dragover`, (e) => {
      (e.preventDefault(), r.classList.add(`is-dragover`));
    }),
    r.addEventListener(`dragleave`, () => r.classList.remove(`is-dragover`)),
    r.addEventListener(`drop`, (e) => {
      (e.preventDefault(),
        r.classList.remove(`is-dragover`),
        c([...(e.dataTransfer?.files ?? [])]));
    }));
}
function q(e) {
  let { selection: t } = e;
  return t instanceof F && t.node.type === C(e).image ? { node: t.node, pos: t.from } : null;
}
function J(e) {
  return (t, n) => {
    let r = q(t);
    if (!r) return !1;
    if (n) {
      let i = t.tr.setNodeMarkup(r.pos, void 0, { ...r.node.attrs, ...e });
      (i.setSelection(F.create(i.doc, r.pos)), n(i));
    }
    return !0;
  };
}
function de(e, t) {
  let n = q(e.view.state);
  if (!n) return !1;
  if (t === null) return e.exec(J({ width: null, height: null }));
  let r = e.view.nodeDOM(n.pos)?.querySelector(`img`) ?? null,
    i = getComputedStyle(e.view.dom),
    a =
      e.view.dom.clientWidth - parseFloat(i.paddingLeft || `0`) - parseFloat(i.paddingRight || `0`),
    o = Math.max(24, Math.round(a * t)),
    s = r && r.naturalWidth ? r.naturalHeight / r.naturalWidth : null;
  return e.exec(J({ width: o, height: s ? Math.round(o * s) : null }));
}
function fe(e) {
  let t = q(e.view.state);
  if (!t) return;
  let { t: n } = e.ui,
    r = L({ label: n(`image.alt`), value: t.node.attrs.alt ?? ``, hint: n(`image.altHint`) }),
    i = L({ label: n(`link.tooltip`), value: t.node.attrs.title ?? `` });
  e.ui.openDialog({
    title: n(`image.editAlt`),
    body: k(`div`, { className: `nova-form` }, r.el, i.el),
    submitLabel: n(`dialog.save`),
    initialFocus: r.input,
    onSubmit: () => (
      e.exec(J({ alt: r.input.value.trim() || null, title: i.input.value.trim() || null })),
      !0
    ),
  });
}
function Y(e) {
  let t = e.trim();
  return t
    ? /^[a-z][a-z0-9+.-]*:/i.test(t) || /^[/#?.]/.test(t)
      ? t
      : /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(t)
        ? `mailto:${t}`
        : /^(www\.)?[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i.test(t)
          ? `https://${t}`
          : t
    : ``;
}
function X(e) {
  let { from: t, to: n, empty: r, $from: i } = e.selection;
  return r ? (T(e, S(e).link, i.pos) ?? { from: t, to: n }) : { from: t, to: n };
}
function pe(e) {
  return (t, n) => {
    let r = Y(e.href);
    if (!r || !w(r)) return !1;
    if (!n) return !0;
    let { from: i, to: a } = X(t),
      o = S(t).link.create({ href: r, title: e.title || null, target: e.target || null }),
      s = t.doc.textBetween(i, a),
      c = e.text?.trim() ? e.text : null,
      l = t.tr;
    if (i === a || (c !== null && c !== s)) {
      let e = S(t).link.removeFromSet(t.doc.resolve(i).marks()),
        n = t.schema.text(c ?? (s || r), o.addToSet(e));
      l.replaceWith(i, a, n);
    } else l.removeMark(i, a, S(t).link).addMark(i, a, o);
    return (n(l.scrollIntoView()), !0);
  };
}
function me() {
  return (e, t) => {
    let { from: n, to: r } = X(e);
    return n === r || !e.doc.rangeHasMark(n, r, S(e).link)
      ? !1
      : (t?.(e.tr.removeMark(n, r, S(e).link)), !0);
  };
}
function he(e) {
  let { t } = e.ui,
    n = e.view.state,
    r = ne(n),
    i = X(n),
    a = n.doc.textBetween(i.from, i.to),
    o =
      !a.includes(`
`) && n.selection.$from.sameParent(n.doc.resolve(i.to)),
    s = L({
      label: t(`link.url`),
      type: `url`,
      value: r?.href ?? ``,
      placeholder: `https://`,
      required: !0,
    }),
    c = L({ label: t(`link.text`), value: a }),
    l = L({ label: t(`link.tooltip`), value: r?.title ?? `` }),
    u = ae(t(`link.newTab`), r?.target === `_blank`);
  I(e, s, `file`, (e) => {
    (e.text && !c.input.value.trim() && (c.input.value = e.text),
      e.title && (l.input.value = e.title));
  });
  let d = k(`div`, { className: `nova-form` }, s.el, o ? c.el : null, l.el, u.el);
  e.ui.openDialog({
    title: t(r ? `link.editTitle` : `link.title`),
    body: d,
    submitLabel: t(r ? `dialog.save` : `dialog.insert`),
    initialFocus: s.input,
    onSubmit: () => {
      let n = Y(s.input.value);
      return !n || !w(n)
        ? (s.input.setAttribute(`aria-invalid`, `true`), s.input.focus(), t(`link.invalid`))
        : (e.exec(
            pe({
              href: n,
              ...(o ? { text: c.input.value } : {}),
              title: l.input.value.trim() || null,
              target: u.input.checked ? `_blank` : null,
            }),
          ),
          !0);
    },
  });
}
var Z = 10;
function ge(e, t, n = !0, r = s) {
  let { table: i, table_row: a, table_cell: o, table_header: c, paragraph: l } = r.nodes,
    u = [];
  for (let r = 0; r < e; r++) {
    let e = n && r === 0 ? c : o,
      i = [];
    for (let n = 0; n < t; n++) i.push(e.create(null, l.create()));
    u.push(a.create(null, i));
  }
  return i.create(null, u);
}
function _e(e, t, n = !0) {
  return (r, i) => {
    if (e < 1 || t < 1 || e > 100 || t > 50 || y(r)) return !1;
    if (i) {
      let a = ge(e, t, n, r.schema),
        o = r.tr.replaceSelectionWith(a),
        s = -1;
      (o.doc.descendants((e, t) => (e === a && (s = t), s < 0)),
        s >= 0 && o.setSelection(N.near(o.doc.resolve(s + 3))),
        i(o.scrollIntoView()));
    }
    return !0;
  };
}
var ve = (e, t, n) => {
  if (!y(e)) return !1;
  if (o(1)(e, t, n) || !t) return !0;
  let r = e;
  return (
    g(e, (n) => {
      ((r = e.apply(n)), t(n));
    }),
    o(1)(r, t, n)
  );
};
function ye() {
  return [
    d({ cellMinWidth: 48, defaultCellMinWidth: 48, View: Oe }),
    n(),
    re({ Tab: ve, 'Shift-Tab': o(-1) }),
  ];
}
var be = {
  addRowBefore: m,
  addRowAfter: g,
  deleteRow: a,
  addColumnBefore: l,
  addColumnAfter: c,
  deleteColumn: u,
  mergeCells: r,
  splitCell: i,
  toggleHeaderRow: t(`row`),
  toggleHeaderColumn: t(`column`),
  deleteTable: v,
};
function xe(e) {
  return ee(`background`, e);
}
function Q(e) {
  if (!y(e)) return !1;
  let t = b(e.selection.$from)?.node.firstChild;
  if (!t || t.childCount === 0) return !1;
  let n = !0;
  return (
    t.forEach((t) => {
      t.type !== e.schema.nodes.table_header && (n = !1);
    }),
    n
  );
}
function Se(e) {
  if (!y(e)) return !1;
  let t = b(e.selection.$from)?.node;
  if (!t) return !1;
  let n = !0;
  return (
    t.forEach((t) => {
      t.firstChild?.type !== e.schema.nodes.table_header && (n = !1);
    }),
    n
  );
}
function Ce(e) {
  let { state: t } = e.view;
  if (!y(t)) return null;
  let n = b(t.selection.$from);
  return n ? (e.view.nodeDOM(n.pos)?.getBoundingClientRect() ?? null) : null;
}
function we(e, t, n) {
  let r = 1,
    i = 1,
    a = [],
    o = k(`div`, { className: `nova-grid-caption`, 'aria-live': `polite` }),
    s = k(`div`, { className: `nova-grid`, role: `grid`, 'aria-label': n }),
    c = () => {
      for (let e of a) {
        let t = Number(e.dataset.row),
          n = Number(e.dataset.col);
        (e.classList.toggle(`is-on`, t <= r && n <= i), (e.tabIndex = t === r && n === i ? 0 : -1));
      }
      o.textContent = t(r, i);
    };
  for (let n = 1; n <= Z; n++)
    for (let o = 1; o <= Z; o++) {
      let l = k(`button`, {
        type: `button`,
        className: `nova-grid-cell`,
        role: `gridcell`,
        'aria-label': t(n, o),
        'data-row': String(n),
        'data-col': String(o),
      });
      (l.addEventListener(`mouseenter`, () => {
        ((r = n), (i = o), c());
      }),
        l.addEventListener(`click`, () => e(n, o)),
        a.push(l),
        s.append(l));
    }
  return (
    s.addEventListener(`keydown`, (e) => {
      let t = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[
        e.key
      ];
      t &&
        (e.preventDefault(),
        (r = Math.min(Z, Math.max(1, r + t[0]))),
        (i = Math.min(Z, Math.max(1, i + t[1]))),
        c(),
        a[(r - 1) * Z + (i - 1)].focus());
    }),
    c(),
    k(`div`, { className: `nova-grid-panel` }, s, o)
  );
}
function Te(e) {
  let t = e
    .replace(/\s/g, ``)
    .replace(/^[^\d+-]+|[^\d]+$/g, ``)
    .replace(/,(?=\d{3}(?:\D|$))/g, ``)
    .replace(`,`, `.`);
  return /^[+-]?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}
function Ee(t) {
  if (!y(t)) return null;
  let n = e(t),
    r = n.table,
    i = !1;
  if (
    (r.descendants(
      (e) => (
        (e.attrs.colspan > 1 || e.attrs.rowspan > 1) && (i = !0),
        !i && e.type.spec.tableRole !== `cell` && e.type.spec.tableRole !== `header_cell`
      ),
    ),
    i)
  )
    return null;
  let a = t.schema.nodes,
    o = 0;
  for (let e = 0; e < r.childCount; e++) {
    let t = !0;
    if (
      (r.child(e).forEach((e) => {
        e.type !== a.table_header && (t = !1);
      }),
      !t)
    )
      break;
    o++;
  }
  return r.childCount - o < 2
    ? null
    : { pos: n.tableStart - 1, table: r, column: n.left, headerRows: o };
}
function De(e, t) {
  return (n, r) => {
    let i = Ee(n);
    if (!i) return !1;
    if (r) {
      let { table: a, column: o, headerRows: s, pos: c } = i,
        l = [];
      a.forEach((e) => l.push(e));
      let u = l.slice(0, s),
        d = l.slice(s),
        f = d.map((e) => (o < e.childCount ? e.child(o).textContent.trim() : ``)),
        p = f.map(Te),
        m = f.every((e, t) => e === `` || p[t] !== null),
        h = new Intl.Collator(t, { numeric: !0, sensitivity: `base` }),
        g = d
          .map((e, t) => ({ row: e, i: t }))
          .sort((t, n) => {
            let r = f[t.i],
              i = f[n.i];
            if (!r || !i) return r ? -1 : i ? 1 : t.i - n.i;
            let a = m ? p[t.i] - p[n.i] : h.compare(r, i);
            return (e === `asc` ? a : -a) || t.i - n.i;
          })
          .map(({ row: e }) => e),
        _ = a.copy(j.from([...u, ...g]));
      r(n.tr.replaceWith(c, c + a.nodeSize, _).scrollIntoView());
    }
    return !0;
  };
}
var Oe = class extends _ {
  constructor(e, t) {
    (super(e, t), this.apply(e));
  }
  update(e) {
    return super.update(e) ? (this.apply(e), !0) : !1;
  }
  apply(e) {
    let t = h.length(e.attrs.width);
    t && ((this.table.style.width = t), (this.table.style.minWidth = ``));
    let n = e.attrs.align;
    ((this.table.style.marginLeft = n ? `auto` : ``),
      (this.table.style.marginRight = n === `center` ? `auto` : ``));
    let r = f(e.attrs.class).class;
    r ? this.table.setAttribute(`class`, r) : this.table.removeAttribute(`class`);
  }
};
function ke(e) {
  let t = b(e.selection.$from);
  return t
    ? {
        width: t.node.attrs.width ?? null,
        align: t.node.attrs.align ?? null,
        class: t.node.attrs.class ?? null,
      }
    : null;
}
function Ae(e) {
  return (t, n) => {
    let r = b(t.selection.$from);
    if (!r || (e.width !== null && !h.length(e.width))) return !1;
    let i = { ...r.node.attrs, width: e.width, align: e.align };
    return (
      e.class !== void 0 && (i.class = f(e.class).class ?? null),
      n?.(t.tr.setNodeMarkup(r.pos, void 0, i)),
      !0
    );
  };
}
function $(e) {
  let t = [];
  if (e.selection instanceof p)
    return (e.selection.forEachCell((e, n) => t.push({ node: e, pos: n })), t);
  let { $from: n } = e.selection;
  for (let e = n.depth; e > 0; e--) {
    let r = n.node(e),
      i = r.type.spec.tableRole;
    if (i === `cell` || i === `header_cell`) {
      t.push({ node: r, pos: n.before(e) });
      break;
    }
  }
  return t;
}
function je(e) {
  let t = $(e)[0];
  if (!t) return null;
  let n = t.node.attrs.colwidth;
  return {
    valign: t.node.attrs.valign ?? null,
    header: t.node.type === e.schema.nodes.table_header,
    width: n?.[0] ?? null,
    class: t.node.attrs.class ?? null,
  };
}
function Me(t) {
  return (n, r) => {
    let i = $(n);
    if (!i.length || (t.width != null && !(t.width >= 24 && t.width <= 4e3))) return !1;
    if (!r) return !0;
    let a = n.schema.nodes,
      o = n.tr;
    for (let { pos: e, node: n } of i) {
      let r = t.header === void 0 ? n.type : t.header ? a.table_header : a.table_cell,
        i = {
          ...n.attrs,
          ...(t.valign === void 0 ? {} : { valign: t.valign }),
          ...(t.class === void 0 ? {} : { class: f(t.class).class ?? null }),
        };
      o.setNodeMarkup(e, r, i);
    }
    if (t.width !== void 0) {
      let r = e(n),
        i = r.map,
        a = new Set();
      for (let e = r.left; e < r.right; e++)
        for (let n = 0; n < i.height; n++) {
          let s = i.map[n * i.width + e],
            c = s * 1e3 + e;
          if (a.has(c)) continue;
          a.add(c);
          let l = r.tableStart + s,
            u = o.doc.nodeAt(l);
          if (!u) continue;
          let d = e - i.colCount(s),
            f = [...(u.attrs.colwidth ?? Array(u.attrs.colspan).fill(0))];
          ((f[d] = t.width ?? 0),
            o.setNodeMarkup(l, void 0, { ...u.attrs, colwidth: f.every((e) => !e) ? null : f }));
        }
    }
    return (r(o), !0);
  };
}
export {
  De as C,
  L as D,
  Ce as E,
  V as O,
  Ae as S,
  ye as T,
  oe as _,
  q as a,
  J as b,
  Q as c,
  R as d,
  ie as f,
  me as g,
  he as h,
  je as i,
  le as l,
  ue as m,
  we as n,
  ke as o,
  fe as p,
  ce as r,
  Se as s,
  I as t,
  _e as u,
  xe as v,
  be as w,
  de as x,
  Me as y,
};
