import { c as e, l as t } from './chunk-MTSFB6UL.BsO1pwz8.js';
import {
  C as n,
  O as r,
  S as i,
  _ as a,
  a as o,
  c as s,
  i as c,
  k as l,
  m as u,
  o as d,
  r as f,
  s as p,
  t as m,
  w as h,
  x as g,
} from './dist.DtV7jSsK.js';
import { t as _ } from './dist.FSNhl50G.js';
var v = function (e) {
  for (var t = 0; ; t++) if (((e = e.previousSibling), !e)) return t;
};
function y(e) {
  let t = e.assignedSlot || e.parentNode;
  return t && t.nodeType == 11 ? t.host : t;
}
var b = null;
function x(e, t, n) {
  let r = (b ||= document.createRange());
  return (r.setEnd(e, n ?? e.nodeValue.length), r.setStart(e, t || 0), r);
}
function S() {
  b = null;
}
function C(e, t, n, r) {
  return n && (te(e, t, n, r, -1) || te(e, t, n, r, 1));
}
var ee = /^(img|br|input|textarea|hr)$/i;
function te(e, t, n, r, i) {
  for (;;) {
    if (e == n && t == r) return !0;
    if (t == (i < 0 ? 0 : w(e))) {
      let n = e.parentNode;
      if (!n || !T(n) || oe(e) || ee.test(e.nodeName) || e.contentEditable == `false`) return !1;
      ((t = v(e) + (i < 0 ? 0 : 1)), (e = n));
    } else if (T(e)) {
      let n = e.childNodes[t + (i < 0 ? -1 : 0)];
      if (T(n) && n.contentEditable == `false`) {
        if (n.pmViewDesc?.ignoreForSelection) t += i;
        else return !1;
      } else if (oe(n) || ee.test(n.nodeName)) return !1;
      else ((e = n), (t = i < 0 ? w(e) : 0));
    } else return !1;
  }
}
function w(e) {
  return e.nodeType == 3 ? e.nodeValue.length : e.childNodes.length;
}
function T(e) {
  return e.nodeType == 1;
}
function E(e) {
  return e.nodeType == 3;
}
function ne(e, t) {
  return t ? e.contains(T(t) ? t : t.parentNode) : !1;
}
function re(e, t) {
  for (;;) {
    if (E(e) && t) return e;
    if (T(e) && t > 0) {
      if (e.contentEditable == `false`) return null;
      ((e = e.childNodes[t - 1]), (t = w(e)));
    } else if (e.parentNode && !oe(e, !0)) ((t = v(e)), (e = e.parentNode));
    else return null;
  }
}
function ie(e, t) {
  for (;;) {
    if (E(e) && t < e.nodeValue.length) return e;
    if (T(e) && t < e.childNodes.length) {
      if (e.contentEditable == `false`) return null;
      ((e = e.childNodes[t]), (t = 0));
    } else if (e.parentNode && !oe(e, !0)) ((t = v(e) + 1), (e = e.parentNode));
    else return null;
  }
}
function ae(e, t, n) {
  for (let r = t == 0, i = t == w(e); r || i;) {
    if (e == n) return !0;
    let t = v(e);
    if (((e = e.parentNode), !e)) return !1;
    ((r &&= t == 0), (i &&= t == w(e)));
  }
}
function oe(e, t = !1) {
  let n;
  for (let t = e; t && !(n = t.pmViewDesc); t = t.parentNode);
  return n && n.node && (!t || n.node.isBlock) && (n.dom == e || n.contentDOM == e);
}
function se(e) {
  return e.focusNode && C(e.focusNode, e.focusOffset, e.anchorNode, e.anchorOffset);
}
function ce(e, t) {
  (e.collapse(t.anchorNode, t.anchorOffset),
    (t.focusNode != t.anchorNode || t.focusOffset != t.anchorOffset) &&
      e.extend(t.focusNode, t.focusOffset));
}
function le(e, t) {
  let n = document.createEvent(`Event`);
  return (n.initEvent(`keydown`, !0, !0), (n.keyCode = e), (n.key = n.code = t), n);
}
function ue(e) {
  let t = e.activeElement;
  for (; t && t.shadowRoot;) t = t.shadowRoot.activeElement;
  return t;
}
function de(e, t, n) {
  if (e.caretPositionFromPoint)
    try {
      let r = e.caretPositionFromPoint(t, n);
      if (r) return { node: r.offsetNode, offset: Math.min(w(r.offsetNode), r.offset) };
    } catch {}
  if (e.caretRangeFromPoint) {
    let r = e.caretRangeFromPoint(t, n);
    if (r) return { node: r.startContainer, offset: Math.min(w(r.startContainer), r.startOffset) };
  }
}
var D = typeof navigator < `u` ? navigator : null,
  fe = typeof document < `u` ? document : null,
  pe = (D && D.userAgent) || ``,
  O = /gecko\/(\d+)/i.test(pe) && !/edge?\//i.test(pe);
O && +(/Firefox\/(\d+)/.exec(pe) || [0, 0])[1];
var me = /Chrome\/(\d+)/.exec(pe),
  k = !!me,
  he = me ? +me[1] : 0,
  A = !!D && /Apple Computer/.test(D.vendor),
  ge = A && (/Mobile\/\w+/.test(pe) || (!!D && D.maxTouchPoints > 2)),
  j = ge || (D ? /Mac/.test(D.platform) : !1),
  _e = D ? /Win/.test(D.platform) : !1,
  M = /Android \d/.test(pe),
  ve = !!fe && `webkitFontSmoothing` in fe.documentElement.style,
  ye = ve ? +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1] : 0;
function be(e) {
  let t = e.defaultView && e.defaultView.visualViewport;
  return t
    ? { left: 0, right: t.width, top: 0, bottom: t.height }
    : {
        left: 0,
        right: e.documentElement.clientWidth,
        top: 0,
        bottom: e.documentElement.clientHeight,
      };
}
function N(e, t) {
  return typeof e == `number` ? e : e[t];
}
function xe(e) {
  let t = e.getBoundingClientRect(),
    n = t.width / e.offsetWidth || 1,
    r = t.height / e.offsetHeight || 1;
  return {
    left: t.left,
    right: t.left + e.clientWidth * n,
    top: t.top,
    bottom: t.top + e.clientHeight * r,
  };
}
function Se(e, t, n) {
  if (!Le(t) && t.left == 0) return;
  let r = e.someProp(`scrollThreshold`) || 0,
    i = e.someProp(`scrollMargin`) || 5,
    a = e.dom.ownerDocument;
  for (let o = n || e.dom; o;) {
    if (!T(o)) {
      o = y(o);
      continue;
    }
    let e = o == a.body,
      n = e ? be(a) : xe(o),
      s = 0,
      c = 0;
    if (
      (t.top < n.top + N(r, `top`)
        ? (c = -(n.top - t.top + N(i, `top`)))
        : t.bottom > n.bottom - N(r, `bottom`) &&
          (c =
            t.bottom - t.top > n.bottom - n.top
              ? t.top + N(i, `top`) - n.top
              : t.bottom - n.bottom + N(i, `bottom`)),
      t.left < n.left + N(r, `left`)
        ? (s = -(n.left - t.left + N(i, `left`)))
        : t.right > n.right - N(r, `right`) && (s = t.right - n.right + N(i, `right`)),
      s || c)
    ) {
      if (e) a.defaultView.scrollBy(s, c);
      else {
        let e = o.scrollLeft,
          n = o.scrollTop;
        (c && (o.scrollTop += c), s && (o.scrollLeft += s));
        let r = o.scrollLeft - e,
          i = o.scrollTop - n;
        t = { left: t.left - r, top: t.top - i, right: t.right - r, bottom: t.bottom - i };
      }
    }
    let l = e ? `fixed` : getComputedStyle(o).position;
    if (/^(fixed|sticky)$/.test(l)) break;
    o = l == `absolute` ? o.offsetParent : y(o);
  }
}
function Ce(e) {
  let t = e.dom.getBoundingClientRect(),
    n = Math.max(0, t.top),
    r,
    i;
  for (let a = (t.left + t.right) / 2, o = n + 1; o < Math.min(innerHeight, t.bottom); o += 5) {
    let t = e.root.elementFromPoint(a, o);
    if (!t || t == e.dom || !e.dom.contains(t)) continue;
    let s = t.getBoundingClientRect();
    if (s.top >= n - 20) {
      ((r = t), (i = s.top));
      break;
    }
  }
  return { refDOM: r, refTop: i, stack: we(e.dom) };
}
function we(e) {
  let t = [],
    n = e.ownerDocument;
  for (
    let r = e;
    r && (t.push({ dom: r, top: r.scrollTop, left: r.scrollLeft }), e != n);
    r = y(r)
  );
  return t;
}
function Te({ refDOM: e, refTop: t, stack: n }) {
  let r = e ? e.getBoundingClientRect().top : 0;
  Ee(n, r == 0 ? 0 : r - t);
}
function Ee(e, t) {
  for (let n = 0; n < e.length; n++) {
    let { dom: r, top: i, left: a } = e[n];
    (r.scrollTop != i + t && (r.scrollTop = i + t), r.scrollLeft != a && (r.scrollLeft = a));
  }
}
var De = null;
function Oe(e) {
  if (e.setActive) return e.setActive();
  if (De) return e.focus(De);
  let t = we(e);
  (e.focus(
    De == null
      ? {
          get preventScroll() {
            return ((De = { preventScroll: !0 }), !0);
          },
        }
      : void 0,
  ),
    De || ((De = !1), Ee(t, 0)));
}
function ke(e, t) {
  let n,
    r = 2e8,
    i,
    a = 0,
    o = t.top,
    s = t.top,
    c,
    l;
  for (let u = e.firstChild, d = 0; u; u = u.nextSibling, d++) {
    let e;
    if (T(u)) e = u.getClientRects();
    else if (E(u)) e = x(u).getClientRects();
    else continue;
    for (let f = 0; f < e.length; f++) {
      let p = e[f];
      if (p.top <= o && p.bottom >= s) {
        ((o = Math.max(p.bottom, o)), (s = Math.min(p.top, s)));
        let e = p.left > t.left ? p.left - t.left : p.right < t.left ? t.left - p.right : 0;
        if (e < r) {
          ((n = u),
            (r = e),
            (i = e && E(n) ? { left: p.right < t.left ? p.right : p.left, top: t.top } : t),
            T(u) && e && (a = d + +(t.left >= (p.left + p.right) / 2)));
          continue;
        }
      } else
        p.top > t.top &&
          !c &&
          p.left <= t.left &&
          p.right >= t.left &&
          ((c = u), (l = { left: Math.max(p.left, Math.min(p.right, t.left)), top: p.top }));
      !n &&
        ((t.left >= p.right && t.top >= p.top) || (t.left >= p.left && t.top >= p.bottom)) &&
        (a = d + 1);
    }
  }
  return (
    !n && c && ((n = c), (i = l), (r = 0)),
    n && E(n) ? Ae(n, i) : !n || r ? { node: e, offset: a } : ke(n, i)
  );
}
function Ae(e, t) {
  let n = e.nodeValue.length,
    r = document.createRange(),
    i;
  for (let a = 0; a < n; a++) {
    (r.setEnd(e, a + 1), r.setStart(e, a));
    let n = P(r, 1);
    if (n.top != n.bottom && je(t, n)) {
      i = { node: e, offset: a + +(t.left >= (n.left + n.right) / 2) };
      break;
    }
  }
  return (r.detach(), i || { node: e, offset: 0 });
}
function je(e, t) {
  return (
    e.left >= t.left - 1 && e.left <= t.right + 1 && e.top >= t.top - 1 && e.top <= t.bottom + 1
  );
}
function Me(e, t) {
  let n = e.parentNode;
  return n && /^li$/i.test(n.nodeName) && t.left < e.getBoundingClientRect().left ? n : e;
}
function Ne(e, t, n) {
  let { node: r, offset: i } = ke(t, n),
    a = -1;
  if (T(r) && !r.firstChild) {
    let e = r.getBoundingClientRect();
    a = e.left != e.right && n.left > (e.left + e.right) / 2 ? 1 : -1;
  }
  return e.docView.posFromDOM(r, i, a);
}
function Pe(e, t, n, r) {
  let i = -1;
  for (let n = t, a = !1; n != e.dom;) {
    let t = e.docView.nearestDesc(n, !0),
      o;
    if (!t) return null;
    if (
      T(t.dom) &&
      ((t.node.isBlock && t.parent) || !t.contentDOM) &&
      ((o = t.dom.getBoundingClientRect()).width || o.height) &&
      (t.node.isBlock &&
        t.parent &&
        !/^T(R|BODY|HEAD|FOOT)$/.test(t.dom.nodeName) &&
        ((!a && o.left > r.left) || o.top > r.top
          ? (i = t.posBefore)
          : ((!a && o.right < r.left) || o.bottom < r.top) && (i = t.posAfter),
        (a = !0)),
      !t.contentDOM && i < 0 && !t.node.isText)
    )
      return (t.node.isBlock ? r.top < (o.top + o.bottom) / 2 : r.left < (o.left + o.right) / 2)
        ? t.posBefore
        : t.posAfter;
    n = t.dom.parentNode;
  }
  return i > -1 ? i : e.docView.posFromDOM(t, n, -1);
}
function Fe(e, t, n) {
  let r = e.childNodes.length;
  if (r && n.top < n.bottom)
    for (
      let i = Math.max(
          0,
          Math.min(r - 1, Math.floor((r * (t.top - n.top)) / (n.bottom - n.top)) - 2),
        ),
        a = i;
      ;
    ) {
      let n = e.childNodes[a];
      if (T(n)) {
        let e = n.getClientRects();
        for (let r = 0; r < e.length; r++) {
          let i = e[r];
          if (je(t, i)) return Fe(n, t, i);
        }
      }
      if ((a = (a + 1) % r) == i) break;
    }
  return e;
}
function Ie(e, t) {
  let n = e.dom.ownerDocument,
    r,
    i = 0,
    a = de(n, t.left, t.top);
  a && ({ node: r, offset: i } = a);
  let o = (e.root.elementFromPoint ? e.root : n).elementFromPoint(t.left, t.top),
    s;
  if (!o || !e.dom.contains(o)) {
    let n = e.dom.getBoundingClientRect();
    if (!je(t, n) || ((o = Fe(e.dom, t, n)), !o)) return null;
  }
  if (A) for (let e = o; r && e; e = y(e)) e.draggable && (r = void 0);
  if (((o = Me(o, t)), r)) {
    if (O && T(r) && ((i = Math.min(i, r.childNodes.length)), i < r.childNodes.length)) {
      let e = r.childNodes[i],
        n;
      e.nodeName == `IMG` &&
        (n = e.getBoundingClientRect()).right <= t.left &&
        n.bottom > t.top &&
        i++;
    }
    let n;
    (ve &&
      i &&
      T(r) &&
      T((n = r.childNodes[i - 1])) &&
      n.contentEditable == `false` &&
      n.getBoundingClientRect().top >= t.top &&
      i--,
      r == e.dom &&
      i == r.childNodes.length - 1 &&
      T(r.lastChild) &&
      t.top > r.lastChild.getBoundingClientRect().bottom
        ? (s = e.state.doc.content.size)
        : (i != 0 && T(r) && r.childNodes[i - 1].nodeName == `BR`) || (s = Pe(e, r, i, t)));
  }
  s ??= Ne(e, o, t);
  let c = e.docView.nearestDesc(o, !0);
  return { pos: s, inside: c ? c.posAtStart - c.border : -1 };
}
function Le(e) {
  return e.top < e.bottom || e.left < e.right;
}
function P(e, t) {
  let n = e.getClientRects();
  if (n.length) {
    let e = n[t < 0 ? 0 : n.length - 1];
    if (Le(e)) return e;
  }
  return Array.prototype.find.call(n, Le) || e.getBoundingClientRect();
}
var Re = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
function ze(e, t, n) {
  let { node: r, offset: i, atom: a } = e.docView.domFromPos(t, n < 0 ? -1 : 1),
    o = ve || O;
  if (E(r)) {
    if (o && (Re.test(r.nodeValue) || (n < 0 ? !i : i == r.nodeValue.length))) {
      let e = P(x(r, i, i), n);
      if (O && i && /\s/.test(r.nodeValue[i - 1]) && i < r.nodeValue.length) {
        let t = P(x(r, i - 1, i - 1), -1);
        if (t.top == e.top) {
          let n = P(x(r, i, i + 1), -1);
          if (n.top != e.top) return Be(n, n.left < t.left);
        }
      }
      return e;
    }
    {
      let e = i,
        t = i,
        a = n < 0 ? 1 : -1;
      return (
        n < 0 && !i
          ? (t++, (a = -1))
          : n >= 0 && i == r.nodeValue.length
            ? (e--, (a = 1))
            : n < 0
              ? e--
              : t++,
        Be(P(x(r, e, t), a), a < 0)
      );
    }
  }
  if (!e.state.doc.resolve(t - (a || 0)).parent.inlineContent) {
    if (a == null && i && (n < 0 || i == w(r))) {
      let e = r.childNodes[i - 1];
      if (T(e)) return Ve(e.getBoundingClientRect(), !1);
    }
    if (a == null && i < w(r)) {
      let e = r.childNodes[i];
      if (T(e)) return Ve(e.getBoundingClientRect(), !0);
    }
    return Ve(r.getBoundingClientRect(), n >= 0);
  }
  if (a == null && i && (n < 0 || i == w(r))) {
    let e = r.childNodes[i - 1],
      t = E(e) ? x(e, w(e) - +!o) : T(e) && (e.nodeName != `BR` || !e.nextSibling) ? e : null;
    if (t) return Be(P(t, 1), !1);
  }
  if (a == null && i < w(r)) {
    let e = r.childNodes[i];
    for (; e.pmViewDesc && e.pmViewDesc.ignoreForCoords;) e = e.nextSibling;
    let t = e ? (E(e) ? x(e, 0, +!o) : T(e) ? e : null) : null;
    if (t) return Be(P(t, -1), !0);
  }
  return Be(P(E(r) ? x(r) : r, -n), n >= 0);
}
function Be(e, t) {
  if (e.width == 0) return e;
  let n = t ? e.left : e.right;
  return { top: e.top, bottom: e.bottom, left: n, right: n };
}
function Ve(e, t) {
  if (e.height == 0) return e;
  let n = t ? e.top : e.bottom;
  return { top: n, bottom: n, left: e.left, right: e.right };
}
function He(e, t, n) {
  let r = e.state,
    i = e.root.activeElement;
  (r != t && e.updateState(t), i != e.dom && e.focus());
  try {
    return n();
  } finally {
    (r != t && e.updateState(r), i != e.dom && i && i.focus());
  }
}
function Ue(e, t, n) {
  let r = t.selection,
    i = n == `up` ? r.$from : r.$to;
  return He(e, t, () => {
    let { node: t } = e.docView.domFromPos(i.pos, n == `up` ? -1 : 1);
    for (;;) {
      let n = e.docView.nearestDesc(t, !0);
      if (!n) break;
      if (n.node.isBlock) {
        t = n.contentDOM || n.dom;
        break;
      }
      t = n.dom.parentNode;
    }
    let r = ze(e, i.pos, 1);
    for (let e = t.firstChild; e; e = e.nextSibling) {
      let t;
      if (T(e)) t = e.getClientRects();
      else if (E(e)) t = x(e, 0, e.nodeValue.length).getClientRects();
      else continue;
      for (let e = 0; e < t.length; e++) {
        let i = t[e];
        if (
          i.bottom > i.top + 1 &&
          (n == `up`
            ? r.top - i.top > (i.bottom - r.top) * 2
            : i.bottom - r.bottom > (r.bottom - i.top) * 2)
        )
          return !1;
      }
    }
    return !0;
  });
}
var We = /[\u0590-\u08ac]/;
function Ge(e, t, n) {
  let { $head: r } = t.selection;
  if (!r.parent.isTextblock) return !1;
  let i = r.parentOffset,
    a = !i,
    o = i == r.parent.content.size,
    s = e.domSelection();
  return s
    ? !We.test(r.parent.textContent) || !s.modify
      ? n == `left` || n == `backward`
        ? a
        : o
      : He(e, t, () => {
          let t = e.domSel.readRange(),
            i = s.caretBidiLevel;
          s.modify(`move`, n, `character`);
          let a = r.depth ? e.docView.domAfterPos(r.before()) : e.dom,
            { focusNode: o, focusOffset: c } = e.domSel.readRange(),
            l = (o && !ne(a, o)) || (t.focusNode == o && t.focusOffset == c);
          return (ce(s, t), i != null && (s.caretBidiLevel = i), l);
        })
    : r.pos == r.start() || r.pos == r.end();
}
var Ke = null,
  qe = null,
  Je = !1;
function Ye(e, t, n) {
  return Ke == t && qe == n
    ? Je
    : ((Ke = t), (qe = n), (Je = n == `up` || n == `down` ? Ue(e, t, n) : Ge(e, t, n)));
}
var Xe = class {
    constructor(e, t, n, r) {
      ((this.parent = e),
        (this.children = t),
        (this.dom = n),
        (this.contentDOM = r),
        (this.damage = 0),
        (n.pmViewDesc = this));
    }
    matchesWidget(e) {
      return !1;
    }
    matchesMark(e) {
      return !1;
    }
    matchesNode(e, t, n) {
      return !1;
    }
    matchesHack(e) {
      return !1;
    }
    parseRule(e) {
      return null;
    }
    stopEvent(e) {
      return !1;
    }
    get size() {
      let e = 0;
      for (let t = 0; t < this.children.length; t++) e += this.children[t].size;
      return e;
    }
    get border() {
      return 0;
    }
    destroy() {
      ((this.parent = void 0), this.dom.pmViewDesc == this && (this.dom.pmViewDesc = void 0));
      for (let e = 0; e < this.children.length; e++) this.children[e].destroy();
    }
    posBeforeChild(e) {
      for (let t = 0, n = this.posAtStart; ; t++) {
        let r = this.children[t];
        if (r == e) return n;
        n += r.size;
      }
    }
    get posBefore() {
      return this.parent.posBeforeChild(this);
    }
    get posAtStart() {
      return this.parent ? this.parent.posBeforeChild(this) + this.border : 0;
    }
    get posAfter() {
      return this.posBefore + this.size;
    }
    get posAtEnd() {
      return this.posAtStart + this.size - 2 * this.border;
    }
    localPosFromDOM(e, t, n) {
      if (this.contentDOM && ne(this.contentDOM, e)) {
        if (n < 0) {
          let n, r;
          if (e == this.contentDOM) n = e.childNodes[t - 1];
          else {
            for (; e.parentNode != this.contentDOM;) e = e.parentNode;
            n = e.previousSibling;
          }
          for (; n && !((r = n.pmViewDesc) && r.parent == this);) n = n.previousSibling;
          return n ? this.posBeforeChild(r) + r.size : this.posAtStart;
        }
        {
          let n, r;
          if (e == this.contentDOM) n = e.childNodes[t];
          else {
            for (; e.parentNode != this.contentDOM;) e = e.parentNode;
            n = e.nextSibling;
          }
          for (; n && !((r = n.pmViewDesc) && r.parent == this);) n = n.nextSibling;
          return n ? this.posBeforeChild(r) : this.posAtEnd;
        }
      }
      let r;
      if (e == this.dom && this.contentDOM) r = t > v(this.contentDOM);
      else if (
        this.contentDOM &&
        this.contentDOM != this.dom &&
        this.dom.contains(this.contentDOM)
      ) {
        let n = e.compareDocumentPosition(this.contentDOM);
        r =
          n & 16
            ? t > Array.from(e.childNodes).findIndex((e) => e.contains(this.contentDOM))
            : !(n & 4);
      } else if (this.dom.firstChild) {
        if (t == 0)
          for (let t = e; ; t = t.parentNode) {
            if (t == this.dom) {
              r = !1;
              break;
            }
            if (t.previousSibling) break;
          }
        if (r == null && t == e.childNodes.length)
          for (let t = e; ; t = t.parentNode) {
            if (t == this.dom) {
              r = !0;
              break;
            }
            if (t.nextSibling) break;
          }
      }
      return (r ?? n > 0) ? this.posAtEnd : this.posAtStart;
    }
    nearestDesc(e, t = !1) {
      for (let n = !0, r = e; r; r = r.parentNode) {
        let i = this.getDesc(r),
          a;
        if (i && (!t || i.node)) {
          if (n && (a = i.nodeDOM) && !(T(a) ? ne(a, e) : a == e)) n = !1;
          else return i;
        }
      }
    }
    getDesc(e) {
      let t = e.pmViewDesc;
      for (let e = t; e; e = e.parent) if (e == this) return t;
    }
    posFromDOM(e, t, n) {
      for (let r = e; r; r = r.parentNode) {
        let i = this.getDesc(r);
        if (i) return i.localPosFromDOM(e, t, n);
      }
      return -1;
    }
    descAt(e) {
      for (let t = 0, n = 0; t < this.children.length; t++) {
        let r = this.children[t],
          i = n + r.size;
        if (n == e && i != n) {
          for (; !r.border && r.children.length;)
            for (let e = 0; e < r.children.length; e++) {
              let t = r.children[e];
              if (t.size) {
                r = t;
                break;
              }
            }
          return r;
        }
        if (e < i) return r.descAt(e - n - r.border);
        n = i;
      }
    }
    domFromPos(e, t) {
      if (!this.contentDOM) return { node: this.dom, offset: 0, atom: e + 1 };
      let n = 0,
        r = 0;
      for (let t = 0; n < this.children.length; n++) {
        let i = this.children[n],
          a = t + i.size;
        if (a > e) {
          r = e - t;
          break;
        }
        t = a;
      }
      if (r) return this.children[n].domFromPos(r - this.children[n].border, t);
      for (; n > 0; n--) {
        let e = this.children[n - 1];
        if (e.size || !(e instanceof rt || (e instanceof Ze && e.side >= 0))) break;
      }
      if (t <= 0) {
        let e,
          r = !0;
        for (
          ;
          (e = n ? this.children[n - 1] : null), e && e.dom.parentNode != this.contentDOM;
          n--, r = !1
        );
        return e && t && r && !e.border && !e.domAtom
          ? e.domFromPos(e.size, t)
          : { node: this.contentDOM, offset: e ? v(e.dom) + 1 : 0 };
      }
      {
        let e,
          r = !0;
        for (
          ;
          (e = n < this.children.length ? this.children[n] : null),
            e && e.dom.parentNode != this.contentDOM;
          n++, r = !1
        );
        return e && r && !e.border && !e.domAtom
          ? e.domFromPos(0, t)
          : { node: this.contentDOM, offset: e ? v(e.dom) : this.contentDOM.childNodes.length };
      }
    }
    parseRange(e, t, n = 0) {
      if (this.children.length == 0)
        return {
          node: this.contentDOM,
          from: e,
          to: t,
          fromOffset: 0,
          toOffset: this.contentDOM.childNodes.length,
        };
      let r = -1,
        i = -1;
      for (let a = n, o = 0; ; o++) {
        let n = this.children[o],
          s = a + n.size;
        if (r == -1 && e <= s) {
          let i = a + n.border;
          if (
            e >= i &&
            t <= s - n.border &&
            n.node &&
            n.contentDOM &&
            this.contentDOM.contains(n.contentDOM)
          )
            return n.parseRange(e, t, i);
          e = a;
          for (let t = o; t > 0; t--) {
            let n = this.children[t - 1];
            if (n.size && n.dom.parentNode == this.contentDOM && !n.emptyChildAt(1)) {
              r = v(n.dom) + 1;
              break;
            }
            e -= n.size;
          }
          r == -1 && (r = 0);
        }
        if (r > -1 && (s > t || o == this.children.length - 1)) {
          t = s;
          for (let e = o + 1; e < this.children.length; e++) {
            let n = this.children[e];
            if (n.size && n.dom.parentNode == this.contentDOM && !n.emptyChildAt(-1)) {
              i = v(n.dom);
              break;
            }
            t += n.size;
          }
          i == -1 && (i = this.contentDOM.childNodes.length);
          break;
        }
        a = s;
      }
      return { node: this.contentDOM, from: e, to: t, fromOffset: r, toOffset: i };
    }
    emptyChildAt(e) {
      if (this.border || !this.contentDOM || !this.children.length) return !1;
      let t = this.children[e < 0 ? 0 : this.children.length - 1];
      return t.size == 0 || t.emptyChildAt(e);
    }
    domAfterPos(e) {
      let { node: t, offset: n } = this.domFromPos(e, 0);
      if (!T(t) || n == t.childNodes.length) throw RangeError(`No node after pos ` + e);
      return t.childNodes[n];
    }
    ignoreMutation(e) {
      return !this.contentDOM && e.type != `selection`;
    }
    get contentLost() {
      return this.contentDOM && this.contentDOM != this.dom && !this.dom.contains(this.contentDOM);
    }
    markDamage(e) {
      e && ((this.damage |= e), this.markParentDamage());
    }
    markParentDamage() {
      for (let e = this; ;) {
        let { parent: t } = e;
        if (!t || t.damage & 1) break;
        ((t.damage |= 1), (e = t));
      }
    }
    get domAtom() {
      return !1;
    }
    get ignoreForCoords() {
      return !1;
    }
    get ignoreForSelection() {
      return !1;
    }
    isText(e) {
      return !1;
    }
  },
  Ze = class extends Xe {
    constructor(e, t, n, r) {
      let i,
        a = t.type.toDOM;
      if (
        (typeof a == `function` &&
          (a = a(n, () => {
            if (!i) return r;
            if (i.parent) return i.parent.posBeforeChild(i);
          })),
        !t.type.spec.raw)
      ) {
        let e = T(a) ? a : document.createElement(`span`);
        (e != a && (e.appendChild(a), (a = e)),
          e.hasAttribute(`contenteditable`) || (e.contentEditable = `false`),
          e.classList.add(`ProseMirror-widget`));
      }
      (super(e, [], a, null), (this.widget = t), (this.widget = t), (i = this));
    }
    matchesWidget(e) {
      return !this.damage && e.type.eq(this.widget.type);
    }
    parseRule() {
      return { ignore: !0 };
    }
    stopEvent(e) {
      let t = this.widget.spec.stopEvent;
      return t ? t(e) : !1;
    }
    ignoreMutation(e) {
      return e.type != `selection` || this.widget.spec.ignoreSelection;
    }
    destroy() {
      (this.widget.type.destroy(this.dom), super.destroy());
    }
    get domAtom() {
      return !0;
    }
    get ignoreForSelection() {
      return !!this.widget.type.spec.relaxedSide;
    }
    get side() {
      return this.widget.type.side;
    }
  },
  Qe = class extends Xe {
    constructor(e, t, n, r) {
      (super(e, [], t, null), (this.textDOM = n), (this.text = r));
    }
    get size() {
      return this.text.length;
    }
    localPosFromDOM(e, t) {
      return e == this.textDOM ? this.posAtStart + t : this.posAtStart + (t ? this.size : 0);
    }
    domFromPos(e) {
      return { node: this.textDOM, offset: e };
    }
    ignoreMutation(e) {
      return e.type === `characterData` && e.target.nodeValue == e.oldValue;
    }
  },
  $e = class e extends Xe {
    constructor(e, t, n, r, i) {
      (super(e, [], n, r), (this.mark = t), (this.spec = i));
    }
    static create(t, n, r, a) {
      let o = a.nodeViews[n.type.name],
        s = o && o(n, a, r);
      return (
        (s && s.dom) || (s = i.renderSpec(document, n.type.spec.toDOM(n, r), null, n.attrs)),
        new e(t, n, s.dom, s.contentDOM || s.dom, s)
      );
    }
    parseRule() {
      return this.damage & 4 || this.mark.type.spec.reparseInView
        ? null
        : { mark: this.mark.type.name, attrs: this.mark.attrs, contentElement: this.contentDOM };
    }
    matchesMark(e) {
      return !(this.damage & 4) && this.mark.eq(e);
    }
    markDamage(e) {
      var t;
      ((this.damage |= e), (t = this.parent) == null || t.markDamage(2));
    }
    slice(t, n, r) {
      let i = e.create(this.parent, this.mark, !0, r),
        a = this.children,
        o = this.size;
      (n < o && (a = bt(a, n, o, r)), t > 0 && (a = bt(a, 0, t, r)));
      for (let e = 0; e < a.length; e++) a[e].parent = i;
      return ((i.children = a), i);
    }
    ignoreMutation(e) {
      return this.spec.ignoreMutation ? this.spec.ignoreMutation(e) : super.ignoreMutation(e);
    }
    destroy() {
      (this.spec.destroy && this.spec.destroy(), super.destroy());
    }
  },
  et = class e extends Xe {
    constructor(e, t, n, r, i, a, o) {
      (super(e, [], i, a),
        (this.node = t),
        (this.outerDeco = n),
        (this.innerDeco = r),
        (this.nodeDOM = o));
    }
    static create(t, n, r, a, o, s) {
      let c = o.nodeViews[n.type.name],
        l,
        u =
          c &&
          c(
            n,
            o,
            () => {
              if (!l) return s;
              if (l.parent) return l.parent.posBeforeChild(l);
            },
            r,
            a,
          ),
        d = u && u.dom,
        f = u && u.contentDOM;
      if (n.isText) {
        if (!d) d = document.createTextNode(n.text);
        else if (!E(d)) throw RangeError(`Text must be rendered as a DOM text node`);
      } else if (!d) {
        let e = i.renderSpec(document, n.type.spec.toDOM(n), null, n.attrs);
        ({ dom: d, contentDOM: f } = e);
      }
      !f &&
        !n.isText &&
        d.nodeName != `BR` &&
        (d.hasAttribute(`contenteditable`) || (d.contentEditable = `false`),
        n.type.spec.draggable && (d.draggable = !0));
      let p = d;
      return (
        (d = dt(d, r, n)),
        u
          ? (l = new it(t, n, r, a, d, f || null, p, u))
          : n.isText
            ? new nt(t, n, r, a, d, p)
            : new e(t, n, r, a, d, f || null, p)
      );
    }
    parseRule(e) {
      if (this.node.type.spec.reparseInView) return null;
      let t = { node: this.node.type.name, attrs: this.node.attrs };
      if ((this.node.type.whitespace == `pre` && (t.preserveWhitespace = `full`), !this.contentDOM))
        t.getContent = () => this.node.content;
      else if (!this.contentLost) t.contentElement = this.contentDOM;
      else {
        for (let e = this.children.length - 1; e >= 0; e--) {
          let n = this.children[e];
          if (this.dom.contains(n.dom.parentNode)) {
            t.contentElement = n.dom.parentNode;
            break;
          }
        }
        if (!t.contentElement) {
          let r = e && e.find((t) => T(t) && e.indexOf(t.parentNode) < 0 && this.dom.contains(t));
          r ? (t.contentElement = r) : (t.getContent = () => n.empty);
        }
      }
      return t;
    }
    matchesNode(e, t, n) {
      return !this.damage && e.eq(this.node) && ft(t, this.outerDeco) && n.eq(this.innerDeco);
    }
    get size() {
      return this.node.nodeSize;
    }
    get border() {
      return +!this.node.isLeaf;
    }
    updateChildren(e, t) {
      let n = this.node.inlineContent,
        r = t,
        i = e.composing ? this.localCompositionInfo(e, t) : null,
        a = i && i.pos > -1 ? i : null,
        o = i && i.pos < 0,
        s = new mt(this, a && a.node, e),
        c = this.node.inlineContent,
        l = c && this.node.isBlock;
      (_t(
        this.node,
        this.innerDeco,
        (t, i, a) => {
          (t.spec.marks
            ? s.syncToMarks(t.spec.marks, n, e, i)
            : t.type.side >= 0 &&
              !a &&
              s.syncToMarks(i == this.node.childCount ? h.none : this.node.child(i).marks, n, e, i),
            s.placeWidget(t, e, r));
        },
        (t, a, u, d) => {
          (s.syncToMarks(t.marks, n, e, d),
            l && t.isAtom && !t.isText && s.addHackNode(`IMG`, s.top));
          let f;
          (s.findNodeMatch(t, a, u, d) ||
            (o &&
              e.state.selection.from > r &&
              e.state.selection.to < r + t.nodeSize &&
              (f = s.findIndexWithChild(i.node)) > -1 &&
              s.updateNodeAt(t, a, u, f, e, r)) ||
            s.updateNextNode(t, a, u, e, d, r) ||
            s.addNode(t, a, u, e, r),
            (r += t.nodeSize),
            c && (l = t.isAtom && !t.isText));
        },
      ),
        s.syncToMarks([], n, e, 0),
        this.node.isTextblock && s.addTextblockHacks(),
        s.destroyRest(),
        (s.changed || this.damage & 2) &&
          (a && this.protectLocalComposition(e, a),
          at(this.contentDOM, this.children, e),
          ge && vt(this.dom)));
    }
    localCompositionInfo(e, t) {
      let { from: n, to: r } = e.state.selection;
      if (!(e.state.selection instanceof s) || n < t || r > t + this.node.content.size) return null;
      let i = e.input.compositionNode;
      if (!i || !this.dom.contains(i.parentNode)) return null;
      if (this.node.inlineContent) {
        let e = i.nodeValue,
          a = yt(this.node.content, e, n - t, r - t);
        return a < 0 ? null : { node: i, pos: a, text: e };
      }
      return { node: i, pos: -1, text: `` };
    }
    protectLocalComposition(e, { node: t, pos: n, text: r }) {
      if (this.getDesc(t)) return;
      let i = t;
      for (; i.parentNode != this.contentDOM; i = i.parentNode) {
        for (; i.previousSibling;) i.parentNode.removeChild(i.previousSibling);
        for (; i.nextSibling;) i.parentNode.removeChild(i.nextSibling);
        i.pmViewDesc && (i.pmViewDesc = void 0);
      }
      let a = new Qe(this, i, t, r);
      (e.input.compositionNodes.push(a),
        (this.children = bt(this.children, n, n + r.length, e, a)));
    }
    update(e, t, n, r, i) {
      return this.damage & 4 || !e.sameMarkup(this.node)
        ? !1
        : (this.updateInner(e, t, n, r, i), !0);
    }
    updateInner(e, t, n, r, i) {
      (this.updateOuterDeco(t),
        (this.node = e),
        (this.innerDeco = n),
        this.contentDOM && this.updateChildren(r, i + 1),
        (this.damage = 0));
    }
    updateOuterDeco(e) {
      if (ft(e, this.outerDeco)) return;
      let t = !T(this.nodeDOM),
        n = this.dom;
      ((this.dom = lt(
        this.dom,
        this.nodeDOM,
        ct(this.outerDeco, this.node, t),
        ct(e, this.node, t),
      )),
        this.dom != n && ((n.pmViewDesc = void 0), (this.dom.pmViewDesc = this)),
        (this.outerDeco = e));
    }
    selectNode() {
      T(this.nodeDOM) &&
        (this.nodeDOM.classList.add(`ProseMirror-selectednode`),
        (this.contentDOM || !this.node.type.spec.draggable) && (this.nodeDOM.draggable = !0));
    }
    deselectNode() {
      T(this.nodeDOM) &&
        (this.nodeDOM.classList.remove(`ProseMirror-selectednode`),
        (this.contentDOM || !this.node.type.spec.draggable) &&
          this.nodeDOM.removeAttribute(`draggable`));
    }
    get domAtom() {
      return this.node.isAtom;
    }
  };
