import {
  C as e,
  D as t,
  E as n,
  a as r,
  b as i,
  c as a,
  d as o,
  f as s,
  g as c,
  h as l,
  i as u,
  k as d,
  l as f,
  o as p,
  r as m,
  s as h,
  t as g,
  u as _,
  v,
  y,
} from './dist.DtV7jSsK.js';
var ee = (e, t) => !e.selection.empty && (t && t(e.tr.deleteSelection().scrollIntoView()), !0);
function te(e, t) {
  let { $cursor: n } = e.selection;
  return !n || (t ? !t.endOfTextblock(`backward`, e) : n.parentOffset > 0) ? null : n;
}
var ne = (e, t, n) => {
  let r = te(e, n);
  if (!r) return !1;
  let a = x(r);
  if (!a) {
    let n = r.blockRange(),
      i = n && y(n);
    return i != null && (t && t(e.tr.lift(n, i).scrollIntoView()), !0);
  }
  let o = a.nodeBefore;
  if (me(e, a, t, -1)) return !0;
  if (r.parent.content.size == 0 && (b(o, `end`) || m.isSelectable(o)))
    for (let n = r.depth; ; n--) {
      let s = i(e.doc, r.before(n), r.after(n), d.empty);
      if (s && s.slice.size < s.to - s.from) {
        if (t) {
          let n = e.tr.step(s);
          (n.setSelection(
            b(o, `end`)
              ? p.findFrom(n.doc.resolve(n.mapping.map(a.pos, -1)), -1)
              : m.create(n.doc, a.pos - o.nodeSize),
          ),
            t(n.scrollIntoView()));
        }
        return !0;
      }
      if (n == 1 || r.node(n - 1).childCount > 1) break;
    }
  return o.isAtom && a.depth == r.depth - 1
    ? (t && t(e.tr.delete(a.pos - o.nodeSize, a.pos).scrollIntoView()), !0)
    : !1;
};
function b(e, t, n = !1) {
  for (let r = e; r; r = t == `start` ? r.firstChild : r.lastChild) {
    if (r.isTextblock) return !0;
    if (n && r.childCount != 1) return !1;
  }
  return !1;
}
var re = (e, t, n) => {
  let { $head: r, empty: i } = e.selection,
    a = r;
  if (!i) return !1;
  if (r.parent.isTextblock) {
    if (n ? !n.endOfTextblock(`backward`, e) : r.parentOffset > 0) return !1;
    a = x(r);
  }
  let o = a && a.nodeBefore;
  return !o || !m.isSelectable(o)
    ? !1
    : (t && t(e.tr.setSelection(m.create(e.doc, a.pos - o.nodeSize)).scrollIntoView()), !0);
};
function x(e) {
  if (!e.parent.type.spec.isolating)
    for (let t = e.depth - 1; t >= 0; t--) {
      if (e.index(t) > 0) return e.doc.resolve(e.before(t + 1));
      if (e.node(t).type.spec.isolating) break;
    }
  return null;
}
function ie(e, t) {
  let { $cursor: n } = e.selection;
  return !n || (t ? !t.endOfTextblock(`forward`, e) : n.parentOffset < n.parent.content.size)
    ? null
    : n;
}
var ae = (e, t, n) => {
    let r = ie(e, n);
    if (!r) return !1;
    let a = S(r);
    if (!a) return !1;
    let o = a.nodeAfter;
    if (me(e, a, t, 1)) return !0;
    if (r.parent.content.size == 0 && (b(o, `start`) || m.isSelectable(o))) {
      let n = i(e.doc, r.before(), r.after(), d.empty);
      if (n && n.slice.size < n.to - n.from) {
        if (t) {
          let r = e.tr.step(n);
          (r.setSelection(
            b(o, `start`)
              ? p.findFrom(r.doc.resolve(r.mapping.map(a.pos)), 1)
              : m.create(r.doc, r.mapping.map(a.pos)),
          ),
            t(r.scrollIntoView()));
        }
        return !0;
      }
    }
    return o.isAtom && a.depth == r.depth - 1
      ? (t && t(e.tr.delete(a.pos, a.pos + o.nodeSize).scrollIntoView()), !0)
      : !1;
  },
  oe = (e, t, n) => {
    let { $head: r, empty: i } = e.selection,
      a = r;
    if (!i) return !1;
    if (r.parent.isTextblock) {
      if (n ? !n.endOfTextblock(`forward`, e) : r.parentOffset < r.parent.content.size) return !1;
      a = S(r);
    }
    let o = a && a.nodeAfter;
    return !o || !m.isSelectable(o)
      ? !1
      : (t && t(e.tr.setSelection(m.create(e.doc, a.pos)).scrollIntoView()), !0);
  };
function S(e) {
  if (!e.parent.type.spec.isolating)
    for (let t = e.depth - 1; t >= 0; t--) {
      let n = e.node(t);
      if (e.index(t) + 1 < n.childCount) return e.doc.resolve(e.after(t + 1));
      if (n.type.spec.isolating) break;
    }
  return null;
}
var C = (e, t) => {
    let { $from: n, $to: r } = e.selection,
      i = n.blockRange(r),
      a = i && y(i);
    return a != null && (t && t(e.tr.lift(i, a).scrollIntoView()), !0);
  },
  se = (e, t) => {
    let { $head: n, $anchor: r } = e.selection;
    return !n.parent.type.spec.code || !n.sameParent(r)
      ? !1
      : (t &&
          t(
            e.tr
              .insertText(
                `
`,
              )
              .scrollIntoView(),
          ),
        !0);
  };
