const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      '_astro/comments-panel-FYJE3U64.BfPYnI7t.js',
      '_astro/chunk-HZRIBOPW.C3RYobae.js',
      '_astro/insertdatetime-LKTWT7MA.C-BbRcTe.js',
      '_astro/chunk-YZ7YYYBN.B2vxnPKW.js',
      '_astro/chunk-NPKAIW34.BN8oA196.js',
      '_astro/chunk-HPLT3XRZ.CB2AI2JC.js',
      '_astro/quickbars-PVI52W5H.rPziGAm7.js',
      '_astro/chunk-3UQTYDSY.0j1Eea0P.js',
      '_astro/chunk-N3URGMQ5.BakyJphD.js',
      '_astro/chunk-MTSFB6UL.BsO1pwz8.js',
      '_astro/dist.DtV7jSsK.js',
      '_astro/dist.FSNhl50G.js',
      '_astro/charmap-55GPGFWU.Cv0x_EtD.js',
      '_astro/emoticons-VEII2TBC.CHGrHtvg.js',
      '_astro/nonbreaking-Y2DLPICJ.BQNFVfoW.js',
      '_astro/autolink-HEW6PESF.3H9qPow3.js',
      '_astro/autosave-M6X4HMFR.DSzdL2hD.js',
      '_astro/autoresize-UB3GOA6D.lrs5nFnM.js',
      '_astro/visualblocks-R5HS5B72.DW0PuACa.js',
      '_astro/directionality-X7GELLYQ.BVQF7PJK.js',
      '_astro/advlist-NF44TRHY.BrwsvnFP.js',
      '_astro/revisionhistory-PCXW6IME.CzBejrt9.js',
    ]),
) => i.map((i) => d[i]);
import {
  C as e,
  D as t,
  S as n,
  T as r,
  _ as i,
  a,
  c as o,
  h as s,
  i as c,
  k as l,
  n as u,
  o as d,
  p as f,
  r as p,
  t as m,
  v as h,
  x as g,
} from './dist.DtV7jSsK.js';
import {
  _,
  a as v,
  b as y,
  c as b,
  d as x,
  f as S,
  g as ee,
  h as te,
  l as ne,
  n as re,
  o as ie,
  p as ae,
  r as oe,
  s as se,
  t as C,
  u as ce,
  v as le,
  y as ue,
} from './chunk-MTSFB6UL.BsO1pwz8.js';
import {
  A as de,
  O as w,
  a as fe,
  c as pe,
  i as me,
  k as he,
  o as T,
  s as E,
  t as ge,
  x as _e,
} from './chunk-N3URGMQ5.BakyJphD.js';
import { n as D, t as ve } from './dist.FSNhl50G.js';
import { t as O } from './chunk-NPKAIW34.BN8oA196.js';
import { a as ye, i as k, n as be, r as A } from './chunk-HZRIBOPW.C3RYobae.js';
import {
  C as xe,
  D as j,
  E as Se,
  S as Ce,
  T as we,
  _ as Te,
  a as Ee,
  b as De,
  c as Oe,
  f as ke,
  g as Ae,
  h as je,
  i as Me,
  l as Ne,
  m as Pe,
  n as Fe,
  o as Ie,
  p as Le,
  r as Re,
  s as ze,
  t as Be,
  u as M,
  v as Ve,
  w as N,
  x as He,
  y as Ue,
} from './chunk-3UQTYDSY.0j1Eea0P.js';
import { i as P, t as We } from './chunk-YZ7YYYBN.B2vxnPKW.js';
import { a as F, i as Ge, o as Ke, r as qe, t as I } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import { t as L } from './preload-helper.DygEbaNj.js';
function Je(e = {}) {
  return new c({
    view(t) {
      return new Ye(t, e);
    },
  });
}
var Ye = class {
    constructor(e, t) {
      ((this.editorView = e),
        (this.cursorPos = null),
        (this.element = null),
        (this.timeout = -1),
        (this.lastDragEvent = null),
        (this.width = t.width ?? 1),
        (this.color = t.color === !1 ? void 0 : t.color || `black`),
        (this.class = t.class),
        (this.handlers = [`dragover`, `dragend`, `drop`, `dragleave`].map((t) => {
          let n = (e) => {
            this[t](e);
          };
          return (e.dom.addEventListener(t, n), { name: t, handler: n });
        })));
    }
    destroy() {
      (this.setCursor(null),
        this.handlers.forEach(({ name: e, handler: t }) =>
          this.editorView.dom.removeEventListener(e, t),
        ));
    }
    update(e, t) {
      if (this.cursorPos != null && t.doc != e.state.doc) {
        if (this.lastDragEvent) {
          let e = this.computeTarget(this.lastDragEvent);
          e == this.cursorPos ? this.updateOverlay() : this.setCursor(e);
        } else this.updateOverlay();
      }
    }
    setCursor(e) {
      e != this.cursorPos &&
        ((this.cursorPos = e),
        e == null
          ? (this.element.parentNode.removeChild(this.element), (this.element = null))
          : this.updateOverlay());
    }
    updateOverlay() {
      let e = this.editorView.state.doc.resolve(this.cursorPos),
        t = !e.parent.inlineContent,
        n,
        r = this.editorView.dom,
        i = r.getBoundingClientRect(),
        a = i.width / r.offsetWidth,
        o = i.height / r.offsetHeight;
      if (t) {
        let t = e.nodeBefore,
          r = e.nodeAfter;
        if (t || r) {
          let e = this.editorView.nodeDOM(this.cursorPos - (t ? t.nodeSize : 0));
          if (e) {
            let i = e.getBoundingClientRect(),
              a = t ? i.bottom : i.top;
            t &&
              r &&
              (a = (a + this.editorView.nodeDOM(this.cursorPos).getBoundingClientRect().top) / 2);
            let s = (this.width / 2) * o;
            n = { left: i.left, right: i.right, top: a - s, bottom: a + s };
          }
        }
      }
      if (!n) {
        let e = this.editorView.coordsAtPos(this.cursorPos),
          t = (this.width / 2) * a;
        n = { left: e.left - t, right: e.left + t, top: e.top, bottom: e.bottom };
      }
      let s = this.editorView.dom.offsetParent;
      (this.element ||
        ((this.element = s.appendChild(document.createElement(`div`))),
        this.class && (this.element.className = this.class),
        (this.element.style.cssText = `position: absolute; z-index: 50; pointer-events: none;`),
        this.color && (this.element.style.backgroundColor = this.color)),
        this.element.classList.toggle(`prosemirror-dropcursor-block`, t),
        this.element.classList.toggle(`prosemirror-dropcursor-inline`, !t));
      let c, l;
      if (!s || (s == document.body && getComputedStyle(s).position == `static`))
        ((c = -pageXOffset), (l = -pageYOffset));
      else {
        let e = s.getBoundingClientRect(),
          t = e.width / s.offsetWidth,
          n = e.height / s.offsetHeight;
        ((c = e.left - s.scrollLeft * t), (l = e.top - s.scrollTop * n));
      }
      ((this.element.style.left = (n.left - c) / a + `px`),
        (this.element.style.top = (n.top - l) / o + `px`),
        (this.element.style.width = (n.right - n.left) / a + `px`),
        (this.element.style.height = (n.bottom - n.top) / o + `px`));
    }
    scheduleRemoval(e) {
      (clearTimeout(this.timeout), (this.timeout = setTimeout(() => this.setCursor(null), e)));
    }
    computeTarget(e) {
      let t = this.editorView.posAtCoords({ left: e.clientX, top: e.clientY }),
        n = t && t.inside >= 0 && this.editorView.state.doc.nodeAt(t.inside),
        r = n && n.type.spec.disableDropCursor,
        a = typeof r == `function` ? r(this.editorView, t, e) : r;
      if (!t || a) return null;
      let o = t.pos;
      if (this.editorView.dragging && this.editorView.dragging.slice) {
        let e = i(this.editorView.state.doc, o, this.editorView.dragging.slice);
        e != null && (o = e);
      }
      return o;
    }
    dragover(e) {
      if (!this.editorView.editable) return;
      this.lastDragEvent = e;
      let t = this.computeTarget(e);
      t != null && (this.setCursor(t), this.scheduleRemoval(5e3));
    }
    dragend() {
      this.scheduleRemoval(20);
    }
    drop() {
      this.scheduleRemoval(20);
    }
    dragleave(e) {
      this.editorView.dom.contains(e.relatedTarget) || this.setCursor(null);
    }
  },
  R = class e extends d {
    constructor(e) {
      super(e, e);
    }
    map(t, n) {
      let r = t.resolve(n.map(this.head));
      return e.valid(r) ? new e(r) : d.near(r);
    }
    content() {
      return l.empty;
    }
    eq(t) {
      return t instanceof e && t.head == this.head;
    }
    toJSON() {
      return { type: `gapcursor`, pos: this.head };
    }
    static fromJSON(t, n) {
      if (typeof n.pos != `number`) throw RangeError(`Invalid input for GapCursor.fromJSON`);
      return new e(t.resolve(n.pos));
    }
    getBookmark() {
      return new Xe(this.anchor);
    }
    static valid(e) {
      let t = e.parent;
      if (t.inlineContent || !Qe(e) || !$e(e)) return !1;
      let n = t.type.spec.allowGapCursor;
      if (n != null) return n;
      let r = t.contentMatchAt(e.index()).defaultType;
      return r && r.isTextblock;
    }
    static findGapCursorFrom(t, n, r = !1) {
      search: for (;;) {
        if (!r && e.valid(t)) return t;
        let i = t.pos,
          a = null;
        for (let r = t.depth; ; r--) {
          let o = t.node(r);
          if (n > 0 ? t.indexAfter(r) < o.childCount : t.index(r) > 0) {
            a = o.child(n > 0 ? t.indexAfter(r) : t.index(r) - 1);
            break;
          }
          if (r == 0) return null;
          i += n;
          let s = t.doc.resolve(i);
          if (e.valid(s)) return s;
        }
        for (;;) {
          let o = n > 0 ? a.firstChild : a.lastChild;
          if (!o) {
            if (a.isAtom && !a.isText && !p.isSelectable(a)) {
              ((t = t.doc.resolve(i + a.nodeSize * n)), (r = !1));
              continue search;
            }
            break;
          }
          ((a = o), (i += n));
          let s = t.doc.resolve(i);
          if (e.valid(s)) return s;
        }
        return null;
      }
    }
  };
((R.prototype.visible = !1), (R.findFrom = R.findGapCursorFrom), d.jsonID(`gapcursor`, R));
var Xe = class e {
  constructor(e) {
    this.pos = e;
  }
  map(t) {
    return new e(t.map(this.pos));
  }
  resolve(e) {
    let t = e.resolve(this.pos);
    return R.valid(t) ? new R(t) : d.near(t);
  }
};
function Ze(e) {
  return e.isAtom || e.spec.isolating || e.spec.createGapCursor;
}
function Qe(e) {
  for (let t = e.depth; t >= 0; t--) {
    let n = e.index(t),
      r = e.node(t);
    if (n == 0) {
      if (r.type.spec.isolating) return !0;
    } else
      for (let e = r.child(n - 1); ; e = e.lastChild) {
        if ((e.childCount == 0 && !e.inlineContent) || Ze(e.type)) return !0;
        if (e.inlineContent) return !1;
      }
  }
  return !0;
}
function $e(e) {
  for (let t = e.depth; t >= 0; t--) {
    let n = e.indexAfter(t),
      r = e.node(t);
    if (n == r.childCount) {
      if (r.type.spec.isolating) return !0;
    } else
      for (let e = r.child(n); ; e = e.firstChild) {
        if ((e.childCount == 0 && !e.inlineContent) || Ze(e.type)) return !0;
        if (e.inlineContent) return !1;
      }
  }
  return !0;
}
function et() {
  return new c({
    props: {
      decorations: at,
      createSelectionBetween(e, t, n) {
        return t.pos == n.pos && R.valid(n) ? new R(n) : null;
      },
      handleClick: rt,
      handleKeyDown: tt,
      handleDOMEvents: { beforeinput: it },
    },
  });
}
var tt = ve({
  ArrowLeft: nt(`horiz`, -1),
  ArrowRight: nt(`horiz`, 1),
  ArrowUp: nt(`vert`, -1),
  ArrowDown: nt(`vert`, 1),
});
function nt(e, t) {
  let n = e == `vert` ? (t > 0 ? `down` : `up`) : t > 0 ? `right` : `left`;
  return function (e, r, i) {
    let a = e.selection,
      s = t > 0 ? a.$to : a.$from,
      c = a.empty;
    if (a instanceof o) {
      if (!i.endOfTextblock(n) || s.depth == 0) return !1;
      ((c = !1), (s = e.doc.resolve(t > 0 ? s.after() : s.before())));
    }
    let l = R.findGapCursorFrom(s, t, c);
    return l ? (r && r(e.tr.setSelection(new R(l))), !0) : !1;
  };
}
function rt(e, t, n) {
  if (!e || !e.editable) return !1;
  let r = e.state.doc.resolve(t);
  if (!R.valid(r)) return !1;
  let i = e.posAtCoords({ left: n.clientX, top: n.clientY });
  return i && i.inside > -1 && p.isSelectable(e.state.doc.nodeAt(i.inside))
    ? !1
    : (e.dispatch(e.state.tr.setSelection(new R(r))), !0);
}
function it(t, n) {
  if (n.inputType != `insertCompositionText` || !(t.state.selection instanceof R)) return !1;
  let { $from: r } = t.state.selection,
    i = r.parent.contentMatchAt(r.index()).findWrapping(t.state.schema.nodes.text);
  if (!i) return !1;
  let a = e.empty;
  for (let t = i.length - 1; t >= 0; t--) a = e.from(i[t].createAndFill(null, a));
  let s = t.state.tr.replace(r.pos, r.pos, new l(a, 0, 0));
  return (s.setSelection(o.near(s.doc.resolve(r.pos + 1))), t.dispatch(s), !1);
}
function at(e) {
  if (!(e.selection instanceof R)) return null;
  let t = document.createElement(`div`);
  return (
    (t.className = `ProseMirror-gapcursor`),
    he.create(e.doc, [w.widget(e.selection.head, t, { key: `gapcursor` })])
  );
}
var z = class {
  constructor(e, t, n = {}) {
    ((this.match = e),
      (this.match = e),
      (this.handler = typeof t == `string` ? ot(t) : t),
      (this.undoable = n.undoable !== !1),
      (this.inCode = n.inCode || !1),
      (this.inCodeMark = n.inCodeMark !== !1));
  }
};
function ot(e) {
  return function (t, n, r, i) {
    let a = e;
    if (n[1]) {
      let e = n[0].lastIndexOf(n[1]);
      ((a += n[0].slice(e + n[1].length)), (r += e));
      let t = r - i;
      t > 0 && ((a = n[0].slice(e - t, e) + a), (r = i));
    }
    return t.tr.insertText(a, r, i);
  };
}
var st = 500;
function ct({ rules: e }) {
  let t = new c({
    state: {
      init() {
        return null;
      },
      apply(e, t) {
        return e.getMeta(this) || (e.selectionSet || e.docChanged ? null : t);
      },
    },
    props: {
      handleTextInput(n, r, i, a) {
        return lt(n, r, i, a, e, t);
      },
      handleDOMEvents: {
        compositionend: (n) => {
          setTimeout(() => {
            let { $cursor: r } = n.state.selection;
            r && lt(n, r.pos, r.pos, ``, e, t);
          });
        },
      },
    },
    isInputRules: !0,
  });
  return t;
}
function lt(e, t, n, r, i, a) {
  if (e.composing) return !1;
  let o = e.state,
    s = o.doc.resolve(t),
    c = e.state.selection,
    l = s.parent.textBetween(Math.max(0, s.parentOffset - st), s.parentOffset, null, `￼`) + r,
    u =
      (t == c.from && n == c.to && e.state.storedMarks) ||
      (t == n ? s.marks() : s.marksAcross(o.doc.resolve(n)) || []);
  for (let c = 0; c < i.length; c++) {
    let d = i[c];
    if (!d.inCodeMark && u.some((e) => e.type.spec.code)) continue;
    if (s.parent.type.spec.code) {
      if (!d.inCode) continue;
    } else if (d.inCode === `only`) continue;
    let f = d.match.exec(l);
    if (!f || f[0].length < r.length) continue;
    let p = t - (f[0].length - r.length);
    if (!d.inCodeMark) {
      let e = !1;
      if (
        (o.doc.nodesBetween(p, s.pos, (t) => {
          t.isInline && t.marks.some((e) => e.type.spec.code) && (e = !0);
        }),
        e)
      )
        continue;
    }
    let m = d.handler(o, f, p, n, r);
    if (m)
      return (
        d.undoable && m.setMeta(a, { transform: m, from: t, to: n, text: r }),
        e.dispatch(m),
        !0
      );
  }
  return !1;
}
var ut = new z(/--$/, `—`, { inCodeMark: !1 }),
  dt = new z(/\.\.\.$/, `…`, { inCodeMark: !1 });