function tt(e, t, n, r, i, a) {
  a ? lt(r, r, ct(a, e, !1), ct(t, e, !1)) : dt(r, t, e);
  let o = new et(void 0, e, t, n, r, r, r);
  return (o.contentDOM && o.updateChildren(i, 0), o);
}
var nt = class e extends et {
    constructor(e, t, n, r, i, a) {
      super(e, t, n, r, i, null, a);
    }
    parseRule() {
      let e = this.nodeDOM.parentNode;
      for (; e && e != this.dom && !e.pmIsDeco;) e = e.parentNode;
      return { skip: e || !0 };
    }
    update(e, t, n, r) {
      return this.damage & 4 || (this.damage && !this.inParent()) || !e.sameMarkup(this.node)
        ? !1
        : (this.updateOuterDeco(t),
          (this.damage & 8 || e.text != this.node.text) &&
            e.text != this.nodeDOM.nodeValue &&
            ((this.nodeDOM.nodeValue = e.text),
            r.trackWrites == this.nodeDOM && (r.trackWrites = null)),
          (this.node = e),
          (this.damage = 0),
          !0);
    }
    inParent() {
      let e = this.parent.contentDOM;
      for (let t = this.nodeDOM; t; t = t.parentNode) if (t == e) return !0;
      return !1;
    }
    domFromPos(e) {
      return { node: this.nodeDOM, offset: e };
    }
    localPosFromDOM(e, t, n) {
      return e == this.nodeDOM
        ? this.posAtStart + Math.min(t, this.node.text.length)
        : super.localPosFromDOM(e, t, n);
    }
    ignoreMutation(e) {
      return !1;
    }
    slice(t, n, r) {
      let i = this.node.cut(t, n),
        a = document.createTextNode(i.text);
      return new e(this.parent, i, this.outerDeco, this.innerDeco, a, a);
    }
    get domAtom() {
      return !1;
    }
    isText(e) {
      return this.node.text == e;
    }
  },
  rt = class extends Xe {
    parseRule() {
      return { ignore: !0 };
    }
    matchesHack(e) {
      return !this.damage && this.dom.nodeName == e;
    }
    get domAtom() {
      return !0;
    }
    get ignoreForCoords() {
      return this.dom.nodeName == `IMG`;
    }
  },
  it = class extends et {
    constructor(e, t, n, r, i, a, o, s) {
      (super(e, t, n, r, i, a, o), (this.spec = s));
    }
    update(e, t, n, r, i) {
      if (this.damage & 4) return !1;
      if (this.spec.update && (this.node.type == e.type || this.spec.multiType)) {
        let a = this.spec.update(e, t, n);
        return (a && this.updateInner(e, t, n, r, i), a);
      }
      return !this.contentDOM && !e.isLeaf ? !1 : super.update(e, t, n, r, i);
    }
    selectNode() {
      this.spec.selectNode ? this.spec.selectNode() : super.selectNode();
    }
    deselectNode() {
      this.spec.deselectNode ? this.spec.deselectNode() : super.deselectNode();
    }
    destroy() {
      (this.spec.destroy && this.spec.destroy(), super.destroy());
    }
    stopEvent(e) {
      return this.spec.stopEvent ? this.spec.stopEvent(e) : !1;
    }
    ignoreMutation(e) {
      return this.spec.ignoreMutation ? this.spec.ignoreMutation(e) : super.ignoreMutation(e);
    }
  };
function at(e, t, n) {
  let r = e.firstChild,
    i = !1;
  for (let a = 0; a < t.length; a++) {
    let o = t[a],
      s = o.dom;
    if (s.parentNode == e) {
      for (; s != r;) ((r = pt(r)), (i = !0));
      r = r.nextSibling;
    } else ((i = !0), e.insertBefore(s, r));
    if (o instanceof $e) {
      let t = r ? r.previousSibling : e.lastChild;
      (at(o.contentDOM, o.children, n), (r = t ? t.nextSibling : e.firstChild));
    }
  }
  for (; r;) ((r = pt(r)), (i = !0));
  i && n.trackWrites == e && (n.trackWrites = null);
}
var ot = function (e) {
  e && (this.nodeName = e);
};
ot.prototype = Object.create(null);
var st = [new ot()];
function ct(e, t, n) {
  if (e.length == 0) return st;
  let r = n ? st[0] : new ot(),
    i = [r];
  for (let a = 0; a < e.length; a++) {
    let o = e[a].type.attrs;
    if (o) {
      o.nodeName && i.push((r = new ot(o.nodeName)));
      for (let e in o) {
        let a = o[e];
        a != null &&
          (n && i.length == 1 && i.push((r = new ot(t.isInline ? `span` : `div`))),
          e == `class`
            ? (r.class = (r.class ? r.class + ` ` : ``) + a)
            : e == `style`
              ? (r.style = (r.style ? r.style + `;` : ``) + a)
              : e != `nodeName` && (r[e] = a));
      }
    }
  }
  return i;
}
function lt(e, t, n, r) {
  if (n == st && r == st) return t;
  let i = t;
  for (let t = 0; t < r.length; t++) {
    let a = r[t],
      o = n[t];
    if (t) {
      let t;
      ((o &&
        o.nodeName == a.nodeName &&
        i != e &&
        (t = i.parentNode) &&
        t.nodeName.toLowerCase() == a.nodeName) ||
        ((t = document.createElement(a.nodeName)),
        (t.pmIsDeco = !0),
        t.appendChild(i),
        (o = st[0])),
        (i = t));
    }
    ut(i, o || st[0], a);
  }
  return i;
}
function ut(e, t, n) {
  for (let r in t)
    r != `class` && r != `style` && r != `nodeName` && !(r in n) && e.removeAttribute(r);
  for (let r in n)
    r != `class` && r != `style` && r != `nodeName` && n[r] != t[r] && e.setAttribute(r, n[r]);
  if (t.class != n.class) {
    let r = t.class ? t.class.split(` `).filter(Boolean) : [],
      i = n.class ? n.class.split(` `).filter(Boolean) : [];
    for (let t = 0; t < r.length; t++) i.indexOf(r[t]) == -1 && e.classList.remove(r[t]);
    for (let t = 0; t < i.length; t++) r.indexOf(i[t]) == -1 && e.classList.add(i[t]);
    e.classList.length == 0 && e.removeAttribute(`class`);
  }
  if (t.style != n.style) {
    if (t.style) {
      let n = /\s*([\w\-\xa1-\uffff]+)\s*:(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\(.*?\)|[^;])*/g,
        r;
      for (; (r = n.exec(t.style));) e.style.removeProperty(r[1]);
    }
    n.style && (e.style.cssText += n.style);
  }
}
function dt(e, t, n) {
  return lt(e, e, st, ct(t, n, !T(e)));
}
function ft(e, t) {
  if (e.length != t.length) return !1;
  for (let n = 0; n < e.length; n++) if (!e[n].type.eq(t[n].type)) return !1;
  return !0;
}
function pt(e) {
  let t = e.nextSibling;
  return (e.parentNode.removeChild(e), t);
}
var mt = class {
  constructor(e, t, n) {
    ((this.lock = t),
      (this.view = n),
      (this.index = 0),
      (this.stack = []),
      (this.changed = !1),
      (this.top = e),
      (this.preMatch = ht(e.node.content, e)));
  }
  destroyBetween(e, t) {
    if (e != t) {
      for (let n = e; n < t; n++) this.top.children[n].destroy();
      (this.top.children.splice(e, t - e), (this.changed = !0));
    }
  }
  destroyRest() {
    this.destroyBetween(this.index, this.top.children.length);
  }
  syncToMarks(e, t, n, r) {
    let i = 0,
      a = this.stack.length >> 1,
      o = Math.min(a, e.length);
    for (
      ;
      i < o &&
      (i == a - 1 ? this.top : this.stack[(i + 1) << 1]).matchesMark(e[i]) &&
      e[i].type.spec.spanning !== !1;
    )
      i++;
    for (; i < a;)
      (this.destroyRest(),
        (this.top.damage = 0),
        (this.index = this.stack.pop()),
        (this.top = this.stack.pop()),
        a--);
    for (; a < e.length;) {
      this.stack.push(this.top, this.index + 1);
      let i = -1,
        o = this.top.children.length;
      r < this.preMatch.index && (o = Math.min(this.index + 3, o));
      for (let t = this.index; t < o; t++) {
        let n = this.top.children[t];
        if (n.matchesMark(e[a]) && !this.isLocked(n.dom)) {
          i = t;
          break;
        }
      }
      if (i < 0 && this.index < this.top.children.length) {
        let t = this.top.children[this.index];
        t instanceof $e &&
          !(t.damage & 4) &&
          t.mark.type == e[a].type &&
          t.spec.update &&
          !this.isLocked(t.dom) &&
          t.spec.update(e[a]) &&
          ((t.mark = e[a]), (i = this.index), (this.changed = !0));
      }
      if (i > -1)
        (i > this.index && ((this.changed = !0), this.destroyBetween(this.index, i)),
          (this.top = this.top.children[this.index]));
      else {
        let r = $e.create(this.top, e[a], t, n);
        (this.top.children.splice(this.index, 0, r), (this.top = r), (this.changed = !0));
      }
      ((this.index = 0), a++);
    }
  }
  findNodeMatch(e, t, n, r) {
    let i = -1,
      a;
    if (
      r >= this.preMatch.index &&
      (a = this.preMatch.matches[r - this.preMatch.index]).parent == this.top &&
      a.matchesNode(e, t, n)
    )
      i = this.top.children.indexOf(a, this.index);
    else
      for (let r = this.index, a = Math.min(this.top.children.length, r + 5); r < a; r++) {
        let a = this.top.children[r];
        if (a.matchesNode(e, t, n) && !this.preMatch.matched.has(a)) {
          i = r;
          break;
        }
      }
    return i < 0 ? !1 : (this.destroyBetween(this.index, i), this.index++, !0);
  }
  updateNodeAt(e, t, n, r, i, a) {
    let o = this.top.children[r];
    return (
      o.damage & 4 && o.dom == o.contentDOM && (o.damage = 2),
      o.update(e, t, n, i, a) ? (this.destroyBetween(this.index, r), this.index++, !0) : !1
    );
  }
  findIndexWithChild(e) {
    for (;;) {
      let t = e.parentNode;
      if (!t) return -1;
      if (t == this.top.contentDOM) {
        let t = e.pmViewDesc;
        if (t) {
          for (let e = this.index; e < this.top.children.length; e++)
            if (this.top.children[e] == t) return e;
        }
        return -1;
      }
      e = t;
    }
  }
  updateNextNode(e, t, n, r, i, a) {
    for (let o = this.index; o < this.top.children.length; o++) {
      let s = this.top.children[o];
      if (s instanceof et) {
        let c = this.preMatch.matched.get(s);
        if (c != null && c != i) return !1;
        let l = s.dom,
          u,
          d =
            this.isLocked(l) &&
            !(
              e.isText &&
              s.node &&
              s.node.isText &&
              s.nodeDOM.nodeValue == e.text &&
              !(s.damage & 4) &&
              ft(t, s.outerDeco)
            );
        if (!d && s.update(e, t, n, r, a))
          return (
            this.destroyBetween(this.index, o),
            s.dom != l && (this.changed = !0),
            this.index++,
            !0
          );
        if (!d && (u = this.recreateWrapper(s, e, t, n, r, a)))
          return (
            this.destroyBetween(this.index, o),
            (this.top.children[this.index] = u),
            u.contentDOM && ((u.damage |= 2), u.updateChildren(r, a + 1), (u.damage = 0)),
            (this.changed = !0),
            this.index++,
            !0
          );
        break;
      }
    }
    return !1;
  }
  recreateWrapper(e, t, n, r, i, a) {
    if (
      e.damage & 3 ||
      t.isAtom ||
      !e.children.length ||
      !e.node.content.eq(t.content) ||
      !ft(n, e.outerDeco) ||
      !r.eq(e.innerDeco)
    )
      return null;
    let o = et.create(this.top, t, n, r, i, a);
    if (o.contentDOM) {
      ((o.children = e.children), (e.children = []));
      for (let e of o.children) e.parent = o;
    }
    return (e.destroy(), o);
  }
  addNode(e, t, n, r, i) {
    let a = et.create(this.top, e, t, n, r, i);
    (a.contentDOM && a.updateChildren(r, i + 1),
      this.top.children.splice(this.index++, 0, a),
      (this.changed = !0));
  }
  placeWidget(e, t, n) {
    let r = this.index < this.top.children.length ? this.top.children[this.index] : null;
    if (r && r.matchesWidget(e) && (e == r.widget || !r.widget.type.toDOM.parentNode)) this.index++;
    else {
      let r = new Ze(this.top, e, t, n);
      (this.top.children.splice(this.index++, 0, r), (this.changed = !0));
    }
  }
  addTextblockHacks() {
    let e = this.top.children[this.index - 1],
      t = this.top;
    for (; e instanceof $e;) ((t = e), (e = t.children[t.children.length - 1]));
    (!e ||
      !(e instanceof nt) ||
      /\n$/.test(e.node.text) ||
      (this.view.requiresGeckoHackNode && /\s$/.test(e.node.text))) &&
      ((A || k) && e && e.dom.contentEditable == `false` && this.addHackNode(`IMG`, t),
      this.addHackNode(`BR`, this.top));
  }
  addHackNode(e, t) {
    if (t == this.top && this.index < t.children.length && t.children[this.index].matchesHack(e))
      this.index++;
    else {
      let n = document.createElement(e);
      (e == `IMG` && ((n.className = `ProseMirror-separator`), (n.alt = ``)),
        e == `BR` && (n.className = `ProseMirror-trailingBreak`));
      let r = new rt(this.top, [], n, null);
      (t == this.top ? t.children.splice(this.index++, 0, r) : t.children.push(r),
        (this.changed = !0));
    }
  }
  isLocked(e) {
    return this.lock && (e == this.lock || (T(e) && e.contains(this.lock.parentNode)));
  }
};
function ht(e, t) {
  let n = t,
    r = n.children.length,
    i = [],
    a = e.childCount,
    o = new Map(),
    s = [];
  outer: for (; a > 0;) {
    let c;
    for (;;)
      if (r) {
        let e = n.children[r - 1];
        if (e instanceof $e) (i.push(r - 1), (n = e), (r = e.children.length));
        else {
          ((c = e), r--);
          break;
        }
      } else if (n == t) break outer;
      else ((r = i.pop()), (n = n.parent));
    let l = c.node;
    if (l) {
      if (l != e.child(a - 1)) break;
      (--a, o.set(c, a), s.push(c));
    }
  }
  return { index: a, matched: o, matches: s.reverse() };
}
function gt(e, t) {
  return e.type.side - t.type.side;
}
function _t(e, t, n, r) {
  let i = t.locals(e),
    a = 0;
  if (i.length == 0) {
    for (let n = 0; n < e.childCount; n++) {
      let o = e.child(n);
      (r(o, i, t.forChild(a, o), n), (a += o.nodeSize));
    }
    return;
  }
  let o = 0,
    s = [],
    c = null;
  for (let l = 0; ;) {
    let u, d;
    for (; o < i.length && i[o].to == a;) {
      let e = i[o++];
      e.widget && (u ? (d ||= [u]).push(e) : (u = e));
    }
    if (u) {
      if (d) {
        d.sort(gt);
        for (let e = 0; e < d.length; e++) n(d[e], l, !!c);
      } else n(u, l, !!c);
    }
    let f, p;
    if (c) ((p = -1), (f = c), (c = null));
    else if (l < e.childCount) ((p = l), (f = e.child(l++)));
    else break;
    for (let e = 0; e < s.length; e++) s[e].to <= a && s.splice(e--, 1);
    for (; o < i.length && i[o].from <= a && i[o].to > a;) s.push(i[o++]);
    let m = a + f.nodeSize;
    if (f.isText) {
      let e = m;
      o < i.length && i[o].from < e && (e = i[o].from);
      for (let t = 0; t < s.length; t++) s[t].to < e && (e = s[t].to);
      e < m && ((c = f.cut(e - a)), (f = f.cut(0, e - a)), (m = e), (p = -1));
    } else for (; o < i.length && i[o].to < m;) o++;
    let h = f.isInline && !f.isLeaf ? s.filter((e) => !e.inline) : s.slice();
    (r(f, h, t.forChild(a, f), p), (a = m));
  }
}
function vt(e) {
  if (e.nodeName == `UL` || e.nodeName == `OL`) {
    let t = e.style.cssText;
    ((e.style.cssText = t + `; list-style: square !important`),
      window.getComputedStyle(e).listStyle,
      (e.style.cssText = t));
  }
}
function yt(e, t, n, r) {
  for (let i = 0, a = 0; i < e.childCount && a <= r;) {
    let o = e.child(i++),
      s = a;
    if (((a += o.nodeSize), !o.isText)) continue;
    let c = o.text;
    for (; i < e.childCount;) {
      let t = e.child(i++);
      if (((a += t.nodeSize), !t.isText)) break;
      c += t.text;
    }
    if (a >= n) {
      if (a >= r && c.slice(r - t.length - s, r - s) == t) return r - t.length;
      let e = s < r ? c.lastIndexOf(t, r - s - 1) : -1;
      if (e >= 0 && e + t.length + s >= n) return s + e;
      if (n == r && c.length >= r + t.length - s && c.slice(r - s, r - s + t.length) == t) return r;
    }
  }
  return -1;
}
function bt(e, t, n, r, i) {
  let a = [];
  for (let o = 0, s = 0; o < e.length; o++) {
    let c = e[o],
      l = s,
      u = (s += c.size);
    l >= n || u <= t
      ? a.push(c)
      : (l < t && a.push(c.slice(0, t - l, r)),
        (i &&= (a.push(i), void 0)),
        u > n && a.push(c.slice(n - l, c.size, r)));
  }
  return a;
}
function xt(e, t) {
  let { $anchor: n, $head: r } = e.selection,
    i = t > 0 ? n.max(r) : n.min(r),
    a = i.parent.inlineContent
      ? i.depth
        ? e.doc.resolve(t > 0 ? i.after() : i.before())
        : null
      : i;
  return a && d.findFrom(a, t);
}
function F(e, t) {
  return (e.dispatch(e.state.tr.setSelection(t).scrollIntoView()), !0);
}
function St(e, t, n) {
  let r = e.state.selection;
  if (r instanceof s) {
    if (n.indexOf(`s`) > -1) {
      let { $head: n } = r,
        i = n.textOffset ? null : t < 0 ? n.nodeBefore : n.nodeAfter;
      if (!i || i.isText || !i.isLeaf) return !1;
      let a = e.state.doc.resolve(n.pos + i.nodeSize * (t < 0 ? -1 : 1));
      return F(e, new s(r.$anchor, a));
    }
    if (!r.empty) return !1;
    if (e.endOfTextblock(t > 0 ? `forward` : `backward`)) {
      let n = xt(e.state, t);
      return n && n instanceof f ? F(e, n) : !1;
    }
    if (!j || n.indexOf(`m`) < 0) {
      let n = r.$head,
        i = n.textOffset ? null : t < 0 ? n.nodeBefore : n.nodeAfter,
        a;
      if (!i || i.isText) return !1;
      let o = t < 0 ? n.pos - i.nodeSize : n.pos;
      return i.isAtom || ((a = e.docView.descAt(o)) && !a.contentDOM)
        ? f.isSelectable(i)
          ? F(e, new f(t < 0 ? e.state.doc.resolve(n.pos - i.nodeSize) : n))
          : F(e, new s(e.state.doc.resolve(t < 0 ? o : o + i.nodeSize)))
        : !1;
    }
  } else if (r instanceof f && r.node.isInline) return F(e, new s(t > 0 ? r.$to : r.$from));
  else {
    let n = xt(e.state, t);
    return n ? F(e, n) : !1;
  }
}
function Ct(e, t) {
  let n = e.pmViewDesc;
  return n
    ? n.size == 0 && (t < 0 || e.nextSibling || e.nodeName != `BR`)
    : T(e) && e.contentEditable == `false`;
}
function wt(e, t) {
  return t < 0 ? Tt(e) : Et(e);
}
function Tt(e) {
  let t = e.domSel.readRange(),
    n = t.focusNode,
    r = t.focusOffset;
  if (!n) return;
  let i,
    a,
    o = !1;
  for (O && T(n) && r < w(n) && Ct(n.childNodes[r], -1) && (o = !0); ;)
    if (r > 0) {
      if (!T(n)) break;
      let e = n.childNodes[r - 1];
      if (Ct(e, -1)) ((i = n), (a = --r));
      else if (E(e)) ((n = e), (r = n.nodeValue.length));
      else break;
    } else if (Dt(n)) break;
    else {
      let t = n.previousSibling;
      for (; t && Ct(t, -1);) ((i = n.parentNode), (a = v(t)), (t = t.previousSibling));
      if (t) ((n = t), (r = w(n)));
      else {
        if (((n = n.parentNode), n == e.dom)) break;
        r = 0;
      }
    }
  o ? Ot(e, n, r) : i && Ot(e, i, a);
}
function Et(e) {
  let t = e.domSel.readRange(),
    n = t.focusNode,
    r = t.focusOffset;
  if (!n) return;
  let i = w(n),
    a,
    o;
  for (;;)
    if (r < i) {
      if (!T(n)) break;
      let e = n.childNodes[r];
      if (Ct(e, 1)) ((a = n), (o = ++r));
      else break;
    } else if (Dt(n)) break;
    else {
      let t = n.nextSibling;
      for (; t && Ct(t, 1);) ((a = t.parentNode), (o = v(t) + 1), (t = t.nextSibling));
      if (t) ((n = t), (r = 0), (i = w(n)));
      else {
        if (((n = n.parentNode), n == e.dom)) break;
        r = i = 0;
      }
    }
  a && Ot(e, a, o);
}
function Dt(e) {
  for (let t = e; t; t = t.parentNode) {
    let e = t.pmViewDesc;
    if (e) return e.node ? e.node.isBlock : !1;
  }
  return !1;
}
function Ot(e, t, n) {
  if (!E(t)) {
    let e, r;
    (r = ie(t, n)) ? ((t = r), (n = 0)) : (e = re(t, n)) && ((t = e), (n = e.nodeValue.length));
  }
  let r = e.domSelection(),
    i = e.domSel.readRange();
  if (!r) return;
  (se(i)
    ? r.collapse(t, n)
    : r.extend && (r.collapse(i.anchorNode, i.anchorOffset), r.extend(t, n)),
    e.domSel.ignore());
  let { state: a } = e;
  setTimeout(() => {
    e.state == a && e.domSel.sync();
  }, 50);
}
function kt(e, t) {
  let n = e.state.doc.resolve(t);
  if (!(k || _e) && n.parent.inlineContent) {
    let r = e.coordsAtPos(t);
    if (t > n.start()) {
      let n = e.coordsAtPos(t - 1),
        i = (n.top + n.bottom) / 2;
      if (i > r.top && i < r.bottom && Math.abs(n.left - r.left) > 1)
        return n.left < r.left ? `ltr` : `rtl`;
    }
    if (t < n.end()) {
      let n = e.coordsAtPos(t + 1),
        i = (n.top + n.bottom) / 2;
      if (i > r.top && i < r.bottom && Math.abs(n.left - r.left) > 1)
        return n.left > r.left ? `ltr` : `rtl`;
    }
  }
  let r = e.dom;
  for (let t = n.depth; t > 0; t--)
    if (n.node(t).isBlock) {
      r = e.nodeDOM(n.before(t)) || r;
      break;
    }
  return getComputedStyle(r).direction == `rtl` ? `rtl` : `ltr`;
}
function At(e, t, n) {
  let r = e.state.selection;
  if ((r instanceof s && !r.empty) || n.indexOf(`s`) > -1 || (j && n.indexOf(`m`) > -1)) return !1;
  let { $from: i, $to: a } = r;
  if (!i.parent.inlineContent || e.endOfTextblock(t < 0 ? `up` : `down`)) {
    let n = xt(e.state, t);
    if (n && n instanceof f) return F(e, n);
  }
  if (!i.parent.inlineContent) {
    let n = t < 0 ? i : a,
      o = r instanceof m ? d.near(n, t) : d.findFrom(n, t);
    return o ? F(e, o) : !1;
  }
  return !1;
}
function jt(e, t) {
  if (!(e.state.selection instanceof s)) return !0;
  let { $head: n, $anchor: r, empty: i } = e.state.selection;
  if (!n.sameParent(r)) return !0;
  if (!i) return !1;
  if (e.endOfTextblock(t > 0 ? `forward` : `backward`)) return !0;
  let a = !n.textOffset && (t < 0 ? n.nodeBefore : n.nodeAfter);
  if (a && !a.isText) {
    let r = e.state.tr;
    return (
      t < 0 ? r.delete(n.pos - a.nodeSize, n.pos) : r.delete(n.pos, n.pos + a.nodeSize),
      e.dispatch(r),
      !0
    );
  }
  return !1;
}
function Mt(e, t, n) {
  e.domObserver.stopped(() => (t.contentEditable = n));
}
function Nt(e) {
  if (!A || e.state.selection.$head.parentOffset > 0) return !1;
  let { focusNode: t, focusOffset: n } = e.domSel.readRange();
  if (
    t &&
    T(t) &&
    n == 0 &&
    t.firstChild &&
    T(t.firstChild) &&
    t.firstChild.contentEditable == `false`
  ) {
    let n = t.firstChild;
    (Mt(e, n, `true`), setTimeout(() => Mt(e, n, `false`), 20));
  }
  return !1;
}
function Pt(e) {
  let t = ``;
  return (
    e.ctrlKey && (t += `c`),
    e.metaKey && (t += `m`),
    e.altKey && (t += `a`),
    e.shiftKey && (t += `s`),
    t
  );
}
function Ft(e, t) {
  let n = t.keyCode,
    r = Pt(t);
  if (n == 8 || (j && n == 72 && r == `c`)) return jt(e, -1) || wt(e, -1);
  if ((n == 46 && !t.shiftKey) || (j && n == 68 && r == `c`)) return jt(e, 1) || wt(e, 1);
  if (n == 13 || n == 27) return !0;
  if (n == 37 || (j && n == 66 && r == `c`)) {
    let t = n == 37 ? (kt(e, e.state.selection.from) == `ltr` ? -1 : 1) : -1;
    return St(e, t, r) || wt(e, t);
  }
  if (n == 39 || (j && n == 70 && r == `c`)) {
    let t = n == 39 ? (kt(e, e.state.selection.from) == `ltr` ? 1 : -1) : 1;
    return St(e, t, r) || wt(e, t);
  }
  return n == 38 || (j && n == 80 && r == `c`)
    ? At(e, -1, r) || wt(e, -1)
    : n == 40 || (j && n == 78 && r == `c`)
      ? Nt(e) || At(e, 1, r) || wt(e, 1)
      : !(r != (j ? `m` : `c`) || (n != 66 && n != 73 && n != 89 && n != 90));
}
function It(e, t) {
  e.someProp(`transformCopied`, (n) => {
    t = n(t, e);
  });
  let n = [],
    { content: r, openStart: a, openEnd: o } = t;
  for (; a > 1 && o > 1 && r.childCount == 1 && r.firstChild.childCount == 1;) {
    (a--, o--);
    let e = r.firstChild;
    (n.push(e.type.name, e.attrs == e.type.defaultAttrs ? null : e.attrs), (r = e.content));
  }
  let s = e.someProp(`clipboardSerializer`) || i.fromSchema(e.state.schema),
    c = Kt(),
    l = c.createElement(`div`);
  l.appendChild(s.serializeFragment(r, { document: c }));
  let u = l.firstChild,
    d,
    f = 0;
  for (; u && T(u) && (d = Gt[u.nodeName.toLowerCase()]);) {
    for (let e = d.length - 1; e >= 0; e--) {
      let t = c.createElement(d[e]);
      for (; l.firstChild;) t.appendChild(l.firstChild);
      (l.appendChild(t), f++);
    }
    u = l.firstChild;
  }
  return (
    u &&
      T(u) &&
      u.setAttribute(`data-pm-slice`, `${a} ${o}${f ? ` -${f}` : ``} ${JSON.stringify(n)}`),
    {
      dom: l,
      text:
        e.someProp(`clipboardTextSerializer`, (n) => n(t, e)) ||
        t.content.textBetween(
          0,
          t.content.size,
          `

`,
        ),
      slice: t,
    }
  );
}
function Lt(e, t, r, a, o) {
  let s = o.parent.type.spec.code,
    c,
    u;
  if (!r && !t) return null;
  let d = !!t && (a || s || !r);
  if (d) {
    if (
      (e.someProp(`transformPastedText`, (n) => {
        t = n(t, s || a, e);
      }),
      s)
    )
      return (
        (u = new l(
          n.from(
            e.state.schema.text(
              t.replace(
                /\r\n?/g,
                `
`,
              ),
            ),
          ),
          0,
          0,
        )),
        e.someProp(`transformPasted`, (t) => {
          u = t(u, e, !0);
        }),
        u
      );
    let r = e.someProp(`clipboardTextParser`, (n) => n(t, o, a, e));
    if (r) u = r;
    else {
      let n = o.marks(),
        { schema: r } = e.state,
        a = i.fromSchema(r);
      ((c = document.createElement(`div`)),
        t.split(/(?:\r\n?|\n)+/).forEach((e) => {
          let t = c.appendChild(document.createElement(`p`));
          e && t.appendChild(a.serializeNode(r.text(e, n)));
        }));
    }
  } else
    (e.someProp(`transformPastedHTML`, (t) => {
      r = t(r, e);
    }),
      (c = Yt(r)),
      ve && Xt(c));
  let f = c && c.querySelector(`[data-pm-slice]`),
    p = f && /^(\d+) (\d+)(?: -(\d+))? (.*)/.exec(f.getAttribute(`data-pm-slice`) || ``);
  if (p && p[3])
    for (let e = +p[3]; e > 0; e--) {
      let e = c.firstChild;
      for (; e && !T(e);) e = e.nextSibling;
      if (!e) break;
      c = e;
    }
  if (
    ((u ||= (
      e.someProp(`clipboardParser`) ||
      e.someProp(`domParser`) ||
      g.fromSchema(e.state.schema)
    ).parseSlice(c, {
      preserveWhitespace: !!(d || p),
      context: o,
      ruleFromNode(e) {
        return e.nodeName == `BR` &&
          !e.nextSibling &&
          e.parentNode &&
          !Rt.test(e.parentNode.nodeName)
          ? { ignore: !0 }
          : null;
      },
    })),
    p)
  )
    u = Zt(Wt(u, +p[1], +p[2]), p[4]);
  else if (((u = l.maxOpen(zt(u.content, o), !0)), u.openStart || u.openEnd)) {
    let e = 0,
      t = 0;
    for (
      let t = u.content.firstChild;
      e < u.openStart && !t.type.spec.isolating;
      e++, t = t.firstChild
    );
    for (
      let e = u.content.lastChild;
      t < u.openEnd && !e.type.spec.isolating;
      t++, e = e.lastChild
    );
    u = Wt(u, e, t);
  }
  return (
    e.someProp(`transformPasted`, (t) => {
      u = t(u, e, a);
    }),
    u
  );
}
var Rt =
  /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var)$/i;