function w(e) {
  for (let t = 0; t < e.edgeCount; t++) {
    let { type: n } = e.edge(t);
    if (n.isTextblock && !n.hasRequiredAttrs()) return n;
  }
  return null;
}
var T = (e, t) => {
    let { $head: n, $anchor: r } = e.selection;
    if (!n.parent.type.spec.code || !n.sameParent(r)) return !1;
    let i = n.node(-1),
      a = n.indexAfter(-1),
      o = w(i.contentMatchAt(a));
    if (!o || !i.canReplaceWith(a, a, o)) return !1;
    if (t) {
      let r = n.after(),
        i = e.tr.replaceWith(r, r, o.createAndFill());
      (i.setSelection(p.near(i.doc.resolve(r), 1)), t(i.scrollIntoView()));
    }
    return !0;
  },
  ce = (e, t) => {
    let n = e.selection,
      { $from: r, $to: i } = n;
    if (n instanceof g || r.parent.inlineContent || i.parent.inlineContent) return !1;
    let o = w(i.parent.contentMatchAt(i.indexAfter()));
    if (!o || !o.isTextblock) return !1;
    if (t) {
      let n = (!r.parentOffset && i.index() < i.parent.childCount ? r : i).pos,
        s = e.tr.insert(n, o.createAndFill());
      (s.setSelection(a.create(s.doc, n + 1)), t(s.scrollIntoView()));
    }
    return !0;
  },
  le = (e, t) => {
    let { $cursor: n } = e.selection;
    if (!n || n.parent.content.size) return !1;
    if (n.depth > 1 && n.after() != n.end(-1)) {
      let r = n.before();
      if (c(e.doc, r)) return (t && t(e.tr.split(r).scrollIntoView()), !0);
    }
    let r = n.blockRange(),
      i = r && y(r);
    return i != null && (t && t(e.tr.lift(r, i).scrollIntoView()), !0);
  };
function ue(e) {
  return (t, n) => {
    if (t.selection instanceof m && t.selection.node.isBlock) {
      let { $from: e } = t.selection;
      return !e.parentOffset || !c(t.doc, e.pos)
        ? !1
        : (n && n(t.tr.split(e.pos).scrollIntoView()), !0);
    }
    if (!t.selection.$from.depth) return !1;
    let r = t.tr;
    !t.selection.empty &&
      (t.selection instanceof a || t.selection instanceof g) &&
      r.deleteSelection();
    let { $from: i } = r.selection,
      o = r.steps.length,
      s = [],
      l,
      u,
      d = !1,
      f = !1;
    for (let t = i.depth; ; t--)
      if (i.node(t).isBlock) {
        ((d = i.end(t) == i.pos + (i.depth - t)),
          (f = i.start(t) == i.pos - (i.depth - t)),
          (u = w(i.node(t - 1).contentMatchAt(i.indexAfter(t - 1)))));
        let n = e && e(i.parent, d, i);
        (s.unshift(n || (d && u ? { type: u } : null)), (l = t));
        break;
      } else {
        if (t == 1) return !1;
        s.unshift(null);
      }
    let p = i.pos,
      h = c(r.doc, p, s.length, s);
    if (((h ||= ((s[0] = u ? { type: u } : null), c(r.doc, p, s.length, s))), !h)) return !1;
    if ((r.split(p, s.length, s), !d && f && i.node(l).type != u)) {
      let e = r.mapping.slice(o),
        t = e.map(i.before(l)),
        n = r.doc.resolve(t);
      u &&
        i.node(l - 1).canReplaceWith(n.index(), n.index() + 1, u) &&
        r.setNodeMarkup(e.map(i.before(l)), u);
    }
    return (n && n(r.scrollIntoView()), !0);
  };
}
var de = ue(),
  fe = (e, t) => (t && t(e.tr.setSelection(new g(e.doc))), !0);
function pe(e, t, n) {
  let r = t.nodeBefore,
    i = t.nodeAfter,
    a = t.index();
  return !r || !i || !r.type.compatibleContent(i.type)
    ? !1
    : !r.content.size && t.parent.canReplace(a - 1, a)
      ? (n && n(e.tr.delete(t.pos - r.nodeSize, t.pos).scrollIntoView()), !0)
      : !t.parent.canReplace(a, a + 1) || !(i.isTextblock || l(e.doc, t.pos))
        ? !1
        : (n && n(e.tr.join(t.pos).scrollIntoView()), !0);
}
function me(t, n, r, i) {
  let a = n.nodeBefore,
    o = n.nodeAfter,
    c,
    u,
    f = a.type.spec.isolating || o.type.spec.isolating;
  if (!f && pe(t, n, r)) return !0;
  let m = !f && n.parent.canReplace(n.index(), n.index() + 1);
  if (
    m &&
    (c = (u = a.contentMatchAt(a.childCount)).findWrapping(o.type)) &&
    u.matchType(c[0] || o.type).validEnd
  ) {
    if (r) {
      let i = n.pos + o.nodeSize,
        u = e.empty;
      for (let t = c.length - 1; t >= 0; t--) u = e.from(c[t].create(null, u));
      u = e.from(a.copy(u));
      let f = t.tr.step(new s(n.pos - 1, i, n.pos, i, new d(u, 1, 0), c.length, !0)),
        p = f.doc.resolve(i + 2 * c.length);
      (p.nodeAfter && p.nodeAfter.type == a.type && l(f.doc, p.pos) && f.join(p.pos),
        r(f.scrollIntoView()));
    }
    return !0;
  }
  let h = o.type.spec.isolating || (i > 0 && f) ? null : p.findFrom(n, 1),
    g = h && h.$from.blockRange(h.$to),
    _ = g && y(g);
  if (_ != null && _ >= n.depth) return (r && r(t.tr.lift(g, _).scrollIntoView()), !0);
  if (m && b(o, `start`, !0) && b(a, `end`)) {
    let i = a,
      c = [];
    for (; c.push(i), !i.isTextblock;) i = i.lastChild;
    let l = o,
      u = 1;
    for (; !l.isTextblock; l = l.firstChild) u++;
    if (i.canReplace(i.childCount, i.childCount, l.content)) {
      if (r) {
        let i = e.empty;
        for (let t = c.length - 1; t >= 0; t--) i = e.from(c[t].copy(i));
        r(
          t.tr
            .step(
              new s(
                n.pos - c.length,
                n.pos + o.nodeSize,
                n.pos + u,
                n.pos + o.nodeSize - u,
                new d(i, c.length, 0),
                0,
                !0,
              ),
            )
            .scrollIntoView(),
        );
      }
      return !0;
    }
  }
  return !1;
}
function he(e) {
  return function (t, n) {
    let r = t.selection,
      i = e < 0 ? r.$from : r.$to,
      o = i.depth;
    for (; i.node(o).isInline;) {
      if (!o) return !1;
      o--;
    }
    return i.node(o).isTextblock
      ? (n && n(t.tr.setSelection(a.create(t.doc, e < 0 ? i.start(o) : i.end(o)))), !0)
      : !1;
  };
}
var ge = he(-1),
  _e = he(1);