(new z(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, `“`, { inCodeMark: !1 }),
  new z(/"$/, `”`, { inCodeMark: !1 }),
  new z(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, `‘`, { inCodeMark: !1 }),
  new z(/'$/, `’`, { inCodeMark: !1 }));
function ft(e, n, r, i) {
  let a, o;
  return (
    n instanceof t ? (o = n) : ((a = n), (o = n.nodeType), (r = n.getAttrs), (i = n.joinPredicate)),
    new z(
      e,
      (e, t, n, a) => {
        let c = r instanceof Function ? r(t) : r,
          l = e.tr.delete(n, a),
          u = l.doc.resolve(n).blockRange(),
          d = u && h(u, o, c);
        if (!d) return null;
        l.wrap(u, d);
        let f = l.doc.resolve(n - 1).nodeBefore;
        return (f && f.type == o && s(l.doc, n - 1) && (!i || i(t, f)) && l.join(n - 1), l);
      },
      a,
    )
  );
}
function pt(e, n, r) {
  let i, a;
  return (
    n instanceof t ? (a = n) : ((i = n), (a = n.nodeType), (r = n.getAttrs)),
    new z(
      e,
      (e, t, n, i) => {
        let o = e.doc.resolve(n),
          s = r instanceof Function ? r(t) : r;
        return o.node(-1).canReplaceWith(o.index(-1), o.indexAfter(-1), a)
          ? e.tr.delete(n, i).setBlockType(n, n, a, s)
          : null;
      },
      i,
    )
  );
}
var mt = {
    strong: `bold`,
    b: `bold`,
    em: `italic`,
    i: `italic`,
    u: `underline`,
    s: `strike`,
    strike: `strike`,
    del: `strike`,
    code: `code`,
    sub: `subscript`,
    sup: `superscript`,
  },
  ht = {
    color: { mark: `color`, read: T.color },
    'background-color': { mark: `background`, read: T.color },
    'font-family': { mark: `font_family`, read: T.fontFamily },
    'font-size': { mark: `font_size`, read: T.length },
  },
  gt = {
    p: (e) => e.type.name === `paragraph`,
    h1: (e) => e.type.name === `heading` && e.attrs.level === 1,
    h2: (e) => e.type.name === `heading` && e.attrs.level === 2,
    h3: (e) => e.type.name === `heading` && e.attrs.level === 3,
    h4: (e) => e.type.name === `heading` && e.attrs.level === 4,
    h5: (e) => e.type.name === `heading` && e.attrs.level === 5,
    h6: (e) => e.type.name === `heading` && e.attrs.level === 6,
    blockquote: (e) => e.type.name === `blockquote`,
    pre: (e) => e.type.name === `code_block`,
    img: (e) => e.type.name === `image`,
  },
  _t = new Set();
function vt(e) {
  _t.has(e) || (_t.add(e), console.warn(`[nova] formats: ${e}`));
}
function B(e) {
  return Array.isArray(e)
    ? e.flatMap(B)
    : typeof e == `string`
      ? e.split(/\s+/).filter(Boolean)
      : [];
}
function yt(e) {
  let t = [];
  for (let n of e) (t.push(...B(n.classes)), `items` in n && n.items && t.push(...yt(n.items)));
  return t;
}
var bt = (e, t) => {
    let n = B(e);
    return t.every((e) => n.includes(e));
  },
  xt = (e, t) => {
    let n = [...new Set([...B(e), ...t])];
    return n.length ? n.join(` `) : null;
  },
  St = (e, t) => {
    let n = B(e).filter((e) => !t.includes(e));
    return n.length ? n.join(` `) : null;
  };
function Ct(e) {
  let t = {};
  for (let [n, r] of Object.entries(e.styles ?? {}))
    n === `text-align` && ge.includes(r)
      ? (t.align = r)
      : n === `line-height` && T.lineHeight(r)
        ? (t.lineHeight = T.lineHeight(r))
        : vt(`style "${n}" is not supported on blocks`);
  return t;
}
function wt(e, t) {
  let n = x(e),
    r = [];
  if (t.inline && t.inline !== `span`) {
    let e = n[mt[t.inline]];
    e && r.push(e.create());
  }
  let i = B(t.classes);
  i.length && n.span_class && r.push(n.span_class.create({ class: i.join(` `) }));
  for (let [e, i] of Object.entries(t.styles ?? {})) {
    let t = ht[e],
      a = t?.read(i),
      o = t ? n[t.mark] : void 0;
    o && a ? r.push(o.create({ value: a })) : vt(`style "${e}: ${i}" is not supported on text`);
  }
  return r;
}
var Tt = (e) =>
  (e.selector ?? ``)
    .split(`,`)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => (gt[e] ? !0 : (vt(`selector "${e}" is not supported`), !1)));
function Et(e, t) {
  let n = [],
    r = (e) => t.some((t) => gt[t](e)),
    { selection: i } = e;
  if (i instanceof p && r(i.node)) return [{ node: i.node, pos: i.from }];
  let { $from: a, from: o, to: s } = i;
  for (let e = a.depth; e > 0; e--) {
    let t = a.node(e);
    r(t) && n.push({ node: t, pos: a.before(e) });
  }
  return (
    e.doc.nodesBetween(o, s, (e, t) => {
      r(e) && !n.some((e) => e.pos === t) && n.push({ node: e, pos: t });
    }),
    n
  );
}
function Dt(e) {
  let t = [],
    { from: n, to: r } = e.selection;
  return (
    e.doc.nodesBetween(n, r, (e, n) => !e.isTextblock || (t.push({ node: e, pos: n }), !1)),
    t
  );
}
function Ot(e) {
  let { $from: t } = e.selection;
  for (let e = t.depth; e > 0; e--) {
    let n = t.node(e);
    if (n.type.name === `blockquote`) return { node: n, pos: t.before(e) };
  }
  return null;
}
function kt(e) {
  return { align: e.align ?? null, lineHeight: e.lineHeight ?? null, dir: e.dir ?? null };
}
var At = class {
  constructor(e, t) {
    ((this.editor = e), (this.allowedClasses = t));
  }
  editor;
  allowedClasses;
  registry = new Map();
  register(e, t) {
    let n = Array.isArray(t) ? t : [t];
    (this.registry.set(e, n), yt(n).forEach((e) => this.allowedClasses.add(e)));
  }
  unregister(e) {
    this.registry.delete(e);
  }
  has(e) {
    return this.registry.has(e);
  }
  get(e) {
    return this.registry.get(e);
  }
  resolve(e) {
    if (typeof e != `string`) return [e];
    let t = this.registry.get(e);
    return (t || vt(`unknown format "${e}"`), t ?? []);
  }
  canApply(e) {
    if (!this.editor.isEditable()) return !1;
    let t = this.editor.view.state;
    return this.resolve(e).some((e) => jt(t, e));
  }
  match(e) {
    let t = this.editor.view.state;
    return this.resolve(e).some((e) => Nt(t, e));
  }
  apply(e) {
    if (!this.editor.isEditable()) return !1;
    let t = this.resolve(e);
    if (!t.length) return !1;
    let n = t.find((e) => jt(this.editor.view.state, e)) ?? t[0];
    return this.run((e, t) => Ft(e, t, n));
  }
  remove(e) {
    if (!this.editor.isEditable()) return !1;
    let t = this.resolve(e);
    return t.length ? this.run((e, n) => t.forEach((t) => It(e, n, t))) : !1;
  }
  toggle(e) {
    return this.match(e) ? this.remove(e) : this.apply(e);
  }
  run(e) {
    let { view: t } = this.editor,
      n = t.state.tr;
    return (
      e(t.state, n) !== !1 &&
      ((n.docChanged || n.storedMarksSet) && t.dispatch(n.scrollIntoView()), t.focus(), !0)
    );
  }
};
function jt(e, t) {
  return !t.selector || Et(e, Tt(t)).length > 0;
}
function Mt(e, t) {
  return e.type.name === `image` || Object.entries(Ct(t)).every(([t, n]) => e.attrs[t] === n);
}
function Nt(e, t) {
  let n = B(t.classes);
  if (t.block) {
    if (t.block === `blockquote`) {
      let t = Ot(e);
      return !!t && bt(t.node.attrs.class, n);
    }
    let r = e.selection.$from.parent;
    return gt[t.block](r) && bt(r.attrs.class, n) && Mt(r, t);
  }
  if (t.selector) {
    let r = Et(e, Tt(t));
    return r.length > 0 && r.some(({ node: e }) => bt(e.attrs.class, n) && Mt(e, t));
  }
  if (t.inline) {
    let n = wt(e, t);
    if (!n.length) return !1;
    let { $from: r, empty: i, from: a, to: o } = e.selection;
    if (i) {
      let t = e.storedMarks ?? r.marks();
      return n.every((e) => t.some((t) => Pt(t, e)));
    }
    let s = !1,
      c = !0;
    return (
      e.doc.nodesBetween(a, o, (e) => {
        e.isText && ((s = !0), n.every((t) => e.marks.some((e) => Pt(e, t))) || (c = !1));
      }),
      s && c
    );
  }
  return !1;
}
function Pt(e, t) {
  return e.type === t.type
    ? t.type.name === `span_class`
      ? bt(e.attrs.class, B(t.attrs.class))
      : t.attrs.value === void 0 || e.attrs.value === t.attrs.value
    : !1;
}
function Ft(e, t, n) {
  let r = B(n.classes),
    i = S(e);
  if (n.block === `blockquote`) {
    let n = Ot(e);
    return n
      ? (t.setNodeMarkup(n.pos, void 0, { ...n.node.attrs, class: xt(n.node.attrs.class, r) }), !0)
      : y(i.blockquote, { class: xt(null, r) })(e, (e) => e.steps.forEach((e) => t.step(e)));
  }
  if (n.block === `pre`) {
    for (let { node: n, pos: r } of Dt(e))
      n.type !== i.code_block && t.setNodeMarkup(r, i.code_block, { language: null });
    return !0;
  }
  if (n.block) {
    let a = n.block === `p` ? 0 : Number(n.block.slice(1)),
      o = a ? i.heading : i.paragraph,
      s = Ct(n);
    for (let { node: n, pos: c } of Dt(e)) {
      if (
        n.type === i.code_block &&
        n.textContent.includes(`
`)
      )
        continue;
      let e = n.type === o && (!a || n.attrs.level === a);
      t.setNodeMarkup(c, o, {
        ...kt(n.attrs),
        ...(a ? { level: a } : {}),
        ...s,
        class: xt(e ? n.attrs.class : null, r),
      });
    }
    return !0;
  }
  if (n.selector) {
    let i = Ct(n),
      a = Et(e, Tt(n));
    if (!a.length) return !1;
    for (let { node: e, pos: n } of a) {
      let a = e.type.name === `image` ? {} : i;
      t.setNodeMarkup(n, void 0, { ...e.attrs, ...a, class: xt(e.attrs.class, r) });
    }
    return (e.selection instanceof p && t.setSelection(p.create(t.doc, e.selection.from)), !0);
  }
  if (n.inline) {
    let r = wt(e, n);
    if (!r.length) return !1;
    let { empty: i, ranges: a } = e.selection;
    if (i) {
      let n = e.storedMarks ?? e.selection.$from.marks();
      for (let e of r) n = e.addToSet(n);
      return (t.setStoredMarks(n), !0);
    }
    for (let { $from: e, $to: n } of a) for (let i of r) t.addMark(e.pos, n.pos, i);
    return !0;
  }
  return !1;
}
function It(e, t, n) {
  let r = B(n.classes),
    i = S(e);
  if (n.block === `blockquote`) {
    let n = Ot(e);
    if (!n) return;
    let i = St(n.node.attrs.class, r);
    if (r.length && i !== null) {
      t.setNodeMarkup(n.pos, void 0, { ...n.node.attrs, class: i });
      return;
    }
    ue(e, (e) => e.steps.forEach((e) => t.step(e)));
  } else if (n.block)
    for (let { node: a, pos: o } of Dt(e))
      gt[n.block](a) &&
        t.setNodeMarkup(o, i.paragraph, {
          ...kt(a.attrs),
          class: n.block === `p` ? St(a.attrs.class, r) : null,
        });
  else if (n.selector) {
    let i = Ct(n);
    for (let { node: a, pos: o } of Et(e, Tt(n))) {
      let e = {};
      (a.type.name !== `image` &&
        (`align` in i && a.attrs.align === i.align && (e.align = null),
        `lineHeight` in i && a.attrs.lineHeight === i.lineHeight && (e.lineHeight = null)),
        t.setNodeMarkup(o, void 0, { ...a.attrs, ...e, class: St(a.attrs.class, r) }));
    }
    e.selection instanceof p && t.setSelection(p.create(t.doc, e.selection.from));
  } else if (n.inline) {
    let r = wt(e, n),
      { empty: i, from: a, to: o, $from: s } = e.selection;
    if (i) {
      let n = (e.storedMarks ?? s.marks()).filter((e) => !r.some((t) => Pt(e, t)));
      t.setStoredMarks(n);
      return;
    }
    for (let n of r)
      n.type.name === `span_class`
        ? e.doc.nodesBetween(a, o, (e, r) => {
            if (!e.isText) return;
            let i = e.marks.find((e) => e.type === n.type);
            if (!i) return;
            let s = Math.max(r, a),
              c = Math.min(r + e.nodeSize, o);
            t.removeMark(s, c, n.type);
            let l = St(i.attrs.class, B(n.attrs.class));
            l && t.addMark(s, c, n.type.create({ class: l }));
          })
        : t.removeMark(a, o, n.type);
  }
}
function Lt(e, t) {
  let n = 0;
  for (let r = t; r < e.length; r++) {
    let t = e[r];
    if (t === `\\`) r++;
    else if (t === `{`) n++;
    else if (t === `}` && (n--, n === 0)) return r;
  }
  return -1;
}
function Rt(e) {
  let t = ``,
    n = 0;
  for (let r = 0; r < e.length; r++) {
    let i = e[r];
    i === `\\`
      ? (n === 0 && (t += i + (e[r + 1] ?? ``)), r++)
      : i === `{`
        ? n++
        : i === `}`
          ? n--
          : n === 0 && (t += i);
  }
  return t;
}
var zt = 20971520;
function Bt(e) {
  if (e.length % 2 != 0 || e.length / 2 > zt || !/^[0-9a-f]+$/i.test(e)) return null;
  let t = ``;
  for (let n = 0; n < e.length; n += 2) t += String.fromCharCode(parseInt(e.slice(n, n + 2), 16));
  return btoa(t);
}
function Vt(e) {
  let t = [],
    n = 0;
  for (;;) {
    let r = e.indexOf(`{\\pict`, n);
    if (r < 0) break;
    let i = Lt(e, r);
    if (i < 0) break;
    if (((n = i + 1), /\\nonshppict\s*$/.test(e.slice(Math.max(0, r - 16), r)))) continue;
    let a = Rt(e.slice(r + 1, i)),
      o = /\\pngblip(?![a-z])/.test(a)
        ? `image/png`
        : /\\jpegblip(?![a-z])/.test(a)
          ? `image/jpeg`
          : null;
    if (!o) continue;
    let s = Bt(a.replace(/\\[a-z]+-?\d* ?/gi, ``).replace(/\s+/g, ``));
    if (!s) continue;
    let c = atob(s.slice(0, 12));
    (o === `image/png`
      ? c.startsWith(`PNG`)
      : c.charCodeAt(0) === 255 && c.charCodeAt(1) === 216) && t.push({ type: o, base64: s });
  }
  return t;
}
function Ht(e) {
  return /<img[^>]+src=["']?file:/i.test(e);
}
function Ut(e, t) {
  let n = document.createElement(`template`);
  n.innerHTML = e;
  let r = [...n.content.querySelectorAll(`img`)].filter((e) =>
    /^file:/i.test(e.getAttribute(`src`) ?? ``),
  );
  return !r.length || r.length !== t.length
    ? e
    : (r.forEach((e, n) => {
        let r = t[n];
        e.setAttribute(`src`, `data:${r.type};base64,${r.base64}`);
      }),
      n.innerHTML);
}
var Wt = null,
  Gt = null;
function Kt() {
  return (
    (Gt ??= L(
      () =>
        import(`./paste-office-F3QW4WWO.Fg8h7fDZ.js`).then(
          (e) => (Wt = e),
          () => ((Gt = null), null),
        ),
      [],
    )),
    Gt
  );
}
var qt = new a(`nova-paste`);
function Jt(e) {
  let t = document.createElement(`template`);
  t.innerHTML = e;
  let n = /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|TR|SECTION|ARTICLE|HEADER|FOOTER)$/,
    r = ``,
    i = (e) => {
      if (e.nodeType === Node.TEXT_NODE) {
        r += (e.textContent ?? ``).replace(/\s+/g, ` `);
        return;
      }
      if (!(e instanceof Element)) {
        e.childNodes.forEach(i);
        return;
      }
      if (/^(SCRIPT|STYLE|META|TITLE|HEAD)$/.test(e.tagName)) return;
      if (e.tagName === `BR`) {
        r += `
`;
        return;
      }
      let t = n.test(e.tagName);
      (t &&
        r &&
        !r.endsWith(`
`) &&
        (r += `
`),
        e.childNodes.forEach(i),
        t &&
          (r += `
`));
    };
  return (
    t.content.childNodes.forEach(i),
    r
      .split(
        `
`,
      )
      .map((e) => e.trim())
      .join(
        `
`,
      )
      .replace(
        /\n{3,}/g,
        `

`,
      )
      .trim()
  );
}
function Yt(e) {
  let t = !1;
  return new c({
    key: qt,
    props: {
      transformPasted(e, t) {
        let { selection: n } = t.state,
          r = n.$from.parent;
        return e.openStart > 0 &&
          n.empty &&
          r.isTextblock &&
          r.content.size === 0 &&
          e.content.firstChild?.isBlock
          ? new l(e.content, 0, e.openEnd)
          : e;
      },
      transformPastedHTML(t) {
        let { pastePreprocess: n, pastePostprocess: r, pasteStyles: i } = e.options,
          a = n ? n(t, e) : t;
        if ((Wt && (a = Wt.cleanPastedHTML(a, i ?? `clean`)), r)) {
          let t = document.createElement(`template`);
          t.innerHTML = a;
          let n = document.createElement(`div`);
          (n.append(t.content), r(n, e), (a = n.innerHTML));
        }
        return a;
      },
      handleDOMEvents: {
        paste(n, r) {
          if (Wt || t || e.isPasteAsText()) return !1;
          let i = r.clipboardData,
            a = i?.getData(`text/html`);
          if (!a) return !1;
          let o = Ht(a) ? (i?.getData(`text/rtf`) ?? ``) : ``;
          return (
            r.preventDefault(),
            Kt().then(() => {
              if (n.isDestroyed) return;
              let r = o && e.isAllowed(`image`) ? Ut(a, Vt(o)) : a;
              t = !0;
              try {
                n.pasteHTML(r);
              } finally {
                t = !1;
              }
            }),
            !0
          );
        },
      },
      handlePaste(n, r, i) {
        if (t) return !1;
        let a = r.clipboardData?.getData(`text/html`);
        if (!e.isPasteAsText()) {
          let i = a && Ht(a) ? r.clipboardData?.getData(`text/rtf`) : ``;
          if (!a || !i || !e.isAllowed(`image`)) return !1;
          let o = Ut(a, Vt(i));
          if (o === a) return !1;
          t = !0;
          try {
            n.pasteHTML(o, r);
          } finally {
            t = !1;
          }
          return !0;
        }
        let o = a
          ? Jt(a)
          : r.clipboardData?.getData(`text/plain`) ||
            i.content.textBetween(
              0,
              i.content.size,
              `

`,
            );
        if (!o) return !1;
        t = !0;
        try {
          n.pasteText(o);
        } finally {
          t = !1;
        }
        return !0;
      },
    },
  });
}
var Xt = `data-nova-cell-bg`,
  Zt = `http://www.w3.org/1999/xhtml`,
  Qt = `http://www.w3.org/1998/Math/MathML`;
function $t(e) {
  let t = [...e.querySelectorAll(`*`)].filter(
    (e) => e.namespaceURI !== Zt && (e.parentElement?.namespaceURI ?? Zt) === Zt,
  );
  for (let e of t) {
    let t = e.namespaceURI === Qt ? (e.textContent ?? ``) : ``;
    e.replaceWith(e.ownerDocument.createTextNode(t));
  }
}
function en(e) {
  ($t(e),
    e.querySelectorAll(`td, th`).forEach((e) => {
      if (!e.style) return;
      let t = e.style.backgroundColor;
      t &&
        (e.setAttribute(Xt, t),
        e.style.removeProperty(`background-color`),
        e.getAttribute(`style`) || e.removeAttribute(`style`));
    }));
}
var tn = class extends g {
    atomSelector;
    prepare(e) {
      (en(e),
        (this.atomSelector ??= Object.values(this.schema.nodes)
          .filter((e) => e.spec.ignoreStyles)
          .flatMap((e) => (e.spec.parseDOM ?? []).map((e) => e.tag))
          .filter((e) => !!e)
          .join(`, `)),
        this.atomSelector &&
          `querySelectorAll` in e &&
          e.querySelectorAll(this.atomSelector).forEach((e) => {
            e.removeAttribute(`style`);
          }));
    }
    parse(e, t) {
      return (this.prepare(e), super.parse(e, t));
    }
    parseSlice(e, t) {
      return (this.prepare(e), super.parseSlice(e, t));
    }
  },
  nn = new WeakMap();
function rn(e) {
  let t = nn.get(e);
  return (t || ((t = new tn(e, g.fromSchema(e).rules)), nn.set(e, t)), t);
}
rn(pe);
function an(e, t, n) {
  let r = [],
    i = A(`div`, { className: `nova-menu`, role: `menu`, 'aria-label': n }),
    a = e.some((e) => (e.type === void 0 || e.type === `item`) && e.active !== void 0);
  for (let n of e) {
    if (n.type === `separator`) {
      i.append(A(`div`, { className: `nova-menu-sep`, role: `separator` }));
      continue;
    }
    if (n.type === `heading`) {
      i.append(A(`div`, { className: `nova-menu-heading`, role: `presentation` }, n.label));
      continue;
    }
    let e = A(`span`, { className: `nova-menu-label` }, n.label);
    n.labelStyle && e.setAttribute(`style`, n.labelStyle);
    let o = A(
      `button`,
      {
        type: `button`,
        className: `nova-menu-item`,
        role: n.active === void 0 ? `menuitem` : n.checkbox ? `menuitemcheckbox` : `menuitemradio`,
        tabindex: `-1`,
        'data-id': n.id,
        disabled: n.disabled ?? !1,
        ...(n.active === void 0 ? {} : { 'aria-checked': String(n.active) }),
      },
      a ? A(`span`, { className: `nova-menu-check` }, n.active ? k(O.check) : null) : null,
      n.icon ? k(n.icon) : null,
      e,
      n.shortcut ? A(`kbd`, { className: `nova-menu-shortcut` }, be(n.shortcut)) : null,
    );
    (o.addEventListener(`click`, () => {
      (t(), n.onSelect());
    }),
      r.push(o),
      i.append(o));
  }
  let o = () => r.filter((e) => !e.disabled),
    s = (e) => {
      let t = o();
      t.length && t[(e + t.length) % t.length].focus();
    };
  return (
    i.addEventListener(`keydown`, (e) => {
      let t = o(),
        n = t.indexOf(document.activeElement);
      switch (e.key) {
        case `ArrowDown`:
          (e.preventDefault(), s(n + 1));
          break;
        case `ArrowUp`:
          (e.preventDefault(), s(n - 1));
          break;
        case `Home`:
          (e.preventDefault(), s(0));
          break;
        case `End`:
          (e.preventDefault(), s(t.length - 1));
          break;
        case `Tab`:
          e.preventDefault();
          break;
        default:
          if (e.key.length === 1 && /\S/.test(e.key)) {
            let r = e.key.toLowerCase(),
              i = n + 1;
            [...t.slice(i), ...t.slice(0, i)]
              .find((e) => e.textContent?.trim().toLowerCase().startsWith(r))
              ?.focus();
          }
      }
    }),
    i
  );
}
function on(e) {
  (
    e.querySelector(`[aria-checked="true"]:not(:disabled)`) ??
    e.querySelector(`.nova-menu-item:not(:disabled)`)
  )?.focus();
}
var sn = {
    file: { title: `menu.file`, items: `preview | print` },
    edit: { title: `menu.edit`, items: `undo redo | selectall | searchreplace pastetext` },
    view: { title: `menu.view`, items: `code preview | fullscreen` },
    insert: { title: `menu.insert`, items: `image link inserttable hr | insertdatetime` },
    format: {
      title: `menu.format`,
      items: `bold italic underline strikethrough superscript subscript inlinecode | paragraph h1 h2 h3 blockquote codeblock | alignleft aligncenter alignright alignjustify | removeformat`,
    },
    table: {
      title: `menu.table`,
      items: `inserttable | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablemergecells tablesplitcells | tabledelete`,
    },
    help: { title: `menu.help`, items: `help` },
  },
  cn = `file edit view insert format table help`;
function ln(e, t, n, r) {
  let { t: i } = e.ui;
  ((t.className = `nova-menubar`),
    t.setAttribute(`role`, `menubar`),
    t.setAttribute(`aria-label`, i(`menu.label`)));
  let a = new AbortController(),
    { signal: o } = a,
    s = (e) => (e.title.startsWith(`menu.`) ? i(e.title) : e.title),
    c = (t) => {
      let n = [];
      for (let r of t.items.split(/\s+/)) {
        if (!r) continue;
        if (r === `|`) {
          n.length && n[n.length - 1].type !== `separator` && n.push({ type: `separator` });
          continue;
        }
        if (!e.isAllowed(r)) continue;
        let t = e.ui.registry.getMenuItem(r);
        t &&
          n.push({
            id: r,
            label: t.text,
            ...(t.icon ? { icon: t.icon } : {}),
            ...(t.shortcut ? { shortcut: t.shortcut } : {}),
            ...(t.isActive ? { active: t.isActive(e), checkbox: !0 } : {}),
            disabled: !e.isEditable() || (t.isEnabled ? !t.isEnabled(e) : !1),
            onSelect: () => t.onAction(e),
          });
      }
      for (; n.length && n[n.length - 1].type === `separator`;) n.pop();
      return n;
    },
    l = [],
    u = null,
    d = () => {
      (u?.popover.close(), (u = null));
    },
    f = (n, i) => {
      d();
      let a = l[n],
        o = r[a.dataset.menu],
        p = c(o);
      if (!p.length) return;
      let m = an(p, () => e.ui.closePopover(), s(o));
      (m.addEventListener(`keydown`, (e) => {
        if (e.key !== `ArrowLeft` && e.key !== `ArrowRight`) return;
        e.preventDefault();
        let t = (n + (e.key === `ArrowRight` ? 1 : -1) + l.length) % l.length;
        f(t, !0);
      }),
        a.setAttribute(`aria-expanded`, `true`));
      let h = e.ui.openPopover({
        anchor: a,
        content: m,
        ignore: [t],
        className: `nova-popover-menu`,
        onClose: (e) => {
          (a.setAttribute(`aria-expanded`, `false`),
            u?.popover === h && (u = null),
            e === `escape` && a.focus());
        },
      });
      ((u = { index: n, popover: h }), i && on(m));
    };
  for (let e of n.split(/\s+/).filter(Boolean)) {
    let n = r[e];
    if (!n) continue;
    let i = A(
        `button`,
        {
          type: `button`,
          className: `nova-menubar-item`,
          role: `menuitem`,
          'aria-haspopup': `menu`,
          'aria-expanded': `false`,
          'data-menu': e,
          tabindex: l.length === 0 ? `0` : `-1`,
        },
        s(n),
      ),
      a = l.length;
    (i.addEventListener(`click`, (e) => {
      if (u?.index === a) return d();
      f(a, e.detail === 0);
    }),
      i.addEventListener(`mouseenter`, () => {
        u && u.index !== a && f(a, !1);
      }),
      l.push(i),
      t.append(i));
  }
  return (
    t.addEventListener(
      `keydown`,
      (t) => {
        let n = l.indexOf(document.activeElement);
        if (n < 0) return;
        let r = (e) => {
          t.preventDefault();
          let n = (e + l.length) % l.length;
          (l.forEach((e, t) => (e.tabIndex = t === n ? 0 : -1)), l[n].focus());
        };
        t.key === `ArrowRight`
          ? r(n + 1)
          : t.key === `ArrowLeft`
            ? r(n - 1)
            : t.key === `Home`
              ? r(0)
              : t.key === `End`
                ? r(l.length - 1)
                : t.key === `ArrowDown`
                  ? (t.preventDefault(), f(n, !0))
                  : t.key === `Escape` && (t.preventDefault(), e.focus());
      },
      { signal: o },
    ),
    t.addEventListener(
      `mousedown`,
      (e) => {
        e.target.closest(`button`) && e.preventDefault();
      },
      { signal: o },
    ),
    {
      focus: () => (l.find((e) => e.tabIndex === 0) ?? l[0])?.focus(),
      destroy: () => {
        (d(), a.abort(), t.replaceChildren());
      },
    }
  );
}
var un = `
  body { font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #000; margin: 2cm; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
  pre { white-space: pre-wrap; background: #f5f5f5; padding: 8px; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #444; }
`;
function dn(e) {
  let t = A(`iframe`, { title: `print`, 'aria-hidden': `true`, tabindex: `-1` });
  ((t.style.cssText = `position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden`),
    document.body.append(t));
  let r = t.contentDocument;
  if (!r) return t.remove();
  let i = r.createElement(`style`);
  ((i.textContent = un),
    r.head.append(i),
    r.body.append(
      n.fromSchema(e.schema).serializeFragment(e.view.state.doc.content, { document: r }),
    ));
  let a = t.contentWindow,
    o = () => setTimeout(() => t.remove(), 1e3);
  (a?.addEventListener(`afterprint`, o), a?.focus(), a?.print(), o());
}
function fn(e) {
  let { t } = e.ui,
    n = j({ label: t(`table.rows`), value: `3` }),
    r = j({ label: t(`table.cols`), value: `3` });
  for (let e of [n, r])
    ((e.input.type = `number`),
      (e.input.min = `1`),
      (e.input.max = `50`),
      (e.input.inputMode = `numeric`));
  e.ui.openDialog({
    title: t(`table.insert`),
    body: A(`div`, { className: `nova-form nova-form-row` }, n.el, r.el),
    submitLabel: t(`dialog.insert`),
    initialFocus: n.input,
    onSubmit: () => {
      let i = Number(n.input.value),
        a = Number(r.input.value);
      return !Number.isInteger(i) || !Number.isInteger(a) || i < 1 || a < 1 || i > 50 || a > 50
        ? t(`table.invalidSize`)
        : (e.exec(M(i, a)), !0);
    },
  });
}
function pn(e) {
  let { registry: t, t: n } = e.ui;
  (t.addToggleMenuItem(`paragraph`, {
    text: n(`paragraph`),
    icon: O.paragraph,
    shortcut: `Mod-Alt-0`,
    isActive: (e) => e.view.state.selection.$from.parent.type.name === `paragraph`,
    onAction: (e) => e.exec(`paragraph`),
  }),
    t.addMenuItem(`selectall`, {
      text: n(`selectAll`),
      shortcut: `Mod-a`,
      onAction: (e) => {
        (e.view.dispatch(e.view.state.tr.setSelection(new m(e.view.state.doc))), e.focus());
      },
    }),
    t.addMenuItem(`print`, {
      text: n(`print`),
      icon: O.print,
      shortcut: `Mod-p`,
      onAction: (e) => dn(e),
    }),
    t.addMenuItem(`inserttable`, {
      text: n(`table.insert`),
      icon: O.table,
      isEnabled: (e) => e.can(M(1, 1)),
      onAction: (e) => fn(e),
    }));
}
var mn = {
    b: `strong`,
    i: `em`,
    strike: `s`,
    del: `s`,
    tbody: `table`,
    thead: `table`,
    tfoot: `table`,
    caption: `table`,
    colgroup: `table`,
    col: `table`,
  },
  hn =
    `p.h1.h2.h3.h4.h5.h6.blockquote.pre.hr.ul.ol.li.img.br.table.tr.td.th.strong.em.u.s.code.a.sub.sup.span`.split(
      `.`,
    ),
  gn = {
    bold: [`strong`],
    italic: [`em`],
    underline: [`u`],
    strikethrough: [`s`],
    strike: [`s`],
    inlinecode: [`code`],
    code: [`code`],
    subscript: [`sub`],
    superscript: [`sup`],
    link: [`a`],
    unlink: [`a`],
    quicklink: [`a`],
    image: [`img`],
    quickimage: [`img`],
    table: [`table`],
    quicktable: [`table`],
    inserttable: [`table`],
    tableinsertrowbefore: [`table`],
    tableinsertrowafter: [`table`],
    tabledeleterow: [`table`],
    tableinsertcolbefore: [`table`],
    tableinsertcolafter: [`table`],
    tabledeletecol: [`table`],
    tablemergecells: [`table`],
    tablesplitcells: [`table`],
    tabledelete: [`table`],
    tablerowheader: [`th`],
    tablecolheader: [`th`],
    tablecellbackground: [`style:background-color`],
    bullist: [`ul`],
    bulletlist: [`ul`],
    numlist: [`ol`],
    orderedlist: [`ol`],
    blockquote: [`blockquote`],
    codeblock: [`pre`],
    hr: [`hr`],
    horizontalrule: [`hr`],
    h1: [`h1`],
    h2: [`h2`],
    h3: [`h3`],
    h4: [`h4`],
    h5: [`h5`],
    h6: [`h6`],
    forecolor: [`span`, `style:color`],
    backcolor: [`span`, `style:background-color`],
    fontfamily: [`span`, `style:font-family`],
    fontsize: [`span`, `style:font-size`],
    lineheight: [`style:line-height`],
    align: [`style:text-align`],
    alignleft: [`style:text-align`],
    aligncenter: [`style:text-align`],
    alignright: [`style:text-align`],
    alignjustify: [`style:text-align`],
    imagealignleft: [`style:float`],
    imagealigncenter: [`style:float`],
    imagealignright: [`style:float`],
  };
function _n(e) {
  if (e === void 0) return null;
  let t = new Set();
  for (let n of e.split(`,`)) {
    let e = n
      .trim()
      .replace(/^[-#+!]+/, ``)
      .replace(/\[.*$/, ``)
      .toLowerCase();
    for (let n of e.split(`/`)) {
      let e = n.trim();
      e && t.add(mn[e] ?? e);
    }
  }
  return t;
}
function vn(e) {
  if (e === void 0) return null;
  let t = typeof e == `string` ? e : Object.values(e).join(`,`);
  return new Set(
    t
      .split(`,`)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
var yn = class {
  tags;
  styles;
  constructor(e) {
    let t = _n(e.validElements),
      n = _n(e.invalidElements) ?? new Set(),
      r = new Set(t ?? hn);
    ((r.has(`ul`) || r.has(`ol`)) && r.add(`li`), r.has(`table`) && (r.add(`tr`), r.add(`td`)));
    for (let e of n) r.delete(e);
    (r.add(`p`), (this.tags = r), (this.styles = vn(e.validStyles)));
  }
  isTagAllowed(e) {
    let t = e.toLowerCase();
    return this.tags.has(mn[t] ?? t);
  }
  isStyleAllowed(e) {
    return !this.styles || this.styles.has(e.toLowerCase());
  }
  isAllowed(e) {
    let t = gn[e.toLowerCase()];
    return (
      !t ||
      t.every((e) =>
        e.startsWith(`style:`) ? this.isStyleAllowed(e.slice(6)) : this.isTagAllowed(e),
      )
    );
  }
  markAllowed(e) {
    switch (e.type.name) {
      case `bold`:
        return this.isTagAllowed(`strong`);
      case `italic`:
        return this.isTagAllowed(`em`);
      case `underline`:
        return this.isTagAllowed(`u`);
      case `strike`:
        return this.isTagAllowed(`s`);
      case `code`:
        return this.isTagAllowed(`code`);
      case `link`:
        return this.isTagAllowed(`a`);
      case `subscript`:
        return this.isTagAllowed(`sub`);
      case `superscript`:
        return this.isTagAllowed(`sup`);
      case `color`:
        return this.isTagAllowed(`span`) && this.isStyleAllowed(`color`);
      case `background`:
        return this.isTagAllowed(`span`) && this.isStyleAllowed(`background-color`);
      case `font_family`:
        return this.isTagAllowed(`span`) && this.isStyleAllowed(`font-family`);
      case `font_size`:
        return this.isTagAllowed(`span`) && this.isStyleAllowed(`font-size`);
      default:
        return !0;
    }
  }
  blockAttrs(e) {
    return {
      ...e,
      ...(this.isStyleAllowed(`text-align`) ? {} : { align: null }),
      ...(this.isStyleAllowed(`line-height`) ? {} : { lineHeight: null }),
    };
  }
  normalize(e) {
    let t = e.type.schema,
      { nodes: n } = t;
    if (e.isText) {
      let t = e.marks.filter((e) => this.markAllowed(e));
      return [t.length === e.marks.length ? e : e.mark(t)];
    }
    let r = e.marks.filter((e) => this.markAllowed(e));
    switch (e.type) {
      case n.image:
        return this.isTagAllowed(`img`)
          ? [
              n.image.create(
                { ...e.attrs, ...(this.isStyleAllowed(`float`) ? {} : { align: null }) },
                null,
                r,
              ),
            ]
          : [];
      case n.hard_break:
        return this.isTagAllowed(`br`) ? [e.mark(r)] : [t.text(` `, r)];
      case n.horizontal_rule:
        return this.isTagAllowed(`hr`) ? [e] : [];
    }
    let i = this.normalizeChildren(e.content),
      a = (t = e.type, n = e.attrs) => {
        try {
          return [t.createChecked(n, i, e.marks)];
        } catch {
          let r = t.createAndFill(n, i, e.marks);
          return r ? [r] : i.content.length ? bn(i) : [];
        }
      };
    switch (e.type) {
      case n.paragraph:
        return a(n.paragraph, this.blockAttrs(e.attrs));
      case n.heading:
        return this.isTagAllowed(`h${e.attrs.level}`)
          ? a(n.heading, this.blockAttrs(e.attrs))
          : a(
              n.paragraph,
              this.blockAttrs({ align: e.attrs.align, lineHeight: e.attrs.lineHeight }),
            );
      case n.blockquote:
        return this.isTagAllowed(`blockquote`) ? a() : bn(i);
      case n.code_block:
        return this.isTagAllowed(`pre`)
          ? a()
          : e.textContent
              .split(
                `
`,
              )
              .map((e) => n.paragraph.create(null, e ? t.text(e) : null));
      case n.bullet_list:
      case n.ordered_list:
        return this.isTagAllowed(e.type === n.bullet_list ? `ul` : `ol`)
          ? a(e.type, {
              ...e.attrs,
              ...(this.isStyleAllowed(`list-style-type`) ? {} : { listStyle: null }),
            })
          : xn(i);
      case n.table:
        return this.isTagAllowed(`table`) ? a() : Sn(i);
      case n.table_header:
        return this.isTagAllowed(`th`) ? a() : a(n.table_cell, e.attrs);
      case n.table_cell:
        return a(n.table_cell, {
          ...e.attrs,
          ...(this.isStyleAllowed(`background-color`) ? {} : { background: null }),
        });
      default:
        return a();
    }
  }
  normalizeChildren(t) {
    let n = [];
    return (t.forEach((e) => n.push(...this.normalize(e))), e.from(n));
  }
  normalizeDoc(e) {
    let t = this.normalizeChildren(e.content),
      n = e.type.schema;
    return e.type.createAndFill(null, t.size ? t : n.nodes.paragraph.create());
  }
};
function bn(e) {
  let t = [],
    n = [],
    r = () => {
      (n.length && t.push(n[0].type.schema.nodes.paragraph.create(null, n)), (n = []));
    };
  return (
    e.forEach((e) => {
      e.isInline ? n.push(e) : (r(), t.push(e));
    }),
    r(),
    t
  );
}
function xn(t) {
  let n = [];
  return (
    t.forEach((t) => {
      t.type === t.type.schema.nodes.list_item
        ? t.content.forEach((e) => n.push(e))
        : n.push(...bn(e.from(t)));
    }),
    n
  );
}
function Sn(e) {
  let t = [];
  return (e.forEach((e) => e.forEach((e) => e.forEach((e) => t.push(e)))), t);
}
var Cn = new a(`nova-content-rules`);
function wn(e) {
  return new c({
    key: Cn,
    appendTransaction(t, n, r) {
      if (!t.some((e) => e.docChanged)) return null;
      let i = n.doc.content.findDiffStart(r.doc.content);
      if (i === null) return null;
      let a = n.doc.content.findDiffEnd(r.doc.content)?.b ?? r.doc.content.size,
        o = r.doc,
        s = [];
      if (
        (o.forEach((t, n) => {
          let r = n,
            o = n + t.nodeSize;
          if (o < i || r > Math.max(i, a)) return;
          let c = e.normalize(t);
          (c.length === 1 && c[0].eq(t)) || s.push({ from: r, to: o, nodes: c });
        }),
        !s.length)
      )
        return null;
      let c = r.tr;
      for (let { from: e, to: t, nodes: n } of s.reverse())
        n.length
          ? c.replaceWith(e, t, n)
          : c.doc.childCount > 1
            ? c.delete(e, t)
            : c.replaceWith(e, t, r.schema.nodes.paragraph.create());
      return c.setMeta(
        `addToHistory`,
        t.every((e) => e.getMeta(`addToHistory`) !== !1),
      );
    },
  });
}
var Tn = 1e4,
  En = `￼`,
  V = new a(`nova-search`),
  Dn = { query: ``, caseSensitive: !1, wholeWord: !1, matches: [], current: -1 };
function On({ query: e, caseSensitive: t, wholeWord: n }) {
  if (!e) return null;
  let r = e.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`),
    i = n ? `(?<![\\p{L}\\p{N}_])${r}(?![\\p{L}\\p{N}_])` : r;
  return new RegExp(i, t ? `gu` : `giu`);
}
function kn(e, t) {
  let n = On(t);
  if (!n) return [];
  let r = [];
  return (
    e.descendants((e, t) => {
      if (r.length >= Tn) return !1;
      if (!e.isTextblock) return !0;
      let i = e.textBetween(0, e.content.size, void 0, En);
      n.lastIndex = 0;
      let a;
      for (; (a = n.exec(i)) && r.length < Tn;)
        a[0].length === 0
          ? (n.lastIndex += 1)
          : r.push({ from: t + 1 + a.index, to: t + 1 + a.index + a[0].length });
      return !1;
    }),
    r
  );
}
function An(e, t) {
  if (!e.length) return -1;
  let n = e.findIndex((e) => e.from >= t);
  return n < 0 ? 0 : n;
}
function jn() {
  return new c({
    key: V,
    state: {
      init: () => Dn,
      apply(e, t, n, r) {
        let i = e.getMeta(V);
        if (i?.type === `clear`) return Dn;
        if (i?.type === `set`) {
          let e = kn(r.doc, i.options);
          return { ...i.options, matches: e, current: An(e, r.selection.from) };
        }
        if (i?.type === `goto`) return { ...t, current: i.index };
        if (e.docChanged && t.query) {
          let n = kn(r.doc, t),
            i = t.matches[t.current]?.from,
            a = i === void 0 ? -1 : An(n, e.mapping.map(i));
          return { ...t, matches: n, current: a };
        }
        return t;
      },
    },
    props: {
      decorations(e) {
        let t = V.getState(e);
        return t?.matches.length
          ? he.create(
              e.doc,
              t.matches.map((e, n) =>
                w.inline(e.from, e.to, {
                  class:
                    n === t.current ? `nova-search-match nova-search-current` : `nova-search-match`,
                }),
              ),
            )
          : null;
      },
    },
  });
}
function H(e) {
  return V.getState(e) ?? Dn;
}
function Mn(e) {
  return (t, n) => (n?.(t.tr.setMeta(V, { type: `set`, options: e })), !0);
}
var Nn = (e, t) => (t?.(e.tr.setMeta(V, { type: `clear` })), !0);
function Pn(e, t, n) {
  return e
    .setMeta(V, { type: `goto`, index: n })
    .setSelection(o.create(e.doc, t.from, t.to))
    .scrollIntoView();
}
function Fn(e = 1) {
  return (t, n) => {
    let { matches: r, current: i } = H(t);
    if (!r.length) return !1;
    let a =
      (i >= 0 && t.selection.from === r[i].from && t.selection.to === r[i].to) || i < 0
        ? (Math.max(i, 0) + e + r.length) % r.length
        : i;
    return (n && n(Pn(t.tr, r[a], a)), !0);
  };
}
function In(e) {
  return (t, n) => {
    let { matches: r, current: i } = H(t),
      a = r[i];
    if (!a) return !1;
    if (n) {
      let r = t.tr,
        i = t.doc.resolve(a.from).marksAcross(t.doc.resolve(a.to)) ?? [];
      e ? r.replaceWith(a.from, a.to, t.schema.text(e, i)) : r.delete(a.from, a.to);
      let s = r.mapping.map(a.to);
      n(r.setSelection(o.create(r.doc, s)).scrollIntoView());
    }
    return !0;
  };
}
function Ln(e) {
  return (t, n) => {
    let { matches: r } = H(t);
    if (!r.length) return !1;
    if (n) {
      let i = t.tr;
      for (let n = r.length - 1; n >= 0; n--) {
        let { from: a, to: o } = r[n],
          s = t.doc.resolve(a).marksAcross(t.doc.resolve(o)) ?? [];
        e ? i.replaceWith(a, o, t.schema.text(e, s)) : i.delete(a, o);
      }
      n(i.scrollIntoView());
    }
    return !0;
  };
}
function Rn(e) {
  return e.root.classList.contains(`nova-fullscreen`);
}
function zn(e, t = !Rn(e)) {
  (e.root.classList.toggle(`nova-fullscreen`, t),
    document.documentElement.classList.toggle(`nova-fullscreen-lock`, t),
    e.ui.closePopover(),
    e.updateUI(),
    e.focus());
}
function Bn(e) {
  let { t } = e.ui,
    r = A(`div`, { className: `nova-prosemirror nova-preview` });
  (r.append(n.fromSchema(e.schema).serializeFragment(e.view.state.doc.content)),
    r.querySelectorAll(`a[href]`).forEach((e) => {
      (e.setAttribute(`target`, `_blank`), e.setAttribute(`rel`, `noopener noreferrer`));
    }),
    e.ui.openDialog({
      title: t(`preview`),
      body: r,
      size: `large`,
      cancelLabel: t(`dialog.close`),
    }));
}
function Vn(e) {
  return e
    .replace(
      /(<\/(p|h[1-6]|ul|ol|li|blockquote|pre|table|tbody|tr)>|<hr>)/g,
      `$1
`,
    )
    .replace(
      /(<(ul|ol|table|tbody|tr|blockquote)( [^>]*)?>)/g,
      `$1
`,
    )
    .replace(
      /\n{2,}/g,
      `
`,
    )
    .trim();
}
function Hn(e) {
  let { t } = e.ui,
    n = Vn(e.getHTML()),
    r = A(`textarea`, {
      className: `nova-input nova-source`,
      spellcheck: `false`,
      'aria-label': t(`sourceCode`),
      autocomplete: `off`,
      rows: `18`,
    });
  ((r.value = n),
    e.ui.openDialog({
      title: t(`sourceCode`),
      body: r,
      size: `large`,
      submitLabel: t(`dialog.save`),
      initialFocus: r,
      onSubmit: () => (r.value !== n && e.setContent(r.value), !0),
    }));
}
var Un = [
  {
    group: `help.formatting`,
    rows: [
      { label: `bold`, keys: `Mod-b` },
      { label: `italic`, keys: `Mod-i` },
      { label: `underline`, keys: `Mod-u` },
      { label: `strike`, keys: `Mod-Shift-x` },
      { label: `code`, keys: `Mod-e` },
      { label: `superscript`, keys: `Mod-.` },
      { label: `subscript`, keys: `Mod-,` },
      { label: `link`, keys: `Mod-k` },
      { label: `clearFormatting`, keys: `Mod-\\` },
    ],
  },
  {
    group: `help.blocks`,
    rows: [
      { label: `paragraph`, keys: `Mod-Alt-0` },
      { label: `h1`, keys: `Mod-Alt-1` },
      { label: `h2`, keys: `Mod-Alt-2` },
      { label: `h3`, keys: `Mod-Alt-3` },
      { label: `bulletList`, keys: `Mod-Shift-8` },
      { label: `orderedList`, keys: `Mod-Shift-7` },
      { label: `alignCenter`, keys: `Mod-Shift-e` },
    ],
  },
  {
    group: `help.editing`,
    rows: [
      { label: `undo`, keys: `Mod-z` },
      { label: `redo`, keys: `Mod-Shift-z` },
      { label: `search.title`, keys: `Mod-f` },
      { label: `pasteAsText`, keys: `Mod-Shift-v` },
      { label: `fullscreen`, keys: `Mod-Shift-f` },
      { label: `help.slash`, keys: `/` },
    ],
  },
  {
    group: `help.navigation`,
    rows: [
      { label: `help.toMenubar`, keys: `Alt-F9` },
      { label: `help.toToolbar`, keys: `Alt-F10` },
      { label: `help.toContextToolbar`, keys: `Ctrl-F9` },
      { label: `help.toEditor`, keys: `Escape` },
      { label: `help.nextCell`, keys: `Tab` },
      { label: `help`, keys: `Alt-0` },
    ],
  },
];
function Wn(e) {
  let { t } = e.ui,
    n = A(`div`, { className: `nova-help` });
  for (let { group: e, rows: r } of Un)
    n.append(
      A(
        `section`,
        {},
        A(`h3`, {}, t(e)),
        A(
          `table`,
          { className: `nova-help-table` },
          A(
            `tbody`,
            {},
            r.map(({ label: e, keys: n }) =>
              A(`tr`, {}, A(`td`, {}, t(e)), A(`td`, {}, A(`kbd`, {}, n.length === 1 ? n : be(n)))),
            ),
          ),
        ),
      ),
    );
  e.ui.openDialog({ title: t(`help`), body: n, size: `large`, cancelLabel: t(`dialog.close`) });
}
var Gn = new Set([
    `area`,
    `base`,
    `br`,
    `col`,
    `embed`,
    `hr`,
    `img`,
    `input`,
    `link`,
    `meta`,
    `source`,
    `track`,
    `wbr`,
  ]),
  Kn = RegExp(`\xA0`, `g`);
function qn(e) {
  return e.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`).replace(Kn, `&nbsp;`);
}
var Jn = `\xA0`;
function Yn(e) {
  let t = null,
    n = !0,
    r = e.childCount;
  for (let i = 0; i < r; i++) {
    let a = e.child(i);
    if (!a.isText) {
      n = a.type.name === `hard_break` || !a.isInline;
      continue;
    }
    let o = a.text ?? ``;
    if (!o.includes(` `)) {
      n = !1;
      continue;
    }
    let s = i === r - 1 || !e.child(i + 1).isInline,
      c = ``;
    for (let e = 0; e < o.length; e++) {
      let t = o[e];
      t === ` `
        ? n || (s && e === o.length - 1)
          ? ((c += Jn), (n = !1))
          : ((c += ` `), (n = !0))
        : ((c += t), (n = !1));
    }
    c !== o && (t ??= new Map()).set(i, c);
  }
  return t;
}
function Xn(e) {
  return e
    .replace(/&/g, `&amp;`)
    .replace(/"/g, `&quot;`)
    .replace(/</g, `&lt;`)
    .replace(/>/g, `&gt;`)
    .replace(Kn, `&nbsp;`);
}
var Zn = /^[a-z][a-z0-9-]*$/i,
  Qn = new Set([
    `script`,
    `style`,
    `base`,
    `link`,
    `meta`,
    `object`,
    `embed`,
    `applet`,
    `frame`,
    `frameset`,
    `template`,
    `noscript`,
  ]),
  $n = new Set([`href`, `xlink:href`, `action`, `formaction`, `cite`]),
  er = new Set([`src`, `poster`, `data`, `background`]),
  tr = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding/i;
function nr(e, t) {
  let n = e.toLowerCase();
  return n.startsWith(`on`)
    ? null
    : $n.has(n)
      ? ne(t)
        ? t
        : null
      : er.has(n)
        ? b(t)
          ? t
          : null
        : n === `srcset`
          ? t
              .split(`,`)
              .map((e) => e.trim().split(/\s+/)[0] ?? ``)
              .every((e) => b(e))
            ? t
            : null
          : n === `style` && tr.test(t)
            ? null
            : t;
}
var rr = new Set();
function ir(e) {
  rr.has(e) ||
    (rr.add(e),
    console.error(
      `[nova] toDOM produced <${e}>, which is not allowed in output; the tag was dropped`,
    ));
}
var ar = /^[a-z_:][a-z0-9_.:-]*$/i;
function or(e) {
  if (typeof e == `string`) return { open: ``, close: ``, hole: !1, html: qn(e) };
  if (typeof e == `number` || typeof e == `boolean`)
    return { open: ``, close: ``, hole: !1, html: qn(String(e)) };
  if (e == null) return { open: ``, close: ``, hole: !1, html: `` };
  if (!Array.isArray(e)) throw Error(`[nova] serializer supports only array/string toDOM specs`);
  let [t, ...n] = e,
    r = t.includes(` `) ? t.split(` `)[1] : t;
  if (!Zn.test(r)) throw Error(`[nova] invalid tag in toDOM: ${r}`);
  let i = Qn.has(r.toLowerCase());
  i && ir(r.toLowerCase());
  let a = ``,
    o = n,
    s = n[0];
  if (s && typeof s == `object` && !Array.isArray(s)) {
    for (let [e, t] of Object.entries(s)) {
      if (t == null) continue;
      let n = e.includes(` `) ? e.split(` `)[1] : e;
      if (!ar.test(n)) continue;
      let r = nr(n, String(t));
      r !== null && (a += ` ${n}="${Xn(r)}"`);
    }
    o = n.slice(1);
  }
  let c = i ? `` : `<${r}${a}>`;
  if (Gn.has(r.toLowerCase())) return { open: c, close: ``, hole: !1, html: c };
  let l = ``,
    u = ``,
    d = !1;
  for (let e of o) {
    if (e === 0) {
      if (d) throw Error(`[nova] toDOM spec has more than one content hole`);
      d = !0;
      continue;
    }
    let t = or(e);
    if (d) {
      if (t.hole) throw Error(`[nova] toDOM spec has more than one content hole`);
      u += t.html;
    } else t.hole ? ((l += t.open), (u += t.close), (d = !0)) : (l += t.html);
  }
  if (i) return { open: ``, close: ``, hole: d, html: `` };
  let f = `</${r}>`;
  return { open: c + l, close: u + f, hole: d, html: c + l + u + f };
}
var sr = class {
    cache = new Map();
    serializeFragment(e, { pre: t = !1 } = {}) {
      let n = t ? null : Yn(e),
        r = ``,
        i = [],
        a = [],
        o = (e) => {
          for (; i.length > e;) ((r += a.pop()), i.pop());
        };
      return (
        e.forEach((e, t, s) => {
          if (!e.isInline) {
            (o(0), (r += this.serializeNode(e)));
            return;
          }
          let c = 0;
          for (; c < i.length && c < e.marks.length && i[c].eq(e.marks[c]);) c++;
          o(c);
          for (let t = c; t < e.marks.length; t++) {
            let n = e.marks[t],
              o = this.renderMark(n, e.isText);
            ((r += o.open), a.push(o.close), i.push(n));
          }
          r += e.isText ? qn(n?.get(s) ?? e.text ?? ``) : this.serializeNode(e);
        }),
        o(0),
        (i = []),
        (a = []),
        r
      );
    }
    serializeNode(e) {
      let t = e.type.spec.toDOM;
      if (!t) throw Error(`[nova] node "${e.type.name}" has no toDOM`);
      let n = or(t(e));
      if (!n.hole) return n.html;
      let r = !!e.type.spec.code || e.type.spec.whitespace === `pre`;
      return n.open + this.serializeFragment(e.content, { pre: r }) + n.close;
    }
    renderMark(e, t) {
      let n = e.type.spec.toDOM;
      if (!n) throw Error(`[nova] mark "${e.type.name}" has no toDOM`);
      let r = `${e.type.name}:${JSON.stringify(e.attrs)}`,
        i = this.cache.get(r);
      return (
        i || ((i = or(n(e, t))), this.cache.size > 500 && this.cache.clear(), this.cache.set(r, i)),
        i
      );
    }
  },
  cr = { color: T.color, background: T.color, font_family: T.fontFamily, font_size: T.length };
function U(e, t) {
  return (n, r) => {
    let i = x(n)[e],
      a = t === null ? null : cr[e](t);
    if (t !== null && !a) return !1;
    let { empty: o } = n.selection;
    if (!r) return !0;
    let s = n.tr;
    if (o) (s.removeStoredMark(i), a && s.addStoredMark(i.create({ value: a })));
    else
      for (let e of n.selection.ranges)
        (s.removeMark(e.$from.pos, e.$to.pos, i),
          a && s.addMark(e.$from.pos, e.$to.pos, i.create({ value: a })));
    return (r(s.scrollIntoView()), !0);
  };
}
function W(e, t) {
  let n = x(e)[t],
    { $from: r, empty: i } = e.selection,
    a = i ? (e.storedMarks ?? r.marks()) : (r.nodeAfter?.marks ?? r.marks()),
    o = n.isInSet(a);
  return o ? o.attrs.value : null;
}
function lr(e) {
  return (t, n) => {
    let r = e === null ? null : T.lineHeight(e);
    if (e !== null && !r) return !1;
    let { from: i, to: a } = t.selection,
      o = t.tr,
      s = !1;
    return (
      t.doc.nodesBetween(i, a, (e, n) => {
        (e.type === S(t).paragraph || e.type === S(t).heading) &&
          ((s = !0), o.setNodeMarkup(n, void 0, { ...e.attrs, lineHeight: r }));
      }),
      s ? (n?.(o), !0) : !1
    );
  };
}
function ur(e) {
  return e.selection.$from.parent.attrs.lineHeight ?? null;
}
var dr =
  `#000000.#434343.#666666.#999999.#b7b7b7.#d9d9d9.#efefef.#ffffff.#b91c1c.#c2410c.#a16207.#15803d.#0e7490.#1d4ed8.#6d28d9.#be185d.#ef4444.#f97316.#eab308.#22c55e.#06b6d4.#3b82f6.#8b5cf6.#ec4899.#fecaca.#fed7aa.#fef08a.#bbf7d0.#a5f3fc.#bfdbfe.#ddd6fe.#fbcfe8`.split(
    `.`,
  );
function fr(e) {
  let t = [],
    n = e.current?.toLowerCase() ?? null,
    r = A(`div`, { className: `nova-swatches`, role: `grid`, 'aria-label': e.label }),
    i = null;
  for (let a of e.colors) {
    let o = n === a.toLowerCase(),
      s = A(
        `button`,
        {
          type: `button`,
          className: `nova-swatch`,
          role: `gridcell`,
          'aria-label': a,
          'aria-selected': String(o),
          title: a,
          tabindex: `-1`,
        },
        o ? k(O.check) : null,
      );
    (s.style.setProperty(`--swatch`, a),
      s.addEventListener(`click`, () => e.onPick(a)),
      t.push(s),
      (i && i.childElementCount !== 8) ||
        ((i = A(`div`, { className: `nova-swatch-row`, role: `row` })), r.append(i)),
      i.append(s));
  }
  ((t.find((e) => e.getAttribute(`aria-selected`) === `true`) ?? t[0])?.setAttribute(
    `tabindex`,
    `0`,
  ),
    r.addEventListener(`keydown`, (e) => {
      let n = t.indexOf(document.activeElement);
      if (n < 0) return;
      let r = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 }[e.key];
      if (r === void 0) return;
      e.preventDefault();
      let i = t[Math.min(t.length - 1, Math.max(0, n + r))];
      ((t[n].tabIndex = -1), (i.tabIndex = 0), i.focus());
    }));
  let a = A(
    `button`,
    { type: `button`, className: `nova-panel-action` },
    k(O.clearFormatting),
    e.removeLabel,
  );
  a.addEventListener(`click`, () => e.onPick(null));
  let o = A(`input`, {
    type: `color`,
    className: `nova-color-input`,
    'aria-label': e.customLabel,
    value: /^#[0-9a-f]{6}$/i.test(n ?? ``) ? n : `#000000`,
  });
  return (
    o.addEventListener(`change`, () => e.onPick(o.value)),
    A(
      `div`,
      { className: `nova-color-panel` },
      r,
      A(
        `div`,
        { className: `nova-panel-footer` },
        a,
        A(`label`, { className: `nova-panel-action` }, o, e.customLabel),
      ),
    )
  );
}
function pr(e) {
  let { registry: t, t: n } = e.ui,
    r = (e, t) => n(`table.size`, { rows: e, cols: t });
  t.addPanelButton(`table`, {
    icon: O.table,
    tooltip: n(`table.insert`),
    isEnabled: (e) => e.can(M(1, 1)),
    render: (e, t) =>
      Fe(
        (n, r) => {
          (t(), e.exec(M(n, r)));
        },
        r,
        n(`table.insert`),
      ),
  });
  let i = (e, r, i, a, o) =>
    t.addButton(e, {
      icon: i,
      tooltip: n(r),
      onAction: (e) => e.exec(a),
      isEnabled: (e) => e.can(a),
      ...(o ? { isActive: o } : {}),
    });
  (i(`tableinsertrowbefore`, `table.rowBefore`, O.rowBefore, N.addRowBefore),
    i(`tableinsertrowafter`, `table.rowAfter`, O.rowAfter, N.addRowAfter),
    i(`tabledeleterow`, `table.rowDelete`, O.rowDelete, N.deleteRow),
    i(`tableinsertcolbefore`, `table.colBefore`, O.colBefore, N.addColumnBefore),
    i(`tableinsertcolafter`, `table.colAfter`, O.colAfter, N.addColumnAfter),
    i(`tabledeletecol`, `table.colDelete`, O.colDelete, N.deleteColumn),
    i(`tablemergecells`, `table.merge`, O.merge, N.mergeCells),
    i(`tablesplitcells`, `table.split`, O.split, N.splitCell),
    i(`tablerowheader`, `table.rowHeader`, O.rowHeader, N.toggleHeaderRow, (e) => Oe(e.view.state)),
    i(`tablecolheader`, `table.colHeader`, O.colHeader, N.toggleHeaderColumn, (e) =>
      ze(e.view.state),
    ),
    i(`tabledelete`, `table.delete`, O.tableDelete, N.deleteTable),
    t.addPanelButton(`tablecellbackground`, {
      icon: O.highlight,
      tooltip: n(`table.cellBackground`),
      isEnabled: (e) => _e(e.view.state),
      render: (e, t) =>
        fr({
          colors: e.options.colors ?? dr,
          current: null,
          label: n(`table.cellBackground`),
          removeLabel: n(`removeColor`),
          customLabel: n(`customColor`),
          onPick: (n) => {
            (t(), e.exec(Ve(n)));
          },
        }),
    }),
    t.addMenuButton(`advtablesort`, {
      icon: O.sort,
      tooltip: n(`table.sort`),
      isEnabled: (e) => e.can(xe(`asc`)),
      items: (e) =>
        [`asc`, `desc`].map((t) => ({
          id: t,
          label: n(t === `asc` ? `table.sortAsc` : `table.sortDesc`),
          onSelect: () => e.exec(xe(t, e.options.language)),
        })),
    }),
    t.addButton(`tableprops`, {
      icon: O.tableProps,
      tooltip: n(`table.props`),
      isEnabled: (e) => _e(e.view.state),
      onAction: (e) => hr(e),
    }),
    t.addButton(`tablecellprops`, {
      icon: O.cellProps,
      tooltip: n(`table.cellProps`),
      isEnabled: (e) => _e(e.view.state),
      onAction: (e) => gr(e),
    }),
    t.addContextToolbar(`table`, {
      label: n(`table.toolbar`),
      predicate: (e) => _e(e.view.state),
      anchor: (e) => Se(e),
      placement: `bottom-start`,
      items: `tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablemergecells tablesplitcells | tablerowheader tablecolheader tablecellbackground | advtablesort tablecellprops tableprops | tabledelete`,
    }));
}
function mr(e, t, n) {
  if (!t?.length) return null;
  let { t: r } = e.ui,
    i = [{ value: ``, label: r(`table.styleDefault`) }];
  for (let e of t) e.value && i.push({ value: e.value, label: e.title });
  return (
    n && !i.some((e) => e.value === n) && i.push({ value: n, label: n }),
    Te({ label: r(`table.style`), value: n ?? ``, options: i })
  );
}
function hr(e) {
  let { t } = e.ui,
    n = Ie(e.view.state);
  if (!n) return;
  let r = j({ label: t(`table.width`), hint: t(`table.widthHint`), value: n.width ?? `` }),
    i = Te({
      label: t(`table.align`),
      value: n.align ?? ``,
      options: [
        { value: ``, label: t(`table.alignDefault`) },
        { value: `center`, label: t(`table.alignCenter`) },
        { value: `right`, label: t(`table.alignRight`) },
      ],
    }),
    a = mr(e, e.options.tableClassList, n.class ?? null);
  e.ui.openDialog({
    title: t(`table.props`),
    body: A(`div`, { className: `nova-form` }, a?.el ?? null, r.el, i.el),
    submitLabel: t(`dialog.save`),
    onSubmit: () => {
      let n = {
        width: r.input.value.trim().replace(/^(\d+(\.\d+)?)$/, `$1px`) || null,
        align: i.select.value || null,
        ...(a ? { class: a.select.value || null } : {}),
      };
      return e.exec(Ce(n)) || t(`table.invalidWidth`);
    },
  });
}
function gr(e) {
  let { t } = e.ui,
    n = Me(e.view.state);
  if (!n) return;
  let r = Te({
      label: t(`table.valign`),
      value: n.valign ?? ``,
      options: [
        { value: ``, label: t(`table.alignDefault`) },
        { value: `top`, label: t(`table.valignTop`) },
        { value: `middle`, label: t(`table.valignMiddle`) },
        { value: `bottom`, label: t(`table.valignBottom`) },
      ],
    }),
    i = Te({
      label: t(`table.cellType`),
      value: n.header ? `th` : `td`,
      options: [
        { value: `td`, label: t(`table.cellData`) },
        { value: `th`, label: t(`table.cellHeader`) },
      ],
    }),
    a = j({
      label: t(`table.colWidth`),
      hint: t(`table.colWidthHint`),
      value: n.width ? String(n.width) : ``,
    }),
    o = mr(e, e.options.tableCellClassList, n.class ?? null);
  e.ui.openDialog({
    title: t(`table.cellProps`),
    body: A(`div`, { className: `nova-form` }, o?.el ?? null, r.el, i.el, a.el),
    submitLabel: t(`dialog.save`),
    onSubmit: () => {
      let n = a.input.value.trim(),
        s = n ? Number(n.replace(/px$/i, ``)) : null;
      return s !== null && !(Number.isInteger(s) && s >= 24 && s <= 4e3)
        ? t(`table.invalidColWidth`)
        : (e.exec(
            Ue({
              valign: r.select.value || null,
              header: i.select.value === `th`,
              width: s,
              ...(o ? { class: o.select.value || null } : {}),
            }),
          ),
          !0);
    },
  });
}
var _r = [
    { label: `Sans Serif`, value: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` },
    { label: `Serif`, value: `Georgia, "Times New Roman", serif` },
    { label: `Monospace`, value: `ui-monospace, Menlo, Consolas, monospace` },
    { label: `Arial`, value: `Arial, Helvetica, sans-serif` },
    { label: `Georgia`, value: `Georgia, serif` },
    { label: `Times New Roman`, value: `"Times New Roman", Times, serif` },
    { label: `Verdana`, value: `Verdana, Geneva, sans-serif` },
    { label: `Courier New`, value: `"Courier New", Courier, monospace` },
  ],
  vr = [`8pt`, `10pt`, `12pt`, `14pt`, `16pt`, `18pt`, `24pt`, `36pt`, `48pt`],
  yr = [`1`, `1.15`, `1.5`, `2`, `2.5`, `3`],
  G = {
    undo: `Mod-z`,
    redo: `Mod-Shift-z`,
    bold: `Mod-b`,
    italic: `Mod-i`,
    underline: `Mod-u`,
    strike: `Mod-Shift-x`,
    code: `Mod-e`,
    subscript: `Mod-,`,
    superscript: `Mod-.`,
    bulletList: `Mod-Shift-8`,
    orderedList: `Mod-Shift-7`,
    alignLeft: `Mod-Shift-l`,
    alignCenter: `Mod-Shift-e`,
    alignRight: `Mod-Shift-r`,
    alignJustify: `Mod-Shift-j`,
    clearFormatting: `Mod-\\`,
    paragraph: `Mod-Alt-0`,
    h1: `Mod-Alt-1`,
    h2: `Mod-Alt-2`,
    h3: `Mod-Alt-3`,
    h4: `Mod-Alt-4`,
    h5: `Mod-Alt-5`,
    h6: `Mod-Alt-6`,
  };
function br(e) {
  try {
    let { node: t } = e.view.domAtPos(e.view.state.selection.from),
      n = t.nodeType === Node.TEXT_NODE ? t.parentElement : t;
    return n ? getComputedStyle(n) : null;
  } catch {
    return null;
  }
}
var xr = {
  'system-ui': `Sans Serif`,
  '-apple-system': `Sans Serif`,
  'sans-serif': `Sans Serif`,
  serif: `Serif`,
  monospace: `Monospace`,
  'ui-monospace': `Monospace`,
};
function Sr(e) {
  let t = String(e).split(`,`)[0].trim().replace(/["']/g, ``);
  return xr[t.toLowerCase()] ?? t;
}
function Cr(e) {
  let t = parseFloat(e);
  return !Number.isFinite(t) || t <= 0 ? null : `${Math.round(t * 0.75 * 2) / 2}pt`;
}
var wr = (e, t) =>
  typeof e == `string` &&
  e.replace(/["'\s]/g, ``).toLowerCase() === t.replace(/["'\s]/g, ``).toLowerCase();
function Tr(e) {
  let { registry: t, t: n } = e.ui,
    r = () => e.view.state,
    i = (e, r, i, a) =>
      t.addButton(e, {
        icon: i,
        tooltip: n(r),
        ...(G[r] ? { shortcut: G[r] } : {}),
        onAction: (e) => e.exec(r),
        isEnabled: (e) => e.can(r),
        ...(a ? { isActive: a } : {}),
      }),
    a = (t, n, a, o) => i(t, n, o, () => ie(r(), e.schema.marks[a]));
  (i(`undo`, `undo`, O.undo),
    i(`redo`, `redo`, O.redo),
    a(`bold`, `bold`, `bold`, O.bold),
    a(`italic`, `italic`, `italic`, O.italic),
    a(`underline`, `underline`, `underline`, O.underline),
    a(`strikethrough`, `strike`, `strike`, O.strike),
    a(`inlinecode`, `code`, `code`, O.code),
    a(`subscript`, `subscript`, `subscript`, O.subscript),
    a(`superscript`, `superscript`, `superscript`, O.superscript),
    i(`bullist`, `bulletList`, O.bulletList, () => se(r(), e.schema.nodes.bullet_list)),
    i(`numlist`, `orderedList`, O.orderedList, () => se(r(), e.schema.nodes.ordered_list)),
    i(`indent`, `indent`, O.indent),
    i(`outdent`, `outdent`, O.outdent),
    i(`blockquote`, `blockquote`, O.blockquote, () => se(r(), e.schema.nodes.blockquote)),
    i(`codeblock`, `codeBlock`, O.codeBlock, () => se(r(), e.schema.nodes.code_block)),
    i(`hr`, `horizontalRule`, O.horizontalRule),
    i(`removeformat`, `clearFormatting`, O.clearFormatting));
  let o = [
    [`alignLeft`, `left`, O.alignLeft],
    [`alignCenter`, `center`, O.alignCenter],
    [`alignRight`, `right`, O.alignRight],
    [`alignJustify`, `justify`, O.alignJustify],
  ];
  for (let [e, t, n] of o) i(e.toLowerCase(), e, n, () => re(r()) === t);
  t.addMenuButton(`align`, {
    icon: O.alignLeft,
    tooltip: n(`align`),
    isEnabled: (e) => e.can(`alignLeft`),
    items: (e) =>
      o.map(([t, r, i]) => ({
        id: t,
        label: n(t),
        icon: i,
        ...(G[t] ? { shortcut: G[t] } : {}),
        active: re(e.view.state) === r,
        onSelect: () => e.exec(t),
      })),
  });
  let s = [
      { command: `paragraph`, style: `` },
      { command: `h1`, style: `font-size: 1.6em; font-weight: 700` },
      { command: `h2`, style: `font-size: 1.35em; font-weight: 700` },
      { command: `h3`, style: `font-size: 1.15em; font-weight: 700` },
      { command: `h4`, style: `font-size: 1em; font-weight: 700` },
      { command: `h5`, style: `font-size: 0.9em; font-weight: 700` },
      { command: `h6`, style: `font-size: 0.85em; font-weight: 700` },
      { command: `codeBlock`, style: `font-family: ui-monospace, monospace` },
    ],
    c = () => {
      let t = r().selection.$from.parent;
      return t.type === e.schema.nodes.heading
        ? `h${t.attrs.level}`
        : t.type === e.schema.nodes.code_block
          ? `codeBlock`
          : `paragraph`;
    };
  for (let e = 1; e <= 6; e++) {
    let r = `h${e}`;
    t.addToggleButton(r, {
      ...(e <= 3 ? { icon: O[`h${e}`] } : { text: `H${e}` }),
      tooltip: n(r),
      ...(G[r] ? { shortcut: G[r] } : {}),
      isActive: () => c() === r,
      isEnabled: (e) => e.can(r) || c() === r,
      onAction: (e) => e.exec(c() === r ? `paragraph` : r),
    });
  }
  let l = {
      p: `paragraph`,
      h1: `h1`,
      h2: `h2`,
      h3: `h3`,
      h4: `h4`,
      h5: `h5`,
      h6: `h6`,
      pre: `codeBlock`,
    },
    u = () => {
      let t = e.options.blockFormats;
      return t?.length
        ? t.flatMap(({ label: e, block: t }) => {
            let n = l[t],
              r = s.find((e) => e.command === n);
            return r ? [{ ...r, label: e }] : [];
          })
        : s;
    };
  t.addMenuButton(`blocks`, {
    tooltip: n(`blocks`),
    label: () => u().find((e) => e.command === c())?.label ?? n(c()),
    minChars: 11,
    isEnabled: (e) => u().some(({ command: t }) => e.can(t)),
    items: (e) =>
      u()
        .filter(({ command: t }) => e.isAllowed(t))
        .map(({ command: t, style: r, label: i }) => ({
          id: t,
          label: i ?? n(t),
          labelStyle: r,
          ...(G[t] ? { shortcut: G[t] } : {}),
          active: c() === t,
          onSelect: () => e.exec(t),
        })),
  });
  let d = () => [
      {
        title: n(`styles.headings`),
        items: [1, 2, 3, 4, 5, 6].map((e) => ({ title: n(`h${e}`), block: `h${e}` })),
      },
      {
        title: n(`styles.inline`),
        items: [
          { title: n(`bold`), inline: `strong` },
          { title: n(`italic`), inline: `em` },
          { title: n(`underline`), inline: `u` },
          { title: n(`strike`), inline: `s` },
          { title: n(`superscript`), inline: `sup` },
          { title: n(`subscript`), inline: `sub` },
          { title: n(`code`), inline: `code` },
        ],
      },
      {
        title: n(`styles.blocks`),
        items: [
          { title: n(`paragraph`), block: `p` },
          { title: n(`blockquote`), block: `blockquote` },
          { title: n(`codeBlock`), block: `pre` },
        ],
      },
      {
        title: n(`styles.align`),
        items: [`left`, `center`, `right`, `justify`].map((e) => ({
          title: n(`align${e === `justify` ? `Justify` : e[0].toUpperCase() + e.slice(1)}`),
          selector: `p,h1,h2,h3,h4,h5,h6`,
          styles: { 'text-align': e },
        })),
      },
    ],
    f = (e) => e.format ?? e,
    p = (t) => {
      let n = t.format ? e.formatter.get(t.format)?.[0] : t,
        r = [],
        i = n?.block;
      (i && /^h[1-6]$/.test(i) && r.push(`font-weight: 700`),
        (n?.inline === `strong` || n?.inline === `b`) && r.push(`font-weight: 700`),
        (n?.inline === `em` || n?.inline === `i`) && r.push(`font-style: italic`),
        n?.inline === `u` && r.push(`text-decoration: underline`),
        (n?.inline === `s` || n?.inline === `strike` || n?.inline === `del`) &&
          r.push(`text-decoration: line-through`),
        (n?.inline === `code` || i === `pre`) && r.push(`font-family: ui-monospace, monospace`));
      for (let e of [`color`, `background-color`, `font-family`]) {
        let t = n?.styles?.[e];
        t && /^[#\w\s,'"().%-]+$/.test(t) && r.push(`${e}: ${t}`);
      }
      return r.join(`; `);
    },
    m = (e) => e.flatMap((e) => (e.items ? m(e.items) : [e])),
    h = () => {
      let t = e.options.styleFormats;
      return t ? (e.options.styleFormatsMerge ? [...d(), ...t] : t) : d();
    };
  t.addMenuButton(`styles`, {
    tooltip: n(`styles`),
    minChars: 10,
    label: (e) => m(h()).find((t) => e.formatter.match(f(t)))?.title ?? n(`styles`),
    items: (e) => {
      let t = [],
        n = (r, i) => {
          r.forEach((r, a) => {
            r.items
              ? (t.length && t.push({ type: `separator` }),
                t.push({ type: `heading`, label: r.title }),
                n(r.items, `${i}${a}-`))
              : t.push({
                  id: `style-${i}${a}`,
                  label: r.title,
                  labelStyle: p(r),
                  active: e.formatter.match(f(r)),
                  disabled: !e.formatter.canApply(f(r)),
                  onSelect: () => e.formatter.toggle(f(r)),
                });
          });
        };
      return (n(h(), ``), t);
    },
  });
  let g = e.options.fontFamilies ?? _r;
  t.addMenuButton(`fontfamily`, {
    tooltip: n(`fontFamily`),
    minChars: 9,
    label: (e) => {
      let t = W(r(), `font_family`);
      if (t) return g.find((e) => wr(t, e.value))?.label ?? Sr(t);
      let i = br(e)?.fontFamily;
      return i ? Sr(i) : n(`fontFamily`);
    },
    items: (e) => {
      let t = W(e.view.state, `font_family`);
      return [
        {
          id: `default`,
          label: n(`default`),
          active: t === null,
          onSelect: () => e.exec(U(`font_family`, null)),
        },
        { type: `separator` },
        ...g.map((n) => ({
          id: n.label,
          label: n.label,
          labelStyle: `font-family: ${n.value}`,
          active: wr(t, n.value),
          onSelect: () => e.exec(U(`font_family`, n.value)),
        })),
      ];
    },
  });
  let _ = e.options.fontSizes ?? vr;
  t.addMenuButton(`fontsize`, {
    tooltip: n(`fontSize`),
    minChars: 4,
    label: (e) => W(r(), `font_size`) ?? Cr(br(e)?.fontSize ?? ``) ?? `—`,
    items: (e) => {
      let t = W(e.view.state, `font_size`);
      return [
        {
          id: `default`,
          label: n(`default`),
          active: t === null,
          onSelect: () => e.exec(U(`font_size`, null)),
        },
        { type: `separator` },
        ..._.map((n) => ({
          id: n,
          label: n,
          active: t === n,
          onSelect: () => e.exec(U(`font_size`, n)),
        })),
      ];
    },
  });
  let v = e.options.lineHeights ?? yr;
  t.addMenuButton(`lineheight`, {
    icon: O.lineHeight,
    tooltip: n(`lineHeight`),
    isEnabled: (e) => e.can(lr(null)),
    items: (e) => {
      let t = ur(e.view.state);
      return [
        {
          id: `default`,
          label: n(`default`),
          active: t === null,
          onSelect: () => e.exec(lr(null)),
        },
        ...v.map((n) => ({ id: n, label: n, active: t === n, onSelect: () => e.exec(lr(n)) })),
      ];
    },
  });
  let y = (e, i, a, o) =>
    t.addPanelButton(e, {
      icon: a,
      tooltip: n(o),
      indicator: () => W(r(), i),
      render: (e, t) =>
        fr({
          colors: e.options.colors ?? dr,
          current: W(e.view.state, i),
          label: n(o),
          removeLabel: n(`removeColor`),
          customLabel: n(`customColor`),
          onPick: (n) => {
            (t(), e.exec(U(i, n)));
          },
        }),
    });
  (y(`forecolor`, `color`, O.textColor, `textColor`),
    y(`backcolor`, `background`, O.highlight, `backgroundColor`));
  let b = [
    [`superscript`, `superscript`, O.superscript],
    [`subscript`, `subscript`, O.subscript],
    [`code`, `code`, O.code],
  ];
  (t.addMenuButton(`moreformats`, {
    icon: O.formatMore,
    tooltip: n(`moreFormats`),
    isActive: (t) => b.some(([, n]) => ie(t.view.state, e.schema.marks[n])),
    items: (t) => [
      ...b
        .filter(([e]) => t.isAllowed(e))
        .map(([r, i, a]) => ({
          id: r,
          label: n(r),
          icon: a,
          checkbox: !0,
          active: ie(t.view.state, e.schema.marks[i]),
          disabled: !t.can(r),
          ...(G[r] ? { shortcut: G[r] } : {}),
          onSelect: () => t.exec(r),
        })),
      { type: `separator` },
      {
        id: `clearFormatting`,
        label: n(`clearFormatting`),
        icon: O.clearFormatting,
        disabled: !t.can(`clearFormatting`),
        shortcut: G.clearFormatting,
        onSelect: () => t.exec(`clearFormatting`),
      },
      {
        id: `pasteAsText`,
        label: n(`pasteAsText`),
        icon: O.pasteText,
        checkbox: !0,
        active: t.isPasteAsText(),
        onSelect: () => {
          (t.setPasteAsText(!t.isPasteAsText()), t.focus());
        },
      },
    ],
  }),
    t.addToggleButton(`pastetext`, {
      icon: O.pasteText,
      tooltip: n(`pasteAsText`),
      isActive: (e) => e.isPasteAsText(),
      onAction: (e) => {
        (e.setPasteAsText(!e.isPasteAsText()), e.focus());
      },
    }),
    t.addButton(`link`, {
      icon: O.link,
      tooltip: n(`link`),
      shortcut: `Mod-k`,
      onAction: (e) => je(e),
      isActive: () => !!oe(r()),
    }),
    t.addButton(`unlink`, {
      icon: O.unlink,
      tooltip: n(`unlink`),
      onAction: (e) => e.exec(Ae()),
      isEnabled: (e) => e.can(Ae()),
    }),
    t.addButton(`image`, { icon: O.image, tooltip: n(`image`), onAction: (e) => Pe(e) }));
  let x = () => Ee(r())?.node.attrs.align ?? null,
    S = (e, r, i, a) =>
      t.addToggleButton(e, {
        icon: i,
        tooltip: n(a),
        isActive: () => x() === r,
        onAction: (e) => e.exec(De({ align: x() === r ? null : r })),
      });
  (S(`imagealignleft`, `left`, O.imageLeft, `image.alignLeft`),
    S(`imagealigncenter`, `center`, O.imageCenter, `image.alignCenter`),
    S(`imagealignright`, `right`, O.imageRight, `image.alignRight`));
  let ee = [
    [`image.sizeSmall`, 0.25],
    [`image.sizeMedium`, 0.5],
    [`image.sizeLarge`, 0.75],
    [`image.sizeFull`, 1],
    [`image.sizeOriginal`, null],
  ];
  (t.addMenuButton(`imagesize`, {
    icon: O.resize,
    tooltip: n(`image.size`),
    items: (e) => ee.map(([t, r]) => ({ id: t, label: n(t), onSelect: () => He(e, r) })),
  }),
    t.addButton(`imagealt`, {
      icon: O.altText,
      tooltip: n(`image.editAlt`),
      onAction: (e) => Le(e),
    }),
    t.addButton(`imagedelete`, {
      icon: O.trash,
      tooltip: n(`image.delete`),
      onAction: (e) =>
        e.exec((e, t) => (Ee(e) ? (t?.(e.tr.deleteSelection().scrollIntoView()), !0) : !1)),
    }),
    pr(e),
    t.addButton(`searchreplace`, {
      icon: O.search,
      tooltip: n(`search.title`),
      shortcut: `Mod-f`,
      onAction: (e) => e.openSearch(),
    }),
    t.addToggleButton(`fullscreen`, {
      icon: O.fullscreen,
      tooltip: n(`fullscreen`),
      shortcut: `Mod-Shift-f`,
      isActive: (e) => Rn(e),
      onAction: (e) => zn(e),
    }),
    t.addButton(`preview`, { icon: O.preview, tooltip: n(`preview`), onAction: (e) => Bn(e) }),
    t.addButton(`code`, { icon: O.sourceCode, tooltip: n(`sourceCode`), onAction: (e) => Hn(e) }),
    t.addButton(`help`, {
      icon: O.help,
      tooltip: n(`help`),
      shortcut: `Alt-0`,
      onAction: (e) => Wn(e),
    }),
    t.addContextToolbar(`image`, {
      label: n(`image.toolbar`),
      predicate: (e) => !!Ee(e.view.state),
      items: `imagealignleft imagealigncenter imagealignright | imagesize imagealt | imagedelete`,
    }));
}
var Er = 6,
  Dr = 8;
function K(e, t, n) {
  let r = window.innerWidth,
    i = window.innerHeight,
    { width: a, height: o } = e.getBoundingClientRect(),
    s = i - t.bottom,
    c = t.top,
    l = n === `top-start` ? c >= o + Er || c > s : s < o + Er && c > s,
    u = l ? t.top - o - Er : t.bottom + Er,
    d = n === `bottom-end` ? t.right - a : n === `bottom` ? t.left + t.width / 2 - a / 2 : t.left;
  ((d = Math.max(Dr, Math.min(d, r - a - Dr))),
    (u = Math.max(Dr, Math.min(u, i - o - Dr))),
    (e.style.left = `${Math.round(d)}px`),
    (e.style.top = `${Math.round(u)}px`),
    (e.dataset.side = l ? `top` : `bottom`));
}
var q = [],
  Or = class {
    el;
    options;
    closed = !1;
    constructor(e) {
      ((this.options = e),
        (this.el = document.createElement(`div`)),
        (this.el.className = `nova-popover ${e.className ?? ``}`.trim()),
        this.el.append(e.content),
        e.host.append(this.el),
        this.reposition(),
        document.addEventListener(`keydown`, this.onKeyDown, !0),
        document.addEventListener(`pointerdown`, this.onPointerDown, !0),
        q.push(this),
        window.addEventListener(`resize`, this.reposition),
        window.addEventListener(`scroll`, this.reposition, !0));
    }
    get isOpen() {
      return !this.closed;
    }
    reposition = () => {
      if (this.closed) return;
      let { anchor: e, placement: t = `bottom-start` } = this.options,
        n = typeof e == `function` ? e() : e.getBoundingClientRect();
      K(this.el, n, t);
    };
    close(e = `api`) {
      this.closed ||
        ((this.closed = !0),
        q.splice(q.indexOf(this), 1),
        document.removeEventListener(`keydown`, this.onKeyDown, !0),
        document.removeEventListener(`pointerdown`, this.onPointerDown, !0),
        window.removeEventListener(`resize`, this.reposition),
        window.removeEventListener(`scroll`, this.reposition, !0),
        this.el.remove(),
        this.options.onClose?.(e));
    }
    focusWasInside = !1;
    onKeyDown = (e) => {
      e.key !== `Escape` ||
        e.defaultPrevented ||
        (q[q.length - 1] === this &&
          (e.target?.closest?.(`.nova-dialog`) ||
            (e.preventDefault(),
            e.stopPropagation(),
            (this.focusWasInside = this.el.contains(document.activeElement)),
            this.close(`escape`))));
    };
    onPointerDown = (e) => {
      if (this.options.dismissOnOutside === !1) return;
      let t = e.target;
      this.el.contains(t) ||
        this.options.ignore?.some((e) => e.contains(t)) ||
        this.close(`outside`);
    };
  },
  kr = `undo redo | blocks | bold italic underline strikethrough moreformats | forecolor backcolor | link image table | bullist numlist | align lineheight outdent indent | fontfamily fontsize | blockquote codeblock hr | removeformat | searchreplace preview code fullscreen help`;
function Ar(e) {
  let t = Array.isArray(e) ? e : e.split(/\s+/),
    n = [[]];
  for (let e of t) {
    let t = e.trim();
    t && (t === `|` ? n.push([]) : n[n.length - 1].push(t));
  }
  return n.filter((e) => e.length > 0);
}
function jr(e, t, n, r, { warnUnknown: i = !0 } = {}) {
  let { ui: a } = e,
    o = a.t,
    s = new AbortController(),
    { signal: c } = s;
  ((t.className = `nova-toolbar nova-toolbar-${r}`),
    t.setAttribute(`role`, `toolbar`),
    t.setAttribute(`aria-label`, o(`toolbar.label`)));
  let l = [],
    u = [];
  for (let r of Ar(n)) {
    let n = A(`div`, { className: `nova-tb-group`, role: `group` });
    for (let t of r) {
      if (!e.isAllowed(t)) continue;
      let r = a.registry.get(t);
      if (!r) {
        i && console.warn(`[nova] Unknown toolbar item "${t}"`);
        continue;
      }
      let o = Mr(e, t, r);
      (l.push(o), n.append(o.el));
    }
    n.childElementCount && (u.push(n), t.append(n));
  }
  let d = A(`div`, { className: `nova-toolbar nova-tb-overflow`, role: `group` }),
    f = A(
      `button`,
      {
        type: `button`,
        className: `nova-btn nova-tb-more`,
        'aria-label': o(`more`),
        'aria-haspopup': `true`,
        'aria-expanded': `false`,
        'data-tooltip': o(`more`),
        hidden: !0,
      },
      k(O.more),
    );
  a.tooltip.attach(f);
  let p = null,
    m = () => {
      (p?.close(), (p = null));
    },
    h = a.onDialogOpen(m);
  (f.addEventListener(`click`, (e) => {
    if (p) return m();
    f.setAttribute(`aria-expanded`, `true`);
    let t = new Or({
      host: a.overlayHost,
      anchor: f,
      placement: `bottom-end`,
      content: d,
      className: `nova-tb-overflow-popover`,
      ignore: [a.overlayHost, f],
      onClose: (e) => {
        ((p = null),
          f.setAttribute(`aria-expanded`, `false`),
          e === `escape` && t.focusWasInside && f.focus());
      },
    });
    ((p = t), e.detail === 0 && d.querySelector(`button:not(:disabled)`)?.focus());
  }),
    r === `sliding` && t.append(f));
  let g = () => {
      if (r !== `sliding`) return;
      for (let e of u) t.insertBefore(e, f);
      if (((f.hidden = !0), t.scrollWidth <= t.clientWidth + 1)) {
        m();
        return;
      }
      f.hidden = !1;
      let e = u.length;
      for (; e > 1 && t.scrollWidth > t.clientWidth + 1;) (--e, d.prepend(u[e]));
      (d.childElementCount || (f.hidden = !0), p?.reposition(), x());
    },
    _ = -1,
    v =
      typeof ResizeObserver < `u` && r === `sliding`
        ? new ResizeObserver(() => {
            t.clientWidth !== _ && ((_ = t.clientWidth), g());
          })
        : null;
  v?.observe(t);
  let y = () => [...t.querySelectorAll(`button`)].filter((e) => !e.disabled && !e.hidden),
    b = null,
    x = () => {
      let e = y();
      (b && e.includes(b)) || (b = e[0] ?? null);
      for (let e of t.querySelectorAll(`button`)) e.tabIndex = e === b ? 0 : -1;
    };
  (t.addEventListener(
    `focusin`,
    (e) => {
      let n = e.target;
      n instanceof HTMLButtonElement && t.contains(n) && ((b = n), x());
    },
    { signal: c },
  ),
    t.addEventListener(
      `keydown`,
      (t) => {
        let n = y(),
          r = n.indexOf(document.activeElement);
        if (r < 0) return;
        let i = null;
        if (t.key === `ArrowRight`) i = r + 1;
        else if (t.key === `ArrowLeft`) i = r - 1;
        else if (t.key === `Home`) i = 0;
        else if (t.key === `End`) i = n.length - 1;
        else if (t.key === `Escape`) {
          (t.preventDefault(), e.focus());
          return;
        }
        i !== null && (t.preventDefault(), n[(i + n.length) % n.length].focus());
      },
      { signal: c },
    ));
  let S = (e) => {
    e.target.closest(`button`) && e.preventDefault();
  };
  (t.addEventListener(`mousedown`, S, { signal: c }),
    d.addEventListener(`mousedown`, S),
    d.addEventListener(`keydown`, (e) => {
      if (e.key === `Escape`) return;
      let t = [...d.querySelectorAll(`button`)].filter((e) => !e.disabled),
        n = t.indexOf(document.activeElement);
      n < 0 ||
        (e.key === `ArrowRight` || e.key === `ArrowDown`
          ? (e.preventDefault(), t[(n + 1) % t.length].focus())
          : (e.key === `ArrowLeft` || e.key === `ArrowUp`) &&
            (e.preventDefault(), t[(n - 1 + t.length) % t.length].focus()));
    }));
  let ee = () => {
    for (let e of l) e.update();
    x();
  };
  return (
    ee(),
    g(),
    {
      update: ee,
      focus: () => {
        (x(), b?.focus());
      },
      destroy: () => {
        (v?.disconnect(), h(), m(), s.abort(), t.replaceChildren());
      },
    }
  );
}
function Mr(e, t, n) {
  if (n.type === `split`) return Nr(e, t, n);
  let { ui: r } = e,
    i = A(`button`, {
      type: `button`,
      className: `nova-btn nova-tb-${n.type}`,
      'aria-label': n.tooltip,
      'data-tooltip': n.tooltip,
      'data-control': t,
      ...(n.shortcut ? { 'data-shortcut': n.shortcut } : {}),
    });
  (r.tooltip.attach(i), n.icon && i.append(k(n.icon)));
  let a =
    n.type === `menu` && (n.label || n.text) ? A(`span`, { className: `nova-tb-label` }) : null;
  a
    ? (n.type === `menu` && n.minChars && (a.style.minWidth = `${n.minChars}ch`),
      i.append(a),
      i.classList.add(`nova-tb-has-label`))
    : !n.icon && n.text && i.append(n.text);
  let o = null;
  return (
    n.type === `panel` &&
      n.indicator &&
      ((o = A(`span`, { className: `nova-color-bar` })), i.append(o)),
    n.type !== `button` &&
      (i.setAttribute(`aria-haspopup`, n.type === `menu` ? `menu` : `dialog`),
      i.setAttribute(`aria-expanded`, `false`),
      i.append(k(O.chevronDown)),
      i.lastElementChild?.classList.add(`nova-chevron`)),
    i.addEventListener(`click`, (t) => {
      if (n.type === `button`) {
        n.onAction(e);
        return;
      }
      if (i.getAttribute(`aria-expanded`) === `true`) {
        r.closePopover();
        return;
      }
      let a = t.detail === 0,
        o = () => r.closePopover(),
        s = n.type === `menu` ? an(n.items(e), o, n.tooltip) : n.render(e, o);
      i.setAttribute(`aria-expanded`, `true`);
      let c = r.openPopover({
        anchor: i,
        content: s,
        ignore: [i],
        className: n.type === `menu` ? `nova-popover-menu` : `nova-popover-panel`,
        onClose: (e) => {
          (i.setAttribute(`aria-expanded`, `false`),
            e === `escape` && c.focusWasInside && i.focus());
        },
      });
      n.type === `menu` ? on(s) : a && s.querySelector(`button, input`)?.focus();
    }),
    n.type !== `button` &&
      i.addEventListener(`keydown`, (e) => {
        e.key === `ArrowDown` &&
          i.getAttribute(`aria-expanded`) !== `true` &&
          (e.preventDefault(), i.click());
      }),
    {
      el: i,
      update: () => {
        let t = e.isEditable();
        if (((i.disabled = !t || (n.isEnabled ? !n.isEnabled(e) : !1)), n.isActive)) {
          let t = n.isActive(e);
          (i.classList.toggle(`is-active`, t),
            n.type === `button` && i.setAttribute(`aria-pressed`, String(t)));
        }
        if (a && n.type === `menu`) {
          let t = n.label?.(e) ?? n.text ?? ``;
          ((a.textContent = t),
            i.setAttribute(
              `aria-label`,
              t && t !== n.tooltip ? `${t}, ${n.tooltip}` : (n.tooltip ?? t),
            ));
        }
        if (o && n.type === `panel` && n.indicator) {
          let t = n.indicator(e);
          ((o.style.background = t ?? ``), o.classList.toggle(`is-empty`, !t));
        }
      },
    }
  );
}
function Nr(e, t, n) {
  let r = Mr(e, t, {
      type: `button`,
      tooltip: n.tooltip,
      onAction: n.onAction,
      ...(n.icon ? { icon: n.icon } : {}),
      ...(n.text ? { text: n.text } : {}),
      ...(n.shortcut ? { shortcut: n.shortcut } : {}),
      ...(n.isActive ? { isActive: n.isActive } : {}),
      ...(n.isEnabled ? { isEnabled: n.isEnabled } : {}),
    }),
    i = Mr(e, `${t}-options`, {
      type: `menu`,
      tooltip: `${n.tooltip}: ${e.ui.t(`toolbar.options`)}`,
      items: n.items,
      ...(n.isEnabled ? { isEnabled: n.isEnabled } : {}),
    });
  return (
    i.el.classList.add(`nova-tb-split-more`),
    {
      el: A(`span`, { className: `nova-tb-split` }, r.el, i.el),
      update: () => {
        (r.update(), i.update());
      },
    }
  );
}
var J = (e) => (t) => t.exec(e),
  Pr = [
    {
      name: `paragraph`,
      label: `paragraph`,
      icon: O.paragraph,
      keywords: [`text`, `p`, `paragraph`],
      run: J(`paragraph`),
    },
    {
      name: `h1`,
      label: `h1`,
      icon: O.h1,
      keywords: [`h1`, `heading`, `title`],
      shortcut: `Mod-Alt-1`,
      run: J(`h1`),
    },
    {
      name: `h2`,
      label: `h2`,
      icon: O.h2,
      keywords: [`h2`, `heading`, `subtitle`],
      shortcut: `Mod-Alt-2`,
      run: J(`h2`),
    },
    {
      name: `h3`,
      label: `h3`,
      icon: O.h3,
      keywords: [`h3`, `heading`],
      shortcut: `Mod-Alt-3`,
      run: J(`h3`),
    },
    {
      name: `bullist`,
      label: `bulletList`,
      icon: O.bulletList,
      keywords: [`ul`, `list`, `bullet`],
      shortcut: `Mod-Shift-8`,
      run: J(`bulletList`),
    },
    {
      name: `numlist`,
      label: `orderedList`,
      icon: O.orderedList,
      keywords: [`ol`, `list`, `numbered`],
      shortcut: `Mod-Shift-7`,
      run: J(`orderedList`),
    },
    {
      name: `blockquote`,
      label: `blockquote`,
      icon: O.blockquote,
      keywords: [`quote`, `blockquote`, `citation`],
      run: J(`blockquote`),
    },
    {
      name: `codeblock`,
      label: `codeBlock`,
      icon: O.codeBlock,
      keywords: [`code`, `pre`, `snippet`],
      run: J(`codeBlock`),
    },
    {
      name: `hr`,
      label: `horizontalRule`,
      icon: O.horizontalRule,
      keywords: [`hr`, `divider`, `line`, `separator`],
      run: J(`horizontalRule`),
    },
    {
      name: `table`,
      label: `table`,
      icon: O.table,
      keywords: [`table`, `grid`],
      run: (e) => e.exec(M(3, 3)),
    },
    {
      name: `image`,
      label: `image`,
      icon: O.image,
      keywords: [`image`, `picture`, `photo`, `img`],
      run: (e) => Pe(e),
    },
    {
      name: `link`,
      label: `link`,
      icon: O.link,
      keywords: [`link`, `url`, `href`],
      shortcut: `Mod-k`,
      run: (e) => je(e),
    },
  ];
function Fr(e, t, n) {
  let r = t.toLowerCase();
  if (!r) return e;
  let i = [];
  return (
    e.forEach((e, t) => {
      let a = n(e.label).toLowerCase(),
        o = [a, ...a.split(/\s+/), ...e.keywords],
        s = -1;
      (a.startsWith(r)
        ? (s = 3)
        : o.some((e) => e.startsWith(r))
          ? (s = 2)
          : o.some((e) => e.includes(r)) && (s = 1),
        s > 0 && i.push([s, t, e]));
    }),
    i.sort((e, t) => t[0] - e[0] || e[1] - t[1]).map(([, , e]) => e)
  );
}
function Ir(e, t = []) {
  let { t: n } = e.ui,
    r = [...Pr, ...t].filter((t) => e.isAllowed(t.name));
  e.ui.registry.addAutocompleter(`slashcommands`, {
    trigger: `/`,
    label: n(`slash.label`),
    emptyText: n(`slash.empty`),
    fetch: (e) =>
      Fr(r, e, n).map((e) => ({
        value: e.name,
        label: n(e.label),
        icon: e.icon,
        ...(e.shortcut ? { shortcut: e.shortcut } : {}),
      })),
    onSelect: (e, t, n) => {
      let i = r.find((t) => t.name === e.value);
      i && (n.view.dispatch(n.view.state.tr.delete(t.from, t.to)), i.run(n));
    },
  });
}
var Lr = {
    paragraph: () => `p`,
    heading: (e) => `h${e.attrs.level}`,
    blockquote: () => `blockquote`,
    code_block: () => `pre`,
    bullet_list: () => `ul`,
    ordered_list: () => `ol`,
    list_item: () => `li`,
    table: () => `table`,
    table_row: () => `tr`,
    table_cell: () => `td`,
    table_header: () => `th`,
  },
  Rr = {
    bold: `strong`,
    italic: `em`,
    underline: `u`,
    strike: `s`,
    code: `code`,
    link: `a`,
    subscript: `sub`,
    superscript: `sup`,
  };
function zr(e) {
  let t = e.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return t ? t.length : 0;
}
function Br(e, t) {
  t.className = `nova-statusbar`;
  let n = A(`div`, { className: `nova-path`, 'aria-hidden': `true` }),
    r = A(`div`, { className: `nova-wordcount`, 'aria-live': `off` });
  t.append(n, r);
  let i = e.options.resize,
    a = i ? Wr(e, t, i === `both`) : null,
    o = null,
    s = () => {
      let t = e.view.state.doc;
      r.textContent = e.ui.t(`status.words`, {
        count: zr(t.textBetween(0, t.content.size, ` `, ` `)),
      });
    },
    c = (t) => {
      let { $from: r } = e.view.state.selection,
        i = [];
      for (let e = 1; e <= r.depth; e++) {
        let t = r.node(e),
          n = Lr[t.type.name]?.(t);
        n && i.push(n);
      }
      e.view.state.selection.node?.type.name === `image` && i.push(`img`);
      for (let e of r.marks()) {
        let t = Rr[e.type.name];
        t && i.push(t);
      }
      ((n.textContent = i.join(` › `)), t && (o && clearTimeout(o), (o = setTimeout(s, 250))));
    };
  return (
    s(),
    c(!1),
    {
      update: c,
      destroy: () => {
        (o && clearTimeout(o), a?.(), t.replaceChildren());
      },
    }
  );
}
var Vr = 100,
  Hr = 200,
  Ur = 20;
function Wr(e, t, n) {
  let r = e.root,
    i = A(`div`, {
      className: `nova-resize-handle`,
      role: `separator`,
      tabIndex: 0,
      'aria-orientation': `horizontal`,
      'aria-label': e.ui.t(`status.resize`),
    });
  (i.append(k(n ? O.resizeHandleBoth : O.resizeHandle)),
    (r.dataset.resize = n ? `both` : `vertical`),
    t.append(i));
  let a = (e, t) => {
      if (
        ((r.style.boxSizing = `border-box`),
        (r.style.height = `${Math.max(Vr, Math.round(e))}px`),
        n && t !== void 0)
      ) {
        let e = r.parentElement?.clientWidth || 1 / 0;
        r.style.width = `${Math.min(e, Math.max(Hr, Math.round(t)))}px`;
      }
      i.setAttribute(`aria-valuenow`, String(r.offsetHeight));
    },
    o = null,
    s = (t) => {
      e.isDisabled() ||
        (t.preventDefault(),
        i.setPointerCapture(t.pointerId),
        (o = { x: t.clientX, y: t.clientY, height: r.offsetHeight, width: r.offsetWidth }));
    },
    c = (e) => {
      o && a(o.height + e.clientY - o.y, o.width + e.clientX - o.x);
    },
    l = (e) => {
      o && ((o = null), i.hasPointerCapture(e.pointerId) && i.releasePointerCapture(e.pointerId));
    };
  return (
    i.addEventListener(`pointerdown`, s),
    i.addEventListener(`pointermove`, c),
    i.addEventListener(`pointerup`, l),
    i.addEventListener(`pointercancel`, l),
    i.addEventListener(`keydown`, (e) => {
      let t = e.key === `ArrowDown` ? Ur : e.key === `ArrowUp` ? -Ur : 0,
        i = n ? (e.key === `ArrowRight` ? Ur : e.key === `ArrowLeft` ? -Ur : 0) : 0;
      (i || t) && (e.preventDefault(), a(r.offsetHeight + t, r.offsetWidth + i));
    }),
    () => {
      (i.remove(), delete r.dataset.resize);
    }
  );
}
var Gr =
    /^@(font-face|(-webkit-)?keyframes|property|counter-style|page|font-feature-values|font-palette-values)\b/i,
  Kr = /^@(media|supports|container|layer|document|scope)\b/i;
function qr(e) {
  let t = [],
    n = 0,
    r = 0,
    i = 0,
    a = ``;
  for (; n < e.length;) {
    let o = e[n];
    if (o === `/` && e[n + 1] === `*`) {
      let t = e.indexOf(`*/`, n + 2),
        r = t === -1 ? e.length : t + 2;
      if (i === 0) {
        e = e.slice(0, n) + e.slice(r);
        continue;
      }
      n = r;
    } else if (o === `"` || o === `'`) {
      for (n++; n < e.length && e[n] !== o;) n += e[n] === `\\` ? 2 : 1;
      n++;
    } else {
      if (o === `{`) (i === 0 && ((a = e.slice(r, n).trim()), (r = n + 1)), i++);
      else if (o === `}`)
        (i--,
          i === 0 && (t.push({ prelude: a, body: e.slice(r, n) }), (r = n + 1)),
          i < 0 && (i = 0));
      else if (o === `;` && i === 0) {
        let i = e.slice(r, n).trim();
        (i && t.push({ prelude: i, body: null }), (r = n + 1));
      }
      n++;
    }
  }
  return t;
}
function Jr(e) {
  let t = [],
    n = 0,
    r = ``,
    i = 0;
  for (let a = 0; a < e.length; a++) {
    let o = e[a];
    r
      ? o === `\\`
        ? a++
        : o === r && (r = ``)
      : o === `"` || o === `'`
        ? (r = o)
        : o === `(` || o === `[`
          ? n++
          : o === `)` || o === `]`
            ? n--
            : o === `,` && n === 0 && (t.push(e.slice(i, a)), (i = a + 1));
  }
  return (t.push(e.slice(i)), t.map((e) => e.trim()).filter(Boolean));
}
function Yr(e, t) {
  let n = e,
    r = !1;
  for (;;) {
    let e = n.match(/^(html|body|:root)(?![\w-])\s*/i);
    if (!e) break;
    ((r = !0), (n = n.slice(e[0].length)));
  }
  if (!r) return `${t} ${e}`;
  if (/^[.#[:]/.test(n)) {
    let e = n.search(/[\s>+~]/);
    return e === -1 ? `${t}${n}` : `${t}${n.slice(0, e)} ${n.slice(e).trim()}`;
  }
  return n ? `${t} ${n}` : t;
}
function Xr(e, t) {
  let n = [];
  for (let { prelude: r, body: i } of qr(e))
    if (i === null) /^@layer\b/i.test(r) && n.push(`${r};`);
    else if (Gr.test(r)) n.push(`${r}{${i}}`);
    else if (Kr.test(r)) n.push(`${r}{${Xr(i, t)}}`);
    else if (r.startsWith(`@`)) continue;
    else {
      let e = Jr(r).map((e) => Yr(e, t));
      e.length && n.push(`${e.join(`, `)}{${i}}`);
    }
  return n.join(`
`);
}
function Zr(e, t) {
  return e.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (e, n, r) => {
    if (/^(data:|https?:|\/\/|#)/i.test(r)) return e;
    try {
      return `url(${n}${new URL(r, t).href}${n})`;
    } catch {
      return e;
    }
  });
}
var Qr = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?([^;]*);/gi;
async function $r(e, t = 0) {
  let n = new URL(e, document.baseURI).href,
    r = await fetch(n);
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  let i = Zr(await r.text(), n);
  if (t >= 3) return i.replace(Qr, ``);
  let a = [...i.matchAll(Qr)];
  for (let e of a) {
    let r = e[3].trim(),
      a = ``;
    try {
      a = await $r(new URL(e[2], n).href, t + 1);
    } catch (t) {
      console.warn(`[nova] contentCss: could not load ${e[2]}`, t);
    }
    i = i.replace(e[0], r ? `@media ${r}{${a}}` : a);
  }
  return i;
}
function ei(e, t) {
  let n = e.getRootNode();
  if (
    `adoptedStyleSheets` in n &&
    typeof CSSStyleSheet < `u` &&
    `replaceSync` in CSSStyleSheet.prototype
  )
    try {
      let e = new CSSStyleSheet();
      return (
        e.replaceSync(t),
        (n.adoptedStyleSheets = [...n.adoptedStyleSheets, e]),
        () => {
          n.adoptedStyleSheets = n.adoptedStyleSheets.filter((t) => t !== e);
        }
      );
    } catch {}
  let r = document.createElement(`style`);
  return (
    r.setAttribute(`data-nova-content-css`, ``),
    (r.textContent = t),
    e.prepend(r),
    () => r.remove()
  );
}
function ti(e = () => !0, t = pe) {
  let { nodes: n } = t,
    r = [dt, ut];
  (e(`blockquote`) && r.push(ft(/^\s*>\s$/, n.blockquote)),
    e(`numlist`) &&
      r.push(
        ft(
          /^(\d+)\.\s$/,
          n.ordered_list,
          (e) => ({ start: Number(e[1]) }),
          (e, t) => t.childCount + t.attrs.start === Number(e[1]),
        ),
      ),
    e(`bullist`) && r.push(ft(/^\s*([-+*])\s$/, n.bullet_list)),
    e(`codeblock`) && r.push(pt(/^```$/, n.code_block)));
  for (let t = 1; t <= 6; t++)
    e(`h${t}`) && r.push(pt(RegExp(`^(#{${t}})\\s$`), n.heading, { level: t }));
  return ct({ rules: r });
}
var ni = typeof navigator < `u` && /Mac|iP(hone|[oa]d)/.test(navigator.platform),
  ri = _(
    le,
    (e, t) => (t?.(e.tr.replaceSelectionWith(S(e).hard_break.create()).scrollIntoView()), !0),
  ),
  ii = (e, t) => (n, r, i) => e(t)(n, r, i);
function ai(e = (e) => C[e]) {
  let t = {
    'Mod-z': ii(e, `undo`),
    'Shift-Mod-z': ii(e, `redo`),
    'Mod-b': C.bold,
    'Mod-i': C.italic,
    'Mod-u': C.underline,
    'Mod-Shift-x': C.strike,
    'Mod-e': C.code,
    'Mod-,': C.subscript,
    'Mod-.': C.superscript,
    'Mod-Alt-0': C.paragraph,
    'Mod-Alt-1': C.h1,
    'Mod-Alt-2': C.h2,
    'Mod-Alt-3': C.h3,
    'Mod-Alt-4': C.h4,
    'Mod-Alt-5': C.h5,
    'Mod-Alt-6': C.h6,
    'Mod-Shift-7': C.orderedList,
    'Mod-Shift-8': C.bulletList,
    'Mod-Shift-l': C.alignLeft,
    'Mod-Shift-e': C.alignCenter,
    'Mod-Shift-r': C.alignRight,
    'Mod-Shift-j': C.alignJustify,
    'Mod-\\': C.clearFormatting,
    'Shift-Enter': ri,
    Enter: (e, t) => ae(S(e).list_item)(e, t),
    Tab: C.indent,
    'Shift-Tab': C.outdent,
  };
  return (ni || (t[`Mod-y`] = ii(e, `redo`)), [D(t), D(ee)]);
}
function oi(e, t) {
  let { t: n } = e.ui,
    r = ye(`nova-find`),
    i = ye(`nova-replace`),
    a = A(`input`, {
      id: r,
      type: `search`,
      className: `nova-input`,
      placeholder: n(`search.find`),
      'aria-label': n(`search.find`),
      autocomplete: `off`,
      spellcheck: `false`,
    }),
    o = A(`input`, {
      id: i,
      type: `text`,
      className: `nova-input`,
      placeholder: n(`search.replace`),
      'aria-label': n(`search.replace`),
      autocomplete: `off`,
      spellcheck: `false`,
    }),
    s = A(`span`, { className: `nova-search-count`, 'aria-live': `polite` }),
    c = (t, n) => {
      let r = A(
        `button`,
        {
          type: `button`,
          className: `nova-btn nova-search-toggle`,
          'aria-pressed': `false`,
          'aria-label': t,
          'data-tooltip': t,
        },
        n,
      );
      return (
        e.ui.tooltip.attach(r),
        r.addEventListener(`click`, () => {
          (r.setAttribute(`aria-pressed`, String(r.getAttribute(`aria-pressed`) !== `true`)),
            y(),
            a.focus());
        }),
        r
      );
    },
    l = c(n(`search.matchCase`), `Aa`),
    u = c(n(`search.wholeWord`), `ab|`),
    d = (t, n, r) => {
      let i = A(
        `button`,
        { type: `button`, className: `nova-btn`, 'aria-label': n, 'data-tooltip': n },
        k(t),
      );
      return (e.ui.tooltip.attach(i), i.addEventListener(`click`, r), i);
    },
    f = d(O.chevronUp, n(`search.prev`), () => {
      (e.exec(Fn(-1)), a.focus());
    }),
    p = d(O.chevronDown, n(`search.next`), () => {
      (e.exec(Fn(1)), a.focus());
    }),
    m = d(O.close, n(`dialog.close`), () => S.close()),
    h = A(`button`, { type: `button`, className: `nova-button` }, n(`search.replaceOne`)),
    g = A(`button`, { type: `button`, className: `nova-button` }, n(`search.replaceAll`));
  (h.addEventListener(`click`, () => {
    (b(), e.exec(In(o.value)), e.exec(Fn(1)), o.focus());
  }),
    g.addEventListener(`click`, () => {
      (b(), e.exec(Ln(o.value)), o.focus());
    }));
  let _ = A(
    `div`,
    { className: `nova-search`, role: `search`, 'aria-label': n(`search.title`), hidden: !0 },
    A(`div`, { className: `nova-search-row` }, a, s, l, u, f, p, m),
    A(`div`, { className: `nova-search-row` }, o, h, g),
  );
  t.parentElement.insertBefore(_, t);
  let v = null,
    y = () => {
      (v && clearTimeout(v),
        (v = null),
        Mn({
          query: a.value,
          caseSensitive: l.getAttribute(`aria-pressed`) === `true`,
          wholeWord: u.getAttribute(`aria-pressed`) === `true`,
        })(e.view.state, e.view.dispatch));
    },
    b = () => {
      (v || H(e.view.state).query !== a.value) && y();
    };
  (a.addEventListener(`input`, () => {
    (v && clearTimeout(v), (v = setTimeout(y, 120)));
  }),
    a.addEventListener(`keydown`, (t) => {
      t.key === `Enter` && (t.preventDefault(), b(), e.exec(Fn(t.shiftKey ? -1 : 1)), a.focus());
    }),
    o.addEventListener(`keydown`, (e) => {
      e.key === `Enter` && (e.preventDefault(), h.click(), o.focus());
    }),
    _.addEventListener(`keydown`, (e) => {
      e.key === `Escape` && (e.preventDefault(), e.stopPropagation(), S.close());
    }),
    _.addEventListener(`mousedown`, (e) => {
      e.target.closest(`button`) && e.preventDefault();
    }));
  let x = () => {
      if (_.hidden) return;
      let { matches: t, current: r, query: i } = H(e.view.state),
        a = t.length;
      (i
        ? a
          ? (s.textContent = n(`search.count`, { current: r + 1, total: a >= Tn ? `${Tn}+` : a }))
          : (s.textContent = n(`search.none`))
        : (s.textContent = ``),
        _.classList.toggle(`is-empty`, !!i && !a));
      for (let e of [f, p, h, g]) e.disabled = !a;
      ((h.disabled = !a || !e.isEditable()), (g.disabled = !a || !e.isEditable()));
    },
    S = {
      open() {
        let t = _.hidden;
        _.hidden = !1;
        let { from: n, to: r, empty: i } = e.view.state.selection,
          o = i ? `` : e.view.state.doc.textBetween(n, r, ` `);
        (o &&
          !o.includes(`
`) &&
          o.length <= 100 &&
          (a.value = o),
          (t || o) && y(),
          a.focus(),
          a.select(),
          x());
      },
      close() {
        _.hidden ||
          ((_.hidden = !0), v && clearTimeout(v), Nn(e.view.state, e.view.dispatch), e.focus());
      },
      isOpen: () => !_.hidden,
      update: x,
      destroy() {
        (v && clearTimeout(v), _.remove());
      },
    };
  return S;
}
function si(e) {
  return new c({
    key: new a(`nova-link-bubble`),
    view(t) {
      let { t: n } = e.ui,
        r = A(`a`, { className: `nova-bubble-link`, target: `_blank`, rel: `noopener noreferrer` }),
        i = (t, n, r) => {
          let i = A(
            `button`,
            { type: `button`, className: `nova-btn`, 'aria-label': n, 'data-tooltip': n },
            k(t),
          );
          return (i.addEventListener(`click`, r), e.ui.tooltip.attach(i), i);
        },
        a = A(
          `div`,
          { className: `nova-bubble`, role: `toolbar`, 'aria-label': n(`link`), hidden: !0 },
          k(O.externalLink),
          r,
          A(`span`, { className: `nova-bubble-sep` }),
          i(O.edit, n(`link.edit`), () => je(e)),
          i(O.copy, n(`link.copy`), () => {
            navigator.clipboard
              ?.writeText(r.href)
              .then(() => e.ui.notify({ text: n(`link.copied`), type: `success`, timeout: 2e3 }));
          }),
          i(O.unlink, n(`unlink`), () => e.exec(Ae())),
        );
      (a.addEventListener(`mousedown`, (e) => {
        e.target.closest(`button`) && e.preventDefault();
      }),
        e.ui.overlayHost.append(a));
      let o = () => {
          a.hidden = !0;
        },
        s = () => {
          let n = t.state,
            i = oe(n),
            s = t.hasFocus() || a.contains(document.activeElement);
          if (!i || !s || !e.isEditable() || e.ui.activeDialog || !n.selection.empty) {
            o();
            return;
          }
          let c = ce(n, x(n).link, n.selection.from);
          if (!c) return o();
          ((r.textContent = i.href),
            (r.title = i.href),
            ne(i.href) ? r.setAttribute(`href`, i.href) : r.removeAttribute(`href`),
            (a.hidden = !1));
          let l = t.coordsAtPos(c.from),
            u = t.coordsAtPos(c.to),
            d = new DOMRect(l.left, l.top, Math.max(1, u.right - l.left), u.bottom - l.top);
          K(a, d, `bottom-start`);
        },
        c = (e) => {
          a.contains(e.relatedTarget) || o();
        };
      return (
        t.dom.addEventListener(`blur`, c),
        a.addEventListener(`focusout`, (e) => {
          !a.contains(e.relatedTarget) && !t.hasFocus() && o();
        }),
        {
          update: s,
          destroy() {
            (t.dom.removeEventListener(`blur`, c), a.remove());
          },
        }
      );
    },
  });
}
function ci(e) {
  return new c({
    key: new a(`nova-context-toolbar`),
    view(t) {
      let n = A(`div`, {
        className: `nova-bubble nova-context-toolbar`,
        role: `toolbar`,
        hidden: !0,
      });
      e.ui.overlayHost.append(n);
      let r = new Map(),
        i = null,
        a = (t, n) => {
          let i = r.get(t);
          if (i) return i;
          let a = A(`div`, { className: `nova-context-items` }),
            o = [];
          return (
            Ar(n.items).forEach((t, n) => {
              n > 0 && a.append(A(`span`, { className: `nova-bubble-sep`, role: `separator` }));
              for (let n of t) {
                if (!e.isAllowed(n)) continue;
                let t = e.ui.registry.get(n);
                if (!t) continue;
                let r = Mr(e, n, t);
                (o.push(r), a.append(r.el));
              }
            }),
            (i = { el: a, controls: o }),
            r.set(t, i),
            i
          );
        },
        o = () => {
          ((n.hidden = !0), (i = null));
        },
        s = (e) => {
          let { selection: n } = t.state;
          if ((e.position ?? `node`) === `node` && n instanceof p)
            return t.nodeDOM(n.from)?.getBoundingClientRect() ?? null;
          let r = t.coordsAtPos(n.from),
            i = t.coordsAtPos(n.to);
          return new DOMRect(r.left, r.top, Math.max(1, i.right - r.left), i.bottom - r.top);
        },
        c = !1,
        l = (e) => {
          e.pointerType === `mouse` && e.button === 0 && (c = !0);
        },
        u = () => {
          c && ((c = !1), setTimeout(() => f(t), 0));
        };
      (t.dom.addEventListener(`pointerdown`, l), document.addEventListener(`pointerup`, u));
      let d = typeof matchMedia == `function` && matchMedia(`(pointer: coarse)`).matches,
        f = (t) => {
          if (
            !(t.hasFocus() || n.contains(document.activeElement)) ||
            !e.isEditable() ||
            e.ui.activeDialog ||
            c
          )
            return o();
          let r = e.ui.registry.getContextToolbars().find(([, t]) => t.predicate(e));
          if (!r) return o();
          let [l, u] = r,
            f = a(l, u);
          i !== l && (n.replaceChildren(f.el), n.setAttribute(`aria-label`, u.label), (i = l));
          for (let e of f.controls) e.update();
          let p = u.anchor ? u.anchor(e) : s(u);
          if (!p) return o();
          n.hidden = !1;
          let m = u.placement ?? (u.position === `selection` ? `bottom-start` : `top-start`);
          (d && u.position === `selection` && (m = `bottom-start`), K(n, p, m));
        };
      (n.addEventListener(`mousedown`, (e) => {
        e.target.closest(`button`) && e.preventDefault();
      }),
        n.addEventListener(`keydown`, (t) => {
          let r = [...n.querySelectorAll(`button:not(:disabled)`)],
            i = r.indexOf(document.activeElement);
          t.key === `Escape`
            ? (t.preventDefault(), e.focus())
            : i >= 0 &&
              (t.key === `ArrowRight` || t.key === `ArrowLeft`) &&
              (t.preventDefault(),
              r[(i + (t.key === `ArrowRight` ? 1 : -1) + r.length) % r.length].focus());
        }));
      let m = (t) => {
        let r = t.relatedTarget;
        !n.contains(r) && !e.ui.overlayHost.contains(r) && o();
      };
      (t.dom.addEventListener(`blur`, m),
        n.addEventListener(`focusout`, (r) => {
          let i = r.relatedTarget;
          n.contains(i) || t.hasFocus() || e.ui.overlayHost.contains(i) || o();
        }));
      let h = () => {
        n.hidden || f(t);
      };
      return (
        window.addEventListener(`scroll`, h, !0),
        window.addEventListener(`resize`, h),
        {
          update: f,
          destroy() {
            (t.dom.removeEventListener(`blur`, m),
              t.dom.removeEventListener(`pointerdown`, l),
              document.removeEventListener(`pointerup`, u),
              window.removeEventListener(`scroll`, h, !0),
              window.removeEventListener(`resize`, h),
              n.remove());
          },
        }
      );
    },
  });
}
function li(e) {
  let t = e.ui.overlayHost.querySelector(
    `.nova-context-toolbar:not([hidden]) button:not(:disabled)`,
  );
  return (t?.focus(), !!t);
}
var ui = 24,
  di = class {
    constructor(e, t, n, r) {
      ((this.view = t),
        (this.getPos = n),
        (this.editor = r),
        (this.node = e),
        (this.dom = document.createElement(`span`)),
        (this.dom.className = `nova-image`),
        (this.img = document.createElement(`img`)),
        (this.img.draggable = !1),
        this.dom.append(this.img));
      for (let e of [`nw`, `ne`, `sw`, `se`]) {
        let t = document.createElement(`span`);
        ((t.className = `nova-image-handle nova-image-handle-${e}`),
          (t.dataset.corner = e),
          t.addEventListener(`pointerdown`, (t) => this.startResize(t, e)),
          this.dom.append(t));
      }
      this.render();
    }
    view;
    getPos;
    editor;
    dom;
    img;
    node;
    resizing = !1;
    render() {
      let { src: e, alt: t, title: n, width: r, height: i, align: a } = this.node.attrs,
        o = b(e) ? e : ``;
      (this.img.getAttribute(`src`) !== o && this.img.setAttribute(`src`, o),
        this.setAttr(`alt`, t),
        this.setAttr(`title`, n),
        this.setAttr(`class`, me(this.node.attrs.class).class ?? null));
      let s = E(r),
        c = E(i);
      ((this.img.style.width = s ? `${s}px` : ``),
        (this.img.style.aspectRatio = s && c ? `${s} / ${c}` : ``),
        (this.dom.dataset.align = a ?? ``));
    }
    setAttr(e, t) {
      t ? this.img.setAttribute(e, t) : this.img.removeAttribute(e);
    }
    update(e) {
      return e.type === this.node.type && ((this.node = e), this.resizing || this.render(), !0);
    }
    selectNode() {
      this.dom.classList.add(`is-selected`);
    }
    deselectNode() {
      this.dom.classList.remove(`is-selected`);
    }
    stopEvent(e) {
      return e.target.classList?.contains(`nova-image-handle`) ?? !1;
    }
    ignoreMutation() {
      return !0;
    }
    startResize(e, t) {
      if (!this.editor.isEditable()) return;
      (e.preventDefault(), e.stopPropagation());
      let n = e.currentTarget;
      n.setPointerCapture(e.pointerId);
      let r = this.img.getBoundingClientRect(),
        i = e.clientX,
        a = r.width,
        o =
          r.width > 0 ? r.height / r.width : this.img.naturalHeight / (this.img.naturalWidth || 1),
        s = Math.max(ui, this.view.dom.clientWidth - 40),
        c = t === `ne` || t === `se` ? 1 : -1,
        l = a;
      ((this.resizing = !0), this.dom.classList.add(`is-resizing`));
      let u = (e) => {
          ((l = Math.round(Math.min(s, Math.max(ui, a + c * (e.clientX - i))))),
            (this.img.style.width = `${l}px`),
            (this.dom.dataset.size = `${l} \xD7 ${Math.round(l * o)}`));
        },
        d = () => {
          (n.removeEventListener(`pointermove`, u),
            n.removeEventListener(`pointerup`, d),
            n.removeEventListener(`pointercancel`, d),
            (this.resizing = !1),
            this.dom.classList.remove(`is-resizing`),
            delete this.dom.dataset.size);
          let e = this.getPos();
          if (e === void 0 || Math.abs(l - a) < 1) return this.render();
          let t = this.view.state.tr.setNodeMarkup(e, void 0, {
            ...this.node.attrs,
            width: l,
            height: Math.round(l * o),
          });
          (t.setSelection(p.create(t.doc, e)), this.view.dispatch(t));
        };
      (n.addEventListener(`pointermove`, u),
        n.addEventListener(`pointerup`, d),
        n.addEventListener(`pointercancel`, d));
    }
  },
  fi = 30;
function pi(e) {
  return e.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
}
function mi(e, t) {
  let { selection: n } = e.state;
  if (!n.empty) return null;
  let r = n.$from;
  if (!r.parent.isTextblock || r.parent.type.spec.code) return null;
  let i = r.parent.textBetween(Math.max(0, r.parentOffset - fi - 1), r.parentOffset, `\0`, `\0`);
  for (let [e, n] of t.ui.registry.getAutocompleters()) {
    let t = RegExp(`(?:^|\\s)${pi(n.trigger)}([\\p{L}\\p{N}_-]*)$`, `u`),
      a = i.match(t);
    if (!a) continue;
    let o = a[1] ?? ``;
    if (o.length < (n.minChars ?? 0)) continue;
    let s = r.parentOffset - o.length - n.trigger.length,
      c = s > 0 ? r.parent.textBetween(s - 1, s, `\0`, `\0`) : ``;
    if (!c || /\s/.test(c))
      return { name: e, spec: n, from: r.pos - o.length - n.trigger.length, to: r.pos, query: o };
  }
  return null;
}
function hi(e) {
  let t,
    n = [],
    r = 0,
    i = null,
    o = null,
    s = 0,
    l = ye(`nova-ac`),
    u = () => !t.hidden,
    d = (e) => {
      ((t.hidden = !0),
        (i = null),
        (n = []),
        e.dom.removeAttribute(`aria-activedescendant`),
        e.dom.removeAttribute(`aria-controls`),
        e.dom.removeAttribute(`aria-expanded`));
    },
    f = (t, r) => {
      let a = n[r];
      if (!a || !i) return;
      let { spec: o, from: s, to: c } = i;
      (d(t), o.onSelect(a, { from: s, to: c }, e));
    },
    p = (e) => {
      if (!i) return;
      let { spec: a } = i;
      if ((t.replaceChildren(), t.setAttribute(`aria-label`, a.label), !n.length)) {
        if (!a.emptyText) return d(e);
        t.append(A(`div`, { className: `nova-ac-empty` }, a.emptyText));
      }
      (n.forEach((n, i) => {
        let a = A(
          `div`,
          {
            id: `${l}-${i}`,
            className: `nova-menu-item nova-ac-item`,
            role: `option`,
            'aria-selected': String(i === r),
          },
          n.icon ? k(n.icon) : null,
          A(`span`, { className: `nova-menu-label` }, n.label),
          n.shortcut
            ? A(`kbd`, { className: `nova-menu-shortcut` }, be(n.shortcut))
            : n.detail
              ? A(`span`, { className: `nova-menu-shortcut` }, n.detail)
              : null,
        );
        (a.addEventListener(`mousedown`, (t) => {
          (t.preventDefault(), f(e, i));
        }),
          a.addEventListener(`mousemove`, () => {
            r !== i && m(e, i);
          }),
          t.append(a));
      }),
        (t.hidden = !1),
        e.dom.setAttribute(`aria-controls`, l),
        m(e, Math.min(r, Math.max(0, n.length - 1))));
      let o = e.coordsAtPos(i.from);
      K(t, new DOMRect(o.left, o.top, 1, o.bottom - o.top), `bottom-start`);
    },
    m = (e, n) => {
      ((r = n),
        t
          .querySelectorAll(`[role="option"]`)
          .forEach((e, t) => e.setAttribute(`aria-selected`, String(t === n))));
      let i = t.querySelector(`#${l}-${n}`);
      i &&
        (e.dom.setAttribute(`aria-activedescendant`, i.id),
        i.scrollIntoView?.({ block: `nearest` }));
    },
    h = (t) => {
      let a = e.isEditable() && t.hasFocus() ? mi(t, e) : null;
      if (!a || a.from === o) {
        (a || (o = null), (u() || i) && d(t));
        return;
      }
      let c = !i || i.query !== a.query || i.from !== a.from;
      if (((i = a), !c && u())) return p(t);
      let l = ++s;
      Promise.resolve(a.spec.fetch(a.query, e)).then((e) => {
        l === s && i && ((n = e.slice(0, a.spec.maxResults ?? 10)), (r = 0), p(t));
      });
    };
  return new c({
    key: new a(`nova-autocompleter`),
    view(n) {
      ((t = A(`div`, { className: `nova-popover nova-ac`, id: l, role: `listbox`, hidden: !0 })),
        e.ui.overlayHost.append(t),
        n.dom.setAttribute(`aria-autocomplete`, `list`));
      let r = () => d(n);
      return (
        n.dom.addEventListener(`blur`, r),
        {
          update: (e) => h(e),
          destroy() {
            (n.dom.removeEventListener(`blur`, r), t.remove());
          },
        }
      );
    },
    props: {
      handleKeyDown(e, t) {
        if (!u() || !i) return !1;
        let a = n.length;
        switch (t.key) {
          case `ArrowDown`:
            return (a && m(e, (r + 1) % a), !0);
          case `ArrowUp`:
            return (a && m(e, (r - 1 + a) % a), !0);
          case `Enter`:
          case `Tab`:
            return a ? (f(e, r), !0) : !1;
          case `Escape`:
            return ((o = i.from), d(e), !0);
          default:
            return !1;
        }
      },
    },
  });
}
var gi = class {
    region;
    closeLabel;
    constructor(e, t) {
      ((this.closeLabel = t),
        (this.region = A(`div`, { className: `nova-notifications`, 'aria-live': `polite` })),
        e.append(this.region));
    }
    open(e) {
      let t = e.type ?? `info`,
        n = e.timeout ?? (t === `error` ? 0 : 4e3),
        r = A(`span`, { className: `nova-notification-text` }, e.text),
        i = A(
          `button`,
          { type: `button`, className: `nova-btn`, 'aria-label': this.closeLabel },
          k(O.close),
        ),
        a = A(
          `div`,
          {
            className: `nova-notification nova-notification-${t}`,
            role: t === `error` ? `alert` : `status`,
          },
          r,
          i,
        );
      this.region.append(a);
      let o = null,
        s = () => {
          (o && clearTimeout(o), a.remove());
        };
      return (
        i.addEventListener(`click`, s),
        n > 0 && (o = setTimeout(s, n)),
        { close: s, setText: (e) => (r.textContent = e) }
      );
    }
    destroy() {
      this.region.remove();
    }
  },
  _i = class {
    controls = new Map();
    addButton(e, t) {
      this.controls.set(e.toLowerCase(), { type: `button`, ...t });
    }
    addToggleButton(e, t) {
      this.addButton(e, t);
    }
    addMenuButton(e, t) {
      this.controls.set(e.toLowerCase(), { type: `menu`, ...t });
    }
    addPanelButton(e, t) {
      this.controls.set(e.toLowerCase(), { type: `panel`, ...t });
    }
    addSplitButton(e, t) {
      this.controls.set(e.toLowerCase(), { type: `split`, ...t });
    }
    menuItems = new Map();
    addMenuItem(e, t) {
      this.menuItems.set(e.toLowerCase(), t);
    }
    addToggleMenuItem(e, t) {
      this.addMenuItem(e, t);
    }
    getMenuItem(e) {
      let t = this.menuItems.get(e.toLowerCase());
      if (t) return t;
      let n = this.get(e);
      if (n?.type === `button` || n?.type === `split`)
        return {
          text: n.tooltip,
          ...(n.icon ? { icon: n.icon } : {}),
          ...(n.shortcut ? { shortcut: n.shortcut } : {}),
          onAction: n.onAction,
          ...(n.isActive ? { isActive: n.isActive } : {}),
          ...(n.isEnabled ? { isEnabled: n.isEnabled } : {}),
        };
    }
    contextToolbars = new Map();
    autocompleters = new Map();
    addAutocompleter(e, t) {
      this.autocompleters.set(e.toLowerCase(), t);
    }
    getAutocompleters() {
      return [...this.autocompleters];
    }
    addContextToolbar(e, t) {
      this.contextToolbars.set(e.toLowerCase(), t);
    }
    getContextToolbars() {
      return [...this.contextToolbars].sort((e, t) => (t[1].priority ?? 0) - (e[1].priority ?? 0));
    }
    get(e) {
      return this.controls.get(e.toLowerCase());
    }
    has(e) {
      return this.controls.has(e.toLowerCase());
    }
    names() {
      return [...this.controls.keys()];
    }
  },
  vi = 450,
  yi = class {
    el;
    timer = null;
    target = null;
    constructor(e) {
      ((this.el = A(`div`, { className: `nova-tooltip`, role: `tooltip`, hidden: !0 })),
        e.append(this.el));
    }
    attach(e) {
      (e.addEventListener(`pointerenter`, (t) => {
        t.pointerType === `mouse` && this.schedule(e);
      }),
        e.addEventListener(`pointerleave`, () => this.hide()),
        e.addEventListener(`focus`, () => {
          e.matches(`:focus-visible`) && this.show(e);
        }),
        e.addEventListener(`blur`, () => this.hide()),
        e.addEventListener(`pointerdown`, () => this.hide()));
    }
    schedule(e) {
      (this.clearTimer(), (this.timer = setTimeout(() => this.show(e), vi)));
    }
    show(e) {
      this.clearTimer();
      let t = e.dataset.tooltip;
      if (!t || e.getAttribute(`aria-expanded`) === `true`) return;
      this.target = e;
      let n = e.dataset.shortcut;
      (this.el.replaceChildren(A(`span`, {}, t)),
        n && this.el.append(A(`kbd`, {}, be(n))),
        (this.el.hidden = !1),
        K(this.el, e.getBoundingClientRect(), `bottom`));
    }
    hide() {
      (this.clearTimer(), (this.el.hidden = !0), (this.target = null));
    }
    get current() {
      return this.target;
    }
    destroy() {
      (this.hide(), this.el.remove());
    }
    clearTimer() {
      (this.timer && clearTimeout(this.timer), (this.timer = null));
    }
  },
  bi = class {
    constructor(e, t, n) {
      ((this.focusEditor = n),
        (this.t = t),
        (this.overlayHost = A(`div`, { className: `nova-overlays` })),
        e.append(this.overlayHost),
        (this.tooltip = new yi(this.overlayHost)),
        (this.notifications = new gi(e, t(`dialog.close`))));
    }
    focusEditor;
    registry = new _i();
    t;
    overlayHost;
    tooltip;
    notifications;
    popover = null;
    dialog = null;
    openPopover(e) {
      (this.closePopover(), this.tooltip.hide());
      let t = new Or({
        ...e,
        host: this.overlayHost,
        onClose: (n) => {
          (this.popover === t && (this.popover = null), e.onClose?.(n));
        },
      });
      return ((this.popover = t), t);
    }
    closePopover() {
      (this.popover?.close(`api`), (this.popover = null));
    }
    get activePopover() {
      return this.popover;
    }
    dialogListeners = new Set();
    onDialogOpen(e) {
      return (this.dialogListeners.add(e), () => this.dialogListeners.delete(e));
    }
    closeOverlays() {
      (this.closePopover(), this.dialogListeners.forEach((e) => e()));
    }
    openDialog(e) {
      (this.closePopover(), this.dialogListeners.forEach((e) => e()), this.dialog?.close());
      let t = ke({
        cancelLabel: this.t(`dialog.cancel`),
        closeLabel: this.t(`dialog.close`),
        ...e,
        host: this.overlayHost,
        returnFocus: this.focusEditor,
        onClose: () => {
          (this.dialog === t && (this.dialog = null), e.onClose?.());
        },
      });
      return ((this.dialog = t), t);
    }
    get activeDialog() {
      return this.dialog;
    }
    notify(e) {
      return this.notifications.open(typeof e == `string` ? { text: e } : e);
    }
    destroy() {
      (this.closePopover(),
        this.dialog?.close(),
        this.tooltip.destroy(),
        this.notifications.destroy(),
        this.overlayHost.remove());
    }
  },
  xi = new sr(),
  Si = `nova:remote`,
  Ci = `nova:api`,
  wi = new Set(`P H1 H2 H3 H4 H5 H6 UL OL TABLE BLOCKQUOTE PRE HR DIV FIGURE`.split(` `)),
  Ti = 0,
  Ei = class {
    view;
    root;
    ui;
    options;
    listeners = new Map();
    ready;
    toolbar;
    toolbarHost;
    menubar;
    mode;
    pluginsByName = new Map();
    commandOverrides = new Map();
    transactionTransforms = [];
    cleanups = [];
    contentRules;
    schema;
    formatter;
    statusbar;
    searchBar;
    destroyed = !1;
    editable;
    disabled;
    pasteAsText;
    constructor(e) {
      ((this.options = e),
        (this.root = document.createElement(`div`)),
        (this.root.className = `nova-editor`),
        e.element.appendChild(this.root));
      let t = document.createElement(`div`),
        n = document.createElement(`div`),
        r = document.createElement(`div`);
      n.className = `nova-content`;
      let i = document.createElement(`div`);
      i.className = `nova-header`;
      let a = document.createElement(`div`);
      (i.append(a, t),
        this.root.append(i, n, r),
        (this.toolbarHost = t),
        (this.mode = e.mode ?? `classic`),
        this.root.classList.add(`nova-mode-${this.mode}`));
      let o = this.mode === `distraction-free`;
      (this.mode !== `classic` &&
        (this.root.addEventListener(`focusin`, () => this.root.classList.add(`is-focused`)),
        this.root.addEventListener(`focusout`, () => {
          setTimeout(() => {
            this.root.contains(document.activeElement) || this.root.classList.remove(`is-focused`);
          }, 0);
        })),
        (this.ui = new bi(this.root, We(e.language, e.translations), () => this.focus())));
      let s = D({
          'Mod-k': () => (je(this), !0),
          'Alt-F9': () => (this.menubar ? (this.menubar.focus(), !0) : !1),
          'Alt-F10': () => (this.toolbar ? (this.toolbar.focus(), !0) : !1),
          'Ctrl-F9': () => li(this),
          'Mod-f': () => (this.openSearch(), !0),
          'Mod-Shift-f': () => (zn(this), !0),
          'Alt-0': () => (Wn(this), !0),
          Escape: () => (this.searchBar.isOpen() ? (this.searchBar.close(), !0) : !1),
        }),
        c = [...(e.plugins ?? [])];
      o && !c.includes(`quickbars`) && c.push(`quickbars`);
      let l = Ke(c);
      l.errors.forEach((e) => Y(e));
      let { ordered: d, errors: f } = Ge(l.plugins);
      f.forEach((e) => Y(e));
      let p = d.flatMap((e) => this.collectPmPlugins(e)),
        m = e.validElements !== void 0 || e.invalidElements !== void 0 || e.validStyles !== void 0;
      this.contentRules = m ? new yn(e) : null;
      let h = new Set([
        ...yt(Object.values(e.formats ?? {}).flat()),
        ...yt(e.styleFormats ?? []),
        ...(Array.isArray(e.validClasses) ? e.validClasses : []),
        ...[...(e.tableClassList ?? []), ...(e.tableCellClassList ?? [])].flatMap((e) =>
          e.value.split(/\s+/).filter(Boolean),
        ),
      ]);
      ((this.schema = this.buildSchema(d, e.validClasses === !0 ? () => !0 : (e) => h.has(e))),
        (this.formatter = new At(this, h)));
      for (let [t, n] of Object.entries(e.formats ?? {})) this.formatter.register(t, n);
      d.forEach((e) => this.registerCommands(e));
      let g = Ai(this.schema, e.content ?? ``),
        _ = u.create({
          doc: this.contentRules ? this.contentRules.normalizeDoc(g) : g,
          plugins: [
            hi(this),
            ti((e) => this.isAllowed(e), this.schema),
            s,
            ...we(),
            jn(),
            ...ai((e) => this.resolveCommand(e)),
            ...(d.some((e) => e.replaceHistory) ? [] : [te()]),
            Je({ color: `var(--nova-accent)`, width: 2 }),
            et(),
            Ne(this),
            Re(this),
            Yt(this),
            si(this),
            ci(this),
            ...(this.contentRules ? [wn(this.contentRules)] : []),
            ...p,
            ...(e.prosemirrorPlugins ?? []),
          ],
        });
      ((this.editable = e.editable ?? !0),
        (this.disabled = e.disabled ?? !1),
        (this.pasteAsText = e.pasteAsText ?? !1));
      let v = this.handleTransaction.bind(this);
      ((this.view = new de(n, {
        state: _,
        editable: () => this.isEditable(),
        attributes: {
          class: `nova-prosemirror`,
          role: `textbox`,
          'aria-multiline': `true`,
          'aria-label': this.ui.t(`editor.label`),
          ...(e.placeholder ? { 'data-placeholder': e.placeholder } : {}),
        },
        dispatchTransaction: function (e) {
          v(e, this);
        },
        clipboardParser: rn(this.schema),
        nodeViews: { image: (e, t, n) => new di(e, t, n, this) },
        handleDOMEvents: {
          focus: (e, t) => (this.emit(`focus`, { event: t }), !1),
          blur: (e, t) => (this.emit(`blur`, { event: t }), !1),
        },
        handleKeyDown: (e, t) => (this.emit(`keydown`, { event: t }), t.defaultPrevented),
      })),
        this.root.classList.toggle(`nova-readonly`, !this.editable),
        this.applyDisabled(),
        Tr(this),
        pn(this),
        e.slashCommands !== !1 && Ir(this, e.slashCommands ?? []),
        d.forEach((e) => this.setupPlugin(e)),
        e.setup?.(this));
      let y = e.menubar === !0 ? cn : typeof e.menubar == `string` ? e.menubar : null;
      ((this.menubar = y ? ln(this, a, y, { ...sn, ...e.menu }) : null),
        this.menubar || a.remove(),
        (this.toolbar =
          e.toolbar === !1 || (o && e.toolbar === void 0)
            ? null
            : jr(this, t, this.toolbarConfig(), e.toolbarMode ?? `sliding`, {
                warnUnknown: l.loaders.length === 0,
              })),
        this.toolbar || t.remove(),
        !this.toolbar && !this.menubar && i.remove(),
        (this.searchBar = oi(this, n)));
      let b = e.statusbar ?? this.mode === `classic`;
      ((this.statusbar = b ? Br(this, r) : null),
        this.statusbar || r.remove(),
        e.onChange && this.on(`change`, e.onChange),
        this.updatePlaceholder());
      let x = this.applyContentStyles();
      this.ready = Promise.all([
        l.loaders.length ? this.loadLazyPlugins(l.loaders) : void 0,
        x,
        Kt(),
      ]).then(() => {
        this.destroyed || this.emit(`init`);
      });
    }
    applyContentStyles() {
      let { contentStyle: e, contentCss: t } = this.options,
        n = t === void 0 ? [] : Array.isArray(t) ? t : [t];
      if (!e && !n.length) return;
      let r = `nova-cs-${++Ti}`;
      this.root.classList.add(r);
      let i = `.nova-editor.${r} .nova-prosemirror`,
        a = n.map(() => ``),
        o = null,
        s = () => {
          this.destroyed ||
            (o?.(),
            (o = ei(
              this.root,
              Xr(
                [...a, e ?? ``].join(`
`),
                i,
              ),
            )));
        };
      if ((this.cleanups.push(() => o?.()), s(), n.length))
        return Promise.all(
          n.map((e, t) =>
            $r(e).then(
              (e) => {
                a[t] = e;
              },
              (t) => console.warn(`[nova] contentCss: could not load ${e}`, t),
            ),
          ),
        ).then(s);
    }
    isAllowed(e) {
      return this.contentRules?.isAllowed(e) ?? !0;
    }
    hasPlugin(e) {
      return this.pluginsByName.has(e);
    }
    buildSchema(e, t) {
      let n = {},
        r = {};
      for (let t of e) {
        let e = typeof t.nodes == `function` ? t.nodes(this) : t.nodes;
        for (let [t, r] of Object.entries(e ?? {}))
          t in n ? Y(`Node "${t}" is defined by several plugins`) : (n[t] = r);
        for (let [e, n] of Object.entries(t.marks ?? {}))
          e in r ? Y(`Mark "${e}" is defined by several plugins`) : (r[e] = n);
      }
      try {
        return fe({ nodes: n, marks: r }, t);
      } catch (e) {
        return (Y(`Failed to build the document schema from plugins`, e), fe({}, t));
      }
    }
    collectPmPlugins(e) {
      try {
        return e.prosemirrorPlugins?.(this) ?? [];
      } catch (t) {
        return (Y(`Plugin "${e.name}" failed to create ProseMirror plugins`, t), []);
      }
    }
    setupPlugin(e) {
      try {
        let t = e.setup?.(this);
        (typeof t == `function` && this.cleanups.push(t), this.pluginsByName.set(e.name, e));
      } catch (t) {
        Y(`Plugin "${e.name}" failed during setup`, t);
      }
    }
    async loadLazyPlugins(e) {
      let t = await Promise.all(
        e.map((e) => qe(e).catch((e) => (Y(`Failed to load plugin`, e), null))),
      );
      if (this.destroyed) return;
      let n = t.filter((e) =>
          e
            ? e.nodes || e.marks
              ? (Y(
                  `Plugin "${e.name}" defines nodes or marks and cannot be loaded lazily; pass the plugin object instead`,
                ),
                !1)
              : !0
            : !1,
        ),
        { ordered: r, errors: i } = Ge(n, new Set(this.pluginsByName.keys()));
      i.forEach((e) => Y(e));
      let a = r.flatMap((e) => this.collectPmPlugins(e));
      if (a.length) {
        let e = this.view.state;
        this.view.updateState(e.reconfigure({ plugins: [...e.plugins, ...a] }));
      }
      (r.forEach((e) => {
        (this.registerCommands(e), this.setupPlugin(e));
      }),
        this.rebuildToolbar());
    }
    updateUI() {
      this.destroyed || this.toolbar?.update();
    }
    rebuildToolbar() {
      this.toolbar &&
        !this.destroyed &&
        (this.toolbar.destroy(),
        (this.toolbar = jr(
          this,
          this.toolbarHost,
          this.toolbarConfig(),
          this.options.toolbarMode ?? `sliding`,
        )));
    }
    toolbarConfig() {
      if (this.options.toolbar) return this.options.toolbar;
      let e = [...this.pluginsByName.values()].map((e) => e.toolbar).filter(Boolean);
      return e.length ? `${kr} | ${e.join(` `)}` : kr;
    }
    handleTransaction(e, t = this.view) {
      if (!t.isDestroyed) {
        for (let n of this.transactionTransforms) e = n(e, t.state, this);
        (t.updateState(t.state.apply(e)),
          this.view &&
            (this.toolbar?.update(),
            this.statusbar?.update(e.docChanged),
            this.searchBar?.update(),
            this.updatePlaceholder(),
            e.docChanged &&
              (this.emit(`change`, { transaction: e }),
              !(e.getMeta(`nova:api`) || e.getMeta(`nova:remote`)) &&
                e.getMeta(`addToHistory`) !== !1 &&
                this.emit(`input`, { transaction: e })),
            (e.selectionSet || e.docChanged) && this.emit(`selectionChange`, { transaction: e })));
      }
    }
    updatePlaceholder() {
      let e = this.view.state.doc,
        t =
          e.childCount === 1 &&
          e.firstChild?.type === this.schema.nodes.paragraph &&
          e.firstChild.content.size === 0;
      this.view.dom.classList.toggle(`nova-empty`, t);
    }
    getHTML() {
      return xi.serializeFragment(this.view.state.doc.content);
    }
    getJSON() {
      return this.view.state.doc.toJSON();
    }
    getText() {
      return this.view.state.doc.textBetween(
        0,
        this.view.state.doc.content.size,
        `

`,
      );
    }
    setContent(e, { addToHistory: t = !0 } = {}) {
      let n = { content: e };
      this.emit(`beforeSetContent`, n);
      let r = Ai(this.schema, n.content),
        i = this.view.state.tr.replaceWith(0, this.view.state.doc.content.size, r.content);
      (i.setMeta(Ci, !0),
        t || i.setMeta(`addToHistory`, !1),
        this.view.dispatch(i),
        this.emit(`setContent`, { content: n.content }));
    }
    insertContent(e) {
      if (!this.isEditable()) return !1;
      let t = document.createElement(`template`);
      t.innerHTML = e;
      let n = document.createElement(`div`);
      n.append(t.content);
      let r = rn(this.schema),
        i = [...n.children].some((e) => wi.has(e.tagName)),
        { state: a } = this.view,
        o = i ? new l(r.parse(n).content, 0, 0) : r.parseSlice(n),
        s = !1;
      o.content.descendants((e) => (e.type.spec.tableRole === `table` && (s = !0), !s));
      let { $from: c } = a.selection,
        u = 0;
      for (let e = 1; e <= c.depth; e++)
        if (c.node(e).type.spec.tableRole === `table`) {
          u = e;
          break;
        }
      let d = s && u ? a.tr.insert(c.after(u), o.content) : a.tr.replaceSelection(o);
      return (this.view.dispatch(d.setMeta(Ci, !0).scrollIntoView()), !0);
    }
    isEmpty() {
      return this.view.dom.classList.contains(`nova-empty`);
    }
    resolveCommand(e) {
      return this.commandOverrides.get(e) ?? C[e];
    }
    registerCommands(e) {
      for (let [t, n] of Object.entries(e.commands ?? {})) n && this.commandOverrides.set(t, n);
      e.transformTransaction && this.transactionTransforms.push(e.transformTransaction);
    }
    exec(e) {
      let t = (typeof e == `string` ? this.resolveCommand(e) : e)(
        this.view.state,
        this.view.dispatch,
        this.view,
      );
      return (t && this.view.focus(), t);
    }
    can(e) {
      return (typeof e == `string` ? this.resolveCommand(e) : e)(
        this.view.state,
        void 0,
        this.view,
      );
    }
    isActive(e) {
      return v(this.view.state, e);
    }
    getCommandState(e) {
      return { active: this.isActive(e), enabled: this.isEditable() && this.can(e) };
    }
    focus() {
      this.destroyed || this.view.focus();
    }
    isPasteAsText() {
      return this.pasteAsText;
    }
    setPasteAsText(e) {
      ((this.pasteAsText = e), this.toolbar?.update());
    }
    openSearch() {
      this.searchBar.open();
    }
    closeSearch() {
      this.searchBar.close();
    }
    isEditable() {
      return this.editable && !this.disabled;
    }
    isDisabled() {
      return this.disabled;
    }
    setDisabled(e) {
      this.disabled !== e &&
        ((this.disabled = e),
        this.view.setProps({}),
        this.applyDisabled(),
        e && (this.ui.closePopover(), this.view.dom.blur()),
        this.toolbar?.update(),
        this.emit(`editableChange`));
    }
    applyDisabled() {
      (this.root.classList.toggle(`nova-disabled`, this.disabled),
        this.disabled
          ? this.root.setAttribute(`aria-disabled`, `true`)
          : this.root.removeAttribute(`aria-disabled`),
        this.disabled
          ? this.view.dom.setAttribute(`tabindex`, `-1`)
          : this.view.dom.removeAttribute(`tabindex`));
    }
    setEditable(e) {
      this.editable !== e &&
        ((this.editable = e),
        this.view.setProps({}),
        this.root.classList.toggle(`nova-readonly`, !e),
        e || this.ui.closePopover(),
        this.toolbar?.update(),
        this.emit(`editableChange`));
    }
    on(e, t) {
      let n = this.listeners.get(e);
      return (n || this.listeners.set(e, (n = new Set())), n.add(t), () => this.off(e, t));
    }
    off(e, t) {
      this.listeners.get(e)?.delete(t);
    }
    emit(e, ...[t]) {
      for (let n of this.listeners.get(e) ?? [])
        try {
          n(this, t);
        } catch (t) {
          Y(`Listener for "${e}" failed`, t);
        }
    }
    destroy() {
      if (!this.destroyed) {
        (this.emit(`destroy`),
          (this.destroyed = !0),
          this.menubar?.destroy(),
          this.ui.destroy(),
          this.toolbar?.destroy(),
          this.statusbar?.destroy());
        for (let e of this.cleanups.splice(0))
          try {
            e();
          } catch (e) {
            Y(`Plugin cleanup failed`, e);
          }
        (this.searchBar.destroy(),
          this.root.classList.contains(`nova-fullscreen`) && zn(this, !1),
          this.view.destroy(),
          this.root.remove(),
          this.listeners.clear());
      }
    }
  };
function Y(e, t) {
  console.error(`[nova] ${e}`, ...(t === void 0 ? [] : [t]));
}
function Di(e, t) {
  let n = e?.validate;
  if (!n) return !0;
  if (typeof n == `function`)
    try {
      return (n(t), !0);
    } catch {
      return !1;
    }
  let r = t === null ? `null` : typeof t;
  return n.split(`|`).includes(r);
}
function Oi(e, t) {
  return !t || typeof t != `object` || !e
    ? t
    : Object.fromEntries(Object.entries(t).filter(([t, n]) => Di(e[t], n)));
}
function ki(e, t) {
  let n = e.nodes[t.type],
    r = { ...t };
  return (
    n && (r.attrs = Oi(n.spec.attrs, t.attrs)),
    Array.isArray(t.marks) &&
      (r.marks = t.marks.map((t) => {
        let n = t && e.marks[t.type];
        return n ? { ...t, attrs: Oi(n.spec.attrs, t.attrs) } : t;
      })),
    Array.isArray(t.content) &&
      (r.content = t.content.map((t) => (t && typeof t == `object` ? ki(e, t) : t))),
    r
  );
}
function Ai(e, t) {
  if (typeof t != `string`) return r.fromJSON(e, ki(e, t));
  let n = document.createElement(`div`),
    i = document.createElement(`template`);
  return ((i.innerHTML = t), n.appendChild(i.content), rn(e).parse(n));
}
function ji(e) {
  return new Ei(e);
}
var Mi = /^[A-Za-z0-9_-]{1,64}$/,
  X = 5e3;
function Ni(e = `c`) {
  let t = new Uint8Array(9);
  return (
    globalThis.crypto.getRandomValues(t),
    e + Array.from(t, (e) => (e % 36).toString(36)).join(``)
  );
}
function Pi(e) {
  if (!e || typeof e != `object`) return null;
  let t = e;
  if (typeof t.id != `string` || !Mi.test(t.id)) return null;
  let n = Array.isArray(t.comments) ? t.comments.map(Ii).filter((e) => e !== null) : [],
    r = t.resolved;
  return {
    id: t.id,
    createdAt: Number(t.createdAt) || 0,
    comments: n,
    resolved: r && typeof r == `object` ? { by: Fi(r.by), at: Number(r.at) || 0 } : null,
  };
}
function Fi(e) {
  let t = e && typeof e == `object` ? e : {};
  return { id: String(t.id ?? ``).slice(0, 128), name: String(t.name ?? ``).slice(0, 80) };
}
function Ii(e) {
  if (!e || typeof e != `object`) return null;
  let t = e;
  if (typeof t.id != `string` || !Mi.test(t.id)) return null;
  let n = {
    id: t.id,
    author: Fi(t.author),
    text: String(t.text ?? ``).slice(0, X),
    createdAt: Number(t.createdAt) || 0,
  };
  if ((t.editedAt && (n.editedAt = Number(t.editedAt) || 0), Array.isArray(t.mentions))) {
    let e = t.mentions
      .slice(0, 20)
      .map(Fi)
      .filter((e) => /^[\w.@:+-]{1,128}$/.test(e.id) && e.name);
    e.length && (n.mentions = e);
  }
  return n;
}
function Li(e = [], t) {
  let n = e.map(Pi).filter((e) => e !== null),
    r = new Set(),
    i = (e) => {
      ((n = e), t?.(n), r.forEach((e) => e()));
    },
    a = (e, t) => i(n.map((n) => (n.id === e ? t(n) : n)));
  return {
    threads: () => n,
    subscribe(e) {
      return (r.add(e), () => r.delete(e));
    },
    createThread(e) {
      let t = Pi(e);
      t && !n.some((e) => e.id === t.id) && i([...n, t]);
    },
    reply(e, t) {
      let n = Ii(t);
      n && a(e, (e) => ({ ...e, comments: [...e.comments, n] }));
    },
    editComment(e, t, n) {
      a(e, (e) => ({
        ...e,
        comments: e.comments.map((e) =>
          e.id === t ? { ...e, text: n.slice(0, X), editedAt: Date.now() } : e,
        ),
      }));
    },
    deleteComment(e, t) {
      a(e, (e) => ({ ...e, comments: e.comments.filter((e) => e.id !== t) }));
    },
    setResolved(e, t) {
      a(e, (e) => ({ ...e, resolved: t ?? null }));
    },
    deleteThread(e) {
      i(n.filter((t) => t.id !== e));
    },
  };
}
var Ri = O.anchor,
  zi = {
    en: {
      title: `Anchor`,
      id: `ID`,
      hint: `Letters, digits, “-”, “_”, “.”; must start with a letter. Link to it with #ID.`,
      invalid: `Use letters, digits, “-”, “_” or “.”, starting with a letter`,
      save: `Save`,
    },
    ru: {
      title: `Якорь`,
      id: `Идентификатор`,
      hint: `Латинские буквы, цифры, «-», «_», «.»; начинается с буквы. Ссылка на якорь — #идентификатор.`,
      invalid: `Только латинские буквы, цифры, «-», «_» или «.», первая — буква`,
      save: `Сохранить`,
    },
  },
  Bi = /^[A-Za-z][\w.-]{0,63}$/,
  Vi = I({
    name: `anchor`,
    toolbar: `anchor`,
    nodes: {
      anchor: {
        group: `inline`,
        inline: !0,
        atom: !0,
        selectable: !0,
        attrs: { id: {} },
        parseDOM: [
          {
            tag: `a[id]:not([href])`,
            getAttrs: (e) => {
              let t = e.getAttribute(`id`) ?? ``;
              return Bi.test(t) ? { id: t } : !1;
            },
          },
          {
            tag: `a[name]:not([href])`,
            getAttrs: (e) => {
              let t = e.getAttribute(`name`) ?? ``;
              return Bi.test(t) ? { id: t } : !1;
            },
          },
        ],
        toDOM: (e) => [`a`, { id: Bi.test(e.attrs.id) ? e.attrs.id : null }],
      },
    },
    setup(e) {
      let t = P(e, `anchor`, zi),
        n = () => {
          let { selection: t } = e.view.state;
          return t instanceof p && t.node.type.name === `anchor` ? t : null;
        },
        r = () => {
          let r = n(),
            i = j({ label: t.id, hint: t.hint, value: r?.node.attrs.id ?? `` });
          e.ui.openDialog({
            title: t.title,
            body: A(`div`, { className: `nova-form` }, i.el),
            submitLabel: t.save,
            onSubmit: () => {
              let r = i.input.value.trim();
              if (!Bi.test(r)) return t.invalid;
              let { state: a, dispatch: o } = e.view,
                s = e.schema.nodes.anchor,
                c = n();
              return (
                o(
                  c
                    ? a.tr.setNodeMarkup(c.from, void 0, { id: r })
                    : a.tr.replaceSelectionWith(s.create({ id: r }), !1).scrollIntoView(),
                ),
                !0
              );
            },
          });
        };
      (e.ui.registry.addToggleButton(`anchor`, {
        icon: Ri,
        tooltip: t.title,
        isActive: () => n() !== null,
        isEnabled: (e) => e.isEditable(),
        onAction: r,
      }),
        e.ui.registry.addMenuItem(`anchor`, { text: t.title, icon: Ri, onAction: r }));
    },
  }),
  Hi = {
    en: { list: `People`, empty: `No matches` },
    ru: { list: `Люди`, empty: `Никого не найдено` },
  },
  Ui = /^[\w.@:+-]{1,128}$/,
  Wi = 80,
  Gi = (e) => e.replace(/^@/, ``).trim().slice(0, Wi);
async function Ki(e, t, n = 8) {
  let r = await e(t);
  return Array.isArray(r)
    ? r
        .filter((e) => e && typeof e.id == `string` && Ui.test(e.id) && e.name)
        .slice(0, n)
        .map((e) => ({
          id: e.id,
          name: Gi(String(e.name)),
          ...(e.description ? { description: String(e.description).slice(0, 120) } : {}),
        }))
    : [];
}
var qi = I({
    name: `mentions`,
    nodes: {
      mention: {
        group: `inline`,
        inline: !0,
        atom: !0,
        selectable: !1,
        attrs: { id: {}, name: { default: `` } },
        parseDOM: [
          {
            tag: `span[data-mention]`,
            getAttrs: (e) => {
              let t = e,
                n = t.getAttribute(`data-mention`) ?? ``;
              return Ui.test(n) ? { id: n, name: Gi(t.textContent ?? ``) } : !1;
            },
          },
        ],
        toDOM: (e) => [
          `span`,
          { 'data-mention': Ui.test(e.attrs.id) ? e.attrs.id : null },
          `@${Gi(String(e.attrs.name))}`,
        ],
        leafText: (e) => `@${Gi(String(e.attrs.name))}`,
      },
    },
    setup(e) {
      let t = e.options.pluginOptions?.mentions;
      if (!t?.fetch) {
        console.warn(`[nova] mentions: set pluginOptions.mentions.fetch to search people`);
        return;
      }
      let n = P(e, `mentions`, Hi),
        r = t.maxResults ?? 8,
        i = new Map();
      e.ui.registry.addAutocompleter(`mentions`, {
        trigger: `@`,
        label: n.list,
        emptyText: n.empty,
        maxResults: r,
        fetch: async (e) => {
          let n = await Ki(t.fetch, e, r);
          return (
            (i = new Map(n.map((e) => [e.id, e]))),
            n.map((e) => ({
              value: e.id,
              label: e.name,
              ...(e.description ? { detail: e.description } : {}),
            }))
          );
        },
        onSelect: (e, n, r) => {
          let a = i.get(e.value) ?? { id: e.value, name: e.label },
            { state: o, dispatch: s } = r.view,
            c = r.schema.nodes.mention.create({ id: a.id, name: a.name });
          (s(o.tr.replaceWith(n.from, n.to, [c, o.schema.text(` `)]).scrollIntoView()),
            t.onMention?.(a, r));
        },
      });
    },
  }),
  Ji = {
    en: {
      add: `Add comment`,
      show: `Comments`,
      panel: `Comments`,
      guest: `Guest`,
      newComment: `New comment`,
      placeholder: `Add a comment…`,
      replyPlaceholder: `Reply…`,
      comment: `Comment`,
      reply: `Reply`,
      cancel: `Cancel`,
      save: `Save`,
      edit: `Edit`,
      remove: `Delete`,
      resolve: `Resolve`,
      reopen: `Reopen`,
      deleteThread: `Delete thread`,
      close: `Close comments`,
      showResolved: `Show resolved`,
      resolvedBy: `Resolved by {name}`,
      orphan: `The commented text was deleted`,
      empty: `No comments yet. Select text and press “Add comment” ({shortcut}).`,
      people: `People`,
      noPeople: `No matches`,
      edited: `edited`,
      you: `you`,
      count: `{count} comments`,
    },
    ru: {
      add: `Добавить комментарий`,
      show: `Комментарии`,
      panel: `Комментарии`,
      guest: `Гость`,
      newComment: `Новый комментарий`,
      placeholder: `Напишите комментарий…`,
      replyPlaceholder: `Ответить…`,
      comment: `Комментировать`,
      reply: `Ответить`,
      cancel: `Отмена`,
      save: `Сохранить`,
      edit: `Изменить`,
      remove: `Удалить`,
      resolve: `Решено`,
      reopen: `Открыть снова`,
      deleteThread: `Удалить обсуждение`,
      close: `Закрыть комментарии`,
      showResolved: `Показать решённые`,
      resolvedBy: `Решено: {name}`,
      orphan: `Прокомментированный текст удалён`,
      empty: `Комментариев пока нет. Выделите текст и нажмите «Добавить комментарий» ({shortcut}).`,
      people: `Люди`,
      noPeople: `Никого не найдено`,
      edited: `изменено`,
      you: `вы`,
      count: `Комментариев: {count}`,
    },
  },
  Yi = O.commentAdd,
  Xi = O.comments,
  Zi = `Mod-Alt-m`,
  Z = new a(`nova-comments`),
  Qi = new WeakMap();
function $i(e) {
  return Qi.get(e);
}
function ea(e) {
  let t = new Map();
  return (
    e.descendants((e, n) => {
      if (e.isInline)
        for (let r of e.marks) {
          if (r.type.name !== `comment`) continue;
          let i = r.attrs.id,
            a = t.get(i) ?? [],
            o = a[a.length - 1];
          (o && o.to === n ? (o.to = n + e.nodeSize) : a.push({ from: n, to: n + e.nodeSize }),
            t.set(i, a));
        }
    }),
    t
  );
}
function ta(e) {
  let { $from: t, empty: n } = e.selection;
  return (
    n ? [...(t.nodeBefore?.marks ?? []), ...(t.nodeAfter?.marks ?? [])] : (t.nodeAfter?.marks ?? [])
  )
    .filter((e) => e.type.name === `comment`)
    .map((e) => e.attrs.id);
}
var na = I({
    name: `comments`,
    toolbar: `addcomment showcomments`,
    marks: {
      comment: {
        attrs: { id: {} },
        inclusive: !1,
        excludes: ``,
        parseDOM: [
          {
            tag: `span[data-comment]`,
            getAttrs: (e) => {
              let t = e.getAttribute(`data-comment`) ?? ``;
              return Mi.test(t) ? { id: t } : !1;
            },
          },
        ],
        toDOM: (e) => [`span`, { 'data-comment': Mi.test(e.attrs.id) ? e.attrs.id : null }, 0],
      },
    },
    prosemirrorPlugins: (e) => {
      let t = null;
      return [
        D({ [Zi]: () => $i(e)?.startComment() ?? !1 }),
        new c({
          key: Z,
          state: {
            init: () => ({ pending: null, active: null }),
            apply(e, t) {
              let n = e.getMeta(Z),
                r = t;
              if (e.docChanged && r.pending) {
                let t = e.mapping.map(r.pending.from, 1),
                  n = e.mapping.map(r.pending.to, -1);
                r = { ...r, pending: t < n ? { from: t, to: n } : null };
              }
              return (n && (`pending` in n || `active` in n) && (r = { ...r, ...n }), r);
            },
          },
          props: {
            decorations(n) {
              let r = $i(e),
                i = Z.getState(n),
                a = r?.store.threads();
              if (t && t.doc === n.doc && t.threads === a && t.state === i) return t.set;
              let o = new Set((a ?? []).filter((e) => !e.resolved).map((e) => e.id)),
                s = [];
              for (let [e, t] of ea(n.doc)) {
                if (!o.has(e)) continue;
                let n = e === i.active ? `nova-comment is-active` : `nova-comment`;
                for (let { from: e, to: r } of t) s.push(w.inline(e, r, { class: n }));
              }
              if (i.pending) {
                let { from: e, to: t } = i.pending;
                s.push(w.inline(e, t, { class: `nova-comment is-active is-pending` }));
              }
              let c = he.create(n.doc, s);
              return ((t = { doc: n.doc, threads: a, state: i, set: c }), c);
            },
          },
          view: () => ({
            update(t, n) {
              if (n.selection.eq(t.state.selection) || n.doc !== t.state.doc) return;
              let r = $i(e);
              if (!r || Z.getState(t.state).pending) return;
              let i = new Set(
                  r.store
                    .threads()
                    .filter((e) => !e.resolved)
                    .map((e) => e.id),
                ),
                a = ta(t.state).find((e) => i.has(e));
              a &&
                (a !== r.active() || !r.isPanelOpen()) &&
                queueMicrotask(() => {
                  (r.setActive(a), r.openPanel());
                });
            },
          }),
        }),
      ];
    },
    setup(e) {
      let t = P(e, `comments`, Ji),
        n = e.options.pluginOptions?.comments ?? {},
        r = n.store ?? Li(n.threads ?? [], n.onChange),
        i = {
          id: String(n.author?.id ?? `guest`).slice(0, 128),
          name: String(n.author?.name || t.guest).slice(0, 80),
        },
        a = () => e.schema.marks.comment,
        o = n.mentions ?? e.options.pluginOptions?.mentions?.fetch,
        s = (e, t = []) =>
          [...new Map(t.map((e) => [e.id, e])).values()].filter((t) => e.includes(`@${t.name}`)),
        c = (e, t) => {
          let n = s(e, t);
          return {
            id: Ni(),
            author: i,
            text: e,
            createdAt: Date.now(),
            ...(n.length ? { mentions: n } : {}),
          };
        },
        l = (e, t) => {
          t.mentions?.length && n.onMention?.({ threadId: e, comment: t, users: t.mentions });
        },
        u = () => Z.getState(e.view.state),
        d = (t) => e.view.dispatch(e.view.state.tr.setMeta(Z, t)),
        f = null,
        p = !1,
        m = null,
        h = e.view.dom.parentElement,
        g = document.createElement(`div`);
      ((g.className = `nova-body`), h.parentElement.insertBefore(g, h), g.append(h));
      let _ = {
        editor: e,
        store: r,
        author: i,
        labels: t,
        shortcut: Zi,
        pending: () => u().pending,
        active: () => u().active,
        setActive(t, n = !1) {
          (u().active !== t && d({ active: t }), f?.render());
          let r = t ? _.ranges(t)[0] : void 0;
          if (n && r) {
            let { node: t } = e.view.domAtPos(r.from);
            (t instanceof Element ? t : t.parentElement)?.scrollIntoView({ block: `nearest` });
          }
        },
        startComment() {
          let { selection: t } = e.view.state;
          return t.empty || !e.isEditable()
            ? !1
            : (d({ pending: { from: t.from, to: t.to }, active: null }),
              _.openPanel().then(() => {
                (f?.render(), f?.focusComposer());
              }),
              !0);
        },
        cancelPending() {
          (d({ pending: null }), f?.render(), e.focus());
        },
        findUsers: o ? (e) => Ki(o, e) : null,
        submitPending(t, n) {
          let i = u().pending,
            o = t.trim().slice(0, X);
          if (!i || !o) return null;
          let s = Ni(`t`),
            d = c(o, n);
          r.createThread({ id: s, createdAt: d.createdAt, comments: [d], resolved: null });
          let { state: p } = e.view;
          return (
            e.view.dispatch(
              p.tr
                .addMark(i.from, i.to, a().create({ id: s }))
                .setMeta(Z, { pending: null, active: s })
                .setMeta(`addToHistory`, !1),
            ),
            f?.render(),
            l(s, d),
            s
          );
        },
        reply(e, t, n) {
          let i = t.trim().slice(0, X);
          if (!i) return;
          let a = c(i, n);
          (r.reply(e, a), l(e, a));
        },
        ranges: (t) => ea(e.view.state.doc).get(t) ?? [],
        quote(t) {
          let { doc: n } = e.view.state;
          return _.ranges(t)
            .map(({ from: e, to: t }) => n.textBetween(e, t, ` `))
            .join(` … `);
        },
        positionOf: (e) => _.ranges(e)[0]?.from ?? 2 ** 53 - 1,
        deleteThread(t) {
          let { state: n } = e.view,
            i = n.tr;
          for (let { from: e, to: n } of _.ranges(t)) i.removeMark(e, n, a().create({ id: t }));
          (u().active === t && i.setMeta(Z, { active: null }),
            (i.docChanged || i.getMeta(Z)) && e.view.dispatch(i.setMeta(`addToHistory`, !1)),
            r.deleteThread(t));
        },
        setResolved(e, t) {
          (r.setResolved(e, t ? { by: i, at: Date.now() } : null),
            t && u().active === e && d({ active: null }));
        },
        canEdit: (e) => (n.canEdit ? n.canEdit(e, i) : e.author.id === i.id),
        isPanelOpen: () => p,
        async openPanel() {
          (f ||
            ((m ??= L(
              async () => {
                let { createCommentsPanel: e } = await import(
                  `./comments-panel-FYJE3U64.BfPYnI7t.js`
                );
                return { createCommentsPanel: e };
              },
              __vite__mapDeps([0, 1]),
            ).then(({ createCommentsPanel: t }) => {
              e.view.isDestroyed || ((f = t(_)), g.append(f.el));
            })),
            await m),
            f &&
              !p &&
              (e.ui.closeOverlays(),
              (p = !0),
              (f.el.hidden = !1),
              e.root.classList.add(`nova-comments-open`),
              f.render(),
              e.updateUI()));
        },
        closePanel() {
          f &&
            p &&
            ((p = !1),
            (f.el.hidden = !0),
            e.root.classList.remove(`nova-comments-open`),
            u().pending && d({ pending: null }),
            e.updateUI(),
            e.focus());
        },
      };
      Qi.set(e, _);
      let v = r.subscribe(() => {
          e.view.isDestroyed || (d({ refresh: !0 }), f?.render());
        }),
        y = () => _.startComment(),
        b = () => (_.isPanelOpen() ? _.closePanel() : void _.openPanel()),
        x = (e) => e.isEditable() && !e.view.state.selection.empty;
      return (
        e.ui.registry.addButton(`addcomment`, {
          icon: Yi,
          tooltip: t.add,
          shortcut: Zi,
          isEnabled: x,
          onAction: y,
        }),
        e.ui.registry.addToggleButton(`showcomments`, {
          icon: Xi,
          tooltip: t.show,
          isActive: () => p,
          onAction: b,
        }),
        e.ui.registry.addMenuItem(`addcomment`, {
          text: t.add,
          icon: Yi,
          shortcut: Zi,
          isEnabled: x,
          onAction: y,
        }),
        e.ui.registry.addMenuItem(`showcomments`, {
          text: t.show,
          icon: Xi,
          isActive: () => p,
          onAction: b,
        }),
        () => {
          (v(), f?.destroy(), Qi.delete(e));
        }
      );
    },
  }),
  ra = {
    en: {
      insert: `Insert variable`,
      search: `Variables`,
      empty: `No variables found`,
      unknown: `Unknown variable`,
    },
    ru: {
      insert: `Вставить переменную`,
      search: `Переменные`,
      empty: `Переменные не найдены`,
      unknown: `Неизвестная переменная`,
    },
  },
  ia = /^[\w.:-]{1,100}$/,
  aa = /^data-[a-z0-9-]{1,40}$/;
function oa(e) {
  return e.options.pluginOptions?.mergetags ?? {};
}
function sa(e) {
  let t = oa(e).attribute ?? `data-mergetag`;
  return aa.test(t)
    ? t
    : (console.warn(
        `[nova] mergetags: attribute "${t}" must look like data-name; using data-mergetag`,
      ),
      `data-mergetag`);
}
var ca = (e) => Array.isArray(e.items);
function la(e) {
  return (oa(e).list ?? []).flatMap((e) => (ca(e) ? e.items : [e]));
}
function ua(e, t) {
  return la(e).find((e) => e.key === t)?.label;
}
function da(e) {
  let t = sa(e);
  return {
    mergetag: {
      group: `inline`,
      inline: !0,
      atom: !0,
      selectable: !0,
      draggable: !0,
      ignoreStyles: !0,
      attrs: { key: {}, label: { default: `` } },
      parseDOM: [
        {
          tag: `span[${t}]`,
          priority: 60,
          getAttrs: (n) => {
            let r = n,
              i = r.getAttribute(t) ?? ``;
            return ia.test(i) ? { key: i, label: ua(e, i) ?? r.textContent?.trim() ?? i } : !1;
          },
        },
      ],
      toDOM: (e) => {
        let n = ia.test(e.attrs.key) ? e.attrs.key : ``,
          r = e.attrs.label == null || e.attrs.label === `` ? n : String(e.attrs.label);
        return [`span`, { [t]: n, contenteditable: `false` }, r];
      },
    },
  };
}
var fa = class {
  constructor(e, t, n) {
    ((this.node = e),
      (this.editor = t),
      (this.unknownTitle = n),
      (this.dom = document.createElement(`span`)),
      (this.dom.className = `nova-mergetag`),
      (this.dom.contentEditable = `false`),
      this.render());
  }
  node;
  editor;
  unknownTitle;
  dom;
  render() {
    let e = this.node.attrs.key,
      t = ua(this.editor, e);
    ((this.dom.textContent = t ?? (this.node.attrs.label || e)), (this.dom.dataset.key = e));
    let n = !!oa(this.editor).list?.length && t === void 0;
    (this.dom.classList.toggle(`is-unknown`, n),
      (this.dom.title = n ? `${this.unknownTitle}: ${e}` : e));
  }
  update(e) {
    return e.type === this.node.type && ((this.node = e), this.render(), !0);
  }
  selectNode() {
    this.dom.classList.add(`is-selected`);
  }
  deselectNode() {
    this.dom.classList.remove(`is-selected`);
  }
  stopEvent() {
    return !1;
  }
  ignoreMutation() {
    return !0;
  }
};
function pa(e, t, n) {
  let { state: r, dispatch: i } = e.view,
    a = e.schema.nodes.mergetag.create({ key: t.key, label: t.label });
  (i((n ? r.tr.replaceWith(n.from, n.to, a) : r.tr.replaceSelectionWith(a, !1)).scrollIntoView()),
    e.focus());
}
var ma = I({
    name: `mergetags`,
    toolbar: `mergetags`,
    nodes: da,
    prosemirrorPlugins: (e) => {
      let t = P(e, `mergetags`, ra);
      return [new c({ props: { nodeViews: { mergetag: (n, r) => new fa(n, e, t.unknown) } } })];
    },
    setup(e) {
      let t = P(e, `mergetags`, ra);
      (e.ui.registry.addMenuButton(`mergetags`, {
        icon: O.mergeTags,
        tooltip: t.insert,
        isEnabled: (e) => e.isEditable() && la(e).length > 0,
        items: (e) => {
          let t = [],
            n = (t, n) => ({ id: n, label: t.label, onSelect: () => pa(e, t) });
          return (
            (oa(e).list ?? []).forEach((e, r) => {
              ca(e)
                ? (t.length && t.push({ type: `separator` }),
                  t.push({ type: `heading`, label: e.title }),
                  e.items.forEach((e, i) => t.push(n(e, `mergetag-${r}-${i}`))))
                : t.push(n(e, `mergetag-${r}`));
            }),
            t
          );
        },
      }),
        e.ui.registry.addAutocompleter(`mergetags`, {
          trigger: `{{`,
          label: t.search,
          emptyText: t.empty,
          maxResults: 12,
          fetch: (e, t) => {
            let n = e.toLowerCase();
            return la(t)
              .filter((e) => e.label.toLowerCase().includes(n) || e.key.toLowerCase().includes(n))
              .map((e) => ({ value: e.key, label: e.label, detail: e.key }));
          },
          onSelect: (e, t, n) => {
            let r = la(n).find((t) => t.key === e.value);
            r && pa(n, r, t);
          },
        }));
    },
  }),
  ha = /^[A-Za-z0-9_-]{1,64}$/,
  ga = /^[\w.@:+-]{1,128}$/,
  _a = {
    en: {
      toggle: `Suggest edits`,
      review: `Review suggestions`,
      accept: `Accept`,
      reject: `Reject`,
      acceptAll: `Accept all suggestions`,
      rejectAll: `Reject all suggestions`,
      next: `Next suggestion`,
      previous: `Previous suggestion`,
      inserted: `Inserted by {name}`,
      deleted: `Deleted by {name}`,
      toolbar: `Suggestion`,
      guest: `Guest`,
      none: `No suggestions`,
    },
    ru: {
      toggle: `Предлагать правки`,
      review: `Правки`,
      accept: `Принять`,
      reject: `Отклонить`,
      acceptAll: `Принять все правки`,
      rejectAll: `Отклонить все правки`,
      next: `Следующая правка`,
      previous: `Предыдущая правка`,
      inserted: `Вставлено: {name}`,
      deleted: `Удалено: {name}`,
      toolbar: `Правка`,
      guest: `Гость`,
      none: `Правок нет`,
    },
  },
  va = O.suggest,
  ya = O.review,
  ba = O.check,
  xa = O.close,
  Q = new a(`nova-suggestions`),
  Sa = `nova-suggestions-own`,
  Ca = [`#1a7f37`, `#8250df`, `#bf3989`, `#0969da`, `#bc4c00`, `#1b7c83`];
function wa(e) {
  let t = 0;
  for (let n of String(e ?? ``)) t = (t * 31 + n.charCodeAt(0)) | 0;
  return Ca[Math.abs(t) % Ca.length];
}
function Ta() {
  let e = new Uint8Array(9);
  return (
    globalThis.crypto.getRandomValues(e),
    `s` + Array.from(e, (e) => (e % 36).toString(36)).join(``)
  );
}
function Ea(e) {
  let t = e === `insert` ? `ins` : `del`;
  return {
    attrs: { id: {}, author: { default: `` }, name: { default: `` }, time: { default: 0 } },
    inclusive: !1,
    excludes: ``,
    parseDOM: [
      {
        tag: `${t}[data-suggestion]`,
        priority: 60,
        getAttrs: (e) => {
          let t = e,
            n = t.getAttribute(`data-suggestion`) ?? ``;
          if (!ha.test(n)) return !1;
          let r = t.getAttribute(`data-author`) ?? ``;
          return {
            id: n,
            author: ga.test(r) ? r : ``,
            name: (t.getAttribute(`data-name`) ?? ``).slice(0, 80),
            time: Number(t.getAttribute(`data-time`)) || 0,
          };
        },
      },
    ],
    toDOM: (e) => [
      t,
      {
        'data-suggestion': ha.test(e.attrs.id) ? e.attrs.id : null,
        'data-author': ga.test(e.attrs.author) ? e.attrs.author : null,
        'data-name': String(e.attrs.name ?? ``).slice(0, 80) || null,
        'data-time': Number(e.attrs.time) || null,
      },
      0,
    ],
  };
}
var Da = (e) => ({ insert: e.marks.suggestion_insert, delete: e.marks.suggestion_delete });
function Oa(e) {
  return !e.docChanged ||
    e.getMeta(Sa) ||
    e.getMeta(`addToHistory`) === !1 ||
    e.getMeta(`history$`) ||
    e.getMeta(`y-sync$`)?.isChangeOrigin
    ? !1
    : e.steps.every((e) => e instanceof f);
}
function ka(e, t, n, r) {
  let i = e.resolve(t);
  for (let e of [i.nodeBefore, i.nodeAfter]) {
    let t = e?.marks.find((e) => e.type === n && e.attrs.author === r);
    if (t) return t;
  }
  return null;
}
function Aa(t, n, r) {
  let i = [];
  return (
    t.forEach((e) => {
      e.isInline
        ? i.push(r && !r.allowsMarkType(n.type) ? e : e.mark(n.addToSet(e.marks)))
        : i.push(e.copy(Aa(e.content, n, e.type)));
    }),
    e.from(i)
  );
}
function ja(e, t, n) {
  if (!Oa(e)) return e;
  let r = Da(t.schema),
    i = t.tr,
    a = Date.now(),
    s = (e) => e,
    c = null,
    u = null;
  if (
    (e.steps.forEach((o) => {
      let d = o,
        f = i.steps.length,
        p = s,
        m = p(d.from),
        h = Math.max(m, p(d.to));
      if (h > m) {
        let o = [],
          s = [];
        if (
          (i.doc.nodesBetween(m, h, (e, t) => {
            if (!e.isInline) return !0;
            let i = Math.max(t, m),
              a = Math.min(t + e.nodeSize, h);
            return (
              i >= a ||
                (e.marks.some((e) => e.type === r.insert && e.attrs.author === n.id)
                  ? o.push({ from: i, to: a })
                  : r.delete.isInSet(e.marks) || s.push({ from: i, to: a })),
              !1
            );
          }),
          s.length)
        ) {
          let e = s[0],
            t =
              ka(i.doc, e.from, r.delete, n.id) ??
              ka(i.doc, s[s.length - 1].to, r.delete, n.id) ??
              r.delete.create({ id: Ta(), author: n.id, name: n.name, time: a });
          for (let e of s) i.addMark(e.from, e.to, t);
        }
        for (let e of o.reverse()) i.delete(e.from, e.to);
        let l = i.mapping.slice(f);
        ((m = l.map(m, 1)), (h = l.map(h, -1)));
        let u = t.selection;
        e.steps.length === 1 &&
          d.slice.size === 0 &&
          u.empty &&
          u.from === d.from &&
          e.selection.head === d.from &&
          (c = h);
      }
      if (d.slice.size > 0) {
        let t = h;
        if (!d.slice.openStart)
          for (let e = i.doc.resolve(t).nodeAfter; e && r.delete.isInSet(e.marks);)
            ((t += e.nodeSize), (e = i.doc.resolve(t).nodeAfter));
        let o =
            ka(i.doc, t, r.insert, n.id) ??
            r.insert.create({ id: Ta(), author: n.id, name: n.name, time: a }),
          s = i.doc.resolve(t),
          c = Aa(d.slice.content, o, d.slice.openStart ? null : s.parent.type);
        (i.replace(t, t, new l(c, d.slice.openStart, d.slice.openEnd)),
          e.steps.length === 1 && (u = t + d.slice.size));
      }
      let g = d.getMap().invert(),
        _ = i.mapping.slice(f);
      s = (e) => _.map(p(g.map(e, -1)), 1);
    }),
    c !== null)
  )
    i.setSelection(o.create(i.doc, c));
  else if (u !== null && e.selection.empty) i.setSelection(o.create(i.doc, u));
  else {
    let t = s(e.selection.anchor),
      n = s(e.selection.head);
    try {
      i.setSelection(o.create(i.doc, t, n));
    } catch {}
  }
  for (let t of [`addToHistory`, `uiEvent`, `paste`, `scrollIntoView`]) {
    let n = e.getMeta(t);
    n !== void 0 && i.setMeta(t, n);
  }
  return (e.scrolledIntoView && i.scrollIntoView(), i);
}
function Ma(e) {
  let t = Da(e.type.schema),
    n = [];
  return (
    e.descendants((e, r) => {
      if (!e.isInline) return !0;
      for (let i of e.marks) {
        let a = i.type === t.insert ? `insert` : i.type === t.delete ? `delete` : null;
        if (!a) continue;
        let o = n[n.length - 1],
          s = e.isText ? e.text : ``;
        o && o.id === i.attrs.id && o.kind === a && o.to === r
          ? ((o.to = r + e.nodeSize), (o.text += s))
          : n.push({
              id: i.attrs.id,
              kind: a,
              author: { id: i.attrs.author, name: i.attrs.name },
              time: Number(i.attrs.time) || 0,
              from: r,
              to: r + e.nodeSize,
              text: s,
            });
      }
      return !1;
    }),
    n
  );
}
function Na(e, t, n) {
  let r = Da(e.schema),
    i = e.tr.setMeta(Sa, !0),
    a = Ma(e.doc).filter((e) => !n || n.includes(e.id));
  for (let e of [...a].sort((e, t) => t.from - e.from))
    (e.kind === `insert`) == (t === `reject`)
      ? i.delete(e.from, e.to)
      : i.removeMark(e.from, e.to, e.kind === `insert` ? r.insert : r.delete);
  return i;
}
function Pa(e) {
  let { from: t } = e.selection;
  return Ma(e.doc).find((e) => t >= e.from && t <= e.to && (e.to > t || e.from < t)) ?? null;
}
function $(e) {
  return Q.getState(e)?.enabled ?? !1;
}
function Fa(e, t) {
  let { state: n, dispatch: r } = e.view;
  (r(n.tr.setMeta(Q, { enabled: t }).setMeta(Sa, !0)), e.updateUI());
}
var Ia = I({
    name: `suggestions`,
    toolbar: `suggestions reviewsuggestions`,
    marks: { suggestion_insert: Ea(`insert`), suggestion_delete: Ea(`delete`) },
    prosemirrorPlugins: (e) => {
      let t = e.options.pluginOptions?.suggestions ?? {},
        n = null;
      return [
        new c({
          key: Q,
          state: {
            init: () => ({ enabled: !!(t.enabled || t.force) }),
            apply(e, n) {
              let r = e.getMeta(Q);
              return r ? { enabled: t.force ? !0 : r.enabled } : n;
            },
          },
          props: {
            attributes: (e) => (Q.getState(e)?.enabled ? { class: `nova-suggesting` } : {}),
            decorations(t) {
              if (n?.doc === t.doc) return n.set;
              let r = P(e, `suggestions`, _a),
                i = new Intl.DateTimeFormat(e.options.language ?? `en`, {
                  dateStyle: `medium`,
                  timeStyle: `short`,
                }),
                a = he.create(
                  t.doc,
                  Ma(t.doc).map((e) =>
                    w.inline(e.from, e.to, {
                      title:
                        (e.kind === `insert` ? r.inserted : r.deleted).replace(
                          `{name}`,
                          e.author.name || r.guest,
                        ) + (e.time ? ` \xB7 ${i.format(e.time)}` : ``),
                      class: e.kind === `insert` ? `nova-sugg-insert` : `nova-sugg-delete`,
                      style: `--nova-suggestion: ${wa(e.author.id || e.author.name)}`,
                    }),
                  ),
                );
              return ((n = { doc: t.doc, set: a }), a);
            },
          },
        }),
        D({ 'Mod-Alt-Shift-e': () => !t.force && (Fa(e, !$(e.view.state)), !0) }),
      ];
    },
    transformTransaction(e, t, n) {
      if (!$(t)) return e;
      let r = n.options.pluginOptions?.suggestions ?? {},
        i = P(n, `suggestions`, _a);
      return ja(e, t, {
        id: ga.test(r.author?.id ?? ``) ? r.author.id : `guest`,
        name: String(r.author?.name || i.guest).slice(0, 80),
      });
    },
    setup(e) {
      let t = e.options.pluginOptions?.suggestions ?? {},
        n = P(e, `suggestions`, _a),
        r = t.canReview !== !1,
        i = (t) => e.view.dispatch(t),
        a = () => Pa(e.view.state),
        s = (t) => {
          let n = a();
          (n && i(Na(e.view.state, t, [n.id])), e.focus());
        },
        c = (t) => {
          let { state: r } = e.view,
            a = Ma(r.doc),
            s = r.selection.from,
            c =
              t === 1
                ? (a.find((e) => e.from > s) ?? a[0])
                : ([...a].reverse().find((e) => e.to < s) ?? a[a.length - 1]);
          c
            ? (i(r.tr.setSelection(o.create(r.doc, c.from)).scrollIntoView()), e.focus())
            : e.ui.notify(n.none);
        };
      (e.ui.registry.addToggleButton(`suggestions`, {
        icon: va,
        tooltip: n.toggle,
        shortcut: `Mod-Alt-Shift-e`,
        isActive: (e) => $(e.view.state),
        isEnabled: () => !t.force,
        onAction: (e) => Fa(e, !$(e.view.state)),
      }),
        e.ui.registry.addMenuButton(`reviewsuggestions`, {
          icon: ya,
          tooltip: n.review,
          isEnabled: () => Ma(e.view.state.doc).length > 0,
          items: () => [
            { id: `next`, label: n.next, onSelect: () => c(1) },
            { id: `previous`, label: n.previous, onSelect: () => c(-1) },
            ...(r
              ? [
                  { type: `separator` },
                  {
                    id: `accept-all`,
                    label: n.acceptAll,
                    onSelect: () => i(Na(e.view.state, `accept`)),
                  },
                  {
                    id: `reject-all`,
                    label: n.rejectAll,
                    onSelect: () => i(Na(e.view.state, `reject`)),
                  },
                ]
              : []),
          ],
        }),
        r &&
          (e.ui.registry.addButton(`acceptsuggestion`, {
            icon: ba,
            text: n.accept,
            tooltip: n.accept,
            onAction: () => s(`accept`),
          }),
          e.ui.registry.addButton(`rejectsuggestion`, {
            icon: xa,
            text: n.reject,
            tooltip: n.reject,
            onAction: () => s(`reject`),
          }),
          e.ui.registry.addContextToolbar(`suggestion`, {
            label: n.toolbar,
            predicate: (e) => Pa(e.view.state) !== null,
            items: `acceptsuggestion rejectsuggestion`,
            position: `selection`,
            placement: `bottom-start`,
            priority: 20,
          })),
        e.ui.registry.addMenuItem(`suggestions`, {
          text: n.toggle,
          icon: va,
          isActive: (e) => $(e.view.state),
          isEnabled: () => !t.force,
          onAction: (e) => Fa(e, !$(e.view.state)),
        }));
    },
  }),
  La =
    /^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#]|$)/i,
  Ra = /^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{1,12})(?:[/?#]|$)/i,
  za = /^https:\/\/[^\s"'<>]+\.(?:mp4|webm|ogv|ogg)(?:\?[^\s"'<>#]*)?$/i;
function Ba(e) {
  if (typeof e != `string`) return null;
  let t = e.trim(),
    n = t.match(La);
  if (n) return { kind: `youtube`, src: `https://www.youtube-nocookie.com/embed/${n[1]}` };
  let r = t.match(Ra);
  return r
    ? { kind: `vimeo`, src: `https://player.vimeo.com/video/${r[1]}` }
    : za.test(t)
      ? { kind: `video`, src: t }
      : null;
}
var Va = O.media,
  Ha = {
    en: {
      title: `Video`,
      url: `Video URL`,
      hint: `YouTube, Vimeo or a link to an .mp4 / .webm file`,
      name: `Title (for screen readers)`,
      invalid: `This video address is not supported`,
      save: `Insert`,
    },
    ru: {
      title: `Видео`,
      url: `Адрес видео`,
      hint: `YouTube, Vimeo или ссылка на файл .mp4 / .webm`,
      name: `Название (для экранного диктора)`,
      invalid: `Этот адрес видео не поддерживается`,
      save: `Вставить`,
    },
  };
function Ua(e, t) {
  let n = t ? Ba(t) : null;
  return n
    ? {
        ...n,
        width: E(e.getAttribute(`width`)) ?? 560,
        height: E(e.getAttribute(`height`)) ?? 315,
        title: e.getAttribute(`title`) ?? ``,
      }
    : !1;
}
function Wa(e) {
  let t = Ba(e.attrs.src);
  if (!t) return null;
  let n = String(E(e.attrs.width) ?? 560),
    r = String(E(e.attrs.height) ?? 315);
  return t.kind === `video`
    ? A(`video`, { src: t.src, controls: !0, width: n, height: r, preload: `metadata` })
    : A(`iframe`, {
        src: t.src,
        width: n,
        height: r,
        title: e.attrs.title || `Video`,
        allow: `accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen`,
        allowfullscreen: !0,
        loading: `lazy`,
        referrerpolicy: `strict-origin-when-cross-origin`,
      });
}
var Ga = I({
    name: `media`,
    toolbar: `media`,
    nodes: {
      media: {
        group: `block`,
        atom: !0,
        selectable: !0,
        draggable: !0,
        attrs: {
          kind: { default: `youtube` },
          src: {},
          width: { default: 560 },
          height: { default: 315 },
          title: { default: `` },
        },
        parseDOM: [
          { tag: `iframe[src]`, getAttrs: (e) => Ua(e, e.getAttribute(`src`)) },
          {
            tag: `video`,
            getAttrs: (e) => {
              let t = e;
              return Ua(
                t,
                t.getAttribute(`src`) ??
                  t.querySelector(`source[src]`)?.getAttribute(`src`) ??
                  null,
              );
            },
          },
        ],
        toDOM: (e) => {
          let t = Ba(e.attrs.src),
            n = String(E(e.attrs.width) ?? 560),
            r = String(E(e.attrs.height) ?? 315);
          return t
            ? t.kind === `video`
              ? [`video`, { src: t.src, controls: ``, width: n, height: r }]
              : [
                  `iframe`,
                  {
                    src: t.src,
                    width: n,
                    height: r,
                    title: e.attrs.title || null,
                    allow: `accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen`,
                    allowfullscreen: ``,
                    loading: `lazy`,
                    referrerpolicy: `strict-origin-when-cross-origin`,
                  },
                ]
            : [`p`];
        },
      },
    },
    prosemirrorPlugins: () => [
      new c({
        props: {
          nodeViews: {
            media: (e) => {
              let t = Wa(e);
              return {
                dom: A(
                  `div`,
                  { className: `nova-media`, contenteditable: `false` },
                  t,
                  A(`div`, { className: `nova-media-overlay`, 'aria-hidden': `true` }),
                ),
                ignoreMutation: () => !0,
                stopEvent: () => !1,
              };
            },
          },
        },
      }),
    ],
    setup(e) {
      let t = P(e, `media`, Ha),
        n = () => {
          let { selection: t } = e.view.state;
          return t instanceof p && t.node.type.name === `media` ? t : null;
        },
        r = () => {
          let r = n(),
            i = j({
              label: t.url,
              type: `url`,
              placeholder: `https://`,
              hint: t.hint,
              value: r?.node.attrs.src ?? ``,
            }),
            a = j({ label: t.name, value: r?.node.attrs.title ?? `` });
          (Be(e, i, `media`, (e) => {
            e.title && (a.input.value = e.title);
          }),
            e.ui.openDialog({
              title: t.title,
              body: A(`div`, { className: `nova-form` }, i.el, a.el),
              submitLabel: t.save,
              onSubmit: () => {
                let r = Ba(i.input.value);
                if (!r) return t.invalid;
                let { state: o, dispatch: s } = e.view,
                  c = { ...r, title: a.input.value.trim() },
                  l = n();
                return (
                  s(
                    l
                      ? o.tr.setNodeMarkup(l.from, void 0, { ...l.node.attrs, ...c })
                      : o.tr.replaceSelectionWith(e.schema.nodes.media.create(c)).scrollIntoView(),
                  ),
                  !0
                );
              },
            }));
        };
      (e.ui.registry.addToggleButton(`media`, {
        icon: Va,
        tooltip: t.title,
        isActive: () => n() !== null,
        isEnabled: (e) => e.isEditable(),
        onAction: r,
      }),
        e.ui.registry.addMenuItem(`media`, { text: t.title, icon: Va, onAction: r }));
    },
  }),
  Ka = O.pageBreak,
  qa = { en: { title: `Page break` }, ru: { title: `Разрыв страницы` } },
  Ja = I({
    name: `pagebreak`,
    toolbar: `pagebreak`,
    nodes: {
      pagebreak: {
        group: `block`,
        atom: !0,
        selectable: !0,
        parseDOM: [
          { tag: `div.nova-pagebreak` },
          {
            tag: `div`,
            getAttrs: (e) => {
              let t = e;
              return (
                (t.style.breakAfter === `page` || t.style.pageBreakAfter === `always`) &&
                !t.textContent?.trim() &&
                null
              );
            },
          },
        ],
        toDOM: () => [`div`, { class: `nova-pagebreak`, style: `break-after: page;` }],
      },
    },
    setup(e) {
      let { title: t } = P(e, `pagebreak`, qa),
        n = () => {
          let { state: t, dispatch: n } = e.view,
            r = e.schema.nodes.pagebreak;
          (n(t.tr.replaceSelectionWith(r.create()).scrollIntoView()), e.focus());
        };
      (e.ui.registry.addButton(`pagebreak`, {
        icon: Ka,
        tooltip: t,
        isEnabled: (e) => e.isEditable(),
        onAction: n,
      }),
        e.ui.registry.addMenuItem(`pagebreak`, { text: t, icon: Ka, onAction: n }));
    },
  });
(F(`insertdatetime`, () =>
  L(() => import(`./insertdatetime-LKTWT7MA.C-BbRcTe.js`), __vite__mapDeps([2, 3, 1, 4, 5])),
),
  F(`quickbars`, () =>
    L(
      () => import(`./quickbars-PVI52W5H.rPziGAm7.js`),
      __vite__mapDeps([6, 7, 8, 9, 10, 11, 4, 1, 5]),
    ),
  ),
  F(`charmap`, () =>
    L(() => import(`./charmap-55GPGFWU.Cv0x_EtD.js`), __vite__mapDeps([12, 3, 1, 4, 5])),
  ),
  F(`emoticons`, () =>
    L(() => import(`./emoticons-VEII2TBC.CHGrHtvg.js`), __vite__mapDeps([13, 3, 1, 4, 5])),
  ),
  F(`nonbreaking`, () =>
    L(
      () => import(`./nonbreaking-Y2DLPICJ.BQNFVfoW.js`),
      __vite__mapDeps([14, 3, 1, 4, 5, 11, 10]),
    ),
  ),
  F(`autolink`, () =>
    L(() => import(`./autolink-HEW6PESF.3H9qPow3.js`), __vite__mapDeps([15, 9, 10, 5])),
  ),
  F(`autosave`, () =>
    L(() => import(`./autosave-M6X4HMFR.DSzdL2hD.js`), __vite__mapDeps([16, 3, 1, 4, 5])),
  ),
  F(`autoresize`, () =>
    L(() => import(`./autoresize-UB3GOA6D.lrs5nFnM.js`), __vite__mapDeps([17, 5])),
  ),
  F(`visualblocks`, () =>
    L(() => import(`./visualblocks-R5HS5B72.DW0PuACa.js`), __vite__mapDeps([18, 3, 1, 4, 5])),
  ),
  F(`anchor`, Vi),
  F(`pagebreak`, Ja),
  F(`media`, Ga),
  F(`comments`, na),
  F(`mentions`, qi),
  F(`mergetags`, ma),
  F(`suggestions`, Ia),
  F(`directionality`, () =>
    L(
      () => import(`./directionality-X7GELLYQ.BVQF7PJK.js`),
      __vite__mapDeps([19, 9, 10, 3, 1, 4, 5]),
    ),
  ),
  F(`advlist`, () =>
    L(() => import(`./advlist-NF44TRHY.BrwsvnFP.js`), __vite__mapDeps([20, 8, 9, 10, 11, 3, 1, 5])),
  ),
  F(`revisionhistory`, () =>
    L(
      () => import(`./revisionhistory-PCXW6IME.CzBejrt9.js`),
      __vite__mapDeps([21, 7, 8, 9, 10, 11, 4, 1, 3, 5]),
    ),
  ));
export { ji as a, U as c, Si as i, z as l, Pi as n, W as o, sr as r, Ai as s, X as t, ct as u };