function zt(e, t) {
  if (e.childCount < 2) return e;
  for (let r = t.depth; r >= 0; r--) {
    let i = t.node(r).contentMatchAt(t.index(r)),
      a,
      o = [];
    if (
      (e.forEach((e) => {
        if (!o) return;
        let t = i.findWrapping(e.type),
          n;
        if (!t) return (o = null);
        if ((n = o.length && a.length && Vt(t, a, e, o[o.length - 1], 0))) o[o.length - 1] = n;
        else {
          o.length && (o[o.length - 1] = Ht(o[o.length - 1], a.length));
          let n = Bt(e, t);
          (o.push(n), (i = i.matchType(n.type)), (a = t));
        }
      }),
      o)
    )
      return n.from(o);
  }
  return e;
}
function Bt(e, t, r = 0) {
  for (let i = t.length - 1; i >= r; i--) e = t[i].create(null, n.from(e));
  return e;
}
function Vt(e, t, r, i, a) {
  if (a < e.length && a < t.length && e[a] == t[a]) {
    let o = Vt(e, t, r, i.lastChild, a + 1);
    if (o) return i.copy(i.content.replaceChild(i.childCount - 1, o));
    if (i.contentMatchAt(i.childCount).matchType(a == e.length - 1 ? r.type : e[a + 1]))
      return i.copy(i.content.append(n.from(Bt(r, e, a + 1))));
  }
}
function Ht(e, t) {
  if (t == 0) return e;
  let r = e.content.replaceChild(e.childCount - 1, Ht(e.lastChild, t - 1)),
    i = e.contentMatchAt(e.childCount).fillBefore(n.empty, !0);
  return e.copy(r.append(i));
}
function Ut(e, t, r, i, a, o) {
  let s = t < 0 ? e.firstChild : e.lastChild,
    c = s.content;
  return (
    e.childCount > 1 && (o = 0),
    a < i - 1 && (c = Ut(c, t, r, i, a + 1, o)),
    a >= r &&
      (c =
        t < 0
          ? s
              .contentMatchAt(0)
              .fillBefore(c, o <= a)
              .append(c)
          : c.append(s.contentMatchAt(s.childCount).fillBefore(n.empty, !0))),
    e.replaceChild(t < 0 ? 0 : e.childCount - 1, s.copy(c))
  );
}
function Wt(e, t, n) {
  return (
    t < e.openStart && (e = new l(Ut(e.content, -1, t, e.openStart, 0, e.openEnd), t, e.openEnd)),
    n < e.openEnd && (e = new l(Ut(e.content, 1, n, e.openEnd, 0, 0), e.openStart, n)),
    e
  );
}
var Gt = {
  thead: [`table`],
  tbody: [`table`],
  tfoot: [`table`],
  caption: [`table`],
  colgroup: [`table`],
  col: [`table`, `colgroup`],
  tr: [`table`, `tbody`],
  td: [`table`, `tbody`, `tr`],
  th: [`table`, `tbody`, `tr`],
};
function Kt() {
  return document.implementation.createHTMLDocument(`title`);
}
var qt = null;
function Jt(e) {
  let t = window.trustedTypes;
  if (!t) return e;
  if (!qt) {
    if ((qt = t.defaultPolicy))
      try {
        return qt.createHTML(e);
      } catch {}
    qt = t.createPolicy(`ProseMirrorClipboard`, { createHTML: (e) => e });
  }
  return qt.createHTML(e);
}
function Yt(e) {
  let t = /^(\s*<meta [^>]*>)*/.exec(e);
  t && (e = e.slice(t[0].length));
  let n = Kt(),
    r = n.body,
    i = /<([a-z][^>\s]+)/i.exec(e),
    a;
  if (
    ((a = i && Gt[i[1].toLowerCase()]) &&
      (e =
        a.map((e) => `<` + e + `>`).join(``) +
        e +
        a
          .map((e) => `</` + e + `>`)
          .reverse()
          .join(``)),
    (r.innerHTML = Jt(e)),
    a)
  )
    for (let e = 0; e < a.length; e++) r = r.querySelector(a[e]) || r;
  for (let e = 0; e < n.styleSheets.length; e++) {
    let t = n.styleSheets[e];
    for (let e = 0; e < t.rules.length; e++) {
      let n = t.rules[e];
      if (n instanceof CSSStyleRule) {
        let e = r.querySelectorAll(n.selectorText);
        for (let t = 0; t < e.length; t++) e[t].style.cssText += n.style.cssText;
      }
    }
  }
  return r;
}
function Xt(e) {
  let t = e.querySelectorAll(k ? `span:not([class]):not([style])` : `span.Apple-converted-space`);
  for (let n = 0; n < t.length; n++) {
    let r = t[n];
    r.childNodes.length == 1 &&
      r.textContent == `\xA0` &&
      r.parentNode &&
      r.parentNode.replaceChild(e.ownerDocument.createTextNode(` `), r);
  }
}
function Zt(e, t) {
  if (!e.size) return e;
  let r = e.content.firstChild.type.schema,
    i;
  try {
    i = JSON.parse(t);
  } catch {
    return e;
  }
  let { content: a, openStart: o, openEnd: s } = e;
  for (let e = i.length - 2; e >= 0; e -= 2) {
    let t = r.nodes[i[e]];
    if (!t || t.hasRequiredAttrs() || !t.createAndFill(null, a)) break;
    try {
      a = n.from(t.create(i[e + 1], a));
    } catch {
      break;
    }
    (o++, s++);
  }
  return new l(a, o, s);
}
var I = class e {
  constructor(e, t, n, r) {
    ((this.anchorNode = e), (this.anchorOffset = t), (this.focusNode = n), (this.focusOffset = r));
  }
  static from(t) {
    return t instanceof e ? t : new e(t.anchorNode, t.anchorOffset, t.focusNode, t.focusOffset);
  }
  eq(e) {
    return (
      e.anchorNode == this.anchorNode &&
      e.anchorOffset == this.anchorOffset &&
      e.focusNode == this.focusNode &&
      e.focusOffset == this.focusOffset
    );
  }
};
I.null = new I(null, 0, null, 0);
var Qt = class {
  constructor(e) {
    ((this.view = e),
      (this.range = I.null),
      (this.active = !1),
      (this.synced = !1),
      (this.suppress = !1),
      (this.currentDocument = null),
      (this.onSelectionChange = this.onSelectionChange.bind(this)));
  }
  ensureListener() {
    let e = this.view.dom.ownerDocument;
    e != this.currentDocument &&
      (this.currentDocument &&
        this.currentDocument.removeEventListener(`selectionchange`, this.onSelectionChange),
      (this.currentDocument = e),
      e.addEventListener(`selectionchange`, this.onSelectionChange));
  }
  destroy() {
    ((this.currentDocument &&=
      (this.currentDocument.removeEventListener(`selectionchange`, this.onSelectionChange), null)),
      (this.active = !1),
      (this.range = I.null));
  }
  suppressChanges() {
    ((this.suppress = !0), setTimeout(() => (this.suppress = !1), 50));
  }
  onSelectionChange() {
    if (this.suppress && this.view.hasFocus()) return this.sync();
    this.read() && this.view.domObserver.flush(!1);
  }
  readRange() {
    let { view: e } = this,
      t = e.dom.isConnected !== !1 && e.domSelection();
    return t
      ? A && e.root.nodeType === 11 && ue(e.dom.ownerDocument) == e.dom
        ? I.from($t(e, t) || t)
        : I.from(t)
      : I.null;
  }
  read() {
    this.ensureListener();
    let e = gn(this.view);
    if (!e) ((this.active = !1), (this.range = I.null));
    else
      return ((this.active = !0), !this.range.eq(e) && ((this.range = e), (this.synced = !1), !0));
  }
  sync(e = !1) {
    let { view: t } = this;
    t.docView &&
      (this.ensureListener(),
      t.domObserver.stopped(() => {
        pn(t, t.state.selection);
        let n = t.state.selection;
        if (t.input.mouseDown || nn(t)) {
          let { desc: r, start: i } = an(t.docView, n.from, n.to, 0);
          (t.cursorWrapper
            ? fn(t)
            : r instanceof it && r.spec.setSelection
              ? r.spec.setSelection(n.anchor - i, n.head - i, t.root)
              : rn(t, e, r, i),
            (this.synced = this.active = !0));
        }
        (n.visible == t.dom.classList.contains(`ProseMirror-hideselection`) &&
          (n.visible
            ? t.dom.classList.remove(`ProseMirror-hideselection`)
            : (t.dom.classList.add(`ProseMirror-hideselection`), dn(t))),
          (this.range = this.readRange()));
      }));
  }
  ignore(e = this.readRange()) {
    ((this.range = I.from(e)), (this.synced = !0));
  }
  deactivate() {
    ((this.range = I.null), (this.active = this.synced = !1));
  }
};
function $t(e, t) {
  if (t.getComposedRanges) {
    let n = t.getComposedRanges(e.root)[0];
    if (n) return en(e, n);
  }
  let n;
  function r(e) {
    (e.preventDefault(), e.stopImmediatePropagation(), (n = e.getTargetRanges()[0]));
  }
  return (
    e.dom.addEventListener(`beforeinput`, r, !0),
    document.execCommand(`indent`),
    e.dom.removeEventListener(`beforeinput`, r, !0),
    n ? en(e, n) : null
  );
}
function en(e, t) {
  let n = t.startContainer,
    r = t.startOffset,
    i = t.endContainer,
    a = t.endOffset,
    o = e.domAtPos(e.state.selection.anchor);
  return (C(o.node, o.offset, i, a) && ([n, r, i, a] = [i, a, n, r]), new I(n, r, i, a));
}
function tn(e, t, n = null) {
  let r = e.state.doc;
  if (!t.focusNode) return null;
  let i = e.docView.nearestDesc(t.focusNode),
    a = i && i.size == 0,
    o = e.docView.posFromDOM(t.focusNode, t.focusOffset, 1);
  if (o < 0) return null;
  let s = r.resolve(o),
    c,
    l;
  if (se(t)) {
    for (c = o; i && !i.node;) i = i.parent;
    if (
      i &&
      i.node.isAtom &&
      f.isSelectable(i.node) &&
      i.parent &&
      !(i.node.isInline && ae(t.focusNode, t.focusOffset, i.dom))
    ) {
      let e = i.posBefore;
      l = new f(o == e ? s : r.resolve(e));
    } else if (
      O &&
      n == `key` &&
      o > e.state.selection.to &&
      T(t.focusNode) &&
      t.focusOffset == t.focusNode.childNodes.length &&
      i &&
      i.posAtStart > e.state.selection.to
    )
      for (let e = t.focusNode; ; e = e.parentNode) {
        if (getComputedStyle(e).overflow != `visible`) {
          l = d.findFrom(r.resolve(i.posAtStart), 1);
          break;
        }
        if (e == i.dom || e.nextSibling || !e.parentNode || !T(e.parentNode)) break;
      }
  } else {
    if (t instanceof e.dom.ownerDocument.defaultView.Selection && t.rangeCount > 1) {
      let n = o,
        i = o;
      for (let r = 0; r < t.rangeCount; r++) {
        let a = t.getRangeAt(r);
        ((n = Math.min(n, e.docView.posFromDOM(a.startContainer, a.startOffset, 1))),
          (i = Math.max(i, e.docView.posFromDOM(a.endContainer, a.endOffset, -1))));
      }
      if (n < 0) return null;
      (([c, o] = i == e.state.selection.anchor ? [i, n] : [n, i]), (s = r.resolve(o)));
    } else c = e.docView.posFromDOM(t.anchorNode, t.anchorOffset, 1);
    if (c < 0) return null;
  }
  let u = r.resolve(c);
  if (!l) {
    let t = n == `pointer` || (e.state.selection.head < s.pos && !a) ? 1 : -1;
    l = hn(e, u, s, t);
  }
  return l;
}
function nn(e) {
  return e.editable
    ? e.hasFocus()
    : _n(e, e.domSel.readRange()) &&
        (!document.activeElement || document.activeElement.contains(e.dom));
}
function rn(e, t, n, r) {
  let i = e.state.selection,
    { anchor: a, head: o } = i,
    c,
    l;
  sn &&
    !(i instanceof s) &&
    (i.$from.parent.inlineContent || (c = cn(e, i.from)),
    !i.empty && !i.$from.parent.inlineContent && (l = cn(e, i.to)));
  let u = n.domFromPos(a - r, a > r ? -1 : 1);
  (on(a, o, u, o == a ? u : n.domFromPos(o - r, o > r ? -1 : 1), e, t),
    sn && (c && un(c), l && un(l)));
}
function an(e, t, n, r = 0) {
  for (let i = 0, a = r; i < e.children.length; i++) {
    let r = e.children[i],
      o = a + r.size;
    if (t > a && n < o) return an(r, t, n, a + r.border);
    a = o;
  }
  return { desc: e, start: r };
}
function on(e, t, n, r, i, a) {
  let o = !1;
  if ((O || A) && e == t) {
    let { node: e, offset: t } = n;
    if (E(e)) {
      if (
        ((o = !!(
          t &&
          e.nodeValue[t - 1] ==
            `
`
        )),
        o && t == e.nodeValue.length)
      )
        for (let t = e, i; t; t = t.parentNode) {
          if ((i = t.nextSibling)) {
            i.nodeName == `BR` && (n = r = { node: i.parentNode, offset: v(i) + 1 });
            break;
          }
          let e = t.pmViewDesc;
          if (e && e.node && e.node.isBlock) break;
        }
    } else {
      let n = e.childNodes[t - 1];
      o = n && (n.nodeName == `BR` || n.contentEditable == `false`);
    }
  }
  let s = i.domSel.readRange();
  if (O && s.focusNode && s.focusNode != r.node && T(s.focusNode)) {
    let e = s.focusNode.childNodes[s.focusOffset];
    e && e.contentEditable == `false` && (a = !0);
  }
  (!(a || (o && A)) &&
    C(n.node, n.offset, s.anchorNode, s.anchorOffset) &&
    C(r.node, r.offset, s.focusNode, s.focusOffset)) ||
    ce(i.domSelection(), {
      focusNode: r.node,
      focusOffset: r.offset,
      anchorNode: n.node,
      anchorOffset: n.offset,
    });
}
var sn = A || (k && he < 63);
function cn(e, t) {
  let { node: n, offset: r } = e.docView.domFromPos(t, 0),
    i = r < n.childNodes.length ? n.childNodes[r] : null,
    a = r ? n.childNodes[r - 1] : null;
  if (A && i && i.contentEditable == `false`) return ln(i);
  if ((!i || i.contentEditable == `false`) && (!a || a.contentEditable == `false`)) {
    if (i) return ln(i);
    if (a) return ln(a);
  }
}
function ln(e) {
  return (
    (e.contentEditable = `true`),
    A && e.draggable && ((e.draggable = !1), (e.wasDraggable = !0)),
    e
  );
}
function un(e) {
  ((e.contentEditable = `false`), (e.wasDraggable &&= ((e.draggable = !0), null)));
}
function dn(e) {
  let t = e.dom.ownerDocument;
  t.removeEventListener(`selectionchange`, e.input.hideSelectionGuard);
  let n = e.domSel.readRange(),
    r = n.anchorNode,
    i = n.anchorOffset;
  t.addEventListener(
    `selectionchange`,
    (e.input.hideSelectionGuard = () => {
      (n.anchorNode != r || n.anchorOffset != i) &&
        (t.removeEventListener(`selectionchange`, e.input.hideSelectionGuard),
        setTimeout(() => {
          (!nn(e) || e.state.selection.visible) &&
            e.dom.classList.remove(`ProseMirror-hideselection`);
        }, 20));
    }),
  );
}
function fn(e) {
  let t = e.domSelection();
  if (!t) return;
  let n = e.cursorWrapper.dom;
  n.nodeName == `IMG` ? t.collapse(n.parentNode, v(n) + 1) : t.collapse(n, 0);
}
function pn(e, t) {
  if (t instanceof f) {
    let n = e.docView.descAt(t.from);
    n != e.lastSelectedViewDesc && (mn(e), n && n.selectNode(), (e.lastSelectedViewDesc = n));
  } else mn(e);
}
function mn(e) {
  e.lastSelectedViewDesc &&=
    (e.lastSelectedViewDesc.parent && e.lastSelectedViewDesc.deselectNode(), void 0);
}
function hn(e, t, n, r) {
  let i = e.someProp(`createSelectionBetween`, (r) => r(e, t, n)) || s.between(t, n, r);
  return (
    e.someProp(`adjustSelectionFromDOM`, (t) => {
      i = t(e, i);
    }),
    i
  );
}
function gn(e) {
  if (e.editable && !e.hasFocus()) return null;
  let t = e.domSel.readRange();
  return t && _n(e, t) ? t : null;
}
function _n(e, t) {
  if (!t.anchorNode) return !1;
  try {
    return ne(e.dom, t.anchorNode) && (e.editable || ne(e.dom, t.focusNode));
  } catch {
    return !1;
  }
}
var L = {},
  R = {},
  vn = { touchstart: !0, touchmove: !0 },
  yn = class {
    constructor() {
      ((this.shiftKey = !1),
        (this.mouseDown = null),
        (this.lastKeyCode = null),
        (this.lastKeyCodeTime = 0),
        (this.lastKeyDispatched = !1),
        (this.lastClick = { time: 0, x: 0, y: 0, type: ``, button: 0 }),
        (this.lastSelectionOrigin = null),
        (this.lastSelectionTime = 0),
        (this.lastIOSEnter = 0),
        (this.lastIOSEnterFallbackTimeout = -1),
        (this.lastFocus = 0),
        (this.lastTouch = 0),
        (this.lastChromeDelete = 0),
        (this.composing = !1),
        (this.compositionNode = null),
        (this.composingTimeout = -1),
        (this.compositionNodes = []),
        (this.compositionEndedAt = -2e8),
        (this.compositionID = 1),
        (this.badSafariComposition = !1),
        (this.compositionPendingChanges = 0),
        (this.domChangeCount = 0),
        (this.eventHandlers = Object.create(null)),
        (this.hideSelectionGuard = null));
    }
  };
function bn(e) {
  for (let t in L) {
    let n = L[t];
    e.dom.addEventListener(
      t,
      (e.input.eventHandlers[t] = (t) => {
        Tn(e, t) &&
          (e.input.composing &&
            (t.type == `keydown` || t.type == `beforeinput`) &&
            t.isComposing === !1 &&
            qn(e, !0),
          wn(e, t) || (!e.editable && t.type in R) || n(e, t));
      }),
      vn[t] ? { passive: !0 } : void 0,
    );
  }
  (A && e.dom.addEventListener(`input`, () => null), Cn(e));
}
function xn(e, t) {
  ((e.input.lastSelectionOrigin = t), (e.input.lastSelectionTime = Date.now()));
}
function Sn(e) {
  (e.input.mouseDown && e.input.mouseDown.done(), e.domObserver.stop());
  for (let t in e.input.eventHandlers) e.dom.removeEventListener(t, e.input.eventHandlers[t]);
  (clearTimeout(e.input.composingTimeout), clearTimeout(e.input.lastIOSEnterFallbackTimeout));
}
function Cn(e) {
  e.someProp(`handleDOMEvents`, (t) => {
    for (let n in t)
      e.input.eventHandlers[n] ||
        e.dom.addEventListener(n, (e.input.eventHandlers[n] = (t) => wn(e, t)));
  });
}
function wn(e, t) {
  return e.someProp(`handleDOMEvents`, (n) => {
    let r = n[t.type];
    return r ? r(e, t) || t.defaultPrevented : !1;
  });
}
function Tn(e, t) {
  if (!t.bubbles) return !0;
  if (t.defaultPrevented) return !1;
  for (let n = t.target; n != e.dom; n = n.parentNode)
    if (!n || n.nodeType == 11 || (n.pmViewDesc && n.pmViewDesc.stopEvent(t))) return !1;
  return !0;
}
function En(e, t) {
  !wn(e, t) && L[t.type] && (e.editable || !(t.type in R)) && L[t.type](e, t);
}
function z(e, t) {
  let { input: n } = e;
  return n.lastKeyDispatched || e.composing
    ? !1
    : ((n.lastKeyDispatched = !0),
      typeof t == `string` && (t = le(t == `Backspace` ? 8 : 13, t)),
      e.someProp(`handleKeyDown`, (n) => n(e, t)));
}
((R.keydown = (e, t) => {
  let n = t;
  if (
    ((e.input.shiftKey = n.keyCode == 16 || n.shiftKey),
    (e.input.lastKeyCode = n.keyCode),
    (e.input.lastKeyCodeTime = Date.now()),
    (e.input.lastKeyDispatched = !1),
    !(M && k && n.keyCode == 13))
  ) {
    if (ge && n.keyCode == 13 && !n.ctrlKey && !n.altKey && !n.metaKey) {
      let t = Date.now();
      ((e.input.lastIOSEnter = t),
        (e.input.lastIOSEnterFallbackTimeout = setTimeout(() => {
          e.input.lastIOSEnter == t && (z(e, `Enter`), (e.input.lastIOSEnter = 0));
        }, 200)));
    } else
      (n.keyCode != 229 && e.domObserver.forceFlush(!0),
        z(e, n) || Ft(e, n) ? n.preventDefault() : xn(e, `key`));
  }
}),
  (R.keyup = (e, t) => {
    t.keyCode == 16 && (e.input.shiftKey = !1);
  }),
  (R.keypress = (e, t) => {
    let n = t;
    if (Wn(e) || !n.charCode || (n.ctrlKey && !n.altKey) || (j && n.metaKey)) return;
    if (e.someProp(`handleKeyPress`, (t) => t(e, n))) {
      n.preventDefault();
      return;
    }
    let r = e.state.selection;
    if (!(r instanceof s) || !r.$from.sameParent(r.$to)) {
      let t = String.fromCharCode(n.charCode),
        i = () => e.state.tr.insertText(t).scrollIntoView();
      (!/[\r\n]/.test(t) &&
        !e.someProp(`handleTextInput`, (n) => n(e, r.$from.pos, r.$to.pos, t, i)) &&
        e.dispatch(i()),
        n.preventDefault());
    }
  }));