function ve(e, t = null) {
  return function (n, r) {
    let { $from: i, $to: a } = n.selection,
      o = i.blockRange(a),
      s = o && v(o, e, t);
    return s ? (r && r(n.tr.wrap(o, s).scrollIntoView()), !0) : !1;
  };
}
function E(e, t = null) {
  return function (n, r) {
    let i = !1;
    for (let r = 0; r < n.selection.ranges.length && !i; r++) {
      let {
        $from: { pos: a },
        $to: { pos: o },
      } = n.selection.ranges[r];
      n.doc.nodesBetween(a, o, (r, a) => {
        if (i) return !1;
        if (r.isTextblock && !r.hasMarkup(e, t)) {
          if (r.type == e) i = !0;
          else {
            let t = n.doc.resolve(a),
              r = t.index();
            i = t.parent.canReplaceWith(r, r + 1, e);
          }
        }
      });
    }
    if (!i) return !1;
    if (r) {
      let i = n.tr;
      for (let r = 0; r < n.selection.ranges.length; r++) {
        let {
          $from: { pos: a },
          $to: { pos: o },
        } = n.selection.ranges[r];
        i.setBlockType(a, o, e, t);
      }
      r(i.scrollIntoView());
    }
    return !0;
  };
}
function ye(e, t, n, r) {
  for (let i = 0; i < t.length; i++) {
    let { $from: a, $to: o } = t[i],
      s = a.depth == 0 && e.inlineContent && e.type.allowsMarkType(n);
    if (
      (e.nodesBetween(a.pos, o.pos, (e, t) => {
        if (s || (!r && e.isAtom && e.isInline && t >= a.pos && t + e.nodeSize <= o.pos)) return !1;
        s = e.inlineContent && e.type.allowsMarkType(n);
      }),
      s)
    )
      return !0;
  }
  return !1;
}
function be(e) {
  let t = [];
  for (let n = 0; n < e.length; n++) {
    let { $from: r, $to: i } = e[n];
    (r.doc.nodesBetween(r.pos, i.pos, (e, n) => {
      if (e.isAtom && e.content.size && e.isInline && n >= r.pos && n + e.nodeSize <= i.pos)
        return (
          n + 1 > r.pos && t.push(new h(r, r.doc.resolve(n + 1))),
          (r = r.doc.resolve(n + 1 + e.content.size)),
          !1
        );
    }),
      r.pos < i.pos && t.push(new h(r, i)));
  }
  return t;
}
function D(e, t = null, n) {
  let r = (n && n.removeWhenPresent) !== !1,
    i = (n && n.enterInlineAtoms) !== !1,
    a = !(n && n.includeWhitespace);
  return function (n, o) {
    let { empty: s, $cursor: c, ranges: l } = n.selection;
    if ((s && !c) || !ye(n.doc, l, e, i)) return !1;
    if (o) {
      if (c)
        e.isInSet(n.storedMarks || c.marks())
          ? o(n.tr.removeStoredMark(e))
          : o(n.tr.addStoredMark(e.create(t)));
      else {
        let s,
          c = n.tr;
        (i || (l = be(l)),
          (s = r
            ? !l.some((t) => n.doc.rangeHasMark(t.$from.pos, t.$to.pos, e))
            : !l.every((t) => {
                let n = !1;
                return (
                  c.doc.nodesBetween(t.$from.pos, t.$to.pos, (r, i, a) => {
                    if (n) return !1;
                    n =
                      !e.isInSet(r.marks) &&
                      !!a &&
                      a.type.allowsMarkType(e) &&
                      !(
                        r.isText &&
                        /^\s*$/.test(
                          r.textBetween(
                            Math.max(0, t.$from.pos - i),
                            Math.min(r.nodeSize, t.$to.pos - i),
                          ),
                        )
                      );
                  }),
                  !n
                );
              })));
        for (let n = 0; n < l.length; n++) {
          let { $from: r, $to: i } = l[n];
          if (!s) c.removeMark(r.pos, i.pos, e);
          else {
            let n = r.pos,
              o = i.pos,
              s = r.nodeAfter,
              l = i.nodeBefore,
              u = a && s && s.isText ? /^\s*/.exec(s.text)[0].length : 0,
              d = a && l && l.isText ? /\s*$/.exec(l.text)[0].length : 0;
            (n + u < o && ((n += u), (o -= d)), c.addMark(n, o, e.create(t)));
          }
        }
        o(c.scrollIntoView());
      }
    }
    return !0;
  };
}
function O(...e) {
  return function (t, n, r) {
    for (let i = 0; i < e.length; i++) if (e[i](t, n, r)) return !0;
    return !1;
  };
}
var k = O(ee, ne, re),
  A = O(ee, ae, oe),
  j = {
    Enter: O(se, ce, le, de),
    'Mod-Enter': T,
    Backspace: k,
    'Mod-Backspace': k,
    'Shift-Backspace': k,
    Delete: A,
    'Mod-Delete': A,
    'Mod-a': fe,
  },
  M = {
    'Ctrl-h': j.Backspace,
    'Alt-Backspace': j[`Mod-Backspace`],
    'Ctrl-d': j.Delete,
    'Ctrl-Alt-Backspace': j[`Mod-Delete`],
    'Alt-Delete': j[`Mod-Delete`],
    'Alt-d': j[`Mod-Delete`],
    'Ctrl-a': ge,
    'Ctrl-e': _e,
  };
for (let e in j) M[e] = j[e];
var xe = (
    typeof navigator < `u`
      ? /Mac|iP(hone|[oa]d)/.test(navigator.platform)
      : typeof os < `u` && os.platform && os.platform() == `darwin`
  )
    ? M
    : j,
  N = 200,
  P = function () {};