function Dn(e) {
  return { left: e.clientX, top: e.clientY };
}
function On(e, t) {
  let n = t.x - e.clientX,
    r = t.y - e.clientY;
  return n * n + r * r < 100;
}
function kn(e, t, n, r, i) {
  if (r == -1) return !1;
  let a = e.state.doc.resolve(r);
  for (let r = a.depth + 1; r > 0; r--)
    if (
      e.someProp(t, (t) =>
        r > a.depth
          ? t(e, n, a.nodeAfter, a.before(r), i, !0)
          : t(e, n, a.node(r), a.before(r), i, !1),
      )
    )
      return !0;
  return !1;
}
function An(e, t, n) {
  if ((e.focused || e.focus(), e.state.selection.eq(t))) return;
  let r = e.state.tr.setSelection(t);
  (r.setMeta(`pointer`, !0), e.dispatch(r));
}
function jn(e, t) {
  if (t == -1) return !1;
  let n = e.state.doc.resolve(t),
    r = n.nodeAfter;
  return r && r.isAtom && f.isSelectable(r) ? (An(e, new f(n)), !0) : !1;
}
function Mn(e, t) {
  if (t == -1) return !1;
  let n = e.state.selection,
    r,
    i;
  n instanceof f && (r = n.node);
  let a = e.state.doc.resolve(t);
  for (let e = a.depth + 1; e > 0; e--) {
    let t = e > a.depth ? a.nodeAfter : a.node(e);
    if (f.isSelectable(t)) {
      i =
        r && n.$from.depth > 0 && e >= n.$from.depth && a.before(n.$from.depth + 1) == n.$from.pos
          ? a.before(n.$from.depth)
          : a.before(e);
      break;
    }
  }
  return i != null && (An(e, f.create(e.state.doc, i)), !0);
}
function Nn(e, t, n, r, i) {
  return (
    kn(e, `handleClickOn`, t, n, r) ||
    e.someProp(`handleClick`, (n) => n(e, t, r)) ||
    (i ? Mn(e, n) : jn(e, n))
  );
}
function Pn(e, t, n, r) {
  return (
    kn(e, `handleDoubleClickOn`, t, n, r) || e.someProp(`handleDoubleClick`, (n) => n(e, t, r))
  );
}
function Fn(e, t, n, r) {
  return (
    kn(e, `handleTripleClickOn`, t, n, r) || e.someProp(`handleTripleClick`, (n) => n(e, t, r))
  );
}
function In(e, t, n) {
  if (t == -1) return e.inlineContent ? s.create(e, 0, e.content.size) : null;
  let r = e.resolve(t);
  for (let t = r.depth + 1; t > 0; t--) {
    let i = t > r.depth ? r.nodeAfter : r.node(t),
      a = r.before(t);
    if (i.inlineContent) return s.create(e, a + 1, a + 1 + i.content.size);
    if (n && f.isSelectable(i)) return f.create(e, a);
  }
  return null;
}
var Ln = /[\w_\u00a1-\uffff]+/g;
try {
  Ln = RegExp(`[\\p{L}\\p{N}_]+`, `gu`);
} catch {}
function Rn(e, t) {
  let n = e.resolve(t),
    r = n.node(),
    i = ``,
    a = t,
    o = t;
  for (let e = n.indexAfter(), o = !1; e > 0; e--) {
    let s = r.child(e - 1);
    if (!s.text) break;
    let c = a == t ? t - n.posAtIndex(e - 1) : s.text.length,
      l = c;
    for (; l > 0; l--)
      if (/\S/.test(s.text[l - 1])) o = !0;
      else if (o) break;
    if (((i = s.text.slice(l, c) + i), (a -= c - l), l || a < t - 50)) break;
  }
  for (let e = n.index(), a = !1; e < r.childCount; e++) {
    let s = r.child(e);
    if (!s.text) break;
    let c = o == t ? t - n.posAtIndex(e) : 0,
      l = c;
    for (; l < s.text.length; l++)
      if (/\S/.test(s.text[l])) a = !0;
      else if (a) break;
    if (((i += s.text.slice(c, l)), (o += l - c), l < s.text.length || o > t + 50)) break;
  }
  let c = a,
    l = o;
  if (Intl.Segmenter) {
    for (let n of new Intl.Segmenter(void 0, { granularity: `word` }).segment(i))
      if (n.isWordLike) {
        let r = n.index + a,
          i = r + n.segment.length;
        if (i < t) c = i;
        else if (r > t) {
          l = r;
          break;
        } else return s.create(e, r, i);
      }
  } else {
    Ln.lastIndex = 0;
    for (let n; (n = Ln.exec(i));) {
      let r = n.index + a,
        i = r + n[0].length;
      if (i < t) c = i;
      else if (r > t) {
        l = r;
        break;
      } else return s.create(e, r, i);
    }
  }
  let u = i.slice(c - a, t - a),
    d = i.slice(t - a, l - a),
    f = /\S*$/.exec(u)[0].length,
    p = /^\S*/.exec(d)[0].length;
  if (f || p) return s.create(e, t - f, t + p);
  let m = /\s*$/.exec(u)[0].length,
    h = /^\s*/.exec(d)[0].length;
  return s.create(e, t - m, t + h);
}
var zn = j ? `metaKey` : `ctrlKey`;
L.mousedown = (e, t) => {
  let n = t,
    r = Date.now();
  if (((e.input.shiftKey = n.shiftKey), e.input.lastTouch > r - 500)) return !1;
  B(e);
  let i = `singleClick`;
  (r - e.input.lastClick.time < 500 &&
    On(n, e.input.lastClick) &&
    !n[zn] &&
    e.input.lastClick.button == n.button &&
    (e.input.lastClick.type == `singleClick`
      ? (i = `doubleClick`)
      : e.input.lastClick.type == `doubleClick` && (i = `tripleClick`)),
    (e.input.lastClick = { time: r, x: n.clientX, y: n.clientY, type: i, button: n.button }),
    e.input.mouseDown && e.input.mouseDown.done());
  let a = e.posAtCoords(Dn(n));
  if (a) {
    if (n.button == 0) {
      if (!e.hasFocus()) {
        Oe(e.dom);
        let t = e.root.activeElement;
        t && !t.contains(e.dom) && t.blur();
      }
      (e.input.mouseDown = new Bn(e, a, n, i)).mightDrag || n.preventDefault();
    } else xn(e, `pointer`);
  }
};
var Bn = class {
  constructor(e, t, n, r) {
    ((this.view = e),
      (this.startPos = t),
      (this.event = n),
      (this.type = r),
      (this.didMove = !1),
      (this.lastPos = -1),
      (this.anchorRange = null),
      (this.startDoc = e.state.doc),
      (this.selectNode = !!n[zn]),
      (this.extend = n.shiftKey),
      (this.anchorDoc = this.startDoc));
    let i = Vn(e);
    if (this.extend) {
      let t = e.state.selection;
      this.anchorRange =
        t instanceof f ? { from: t.from, to: t.to } : { from: t.anchor, to: t.anchor };
      let n = t instanceof f ? e.nodeDOM(t.from).getBoundingClientRect() : e.coordsAtPos(t.anchor);
      this.anchorOffset = { x: (n.left + n.right) / 2 - i.x, y: (n.top + n.bottom) / 2 - i.y };
    } else this.anchorOffset = { x: n.clientX - i.x, y: n.clientY - i.y };
    if (r == `singleClick`) {
      let { selection: r } = e.state,
        i,
        a,
        o = !1;
      if (r instanceof f && r.from <= t.pos && r.to >= t.pos)
        ((a = r.from), (i = r.node), (o = !0));
      else if (t.inside > -1) ((i = e.state.doc.nodeAt(t.inside)), (a = t.inside));
      else {
        let n = e.state.doc.resolve(t.pos);
        ((i = n.parent), (a = n.depth ? n.before() : -1));
      }
      if (o || (a > -1 && i.type.spec.draggable && i.type.spec.selectable !== !1)) {
        let t = e.docView.descAt(a)?.nodeDOM;
        ((this.mightDrag = { node: i, elt: t, pos: a, addAttr: !1 }),
          t &&
            !t.draggable &&
            ((this.mightDrag.addAttr = !0), e.domObserver.stopped(() => (t.draggable = !0))));
      } else this.mightDrag = Un(e, n);
    } else this.mightDrag = !1;
    (e.root.addEventListener(`mouseup`, (this.up = this.up.bind(this))),
      e.root.addEventListener(`mousemove`, (this.move = this.move.bind(this))),
      this.mightDrag || this.select(this.startPos, !0));
  }
  done() {
    (this.view.root.removeEventListener(`mouseup`, this.up),
      this.view.root.removeEventListener(`mousemove`, this.move),
      this.view.input.mouseDown == this && (this.view.input.mouseDown = null),
      typeof this.mightDrag == `object` &&
        this.mightDrag.addAttr &&
        this.view.domObserver.stopped(() => this.mightDrag.elt.removeAttribute(`draggable`)));
  }
  maybeRunHandler(e, t) {
    return (this.type == `singleClick` ? Nn : this.type == `doubleClick` ? Pn : Fn)(
      this.view,
      e.pos,
      e.inside,
      t,
      this.selectNode,
    );
  }
  up(e) {
    if ((this.done(), !this.view.dom.contains(e.target))) return;
    let t = this.startPos;
    (this.view.state.doc != this.startDoc && (t = this.view.posAtCoords(Dn(e))),
      t && (this.didMove || this.maybeRunHandler(t, e) || this.select(t, !0), e.preventDefault()));
  }
  move(e) {
    if (e.buttons == 0) this.done();
    else {
      if (
        (!this.didMove &&
          (Math.abs(this.event.x - e.clientX) > 8 || Math.abs(this.event.y - e.clientY) > 8) &&
          ((this.didMove = !0), (this.mightDrag = !1)),
        !this.mightDrag)
      ) {
        let t = this.view.posAtCoords(Dn(e));
        t && this.select(t, !1);
      }
      e.preventDefault();
    }
  }
  select(e, t) {
    if (e.pos == this.lastPos) return;
    this.lastPos = e.pos;
    let { view: n } = this,
      { doc: r } = n.state,
      i =
        this.type == `singleClick`
          ? Hn(n, r, e)
          : this.type == `doubleClick`
            ? Rn(r, e.pos)
            : In(r, e.inside, t);
    i &&
      (t && !this.extend
        ? (this.anchorRange = i)
        : (!t || this.extend) &&
          (r.eq(this.anchorDoc) || this.restoreAnchor(),
          this.anchorRange && this.anchorRange.from < i.from
            ? (i = hn(n, r.resolve(this.anchorRange.from), r.resolve(i.to)))
            : this.anchorRange &&
              this.anchorRange.to > i.to &&
              (i = hn(n, r.resolve(this.anchorRange.to), r.resolve(i.from)))),
      i.eq(n.state.selection) ||
        n.dispatch(n.state.tr.setSelection(i).setMeta(`pointer`, !0).scrollIntoView()));
  }
  restoreAnchor() {
    let e = Vn(this.view),
      t = this.view.posAtCoords({
        left: this.anchorOffset.x + e.x,
        top: this.anchorOffset.y + e.y,
      });
    if (!t) this.anchorRange = null;
    else {
      let { doc: e } = this.view.state;
      ((this.anchorRange =
        this.type == `singleClick`
          ? Hn(this.view, e, t)
          : this.type == `doubleClick`
            ? Rn(e, t.pos)
            : In(e, t.inside, !1)),
        (this.anchorDoc = this.view.state.doc));
    }
  }
};
function Vn(e) {
  let t = e.dom.getBoundingClientRect();
  return { x: t.left - e.dom.scrollLeft, y: t.top - e.dom.scrollTop };
}
function Hn(e, t, n) {
  if (n.inside > -1) {
    let e = t.nodeAt(n.inside);
    if (e.isAtom && f.isSelectable(e)) return f.create(t, n.inside);
  }
  let r = t.resolve(n.pos);
  return hn(e, r, r);
}
function Un(e, t) {
  let { selection: n } = e.state;
  if (n.empty) return !1;
  let r = e.domSelection();
  if (!r || r.rangeCount == 0) return !0;
  let i = r.getRangeAt(0).getClientRects();
  for (let e = 0; e < i.length; e++) {
    let n = i[e];
    if (n.left <= t.clientX && n.right >= t.clientX && n.top <= t.clientY && n.bottom >= t.clientY)
      return !0;
  }
  return !1;
}
((L.touchstart = (e) => {
  ((e.input.lastTouch = Date.now()), B(e), xn(e, `pointer`));
}),
  (L.touchmove = (e) => {
    ((e.input.lastTouch = Date.now()), xn(e, `pointer`));
  }),
  (L.contextmenu = (e) => B(e)));
function Wn(e, t) {
  return e.composing
    ? !0
    : A && Math.abs(Date.now() - e.input.compositionEndedAt) < 500
      ? ((e.input.compositionEndedAt = -2e8), !0)
      : !1;
}
var Gn = M ? 5e3 : -1;
R.compositionstart = R.compositionupdate = (e) => {
  if (!e.composing) {
    e.domObserver.flush();
    let { state: t } = e,
      n = t.selection.$to;
    if (
      t.selection instanceof s &&
      t.selection.empty &&
      (t.storedMarks ||
        (!n.textOffset &&
          n.parentOffset &&
          n.nodeBefore.marks.some((e) => e.type.spec.inclusive === !1)) ||
        (k && _e && Kn(e)))
    )
      ((e.markCursor = e.state.storedMarks || n.marks()), B(e, !0), (e.markCursor = null));
    else if (
      (B(e, !t.selection.empty),
      O &&
        e.domSel.active &&
        t.selection.empty &&
        n.parentOffset &&
        !n.textOffset &&
        n.nodeBefore.marks.length)
    )
      for (let { focusNode: t, focusOffset: n } = e.domSel.range; t && T(t) && n != 0;) {
        let r = n < 0 ? t.lastChild : t.childNodes[n - 1];
        if (!r) break;
        if (E(r)) {
          let t = e.domSelection();
          t && t.collapse(r, r.nodeValue.length);
          break;
        }
        ((t = r), (n = -1));
      }
    e.input.composing = !0;
  }
  Jn(e, Gn);
};
function Kn(e) {
  let { focusNode: t, focusOffset: n } = e.domSel.range;
  if (!t || !T(t) || n >= t.childNodes.length) return !1;
  let r = t.childNodes[n];
  return T(r) && r.contentEditable == `false`;
}
R.compositionend = (e, t) => {
  e.composing && qn(e);
};
function qn(e, t = !1) {
  ((e.input.composing = !1),
    (e.input.compositionEndedAt = Date.now()),
    (e.input.compositionPendingChanges = e.domObserver.pendingRecords().length
      ? e.input.compositionID
      : 0),
    (e.input.compositionNode = null),
    e.input.badSafariComposition
      ? e.domObserver.forceFlush()
      : e.input.compositionPendingChanges && Promise.resolve().then(() => e.domObserver.flush()),
    e.input.compositionID++,
    t ? B(e) : Jn(e, 20));
}
function Jn(e, t) {
  (clearTimeout(e.input.composingTimeout),
    t > -1 && (e.input.composingTimeout = setTimeout(() => B(e), t)));
}
function Yn(e) {
  e.composing && ((e.input.composing = !1), (e.input.compositionEndedAt = Date.now()));
  for (let t; (t = e.input.compositionNodes.pop());) t.markParentDamage();
}
function Xn(e) {
  let t = e.domSel.range;
  if (!e.domSel.active || !t.focusNode) return null;
  let n = re(t.focusNode, t.focusOffset),
    r = ie(t.focusNode, t.focusOffset);
  if (n && r && n != r) {
    let t = r.pmViewDesc,
      i = e.domObserver.lastChangedTextNode;
    if (n == i || r == i) return i;
    if (!t || !t.isText(r.nodeValue)) return r;
    if (e.input.compositionNode == r) {
      let e = n.pmViewDesc;
      if (e && e.isText(n.nodeValue)) return r;
    }
  }
  return n || r;
}
function B(e, t = !1) {
  if (
    !(M && e.domObserver.flushingSoon >= 0) &&
    (e.domObserver.forceFlush(), Yn(e), t || (e.docView && e.docView.damage))
  ) {
    let n = tn(e, e.domSel.readRange()),
      r = e.state.selection;
    n && !n.eq(r)
      ? e.dispatch(e.state.tr.setSelection(n))
      : (e.markCursor || t) && !r.$from.node(r.$from.sharedDepth(r.to)).inlineContent
        ? e.dispatch(e.state.tr.deleteSelection())
        : e.updateState(e.state);
  }
}
function Zn(e, t) {
  if (!e.dom.parentNode) return;
  let n = e.dom.parentNode.appendChild(document.createElement(`div`));
  (n.appendChild(t), (n.style.cssText = `position: fixed; left: -10000px; top: 10px`));
  let r = getSelection(),
    i = document.createRange();
  (i.selectNodeContents(t),
    e.dom.blur(),
    r.removeAllRanges(),
    r.addRange(i),
    setTimeout(() => {
      (n.parentNode && n.parentNode.removeChild(n), e.focus());
    }, 50));
}
var Qn = ge && ye < 604;
L.copy = R.cut = (e, t) => {
  let n = t,
    r = e.state.selection,
    i = n.type == `cut`;
  if (r.empty) return;
  let a = Qn ? null : n.clipboardData,
    { dom: o, text: s } = It(e, r.content());
  (a
    ? (n.preventDefault(),
      a.clearData(),
      a.setData(`text/html`, o.innerHTML),
      a.setData(`text/plain`, s))
    : Zn(e, o),
    i && e.dispatch(e.state.tr.deleteSelection().scrollIntoView().setMeta(`uiEvent`, `cut`)));
};
function $n(e) {
  return e.openStart == 0 && e.openEnd == 0 && e.content.childCount == 1
    ? e.content.firstChild
    : null;
}
function er(e, t) {
  if (!e.dom.parentNode) return;
  let n = e.input.shiftKey || e.state.selection.$from.parent.type.spec.code,
    r = e.dom.parentNode.appendChild(document.createElement(n ? `textarea` : `div`));
  (n || (r.contentEditable = `true`),
    (r.style.cssText = `position: fixed; left: -10000px; top: 10px`),
    r.focus());
  let i = e.input.shiftKey && e.input.lastKeyCode != 45;
  setTimeout(() => {
    (e.focus(),
      r.parentNode && r.parentNode.removeChild(r),
      n ? tr(e, r.value, null, i, t) : tr(e, r.textContent, r.innerHTML, i, t));
  }, 50);
}
function tr(e, t, n, r, i) {
  let a = Lt(e, t, n, r, e.state.selection.$from);
  if (e.someProp(`handlePaste`, (t) => t(e, i, a || l.empty))) return !0;
  if (!a) return !1;
  let o = $n(a),
    s = o ? e.state.tr.replaceSelectionWith(o, r) : e.state.tr.replaceSelection(a);
  return (e.dispatch(s.scrollIntoView().setMeta(`paste`, !0).setMeta(`uiEvent`, `paste`)), !0);
}
function nr(e) {
  let t = e.getData(`text/plain`) || e.getData(`Text`);
  if (t) return t;
  let n = e.getData(`text/uri-list`);
  return n ? n.replace(/\r?\n/g, ` `) : ``;
}
R.paste = (e, t) => {
  let n = t;
  if (e.composing && !M) return;
  let r = Qn ? null : n.clipboardData,
    i = e.input.shiftKey && e.input.lastKeyCode != 45;
  r && tr(e, nr(r), r.getData(`text/html`), i, n) ? n.preventDefault() : er(e, n);
};
var rr = class {
    constructor(e, t, n) {
      ((this.slice = e), (this.move = t), (this.node = n));
    }
  },
  ir = j ? `altKey` : `ctrlKey`;
function ar(e, t) {
  let n;
  return (
    e.someProp(`dragCopies`, (e) => {
      n ||= e(t);
    }),
    n == null ? !t[ir] : !n
  );
}
((L.dragstart = (e, t) => {
  let n = t,
    r = e.input.mouseDown;
  if ((r && r.done(), !n.dataTransfer)) return;
  let i = e.state.selection,
    a = i.empty ? null : e.posAtCoords(Dn(n)),
    o;
  if (!(a && a.pos >= i.from && a.pos <= (i instanceof f ? i.to - 1 : i.to))) {
    if (r && typeof r.mightDrag == `object`) o = f.create(e.state.doc, r.mightDrag.pos);
    else if (n.target && T(n.target)) {
      let t = e.docView.nearestDesc(n.target, !0);
      t && t.node.type.spec.draggable && t != e.docView && (o = f.create(e.state.doc, t.posBefore));
    }
  }
  let { dom: s, text: c, slice: l } = It(e, (o || e.state.selection).content());
  ((!n.dataTransfer.files.length || !k || he > 120) && n.dataTransfer.clearData(),
    n.dataTransfer.setData(Qn ? `Text` : `text/html`, s.innerHTML),
    (n.dataTransfer.effectAllowed = `copyMove`),
    Qn || n.dataTransfer.setData(`text/plain`, c),
    (e.dragging = new rr(l, ar(e, n), o)));
}),
  (L.dragend = (e) => {
    let t = e.dragging;
    window.setTimeout(() => {
      e.dragging == t && (e.dragging = null);
    }, 50);
  }),
  (R.dragover = R.dragenter = (e, t) => t.preventDefault()),
  (R.drop = (e, t) => {
    try {
      or(e, t, e.dragging);
    } finally {
      e.dragging = null;
    }
  }));
function or(e, t, n) {
  if (!t.dataTransfer) return;
  let r = e.posAtCoords(Dn(t));
  if (!r) return;
  let i = e.state.doc.resolve(r.pos),
    o = n && n.slice;
  o
    ? e.someProp(`transformPasted`, (t) => {
        o = t(o, e, !1);
      })
    : (o = Lt(e, nr(t.dataTransfer), Qn ? null : t.dataTransfer.getData(`text/html`), !1, i));
  let s = !!(n && ar(e, t));
  if (e.someProp(`handleDrop`, (n) => n(e, t, o || l.empty, s))) {
    t.preventDefault();
    return;
  }
  if (!o) return;
  t.preventDefault();
  let c = o ? a(e.state.doc, i.pos, o) : i.pos;
  c ??= i.pos;
  let u = e.state.tr;
  if (s) {
    let { node: e } = n;
    e ? e.replace(u) : u.deleteSelection();
  }
  let d = u.mapping.map(c),
    p = o.openStart == 0 && o.openEnd == 0 && o.content.childCount == 1,
    m = u.doc;
  if ((p ? u.replaceRangeWith(d, d, o.content.firstChild) : u.replaceRange(d, d, o), u.doc.eq(m)))
    return;
  let h = u.doc.resolve(d);
  if (
    p &&
    f.isSelectable(o.content.firstChild) &&
    h.nodeAfter &&
    h.nodeAfter.sameMarkup(o.content.firstChild)
  )
    u.setSelection(new f(h));
  else {
    let t = u.mapping.map(c);
    (u.mapping.maps[u.mapping.maps.length - 1].forEach((e, n, r, i) => (t = i)),
      u.setSelection(hn(e, h, u.doc.resolve(t))));
  }
  (e.focus(), e.dispatch(u.setMeta(`uiEvent`, `drop`)));
}
((L.focus = (e) => {
  if (
    ((e.input.lastFocus = Date.now()),
    !e.focused &&
      (e.domObserver.stopped(() => e.dom.classList.add(`ProseMirror-focused`)),
      (e.focused = !0),
      e.domSel.read(),
      !e.domSel.synced))
  ) {
    let t = e.domSel.range;
    setTimeout(() => {
      let n = e.domSel.readRange();
      n && t.eq(n) && e.domSel.sync();
    }, 20);
  }
}),
  (L.blur = (e, t) => {
    let n = t;
    e.focused &&=
      (e.domObserver.stopped(() => e.dom.classList.remove(`ProseMirror-focused`)),
      n.relatedTarget && e.dom.contains(n.relatedTarget) && e.domSel.deactivate(),
      !1);
  }),
  (L.beforeinput = (e, t) => {
    if (M && t.inputType == `deleteContentBackward`) {
      e.domObserver.flushSoon();
      let { domChangeCount: t } = e.input;
      setTimeout(() => {
        if (
          e.input.domChangeCount != t ||
          e.domObserver.pendingRecords().length ||
          (e.dom.blur(), e.focus(), z(e, `Backspace`))
        )
          return;
        let { $cursor: n } = e.state.selection;
        n && n.pos > 0 && e.dispatch(e.state.tr.delete(n.pos - 1, n.pos).scrollIntoView());
      }, 50);
    }
  }));