((P.prototype.append = function (e) {
  return e.length
    ? ((e = P.from(e)),
      (!this.length && e) ||
        (e.length < N && this.leafAppend(e)) ||
        (this.length < N && e.leafPrepend(this)) ||
        this.appendInner(e))
    : this;
}),
  (P.prototype.prepend = function (e) {
    return e.length ? P.from(e).append(this) : this;
  }),
  (P.prototype.appendInner = function (e) {
    return new Se(this, e);
  }),
  (P.prototype.slice = function (e, t) {
    return (
      e === void 0 && (e = 0),
      t === void 0 && (t = this.length),
      e >= t ? P.empty : this.sliceInner(Math.max(0, e), Math.min(this.length, t))
    );
  }),
  (P.prototype.get = function (e) {
    if (!(e < 0 || e >= this.length)) return this.getInner(e);
  }),
  (P.prototype.forEach = function (e, t, n) {
    (t === void 0 && (t = 0),
      n === void 0 && (n = this.length),
      t <= n ? this.forEachInner(e, t, n, 0) : this.forEachInvertedInner(e, t, n, 0));
  }),
  (P.prototype.map = function (e, t, n) {
    (t === void 0 && (t = 0), n === void 0 && (n = this.length));
    var r = [];
    return (
      this.forEach(
        function (t, n) {
          return r.push(e(t, n));
        },
        t,
        n,
      ),
      r
    );
  }),
  (P.from = function (e) {
    return e instanceof P ? e : e && e.length ? new F(e) : P.empty;
  }));
var F = (function (e) {
  function t(t) {
    (e.call(this), (this.values = t));
  }
  (e && (t.__proto__ = e),
    (t.prototype = Object.create(e && e.prototype)),
    (t.prototype.constructor = t));
  var n = { length: { configurable: !0 }, depth: { configurable: !0 } };
  return (
    (t.prototype.flatten = function () {
      return this.values;
    }),
    (t.prototype.sliceInner = function (e, n) {
      return e == 0 && n == this.length ? this : new t(this.values.slice(e, n));
    }),
    (t.prototype.getInner = function (e) {
      return this.values[e];
    }),
    (t.prototype.forEachInner = function (e, t, n, r) {
      for (var i = t; i < n; i++) if (e(this.values[i], r + i) === !1) return !1;
    }),
    (t.prototype.forEachInvertedInner = function (e, t, n, r) {
      for (var i = t - 1; i >= n; i--) if (e(this.values[i], r + i) === !1) return !1;
    }),
    (t.prototype.leafAppend = function (e) {
      if (this.length + e.length <= N) return new t(this.values.concat(e.flatten()));
    }),
    (t.prototype.leafPrepend = function (e) {
      if (this.length + e.length <= N) return new t(e.flatten().concat(this.values));
    }),
    (n.length.get = function () {
      return this.values.length;
    }),
    (n.depth.get = function () {
      return 0;
    }),
    Object.defineProperties(t.prototype, n),
    t
  );
})(P);
P.empty = new F([]);
var Se = (function (e) {
    function t(t, n) {
      (e.call(this),
        (this.left = t),
        (this.right = n),
        (this.length = t.length + n.length),
        (this.depth = Math.max(t.depth, n.depth) + 1));
    }
    return (
      e && (t.__proto__ = e),
      (t.prototype = Object.create(e && e.prototype)),
      (t.prototype.constructor = t),
      (t.prototype.flatten = function () {
        return this.left.flatten().concat(this.right.flatten());
      }),
      (t.prototype.getInner = function (e) {
        return e < this.left.length ? this.left.get(e) : this.right.get(e - this.left.length);
      }),
      (t.prototype.forEachInner = function (e, t, n, r) {
        var i = this.left.length;
        if (
          (t < i && this.left.forEachInner(e, t, Math.min(n, i), r) === !1) ||
          (n > i &&
            this.right.forEachInner(e, Math.max(t - i, 0), Math.min(this.length, n) - i, r + i) ===
              !1)
        )
          return !1;
      }),
      (t.prototype.forEachInvertedInner = function (e, t, n, r) {
        var i = this.left.length;
        if (
          (t > i && this.right.forEachInvertedInner(e, t - i, Math.max(n, i) - i, r + i) === !1) ||
          (n < i && this.left.forEachInvertedInner(e, Math.min(t, i), n, r) === !1)
        )
          return !1;
      }),
      (t.prototype.sliceInner = function (e, t) {
        if (e == 0 && t == this.length) return this;
        var n = this.left.length;
        return t <= n
          ? this.left.slice(e, t)
          : e >= n
            ? this.right.slice(e - n, t - n)
            : this.left.slice(e, n).append(this.right.slice(0, t - n));
      }),
      (t.prototype.leafAppend = function (e) {
        var n = this.right.leafAppend(e);
        if (n) return new t(this.left, n);
      }),
      (t.prototype.leafPrepend = function (e) {
        var n = this.left.leafPrepend(e);
        if (n) return new t(n, this.right);
      }),
      (t.prototype.appendInner = function (e) {
        return this.left.depth >= Math.max(this.right.depth, e.depth) + 1
          ? new t(this.left, new t(this.right, e))
          : new t(this, e);
      }),
      t
    );
  })(P),
  Ce = 500,
  I = class e {
    constructor(e, t) {
      ((this.items = e), (this.eventCount = t));
    }
    popEvent(t, n) {
      if (this.eventCount == 0) return null;
      let r = this.items.length;
      for (; ; r--)
        if (this.items.get(r - 1).selection) {
          --r;
          break;
        }
      let i, a;
      n && ((i = this.remapping(r, this.items.length)), (a = i.maps.length));
      let o = t.tr,
        s,
        c,
        l = [],
        u = [];
      return (
        this.items.forEach(
          (t, n) => {
            if (!t.step)
              (i || ((i = this.remapping(r, n + 1)), (a = i.maps.length)), a--, u.push(t));
            else {
              if (i) {
                u.push(new L(t.map));
                let e = t.step.map(i.slice(a)),
                  n;
                (e &&
                  o.maybeStep(e).doc &&
                  ((n = o.mapping.maps[o.mapping.maps.length - 1]),
                  l.push(new L(n, void 0, void 0, l.length + u.length))),
                  a--,
                  n && i.appendMap(n, a));
              } else o.maybeStep(t.step);
              if (t.selection)
                return (
                  (s = i ? t.selection.map(i.slice(a)) : t.selection),
                  (c = new e(
                    this.items.slice(0, r).append(u.reverse().concat(l)),
                    this.eventCount - 1,
                  )),
                  !1
                );
            }
          },
          this.items.length,
          0,
        ),
        { remaining: c, transform: o, selection: s }
      );
    }
    addTransform(t, n, r, i) {
      let a = [],
        o = this.eventCount,
        s = this.items,
        c = !i && s.length ? s.get(s.length - 1) : null;
      for (let e = 0; e < t.steps.length; e++) {
        let r = t.steps[e].invert(t.docs[e]),
          l = new L(t.mapping.maps[e], r, n),
          u;
        ((u = c && c.merge(l)) && ((l = u), e ? a.pop() : (s = s.slice(0, s.length - 1))),
          a.push(l),
          (n &&= (o++, void 0)),
          i || (c = l));
      }
      let l = o - r.depth;
      return (l > Te && ((s = we(s, l)), (o -= l)), new e(s.append(a), o));
    }
    remapping(e, t) {
      let n = new _();
      return (
        this.items.forEach(
          (t, r) => {
            let i =
              t.mirrorOffset != null && r - t.mirrorOffset >= e
                ? n.maps.length - t.mirrorOffset
                : void 0;
            n.appendMap(t.map, i);
          },
          e,
          t,
        ),
        n
      );
    }
    addMaps(t) {
      return this.eventCount == 0
        ? this
        : new e(this.items.append(t.map((e) => new L(e))), this.eventCount);
    }
    rebased(t, n) {
      if (!this.eventCount) return this;
      n = Math.min(this.items.length, n);
      let r = [],
        i = this.items.length - n,
        a = t.mapping,
        o = t.steps.length,
        s = this.eventCount;
      this.items.forEach((e) => {
        e.selection && s--;
      }, i);
      let c = n;
      this.items.forEach((e) => {
        let n = a.getMirror(--c);
        if (n == null) return;
        o = Math.min(o, n);
        let i = a.maps[n];
        if (e.step) {
          let o = t.steps[n].invert(t.docs[n]),
            l = e.selection && e.selection.map(a.slice(c + 1, n));
          (l && s++, r.push(new L(i, o, l)));
        } else r.push(new L(i));
      }, i);
      let l = [];
      for (let e = n; e < o; e++) l.push(new L(a.maps[e]));
      let u = this.items.slice(0, i).append(l).append(r),
        d = new e(u, s);
      return (d.emptyItemCount() > Ce && (d = d.compress(this.items.length - r.length)), d);
    }
    emptyItemCount() {
      let e = 0;
      return (
        this.items.forEach((t) => {
          t.step || e++;
        }),
        e
      );
    }
    compress(t = this.items.length) {
      let n = this.remapping(0, t),
        r = n.maps.length,
        i = [],
        a = 0;
      return (
        this.items.forEach(
          (e, o) => {
            if (o >= t) (i.push(e), e.selection && a++);
            else if (e.step) {
              let t = e.step.map(n.slice(r)),
                o = t && t.getMap();
              if ((r--, o && n.appendMap(o, r), t)) {
                let s = e.selection && e.selection.map(n.slice(r));
                s && a++;
                let c = new L(o.invert(), t, s),
                  l,
                  u = i.length - 1;
                (l = i.length && i[u].merge(c)) ? (i[u] = l) : i.push(c);
              }
            } else e.map && r--;
          },
          this.items.length,
          0,
        ),
        new e(P.from(i.reverse()), a)
      );
    }
  };