for (let e in R) L[e] = R[e];
function sr(e, t) {
  if (e == t) return !0;
  for (let n in e) if (e[n] !== t[n]) return !1;
  for (let n in t) if (!(n in e)) return !1;
  return !0;
}
var cr = class {
    constructor(e) {
      ((this.frag = e), (this.index = 0), (this.off = 0));
    }
    nodeAt(e) {
      for (; this.off <= e && this.index < this.frag.childCount;) {
        let t = this.frag.child(this.index);
        if (this.off == e) return t;
        ((this.off += t.nodeSize), this.index++);
      }
      return null;
    }
  },
  lr = class e {
    constructor(e, t) {
      ((this.toDOM = e), (this.spec = t || pr), (this.side = this.spec.side || 0));
    }
    map(e, t, n, r) {
      let { pos: i, deleted: a } = e.mapResult(t.from + r, this.side < 0 ? -1 : 1);
      return a ? null : new V(i - n, i - n, this);
    }
    valid() {
      return !0;
    }
    eq(t) {
      return (
        this == t ||
        (t instanceof e &&
          ((this.spec.key && this.spec.key == t.spec.key) ||
            (this.toDOM == t.toDOM && sr(this.spec, t.spec))))
      );
    }
    destroy(e) {
      this.spec.destroy && this.spec.destroy(e);
    }
  },
  ur = class e {
    constructor(e, t) {
      ((this.attrs = e), (this.spec = t || pr));
    }
    map(e, t, n, r) {
      let i = e.map(t.from + r, this.spec.inclusiveStart ? -1 : 1) - n,
        a = e.map(t.to + r, this.spec.inclusiveEnd ? 1 : -1) - n;
      return i >= a ? null : new V(i, a, this);
    }
    valid(e, t) {
      return t.from < t.to;
    }
    eq(t) {
      return this == t || (t instanceof e && sr(this.attrs, t.attrs) && sr(this.spec, t.spec));
    }
    static is(t) {
      return t.type instanceof e;
    }
    destroy() {}
  },
  dr = class e {
    constructor(e, t) {
      ((this.attrs = e), (this.spec = t || pr));
    }
    map(e, t, n, r) {
      let i = e.mapResult(t.from + r, 1);
      if (i.deleted) return null;
      let a = e.mapResult(t.to + r, -1);
      return a.deleted || a.pos <= i.pos ? null : new V(i.pos - n, a.pos - n, this);
    }
    valid(e, t, n) {
      let r = n.nodeAt(t.from);
      return !!r && !r.isText && t.from + r.nodeSize == t.to;
    }
    eq(t) {
      return this == t || (t instanceof e && sr(this.attrs, t.attrs) && sr(this.spec, t.spec));
    }
    destroy() {}
  },
  V = class e {
    constructor(e, t, n) {
      ((this.from = e), (this.to = t), (this.type = n));
    }
    copy(t, n) {
      return new e(t, n, this.type);
    }
    eq(e, t = 0) {
      return this.type.eq(e.type) && this.from + t == e.from && this.to + t == e.to;
    }
    map(e, t, n) {
      return this.type.map(e, this, t, n);
    }
    static widget(t, n, r) {
      return new e(t, t, new lr(n, r));
    }
    static inline(t, n, r, i) {
      return new e(t, n, new ur(r, i));
    }
    static node(t, n, r, i) {
      return new e(t, n, new dr(r, i));
    }
    get spec() {
      return this.type.spec;
    }
    get inline() {
      return this.type instanceof ur;
    }
    get widget() {
      return this.type instanceof lr;
    }
  },
  fr = [],
  pr = {},
  H = class e {
    constructor(e, t) {
      ((this.local = e.length ? e : fr), (this.children = t.length ? t : fr));
    }
    static create(e, t) {
      return t.length ? br(t, e, 0, pr) : U;
    }
    find(e, t, n) {
      let r = [];
      return (this.findInner(e ?? 0, t ?? 1e9, r, 0, n), r);
    }
    findInner(e, t, n, r, i) {
      for (let a = 0; a < this.local.length; a++) {
        let o = this.local[a];
        if (o.from > t) break;
        o.to >= e && (!i || i(o.spec)) && n.push(o.copy(o.from + r, o.to + r));
      }
      for (let a = 0; a < this.children.length && !(this.children[a] >= t); a += 3)
        if (this.children[a + 1] > e) {
          let o = this.children[a] + 1;
          this.children[a + 2].findInner(e - o, t - o, n, r + o, i);
        }
    }
    map(e, t, n) {
      return this == U || e.maps.length == 0 ? this : this.mapInner(e, t, 0, 0, n || pr);
    }
    mapInner(t, n, r, i, a) {
      let o;
      if (this.local.length) {
        let e = new cr(n.content);
        for (let s = 0; s < this.local.length; s++) {
          let c = this.local[s].map(t, r, i);
          c && c.type.valid(n, c, e)
            ? (o ||= []).push(c)
            : a.onRemove && a.onRemove(this.local[s].spec);
        }
      }
      return this.children.length
        ? hr(this.children, o || [], t, n, r, i, a)
        : o
          ? new e(o.sort(W), fr)
          : U;
    }
    add(t, n) {
      return n.length ? (this == U ? e.create(t, n) : this.addInner(t, n, 0)) : this;
    }
    addInner(t, n, r) {
      let i,
        a = 0;
      t.forEach((e, t) => {
        let o = t + r,
          s;
        if ((s = vr(n, e, o))) {
          for (i ||= this.children.slice(); a < i.length && i[a] < t;) a += 3;
          (i[a] == t
            ? (i[a + 2] = i[a + 2].addInner(e, s, o + 1))
            : i.splice(a, 0, t, t + e.nodeSize, br(s, e, o + 1, pr)),
            (a += 3));
        }
      });
      let o = gr(a ? yr(n) : n, -r).sort(W);
      if (o.length) {
        let e = new cr(t.content);
        for (let n = 0; n < o.length; n++) o[n].type.valid(t, o[n], e) || o.splice(n--, 1);
      }
      return new e(o.length ? this.local.concat(o).sort(W) : this.local, i || this.children);
    }
    remove(e) {
      return e.length == 0 || this == U ? this : this.removeInner(e, 0);
    }
    removeInner(t, n) {
      let r = this.children,
        i = this.local;
      for (let e = 0; e < r.length; e += 3) {
        let i,
          a = r[e] + n,
          o = r[e + 1] + n;
        for (let e = 0, n; e < t.length; e++)
          (n = t[e]) && n.from > a && n.to < o && ((t[e] = null), (i ||= []).push(n));
        if (!i) continue;
        r == this.children && (r = this.children.slice());
        let s = r[e + 2].removeInner(i, a + 1);
        s == U ? (r.splice(e, 3), (e -= 3)) : (r[e + 2] = s);
      }
      if (i.length) {
        for (let e = 0, r; e < t.length; e++)
          if ((r = t[e]))
            for (let e = 0; e < i.length; e++)
              i[e].eq(r, n) && (i == this.local && (i = this.local.slice()), i.splice(e--, 1));
      }
      return r == this.children && i == this.local ? this : i.length || r.length ? new e(i, r) : U;
    }
    forChild(t, n) {
      if (this == U) return this;
      if (n.isLeaf) return e.empty;
      let r,
        i,
        a = 0,
        o = this.children.length / 3;
      for (; a < o;) {
        let e = (a + o) >>> 1,
          n = e * 3,
          i = this.children[n];
        if (i < t) a = e + 1;
        else if (i > t) o = e;
        else {
          r = this.children[n + 2];
          break;
        }
      }
      let s = t + 1,
        c = s + n.content.size;
      for (let e = 0; e < this.local.length; e++) {
        let t = this.local[e];
        if (t.from < c && t.to > s && t.type instanceof ur) {
          let e = Math.max(s, t.from) - s,
            n = Math.min(c, t.to) - s;
          e < n && (i ||= []).push(t.copy(e, n));
        }
      }
      if (i) {
        let t = new e(i.sort(W), fr);
        return r ? new mr([t, r]) : t;
      }
      return r || U;
    }
    eq(t) {
      if (this == t) return !0;
      if (
        !(t instanceof e) ||
        this.local.length != t.local.length ||
        this.children.length != t.children.length
      )
        return !1;
      for (let e = 0; e < this.local.length; e++) if (!this.local[e].eq(t.local[e])) return !1;
      for (let e = 0; e < this.children.length; e += 3)
        if (
          this.children[e] != t.children[e] ||
          this.children[e + 1] != t.children[e + 1] ||
          !this.children[e + 2].eq(t.children[e + 2])
        )
          return !1;
      return !0;
    }
    locals(e) {
      return xr(this.localsInner(e));
    }
    localsInner(e) {
      if (this == U) return fr;
      if (e.inlineContent || !this.local.some(ur.is)) return this.local;
      let t = [];
      for (let e = 0; e < this.local.length; e++)
        this.local[e].type instanceof ur || t.push(this.local[e]);
      return t;
    }
    forEachSet(e) {
      e(this);
    }
  };
((H.empty = new H([], [])), (H.removeOverlap = xr));
var U = H.empty,
  mr = class e {
    constructor(e) {
      this.members = e;
    }
    map(t, n) {
      let r = this.members.map((e) => e.map(t, n, pr));
      return e.from(r);
    }
    forChild(t, n) {
      if (n.isLeaf) return H.empty;
      let r = [];
      for (let i = 0; i < this.members.length; i++) {
        let a = this.members[i].forChild(t, n);
        a != U && (a instanceof e ? (r = r.concat(a.members)) : r.push(a));
      }
      return e.from(r);
    }
    eq(t) {
      if (!(t instanceof e) || t.members.length != this.members.length) return !1;
      for (let e = 0; e < this.members.length; e++)
        if (!this.members[e].eq(t.members[e])) return !1;
      return !0;
    }
    locals(e) {
      let t,
        n = !0;
      for (let r = 0; r < this.members.length; r++) {
        let i = this.members[r].localsInner(e);
        if (i.length) {
          if (!t) t = i;
          else {
            n &&= ((t = t.slice()), !1);
            for (let e = 0; e < i.length; e++) t.push(i[e]);
          }
        }
      }
      return t ? xr(n ? t : t.sort(W)) : fr;
    }
    static from(t) {
      switch (t.length) {
        case 0:
          return U;
        case 1:
          return t[0];
        default:
          return new e(
            t.every((e) => e instanceof H)
              ? t
              : t.reduce((e, t) => e.concat(t instanceof H ? t : t.members), []),
          );
      }
    }
    forEachSet(e) {
      for (let t = 0; t < this.members.length; t++) this.members[t].forEachSet(e);
    }
  };
function hr(e, t, n, r, i, a, o) {
  let s = e.slice();
  for (let e = 0, t = a; e < n.maps.length; e++) {
    let r = 0;
    (n.maps[e].forEach((e, n, i, a) => {
      let o = a - i - (n - e);
      for (let i = 0; i < s.length; i += 3) {
        let a = s[i + 1];
        if (a < 0 || e > a + t - r) continue;
        let c = s[i] + t - r;
        n >= c ? (s[i + 1] = e <= c ? -2 : -1) : e >= t && o && ((s[i] += o), (s[i + 1] += o));
      }
      r += o;
    }),
      (t = n.maps[e].map(t, -1)));
  }
  let c = !1;
  for (let t = 0; t < s.length; t += 3)
    if (s[t + 1] < 0) {
      if (s[t + 1] == -2) {
        ((c = !0), (s[t + 1] = -1));
        continue;
      }
      let l = n.map(e[t] + a),
        u = l - i;
      if (u < 0 || u >= r.content.size) {
        c = !0;
        continue;
      }
      let d = n.map(e[t + 1] + a, -1) - i,
        { index: f, offset: p } = r.content.findIndex(u),
        m = r.maybeChild(f);
      if (m && p == u && p + m.nodeSize == d) {
        let r = s[t + 2].mapInner(n, m, l + 1, e[t] + a + 1, o);
        r == U ? ((s[t + 1] = -2), (c = !0)) : ((s[t] = u), (s[t + 1] = d), (s[t + 2] = r));
      } else c = !0;
    }
  if (c) {
    let c = br(_r(s, e, t, n, i, a, o), r, 0, o);
    t = c.local;
    for (let e = 0; e < s.length; e += 3) s[e + 1] < 0 && (s.splice(e, 3), (e -= 3));
    for (let e = 0, t = 0; e < c.children.length; e += 3) {
      let n = c.children[e];
      for (; t < s.length && s[t] < n;) t += 3;
      s.splice(t, 0, c.children[e], c.children[e + 1], c.children[e + 2]);
    }
  }
  return new H(t.sort(W), s);
}
function gr(e, t) {
  if (!t || !e.length) return e;
  let n = [];
  for (let r = 0; r < e.length; r++) {
    let i = e[r];
    n.push(new V(i.from + t, i.to + t, i.type));
  }
  return n;
}
function _r(e, t, n, r, i, a, o) {
  function s(e, t) {
    for (let a = 0; a < e.local.length; a++) {
      let s = e.local[a].map(r, i, t);
      s ? n.push(s) : o.onRemove && o.onRemove(e.local[a].spec);
    }
    for (let n = 0; n < e.children.length; n += 3) s(e.children[n + 2], e.children[n] + t + 1);
  }
  for (let n = 0; n < e.length; n += 3) e[n + 1] == -1 && s(e[n + 2], t[n] + a + 1);
  return n;
}
function vr(e, t, n) {
  if (t.isLeaf) return null;
  let r = n + t.nodeSize,
    i = null;
  for (let t = 0, a; t < e.length; t++)
    (a = e[t]) && a.from > n && a.to < r && ((i ||= []).push(a), (e[t] = null));
  return i;
}
function yr(e) {
  let t = [];
  for (let n = 0; n < e.length; n++) e[n] != null && t.push(e[n]);
  return t;
}
function br(e, t, n, r) {
  let i = [],
    a = !1;
  t.forEach((t, o) => {
    let s = vr(e, t, o + n);
    if (s) {
      a = !0;
      let e = br(s, t, n + o + 1, r);
      e != U && i.push(o, o + t.nodeSize, e);
    }
  });
  let o = gr(a ? yr(e) : e, -n).sort(W);
  if (o.length) {
    let e = new cr(t.content);
    for (let n = 0; n < o.length; n++)
      o[n].type.valid(t, o[n], e) || (r.onRemove && r.onRemove(o[n].spec), o.splice(n--, 1));
  }
  return o.length || i.length ? new H(o, i) : U;
}
function W(e, t) {
  return e.from - t.from || e.to - t.to;
}
function xr(e) {
  let t = e;
  for (let n = 0; n < t.length - 1; n++) {
    let r = t[n];
    if (r.from != r.to)
      for (let i = n + 1; i < t.length; i++) {
        let a = t[i];
        if (a.from == r.from)
          a.to != r.to &&
            (t == e && (t = e.slice()),
            (t[i] = a.copy(a.from, r.to)),
            Sr(t, i + 1, a.copy(r.to, a.to)));
        else {
          a.from < r.to &&
            (t == e && (t = e.slice()),
            (t[n] = r.copy(r.from, a.from)),
            Sr(t, i, r.copy(a.from, r.to)));
          break;
        }
      }
  }
  return t;
}
function Sr(e, t, n) {
  for (; t < e.length && W(n, e[t]) > 0;) t++;
  e.splice(t, 0, n);
}
function Cr(e) {
  let t = [];
  return (
    e.someProp(`decorations`, (n) => {
      let r = n(e.state);
      r && r != U && t.push(r);
    }),
    e.cursorWrapper && t.push(H.create(e.state.doc, [e.cursorWrapper.deco])),
    mr.from(t)
  );
}
function wr(e, t, n, r) {
  let { node: i, fromOffset: a, toOffset: o, from: s, to: c } = e.docView.parseRange(t, n),
    l = e.domSel.range,
    u,
    d = l.anchorNode;
  if (
    (d &&
      ne(e.dom, d) &&
      ((u = [{ node: d, offset: l.anchorOffset }]),
      se(l) || u.push({ node: l.focusNode, offset: l.focusOffset })),
    k && e.input.lastKeyCode === 8)
  )
    for (let e = o; e > a; e--) {
      let t = i.childNodes[e - 1],
        n = t.pmViewDesc;
      if (t.nodeName == `BR` && !n) {
        o = e;
        break;
      }
      if (!n || n.size) break;
    }
  let f = e.state.doc,
    p = e.someProp(`domParser`) || g.fromSchema(e.state.schema),
    m = f.resolve(s),
    h = null,
    _ = p.parse(i, {
      topNode: m.parent,
      topMatch: m.parent.contentMatchAt(m.index()),
      topOpen: !0,
      from: a,
      to: o,
      preserveWhitespace: m.parent.type.whitespace != `pre` || `full`,
      findPositions: u,
      ruleFromNode: Tr(r),
      context: m,
    });
  if (u && u[0].pos != null) {
    let e = u[0].pos,
      t = u[1] && u[1].pos;
    ((t ??= e), (h = { anchor: e + s, head: t + s }));
  }
  return { doc: _, sel: h, from: s, to: c };
}
var Tr = (e) => (t) => {
    let n = t.pmViewDesc;
    if (n) return n.parseRule(e);
    if (t.nodeName == `BR` && t.parentNode) {
      if (A && /^(ul|ol)$/i.test(t.parentNode.nodeName)) {
        let e = document.createElement(`div`);
        return (e.appendChild(document.createElement(`li`)), { skip: e });
      }
      if (t.parentNode.lastChild == t || (A && /^(tr|table)$/i.test(t.parentNode.nodeName)))
        return { ignore: !0 };
    } else if (t.nodeName == `IMG` && t.getAttribute(`mark-placeholder`)) return { ignore: !0 };
    return null;
  },
  Er =
    /^(a|abbr|acronym|b|bd[io]|big|br|button|cite|code|data(list)?|del|dfn|em|i|img|ins|kbd|label|map|mark|meter|output|q|ruby|s|samp|small|span|strong|su[bp]|time|u|tt|var)$/i;
function Dr(e, t, n, r, i, a) {
  let o = e.input.compositionPendingChanges || (e.composing ? e.input.compositionID : 0);
  if (((e.input.compositionPendingChanges = 0), t < 0)) {
    let t = e.input.lastSelectionTime > Date.now() - 50 ? e.input.lastSelectionOrigin : null,
      n = tn(e, e.domSel.range, t);
    if (n && !e.state.selection.eq(n) && e.domSel.active) {
      if (
        k &&
        M &&
        e.input.lastKeyCode === 13 &&
        Date.now() - 100 < e.input.lastKeyCodeTime &&
        z(e, `Enter`)
      )
        return;
      let r = e.state.tr.setSelection(n);
      (t == `pointer` ? r.setMeta(`pointer`, !0) : t == `key` && r.scrollIntoView(),
        o && r.setMeta(`composition`, o),
        e.dispatch(r));
    }
    return;
  }
  let c = e.state.doc.resolve(t),
    l = c.sharedDepth(n);
  ((t = c.before(l + 1)), (n = e.state.doc.resolve(n).after(l + 1)));
  let u = e.state.selection,
    d = wr(e, t, n, a),
    f = e.state.doc,
    p = f.slice(d.from, d.to),
    m,
    h;
  (e.input.lastKeyCode === 8 && Date.now() - 100 < e.input.lastKeyCodeTime
    ? ((m = e.state.selection.to), (h = `end`))
    : ((m = e.state.selection.from), (h = `start`)),
    (e.input.lastKeyCode = null));
  let g = Nr(p.content, d.doc.content, d.from, m, h);
  if (
    (g && e.input.domChangeCount++,
    ((ge && e.input.lastIOSEnter > Date.now() - 225) || M) &&
      a.some((e) => T(e) && !Er.test(e.nodeName)) &&
      (!g || g.endA >= g.endB) &&
      z(e, `Enter`))
  ) {
    e.input.lastIOSEnter = 0;
    return;
  }
  if (!g) {
    if (
      i &&
      u instanceof s &&
      !u.empty &&
      u.$head.sameParent(u.$anchor) &&
      !e.composing &&
      !(d.sel && d.sel.anchor != d.sel.head)
    )
      g = { start: u.from, endA: u.to, endB: u.to };
    else {
      if (d.sel) {
        let t = Or(e, e.state.doc, d.sel);
        if (t && !t.eq(e.state.selection)) {
          let n = e.state.tr.setSelection(t);
          (o && n.setMeta(`composition`, o), e.dispatch(n));
        }
      }
      return;
    }
  }
  e.state.selection.from < e.state.selection.to &&
    g.start == g.endB &&
    e.state.selection instanceof s &&
    (g.start > e.state.selection.from &&
    g.start <= e.state.selection.from + 2 &&
    e.state.selection.from >= d.from
      ? (g.start = e.state.selection.from)
      : g.endA < e.state.selection.to &&
        g.endA >= e.state.selection.to - 2 &&
        e.state.selection.to <= d.to &&
        ((g.endB += e.state.selection.to - g.endA), (g.endA = e.state.selection.to)));
  let _ = d.doc.resolveNoCache(g.start - d.from),
    v = d.doc.resolveNoCache(g.endB - d.from),
    y = f.resolve(g.start),
    b = _.sameParent(v) && _.parent.inlineContent && y.end() >= g.endA;
  if (
    ((ge &&
      e.input.lastIOSEnter > Date.now() - 225 &&
      (!b || a.some((e) => e.nodeName == `DIV` || e.nodeName == `P`))) ||
      (!b && jr(d.doc, _.pos, v.pos))) &&
    z(e, `Enter`)
  ) {
    e.input.lastIOSEnter = 0;
    return;
  }
  if (
    e.state.selection.anchor > g.start &&
    (b ? g.endA > g.start && g.endB == g.start : Ar(f, g.start, g.endA, _, v)) &&
    z(e, `Backspace`)
  ) {
    M && k && e.domSel.suppressChanges();
    return;
  }
  (k && g.endB == g.start && (e.input.lastChromeDelete = Date.now()),
    M &&
      !b &&
      _.start() != v.start() &&
      v.parentOffset == 0 &&
      _.depth == v.depth &&
      d.sel &&
      d.sel.anchor == d.sel.head &&
      d.sel.head == g.endA &&
      ((g.endB -= 2),
      (v = d.doc.resolveNoCache(g.endB - d.from)),
      setTimeout(() => z(e, `Enter`), 20)));
  let x = g.start,
    S = g.endA,
    C = (t) => {
      let n = t || e.state.tr.replace(x, S, d.doc.slice(g.start - d.from, g.endB - d.from));
      if (d.sel) {
        let t = Or(e, n.doc, d.sel);
        t &&
          !(
            k &&
            e.composing &&
            t.empty &&
            (g.start != g.endB || e.input.lastChromeDelete < Date.now() - 100) &&
            (t.head == x || t.head == n.mapping.map(S) - 1)
          ) &&
          n.setSelection(t);
      }
      return (o && n.setMeta(`composition`, o), n.scrollIntoView());
    },
    ee;
  if (b) {
    if (_.pos == v.pos) {
      let t = C(e.state.tr.delete(x, S)),
        n = f.resolve(g.start).marksAcross(f.resolve(g.endA));
      (n && t.ensureMarks(n), e.dispatch(t));
    } else if (
      g.endA == g.endB &&
      (ee = kr(
        _.parent.content.cut(_.parentOffset, v.parentOffset),
        y.parent.content.cut(y.parentOffset, g.endA - y.start()),
      ))
    ) {
      let t = C(e.state.tr);
      (ee.type == `add` ? t.addMark(x, S, ee.mark) : t.removeMark(x, S, ee.mark), e.dispatch(t));
    } else if (_.parent.child(_.index()).isText && _.index() == v.index() - +!v.textOffset) {
      let t = _.parent.textBetween(_.parentOffset, v.parentOffset),
        n = () => C(e.state.tr.insertText(t, x, S));
      e.someProp(`handleTextInput`, (r) => r(e, x, S, t, n)) || e.dispatch(n());
    } else e.dispatch(C());
  } else e.dispatch(C());
}
function Or(e, t, n) {
  return Math.max(n.anchor, n.head) > t.content.size
    ? null
    : hn(e, t.resolve(n.anchor), t.resolve(n.head));
}
function kr(e, t) {
  let r = e.firstChild.marks,
    i = t.firstChild.marks,
    a = r,
    o = i,
    s,
    c,
    l;
  for (let e = 0; e < i.length; e++) a = i[e].removeFromSet(a);
  for (let e = 0; e < r.length; e++) o = r[e].removeFromSet(o);
  if (a.length == 1 && o.length == 0)
    ((c = a[0]), (s = `add`), (l = (e) => e.mark(c.addToSet(e.marks))));
  else if (a.length == 0 && o.length == 1)
    ((c = o[0]), (s = `remove`), (l = (e) => e.mark(c.removeFromSet(e.marks))));
  else return null;
  let u = [];
  for (let e = 0; e < t.childCount; e++) u.push(l(t.child(e)));
  if (n.from(u).eq(e)) return { mark: c, type: s };
}
function Ar(e, t, n, r, i) {
  if (n - t <= i.pos - r.pos || Mr(r, !0, !1) < i.pos) return !1;
  let a = e.resolve(t);
  if (!r.parent.inlineContent) {
    let e = a.nodeAfter;
    return e != null && n == t + e.nodeSize;
  }
  if (a.parentOffset < a.parent.content.size || !a.parent.isTextblock) return !1;
  let o = e.resolve(Mr(a, !0, !0));
  return !o.parent.isTextblock || o.pos > n || Mr(o, !0, !1) < n
    ? !1
    : r.parent.content.cut(r.parentOffset).eq(o.parent.content);
}
function jr(e, t, n) {
  let r = 0,
    i = 0;
  return (
    e.nodesBetween(t, n, (e, a) => {
      e.isTextblock && a >= t && a < n
        ? r++
        : (e.isText
            ? /\S/.test(e.text.slice(Math.max(0, t - a), Math.min(e.nodeSize, n - a)))
            : e.isLeaf) && i++;
    }),
    i == 0 && r == 1
  );
}
function Mr(e, t, n) {
  let r = e.depth,
    i = t ? e.end() : e.pos;
  for (; r > 0 && (t || e.indexAfter(r) == e.node(r).childCount);) (r--, i++, (t = !1));
  if (n) {
    let t = e.node(r).maybeChild(e.indexAfter(r));
    for (; t && !t.isLeaf;) ((t = t.firstChild), i++);
  }
  return i;
}
function Nr(e, t, n, r, i) {
  let a = e.findDiffStart(t, n),
    o = n + e.size,
    s = n + t.size;
  if (a == null) return null;
  let { a: c, b: l } = e.findDiffEnd(t, o, s);
  if (i == `end`) {
    let e = Math.max(0, a - Math.min(c, l));
    r -= c + e - a;
  }
  if (c < a && o < s) {
    let e = r <= a && r >= c ? a - r : 0;
    ((a -= e), (l = a + (l - c)), (c = a));
  } else if (l < a) {
    let e = r <= a && r >= l ? a - r : 0;
    ((a -= e), (c = a + (c - l)), (l = a));
  }
  return { start: a, endA: c, endB: l };
}
var Pr = {
    childList: !0,
    characterData: !0,
    characterDataOldValue: !0,
    attributes: !0,
    attributeOldValue: !0,
    subtree: !0,
  },
  Fr = class {
    constructor(e) {
      ((this.view = e),
        (this.queue = []),
        (this.flushingSoon = -1),
        (this.suppressingSelectionUpdates = !1),
        (this.lastChangedTextNode = null),
        (this.started = !1),
        (this.observer = new window.MutationObserver((t) => {
          for (let e = 0; e < t.length; e++) this.queue.push(t[e]);
          A && e.composing && t.some((e) => e.type == `childList` && e.target.nodeName == `TR`)
            ? ((e.input.badSafariComposition = !0), this.flushSoon())
            : this.flush();
        })));
    }
    flushSoon() {
      this.flushingSoon < 0 &&
        (this.flushingSoon = window.setTimeout(() => {
          ((this.flushingSoon = -1), this.flush());
        }, 20));
    }
    forceFlush(e = !1) {
      this.flushingSoon > -1
        ? (window.clearTimeout(this.flushingSoon), (this.flushingSoon = -1), this.flush(!0))
        : e && this.flush(!0);
    }
    start() {
      (this.observer.takeRecords(), this.observer.observe(this.view.dom, Pr), (this.started = !0));
    }
    stop() {
      let e = this.observer.takeRecords();
      if (e.length) {
        for (let t = 0; t < e.length; t++) this.queue.push(e[t]);
        window.setTimeout(() => this.flush(), 20);
      }
      (this.observer.disconnect(), (this.started = !1));
    }
    stopped(e) {
      if (!this.started) return e();
      this.stop();
      try {
        return e();
      } finally {
        this.start();
      }
    }
    ignoreSelectionChange(e) {
      if (!e.focusNode) return !0;
      let t = new Set(),
        n;
      for (let n = e.focusNode; n; n = y(n)) t.add(n);
      for (let r = e.anchorNode; r; r = y(r))
        if (t.has(r)) {
          n = r;
          break;
        }
      let r = n && this.view.docView.nearestDesc(n);
      if (r && r.ignoreMutation({ type: `selection`, target: E(n) ? n.parentNode : n }))
        return (this.view.domSel.ignore(e), !0);
    }
    pendingRecords() {
      for (let e of this.observer.takeRecords()) this.queue.push(e);
      return this.queue;
    }
    flush(e = !0) {
      let { view: t } = this;
      if (!t.docView || this.flushingSoon > -1) return;
      let n = this.pendingRecords();
      (n.length && (this.queue = []), e && t.domSel.read());
      let r =
          !t.domSel.suppress &&
          !t.domSel.synced &&
          !!gn(t) &&
          !this.ignoreSelectionChange(t.domSel.range),
        i = -1,
        a = -1,
        o = !1,
        s = [];
      if (t.editable)
        for (let e = 0; e < n.length; e++) {
          let t = this.registerMutation(n[e], s);
          t &&
            ((i = i < 0 ? t.from : Math.min(t.from, i)),
            (a = a < 0 ? t.to : Math.max(t.to, a)),
            t.typeOver && (o = !0));
        }
      if (
        s.some((e) => e.nodeName == `BR`) &&
        (t.input.lastKeyCode == 8 ||
          t.input.lastKeyCode == 46 ||
          (k &&
            (t.composing || t.input.compositionEndedAt > Date.now() - 50) &&
            n.some((e) => e.type == `childList` && e.removedNodes.length)))
      ) {
        for (let e of s)
          if (e.nodeName == `BR` && e.parentNode) {
            let t = e.nextSibling;
            for (; t && T(t);) {
              if (t.contentEditable == `false`) {
                e.parentNode.removeChild(e);
                break;
              }
              t = t.firstChild;
            }
          }
      } else if (O && s.length) {
        let e = s.filter((e) => e.nodeName == `BR`);
        if (e.length == 2) {
          let [t, n] = e;
          t.parentNode && t.parentNode.parentNode == n.parentNode ? n.remove() : t.remove();
        } else {
          let { focusNode: n } = t.domSel.range;
          for (let r of e) {
            let e = r.parentNode;
            e && e.nodeName == `LI` && (!n || zr(t, n) != e) && r.remove();
          }
        }
      }
      let c = null;
      i < 0 &&
      r &&
      t.domSel.active &&
      t.input.lastFocus > Date.now() - 200 &&
      Math.max(t.input.lastTouch, t.input.lastClick.time) < Date.now() - 300 &&
      se(t.domSel.range) &&
      (c = tn(t, t.domSel.range)) &&
      c.eq(d.near(t.state.doc.resolve(0), 1))
        ? ((t.input.lastFocus = 0), t.domSel.sync(), t.scrollToSelection())
        : (i > -1 || r) &&
          (i > -1 && Rr(t),
          t.input.badSafariComposition && ((t.input.badSafariComposition = !1), Br(t, s)),
          Dr(this.view, i, a, r, o, s),
          t.docView && t.docView.damage ? t.updateState(t.state) : r && t.domSel.sync());
    }
    registerMutation(e, t) {
      if (t.indexOf(e.target) > -1) return null;
      let n;
      for (let t = e.target; t && !(n = this.view.docView.getDesc(t)); t = t.parentNode);
      if (
        (e.type == `attributes` &&
          (n == this.view.docView ||
            e.attributeName == `contenteditable` ||
            (e.attributeName == `style` && !e.oldValue && !e.target.getAttribute(`style`)))) ||
        !n ||
        n.ignoreMutation(e)
      )
        return null;
      if (e.type == `childList`) {
        for (let n = 0; n < e.addedNodes.length; n++) {
          let r = e.addedNodes[n];
          (t.push(r), E(r) && (this.lastChangedTextNode = r));
        }
        if (n.contentDOM && n.contentDOM != n.dom && !n.contentDOM.contains(e.target))
          return (n.markDamage(4), { from: n.posBefore, to: n.posAfter });
        let r = e.previousSibling,
          i = e.nextSibling,
          a = r && r.parentNode == e.target ? v(r) + 1 : 0,
          o = n.localPosFromDOM(e.target, a, -1),
          s = i && i.parentNode == e.target ? v(i) : e.target.childNodes.length,
          c = n.localPosFromDOM(e.target, s, 1);
        return (n.markDamage(n.contentDOM?.contains(e.target) ? 2 : 4), { from: o, to: c });
      }
      return e.type == `attributes`
        ? (n.markDamage(4), { from: n.posAtStart - n.border, to: n.posAtEnd + n.border })
        : ((this.lastChangedTextNode = e.target),
          n.markDamage(n instanceof nt && e.target == n.nodeDOM ? 8 : 4),
          { from: n.posAtStart, to: n.posAtEnd, typeOver: e.target.nodeValue == e.oldValue });
    }
  },
  Ir = new WeakMap(),
  Lr = !1;