I.empty = new I(P.empty, 0);
function we(e, t) {
  let n;
  return (
    e.forEach((e, r) => {
      if (e.selection && t-- == 0) return ((n = r), !1);
    }),
    e.slice(n)
  );
}
var L = class e {
    constructor(e, t, n, r) {
      ((this.map = e), (this.step = t), (this.selection = n), (this.mirrorOffset = r));
    }
    merge(t) {
      if (this.step && t.step && !t.selection) {
        let n = t.step.merge(this.step);
        if (n) return new e(n.getMap().invert(), n, this.selection);
      }
    }
  },
  R = class {
    constructor(e, t, n, r, i) {
      ((this.done = e),
        (this.undone = t),
        (this.prevRanges = n),
        (this.prevTime = r),
        (this.prevComposition = i));
    }
  },
  Te = 20;
function Ee(e, t, n, r) {
  let i = n.getMeta(U),
    a;
  if (i) return i.historyState;
  n.getMeta(Me) && (e = new R(e.done, e.undone, null, 0, -1));
  let o = n.getMeta(`appendedTransaction`);
  if (n.steps.length == 0) return e;
  if (o && o.getMeta(U))
    return o.getMeta(U).redo
      ? new R(
          e.done.addTransform(n, void 0, r, H(t)),
          e.undone,
          z(n.mapping.maps),
          e.prevTime,
          e.prevComposition,
        )
      : new R(
          e.done,
          e.undone.addTransform(n, void 0, r, H(t)),
          null,
          e.prevTime,
          e.prevComposition,
        );
  if (n.getMeta(`addToHistory`) !== !1 && !(o && o.getMeta(`addToHistory`) === !1)) {
    let i = n.getMeta(`composition`),
      a =
        e.prevTime == 0 ||
        (!o &&
          e.prevComposition != i &&
          (e.prevTime < (n.time || 0) - r.newGroupDelay || !De(n, e.prevRanges))),
      s = o ? B(e.prevRanges, n.mapping) : z(n.mapping.maps);
    return new R(
      e.done.addTransform(n, a ? t.selection.getBookmark() : void 0, r, H(t)),
      I.empty,
      s,
      n.time,
      i ?? e.prevComposition,
    );
  }
  return (a = n.getMeta(`rebased`))
    ? new R(
        e.done.rebased(n, a),
        e.undone.rebased(n, a),
        B(e.prevRanges, n.mapping),
        e.prevTime,
        e.prevComposition,
      )
    : new R(
        e.done.addMaps(n.mapping.maps),
        e.undone.addMaps(n.mapping.maps),
        B(e.prevRanges, n.mapping),
        e.prevTime,
        e.prevComposition,
      );
}
function De(e, t) {
  if (!t) return !1;
  if (!e.docChanged) return !0;
  let n = !1;
  return (
    e.mapping.maps[0].forEach((e, r) => {
      for (let i = 0; i < t.length; i += 2) e <= t[i + 1] && r >= t[i] && (n = !0);
    }),
    n
  );
}
function z(e) {
  let t = [];
  for (let n = e.length - 1; n >= 0 && t.length == 0; n--)
    e[n].forEach((e, n, r, i) => t.push(r, i));
  return t;
}
function B(e, t) {
  if (!e) return null;
  let n = [];
  for (let r = 0; r < e.length; r += 2) {
    let i = t.map(e[r], 1),
      a = t.map(e[r + 1], -1);
    i <= a && n.push(i, a);
  }
  return n;
}
function Oe(e, t) {
  for (let n = 0; n < t.steps.length; n++) {
    let r = t.mapping.maps[n],
      i = -1;
    if ((r.forEach((e, t) => (i = t)), i < 0)) {
      let e = t.steps[n];
      (e instanceof f || e instanceof o) && (i = e.to);
    }
    if (i > -1) return p.near(e.doc.resolve(i));
  }
  return e.selection;
}
function ke(e, t, n) {
  let r = H(t),
    i = U.get(t).spec.config,
    a = (n ? e.undone : e.done).popEvent(t, r);
  if (!a) return null;
  let o = a.selection.resolve(a.transform.doc),
    s = (n ? e.done : e.undone).addTransform(a.transform, Oe(t, a.transform).getBookmark(), i, r),
    c = new R(n ? s : a.remaining, n ? a.remaining : s, null, 0, -1);
  return a.transform.setSelection(o).setMeta(U, { redo: n, historyState: c });
}
var V = !1,
  Ae = null;