function Rr(e) {
  if (
    !Ir.has(e) &&
    (Ir.set(e, null),
    [`normal`, `nowrap`, `pre-line`].indexOf(getComputedStyle(e.dom).whiteSpace) !== -1)
  ) {
    if (((e.requiresGeckoHackNode = O), Lr)) return;
    (console.warn(
      `ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'. It is recommended to load style/prosemirror.css from the prosemirror-view package.`,
    ),
      (Lr = !0));
  }
}
function zr(e, t) {
  for (let n = t.parentNode; n && n != e.dom; n = n.parentNode) {
    let t = e.docView.nearestDesc(n, !0);
    if (t && t.node.isBlock) return n;
  }
  return null;
}
function Br(e, t) {
  let { focusNode: n, focusOffset: r } = e.domSel.range;
  for (let i of t)
    if (i.parentNode?.nodeName == `TR`) {
      let t = i.nextSibling;
      for (; t && t.nodeName != `TD` && t.nodeName != `TH`;) t = t.nextSibling;
      if (t) {
        let a = t;
        for (;;) {
          let e = a.firstChild;
          if (!e || !T(e) || e.contentEditable == `false` || /^(BR|IMG)$/.test(e.nodeName)) break;
          a = e;
        }
        (a.insertBefore(i, a.firstChild), n == i && e.domSelection().collapse(i, r));
      } else i.parentNode.removeChild(i);
    }
}
var Vr = class {
  constructor(e, t) {
    ((this._root = null),
      (this.focused = !1),
      (this.trackWrites = null),
      (this.mounted = !1),
      (this.markCursor = null),
      (this.cursorWrapper = null),
      (this.lastSelectedViewDesc = void 0),
      (this.input = new yn()),
      (this.prevDirectPlugins = []),
      (this.pluginViews = []),
      (this.requiresGeckoHackNode = !1),
      (this.dragging = null),
      (this._props = t),
      (this.state = t.state),
      (this.directPlugins = t.plugins || []),
      this.directPlugins.forEach(Jr),
      (this.dispatch = this.dispatch.bind(this)),
      (this.dom = (e && e.mount) || document.createElement(`div`)),
      e &&
        (e.appendChild
          ? e.appendChild(this.dom)
          : typeof e == `function`
            ? e(this.dom)
            : e.mount && (this.mounted = !0)),
      (this.editable = Wr(this)),
      Ur(this),
      (this.nodeViews = Kr(this)),
      (this.docView = tt(this.state.doc, Hr(this), Cr(this), this.dom, this)),
      (this.domObserver = new Fr(this)),
      (this.domSel = new Qt(this)),
      this.domObserver.start(),
      this.domSel.read(),
      bn(this),
      this.updatePluginViews());
  }
  get composing() {
    return this.input.composing;
  }
  get props() {
    if (this._props.state != this.state) {
      let e = this._props;
      this._props = {};
      for (let t in e) this._props[t] = e[t];
      this._props.state = this.state;
    }
    return this._props;
  }
  update(e) {
    e.handleDOMEvents != this._props.handleDOMEvents && Cn(this);
    let t = this._props;
    ((this._props = e),
      e.plugins && (e.plugins.forEach(Jr), (this.directPlugins = e.plugins)),
      this.updateStateInner(e.state, t));
  }
  setProps(e) {
    let t = {};
    for (let e in this._props) t[e] = this._props[e];
    t.state = this.state;
    for (let n in e) t[n] = e[n];
    this.update(t);
  }
  updateState(e) {
    this.updateStateInner(e, this._props);
  }
  updateStateInner(e, t) {
    let n = this.state,
      r = !1,
      i = !1;
    (e.storedMarks && this.composing && (Yn(this), (i = !0)), (this.state = e));
    let a = n.plugins != e.plugins || this._props.plugins != t.plugins;
    if (a || this._props.plugins != t.plugins || this._props.nodeViews != t.nodeViews) {
      let e = Kr(this);
      qr(e, this.nodeViews) && ((this.nodeViews = e), (r = !0));
    }
    ((a || t.handleDOMEvents != this._props.handleDOMEvents) && Cn(this),
      (this.editable = Wr(this)),
      Ur(this));
    let o = Cr(this),
      s = Hr(this),
      c =
        n.plugins != e.plugins && !n.doc.eq(e.doc)
          ? `reset`
          : e.scrollToSelection > n.scrollToSelection
            ? `to selection`
            : `preserve`,
      l = r || !this.docView.matchesNode(e.doc, s, o);
    (l || !e.selection.eq(n.selection)) && (i = !0);
    let u = c == `preserve` && i && this.dom.style.overflowAnchor == null && Ce(this);
    (i &&
      this.domObserver.stopped(() => {
        let t =
          l &&
          k &&
          !this.composing &&
          !n.selection.empty &&
          !e.selection.empty &&
          Gr(n.selection, e.selection);
        if (l) {
          let n = k ? (this.trackWrites = this.domSel.range.focusNode) : null;
          if (
            (this.composing && (this.input.compositionNode = Xn(this)),
            r || !this.docView.update(e.doc, s, o, this, -1))
          ) {
            let t = this.docView.outerDeco;
            (this.docView.destroy(), (this.docView = tt(e.doc, s, o, this.dom, this, t)));
          }
          !n || (this.trackWrites && this.dom.contains(this.trackWrites)) || (t = !0);
        }
        this.domSel.sync(t);
      }),
      this.updatePluginViews(n),
      this.dragging?.node && !n.doc.eq(e.doc) && this.updateDraggedNode(this.dragging, n),
      c == `reset`
        ? (this.dom.scrollTop = 0)
        : c == `to selection`
          ? this.scrollToSelection()
          : u && Te(u));
  }
  scrollToSelection() {
    let e = this.domSel.range.focusNode;
    if (e && this.domSel.active && !this.someProp(`handleScrollToSelection`, (e) => e(this))) {
      if (this.state.selection instanceof f) {
        let t = this.docView.domAfterPos(this.state.selection.from);
        T(t) && Se(this, t.getBoundingClientRect(), e);
      } else Se(this, this.coordsAtPos(this.state.selection.head, 1), e);
    }
  }
  destroyPluginViews() {
    let e;
    for (; (e = this.pluginViews.pop());) e.destroy && e.destroy();
  }
  updatePluginViews(e) {
    if (!e || e.plugins != this.state.plugins || this.directPlugins != this.prevDirectPlugins) {
      ((this.prevDirectPlugins = this.directPlugins), this.destroyPluginViews());
      for (let e = 0; e < this.directPlugins.length; e++) {
        let t = this.directPlugins[e];
        t.spec.view && this.pluginViews.push(t.spec.view(this));
      }
      for (let e = 0; e < this.state.plugins.length; e++) {
        let t = this.state.plugins[e];
        t.spec.view && this.pluginViews.push(t.spec.view(this));
      }
    } else
      for (let t = 0; t < this.pluginViews.length; t++) {
        let n = this.pluginViews[t];
        n.update && n.update(this, e);
      }
  }
  updateDraggedNode(e, t) {
    let n = e.node,
      r = -1;
    if (n.from < this.state.doc.content.size && this.state.doc.nodeAt(n.from) == n.node) r = n.from;
    else {
      let e = n.from + (this.state.doc.content.size - t.doc.content.size);
      (e > 0 && e < this.state.doc.content.size && this.state.doc.nodeAt(e)) == n.node && (r = e);
    }
    this.dragging = new rr(e.slice, e.move, r < 0 ? void 0 : f.create(this.state.doc, r));
  }
  someProp(e, t) {
    let n = this._props && this._props[e],
      r;
    if (n != null && (r = t ? t(n) : n)) return r;
    for (let n = 0; n < this.directPlugins.length; n++) {
      let i = this.directPlugins[n].props[e];
      if (i != null && (r = t ? t(i) : i)) return r;
    }
    let i = this.state.plugins;
    if (i)
      for (let n = 0; n < i.length; n++) {
        let a = i[n].props[e];
        if (a != null && (r = t ? t(a) : a)) return r;
      }
  }
  hasFocus() {
    return this.root.activeElement == this.dom;
  }
  focus() {
    (this.editable && Oe(this.dom), this.domSel.sync());
  }
  get root() {
    let e = this.dom.isConnected !== !1;
    e || (this._root = null);
    let t = this._root;
    if (t == null && e) {
      for (let e = this.dom.parentNode; e; e = e.parentNode)
        if (e.nodeType == 9 || (e.nodeType == 11 && e.host))
          return (
            e.getSelection ||
              (Object.getPrototypeOf(e).getSelection = () => e.ownerDocument.getSelection()),
            (this._root = e)
          );
    }
    return t || document;
  }
  updateRoot() {
    this._root = null;
  }
  posAtCoords(e) {
    return Ie(this, e);
  }
  coordsAtPos(e, t = 1) {
    return ze(this, e, t);
  }
  domAtPos(e, t = 0) {
    return this.docView.domFromPos(e, t);
  }
  nodeDOM(e) {
    let t = this.docView.descAt(e);
    return t ? t.nodeDOM : null;
  }
  posAtDOM(e, t, n = -1) {
    let r = this.docView.posFromDOM(e, t, n);
    if (r == null) throw RangeError(`DOM position not inside the editor`);
    return r;
  }
  endOfTextblock(e, t) {
    return Ye(this, t || this.state, e);
  }
  pasteHTML(e, t) {
    return tr(this, ``, e, !1, t || new ClipboardEvent(`paste`));
  }
  pasteText(e, t) {
    return tr(this, e, null, !0, t || new ClipboardEvent(`paste`));
  }
  serializeForClipboard(e) {
    return It(this, e);
  }
  destroy() {
    this.docView &&
      (Sn(this),
      this.domSel.destroy(),
      this.destroyPluginViews(),
      this.mounted
        ? (this.docView.update(this.state.doc, [], Cr(this), this, -1), (this.dom.textContent = ``))
        : this.dom.parentNode && this.dom.parentNode.removeChild(this.dom),
      this.docView.destroy(),
      (this.docView = null),
      S());
  }
  get isDestroyed() {
    return this.docView == null;
  }
  dispatchEvent(e) {
    return En(this, e);
  }
  domSelection() {
    return this.root.getSelection();
  }
};
Vr.prototype.dispatch = function (e) {
  let t = this._props.dispatchTransaction;
  t ? t.call(this, e) : this.updateState(this.state.apply(e));
};
function Hr(e) {
  let t = Object.create(null);
  return (
    (t.class = `ProseMirror`),
    (t.contenteditable = String(e.editable)),
    e.someProp(`attributes`, (n) => {
      if ((typeof n == `function` && (n = n(e.state)), n))
        for (let e in n)
          e == `class`
            ? (t.class += ` ` + n[e])
            : e == `style`
              ? (t.style = (t.style ? t.style + `;` : ``) + n[e])
              : !t[e] && e != `contenteditable` && e != `nodeName` && (t[e] = String(n[e]));
    }),
    (t.translate ||= `no`),
    [V.node(0, e.state.doc.content.size, t)]
  );
}
function Ur(e) {
  if (e.markCursor) {
    let t = document.createElement(`img`);
    ((t.className = `ProseMirror-separator`),
      t.setAttribute(`mark-placeholder`, `true`),
      t.setAttribute(`alt`, ``),
      (e.cursorWrapper = {
        dom: t,
        deco: V.widget(e.state.selection.from, t, { raw: !0, marks: e.markCursor }),
      }));
  } else e.cursorWrapper = null;
}
function Wr(e) {
  return !e.someProp(`editable`, (t) => t(e.state) === !1);
}
function Gr(e, t) {
  let n = Math.min(e.$anchor.sharedDepth(e.head), t.$anchor.sharedDepth(t.head));
  return e.$anchor.start(n) != t.$anchor.start(n);
}
function Kr(e) {
  let t = Object.create(null);
  function n(e) {
    for (let n in e) Object.prototype.hasOwnProperty.call(t, n) || (t[n] = e[n]);
  }
  return (e.someProp(`nodeViews`, n), e.someProp(`markViews`, n), t);
}
function qr(e, t) {
  let n = 0,
    r = 0;
  for (let r in e) {
    if (e[r] != t[r]) return !0;
    n++;
  }
  for (let e in t) r++;
  return n != r;
}
function Jr(e) {
  if (e.spec.state || e.spec.filterTransaction || e.spec.appendTransaction)
    throw RangeError(`Plugins passed directly to the view must not have a state component`);
}
var Yr, Xr;
if (typeof WeakMap < `u`) {
  let e = new WeakMap();
  ((Yr = (t) => e.get(t)), (Xr = (t, n) => (e.set(t, n), n)));
} else {
  let e = [],
    t = 0;
  ((Yr = (t) => {
    for (let n = 0; n < e.length; n += 2) if (e[n] == t) return e[n + 1];
  }),
    (Xr = (n, r) => (t == 10 && (t = 0), (e[t++] = n), (e[t++] = r))));
}
var G = class {
  constructor(e, t, n, r) {
    ((this.width = e), (this.height = t), (this.map = n), (this.problems = r));
  }
  findCell(e) {
    for (let t = 0; t < this.map.length; t++) {
      let n = this.map[t];
      if (n != e) continue;
      let r = t % this.width,
        i = (t / this.width) | 0,
        a = r + 1,
        o = i + 1;
      for (let e = 1; a < this.width && this.map[t + e] == n; e++) a++;
      for (let e = 1; o < this.height && this.map[t + this.width * e] == n; e++) o++;
      return { left: r, top: i, right: a, bottom: o };
    }
    throw RangeError(`No cell with offset ${e} found`);
  }
  colCount(e) {
    for (let t = 0; t < this.map.length; t++) if (this.map[t] == e) return t % this.width;
    throw RangeError(`No cell with offset ${e} found`);
  }
  nextCell(e, t, n) {
    let { left: r, right: i, top: a, bottom: o } = this.findCell(e);
    return t == `horiz`
      ? (n < 0 ? r == 0 : i == this.width)
        ? null
        : this.map[a * this.width + (n < 0 ? r - 1 : i)]
      : (n < 0 ? a == 0 : o == this.height)
        ? null
        : this.map[r + this.width * (n < 0 ? a - 1 : o)];
  }
  rectBetween(e, t) {
    let { left: n, right: r, top: i, bottom: a } = this.findCell(e),
      { left: o, right: s, top: c, bottom: l } = this.findCell(t);
    return {
      left: Math.min(n, o),
      top: Math.min(i, c),
      right: Math.max(r, s),
      bottom: Math.max(a, l),
    };
  }
  cellsInRect(e) {
    let t = [],
      n = {};
    for (let r = e.top; r < e.bottom; r++)
      for (let i = e.left; i < e.right; i++) {
        let a = r * this.width + i,
          o = this.map[a];
        n[o] ||
          ((n[o] = !0),
          (i == e.left && i && this.map[a - 1] == o) ||
            (r == e.top && r && this.map[a - this.width] == o) ||
            t.push(o));
      }
    return t;
  }
  positionAt(e, t, n) {
    for (let r = 0, i = 0; ; r++) {
      let a = i + n.child(r).nodeSize;
      if (r == e) {
        let n = t + e * this.width,
          r = (e + 1) * this.width;
        for (; n < r && this.map[n] < i;) n++;
        return n == r ? a - 1 : this.map[n];
      }
      i = a;
    }
  }
  static get(e) {
    return Yr(e) || Xr(e, Zr(e));
  }
};
function Zr(e) {
  if (e.type.spec.tableRole != `table`) throw RangeError(`Not a table node: ` + e.type.name);
  let t = Qr(e),
    n = e.childCount,
    r = [],
    i = 0,
    a = null,
    o = [];
  for (let e = 0, i = t * n; e < i; e++) r[e] = 0;
  for (let s = 0, c = 0; s < n; s++) {
    let l = e.child(s);
    c++;
    for (let e = 0; ; e++) {
      for (; i < r.length && r[i] != 0;) i++;
      if (e == l.childCount) break;
      let u = l.child(e),
        { colspan: d, rowspan: f, colwidth: p } = u.attrs;
      for (let e = 0; e < f; e++) {
        if (e + s >= n) {
          (a ||= []).push({ type: `overlong_rowspan`, pos: c, n: f - e });
          break;
        }
        let l = i + e * t;
        for (let e = 0; e < d; e++) {
          r[l + e] == 0
            ? (r[l + e] = c)
            : (a ||= []).push({ type: `collision`, row: s, pos: c, n: d - e });
          let n = p && p[e];
          if (n) {
            let r = ((l + e) % t) * 2,
              i = o[r];
            i == null || (i != n && o[r + 1] == 1)
              ? ((o[r] = n), (o[r + 1] = 1))
              : i == n && o[r + 1]++;
          }
        }
      }
      ((i += d), (c += u.nodeSize));
    }
    let u = (s + 1) * t,
      d = 0;
    for (; i < u;) r[i++] == 0 && d++;
    (d && (a ||= []).push({ type: `missing`, row: s, n: d }), c++);
  }
  (t === 0 || n === 0) && (a ||= []).push({ type: `zero_sized` });
  let s = new G(t, n, r, a),
    c = !1;
  for (let e = 0; !c && e < o.length; e += 2) o[e] != null && o[e + 1] < n && (c = !0);
  return (c && $r(s, o, e), s);
}
function Qr(e) {
  let t = -1,
    n = !1;
  for (let r = 0; r < e.childCount; r++) {
    let i = e.child(r),
      a = 0;
    if (n)
      for (let t = 0; t < r; t++) {
        let n = e.child(t);
        for (let e = 0; e < n.childCount; e++) {
          let i = n.child(e);
          t + i.attrs.rowspan > r && (a += i.attrs.colspan);
        }
      }
    for (let e = 0; e < i.childCount; e++) {
      let t = i.child(e);
      ((a += t.attrs.colspan), t.attrs.rowspan > 1 && (n = !0));
    }
    t == -1 ? (t = a) : t != a && (t = Math.max(t, a));
  }
  return t;
}
function $r(e, t, n) {
  e.problems ||= [];
  let r = {};
  for (let i = 0; i < e.map.length; i++) {
    let a = e.map[i];
    if (r[a]) continue;
    r[a] = !0;
    let o = n.nodeAt(a);
    if (!o) throw RangeError(`No cell with offset ${a} found`);
    let s = null,
      c = o.attrs;
    for (let n = 0; n < c.colspan; n++) {
      let r = t[((i + n) % e.width) * 2];
      r == null || (c.colwidth && c.colwidth[n] == r) || ((s ||= ei(c))[n] = r);
    }
    s && e.problems.unshift({ type: `colwidth mismatch`, pos: a, colwidth: s });
  }
}
function ei(e) {
  if (e.colwidth) return e.colwidth.slice();
  let t = [];
  for (let n = 0; n < e.colspan; n++) t.push(0);
  return t;
}
function ti(e, t) {
  if (typeof e == `string`) return {};
  let n = e.getAttribute(`data-colwidth`),
    r = n && /^\d+(,\d+)*$/.test(n) ? n.split(`,`).map((e) => Number(e)) : null,
    i = Number(e.getAttribute(`colspan`) || 1),
    a = {
      colspan: i,
      rowspan: Number(e.getAttribute(`rowspan`) || 1),
      colwidth: r && r.length == i ? r : null,
    };
  for (let n in t) {
    let r = t[n].getFromDOM,
      i = r && r(e);
    i != null && (a[n] = i);
  }
  return a;
}
function ni(e, t) {
  let n = {};
  (e.attrs.colspan != 1 && (n.colspan = e.attrs.colspan),
    e.attrs.rowspan != 1 && (n.rowspan = e.attrs.rowspan),
    e.attrs.colwidth && (n[`data-colwidth`] = e.attrs.colwidth.join(`,`)));
  for (let r in t) {
    let i = t[r].setDOMAttr;
    i && i(e.attrs[r], n);
  }
  return n;
}
function ri(e) {
  if (e !== null) {
    if (!Array.isArray(e)) throw TypeError(`colwidth must be null or an array`);
    for (let t of e)
      if (typeof t != `number`) throw TypeError(`colwidth must be null or an array of numbers`);
  }
}
function ii(e) {
  let t = e.cellAttributes || {},
    n = {
      colspan: { default: 1, validate: `number` },
      rowspan: { default: 1, validate: `number` },
      colwidth: { default: null, validate: ri },
    };
  for (let e in t) n[e] = { default: t[e].default, validate: t[e].validate };
  return {
    table: {
      content: `table_row+`,
      tableRole: `table`,
      isolating: !0,
      group: e.tableGroup,
      parseDOM: [{ tag: `table` }],
      toDOM() {
        return [`table`, [`tbody`, 0]];
      },
    },
    table_row: {
      content: `(table_cell | table_header)*`,
      tableRole: `row`,
      parseDOM: [{ tag: `tr` }],
      toDOM() {
        return [`tr`, 0];
      },
    },
    table_cell: {
      content: e.cellContent,
      attrs: n,
      tableRole: `cell`,
      isolating: !0,
      parseDOM: [{ tag: `td`, getAttrs: (e) => ti(e, t) }],
      toDOM(e) {
        return [`td`, ni(e, t), 0];
      },
    },
    table_header: {
      content: e.cellContent,
      attrs: n,
      tableRole: `header_cell`,
      isolating: !0,
      parseDOM: [{ tag: `th`, getAttrs: (e) => ti(e, t) }],
      toDOM(e) {
        return [`th`, ni(e, t), 0];
      },
    },
  };
}
function K(e) {
  let t = e.cached.tableNodeTypes;
  if (!t) {
    t = e.cached.tableNodeTypes = {};
    for (let n in e.nodes) {
      let r = e.nodes[n],
        i = r.spec.tableRole;
      i && (t[i] = r);
    }
  }
  return t;
}
var q = new o(`selectingCells`);
function ai(e) {
  for (let t = e.depth - 1; t > 0; t--)
    if (e.node(t).type.spec.tableRole == `row`) return e.node(0).resolve(e.before(t + 1));
  return null;
}
function oi(e) {
  for (let t = e.depth; t > 0; t--) {
    let n = e.node(t).type.spec.tableRole;
    if (n === `cell` || n === `header_cell`) return e.node(t);
  }
  return null;
}
function J(e) {
  let t = e.selection.$head;
  for (let e = t.depth; e > 0; e--) if (t.node(e).type.spec.tableRole == `row`) return !0;
  return !1;
}
function si(e) {
  let t = e.selection;
  if (`$anchorCell` in t && t.$anchorCell)
    return t.$anchorCell.pos > t.$headCell.pos ? t.$anchorCell : t.$headCell;
  if (`node` in t && t.node && t.node.type.spec.tableRole == `cell`) return t.$anchor;
  let n = ai(t.$head) || ci(t.$head);
  if (n) return n;
  throw RangeError(`No cell found around position ${t.head}`);
}
function ci(e) {
  for (let t = e.nodeAfter, n = e.pos; t; t = t.firstChild, n++) {
    let r = t.type.spec.tableRole;
    if (r == `cell` || r == `header_cell`) return e.doc.resolve(n);
  }
  for (let t = e.nodeBefore, n = e.pos; t; t = t.lastChild, n--) {
    let r = t.type.spec.tableRole;
    if (r == `cell` || r == `header_cell`) return e.doc.resolve(n - t.nodeSize);
  }
}
function li(e) {
  return e.parent.type.spec.tableRole == `row` && !!e.nodeAfter;
}
function ui(e) {
  return e.node(0).resolve(e.pos + e.nodeAfter.nodeSize);
}
function di(e, t) {
  return e.depth == t.depth && e.pos >= t.start(-1) && e.pos <= t.end(-1);
}
function fi(e, t, n) {
  let r = e.node(-1),
    i = G.get(r),
    a = e.start(-1),
    o = i.nextCell(e.pos - a, t, n);
  return o == null ? null : e.node(0).resolve(a + o);
}
function pi(e, t, n = 1) {
  let r = { ...e, colspan: e.colspan - n };
  return (
    r.colwidth &&
      ((r.colwidth = r.colwidth.slice()),
      r.colwidth.splice(t, n),
      r.colwidth.some((e) => e > 0) || (r.colwidth = null)),
    r
  );
}
function mi(e, t, n = 1) {
  let r = { ...e, colspan: e.colspan + n };
  if (r.colwidth) {
    r.colwidth = r.colwidth.slice();
    for (let e = 0; e < n; e++) r.colwidth.splice(t, 0, 0);
  }
  return r;
}
function hi(e, t, n) {
  let r = K(t.type.schema).header_cell;
  for (let i = 0; i < e.height; i++) if (t.nodeAt(e.map[n + i * e.width]).type != r) return !1;
  return !0;
}
var Y = class e extends d {
  constructor(e, t = e) {
    let n = e.node(-1),
      r = G.get(n),
      i = e.start(-1),
      a = r.rectBetween(e.pos - i, t.pos - i),
      o = e.node(0),
      s = r.cellsInRect(a).filter((e) => e != t.pos - i);
    s.unshift(t.pos - i);
    let c = s.map((e) => {
      let t = n.nodeAt(e);
      if (!t) throw RangeError(`No cell with offset ${e} found`);
      let r = i + e + 1;
      return new p(o.resolve(r), o.resolve(r + t.content.size));
    });
    (super(c[0].$from, c[0].$to, c), (this.$anchorCell = e), (this.$headCell = t));
  }
  map(t, n) {
    let r = t.resolve(n.map(this.$anchorCell.pos)),
      i = t.resolve(n.map(this.$headCell.pos));
    if (li(r) && li(i) && di(r, i)) {
      let t = this.$anchorCell.node(-1) != r.node(-1);
      return t && this.isRowSelection()
        ? e.rowSelection(r, i)
        : t && this.isColSelection()
          ? e.colSelection(r, i)
          : new e(r, i);
    }
    return s.between(r, i);
  }
  content() {
    let e = this.$anchorCell.node(-1),
      t = G.get(e),
      r = this.$anchorCell.start(-1),
      i = t.rectBetween(this.$anchorCell.pos - r, this.$headCell.pos - r),
      a = {},
      o = [];
    for (let r = i.top; r < i.bottom; r++) {
      let s = [];
      for (let n = r * t.width + i.left, o = i.left; o < i.right; o++, n++) {
        let r = t.map[n];
        if (a[r]) continue;
        a[r] = !0;
        let o = t.findCell(r),
          c = e.nodeAt(r);
        if (!c) throw RangeError(`No cell with offset ${r} found`);
        let l = i.left - o.left,
          u = o.right - i.right;
        if (l > 0 || u > 0) {
          let e = c.attrs;
          if (
            (l > 0 && (e = pi(e, 0, l)), u > 0 && (e = pi(e, e.colspan - u, u)), o.left < i.left)
          ) {
            if (((c = c.type.createAndFill(e)), !c))
              throw RangeError(`Could not create cell with attrs ${JSON.stringify(e)}`);
          } else c = c.type.create(e, c.content);
        }
        if (o.top < i.top || o.bottom > i.bottom) {
          let e = { ...c.attrs, rowspan: Math.min(o.bottom, i.bottom) - Math.max(o.top, i.top) };
          c = o.top < i.top ? c.type.createAndFill(e) : c.type.create(e, c.content);
        }
        s.push(c);
      }
      o.push(e.child(r).copy(n.from(s)));
    }
    let s = this.isColSelection() && this.isRowSelection() ? e : o;
    return new l(n.from(s), 1, 1);
  }
  replace(e, t = l.empty) {
    let n = e.steps.length,
      r = this.ranges;
    for (let i = 0; i < r.length; i++) {
      let { $from: a, $to: o } = r[i],
        s = e.mapping.slice(n);
      e.replace(s.map(a.pos), s.map(o.pos), i ? l.empty : t);
    }
    let i = d.findFrom(e.doc.resolve(e.mapping.slice(n).map(this.to)), -1);
    i && e.setSelection(i);
  }
  replaceWith(e, t) {
    this.replace(e, new l(n.from(t), 0, 0));
  }
  forEachCell(e) {
    let t = this.$anchorCell.node(-1),
      n = G.get(t),
      r = this.$anchorCell.start(-1),
      i = n.cellsInRect(n.rectBetween(this.$anchorCell.pos - r, this.$headCell.pos - r));
    for (let n = 0; n < i.length; n++) e(t.nodeAt(i[n]), r + i[n]);
  }
  isColSelection() {
    let e = this.$anchorCell.index(-1),
      t = this.$headCell.index(-1);
    if (Math.min(e, t) > 0) return !1;
    let n = e + this.$anchorCell.nodeAfter.attrs.rowspan,
      r = t + this.$headCell.nodeAfter.attrs.rowspan;
    return Math.max(n, r) == this.$headCell.node(-1).childCount;
  }
  static colSelection(t, n = t) {
    let r = t.node(-1),
      i = G.get(r),
      a = t.start(-1),
      o = i.findCell(t.pos - a),
      s = i.findCell(n.pos - a),
      c = t.node(0);
    return (
      o.top <= s.top
        ? (o.top > 0 && (t = c.resolve(a + i.map[o.left])),
          s.bottom < i.height && (n = c.resolve(a + i.map[i.width * (i.height - 1) + s.right - 1])))
        : (s.top > 0 && (n = c.resolve(a + i.map[s.left])),
          o.bottom < i.height &&
            (t = c.resolve(a + i.map[i.width * (i.height - 1) + o.right - 1]))),
      new e(t, n)
    );
  }
  isRowSelection() {
    let e = this.$anchorCell.node(-1),
      t = G.get(e),
      n = this.$anchorCell.start(-1),
      r = t.colCount(this.$anchorCell.pos - n),
      i = t.colCount(this.$headCell.pos - n);
    if (Math.min(r, i) > 0) return !1;
    let a = r + this.$anchorCell.nodeAfter.attrs.colspan,
      o = i + this.$headCell.nodeAfter.attrs.colspan;
    return Math.max(a, o) == t.width;
  }
  eq(t) {
    return (
      t instanceof e &&
      t.$anchorCell.pos == this.$anchorCell.pos &&
      t.$headCell.pos == this.$headCell.pos
    );
  }
  static rowSelection(t, n = t) {
    let r = t.node(-1),
      i = G.get(r),
      a = t.start(-1),
      o = i.findCell(t.pos - a),
      s = i.findCell(n.pos - a),
      c = t.node(0);
    return (
      o.left <= s.left
        ? (o.left > 0 && (t = c.resolve(a + i.map[o.top * i.width])),
          s.right < i.width && (n = c.resolve(a + i.map[i.width * (s.top + 1) - 1])))
        : (s.left > 0 && (n = c.resolve(a + i.map[s.top * i.width])),
          o.right < i.width && (t = c.resolve(a + i.map[i.width * (o.top + 1) - 1]))),
      new e(t, n)
    );
  }
  toJSON() {
    return { type: `cell`, anchor: this.$anchorCell.pos, head: this.$headCell.pos };
  }
  static fromJSON(t, n) {
    return new e(t.resolve(n.anchor), t.resolve(n.head));
  }
  static create(t, n, r = n) {
    return new e(t.resolve(n), t.resolve(r));
  }
  getBookmark() {
    return new gi(this.$anchorCell.pos, this.$headCell.pos);
  }
};
((Y.prototype.visible = !1), d.jsonID(`cell`, Y));
var gi = class e {
  constructor(e, t) {
    ((this.anchor = e), (this.head = t));
  }
  map(t) {
    return new e(t.map(this.anchor), t.map(this.head));
  }
  resolve(e) {
    let t = e.resolve(this.anchor),
      n = e.resolve(this.head);
    return t.parent.type.spec.tableRole == `row` &&
      n.parent.type.spec.tableRole == `row` &&
      t.index() < t.parent.childCount &&
      n.index() < n.parent.childCount &&
      di(t, n)
      ? new Y(t, n)
      : d.near(n, 1);
  }
};
function _i(e) {
  if (!(e.selection instanceof Y)) return null;
  let t = [];
  return (
    e.selection.forEachCell((e, n) => {
      t.push(V.node(n, n + e.nodeSize, { class: `selectedCell` }));
    }),
    H.create(e.doc, t)
  );
}
function vi({ $from: e, $to: t }) {
  if (e.pos == t.pos || e.pos < t.pos - 6) return !1;
  let n = e.pos,
    r = t.pos,
    i = e.depth;
  for (; i >= 0 && !(e.after(i + 1) < e.end(i)); i--, n++);
  for (let e = t.depth; e >= 0 && !(t.before(e + 1) > t.start(e)); e--, r--);
  return n == r && /row|table/.test(e.node(i).type.spec.tableRole);
}
function yi({ $from: e, $to: t }) {
  let n, r;
  for (let t = e.depth; t > 0; t--) {
    let r = e.node(t);
    if (r.type.spec.tableRole === `cell` || r.type.spec.tableRole === `header_cell`) {
      n = r;
      break;
    }
  }
  for (let e = t.depth; e > 0; e--) {
    let n = t.node(e);
    if (n.type.spec.tableRole === `cell` || n.type.spec.tableRole === `header_cell`) {
      r = n;
      break;
    }
  }
  return n !== r && t.parentOffset === 0;
}
function bi(e, t, n) {
  let r = (t || e).selection,
    i = (t || e).doc,
    a,
    o;
  if (r instanceof f && (o = r.node.type.spec.tableRole)) {
    if (o == `cell` || o == `header_cell`) a = Y.create(i, r.from);
    else if (o == `row`) {
      let e = i.resolve(r.from + 1);
      a = Y.rowSelection(e, e);
    } else if (!n) {
      let e = G.get(r.node),
        t = r.from + 1,
        n = t + e.map[e.width * e.height - 1];
      a = Y.create(i, t + 1, n);
    }
  } else
    r instanceof s && vi(r)
      ? (a = s.create(i, r.from))
      : r instanceof s && yi(r) && (a = s.create(i, r.$from.start(), r.$from.end()));
  return (a && (t ||= e.tr).setSelection(a), t);
}
var xi = new o(`fix-tables`);
function Si(e, t, n, r) {
  let i = e.childCount,
    a = t.childCount;
  outer: for (let o = 0, s = 0; o < a; o++) {
    let a = t.child(o);
    for (let t = s, r = Math.min(i, o + 3); t < r; t++)
      if (e.child(t) == a) {
        ((s = t + 1), (n += a.nodeSize));
        continue outer;
      }
    (r(a, n),
      s < i && e.child(s).sameMarkup(a)
        ? Si(e.child(s), a, n + 1, r)
        : a.nodesBetween(0, a.content.size, r, n + 1),
      (n += a.nodeSize));
  }
}
function Ci(e, t) {
  let n,
    r = (t, r) => {
      t.type.spec.tableRole == `table` && (n = wi(e, t, r, n));
    };
  return (t ? t.doc != e.doc && Si(t.doc, e.doc, 0, r) : e.doc.descendants(r), n);
}
function wi(e, t, n, r) {
  let i = G.get(t);
  if (!i.problems) return r;
  r ||= e.tr;
  let a = [];
  for (let e = 0; e < i.height; e++) a.push(0);
  for (let e = 0; e < i.problems.length; e++) {
    let o = i.problems[e];
    if (o.type == `collision`) {
      let e = t.nodeAt(o.pos);
      if (!e) continue;
      let i = e.attrs;
      for (let e = 0; e < i.rowspan; e++) a[o.row + e] += o.n;
      r.setNodeMarkup(r.mapping.map(n + 1 + o.pos), null, pi(i, i.colspan - o.n, o.n));
    } else if (o.type == `missing`) a[o.row] += o.n;
    else if (o.type == `overlong_rowspan`) {
      let e = t.nodeAt(o.pos);
      if (!e) continue;
      r.setNodeMarkup(r.mapping.map(n + 1 + o.pos), null, {
        ...e.attrs,
        rowspan: e.attrs.rowspan - o.n,
      });
    } else if (o.type == `colwidth mismatch`) {
      let e = t.nodeAt(o.pos);
      if (!e) continue;
      r.setNodeMarkup(r.mapping.map(n + 1 + o.pos), null, { ...e.attrs, colwidth: o.colwidth });
    } else if (o.type == `zero_sized`) {
      let e = r.mapping.map(n);
      r.delete(e, e + t.nodeSize);
    }
  }
  let o, s;
  for (let e = 0; e < a.length; e++) a[e] && ((o ??= e), (s = e));
  for (let c = 0, l = n + 1; c < i.height; c++) {
    let n = t.child(c),
      i = l + n.nodeSize,
      u = a[c];
    if (u > 0) {
      let t = `cell`;
      n.firstChild && (t = n.firstChild.type.spec.tableRole);
      let a = [];
      for (let n = 0; n < u; n++) {
        let n = K(e.schema)[t].createAndFill();
        n && a.push(n);
      }
      let d = (c == 0 || o == c - 1) && s == c ? l + 1 : i - 1;
      r.insert(r.mapping.map(d), a);
    }
    l = i;
  }
  return r.setMeta(xi, { fixTables: !0 });
}
function Ti(e) {
  return Ei((e) => e.type.spec.tableRole === `table`, e);
}
function Ei(e, t) {
  for (let n = t.depth; n >= 0; --n) {
    let r = t.node(n);
    if (e(r)) return { node: r, pos: n === 0 ? 0 : t.before(n), start: t.start(n), depth: n };
  }
  return null;
}
function X(e) {
  let t = e.selection,
    n = si(e),
    r = n.node(-1),
    i = n.start(-1),
    a = G.get(r);
  return {
    ...(t instanceof Y
      ? a.rectBetween(t.$anchorCell.pos - i, t.$headCell.pos - i)
      : a.findCell(n.pos - i)),
    tableStart: i,
    map: a,
    table: r,
  };
}
function Di(e, { map: t, tableStart: n, table: r }, i) {
  let a = i > 0 ? -1 : 0;
  hi(t, r, i + a) && (a = i == 0 || i == t.width ? null : 0);
  for (let o = 0; o < t.height; o++) {
    let s = o * t.width + i;
    if (i > 0 && i < t.width && t.map[s - 1] == t.map[s]) {
      let a = t.map[s],
        c = r.nodeAt(a);
      (e.setNodeMarkup(e.mapping.map(n + a), null, mi(c.attrs, i - t.colCount(a))),
        (o += c.attrs.rowspan - 1));
    } else {
      let c = a == null ? K(r.type.schema).cell : r.nodeAt(t.map[s + a]).type,
        l = t.positionAt(o, i, r);
      e.insert(e.mapping.map(n + l), c.createAndFill());
    }
  }
  return e;
}
function Oi(e, t) {
  if (!J(e)) return !1;
  if (t) {
    let n = X(e);
    t(Di(e.tr, n, n.left));
  }
  return !0;
}
function ki(e, t) {
  if (!J(e)) return !1;
  if (t) {
    let n = X(e);
    t(Di(e.tr, n, n.right));
  }
  return !0;
}
function Ai(e, { map: t, table: n, tableStart: r }, i) {
  let a = e.mapping.maps.length;
  for (let o = 0; o < t.height;) {
    let s = o * t.width + i,
      c = t.map[s],
      l = n.nodeAt(c),
      u = l.attrs;
    if ((i > 0 && t.map[s - 1] == c) || (i < t.width - 1 && t.map[s + 1] == c))
      e.setNodeMarkup(e.mapping.slice(a).map(r + c), null, pi(u, i - t.colCount(c)));
    else {
      let t = e.mapping.slice(a).map(r + c);
      e.delete(t, t + l.nodeSize);
    }
    o += u.rowspan;
  }
}
function ji(e, t) {
  if (!J(e)) return !1;
  if (t) {
    let n = X(e),
      r = e.tr;
    if (n.left == 0 && n.right == n.map.width) return !1;
    for (let e = n.right - 1; Ai(r, n, e), e != n.left; e--) {
      let e = n.tableStart ? r.doc.nodeAt(n.tableStart - 1) : r.doc;
      if (!e) throw RangeError(`No table found`);
      ((n.table = e), (n.map = G.get(e)));
    }
    t(r);
  }
  return !0;
}
function Mi(e, t, n) {
  let r = K(t.type.schema).header_cell;
  for (let i = 0; i < e.width; i++) if (t.nodeAt(e.map[i + n * e.width])?.type != r) return !1;
  return !0;
}
function Ni(e, { map: t, tableStart: n, table: r }, i) {
  let a = n;
  for (let e = 0; e < i; e++) a += r.child(e).nodeSize;
  let o = [],
    s = i > 0 ? -1 : 0;
  Mi(t, r, i + s) && (s = i == 0 || i == t.height ? null : 0);
  for (let a = 0, c = t.width * i; a < t.width; a++, c++)
    if (i > 0 && i < t.height && t.map[c] == t.map[c - t.width]) {
      let i = t.map[c],
        o = r.nodeAt(i).attrs;
      (e.setNodeMarkup(n + i, null, { ...o, rowspan: o.rowspan + 1 }), (a += o.colspan - 1));
    } else {
      let e = (
        s == null ? K(r.type.schema).cell : r.nodeAt(t.map[c + s * t.width])?.type
      )?.createAndFill();
      e && o.push(e);
    }
  return (e.insert(a, K(r.type.schema).row.create(null, o)), e);
}
function Pi(e, t) {
  if (!J(e)) return !1;
  if (t) {
    let n = X(e);
    t(Ni(e.tr, n, n.top));
  }
  return !0;
}
function Fi(e, t) {
  if (!J(e)) return !1;
  if (t) {
    let n = X(e);
    t(Ni(e.tr, n, n.bottom));
  }
  return !0;
}
function Ii(e, { map: t, table: n, tableStart: r }, i) {
  let a = 0;
  for (let e = 0; e < i; e++) a += n.child(e).nodeSize;
  let o = a + n.child(i).nodeSize,
    s = e.mapping.maps.length;
  e.delete(a + r, o + r);
  let c = new Set();
  for (let a = 0, o = i * t.width; a < t.width; a++, o++) {
    let l = t.map[o];
    if (!c.has(l)) {
      if ((c.add(l), i > 0 && l == t.map[o - t.width])) {
        let t = n.nodeAt(l).attrs;
        (e.setNodeMarkup(e.mapping.slice(s).map(l + r), null, { ...t, rowspan: t.rowspan - 1 }),
          (a += t.colspan - 1));
      } else if (i < t.height && l == t.map[o + t.width]) {
        let o = n.nodeAt(l),
          c = o.attrs,
          u = o.type.create({ ...c, rowspan: o.attrs.rowspan - 1 }, o.content),
          d = t.positionAt(i + 1, a, n);
        (e.insert(e.mapping.slice(s).map(r + d), u), (a += c.colspan - 1));
      }
    }
  }
}
function Li(e, t) {
  if (!J(e)) return !1;
  if (t) {
    let n = X(e),
      r = e.tr;
    if (n.top == 0 && n.bottom == n.map.height) return !1;
    for (let e = n.bottom - 1; Ii(r, n, e), e != n.top; e--) {
      let e = n.tableStart ? r.doc.nodeAt(n.tableStart - 1) : r.doc;
      if (!e) throw RangeError(`No table found`);
      ((n.table = e), (n.map = G.get(n.table)));
    }
    t(r);
  }
  return !0;
}
function Ri(e) {
  let t = e.content;
  return t.childCount == 1 && t.child(0).isTextblock && t.child(0).childCount == 0;
}
function zi({ width: e, height: t, map: n }, r) {
  let i = r.top * e + r.left,
    a = i,
    o = (r.bottom - 1) * e + r.left,
    s = i + (r.right - r.left - 1);
  for (let t = r.top; t < r.bottom; t++) {
    if ((r.left > 0 && n[a] == n[a - 1]) || (r.right < e && n[s] == n[s + 1])) return !0;
    ((a += e), (s += e));
  }
  for (let a = r.left; a < r.right; a++) {
    if ((r.top > 0 && n[i] == n[i - e]) || (r.bottom < t && n[o] == n[o + e])) return !0;
    (i++, o++);
  }
  return !1;
}
function Bi(e, t) {
  let r = e.selection;
  if (!(r instanceof Y) || r.$anchorCell.pos == r.$headCell.pos) return !1;
  let i = X(e),
    { map: a } = i;
  if (zi(a, i)) return !1;
  if (t) {
    let r = e.tr,
      o = {},
      s = n.empty,
      c,
      l;
    for (let e = i.top; e < i.bottom; e++)
      for (let t = i.left; t < i.right; t++) {
        let n = a.map[e * a.width + t],
          u = i.table.nodeAt(n);
        if (!o[n] && u) {
          if (((o[n] = !0), c == null)) ((c = n), (l = u));
          else {
            Ri(u) || (s = s.append(u.content));
            let e = r.mapping.map(n + i.tableStart);
            r.delete(e, e + u.nodeSize);
          }
        }
      }
    if (c == null || l == null) return !0;
    if (
      (r.setNodeMarkup(c + i.tableStart, null, {
        ...mi(l.attrs, l.attrs.colspan, i.right - i.left - l.attrs.colspan),
        rowspan: i.bottom - i.top,
      }),
      s.size > 0)
    ) {
      let e = c + 1 + l.content.size,
        t = Ri(l) ? c + 1 : e;
      r.replaceWith(t + i.tableStart, e + i.tableStart, s);
    }
    (r.setSelection(new Y(r.doc.resolve(c + i.tableStart))), t(r));
  }
  return !0;
}
function Vi(e, t) {
  let n = K(e.schema);
  return Hi(({ node: e }) => n[e.type.spec.tableRole])(e, t);
}
function Hi(e) {
  return (t, n) => {
    let r = t.selection,
      i,
      a;
    if (r instanceof Y) {
      if (r.$anchorCell.pos != r.$headCell.pos) return !1;
      ((i = r.$anchorCell.nodeAfter), (a = r.$anchorCell.pos));
    } else {
      if (((i = oi(r.$from)), !i)) return !1;
      a = ai(r.$from)?.pos;
    }
    if (i == null || a == null || (i.attrs.colspan == 1 && i.attrs.rowspan == 1)) return !1;
    if (n) {
      let o = i.attrs,
        s = [],
        c = o.colwidth;
      (o.rowspan > 1 && (o = { ...o, rowspan: 1 }), o.colspan > 1 && (o = { ...o, colspan: 1 }));
      let l = X(t),
        u = t.tr;
      for (let e = 0; e < l.right - l.left; e++)
        s.push(c ? { ...o, colwidth: c && c[e] ? [c[e]] : null } : o);
      let d;
      for (let t = l.top; t < l.bottom; t++) {
        let n = l.map.positionAt(t, l.left, l.table);
        t == l.top && (n += i.nodeSize);
        for (let r = l.left, a = 0; r < l.right; r++, a++)
          (r != l.left || t != l.top) &&
            u.insert(
              (d = u.mapping.map(n + l.tableStart, 1)),
              e({ node: i, row: t, col: r }).createAndFill(s[a]),
            );
      }
      (u.setNodeMarkup(a, e({ node: i, row: l.top, col: l.left }), s[0]),
        r instanceof Y &&
          u.setSelection(new Y(u.doc.resolve(r.$anchorCell.pos), d ? u.doc.resolve(d) : void 0)),
        n(u));
    }
    return !0;
  };
}
function Ui(e, t) {
  return function (n, r) {
    if (!J(n)) return !1;
    let i = si(n);
    if (i.nodeAfter.attrs[e] === t) return !1;
    if (r) {
      let a = n.tr;
      (n.selection instanceof Y
        ? n.selection.forEachCell((n, r) => {
            n.attrs[e] !== t && a.setNodeMarkup(r, null, { ...n.attrs, [e]: t });
          })
        : a.setNodeMarkup(i.pos, null, { ...i.nodeAfter.attrs, [e]: t }),
        r(a));
    }
    return !0;
  };
}
function Wi(e) {
  return function (t, n) {
    if (!J(t)) return !1;
    if (n) {
      let r = K(t.schema),
        i = X(t),
        a = t.tr,
        o = i.map.cellsInRect(
          e == `column`
            ? { left: i.left, top: 0, right: i.right, bottom: i.map.height }
            : e == `row`
              ? { left: 0, top: i.top, right: i.map.width, bottom: i.bottom }
              : i,
        ),
        s = o.map((e) => i.table.nodeAt(e));
      for (let e = 0; e < o.length; e++)
        s[e].type == r.header_cell && a.setNodeMarkup(i.tableStart + o[e], r.cell, s[e].attrs);
      if (a.steps.length === 0)
        for (let e = 0; e < o.length; e++)
          a.setNodeMarkup(i.tableStart + o[e], r.header_cell, s[e].attrs);
      n(a);
    }
    return !0;
  };
}
function Gi(e, t, n) {
  let r = t.map.cellsInRect({
    left: 0,
    top: 0,
    right: e == `row` ? t.map.width : 1,
    bottom: e == `column` ? t.map.height : 1,
  });
  for (let e = 0; e < r.length; e++) {
    let i = t.table.nodeAt(r[e]);
    if (i && i.type !== n.header_cell) return !1;
  }
  return !0;
}
function Ki(e, t) {
  return (
    (t ||= { useDeprecatedLogic: !1 }),
    t.useDeprecatedLogic
      ? Wi(e)
      : function (t, n) {
          if (!J(t)) return !1;
          if (n) {
            let r = K(t.schema),
              i = X(t),
              a = t.tr,
              o = Gi(`row`, i, r),
              s = Gi(`column`, i, r),
              c = (e === `column` ? o : e === `row` && s) ? 1 : 0,
              l =
                e == `column`
                  ? { left: 0, top: c, right: 1, bottom: i.map.height }
                  : e == `row`
                    ? { left: c, top: 0, right: i.map.width, bottom: 1 }
                    : i,
              u =
                e == `column`
                  ? s
                    ? r.cell
                    : r.header_cell
                  : e == `row`
                    ? o
                      ? r.cell
                      : r.header_cell
                    : r.cell;
            (i.map.cellsInRect(l).forEach((e) => {
              let t = e + i.tableStart,
                n = a.doc.nodeAt(t);
              n && a.setNodeMarkup(t, u, n.attrs);
            }),
              n(a));
          }
          return !0;
        }
  );
}
(Ki(`row`, { useDeprecatedLogic: !0 }),
  Ki(`column`, { useDeprecatedLogic: !0 }),
  Ki(`cell`, { useDeprecatedLogic: !0 }));