function H(e) {
  let t = e.plugins;
  if (Ae != t) {
    ((V = !1), (Ae = t));
    for (let e = 0; e < t.length; e++)
      if (t[e].spec.historyPreserveItems) {
        V = !0;
        break;
      }
  }
  return V;
}
function je(e) {
  return e.setMeta(Me, !0);
}
var U = new r(`history`),
  Me = new r(`closeHistory`);
function Ne(e = {}) {
  return (
    (e = { depth: e.depth || 100, newGroupDelay: e.newGroupDelay || 500 }),
    new u({
      key: U,
      state: {
        init() {
          return new R(I.empty, I.empty, null, 0, -1);
        },
        apply(t, n, r) {
          return Ee(n, r, t, e);
        },
      },
      config: e,
      props: {
        handleDOMEvents: {
          beforeinput(e, t) {
            let n = t.inputType,
              r = n == `historyUndo` ? Fe : n == `historyRedo` ? Ie : null;
            return !r || !e.editable ? !1 : (t.preventDefault(), r(e.state, e.dispatch));
          },
        },
      },
    })
  );
}
function Pe(e, t) {
  return (n, r) => {
    let i = U.getState(n);
    if (!i || (e ? i.undone : i.done).eventCount == 0) return !1;
    if (r) {
      let a = ke(i, n, e);
      a && r(t ? a.scrollIntoView() : a);
    }
    return !0;
  };
}
var Fe = Pe(!1, !0),
  Ie = Pe(!0, !0);
function Le(e, t = null) {
  return function (n, r) {
    let { $from: i, $to: a } = n.selection,
      o = i.blockRange(a);
    if (!o) return !1;
    let s = r ? n.tr : null;
    return Re(s, o, e, t) ? (r && r(s.scrollIntoView()), !0) : !1;
  };
}
function Re(e, t, r, i = null) {
  let a = !1,
    o = t,
    s = t.$from.doc;
  if (t.depth >= 2 && t.$from.node(t.depth - 1).type.compatibleContent(r) && t.startIndex == 0) {
    if (t.$from.index(t.depth - 1) == 0) return !1;
    let e = s.resolve(t.start - 2);
    ((o = new n(e, e, t.depth)),
      t.endIndex < t.parent.childCount &&
        (t = new n(t.$from, s.resolve(t.$to.end(t.depth)), t.depth)),
      (a = !0));
  }
  let c = v(o, r, i, t);
  return c ? (e && ze(e, t, c, a, r), !0) : !1;
}
function ze(t, n, r, i, a) {
  let o = e.empty;
  for (let t = r.length - 1; t >= 0; t--) o = e.from(r[t].type.create(r[t].attrs, o));
  t.step(new s(n.start - (i ? 2 : 0), n.end, n.start, n.end, new d(o, 0, 0), r.length, !0));
  let l = 0;
  for (let e = 0; e < r.length; e++) r[e].type == a && (l = e + 1);
  let u = r.length - l,
    f = n.start + r.length - (i ? 2 : 0),
    p = n.parent;
  for (let e = n.startIndex, r = n.endIndex, i = !0; e < r; e++, i = !1)
    (!i && u && c(t.doc, f, u) && (t.split(f, u), (f += 2 * u)), (f += p.child(e).nodeSize));
  return t;
}
function W(e, n) {
  return e instanceof t ? n == e : e.indexOf(n) > -1;
}
function Be(t, n) {
  return function (r, i) {
    let { $from: a, $to: o, node: s } = r.selection;
    if ((s && s.isBlock) || a.depth < 2 || !a.sameParent(o)) return !1;
    let l = a.node(-1);
    if (!W(t, l.type)) return !1;
    if (a.parent.content.size == 0 && a.node(-1).childCount == a.indexAfter(-1)) {
      if (a.depth == 3 || !W(t, a.node(-3).type) || a.index(-2) != a.node(-2).childCount - 1)
        return !1;
      if (i) {
        let t = e.empty,
          n = a.index(-1) ? 1 : a.index(-2) ? 2 : 3;
        for (let r = a.depth - n; r >= a.depth - 3; r--) t = e.from(a.node(r).copy(t));
        let o =
          a.indexAfter(-1) < a.node(-2).childCount
            ? 1
            : a.indexAfter(-2) < a.node(-3).childCount
              ? 2
              : 3;
        t = t.append(e.from(a.node(-3).type.createAndFill()));
        let s = a.before(a.depth - (n - 1)),
          c = r.tr.replace(s, a.after(-o), new d(t, 4 - n, 0)),
          l = -1;
        (c.doc.nodesBetween(s, c.doc.content.size, (e, t) => {
          if (l > -1) return !1;
          e.isTextblock && e.content.size == 0 && (l = t + 1);
        }),
          l > -1 && c.setSelection(p.near(c.doc.resolve(l))),
          i(c.scrollIntoView()));
      }
      return !0;
    }
    let u = o.pos == a.end() ? l.contentMatchAt(0).defaultType : null,
      f = r.tr.delete(a.pos, o.pos),
      m = u || n ? [n ? { type: l.type, attrs: n } : null, u ? { type: u } : null] : void 0;
    return c(f.doc, a.pos, 2, m) ? (i && i(f.split(a.pos, 2, m).scrollIntoView()), !0) : !1;
  };
}
function Ve(e) {
  return function (t, n) {
    let { $from: r, $to: i } = t.selection,
      a = r.blockRange(i, (t) => t.childCount > 0 && W(e, t.firstChild.type));
    return a ? (n ? (W(e, r.node(a.depth - 1).type) ? He(t, n, a) : Ue(t, n, a)) : !0) : !1;
  };
}
function He(t, r, i) {
  let a = t.tr,
    o = i.end,
    c = i.$to.end(i.depth),
    u = i.parent.child(i.endIndex - 1).type;
  o < c &&
    (a.step(new s(o - 1, c, o, c, new d(e.from(u.create(null, i.parent.copy())), 1, 0), 1, !0)),
    (i = new n(a.doc.resolve(i.$from.pos), a.doc.resolve(c), i.depth)));
  let f = y(i);
  if (f == null) return !1;
  a.lift(i, f);
  let p = a.doc.resolve(a.mapping.map(o, -1) - 1);
  return (
    l(a.doc, p.pos) && p.nodeBefore.type == p.nodeAfter.type && a.join(p.pos),
    r(a.scrollIntoView()),
    !0
  );
}
function Ue(t, n, r) {
  let i = t.tr,
    a = r.parent;
  for (let e = r.end, t = r.endIndex - 1, n = r.startIndex; t > n; t--)
    ((e -= a.child(t).nodeSize), i.delete(e - 1, e + 1));
  let o = i.doc.resolve(r.start),
    c = o.nodeAfter;
  if (i.mapping.map(r.end) != r.start + o.nodeAfter.nodeSize) return !1;
  let l = r.startIndex == 0,
    u = r.endIndex == a.childCount,
    f = o.node(-1),
    p = o.index(-1);
  if (!f.canReplace(p + +!l, p + 1, c.content.append(u ? e.empty : e.from(a)))) return !1;
  let m = o.pos,
    h = m + c.nodeSize;
  return (
    i.step(
      new s(
        m - +!!l,
        h + +!!u,
        m + 1,
        h - 1,
        new d(
          (l ? e.empty : e.from(a.copy(e.empty))).append(u ? e.empty : e.from(a.copy(e.empty))),
          +!l,
          +!u,
        ),
        +!l,
      ),
    ),
    n(i.scrollIntoView()),
    !0
  );
}
function We(t) {
  return function (n, r) {
    let { $from: i, $to: a } = n.selection,
      o = i.blockRange(a, (e) => e.childCount > 0 && W(t, e.firstChild.type));
    if (!o) return !1;
    let c = o.startIndex;
    if (c == 0) return !1;
    let l = o.parent,
      u = l.child(c - 1);
    if (!W(t, u.type)) return !1;
    if (r) {
      let t = u.lastChild && u.lastChild.type == l.type,
        i = e.from(t ? u.lastChild.lastChild.type.create() : null),
        a = new d(e.from(u.type.create(null, e.from(l.type.create(null, i)))), t ? 3 : 1, 0),
        c = o.start,
        f = o.end;
      r(n.tr.step(new s(c - (t ? 3 : 1), f, c, f, a, 1, !0)).scrollIntoView());
    }
    return !0;
  };
}
var Ge = new Set([`http:`, `https:`, `mailto:`, `tel:`]),
  Ke = new Set([`http:`, `https:`, `blob:`]),
  qe = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,/i;
function Je(e) {
  if (typeof e != `string`) return null;
  let t = e.replace(/[\u0000- \u007f-\u009f]/g, ``).match(/^([a-z][a-z0-9+.-]*):/i);
  return t ? `${t[1].toLowerCase()}:` : null;
}
function Ye(e) {
  if (typeof e != `string`) return !1;
  let t = Je(e);
  return t === null || Ge.has(t);
}
function Xe(e) {
  if (typeof e != `string`) return !1;
  if (qe.test(e.trim())) return !0;
  let t = Je(e);
  return t === null || Ke.has(t);
}
var G = (e) => e.schema.nodes,
  K = (e) => e.schema.marks,
  q = (e, t) => (n, r, i) => t(G(n)[e])(n, r, i),
  J = (e, t) => (n, r, i) => t(K(n)[e])(n, r, i);