function qi(e, t) {
  if (t < 0) {
    let t = e.nodeBefore;
    if (t) return e.pos - t.nodeSize;
    for (let t = e.index(-1) - 1, n = e.before(); t >= 0; t--) {
      let r = e.node(-1).child(t),
        i = r.lastChild;
      if (i) return n - 1 - i.nodeSize;
      n -= r.nodeSize;
    }
  } else {
    if (e.index() < e.parent.childCount - 1) return e.pos + e.nodeAfter.nodeSize;
    let t = e.node(-1);
    for (let n = e.indexAfter(-1), r = e.after(); n < t.childCount; n++) {
      let e = t.child(n);
      if (e.childCount) return r + 1;
      r += e.nodeSize;
    }
  }
  return null;
}
function Ji(e) {
  return function (t, n) {
    if (!J(t)) return !1;
    let r = qi(si(t), e);
    if (r == null) return !1;
    if (n) {
      let e = t.doc.resolve(r);
      n(t.tr.setSelection(s.between(e, ui(e))).scrollIntoView());
    }
    return !0;
  };
}
function Yi(e, t) {
  let n = e.selection.$anchor;
  for (let r = n.depth; r > 0; r--)
    if (n.node(r).type.spec.tableRole == `table`)
      return (t && t(e.tr.delete(n.before(r), n.after(r)).scrollIntoView()), !0);
  return !1;
}
function Xi(e, t) {
  let n = e.selection;
  if (!(n instanceof Y)) return !1;
  if (t) {
    let r = e.tr,
      i = K(e.schema).cell.createAndFill().content;
    (n.forEachCell((e, t) => {
      e.content.eq(i) ||
        r.replace(r.mapping.map(t + 1), r.mapping.map(t + e.nodeSize - 1), new l(i, 0, 0));
    }),
      r.docChanged && t(r));
  }
  return !0;
}
function Zi(e) {
  if (e.size === 0) return null;
  let { content: t, openStart: n, openEnd: r } = e;
  for (; t.childCount == 1 && ((n > 0 && r > 0) || t.child(0).type.spec.tableRole == `table`);)
    (n--, r--, (t = t.child(0).content));
  let i = t.child(0),
    a = i.type.spec.tableRole,
    o = i.type.schema,
    s = [];
  if (a == `row`)
    for (let e = 0; e < t.childCount; e++) {
      let i = t.child(e).content,
        a = e ? 0 : Math.max(0, n - 1),
        c = e < t.childCount - 1 ? 0 : Math.max(0, r - 1);
      ((a || c) && (i = $i(K(o).row, new l(i, a, c)).content), s.push(i));
    }
  else if (a == `cell` || a == `header_cell`)
    s.push(n || r ? $i(K(o).row, new l(t, n, r)).content : t);
  else return null;
  return Qi(o, s);
}
function Qi(e, t) {
  let r = [];
  for (let e = 0; e < t.length; e++) {
    let n = t[e];
    for (let t = n.childCount - 1; t >= 0; t--) {
      let { rowspan: i, colspan: a } = n.child(t).attrs;
      for (let t = e; t < e + i; t++) r[t] = (r[t] || 0) + a;
    }
  }
  let i = 0;
  for (let e = 0; e < r.length; e++) i = Math.max(i, r[e]);
  for (let a = 0; a < r.length; a++)
    if ((a >= t.length && t.push(n.empty), r[a] < i)) {
      let o = K(e).cell.createAndFill(),
        s = [];
      for (let e = r[a]; e < i; e++) s.push(o);
      t[a] = t[a].append(n.from(s));
    }
  return { height: t.length, width: i, rows: t };
}
function $i(e, t) {
  let n = e.createAndFill();
  return new u(n).replace(0, n.content.size, t).doc;
}
function ea({ width: e, height: t, rows: r }, i, a) {
  if (e != i) {
    let t = [],
      a = [];
    for (let e = 0; e < r.length; e++) {
      let o = r[e],
        s = [];
      for (let n = t[e] || 0, r = 0; n < i; r++) {
        let a = o.child(r % o.childCount);
        (n + a.attrs.colspan > i &&
          (a = a.type.createChecked(
            pi(a.attrs, a.attrs.colspan, n + a.attrs.colspan - i),
            a.content,
          )),
          s.push(a),
          (n += a.attrs.colspan));
        for (let n = 1; n < a.attrs.rowspan; n++) t[e + n] = (t[e + n] || 0) + a.attrs.colspan;
      }
      a.push(n.from(s));
    }
    ((r = a), (e = i));
  }
  if (t != a) {
    let e = [];
    for (let i = 0, o = 0; i < a; i++, o++) {
      let s = [],
        c = r[o % t];
      for (let e = 0; e < c.childCount; e++) {
        let t = c.child(e);
        (i + t.attrs.rowspan > a &&
          (t = t.type.create({ ...t.attrs, rowspan: Math.max(1, a - t.attrs.rowspan) }, t.content)),
          s.push(t));
      }
      e.push(n.from(s));
    }
    ((r = e), (t = a));
  }
  return { width: e, height: t, rows: r };
}
function ta(e, t, r, i, a, o, s) {
  let c = e.doc.type.schema,
    l = K(c),
    u,
    d;
  if (a > t.width)
    for (let n = 0, o = 0; n < t.height; n++) {
      let c = r.child(n);
      o += c.nodeSize;
      let f = [],
        p;
      p =
        c.lastChild == null || c.lastChild.type == l.cell
          ? (u ||= l.cell.createAndFill())
          : (d ||= l.header_cell.createAndFill());
      for (let e = t.width; e < a; e++) f.push(p);
      e.insert(e.mapping.slice(s).map(o - 1 + i), f);
    }
  if (o > t.height) {
    let c = [];
    for (let e = 0, n = (t.height - 1) * t.width; e < Math.max(t.width, a); e++) {
      let i = e >= t.width ? !1 : r.nodeAt(t.map[n + e]).type == l.header_cell;
      c.push(i ? (d ||= l.header_cell.createAndFill()) : (u ||= l.cell.createAndFill()));
    }
    let f = l.row.create(null, n.from(c)),
      p = [];
    for (let e = t.height; e < o; e++) p.push(f);
    e.insert(e.mapping.slice(s).map(i + r.nodeSize - 2), p);
  }
  return !!(u || d);
}
function na(e, t, n, r, i, a, o, s) {
  if (o == 0 || o == t.height) return !1;
  let c = !1;
  for (let l = i; l < a; l++) {
    let i = o * t.width + l,
      a = t.map[i];
    if (t.map[i - t.width] == a) {
      c = !0;
      let i = n.nodeAt(a),
        { top: u, left: d } = t.findCell(a);
      (e.setNodeMarkup(e.mapping.slice(s).map(a + r), null, { ...i.attrs, rowspan: o - u }),
        e.insert(
          e.mapping.slice(s).map(t.positionAt(o, d, n)),
          i.type.createAndFill({ ...i.attrs, rowspan: u + i.attrs.rowspan - o }),
        ),
        (l += i.attrs.colspan - 1));
    }
  }
  return c;
}
function ra(e, t, n, r, i, a, o, s) {
  if (o == 0 || o == t.width) return !1;
  let c = !1;
  for (let l = i; l < a; l++) {
    let i = l * t.width + o,
      a = t.map[i];
    if (t.map[i - 1] == a) {
      c = !0;
      let i = n.nodeAt(a),
        u = t.colCount(a),
        d = e.mapping.slice(s).map(a + r);
      (e.setNodeMarkup(d, null, pi(i.attrs, o - u, i.attrs.colspan - (o - u))),
        e.insert(d + i.nodeSize, i.type.createAndFill(pi(i.attrs, 0, o - u))),
        (l += i.attrs.rowspan - 1));
    }
  }
  return c;
}
function ia(e, t, n, r, i) {
  let a = n ? e.doc.nodeAt(n - 1) : e.doc;
  if (!a) throw Error(`No table found`);
  let o = G.get(a),
    { top: s, left: c } = r,
    u = c + i.width,
    d = s + i.height,
    f = e.tr,
    p = 0;
  function m() {
    if (((a = n ? f.doc.nodeAt(n - 1) : f.doc), !a)) throw Error(`No table found`);
    ((o = G.get(a)), (p = f.mapping.maps.length));
  }
  (ta(f, o, a, n, u, d, p) && m(),
    na(f, o, a, n, c, u, s, p) && m(),
    na(f, o, a, n, c, u, d, p) && m(),
    ra(f, o, a, n, s, d, c, p) && m(),
    ra(f, o, a, n, s, d, u, p) && m());
  for (let e = s; e < d; e++) {
    let t = o.positionAt(e, c, a),
      r = o.positionAt(e, u, a);
    f.replace(
      f.mapping.slice(p).map(t + n),
      f.mapping.slice(p).map(r + n),
      new l(i.rows[e - s], 0, 0),
    );
  }
  (m(),
    f.setSelection(
      new Y(
        f.doc.resolve(n + o.positionAt(s, c, a)),
        f.doc.resolve(n + o.positionAt(d - 1, u - 1, a)),
      ),
    ),
    t(f));
}
var aa = _({
  ArrowLeft: sa(`horiz`, -1),
  ArrowRight: sa(`horiz`, 1),
  ArrowUp: sa(`vert`, -1),
  ArrowDown: sa(`vert`, 1),
  'Shift-ArrowLeft': ca(`horiz`, -1),
  'Shift-ArrowRight': ca(`horiz`, 1),
  'Shift-ArrowUp': ca(`vert`, -1),
  'Shift-ArrowDown': ca(`vert`, 1),
  Backspace: Xi,
  'Mod-Backspace': Xi,
  Delete: Xi,
  'Mod-Delete': Xi,
});
function oa(e, t, n) {
  return !n.eq(e.selection) && (t && t(e.tr.setSelection(n).scrollIntoView()), !0);
}
function sa(e, t) {
  return (n, r, i) => {
    if (!i) return !1;
    let a = n.selection;
    if (a instanceof Y) return oa(n, r, d.near(a.$headCell, t));
    if (e != `horiz` && !a.empty) return !1;
    let o = fa(i, e, t);
    if (o == null) return !1;
    if (e == `horiz`) return oa(n, r, d.near(n.doc.resolve(a.head + t), t));
    {
      let i = n.doc.resolve(o),
        a = fi(i, e, t),
        s;
      return (
        (s = a
          ? d.near(a, 1)
          : t < 0
            ? d.near(n.doc.resolve(i.before(-1)), -1)
            : d.near(n.doc.resolve(i.after(-1)), 1)),
        oa(n, r, s)
      );
    }
  };
}
function ca(e, t) {
  return (n, r, i) => {
    if (!i) return !1;
    let a = n.selection,
      o;
    if (a instanceof Y) o = a;
    else {
      let r = fa(i, e, t);
      if (r == null) return !1;
      o = new Y(n.doc.resolve(r));
    }
    let s = fi(o.$headCell, e, t);
    return s ? oa(n, r, new Y(o.$anchorCell, s)) : !1;
  };
}
function la(e, t) {
  let n = e.state.doc,
    r = ai(n.resolve(t));
  return r ? (e.dispatch(e.state.tr.setSelection(new Y(r))), !0) : !1;
}
function ua(e, t, r) {
  if (!J(e.state)) return !1;
  let i = Zi(r),
    a = e.state.selection;
  if (a instanceof Y) {
    i ||= { width: 1, height: 1, rows: [n.from($i(K(e.state.schema).cell, r))] };
    let t = a.$anchorCell.node(-1),
      o = a.$anchorCell.start(-1),
      s = G.get(t).rectBetween(a.$anchorCell.pos - o, a.$headCell.pos - o);
    return ((i = ea(i, s.right - s.left, s.bottom - s.top)), ia(e.state, e.dispatch, o, s, i), !0);
  }
  if (i) {
    let t = si(e.state),
      n = t.start(-1);
    return (ia(e.state, e.dispatch, n, G.get(t.node(-1)).findCell(t.pos - n), i), !0);
  }
  return !1;
}
function da(e, t) {
  if (t.button != 0 || t.ctrlKey || t.metaKey) return;
  let n = pa(e, t.target),
    r;
  if (t.shiftKey && e.state.selection instanceof Y)
    (i(e.state.selection.$anchorCell, t), t.preventDefault());
  else if (t.shiftKey && n && (r = ai(e.state.selection.$anchor)) != null && ma(e, t)?.pos != r.pos)
    (i(r, t), t.preventDefault());
  else if (!n) return;
  function i(t, n) {
    let r = ma(e, n),
      i = q.getState(e.state) == null;
    if (!r || !di(t, r)) {
      if (i) r = t;
      else return;
    }
    let a = new Y(t, r);
    if (i || !e.state.selection.eq(a)) {
      let n = e.state.tr.setSelection(a);
      (i && n.setMeta(q, t.pos), e.dispatch(n));
    }
  }
  function a() {
    (e.root.removeEventListener(`mouseup`, a),
      e.root.removeEventListener(`dragstart`, a),
      e.root.removeEventListener(`mousemove`, o),
      q.getState(e.state) != null && e.dispatch(e.state.tr.setMeta(q, -1)));
  }
  function o(r) {
    let o = r,
      s = q.getState(e.state),
      c;
    if (s != null) c = e.state.doc.resolve(s);
    else if (pa(e, o.target) != n && ((c = ma(e, t)), !c)) return a();
    c && i(c, o);
  }
  (e.root.addEventListener(`mouseup`, a),
    e.root.addEventListener(`dragstart`, a),
    e.root.addEventListener(`mousemove`, o));
}
function fa(e, t, n) {
  if (!(e.state.selection instanceof s)) return null;
  let { $head: r } = e.state.selection;
  for (let i = r.depth - 1; i >= 0; i--) {
    let a = r.node(i);
    if ((n < 0 ? r.index(i) : r.indexAfter(i)) != (n < 0 ? 0 : a.childCount)) return null;
    if (a.type.spec.tableRole == `cell` || a.type.spec.tableRole == `header_cell`) {
      let a = r.before(i),
        o = t == `vert` ? (n > 0 ? `down` : `up`) : n > 0 ? `right` : `left`;
      return e.endOfTextblock(o) ? a : null;
    }
  }
  return null;
}
function pa(e, t) {
  for (; t && t != e.dom; t = t.parentNode) if (t.nodeName == `TD` || t.nodeName == `TH`) return t;
  return null;
}
function ma(e, t) {
  let n = e.posAtCoords({ left: t.clientX, top: t.clientY });
  if (!n) return null;
  let { inside: r, pos: i } = n;
  return (r >= 0 && ai(e.state.doc.resolve(r))) || ai(e.state.doc.resolve(i));
}
var ha = class {
  constructor(e, t) {
    ((this.node = e),
      (this.defaultCellMinWidth = t),
      (this.dom = document.createElement(`div`)),
      (this.dom.className = `tableWrapper`),
      (this.table = this.dom.appendChild(document.createElement(`table`))),
      this.table.style.setProperty(`--default-cell-min-width`, `${t}px`),
      (this.colgroup = this.table.appendChild(document.createElement(`colgroup`))),
      ga(e, this.colgroup, this.table, t),
      (this.contentDOM = this.table.appendChild(document.createElement(`tbody`))));
  }
  update(e) {
    return (
      e.type == this.node.type &&
      ((this.node = e), ga(e, this.colgroup, this.table, this.defaultCellMinWidth), !0)
    );
  }
  ignoreMutation(e) {
    return e.type == `attributes` && (e.target == this.table || this.colgroup.contains(e.target));
  }
};
function ga(e, t, n, r, i, a) {
  let o = 0,
    s = !0,
    c = t.firstChild,
    l = e.firstChild;
  if (l) {
    for (let e = 0, n = 0; e < l.childCount; e++) {
      let { colspan: u, colwidth: d } = l.child(e).attrs;
      for (let e = 0; e < u; e++, n++) {
        let l = i == n ? a : d && d[e],
          u = l ? l + `px` : ``;
        if (((o += l || r), l || (s = !1), c))
          (c.style.width != u && (c.style.width = u), (c = c.nextSibling));
        else {
          let e = document.createElement(`col`);
          ((e.style.width = u), t.appendChild(e));
        }
      }
    }
    for (; c;) {
      var u;
      let e = c.nextSibling;
      ((u = c.parentNode) == null || u.removeChild(c), (c = e));
    }
    s
      ? ((n.style.width = o + `px`), (n.style.minWidth = ``))
      : ((n.style.width = ``), (n.style.minWidth = o + `px`));
  }
}
var Z = new o(`tableColumnResizing`);
function _a({
  handleWidth: e = 5,
  cellMinWidth: t = 25,
  defaultCellMinWidth: n = 100,
  View: r = ha,
  lastColumnResizable: i = !0,
} = {}) {
  let a = new c({
    key: Z,
    state: {
      init(e, t) {
        var i;
        let o = (i = a.spec) == null || (i = i.props) == null ? void 0 : i.nodeViews,
          s = K(t.schema).table.name;
        return (r && o && (o[s] = (e, t) => new r(e, n, t)), new va(-1, !1));
      },
      apply(e, t) {
        return t.apply(e);
      },
    },
    props: {
      attributes: (e) => {
        let t = Z.getState(e);
        return t && t.activeHandle > -1 ? { class: `resize-cursor` } : {};
      },
      handleDOMEvents: {
        mousemove: (t, n) => {
          ya(t, n, e, i);
        },
        mouseleave: (e) => {
          ba(e);
        },
        mousedown: (e, r) => {
          xa(e, r, t, n);
        },
      },
      decorations: (e) => {
        let t = Z.getState(e);
        if (t && t.activeHandle > -1) return Aa(e, t.activeHandle);
      },
      nodeViews: {},
    },
  });
  return a;
}
var va = class e {
  constructor(e, t) {
    ((this.activeHandle = e), (this.dragging = t));
  }
  apply(t) {
    let n = this,
      r = t.getMeta(Z);
    if (r && r.setHandle != null) return new e(r.setHandle, !1);
    if (r && r.setDragging !== void 0) return new e(n.activeHandle, r.setDragging);
    if (n.activeHandle > -1 && t.docChanged) {
      let r = t.mapping.map(n.activeHandle, -1);
      return (li(t.doc.resolve(r)) || (r = -1), new e(r, n.dragging));
    }
    return n;
  }
};
function ya(e, t, n, r) {
  if (!e.editable) return;
  let i = Z.getState(e.state);
  if (i && !i.dragging) {
    let a = Ca(t.target),
      o = -1;
    if (a) {
      let { left: r, right: i } = a.getBoundingClientRect();
      t.clientX - r <= n
        ? (o = wa(e, t, `left`, n))
        : i - t.clientX <= n && (o = wa(e, t, `right`, n));
    }
    if (o != i.activeHandle) {
      if (!r && o !== -1) {
        let t = e.state.doc.resolve(o),
          n = t.node(-1),
          r = G.get(n),
          i = t.start(-1);
        if (r.colCount(t.pos - i) + t.nodeAfter.attrs.colspan - 1 == r.width - 1) return;
      }
      Ea(e, o);
    }
  }
}
function ba(e) {
  if (!e.editable) return;
  let t = Z.getState(e.state);
  t && t.activeHandle > -1 && !t.dragging && Ea(e, -1);
}
function xa(e, t, n, r) {
  if (!e.editable) return !1;
  let i = e.dom.ownerDocument.defaultView ?? window,
    a = Z.getState(e.state);
  if (!a || a.activeHandle == -1 || a.dragging) return !1;
  let o = e.state.doc.nodeAt(a.activeHandle),
    s = Sa(e, a.activeHandle, o.attrs);
  e.dispatch(e.state.tr.setMeta(Z, { setDragging: { startX: t.clientX, startWidth: s } }));
  function c(t) {
    (i.removeEventListener(`mouseup`, c), i.removeEventListener(`mousemove`, l));
    let r = Z.getState(e.state);
    r?.dragging &&
      (Da(e, r.activeHandle, Ta(r.dragging, t, n)),
      e.dispatch(e.state.tr.setMeta(Z, { setDragging: null })));
  }
  function l(t) {
    if (!t.which) return c(t);
    let i = Z.getState(e.state);
    if (i && i.dragging) {
      let a = Ta(i.dragging, t, n);
      Oa(e, i.activeHandle, a, r);
    }
  }
  return (
    Oa(e, a.activeHandle, s, r),
    i.addEventListener(`mouseup`, c),
    i.addEventListener(`mousemove`, l),
    t.preventDefault(),
    !0
  );
}
function Sa(e, t, { colspan: n, colwidth: r }) {
  let i = r && r[r.length - 1];
  if (i) return i;
  let a = e.domAtPos(t),
    o = a.node.childNodes[a.offset].offsetWidth,
    s = n;
  if (r) for (let e = 0; e < n; e++) r[e] && ((o -= r[e]), s--);
  return o / s;
}
function Ca(e) {
  for (; e && e.nodeName != `TD` && e.nodeName != `TH`;)
    e = e.classList && e.classList.contains(`ProseMirror`) ? null : e.parentNode;
  return e;
}
function wa(e, t, n, r) {
  let i = n == `right` ? -r : r,
    a = e.posAtCoords({ left: t.clientX + i, top: t.clientY });
  if (!a) return -1;
  let { pos: o } = a,
    s = ai(e.state.doc.resolve(o));
  if (!s) return -1;
  if (n == `right`) return s.pos;
  let c = G.get(s.node(-1)),
    l = s.start(-1),
    u = c.map.indexOf(s.pos - l);
  return u % c.width == 0 ? -1 : l + c.map[u - 1];
}
function Ta(e, t, n) {
  let r = t.clientX - e.startX;
  return Math.max(n, e.startWidth + r);
}
function Ea(e, t) {
  e.dispatch(e.state.tr.setMeta(Z, { setHandle: t }));
}
function Da(e, t, n) {
  let r = e.state.doc.resolve(t),
    i = r.node(-1),
    a = G.get(i),
    o = r.start(-1),
    s = a.colCount(r.pos - o) + r.nodeAfter.attrs.colspan - 1,
    c = e.state.tr;
  for (let e = 0; e < a.height; e++) {
    let t = e * a.width + s;
    if (e && a.map[t] == a.map[t - a.width]) continue;
    let r = a.map[t],
      l = i.nodeAt(r).attrs,
      u = l.colspan == 1 ? 0 : s - a.colCount(r);
    if (l.colwidth && l.colwidth[u] == n) continue;
    let d = l.colwidth ? l.colwidth.slice() : ka(l.colspan);
    ((d[u] = n), c.setNodeMarkup(o + r, null, { ...l, colwidth: d }));
  }
  c.docChanged && e.dispatch(c);
}
function Oa(e, t, n, r) {
  let i = e.state.doc.resolve(t),
    a = i.node(-1),
    o = i.start(-1),
    s = G.get(a).colCount(i.pos - o) + i.nodeAfter.attrs.colspan - 1,
    c = e.domAtPos(i.start(-1)).node;
  for (; c && c.nodeName != `TABLE`;) c = c.parentNode;
  c && ga(a, c.firstChild, c, r, s, n);
}
function ka(e) {
  return Array(e).fill(0);
}
function Aa(e, t) {
  let n = [],
    r = e.doc.resolve(t),
    i = r.node(-1);
  if (!i) return H.empty;
  let a = G.get(i),
    o = r.start(-1),
    s = a.colCount(r.pos - o) + r.nodeAfter.attrs.colspan - 1;
  for (let t = 0; t < a.height; t++) {
    let r = s + t * a.width;
    if (
      (s == a.width - 1 || a.map[r] != a.map[r + 1]) &&
      (t == 0 || a.map[r] != a.map[r - a.width])
    ) {
      let t = a.map[r],
        s = o + t + i.nodeAt(t).nodeSize - 1,
        c = document.createElement(`div`);
      ((c.className = `column-resize-handle`),
        Z.getState(e)?.dragging &&
          n.push(V.node(o + t, o + t + i.nodeAt(t).nodeSize, { class: `column-resize-dragging` })),
        n.push(V.widget(s, c)));
    }
  }
  return H.create(e.doc, n);
}
function ja({ allowTableNodeSelection: e = !1 } = {}) {
  return new c({
    key: q,
    state: {
      init() {
        return null;
      },
      apply(e, t) {
        let n = e.getMeta(q);
        if (n != null) return n == -1 ? null : n;
        if (t == null || !e.docChanged) return t;
        let { deleted: r, pos: i } = e.mapping.mapResult(t);
        return r ? null : i;
      },
    },
    props: {
      decorations: _i,
      handleDOMEvents: { mousedown: da },
      createSelectionBetween(e) {
        return q.getState(e.state) == null ? null : e.state.selection;
      },
      handleTripleClick: la,
      handleKeyDown: aa,
      handlePaste: ua,
    },
    appendTransaction(t, n, r) {
      return bi(r, Ci(r, n), e);
    },
  });
}
var Ma = [`left`, `center`, `right`, `justify`],
  Na =
    /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)|[a-z]{3,20})$/i,
  Pa = /^\d{1,4}(\.\d{1,3})?(px|pt|em|rem|%)$/,
  Fa = /^\d{1,2}(\.\d{1,3})?(px|em|%)?$/,
  Ia = /^[\w\s,'"-]{1,200}$/;
function La(e) {
  let t = e.trim().toLowerCase(),
    n = t.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(1|1\.0+)\s*)?\)$/);
  if (n)
    return (
      `#` +
      n
        .slice(1, 4)
        .map((e) => Math.min(255, Number(e)).toString(16).padStart(2, `0`))
        .join(``)
    );
  let r = t.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  return r ? `#${r[1]}${r[1]}${r[2]}${r[2]}${r[3]}${r[3]}` : t;
}
var Q = {
  color: (e) =>
    typeof e == `string` &&
    Na.test(e.trim()) &&
    !/^(inherit|initial|unset|currentcolor|transparent|windowtext|window|auto|none)$/i.test(
      e.trim(),
    )
      ? La(e)
      : null,
  length: (e) => (typeof e == `string` && Pa.test(e.trim()) ? e.trim() : null),
  lineHeight: (e) =>
    typeof e == `string` && Fa.test(e.trim()) && e.trim() !== `normal` ? e.trim() : null,
  fontFamily: (e) => (typeof e == `string` && Ia.test(e.trim()) ? e.trim() : null),
};
function Ra(e) {
  let t = e.getAttribute(`dir`)?.toLowerCase();
  return t === `rtl` || t === `ltr` ? t : null;
}
function za(e) {
  let t = e.style.textAlign;
  return {
    align: Ma.includes(t) ? t : null,
    lineHeight: Q.lineHeight(e.style.lineHeight),
    dir: Ra(e),
  };
}
function Ba(e) {
  let t = {};
  (e.dir === `rtl` || e.dir === `ltr`) && (t.dir = e.dir);
  let n = [],
    r = e.align;
  r && Ma.includes(r) && n.push(`text-align: ${r};`);
  let i = Q.lineHeight(e.lineHeight);
  return (i && n.push(`line-height: ${i};`), n.length && (t.style = n.join(` `)), t);
}
var Va = { align: { default: null }, lineHeight: { default: null }, dir: { default: null } },
  Ha = [`disc`, `circle`, `square`],
  Ua = [`decimal`, `lower-alpha`, `upper-alpha`, `lower-roman`, `upper-roman`, `lower-greek`],
  Wa = { 1: `decimal`, a: `lower-alpha`, A: `upper-alpha`, i: `lower-roman`, I: `upper-roman` };
function Ga(e, t, n) {
  let r = e.style.listStyleType.toLowerCase(),
    i = Wa[e.getAttribute(`type`) ?? ``] ?? ``,
    a = t.includes(r) ? r : t.includes(i) ? i : null;
  return a === n ? null : a;
}
function Ka(e, t) {
  return typeof e == `string` && t.includes(e) ? { style: `list-style-type: ${e};` } : {};
}
var qa = {
  left: `float: left; margin: 0 1em 1em 0;`,
  right: `float: right; margin: 0 0 1em 1em;`,
  center: `display: block; margin-left: auto; margin-right: auto;`,
};
function Ja(e) {
  let t = e.style.float || e.getAttribute(`align`);
  return t === `left` || t === `right`
    ? t
    : e.style.display === `block` && e.style.marginLeft === `auto` && e.style.marginRight === `auto`
      ? `center`
      : null;
}
function Ya(e) {
  if (e == null || e === ``) return null;
  let t = String(e)
    .trim()
    .match(/^(\d{1,5})(px)?$/);
  if (!t) return null;
  let n = Number(t[1]);
  return n >= 1 && n <= 1e4 ? n : null;
}
var Xa = [`top`, `middle`, `bottom`];
function Za(e) {
  let t = [],
    n = Q.length(e.width);
  return (
    n && t.push(`width: ${n};`),
    e.align === `center`
      ? t.push(`margin-left: auto; margin-right: auto;`)
      : e.align === `right` && t.push(`margin-left: auto;`),
    t.join(` `)
  );
}
var Qa = 100;
function $a(e) {
  let t = ii({
    tableGroup: `block`,
    cellContent: `block+`,
    cellAttributes: {
      class: {
        default: null,
        getFromDOM: (t) => ro(t, e),
        setDOMAttr: (e, t) => {
          let n = $(e).class;
          n && (t.class = n);
        },
      },
      background: {
        default: null,
        getFromDOM: (e) => Q.color(e.getAttribute(`data-nova-cell-bg`) ?? e.style?.backgroundColor),
        setDOMAttr: (e, t) => {
          let n = Q.color(e);
          n && (t.style = `${t.style ?? ``}background-color: ${n};`);
        },
      },
      valign: {
        default: null,
        getFromDOM: (e) => {
          let t = e,
            n = (t.style.verticalAlign || t.getAttribute(`valign`) || ``).toLowerCase();
          return Xa.includes(n) ? n : null;
        },
        setDOMAttr: (e, t) => {
          Xa.includes(e) && (t.style = `${t.style ?? ``}vertical-align: ${e};`);
        },
      },
    },
  });
  ((t.table.attrs = {
    width: { default: null },
    align: { default: null },
    class: { default: null },
  }),
    (t.table.parseDOM = [
      {
        tag: `table`,
        getAttrs: (t) => {
          let n = t,
            r = Q.length(n.style.width) ?? Q.length(`${n.getAttribute(`width`) ?? ``}px`),
            i = (e) => e === `auto`;
          return {
            width: r,
            align:
              n.getAttribute(`align`) === `center` ||
              (i(n.style.marginLeft) && i(n.style.marginRight))
                ? `center`
                : n.getAttribute(`align`) === `right` || i(n.style.marginLeft)
                  ? `right`
                  : null,
            class: ro(n, e),
          };
        },
      },
    ]),
    (t.table.toDOM = (e) => {
      let t = Za(e.attrs);
      return [`table`, { ...$(e.attrs.class), ...(t ? { style: t } : {}) }, [`tbody`, 0]];
    }));
  for (let e of [`table_cell`, `table_header`]) {
    let n = t[e],
      r = n.parseDOM[0],
      i = r.getAttrs;
    r.getAttrs = (e) => {
      let t = i(e);
      if (!t) return t;
      let n = (e) => Math.min(Qa, Math.max(1, Number.isFinite(e) ? Math.floor(e) : 1));
      return { ...t, colspan: n(t.colspan), rowspan: n(t.rowspan) };
    };
    let a = n.toDOM;
    n.toDOM = (e) => {
      let t = a(e),
        n = e.attrs.colwidth;
      if (n?.every((e) => e > 0)) {
        let e = n.reduce((e, t) => e + t, 0),
          r = t[1].style ? ` ${t[1].style}` : ``;
        t[1] = { ...t[1], style: `width: ${e}px;${r}` };
      }
      return t;
    };
  }
  return t;
}
var eo = () => !1,
  to = /^-?[_a-zA-Z][\w-]*$/;
function no(e) {
  let t = Math.trunc(Number(e));
  return t >= 1 && t <= 6 ? t : 1;
}
function ro(e, t) {
  let n = [...e.classList].filter((e) => to.test(e) && t(e));
  return n.length ? n.join(` `) : null;
}
function $(e) {
  if (typeof e != `string`) return {};
  let t = e.split(/\s+/).filter((e) => to.test(e));
  return t.length ? { class: t.join(` `) } : {};
}
var io = { class: { default: null } },
  ao = (t) => ({
    doc: { content: `block+` },
    paragraph: {
      group: `block`,
      content: `inline*`,
      attrs: { ...Va, ...io },
      parseDOM: [{ tag: `p`, getAttrs: (e) => ({ ...za(e), class: ro(e, t) }) }],
      toDOM: (e) => [`p`, { ...$(e.attrs.class), ...Ba(e.attrs) }, 0],
    },
    heading: {
      group: `block`,
      content: `inline*`,
      defining: !0,
      attrs: { level: { default: 1 }, ...Va, ...io },
      parseDOM: [1, 2, 3, 4, 5, 6].map((e) => ({
        tag: `h${e}`,
        getAttrs: (n) => ({ level: e, ...za(n), class: ro(n, t) }),
      })),
      toDOM: (e) => [`h${no(e.attrs.level)}`, { ...$(e.attrs.class), ...Ba(e.attrs) }, 0],
    },
    blockquote: {
      group: `block`,
      content: `block+`,
      defining: !0,
      attrs: { ...io },
      parseDOM: [{ tag: `blockquote`, getAttrs: (e) => ({ class: ro(e, t) }) }],
      toDOM: (e) => [`blockquote`, $(e.attrs.class), 0],
    },
    horizontal_rule: { group: `block`, parseDOM: [{ tag: `hr` }], toDOM: () => [`hr`] },
    code_block: {
      group: `block`,
      content: `text*`,
      marks: ``,
      code: !0,
      defining: !0,
      attrs: { language: { default: null } },
      parseDOM: [
        {
          tag: `pre`,
          preserveWhitespace: `full`,
          getAttrs: (e) => ({
            language: e.querySelector(`code`)?.className.match(/language-([\w-]+)/)?.[1] ?? null,
          }),
        },
      ],
      toDOM: (e) => [
        `pre`,
        [`code`, e.attrs.language ? { class: `language-${e.attrs.language}` } : {}, 0],
      ],
    },
    bullet_list: {
      group: `block`,
      content: `list_item+`,
      attrs: { listStyle: { default: null } },
      parseDOM: [{ tag: `ul`, getAttrs: (e) => ({ listStyle: Ga(e, Ha, `disc`) }) }],
      toDOM: (e) => [`ul`, Ka(e.attrs.listStyle, Ha), 0],
    },
    ordered_list: {
      group: `block`,
      content: `list_item+`,
      attrs: { start: { default: 1 }, listStyle: { default: null } },
      parseDOM: [
        {
          tag: `ol`,
          getAttrs: (e) => {
            let t = e.getAttribute(`start`);
            return { start: t ? Number(t) : 1, listStyle: Ga(e, Ua, `decimal`) };
          },
        },
      ],
      toDOM: (e) => [
        `ol`,
        { ...(e.attrs.start === 1 ? {} : { start: e.attrs.start }), ...Ka(e.attrs.listStyle, Ua) },
        0,
      ],
    },
    list_item: {
      content: `paragraph block*`,
      defining: !0,
      parseDOM: [{ tag: `li` }],
      toDOM: () => [`li`, 0],
    },
    text: { group: `inline` },
    image: {
      group: `inline`,
      inline: !0,
      draggable: !0,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
        width: { default: null },
        height: { default: null },
        align: { default: null },
        ...io,
      },
      parseDOM: [
        {
          tag: `img[src]`,
          getAttrs: (n) => {
            let r = n;
            return e(r.getAttribute(`src`) ?? ``)
              ? {
                  src: r.getAttribute(`src`),
                  alt: r.getAttribute(`alt`),
                  title: r.getAttribute(`title`),
                  width: Ya(r.getAttribute(`width`) ?? r.style.width),
                  height: Ya(r.getAttribute(`height`) ?? r.style.height),
                  align: Ja(r),
                  class: ro(r, t),
                }
              : !1;
          },
        },
      ],
      toDOM: (t) => {
        let { alt: n, title: r } = t.attrs,
          i = e(t.attrs.src) ? t.attrs.src : ``,
          a = Ya(t.attrs.width),
          o = Ya(t.attrs.height),
          s = qa[t.attrs.align];
        return [
          `img`,
          {
            src: i,
            ...$(t.attrs.class),
            ...(n ? { alt: n } : {}),
            ...(r ? { title: r } : {}),
            ...(a ? { width: String(a) } : {}),
            ...(o ? { height: String(o) } : {}),
            ...(s ? { style: s } : {}),
          },
        ];
      },
    },
    hard_break: {
      group: `inline`,
      inline: !0,
      selectable: !1,
      parseDOM: [{ tag: `br` }],
      toDOM: () => [`br`],
    },
    ...$a(t),
  }),
  oo = ao(eo),
  so = (e) => ({
    link: {
      attrs: { href: {}, title: { default: null }, target: { default: null } },
      inclusive: !1,
      parseDOM: [
        {
          tag: `a[href]`,
          getAttrs: (e) => {
            let n = e;
            return t(n.getAttribute(`href`) ?? ``)
              ? {
                  href: n.getAttribute(`href`),
                  title: n.getAttribute(`title`),
                  target: n.getAttribute(`target`),
                }
              : !1;
          },
        },
      ],
      toDOM: (e) => {
        let { title: n, target: r } = e.attrs;
        return [
          `a`,
          {
            href: t(e.attrs.href) ? e.attrs.href : `#`,
            ...(n ? { title: n } : {}),
            ...(r ? { target: r, rel: `noopener noreferrer` } : {}),
          },
          0,
        ];
      },
    },
    bold: {
      parseDOM: [
        { tag: `strong` },
        { tag: `b`, getAttrs: (e) => e.style?.fontWeight !== `normal` && null },
        { style: `font-weight`, getAttrs: (e) => /^(bold(er)?|[5-9]\d{2,})$/.test(e) && null },
      ],
      toDOM: () => [`strong`, 0],
    },
    italic: {
      parseDOM: [{ tag: `em` }, { tag: `i` }, { style: `font-style=italic` }],
      toDOM: () => [`em`, 0],
    },
    underline: {
      parseDOM: [{ tag: `u` }, { style: `text-decoration=underline` }],
      toDOM: () => [`u`, 0],
    },
    strike: {
      parseDOM: [
        { tag: `s` },
        { tag: `del` },
        { tag: `strike` },
        { style: `text-decoration=line-through` },
      ],
      toDOM: () => [`s`, 0],
    },
    code: { parseDOM: [{ tag: `code` }], toDOM: () => [`code`, 0] },
    subscript: {
      excludes: `superscript`,
      parseDOM: [{ tag: `sub` }, { style: `vertical-align=sub` }],
      toDOM: () => [`sub`, 0],
    },
    superscript: {
      excludes: `subscript`,
      parseDOM: [{ tag: `sup` }, { style: `vertical-align=super` }],
      toDOM: () => [`sup`, 0],
    },
    color: {
      attrs: { value: {} },
      parseDOM: [
        { style: `color`, getAttrs: (e) => lo(Q.color(e)) },
        { tag: `font[color]`, getAttrs: (e) => lo(Q.color(e.getAttribute(`color`))) },
      ],
      toDOM: (e) => uo(`color`, Q.color(e.attrs.value)),
    },
    background: {
      attrs: { value: {} },
      parseDOM: [
        { style: `background-color`, getAttrs: (e) => lo(Q.color(e)) },
        { tag: `mark`, getAttrs: () => ({ value: `yellow` }) },
      ],
      toDOM: (e) => uo(`background-color`, Q.color(e.attrs.value)),
    },
    font_family: {
      attrs: { value: {} },
      parseDOM: [{ style: `font-family`, getAttrs: (e) => lo(Q.fontFamily(e)) }],
      toDOM: (e) => uo(`font-family`, Q.fontFamily(e.attrs.value)),
    },
    font_size: {
      attrs: { value: {} },
      parseDOM: [{ style: `font-size`, getAttrs: (e) => lo(Q.length(e)) }],
      toDOM: (e) => uo(`font-size`, Q.length(e.attrs.value)),
    },
    span_class: {
      attrs: { class: {} },
      parseDOM: [
        {
          tag: `span[class]`,
          consuming: !1,
          getAttrs: (t) => {
            let n = ro(t, e);
            return n ? { class: n } : !1;
          },
        },
      ],
      toDOM: (e) => [`span`, $(e.attrs.class), 0],
    },
  }),
  co = so(eo);
function lo(e) {
  return e ? { value: e } : !1;
}
function uo(e, t) {
  return t ? [`span`, { style: `${e}: ${t};` }, 0] : [`span`, 0];
}
var fo = new r({ nodes: oo, marks: co });
function po(e = {}, t) {
  let n = Object.entries(e.nodes ?? {}),
    i = Object.entries(e.marks ?? {});
  if (!n.length && !i.length && !t) return fo;
  let a = t ? ao(t) : oo,
    o = t ? so(t) : co;
  for (let [e] of n)
    if (e in oo) throw Error(`[nova] node "${e}" already exists in the base schema`);
  for (let [e] of i)
    if (e in co) throw Error(`[nova] mark "${e}" already exists in the base schema`);
  return new r({
    nodes: { ...a, ...Object.fromEntries(n) },
    marks: { ...o, ...Object.fromEntries(i) },
  });
}
export {
  Vr as A,
  X as C,
  Ki as D,
  ja as E,
  V as O,
  Bi as S,
  Vi as T,
  Li as _,
  po as a,
  Ji as b,
  fo as c,
  ki as d,
  Oi as f,
  ji as g,
  _a as h,
  $ as i,
  H as k,
  Y as l,
  Pi as m,
  Ha as n,
  Q as o,
  Fi as p,
  Ua as r,
  Ya as s,
  Ma as t,
  ha as u,
  Yi as v,
  Ui as w,
  J as x,
  Ti as y,
};