function Y(e) {
  return (t, n) => {
    let { from: r, to: i } = t.selection,
      a = t.tr,
      o = !1;
    return (
      t.doc.nodesBetween(r, i, (n, r) => {
        let i = G(t);
        (n.type === i.paragraph || n.type === i.heading) &&
          ((o = !0), (a = a.setNodeMarkup(r, void 0, { ...n.attrs, align: e })));
      }),
      o ? (n?.(a), !0) : !1
    );
  };
}
var Ze = (e, t) => (
    t?.(e.tr.replaceSelectionWith(G(e).horizontal_rule.create()).scrollIntoView()),
    !0
  ),
  Qe = (e, t) => {
    let { from: n, to: r, empty: i, $from: a } = e.selection,
      o = K(e);
    if (i) {
      let n = ot(e, o.link, a.pos);
      return n ? (t?.(e.tr.removeMark(n.from, n.to, o.link)), !0) : !1;
    }
    return e.doc.rangeHasMark(n, r, o.link) ? (t?.(e.tr.removeMark(n, r, o.link)), !0) : !1;
  },
  $e = (e, t) => {
    let { from: n, to: r, empty: i } = e.selection;
    if (i) return !1;
    if (t) {
      let i = K(e),
        a = e.tr;
      for (let e of Object.values(i)) e !== i.link && (a = a.removeMark(n, r, e));
      t(a);
    }
    return !0;
  };
function X(e, t = {}) {
  let n = E(e, t);
  return (r, i) => {
    if (!n(r)) return !1;
    if (i) {
      let n = r.tr;
      for (let i of r.selection.ranges)
        n.setBlockType(i.$from.pos, i.$to.pos, e, (n) => ({
          ...t,
          ...(`align` in e.spec.attrs && n.attrs.align ? { align: n.attrs.align } : {}),
          ...(`lineHeight` in e.spec.attrs && n.attrs.lineHeight
            ? { lineHeight: n.attrs.lineHeight }
            : {}),
          ...(`dir` in e.spec.attrs && n.attrs.dir ? { dir: n.attrs.dir } : {}),
        }));
      i(n.scrollIntoView());
    }
    return !0;
  };
}
function Z(e) {
  return q(`heading`, (t) => X(t, { level: e }));
}
var et = {
  bold: J(`bold`, D),
  italic: J(`italic`, D),
  underline: J(`underline`, D),
  strike: J(`strike`, D),
  code: J(`code`, D),
  subscript: J(`subscript`, D),
  superscript: J(`superscript`, D),
  paragraph: q(`paragraph`, (e) => X(e)),
  h1: Z(1),
  h2: Z(2),
  h3: Z(3),
  h4: Z(4),
  h5: Z(5),
  h6: Z(6),
  blockquote: (e, t) => (Q(e, G(e).blockquote) ? C(e, t) : ve(G(e).blockquote)(e, t)),
  codeBlock: q(`code_block`, (e) => E(e)),
  bulletList: q(`bullet_list`, tt),
  orderedList: q(`ordered_list`, tt),
  indent: q(`list_item`, We),
  outdent: q(`list_item`, Ve),
  alignLeft: Y(null),
  alignCenter: Y(`center`),
  alignRight: Y(`right`),
  alignJustify: Y(`justify`),
  horizontalRule: Ze,
  unlink: Qe,
  clearFormatting: $e,
  undo: Fe,
  redo: Ie,
};
function tt(e) {
  return (t, n) => (Q(t, e) ? Ve(G(t).list_item)(t, n) : Le(e)(t, n));
}
function nt(e, t) {
  return (n, r) =>
    Xe(e)
      ? (r?.(
          n.tr.replaceSelectionWith(G(n).image.create({ src: e, alt: t ?? null })).scrollIntoView(),
        ),
        !0)
      : !1;
}
function rt(e, t) {
  let { from: n, $from: r, to: i, empty: a } = e.selection;
  return a ? !!t.isInSet(e.storedMarks ?? r.marks()) : e.doc.rangeHasMark(n, i, t);
}
function Q(e, t, n) {
  let { $from: r, to: i } = e.selection;
  for (let e = r.depth; e > 0; e--) {
    let a = r.node(e);
    if (a.type === t && (!n || Object.entries(n).every(([e, t]) => a.attrs[e] === t)))
      return i <= r.end(e);
  }
  return !1;
}
function $(e) {
  return e.selection.$from.parent.attrs.align ?? `left`;
}
function it(e, t) {
  let n = e.selection.$from.parent,
    r = G(e),
    i = K(e);
  switch (t) {
    case `bold`:
    case `italic`:
    case `underline`:
    case `strike`:
    case `code`:
    case `subscript`:
    case `superscript`:
      return rt(e, i[t]);
    case `paragraph`:
      return n.type === r.paragraph;
    case `h1`:
    case `h2`:
    case `h3`:
    case `h4`:
    case `h5`:
    case `h6`:
      return n.type === r.heading && n.attrs.level === Number(t[1]);
    case `codeBlock`:
      return n.type === r.code_block;
    case `blockquote`:
      return Q(e, r.blockquote);
    case `bulletList`:
      return Q(e, r.bullet_list);
    case `orderedList`:
      return Q(e, r.ordered_list);
    case `alignLeft`:
      return $(e) === `left`;
    case `alignCenter`:
      return $(e) === `center`;
    case `alignRight`:
      return $(e) === `right`;
    case `alignJustify`:
      return $(e) === `justify`;
    default:
      return !1;
  }
}
function at(e) {
  let { $from: t } = e.selection,
    n = K(e),
    r = n.link.isInSet(t.marks()) ?? n.link.isInSet(t.nodeAfter?.marks ?? []);
  return r ? r.attrs : null;
}
function ot(e, t, n) {
  let r = e.doc.resolve(n),
    i = r.start(),
    a = [];
  return (
    r.parent.forEach((e, n) => {
      if (!t.isInSet(e.marks)) return;
      let r = i + n,
        o = r + e.nodeSize,
        s = a[a.length - 1];
      s && s.to === r ? (s.to = o) : a.push({ from: r, to: o });
    }),
    a.find((e) => e.from <= n && n <= e.to) ?? null
  );
}
export {
  O as _,
  it as a,
  ve as b,
  Xe as c,
  K as d,
  G as f,
  xe as g,
  Ne as h,
  nt as i,
  Ye as l,
  je as m,
  $ as n,
  rt as o,
  Be as p,
  at as r,
  Q as s,
  et as t,
  ot as u,
  T as v,
  C as y,
};
