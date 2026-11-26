var da = Object.defineProperty;
var pa = (r, e, t) =>
  e in r ? da(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : (r[e] = t);
var O = (r, e, t) => pa(r, typeof e != 'symbol' ? e + '' : e, t);
(function () {
  const e = document.createElement('link').relList;
  if (e && e.supports && e.supports('modulepreload')) return;
  for (const i of document.querySelectorAll('link[rel="modulepreload"]')) n(i);
  new MutationObserver((i) => {
    for (const o of i)
      if (o.type === 'childList')
        for (const s of o.addedNodes) s.tagName === 'LINK' && s.rel === 'modulepreload' && n(s);
  }).observe(document, { childList: !0, subtree: !0 });
  function t(i) {
    const o = {};
    return (
      i.integrity && (o.integrity = i.integrity),
      i.referrerPolicy && (o.referrerPolicy = i.referrerPolicy),
      i.crossOrigin === 'use-credentials'
        ? (o.credentials = 'include')
        : i.crossOrigin === 'anonymous'
          ? (o.credentials = 'omit')
          : (o.credentials = 'same-origin'),
      o
    );
  }
  function n(i) {
    if (i.ep) return;
    i.ep = !0;
    const o = t(i);
    fetch(i.href, o);
  }
})();
const ma = new Map();
function wi(r) {
  return typeof r == 'function';
}
function ga(r) {
  const e = [],
    t = [],
    n = [];
  for (const i of r)
    if (typeof i == 'string') {
      const o = ma.get(i);
      o ? (wi(o) ? t.push(o) : e.push(o)) : n.push(`Plugin "${i}" is not registered`);
    } else wi(i) ? t.push(i) : e.push(i);
  return { plugins: e, loaders: t, errors: n };
}
function ki(r, e = new Set()) {
  const t = new Map(r.map((l) => [l.name, l])),
    n = [],
    i = [],
    o = new Map(),
    s = (l, a) => {
      const c = o.get(l.name);
      if (c === 'done') return !0;
      if (c === 'failed') return !1;
      if (c === 'visiting')
        return (i.push(`Plugin dependency cycle: ${[...a, l.name].join(' → ')}`), !1);
      o.set(l.name, 'visiting');
      for (const u of l.requires ?? []) {
        if (e.has(u)) continue;
        const f = t.get(u);
        if (!f)
          return (
            i.push(`Plugin "${l.name}" requires "${u}", which is not loaded`),
            o.set(l.name, 'failed'),
            !1
          );
        if (!s(f, [...a, l.name])) return (o.set(l.name, 'failed'), !1);
      }
      return (o.set(l.name, 'done'), n.push(l), !0);
    };
  for (const l of r) s(l, []);
  return { ordered: n, errors: i };
}
async function ba(r) {
  const e = await r();
  return 'default' in e && e.default ? e.default : e;
}
function Y(r) {
  this.content = r;
}
Y.prototype = {
  constructor: Y,
  find: function (r) {
    for (var e = 0; e < this.content.length; e += 2) if (this.content[e] === r) return e;
    return -1;
  },
  get: function (r) {
    var e = this.find(r);
    return e == -1 ? void 0 : this.content[e + 1];
  },
  update: function (r, e, t) {
    var n = t && t != r ? this.remove(t) : this,
      i = n.find(r),
      o = n.content.slice();
    return (i == -1 ? o.push(t || r, e) : ((o[i + 1] = e), t && (o[i] = t)), new Y(o));
  },
  remove: function (r) {
    var e = this.find(r);
    if (e == -1) return this;
    var t = this.content.slice();
    return (t.splice(e, 2), new Y(t));
  },
  addToStart: function (r, e) {
    return new Y([r, e].concat(this.remove(r).content));
  },
  addToEnd: function (r, e) {
    var t = this.remove(r).content.slice();
    return (t.push(r, e), new Y(t));
  },
  addBefore: function (r, e, t) {
    var n = this.remove(e),
      i = n.content.slice(),
      o = n.find(r);
    return (i.splice(o == -1 ? i.length : o, 0, e, t), new Y(i));
  },
  forEach: function (r) {
    for (var e = 0; e < this.content.length; e += 2) r(this.content[e], this.content[e + 1]);
  },
  prepend: function (r) {
    return ((r = Y.from(r)), r.size ? new Y(r.content.concat(this.subtract(r).content)) : this);
  },
  append: function (r) {
    return ((r = Y.from(r)), r.size ? new Y(this.subtract(r).content.concat(r.content)) : this);
  },
  subtract: function (r) {
    var e = this;
    r = Y.from(r);
    for (var t = 0; t < r.content.length; t += 2) e = e.remove(r.content[t]);
    return e;
  },
  toObject: function () {
    var r = {};
    return (
      this.forEach(function (e, t) {
        r[e] = t;
      }),
      r
    );
  },
  get size() {
    return this.content.length >> 1;
  },
};
Y.from = function (r) {
  if (r instanceof Y) return r;
  var e = [];
  if (r) for (var t in r) e.push(t, r[t]);
  return new Y(e);
};
function ss(r, e, t) {
  for (let n = 0; ; n++) {
    if (n == r.childCount || n == e.childCount) return r.childCount == e.childCount ? null : t;
    let i = r.child(n),
      o = e.child(n);
    if (i == o) {
      t += i.nodeSize;
      continue;
    }
    if (!i.sameMarkup(o)) return t;
    if (i.isText && i.text != o.text) {
      let s = i.text,
        l = o.text,
        a = 0;
      for (; s[a] == l[a]; a++) t++;
      return (
        a && a < s.length && a < l.length && cs(s.charCodeAt(a - 1)) && as(s.charCodeAt(a)) && t--,
        t
      );
    }
    if (i.content.size || o.content.size) {
      let s = ss(i.content, o.content, t + 1);
      if (s != null) return s;
    }
    t += i.nodeSize;
  }
}
function ls(r, e, t, n) {
  for (let i = r.childCount, o = e.childCount; ;) {
    if (i == 0 || o == 0) return i == o ? null : { a: t, b: n };
    let s = r.child(--i),
      l = e.child(--o),
      a = s.nodeSize;
    if (s == l) {
      ((t -= a), (n -= a));
      continue;
    }
    if (!s.sameMarkup(l)) return { a: t, b: n };
    if (s.isText && s.text != l.text) {
      let c = s.text,
        u = l.text,
        f = c.length,
        h = u.length;
      for (; f > 0 && h > 0 && c[f - 1] == u[h - 1];) (f--, h--, t--, n--);
      return (
        f && h && f < c.length && cs(c.charCodeAt(f - 1)) && as(c.charCodeAt(f)) && (t++, n++),
        { a: t, b: n }
      );
    }
    if (s.content.size || l.content.size) {
      let c = ls(s.content, l.content, t - 1, n - 1);
      if (c) return c;
    }
    ((t -= a), (n -= a));
  }
}
function as(r) {
  return r >= 56320 && r < 57344;
}
function cs(r) {
  return r >= 55296 && r < 56320;
}
class k {
  constructor(e, t) {
    if (((this.content = e), (this.size = t || 0), t == null))
      for (let n = 0; n < e.length; n++) this.size += e[n].nodeSize;
  }
  nodesBetween(e, t, n, i = 0, o) {
    for (let s = 0, l = 0; l < t; s++) {
      let a = this.content[s],
        c = l + a.nodeSize;
      if (c > e && n(a, i + l, o || null, s) !== !1 && a.content.size) {
        let u = l + 1;
        a.nodesBetween(Math.max(0, e - u), Math.min(a.content.size, t - u), n, i + u);
      }
      l = c;
    }
  }
  descendants(e) {
    this.nodesBetween(0, this.size, e);
  }
  textBetween(e, t, n, i) {
    let o = '',
      s = !0;
    return (
      this.nodesBetween(
        e,
        t,
        (l, a) => {
          let c = l.isText
            ? l.text.slice(Math.max(e, a) - a, t - a)
            : l.isLeaf
              ? i
                ? typeof i == 'function'
                  ? i(l)
                  : i
                : l.type.spec.leafText
                  ? l.type.spec.leafText(l)
                  : ''
              : '';
          (l.isBlock && ((l.isLeaf && c) || l.isTextblock) && n && (s ? (s = !1) : (o += n)),
            (o += c));
        },
        0,
      ),
      o
    );
  }
  append(e) {
    if (!e.size) return this;
    if (!this.size) return e;
    let t = this.lastChild,
      n = e.firstChild,
      i = this.content.slice(),
      o = 0;
    for (
      t.isText && t.sameMarkup(n) && ((i[i.length - 1] = t.withText(t.text + n.text)), (o = 1));
      o < e.content.length;
      o++
    )
      i.push(e.content[o]);
    return new k(i, this.size + e.size);
  }
  cut(e, t = this.size) {
    if (e == 0 && t == this.size) return this;
    let n = [],
      i = 0;
    if (t > e)
      for (let o = 0, s = 0; s < t; o++) {
        let l = this.content[o],
          a = s + l.nodeSize;
        (a > e &&
          ((s < e || a > t) &&
            (l.isText
              ? (l = l.cut(Math.max(0, e - s), Math.min(l.text.length, t - s)))
              : (l = l.cut(Math.max(0, e - s - 1), Math.min(l.content.size, t - s - 1)))),
          n.push(l),
          (i += l.nodeSize)),
          (s = a));
      }
    return new k(n, i);
  }
  cutByIndex(e, t) {
    return e == t
      ? k.empty
      : e == 0 && t == this.content.length
        ? this
        : new k(this.content.slice(e, t));
  }
  replaceChild(e, t) {
    let n = this.content[e];
    if (n == t) return this;
    let i = this.content.slice(),
      o = this.size + t.nodeSize - n.nodeSize;
    return ((i[e] = t), new k(i, o));
  }
  addToStart(e) {
    return new k([e].concat(this.content), this.size + e.nodeSize);
  }
  addToEnd(e) {
    return new k(this.content.concat(e), this.size + e.nodeSize);
  }
  eq(e) {
    if (this.content.length != e.content.length) return !1;
    for (let t = 0; t < this.content.length; t++) if (!this.content[t].eq(e.content[t])) return !1;
    return !0;
  }
  get firstChild() {
    return this.content.length ? this.content[0] : null;
  }
  get lastChild() {
    return this.content.length ? this.content[this.content.length - 1] : null;
  }
  get childCount() {
    return this.content.length;
  }
  child(e) {
    let t = this.content[e];
    if (!t) throw new RangeError('Index ' + e + ' out of range for ' + this);
    return t;
  }
  maybeChild(e) {
    return this.content[e] || null;
  }
  forEach(e) {
    for (let t = 0, n = 0; t < this.content.length; t++) {
      let i = this.content[t];
      (e(i, n, t), (n += i.nodeSize));
    }
  }
  findDiffStart(e, t = 0) {
    return ss(this, e, t);
  }
  findDiffEnd(e, t = this.size, n = e.size) {
    return ls(this, e, t, n);
  }
  findIndex(e) {
    if (e == 0) return pn(0, e);
    if (e == this.size) return pn(this.content.length, e);
    if (e > this.size || e < 0) throw new RangeError(`Position ${e} outside of fragment (${this})`);
    for (let t = 0, n = 0; ; t++) {
      let i = this.child(t),
        o = n + i.nodeSize;
      if (o >= e) return o == e ? pn(t + 1, o) : pn(t, n);
      n = o;
    }
  }
  toString() {
    return '<' + this.toStringInner() + '>';
  }
  toStringInner() {
    return this.content.join(', ');
  }
  toJSON() {
    return this.content.length ? this.content.map((e) => e.toJSON()) : null;
  }
  static fromJSON(e, t) {
    if (!t) return k.empty;
    if (!Array.isArray(t)) throw new RangeError('Invalid input for Fragment.fromJSON');
    return k.fromArray(t.map(e.nodeFromJSON));
  }
  static fromArray(e) {
    if (!e.length) return k.empty;
    let t,
      n = 0;
    for (let i = 0; i < e.length; i++) {
      let o = e[i];
      ((n += o.nodeSize),
        i && o.isText && e[i - 1].sameMarkup(o)
          ? (t || (t = e.slice(0, i)),
            (t[t.length - 1] = o.withText(t[t.length - 1].text + o.text)))
          : t && t.push(o));
    }
    return new k(t || e, n);
  }
  static from(e) {
    if (!e) return k.empty;
    if (e instanceof k) return e;
    if (Array.isArray(e)) return this.fromArray(e);
    if (e.attrs) return new k([e], e.nodeSize);
    throw new RangeError(
      'Can not convert ' +
        e +
        ' to a Fragment' +
        (e.nodesBetween ? ' (looks like multiple versions of prosemirror-model were loaded)' : ''),
    );
  }
}
k.empty = new k([], 0);
const or = { index: 0, offset: 0 };
function pn(r, e) {
  return ((or.index = r), (or.offset = e), or);
}
function In(r, e) {
  if (r === e) return !0;
  if (!(r && typeof r == 'object') || !(e && typeof e == 'object')) return !1;
  let t = Array.isArray(r);
  if (Array.isArray(e) != t) return !1;
  if (t) {
    if (r.length != e.length) return !1;
    for (let n = 0; n < r.length; n++) if (!In(r[n], e[n])) return !1;
  } else {
    for (let n in r) if (!(n in e) || !In(r[n], e[n])) return !1;
    for (let n in e) if (!(n in r)) return !1;
  }
  return !0;
}
class P {
  constructor(e, t) {
    ((this.type = e), (this.attrs = t));
  }
  addToSet(e) {
    let t,
      n = !1;
    for (let i = 0; i < e.length; i++) {
      let o = e[i];
      if (this.eq(o)) return e;
      if (this.type.excludes(o.type)) t || (t = e.slice(0, i));
      else {
        if (o.type.excludes(this.type)) return e;
        (!n && o.type.rank > this.type.rank && (t || (t = e.slice(0, i)), t.push(this), (n = !0)),
          t && t.push(o));
      }
    }
    return (t || (t = e.slice()), n || t.push(this), t);
  }
  removeFromSet(e) {
    for (let t = 0; t < e.length; t++)
      if (this.eq(e[t])) return e.slice(0, t).concat(e.slice(t + 1));
    return e;
  }
  isInSet(e) {
    for (let t = 0; t < e.length; t++) if (this.eq(e[t])) return !0;
    return !1;
  }
  eq(e) {
    return this == e || (this.type == e.type && In(this.attrs, e.attrs));
  }
  toJSON() {
    let e = { type: this.type.name };
    for (let t in this.attrs) {
      e.attrs = this.attrs;
      break;
    }
    return e;
  }
  static fromJSON(e, t) {
    if (!t) throw new RangeError('Invalid input for Mark.fromJSON');
    let n = e.marks[t.type];
    if (!n) throw new RangeError(`There is no mark type ${t.type} in this schema`);
    return n.create(t.attrs);
  }
  static sameSet(e, t) {
    if (e == t) return !0;
    if (e.length != t.length) return !1;
    for (let n = 0; n < e.length; n++) if (!e[n].eq(t[n])) return !1;
    return !0;
  }
  static setFrom(e) {
    if (!e || (Array.isArray(e) && e.length == 0)) return P.none;
    if (e instanceof P) return [e];
    let t = e.slice();
    return (t.sort((n, i) => n.type.rank - i.type.rank), t);
  }
}
P.none = [];
class jt extends Error {}
class S {
  constructor(e, t, n) {
    ((this.content = e), (this.openStart = t), (this.openEnd = n));
  }
  get size() {
    return this.content.size - this.openStart - this.openEnd;
  }
  insertAt(e, t) {
    let n = fs(this.content, e + this.openStart, t, this.openStart + 1, this.openEnd + 1);
    return n && new S(n, this.openStart, this.openEnd);
  }
  removeBetween(e, t) {
    return new S(
      us(this.content, e + this.openStart, t + this.openStart),
      this.openStart,
      this.openEnd,
    );
  }
  eq(e) {
    return this.content.eq(e.content) && this.openStart == e.openStart && this.openEnd == e.openEnd;
  }
  toString() {
    return this.content + '(' + this.openStart + ',' + this.openEnd + ')';
  }
  toJSON() {
    if (!this.content.size) return null;
    let e = { content: this.content.toJSON() };
    return (
      this.openStart > 0 && (e.openStart = this.openStart),
      this.openEnd > 0 && (e.openEnd = this.openEnd),
      e
    );
  }
  static fromJSON(e, t) {
    if (!t) return S.empty;
    let n = t.openStart || 0,
      i = t.openEnd || 0;
    if (typeof n != 'number' || typeof i != 'number')
      throw new RangeError('Invalid input for Slice.fromJSON');
    return new S(k.fromJSON(e, t.content), n, i);
  }
  static maxOpen(e, t = !0) {
    let n = 0,
      i = 0;
    for (let o = e.firstChild; o && !o.isLeaf && (t || !o.type.spec.isolating); o = o.firstChild)
      n++;
    for (let o = e.lastChild; o && !o.isLeaf && (t || !o.type.spec.isolating); o = o.lastChild) i++;
    return new S(e, n, i);
  }
}
S.empty = new S(k.empty, 0, 0);
function us(r, e, t) {
  let { index: n, offset: i } = r.findIndex(e),
    o = r.maybeChild(n),
    { index: s, offset: l } = r.findIndex(t);
  if (i == e || o.isText) {
    if (l != t && !r.child(s).isText) throw new RangeError('Removing non-flat range');
    return r.cut(0, e).append(r.cut(t));
  }
  if (n != s) throw new RangeError('Removing non-flat range');
  return r.replaceChild(n, o.copy(us(o.content, e - i - 1, t - i - 1)));
}
function fs(r, e, t, n, i, o) {
  let { index: s, offset: l } = r.findIndex(e),
    a = r.maybeChild(s);
  if (l == e || a.isText)
    return o && n <= 0 && i <= 0 && !o.canReplace(s, s, t)
      ? null
      : r.cut(0, e).append(t).append(r.cut(e));
  let c = fs(a.content, e - l - 1, t, s == 0 ? n - 1 : 0, s == r.childCount - 1 ? i - 1 : 0, a);
  return c && r.replaceChild(s, a.copy(c));
}
function ya(r, e, t) {
  if (t.openStart > r.depth) throw new jt('Inserted content deeper than insertion position');
  if (r.depth - t.openStart != e.depth - t.openEnd) throw new jt('Inconsistent open depths');
  return hs(r, e, t, 0);
}
function hs(r, e, t, n) {
  let i = r.index(n),
    o = r.node(n);
  if (i == e.index(n) && n < r.depth - t.openStart) {
    let s = hs(r, e, t, n + 1);
    return o.copy(o.content.replaceChild(i, s));
  } else if (t.content.size)
    if (!t.openStart && !t.openEnd && r.depth == n && e.depth == n) {
      let s = r.parent,
        l = s.content;
      return nt(s, l.cut(0, r.parentOffset).append(t.content).append(l.cut(e.parentOffset)));
    } else {
      let { start: s, end: l } = wa(t, r);
      return nt(o, ps(r, s, l, e, n));
    }
  else return nt(o, Ln(r, e, n));
}
function ds(r, e) {
  if (!e.type.compatibleContent(r.type))
    throw new jt('Cannot join ' + e.type.name + ' onto ' + r.type.name);
}
function Sr(r, e, t) {
  let n = r.node(t);
  return (ds(n, e.node(t)), n);
}
function tt(r, e) {
  let t = e.length - 1;
  t >= 0 && r.isText && r.sameMarkup(e[t]) ? (e[t] = r.withText(e[t].text + r.text)) : e.push(r);
}
function Jt(r, e, t, n) {
  let i = (e || r).node(t),
    o = 0,
    s = e ? e.index(t) : i.childCount;
  r && ((o = r.index(t)), r.depth > t ? o++ : r.textOffset && (tt(r.nodeAfter, n), o++));
  for (let l = o; l < s; l++) tt(i.child(l), n);
  e && e.depth == t && e.textOffset && tt(e.nodeBefore, n);
}
function nt(r, e) {
  if (!r.type.validContent(e)) throw new jt('Invalid content for node ' + r.type.name);
  return r.copy(e);
}
function ps(r, e, t, n, i) {
  let o = r.depth > i && Sr(r, e, i + 1),
    s = n.depth > i && Sr(t, n, i + 1),
    l = [];
  return (
    Jt(null, r, i, l),
    o && s && e.index(i) == t.index(i)
      ? (ds(o, s), tt(nt(o, ps(r, e, t, n, i + 1)), l))
      : (o && tt(nt(o, Ln(r, e, i + 1)), l), Jt(e, t, i, l), s && tt(nt(s, Ln(t, n, i + 1)), l)),
    Jt(n, null, i, l),
    new k(l)
  );
}
function Ln(r, e, t) {
  let n = [];
  if ((Jt(null, r, t, n), r.depth > t)) {
    let i = Sr(r, e, t + 1);
    tt(nt(i, Ln(r, e, t + 1)), n);
  }
  return (Jt(e, null, t, n), new k(n));
}
function wa(r, e) {
  let t = e.depth - r.openStart,
    i = e.node(t).copy(r.content);
  for (let o = t - 1; o >= 0; o--) i = e.node(o).copy(k.from(i));
  return {
    start: i.resolveNoCache(r.openStart + t),
    end: i.resolveNoCache(i.content.size - r.openEnd - t),
  };
}
class Gt {
  constructor(e, t, n) {
    ((this.pos = e), (this.path = t), (this.parentOffset = n), (this.depth = t.length / 3 - 1));
  }
  resolveDepth(e) {
    return e == null ? this.depth : e < 0 ? this.depth + e : e;
  }
  get parent() {
    return this.node(this.depth);
  }
  get doc() {
    return this.node(0);
  }
  node(e) {
    return this.path[this.resolveDepth(e) * 3];
  }
  index(e) {
    return this.path[this.resolveDepth(e) * 3 + 1];
  }
  indexAfter(e) {
    return (
      (e = this.resolveDepth(e)),
      this.index(e) + (e == this.depth && !this.textOffset ? 0 : 1)
    );
  }
  start(e) {
    return ((e = this.resolveDepth(e)), e == 0 ? 0 : this.path[e * 3 - 1] + 1);
  }
  end(e) {
    return ((e = this.resolveDepth(e)), this.start(e) + this.node(e).content.size);
  }
  before(e) {
    if (((e = this.resolveDepth(e)), !e))
      throw new RangeError('There is no position before the top-level node');
    return e == this.depth + 1 ? this.pos : this.path[e * 3 - 1];
  }
  after(e) {
    if (((e = this.resolveDepth(e)), !e))
      throw new RangeError('There is no position after the top-level node');
    return e == this.depth + 1 ? this.pos : this.path[e * 3 - 1] + this.path[e * 3].nodeSize;
  }
  get textOffset() {
    return this.pos - this.path[this.path.length - 1];
  }
  get nodeAfter() {
    let e = this.parent,
      t = this.index(this.depth);
    if (t == e.childCount) return null;
    let n = this.pos - this.path[this.path.length - 1],
      i = e.child(t);
    return n ? e.child(t).cut(n) : i;
  }
  get nodeBefore() {
    let e = this.index(this.depth),
      t = this.pos - this.path[this.path.length - 1];
    return t ? this.parent.child(e).cut(0, t) : e == 0 ? null : this.parent.child(e - 1);
  }
  posAtIndex(e, t) {
    t = this.resolveDepth(t);
    let n = this.path[t * 3],
      i = t == 0 ? 0 : this.path[t * 3 - 1] + 1;
    for (let o = 0; o < e; o++) i += n.child(o).nodeSize;
    return i;
  }
  marks() {
    let e = this.parent,
      t = this.index();
    if (e.content.size == 0) return P.none;
    if (this.textOffset) return e.child(t).marks;
    let n = e.maybeChild(t - 1),
      i = e.maybeChild(t);
    if (!n) {
      let l = n;
      ((n = i), (i = l));
    }
    let o = n.marks;
    for (var s = 0; s < o.length; s++)
      o[s].type.spec.inclusive === !1 &&
        (!i || !o[s].isInSet(i.marks)) &&
        (o = o[s--].removeFromSet(o));
    return o;
  }
  marksAcross(e) {
    let t = this.parent.maybeChild(this.index());
    if (!t || !t.isInline) return null;
    let n = t.marks,
      i = e.parent.maybeChild(e.index());
    for (var o = 0; o < n.length; o++)
      n[o].type.spec.inclusive === !1 &&
        (!i || !n[o].isInSet(i.marks)) &&
        (n = n[o--].removeFromSet(n));
    return n;
  }
  sharedDepth(e) {
    for (let t = this.depth; t > 0; t--) if (this.start(t) <= e && this.end(t) >= e) return t;
    return 0;
  }
  blockRange(e = this, t) {
    if (e.pos < this.pos) return e.blockRange(this);
    for (let n = this.depth - (this.parent.inlineContent || this.pos == e.pos ? 1 : 0); n >= 0; n--)
      if (e.pos <= this.end(n) && (!t || t(this.node(n)))) return new zn(this, e, n);
    return null;
  }
  sameParent(e) {
    return this.pos - this.parentOffset == e.pos - e.parentOffset;
  }
  max(e) {
    return e.pos > this.pos ? e : this;
  }
  min(e) {
    return e.pos < this.pos ? e : this;
  }
  toString() {
    let e = '';
    for (let t = 1; t <= this.depth; t++)
      e += (e ? '/' : '') + this.node(t).type.name + '_' + this.index(t - 1);
    return e + ':' + this.parentOffset;
  }
  static resolve(e, t) {
    if (!(t >= 0 && t <= e.content.size)) throw new RangeError('Position ' + t + ' out of range');
    let n = [],
      i = 0,
      o = t;
    for (let s = e; ;) {
      let { index: l, offset: a } = s.content.findIndex(o),
        c = o - a;
      if ((n.push(s, l, i + a), !c || ((s = s.child(l)), s.isText))) break;
      ((o = c - 1), (i += a + 1));
    }
    return new Gt(t, n, o);
  }
  static resolveCached(e, t) {
    let n = xi.get(e);
    if (n)
      for (let o = 0; o < n.elts.length; o++) {
        let s = n.elts[o];
        if (s.pos == t) return s;
      }
    else xi.set(e, (n = new ka()));
    let i = (n.elts[n.i] = Gt.resolve(e, t));
    return ((n.i = (n.i + 1) % xa), i);
  }
}
class ka {
  constructor() {
    ((this.elts = []), (this.i = 0));
  }
}
const xa = 12,
  xi = new WeakMap();
class zn {
  constructor(e, t, n) {
    ((this.$from = e), (this.$to = t), (this.depth = n));
  }
  get start() {
    return this.$from.before(this.depth + 1);
  }
  get end() {
    return this.$to.after(this.depth + 1);
  }
  get parent() {
    return this.$from.node(this.depth);
  }
  get startIndex() {
    return this.$from.index(this.depth);
  }
  get endIndex() {
    return this.$to.indexAfter(this.depth);
  }
}
const Ma = Object.create(null);
let _e = class vr {
  constructor(e, t, n, i = P.none) {
    ((this.type = e), (this.attrs = t), (this.marks = i), (this.content = n || k.empty));
  }
  get children() {
    return this.content.content;
  }
  get nodeSize() {
    return this.isLeaf ? 1 : 2 + this.content.size;
  }
  get childCount() {
    return this.content.childCount;
  }
  child(e) {
    return this.content.child(e);
  }
  maybeChild(e) {
    return this.content.maybeChild(e);
  }
  forEach(e) {
    this.content.forEach(e);
  }
  nodesBetween(e, t, n, i = 0) {
    this.content.nodesBetween(e, t, n, i, this);
  }
  descendants(e) {
    this.nodesBetween(0, this.content.size, e);
  }
  get textContent() {
    return this.isLeaf && this.type.spec.leafText
      ? this.type.spec.leafText(this)
      : this.textBetween(0, this.content.size, '');
  }
  textBetween(e, t, n, i) {
    return this.content.textBetween(e, t, n, i);
  }
  get firstChild() {
    return this.content.firstChild;
  }
  get lastChild() {
    return this.content.lastChild;
  }
  eq(e) {
    return this == e || (this.sameMarkup(e) && this.content.eq(e.content));
  }
  sameMarkup(e) {
    return this.hasMarkup(e.type, e.attrs, e.marks);
  }
  hasMarkup(e, t, n) {
    return (
      this.type == e &&
      In(this.attrs, t || e.defaultAttrs || Ma) &&
      P.sameSet(this.marks, n || P.none)
    );
  }
  copy(e = null) {
    return e == this.content ? this : new vr(this.type, this.attrs, e, this.marks);
  }
  mark(e) {
    return e == this.marks ? this : new vr(this.type, this.attrs, this.content, e);
  }
  cut(e, t = this.content.size) {
    return e == 0 && t == this.content.size ? this : this.copy(this.content.cut(e, t));
  }
  slice(e, t = this.content.size, n = !1) {
    if (e == t) return S.empty;
    let i = this.resolve(e),
      o = this.resolve(t),
      s = n ? 0 : i.sharedDepth(t),
      l = i.start(s),
      c = i.node(s).content.cut(i.pos - l, o.pos - l);
    return new S(c, i.depth - s, o.depth - s);
  }
  replace(e, t, n) {
    return ya(this.resolve(e), this.resolve(t), n);
  }
  nodeAt(e) {
    for (let t = this; ;) {
      let { index: n, offset: i } = t.content.findIndex(e);
      if (((t = t.maybeChild(n)), !t)) return null;
      if (i == e || t.isText) return t;
      e -= i + 1;
    }
  }
  childAfter(e) {
    let { index: t, offset: n } = this.content.findIndex(e);
    return { node: this.content.maybeChild(t), index: t, offset: n };
  }
  childBefore(e) {
    if (e == 0) return { node: null, index: 0, offset: 0 };
    let { index: t, offset: n } = this.content.findIndex(e);
    if (n < e) return { node: this.content.child(t), index: t, offset: n };
    let i = this.content.child(t - 1);
    return { node: i, index: t - 1, offset: n - i.nodeSize };
  }
  resolve(e) {
    return Gt.resolveCached(this, e);
  }
  resolveNoCache(e) {
    return Gt.resolve(this, e);
  }
  rangeHasMark(e, t, n) {
    let i = !1;
    return (t > e && this.nodesBetween(e, t, (o) => (n.isInSet(o.marks) && (i = !0), !i)), i);
  }
  get isBlock() {
    return this.type.isBlock;
  }
  get isTextblock() {
    return this.type.isTextblock;
  }
  get inlineContent() {
    return this.type.inlineContent;
  }
  get isInline() {
    return this.type.isInline;
  }
  get isText() {
    return this.type.isText;
  }
  get isLeaf() {
    return this.type.isLeaf;
  }
  get isAtom() {
    return this.type.isAtom;
  }
  toString() {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this);
    let e = this.type.name;
    return (
      this.content.size && (e += '(' + this.content.toStringInner() + ')'),
      ms(this.marks, e)
    );
  }
  contentMatchAt(e) {
    let t = this.type.contentMatch.matchFragment(this.content, 0, e);
    if (!t) throw new Error('Called contentMatchAt on a node with invalid content');
    return t;
  }
  canReplace(e, t, n = k.empty, i = 0, o = n.childCount) {
    let s = this.contentMatchAt(e).matchFragment(n, i, o),
      l = s && s.matchFragment(this.content, t);
    if (!l || !l.validEnd) return !1;
    for (let a = i; a < o; a++) if (!this.type.allowsMarks(n.child(a).marks)) return !1;
    return !0;
  }
  canReplaceWith(e, t, n, i) {
    if (i && !this.type.allowsMarks(i)) return !1;
    let o = this.contentMatchAt(e).matchType(n),
      s = o && o.matchFragment(this.content, t);
    return s ? s.validEnd : !1;
  }
  canAppend(e) {
    return e.content.size
      ? this.canReplace(this.childCount, this.childCount, e.content)
      : this.type.compatibleContent(e.type);
  }
  check() {
    (this.type.checkContent(this.content), Ci(this.type.attrs, this.attrs, 'node', this.type.name));
    let e = P.none;
    for (let t = 0; t < this.marks.length; t++) {
      let n = this.marks[t];
      (Ci(n.type.attrs, n.attrs, 'mark', n.type.name), (e = n.addToSet(e)));
    }
    if (!P.sameSet(e, this.marks))
      throw new RangeError(
        `Invalid collection of marks for node ${this.type.name}: ${this.marks.map((t) => t.type.name)}`,
      );
    this.content.forEach((t) => t.check());
  }
  toJSON() {
    let e = { type: this.type.name };
    for (let t in this.attrs) {
      e.attrs = this.attrs;
      break;
    }
    return (
      this.content.size && (e.content = this.content.toJSON()),
      this.marks.length && (e.marks = this.marks.map((t) => t.toJSON())),
      e
    );
  }
  static fromJSON(e, t) {
    if (!t) throw new RangeError('Invalid input for Node.fromJSON');
    let n;
    if (t.marks) {
      if (!Array.isArray(t.marks)) throw new RangeError('Invalid mark data for Node.fromJSON');
      n = t.marks.map(e.markFromJSON);
    }
    if (t.type == 'text') {
      if (typeof t.text != 'string') throw new RangeError('Invalid text node in JSON');
      return e.text(t.text, n);
    }
    let i = k.fromJSON(e, t.content);
    return e.nodeType(t.type).create(t.attrs, i, n);
  }
};
_e.prototype.text = void 0;
const Mi = (() => {
  let { stack: r } = new Error('/');
  if (!r || !/\n\s*at\s/.test(r)) return (t) => t;
  let e = Object.create(null);
  return (t) => (e[t], t);
})();
class Bn extends _e {
  constructor(e, t, n, i) {
    if ((super(e, t, null, i), !n)) throw new RangeError('Empty text nodes are not allowed');
    this.text = n;
  }
  toString() {
    return this.type.spec.toDebugString
      ? this.type.spec.toDebugString(this)
      : ms(this.marks, JSON.stringify(this.text));
  }
  get textContent() {
    return this.text;
  }
  textBetween(e, t) {
    return Mi(this.text.slice(e, t));
  }
  get nodeSize() {
    return this.text.length;
  }
  mark(e) {
    return e == this.marks ? this : new Bn(this.type, this.attrs, this.text, e);
  }
  withText(e) {
    return e == this.text ? this : new Bn(this.type, this.attrs, e, this.marks);
  }
  cut(e = 0, t = this.text.length) {
    return e == 0 && t == this.text.length ? this : this.withText(Mi(this.text.slice(e, t)));
  }
  eq(e) {
    return this.sameMarkup(e) && this.text == e.text;
  }
  toJSON() {
    let e = super.toJSON();
    return ((e.text = this.text), e);
  }
}
function ms(r, e) {
  for (let t = r.length - 1; t >= 0; t--) e = r[t].type.name + '(' + e + ')';
  return e;
}
function Ci(r, e, t, n) {
  for (let i in e)
    if (!(i in r)) throw new RangeError(`Unsupported attribute ${i} for ${t} of type ${n}`);
  for (let i in r) r[i].validate && r[i].validate(e[i]);
}
class lt {
  constructor(e) {
    ((this.validEnd = e), (this.next = []), (this.wrapCache = []));
  }
  static parse(e, t) {
    let n = new Ca(e, t);
    if (n.next == null) return lt.empty;
    let i = gs(n);
    n.next && n.err('Unexpected trailing text');
    let o = Oa(Ta(i));
    return (Da(o, n), o);
  }
  matchType(e) {
    for (let t = 0; t < this.next.length; t++) if (this.next[t].type == e) return this.next[t].next;
    return null;
  }
  matchFragment(e, t = 0, n = e.childCount) {
    let i = this;
    for (let o = t; i && o < n; o++) i = i.matchType(e.child(o).type);
    return i;
  }
  get inlineContent() {
    return this.next.length != 0 && this.next[0].type.isInline;
  }
  get defaultType() {
    for (let e = 0; e < this.next.length; e++) {
      let { type: t } = this.next[e];
      if (!(t.isText || t.hasRequiredAttrs())) return t;
    }
    return null;
  }
  compatible(e) {
    for (let t = 0; t < this.next.length; t++)
      for (let n = 0; n < e.next.length; n++) if (this.next[t].type == e.next[n].type) return !0;
    return !1;
  }
  fillBefore(e, t = !1, n = 0) {
    let i = [this];
    function o(s, l) {
      let a = s.matchFragment(e, n);
      if (a && (!t || a.validEnd)) return k.from(l.map((c) => c.createAndFill()));
      for (let c = 0; c < s.next.length; c++) {
        let { type: u, next: f } = s.next[c];
        if (!(u.isText || u.hasRequiredAttrs()) && i.indexOf(f) == -1) {
          i.push(f);
          let h = o(f, l.concat(u));
          if (h) return h;
        }
      }
      return null;
    }
    return o(this, []);
  }
  findWrapping(e) {
    for (let n = 0; n < this.wrapCache.length; n += 2)
      if (this.wrapCache[n] == e) return this.wrapCache[n + 1];
    let t = this.computeWrapping(e);
    return (this.wrapCache.push(e, t), t);
  }
  computeWrapping(e) {
    let t = Object.create(null),
      n = [{ match: this, type: null, via: null }];
    for (; n.length;) {
      let i = n.shift(),
        o = i.match;
      if (o.matchType(e)) {
        let s = [];
        for (let l = i; l.type; l = l.via) s.push(l.type);
        return s.reverse();
      }
      for (let s = 0; s < o.next.length; s++) {
        let { type: l, next: a } = o.next[s];
        !l.isLeaf &&
          !l.hasRequiredAttrs() &&
          !(l.name in t) &&
          (!i.type || a.validEnd) &&
          (n.push({ match: l.contentMatch, type: l, via: i }), (t[l.name] = !0));
      }
    }
    return null;
  }
  get edgeCount() {
    return this.next.length;
  }
  edge(e) {
    if (e >= this.next.length) throw new RangeError(`There's no ${e}th edge in this content match`);
    return this.next[e];
  }
  toString() {
    let e = [];
    function t(n) {
      e.push(n);
      for (let i = 0; i < n.next.length; i++) e.indexOf(n.next[i].next) == -1 && t(n.next[i].next);
    }
    return (
      t(this),
      e.map((n, i) => {
        let o = i + (n.validEnd ? '*' : ' ') + ' ';
        for (let s = 0; s < n.next.length; s++)
          o += (s ? ', ' : '') + n.next[s].type.name + '->' + e.indexOf(n.next[s].next);
        return o;
      }).join(`
`)
    );
  }
}
lt.empty = new lt(!0);
class Ca {
  constructor(e, t) {
    ((this.string = e),
      (this.nodeTypes = t),
      (this.inline = null),
      (this.pos = 0),
      (this.tokens = e.split(/\s*(?=\b|\W|$)/)),
      this.tokens[this.tokens.length - 1] == '' && this.tokens.pop(),
      this.tokens[0] == '' && this.tokens.shift());
  }
  get next() {
    return this.tokens[this.pos];
  }
  eat(e) {
    return this.next == e && (this.pos++ || !0);
  }
  err(e) {
    throw new SyntaxError(e + " (in content expression '" + this.string + "')");
  }
}
function gs(r) {
  let e = [];
  do e.push(Sa(r));
  while (r.eat('|'));
  return e.length == 1 ? e[0] : { type: 'choice', exprs: e };
}
function Sa(r) {
  let e = [];
  do e.push(va(r));
  while (r.next && r.next != ')' && r.next != '|');
  return e.length == 1 ? e[0] : { type: 'seq', exprs: e };
}
function va(r) {
  let e = Ea(r);
  for (;;)
    if (r.eat('+')) e = { type: 'plus', expr: e };
    else if (r.eat('*')) e = { type: 'star', expr: e };
    else if (r.eat('?')) e = { type: 'opt', expr: e };
    else if (r.eat('{')) e = Aa(r, e);
    else break;
  return e;
}
function Si(r) {
  /\D/.test(r.next) && r.err("Expected number, got '" + r.next + "'");
  let e = Number(r.next);
  return (r.pos++, e);
}
function Aa(r, e) {
  let t = Si(r),
    n = t;
  return (
    r.eat(',') && (r.next != '}' ? (n = Si(r)) : (n = -1)),
    r.eat('}') || r.err('Unclosed braced range'),
    { type: 'range', min: t, max: n, expr: e }
  );
}
function Na(r, e) {
  let t = r.nodeTypes,
    n = t[e];
  if (n) return [n];
  let i = [];
  for (let o in t) {
    let s = t[o];
    s.isInGroup(e) && i.push(s);
  }
  return (i.length == 0 && r.err("No node type or group '" + e + "' found"), i);
}
function Ea(r) {
  if (r.eat('(')) {
    let e = gs(r);
    return (r.eat(')') || r.err('Missing closing paren'), e);
  } else if (/\W/.test(r.next)) r.err("Unexpected token '" + r.next + "'");
  else {
    let e = Na(r, r.next).map(
      (t) => (
        r.inline == null
          ? (r.inline = t.isInline)
          : r.inline != t.isInline && r.err('Mixing inline and block content'),
        { type: 'name', value: t }
      ),
    );
    return (r.pos++, e.length == 1 ? e[0] : { type: 'choice', exprs: e });
  }
}
function Ta(r) {
  let e = [[]];
  return (i(o(r, 0), t()), e);
  function t() {
    return e.push([]) - 1;
  }
  function n(s, l, a) {
    let c = { term: a, to: l };
    return (e[s].push(c), c);
  }
  function i(s, l) {
    s.forEach((a) => (a.to = l));
  }
  function o(s, l) {
    if (s.type == 'choice') return s.exprs.reduce((a, c) => a.concat(o(c, l)), []);
    if (s.type == 'seq')
      for (let a = 0; ; a++) {
        let c = o(s.exprs[a], l);
        if (a == s.exprs.length - 1) return c;
        i(c, (l = t()));
      }
    else if (s.type == 'star') {
      let a = t();
      return (n(l, a), i(o(s.expr, a), a), [n(a)]);
    } else if (s.type == 'plus') {
      let a = t();
      return (i(o(s.expr, l), a), i(o(s.expr, a), a), [n(a)]);
    } else {
      if (s.type == 'opt') return [n(l)].concat(o(s.expr, l));
      if (s.type == 'range') {
        let a = l;
        for (let c = 0; c < s.min; c++) {
          let u = t();
          (i(o(s.expr, a), u), (a = u));
        }
        if (s.max == -1) i(o(s.expr, a), a);
        else
          for (let c = s.min; c < s.max; c++) {
            let u = t();
            (n(a, u), i(o(s.expr, a), u), (a = u));
          }
        return [n(a)];
      } else {
        if (s.type == 'name') return [n(l, void 0, s.value)];
        throw new Error('Unknown expr type');
      }
    }
  }
}
function bs(r, e) {
  return e - r;
}
function vi(r, e) {
  let t = [];
  return (n(e), t.sort(bs));
  function n(i) {
    let o = r[i];
    if (o.length == 1 && !o[0].term) return n(o[0].to);
    t.push(i);
    for (let s = 0; s < o.length; s++) {
      let { term: l, to: a } = o[s];
      !l && t.indexOf(a) == -1 && n(a);
    }
  }
}
function Oa(r) {
  let e = Object.create(null);
  return t(vi(r, 0));
  function t(n) {
    let i = [];
    n.forEach((s) => {
      r[s].forEach(({ term: l, to: a }) => {
        if (!l) return;
        let c;
        for (let u = 0; u < i.length; u++) i[u][0] == l && (c = i[u][1]);
        vi(r, a).forEach((u) => {
          (c || i.push([l, (c = [])]), c.indexOf(u) == -1 && c.push(u));
        });
      });
    });
    let o = (e[n.join(',')] = new lt(n.indexOf(r.length - 1) > -1));
    for (let s = 0; s < i.length; s++) {
      let l = i[s][1].sort(bs);
      o.next.push({ type: i[s][0], next: e[l.join(',')] || t(l) });
    }
    return o;
  }
}
function Da(r, e) {
  for (let t = 0, n = [r]; t < n.length; t++) {
    let i = n[t],
      o = !i.validEnd,
      s = [];
    for (let l = 0; l < i.next.length; l++) {
      let { type: a, next: c } = i.next[l];
      (s.push(a.name),
        o && !(a.isText || a.hasRequiredAttrs()) && (o = !1),
        n.indexOf(c) == -1 && n.push(c));
    }
    o &&
      e.err(
        'Only non-generatable nodes (' +
          s.join(', ') +
          ') in a required position (see https://prosemirror.net/docs/guide/#generatable)',
      );
  }
}
function ys(r) {
  let e = Object.create(null);
  for (let t in r) {
    let n = r[t];
    if (!n.hasDefault) return null;
    e[t] = n.default;
  }
  return e;
}
function ws(r, e) {
  let t = Object.create(null);
  for (let n in r) {
    let i = r[n],
      o = e && e[n];
    if (o === void 0)
      if (i.hasDefault) o = i.default;
      else throw new RangeError('No value supplied for attribute ' + n);
    else i.validate && i.validate(o);
    t[n] = o;
  }
  return t;
}
function ks(r, e) {
  let t = Object.create(null);
  if (e) for (let n in e) t[n] = new Ia(r, n, e[n]);
  return t;
}
let Xt = class xs {
  constructor(e, t, n) {
    ((this.name = e),
      (this.schema = t),
      (this.spec = n),
      (this.markSet = null),
      (this.groups = n.group ? n.group.split(' ') : []),
      (this.attrs = ks(e, n.attrs)),
      (this.defaultAttrs = ys(this.attrs)),
      (this.contentMatch = null),
      (this.inlineContent = null),
      (this.isBlock = !(n.inline || e == 'text')),
      (this.isText = e == 'text'));
  }
  get isInline() {
    return !this.isBlock;
  }
  get isTextblock() {
    return this.isBlock && this.inlineContent;
  }
  get isLeaf() {
    return this.contentMatch == lt.empty;
  }
  get isAtom() {
    return this.isLeaf || !!this.spec.atom;
  }
  isInGroup(e) {
    return this.groups.indexOf(e) > -1;
  }
  get whitespace() {
    return this.spec.whitespace || (this.spec.code ? 'pre' : 'normal');
  }
  hasRequiredAttrs() {
    for (let e in this.attrs) if (this.attrs[e].isRequired) return !0;
    return !1;
  }
  compatibleContent(e) {
    return this == e || this.contentMatch.compatible(e.contentMatch);
  }
  computeAttrs(e) {
    return !e && this.defaultAttrs ? this.defaultAttrs : ws(this.attrs, e);
  }
  create(e = null, t, n) {
    if (this.isText) throw new Error("NodeType.create can't construct text nodes");
    return new _e(this, this.computeAttrs(e), k.from(t), P.setFrom(n));
  }
  createChecked(e = null, t, n) {
    return (
      (t = k.from(t)),
      this.checkContent(t),
      new _e(this, this.computeAttrs(e), t, P.setFrom(n))
    );
  }
  createAndFill(e = null, t, n) {
    if (((e = this.computeAttrs(e)), (t = k.from(t)), t.size)) {
      let s = this.contentMatch.fillBefore(t);
      if (!s) return null;
      t = s.append(t);
    }
    let i = this.contentMatch.matchFragment(t),
      o = i && i.fillBefore(k.empty, !0);
    return o ? new _e(this, e, t.append(o), P.setFrom(n)) : null;
  }
  validContent(e) {
    let t = this.contentMatch.matchFragment(e);
    if (!t || !t.validEnd) return !1;
    for (let n = 0; n < e.childCount; n++) if (!this.allowsMarks(e.child(n).marks)) return !1;
    return !0;
  }
  checkContent(e) {
    if (!this.validContent(e))
      throw new RangeError(`Invalid content for node ${this.name}: ${e.toString().slice(0, 50)}`);
  }
  checkAttrs(e) {}
  allowsMarkType(e) {
    return this.markSet == null || this.markSet.indexOf(e) > -1;
  }
  allowsMarks(e) {
    if (this.markSet == null) return !0;
    for (let t = 0; t < e.length; t++) if (!this.allowsMarkType(e[t].type)) return !1;
    return !0;
  }
  allowedMarks(e) {
    if (this.markSet == null) return e;
    let t;
    for (let n = 0; n < e.length; n++)
      this.allowsMarkType(e[n].type) ? t && t.push(e[n]) : t || (t = e.slice(0, n));
    return t ? (t.length ? t : P.none) : e;
  }
  static compile(e, t) {
    let n = Object.create(null);
    e.forEach((o, s) => (n[o] = new xs(o, t, s)));
    let i = t.spec.topNode || 'doc';
    if (!n[i]) throw new RangeError("Schema is missing its top node type ('" + i + "')");
    if (!n.text) throw new RangeError("Every schema needs a 'text' type");
    for (let o in n.text.attrs)
      throw new RangeError('The text node type should not have attributes');
    return n;
  }
};
function Ra(r, e, t) {
  let n = t.split('|');
  return (i) => {
    let o = i === null ? 'null' : typeof i;
    if (n.indexOf(o) < 0)
      throw new RangeError(`Expected value of type ${n} for attribute ${e} on type ${r}, got ${o}`);
  };
}
class Ia {
  constructor(e, t, n) {
    ((this.hasDefault = Object.prototype.hasOwnProperty.call(n, 'default')),
      (this.default = n.default),
      (this.validate = typeof n.validate == 'string' ? Ra(e, t, n.validate) : n.validate));
  }
  get isRequired() {
    return !this.hasDefault;
  }
}
class Gn {
  constructor(e, t, n, i) {
    ((this.name = e),
      (this.rank = t),
      (this.schema = n),
      (this.spec = i),
      (this.attrs = ks(e, i.attrs)),
      (this.excluded = null));
    let o = ys(this.attrs);
    this.instance = o ? new P(this, o) : null;
  }
  create(e = null) {
    return !e && this.instance ? this.instance : new P(this, ws(this.attrs, e));
  }
  static compile(e, t) {
    let n = Object.create(null),
      i = 0;
    return (e.forEach((o, s) => (n[o] = new Gn(o, i++, t, s))), n);
  }
  removeFromSet(e) {
    for (var t = 0; t < e.length; t++)
      e[t].type == this && ((e = e.slice(0, t).concat(e.slice(t + 1))), t--);
    return e;
  }
  isInSet(e) {
    for (let t = 0; t < e.length; t++) if (e[t].type == this) return e[t];
  }
  excludes(e) {
    return this.excluded.indexOf(e) > -1;
  }
}
class La {
  constructor(e) {
    ((this.linebreakReplacement = null), (this.cached = Object.create(null)));
    let t = (this.spec = {});
    for (let i in e) t[i] = e[i];
    ((t.nodes = Y.from(e.nodes)),
      (t.marks = Y.from(e.marks || {})),
      (this.nodes = Xt.compile(this.spec.nodes, this)),
      (this.marks = Gn.compile(this.spec.marks, this)));
    let n = Object.create(null);
    for (let i in this.nodes) {
      if (i in this.marks) throw new RangeError(i + ' can not be both a node and a mark');
      let o = this.nodes[i],
        s = o.spec.content || '',
        l = o.spec.marks;
      if (
        ((o.contentMatch = n[s] || (n[s] = lt.parse(s, this.nodes))),
        (o.inlineContent = o.contentMatch.inlineContent),
        o.spec.linebreakReplacement)
      ) {
        if (this.linebreakReplacement) throw new RangeError('Multiple linebreak nodes defined');
        if (!o.isInline || !o.isLeaf)
          throw new RangeError('Linebreak replacement nodes must be inline leaf nodes');
        this.linebreakReplacement = o;
      }
      o.markSet =
        l == '_' ? null : l ? Ai(this, l.split(' ')) : l == '' || !o.inlineContent ? [] : null;
    }
    for (let i in this.marks) {
      let o = this.marks[i],
        s = o.spec.excludes;
      o.excluded = s == null ? [o] : s == '' ? [] : Ai(this, s.split(' '));
    }
    ((this.nodeFromJSON = (i) => _e.fromJSON(this, i)),
      (this.markFromJSON = (i) => P.fromJSON(this, i)),
      (this.topNodeType = this.nodes[this.spec.topNode || 'doc']),
      (this.cached.wrappings = Object.create(null)));
  }
  node(e, t = null, n, i) {
    if (typeof e == 'string') e = this.nodeType(e);
    else if (e instanceof Xt) {
      if (e.schema != this)
        throw new RangeError('Node type from different schema used (' + e.name + ')');
    } else throw new RangeError('Invalid node type: ' + e);
    return e.createChecked(t, n, i);
  }
  text(e, t) {
    let n = this.nodes.text;
    return new Bn(n, n.defaultAttrs, e, P.setFrom(t));
  }
  mark(e, t) {
    return (typeof e == 'string' && (e = this.marks[e]), e.create(t));
  }
  nodeType(e) {
    let t = this.nodes[e];
    if (!t) throw new RangeError('Unknown node type: ' + e);
    return t;
  }
}
function Ai(r, e) {
  let t = [];
  for (let n = 0; n < e.length; n++) {
    let i = e[n],
      o = r.marks[i],
      s = o;
    if (o) t.push(o);
    else
      for (let l in r.marks) {
        let a = r.marks[l];
        (i == '_' || (a.spec.group && a.spec.group.split(' ').indexOf(i) > -1)) && t.push((s = a));
      }
    if (!s) throw new SyntaxError("Unknown mark type: '" + e[n] + "'");
  }
  return t;
}
function za(r) {
  return r.tag != null;
}
function Ba(r) {
  return r.style != null;
}
class at {
  constructor(e, t) {
    ((this.schema = e), (this.rules = t), (this.tags = []), (this.styles = []));
    let n = (this.matchedStyles = []);
    (t.forEach((i) => {
      if (za(i)) this.tags.push(i);
      else if (Ba(i)) {
        let o = /[^=]*/.exec(i.style)[0];
        (n.indexOf(o) < 0 && n.push(o), this.styles.push(i));
      }
    }),
      (this.normalizeLists = !this.tags.some((i) => {
        if (!/^(ul|ol)\b/.test(i.tag) || !i.node) return !1;
        let o = e.nodes[i.node];
        return o.contentMatch.matchType(o);
      })));
  }
  parse(e, t = {}) {
    let n = new Ei(this, t, !1);
    return (n.addAll(e, P.none, t.from, t.to), n.finish());
  }
  parseSlice(e, t = {}) {
    let n = new Ei(this, t, !0);
    return (n.addAll(e, P.none, t.from, t.to), S.maxOpen(n.finish()));
  }
  matchTag(e, t, n) {
    for (let i = n ? this.tags.indexOf(n) + 1 : 0; i < this.tags.length; i++) {
      let o = this.tags[i];
      if (
        $a(e, o.tag) &&
        (o.namespace === void 0 || e.namespaceURI == o.namespace) &&
        (!o.context || t.matchesContext(o.context))
      ) {
        if (o.getAttrs) {
          let s = o.getAttrs(e);
          if (s === !1) continue;
          o.attrs = s || void 0;
        }
        return o;
      }
    }
  }
  matchStyle(e, t, n, i) {
    for (let o = i ? this.styles.indexOf(i) + 1 : 0; o < this.styles.length; o++) {
      let s = this.styles[o],
        l = s.style;
      if (!(
        l.indexOf(e) != 0 ||
        (s.context && !n.matchesContext(s.context)) ||
        (l.length > e.length && (l.charCodeAt(e.length) != 61 || l.slice(e.length + 1) != t))
      )) {
        if (s.getAttrs) {
          let a = s.getAttrs(t);
          if (a === !1) continue;
          s.attrs = a || void 0;
        }
        return s;
      }
    }
  }
  static schemaRules(e) {
    let t = [];
    function n(i) {
      let o = i.priority == null ? 50 : i.priority,
        s = 0;
      for (; s < t.length; s++) {
        let l = t[s];
        if ((l.priority == null ? 50 : l.priority) < o) break;
      }
      t.splice(s, 0, i);
    }
    for (let i in e.marks) {
      let o = e.marks[i].spec.parseDOM;
      o &&
        o.forEach((s) => {
          (n((s = Ti(s))), s.mark || s.ignore || s.clearMark || (s.mark = i));
        });
    }
    for (let i in e.nodes) {
      let o = e.nodes[i].spec.parseDOM;
      o &&
        o.forEach((s) => {
          (n((s = Ti(s))), s.node || s.ignore || s.mark || (s.node = i));
        });
    }
    return t;
  }
  static fromSchema(e) {
    return e.cached.domParser || (e.cached.domParser = new at(e, at.schemaRules(e)));
  }
}
const Ms = {
    address: !0,
    article: !0,
    aside: !0,
    blockquote: !0,
    body: !0,
    canvas: !0,
    dd: !0,
    div: !0,
    dl: !0,
    fieldset: !0,
    figcaption: !0,
    figure: !0,
    footer: !0,
    form: !0,
    h1: !0,
    h2: !0,
    h3: !0,
    h4: !0,
    h5: !0,
    h6: !0,
    header: !0,
    hgroup: !0,
    hr: !0,
    li: !0,
    noscript: !0,
    ol: !0,
    output: !0,
    p: !0,
    pre: !0,
    section: !0,
    table: !0,
    tfoot: !0,
    ul: !0,
  },
  Pa = { head: !0, noscript: !0, object: !0, script: !0, style: !0, title: !0 },
  Cs = { ol: !0, ul: !0 },
  Yt = 1,
  Ar = 2,
  _t = 4;
function Ni(r, e, t) {
  return e != null
    ? (e ? Yt : 0) | (e === 'full' ? Ar : 0)
    : r && r.whitespace == 'pre'
      ? Yt | Ar
      : t & ~_t;
}
class mn {
  constructor(e, t, n, i, o, s) {
    ((this.type = e),
      (this.attrs = t),
      (this.marks = n),
      (this.solid = i),
      (this.options = s),
      (this.content = []),
      (this.activeMarks = P.none),
      (this.match = o || (s & _t ? null : e.contentMatch)));
  }
  findWrapping(e) {
    if (!this.match) {
      if (!this.type) return [];
      let t = this.type.contentMatch.fillBefore(k.from(e));
      if (t) this.match = this.type.contentMatch.matchFragment(t);
      else {
        let n = this.type.contentMatch,
          i;
        return (i = n.findWrapping(e.type)) ? ((this.match = n), i) : null;
      }
    }
    return this.match.findWrapping(e.type);
  }
  finish(e) {
    if (!(this.options & Yt)) {
      let n = this.content[this.content.length - 1],
        i;
      if (n && n.isText && (i = /[ \t\r\n\u000c]+$/.exec(n.text))) {
        let o = n;
        n.text.length == i[0].length
          ? this.content.pop()
          : (this.content[this.content.length - 1] = o.withText(
              o.text.slice(0, o.text.length - i[0].length),
            ));
      }
    }
    let t = k.from(this.content);
    return (
      !e && this.match && (t = t.append(this.match.fillBefore(k.empty, !0))),
      this.type ? this.type.create(this.attrs, t, this.marks) : t
    );
  }
  inlineContext(e) {
    return this.type
      ? this.type.inlineContent
      : this.content.length
        ? this.content[0].isInline
        : e.parentNode && !Ms.hasOwnProperty(e.parentNode.nodeName.toLowerCase());
  }
}
class Ei {
  constructor(e, t, n) {
    ((this.parser = e),
      (this.options = t),
      (this.isOpen = n),
      (this.open = 0),
      (this.localPreserveWS = !1));
    let i = t.topNode,
      o,
      s = Ni(null, t.preserveWhitespace, 0) | (n ? _t : 0);
    (i
      ? (o = new mn(i.type, i.attrs, P.none, !0, t.topMatch || i.type.contentMatch, s))
      : n
        ? (o = new mn(null, null, P.none, !0, null, s))
        : (o = new mn(e.schema.topNodeType, null, P.none, !0, null, s)),
      (this.nodes = [o]),
      (this.find = t.findPositions),
      (this.needsBlock = !1));
  }
  get top() {
    return this.nodes[this.open];
  }
  addDOM(e, t) {
    e.nodeType == 3 ? this.addTextNode(e, t) : e.nodeType == 1 && this.addElement(e, t);
  }
  addTextNode(e, t) {
    let n = e.nodeValue,
      i = this.top,
      o = i.options & Ar ? 'full' : this.localPreserveWS || (i.options & Yt) > 0,
      { schema: s } = this.parser;
    if (o === 'full' || i.inlineContext(e) || /[^ \t\r\n\u000c]/.test(n)) {
      if (o)
        if (o === 'full')
          n = n.replace(
            /\r\n?/g,
            `
`,
          );
        else if (
          s.linebreakReplacement &&
          /[\r\n]/.test(n) &&
          this.top.findWrapping(s.linebreakReplacement.create())
        ) {
          let l = n.split(/\r?\n|\r/);
          for (let a = 0; a < l.length; a++)
            (a && this.insertNode(s.linebreakReplacement.create(), t, !0),
              l[a] && this.insertNode(s.text(l[a]), t, !/\S/.test(l[a])));
          n = '';
        } else n = n.replace(/\r?\n|\r/g, ' ');
      else if (
        ((n = n.replace(/[ \t\r\n\u000c]+/g, ' ')),
        /^[ \t\r\n\u000c]/.test(n) && this.open == this.nodes.length - 1)
      ) {
        let l = i.content[i.content.length - 1],
          a = e.previousSibling;
        (!l || (a && a.nodeName == 'BR') || (l.isText && /[ \t\r\n\u000c]$/.test(l.text))) &&
          (n = n.slice(1));
      }
      (n && this.insertNode(s.text(n), t, !/\S/.test(n)), this.findInText(e));
    } else this.findInside(e);
  }
  addElement(e, t, n) {
    let i = this.localPreserveWS,
      o = this.top;
    (e.tagName == 'PRE' || /pre/.test(e.style && e.style.whiteSpace)) &&
      (this.localPreserveWS = !0);
    let s = e.nodeName.toLowerCase(),
      l;
    Cs.hasOwnProperty(s) && this.parser.normalizeLists && Fa(e);
    let a =
      (this.options.ruleFromNode && this.options.ruleFromNode(e)) ||
      (l = this.parser.matchTag(e, this, n));
    e: if (a ? a.ignore : Pa.hasOwnProperty(s)) (this.findInside(e), this.ignoreFallback(e, t));
    else if (!a || a.skip || a.closeParent) {
      a && a.closeParent
        ? (this.open = Math.max(0, this.open - 1))
        : a && a.skip.nodeType && (e = a.skip);
      let c,
        u = this.needsBlock;
      if (Ms.hasOwnProperty(s))
        (o.content.length && o.content[0].isInline && this.open && (this.open--, (o = this.top)),
          (c = !0),
          o.type || (this.needsBlock = !0));
      else if (!e.firstChild) {
        this.leafFallback(e, t);
        break e;
      }
      let f = a && a.skip ? t : this.readStyles(e, t);
      (f && this.addAll(e, f), c && this.sync(o), (this.needsBlock = u));
    } else {
      let c = this.readStyles(e, t);
      c && this.addElementByRule(e, a, c, a.consuming === !1 ? l : void 0);
    }
    this.localPreserveWS = i;
  }
  leafFallback(e, t) {
    e.nodeName == 'BR' &&
      this.top.type &&
      this.top.type.inlineContent &&
      this.addTextNode(
        e.ownerDocument.createTextNode(`
`),
        t,
      );
  }
  ignoreFallback(e, t) {
    e.nodeName == 'BR' &&
      (!this.top.type || !this.top.type.inlineContent) &&
      this.findPlace(this.parser.schema.text('-'), t, !0);
  }
  readStyles(e, t) {
    let n = e.style;
    if (n && n.length)
      for (let i = 0; i < this.parser.matchedStyles.length; i++) {
        let o = this.parser.matchedStyles[i],
          s = n.getPropertyValue(o);
        if (s)
          for (let l = void 0; ;) {
            let a = this.parser.matchStyle(o, s, this, l);
            if (!a) break;
            if (a.ignore) return null;
            if (
              (a.clearMark
                ? (t = t.filter((c) => !a.clearMark(c)))
                : (t = t.concat(this.parser.schema.marks[a.mark].create(a.attrs))),
              a.consuming === !1)
            )
              l = a;
            else break;
          }
      }
    return t;
  }
  addElementByRule(e, t, n, i) {
    let o, s;
    if (t.node)
      if (((s = this.parser.schema.nodes[t.node]), s.isLeaf))
        this.insertNode(s.create(t.attrs), n, e.nodeName == 'BR') || this.leafFallback(e, n);
      else {
        let a = this.enter(s, t.attrs || null, n, t.preserveWhitespace);
        a && ((o = !0), (n = a));
      }
    else {
      let a = this.parser.schema.marks[t.mark];
      n = n.concat(a.create(t.attrs));
    }
    let l = this.top;
    if (s && s.isLeaf) this.findInside(e);
    else if (i) this.addElement(e, n, i);
    else if (t.getContent)
      (this.findInside(e),
        t.getContent(e, this.parser.schema).forEach((a) => this.insertNode(a, n, !1)));
    else {
      let a = e;
      (typeof t.contentElement == 'string'
        ? (a = e.querySelector(t.contentElement))
        : typeof t.contentElement == 'function'
          ? (a = t.contentElement(e))
          : t.contentElement && (a = t.contentElement),
        this.findAround(e, a, !0),
        this.addAll(a, n),
        this.findAround(e, a, !1));
    }
    o && this.sync(l) && this.open--;
  }
  addAll(e, t, n, i) {
    let o = n || 0;
    for (
      let s = n ? e.childNodes[n] : e.firstChild, l = i == null ? null : e.childNodes[i];
      s != l;
      s = s.nextSibling, ++o
    )
      (this.findAtPoint(e, o), this.addDOM(s, t));
    this.findAtPoint(e, o);
  }
  findPlace(e, t, n) {
    let i, o;
    for (let s = this.open, l = 0; s >= 0; s--) {
      let a = this.nodes[s],
        c = a.findWrapping(e);
      if (c && (!i || i.length > c.length + l) && ((i = c), (o = a), !c.length)) break;
      if (a.solid) {
        if (n) break;
        l += 2;
      }
    }
    if (!i) return null;
    this.sync(o);
    for (let s = 0; s < i.length; s++) t = this.enterInner(i[s], null, t, !1);
    return t;
  }
  insertNode(e, t, n) {
    if (e.isInline && this.needsBlock && !this.top.type) {
      let o = this.textblockFromContext();
      o && (t = this.enterInner(o, null, t));
    }
    let i = this.findPlace(e, t, n);
    if (i) {
      this.closeExtra();
      let o = this.top;
      o.match && (o.match = o.match.matchType(e.type));
      let s = P.none;
      for (let l of i.concat(e.marks))
        (o.type ? o.type.allowsMarkType(l.type) : Oi(l.type, e.type)) && (s = l.addToSet(s));
      return (o.content.push(e.mark(s)), !0);
    }
    return !1;
  }
  enter(e, t, n, i) {
    let o = this.findPlace(e.create(t), n, !1);
    return (o && (o = this.enterInner(e, t, n, !0, i)), o);
  }
  enterInner(e, t, n, i = !1, o) {
    this.closeExtra();
    let s = this.top;
    s.match = s.match && s.match.matchType(e);
    let l = Ni(e, o, s.options);
    s.options & _t && s.content.length == 0 && (l |= _t);
    let a = P.none;
    return (
      (n = n.filter((c) =>
        (s.type ? s.type.allowsMarkType(c.type) : Oi(c.type, e)) ? ((a = c.addToSet(a)), !1) : !0,
      )),
      this.nodes.push(new mn(e, t, a, i, null, l)),
      this.open++,
      n
    );
  }
  closeExtra(e = !1) {
    let t = this.nodes.length - 1;
    if (t > this.open) {
      for (; t > this.open; t--) this.nodes[t - 1].content.push(this.nodes[t].finish(e));
      this.nodes.length = this.open + 1;
    }
  }
  finish() {
    return (
      (this.open = 0),
      this.closeExtra(this.isOpen),
      this.nodes[0].finish(!!(this.isOpen || this.options.topOpen))
    );
  }
  sync(e) {
    for (let t = this.open; t >= 0; t--) {
      if (this.nodes[t] == e) return ((this.open = t), !0);
      this.localPreserveWS && (this.nodes[t].options |= Yt);
    }
    return !1;
  }
  get currentPos() {
    this.closeExtra();
    let e = 0;
    for (let t = this.open; t >= 0; t--) {
      let n = this.nodes[t].content;
      for (let i = n.length - 1; i >= 0; i--) e += n[i].nodeSize;
      t && e++;
    }
    return e;
  }
  findAtPoint(e, t) {
    if (this.find)
      for (let n = 0; n < this.find.length; n++)
        this.find[n].node == e && this.find[n].offset == t && (this.find[n].pos = this.currentPos);
  }
  findInside(e) {
    if (this.find)
      for (let t = 0; t < this.find.length; t++)
        this.find[t].pos == null &&
          e.nodeType == 1 &&
          e.contains(this.find[t].node) &&
          (this.find[t].pos = this.currentPos);
  }
  findAround(e, t, n) {
    if (e != t && this.find)
      for (let i = 0; i < this.find.length; i++)
        this.find[i].pos == null &&
          e.nodeType == 1 &&
          e.contains(this.find[i].node) &&
          t.compareDocumentPosition(this.find[i].node) & (n ? 2 : 4) &&
          (this.find[i].pos = this.currentPos);
  }
  findInText(e) {
    if (this.find)
      for (let t = 0; t < this.find.length; t++)
        this.find[t].node == e &&
          (this.find[t].pos = this.currentPos - (e.nodeValue.length - this.find[t].offset));
  }
  matchesContext(e) {
    if (e.indexOf('|') > -1) return e.split(/\s*\|\s*/).some(this.matchesContext, this);
    let t = e.split('/'),
      n = this.options.context,
      i = !this.isOpen && (!n || n.parent.type == this.nodes[0].type),
      o = -(n ? n.depth + 1 : 0) + (i ? 0 : 1),
      s = (l, a) => {
        for (; l >= 0; l--) {
          let c = t[l];
          if (c == '') {
            if (l == t.length - 1 || l == 0) continue;
            for (; a >= o; a--) if (s(l - 1, a)) return !0;
            return !1;
          } else {
            let u =
              a > 0 || (a == 0 && i) ? this.nodes[a].type : n && a >= o ? n.node(a - o).type : null;
            if (!u || (u.name != c && !u.isInGroup(c))) return !1;
            a--;
          }
        }
        return !0;
      };
    return s(t.length - 1, this.open);
  }
  textblockFromContext() {
    let e = this.options.context;
    if (e)
      for (let t = e.depth; t >= 0; t--) {
        let n = e.node(t).contentMatchAt(e.indexAfter(t)).defaultType;
        if (n && n.isTextblock && n.defaultAttrs) return n;
      }
    for (let t in this.parser.schema.nodes) {
      let n = this.parser.schema.nodes[t];
      if (n.isTextblock && n.defaultAttrs) return n;
    }
  }
}
function Fa(r) {
  for (let e = r.firstChild, t = null; e; e = e.nextSibling) {
    let n = e.nodeType == 1 ? e.nodeName.toLowerCase() : null;
    n && Cs.hasOwnProperty(n) && t
      ? (t.appendChild(e), (e = t))
      : n == 'li'
        ? (t = e)
        : n && (t = null);
  }
}
function $a(r, e) {
  return (r.matches || r.msMatchesSelector || r.webkitMatchesSelector || r.mozMatchesSelector).call(
    r,
    e,
  );
}
function Ti(r) {
  let e = {};
  for (let t in r) e[t] = r[t];
  return e;
}
function Oi(r, e) {
  let t = e.schema.nodes;
  for (let n in t) {
    let i = t[n];
    if (!i.allowsMarkType(r)) continue;
    let o = [],
      s = (l) => {
        o.push(l);
        for (let a = 0; a < l.edgeCount; a++) {
          let { type: c, next: u } = l.edge(a);
          if (c == e || (o.indexOf(u) < 0 && s(u))) return !0;
        }
      };
    if (s(i.contentMatch)) return !0;
  }
}
class Xe {
  constructor(e, t) {
    ((this.nodes = e), (this.marks = t));
  }
  serializeFragment(e, t = {}, n) {
    n || (n = gn(t).createDocumentFragment());
    let i = n,
      o = [];
    return (
      e.forEach((s) => {
        if (o.length || s.marks.length) {
          let l = 0,
            a = 0;
          for (; l < o.length && a < s.marks.length;) {
            let c = s.marks[a];
            if (!this.marks[c.type.name]) {
              a++;
              continue;
            }
            if (!c.eq(o[l][0]) || c.type.spec.spanning === !1) break;
            (l++, a++);
          }
          for (; l < o.length;) i = o.pop()[1];
          for (; a < s.marks.length;) {
            let c = s.marks[a++],
              u = this.serializeMark(c, s.isInline, t);
            u && (o.push([c, i]), i.appendChild(u.dom), (i = u.contentDOM || u.dom));
          }
        }
        i.appendChild(this.serializeNodeInner(s, t));
      }),
      n
    );
  }
  serializeNodeInner(e, t) {
    if (e.isText) return gn(t).createTextNode(e.text);
    let { dom: n, contentDOM: i } = Nn(gn(t), this.nodes[e.type.name](e), null, e.attrs);
    if (i) {
      if (e.isLeaf) throw new RangeError('Content hole not allowed in a leaf node spec');
      this.serializeFragment(e.content, t, i);
    }
    return n;
  }
  serializeNode(e, t = {}) {
    let n = this.serializeNodeInner(e, t);
    for (let i = e.marks.length - 1; i >= 0; i--) {
      let o = this.serializeMark(e.marks[i], e.isInline, t);
      o && ((o.contentDOM || o.dom).appendChild(n), (n = o.dom));
    }
    return n;
  }
  serializeMark(e, t, n = {}) {
    let i = this.marks[e.type.name];
    return i && Nn(gn(n), i(e, t), null, e.attrs);
  }
  static renderSpec(e, t, n = null, i) {
    return typeof t == 'string' ? { dom: e.createTextNode(t) } : Nn(e, t, n, i);
  }
  static fromSchema(e) {
    return (
      e.cached.domSerializer ||
      (e.cached.domSerializer = new Xe(this.nodesFromSchema(e), this.marksFromSchema(e)))
    );
  }
  static nodesFromSchema(e) {
    let t = Di(e.nodes);
    return (t.text || (t.text = (n) => n.text), t);
  }
  static marksFromSchema(e) {
    return Di(e.marks);
  }
}
function Di(r) {
  let e = {};
  for (let t in r) {
    let n = r[t].spec.toDOM;
    n && (e[t] = n);
  }
  return e;
}
function gn(r) {
  return r.document || window.document;
}
const Ri = new WeakMap();
function Va(r) {
  let e = Ri.get(r);
  return (e === void 0 && Ri.set(r, (e = Ha(r))), e);
}
function Ha(r) {
  let e = null;
  function t(n) {
    if (n && typeof n == 'object')
      if (Array.isArray(n))
        if (typeof n[0] == 'string') (e || (e = []), e.push(n));
        else for (let i = 0; i < n.length; i++) t(n[i]);
      else for (let i in n) t(n[i]);
  }
  return (t(r), e);
}
function Nn(r, e, t, n) {
  if (e.nodeType == 1) return { dom: e };
  if (e.dom && e.dom.nodeType == 1) return e;
  let i = e[0],
    o;
  if (typeof i != 'string') throw new RangeError('Invalid array passed to renderSpec');
  if (n && (o = Va(n)) && o.indexOf(e) > -1)
    throw new RangeError(
      'Using an array from an attribute object as a DOM spec. This may be an attempted cross site scripting attack.',
    );
  let s = i.indexOf(' ');
  s > 0 && ((t = i.slice(0, s)), (i = i.slice(s + 1)));
  let l,
    a = t ? r.createElementNS(t, i) : r.createElement(i),
    c = e[1],
    u = 1;
  if (c && typeof c == 'object' && c.nodeType == null && !Array.isArray(c)) {
    u = 2;
    for (let f in c)
      if (c[f] != null) {
        let h = f.indexOf(' ');
        h > 0
          ? a.setAttributeNS(f.slice(0, h), f.slice(h + 1), c[f])
          : f == 'style' && a.style
            ? (a.style.cssText = c[f])
            : a.setAttribute(f, c[f]);
      }
  }
  for (let f = u; f < e.length; f++) {
    let h = e[f];
    if (h === 0) {
      if (f < e.length - 1 || f > u)
        throw new RangeError('Content hole must be the only child of its parent node');
      return { dom: a, contentDOM: a };
    } else if (typeof h == 'string') a.appendChild(r.createTextNode(h));
    else {
      let { dom: d, contentDOM: p } = Nn(r, h, t, n);
      if ((a.appendChild(d), p)) {
        if (l) throw new RangeError('Multiple content holes');
        l = p;
      }
    }
  }
  return { dom: a, contentDOM: l };
}
const Ss = 65535,
  vs = Math.pow(2, 16);
function Wa(r, e) {
  return r + e * vs;
}
function Ii(r) {
  return r & Ss;
}
function qa(r) {
  return (r - (r & Ss)) / vs;
}
const As = 1,
  Ns = 2,
  En = 4,
  Es = 8;
class Nr {
  constructor(e, t, n) {
    ((this.pos = e), (this.delInfo = t), (this.recover = n));
  }
  get deleted() {
    return (this.delInfo & Es) > 0;
  }
  get deletedBefore() {
    return (this.delInfo & (As | En)) > 0;
  }
  get deletedAfter() {
    return (this.delInfo & (Ns | En)) > 0;
  }
  get deletedAcross() {
    return (this.delInfo & En) > 0;
  }
}
class me {
  constructor(e, t = !1) {
    if (((this.ranges = e), (this.inverted = t), !e.length && me.empty)) return me.empty;
  }
  recover(e) {
    let t = 0,
      n = Ii(e);
    if (!this.inverted)
      for (let i = 0; i < n; i++) t += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
    return this.ranges[n * 3] + t + qa(e);
  }
  mapResult(e, t = 1) {
    return this._map(e, t, !1);
  }
  map(e, t = 1) {
    return this._map(e, t, !0);
  }
  _map(e, t, n) {
    let i = 0,
      o = this.inverted ? 2 : 1,
      s = this.inverted ? 1 : 2;
    for (let l = 0; l < this.ranges.length; l += 3) {
      let a = this.ranges[l] - (this.inverted ? i : 0);
      if (a > e) break;
      let c = this.ranges[l + o],
        u = this.ranges[l + s],
        f = a + c;
      if (e <= f) {
        let h = c ? (e == a ? -1 : e == f ? 1 : t) : t,
          d = a + i + (h < 0 ? 0 : u);
        if (n) return d;
        let p = e == (t < 0 ? a : f) ? null : Wa(l / 3, e - a),
          m = 0;
        return (
          c && ((m |= e == a ? Ns : e == f ? As : En), (t < 0 ? e != a : e != f) && (m |= Es)),
          new Nr(d, m, p)
        );
      }
      i += u - c;
    }
    return n ? e + i : new Nr(e + i, 0, null);
  }
  touches(e, t) {
    let n = 0,
      i = Ii(t),
      o = this.inverted ? 2 : 1,
      s = this.inverted ? 1 : 2;
    for (let l = 0; l < this.ranges.length; l += 3) {
      let a = this.ranges[l] - (this.inverted ? n : 0);
      if (a > e) break;
      let c = this.ranges[l + o],
        u = a + c;
      if (e <= u && l == i * 3) return !0;
      n += this.ranges[l + s] - c;
    }
    return !1;
  }
  forEach(e) {
    let t = this.inverted ? 2 : 1,
      n = this.inverted ? 1 : 2;
    for (let i = 0, o = 0; i < this.ranges.length; i += 3) {
      let s = this.ranges[i],
        l = s - (this.inverted ? o : 0),
        a = s + (this.inverted ? 0 : o),
        c = this.ranges[i + t],
        u = this.ranges[i + n];
      (e(l, l + c, a, a + u), (o += u - c));
    }
  }
  invert() {
    return new me(this.ranges, !this.inverted);
  }
  toString() {
    return (this.inverted ? '-' : '') + JSON.stringify(this.ranges);
  }
  static offset(e) {
    return e == 0 ? me.empty : new me(e < 0 ? [0, -e, 0] : [0, 0, e]);
  }
}
me.empty = new me([]);
class Qt {
  constructor(e, t, n = 0, i = e ? e.length : 0) {
    ((this.mirror = t),
      (this.from = n),
      (this.to = i),
      (this._maps = e || []),
      (this.ownData = !(e || t)));
  }
  get maps() {
    return this._maps;
  }
  slice(e = 0, t = this.maps.length) {
    return new Qt(this._maps, this.mirror, e, t);
  }
  appendMap(e, t) {
    (this.ownData ||
      ((this._maps = this._maps.slice()),
      (this.mirror = this.mirror && this.mirror.slice()),
      (this.ownData = !0)),
      (this.to = this._maps.push(e)),
      t != null && this.setMirror(this._maps.length - 1, t));
  }
  appendMapping(e) {
    for (let t = e.from, n = this._maps.length; t < e.to; t++) {
      let i = e.getMirror(t);
      (i != null && (i = i < t && i >= e.from ? n + (i - e.from) : void 0),
        this.appendMap(e._maps[t], i));
    }
  }
  getMirror(e) {
    if (this.mirror) {
      for (let t = 0; t < this.mirror.length; t++)
        if (this.mirror[t] == e) return this.mirror[t + (t % 2 ? -1 : 1)];
    }
  }
  setMirror(e, t) {
    (this.mirror || (this.mirror = []), this.mirror.push(e, t));
  }
  appendMappingInverted(e) {
    for (let t = e.to - 1, n = this._maps.length + e._maps.length; t >= e.from; t--) {
      let i = e.getMirror(t);
      (i != null && (i = i > t && i < e.to ? n - (i - e.from) - 1 : void 0),
        this.appendMap(e._maps[t].invert(), i));
    }
  }
  invert() {
    let e = new Qt();
    return (e.appendMappingInverted(this), e);
  }
  map(e, t = 1) {
    if (this.mirror) return this._map(e, t, !0);
    for (let n = this.from; n < this.to; n++) e = this._maps[n].map(e, t);
    return e;
  }
  mapResult(e, t = 1) {
    return this._map(e, t, !1);
  }
  _map(e, t, n) {
    let i = 0;
    for (let o = this.from; o < this.to; o++) {
      let s = this._maps[o],
        l = s.mapResult(e, t);
      if (l.recover != null) {
        let a = this.getMirror(o);
        if (a != null && a > o && a < this.to) {
          ((o = a), (e = this._maps[a].recover(l.recover)));
          continue;
        }
      }
      ((i |= l.delInfo), (e = l.pos));
    }
    return n ? e : new Nr(e, i, null);
  }
}
const sr = Object.create(null);
class K {
  getMap() {
    return me.empty;
  }
  merge(e) {
    return null;
  }
  static fromJSON(e, t) {
    if (!t || !t.stepType) throw new RangeError('Invalid input for Step.fromJSON');
    let n = sr[t.stepType];
    if (!n) throw new RangeError(`No step type ${t.stepType} defined`);
    return n.fromJSON(e, t);
  }
  static jsonID(e, t) {
    if (e in sr) throw new RangeError('Duplicate use of step JSON ID ' + e);
    return ((sr[e] = t), (t.prototype.jsonID = e), t);
  }
}
class J {
  constructor(e, t) {
    ((this.doc = e), (this.failed = t));
  }
  static ok(e) {
    return new J(e, null);
  }
  static fail(e) {
    return new J(null, e);
  }
  static fromReplace(e, t, n, i) {
    try {
      return J.ok(e.replace(t, n, i));
    } catch (o) {
      if (o instanceof jt) return J.fail(o.message);
      throw o;
    }
  }
}
function Qr(r, e, t) {
  let n = [];
  for (let i = 0; i < r.childCount; i++) {
    let o = r.child(i);
    (o.content.size && (o = o.copy(Qr(o.content, e, o))),
      o.isInline && (o = e(o, t, i)),
      n.push(o));
  }
  return k.fromArray(n);
}
class ve extends K {
  constructor(e, t, n) {
    (super(), (this.from = e), (this.to = t), (this.mark = n));
  }
  apply(e) {
    let t = e.slice(this.from, this.to),
      n = e.resolve(this.from),
      i = n.node(n.sharedDepth(this.to)),
      o = new S(
        Qr(
          t.content,
          (s, l) =>
            !s.isAtom || !l.type.allowsMarkType(this.mark.type)
              ? s
              : s.mark(this.mark.addToSet(s.marks)),
          i,
        ),
        t.openStart,
        t.openEnd,
      );
    return J.fromReplace(e, this.from, this.to, o);
  }
  invert(e) {
    let t = [];
    return (
      e.nodesBetween(this.from, this.to, (n, i) => {
        if (n.isInline && n.isAtom) {
          let o = this.mark.addToSet(n.marks);
          if (!P.sameSet(o, n.marks)) {
            let s = Math.max(this.from, i),
              l = Math.min(this.to, i + n.nodeSize);
            Pn(Ae, s, l, this.mark, t);
            for (let a of n.marks) a.isInSet(o) || Pn(ve, s, l, a, t);
          }
        }
      }),
      t.length == 1 ? t[0] : new rt(t)
    );
  }
  map(e) {
    let t = e.map(this.from, 1),
      n = e.map(this.to, -1);
    return t >= n ? null : new ve(t, n, this.mark);
  }
  merge(e) {
    return e instanceof ve && e.mark.eq(this.mark) && this.from <= e.to && this.to >= e.from
      ? new ve(Math.min(this.from, e.from), Math.max(this.to, e.to), this.mark)
      : null;
  }
  toJSON() {
    return { stepType: 'addMark', mark: this.mark.toJSON(), from: this.from, to: this.to };
  }
  static fromJSON(e, t) {
    if (typeof t.from != 'number' || typeof t.to != 'number')
      throw new RangeError('Invalid input for AddMarkStep.fromJSON');
    return new ve(t.from, t.to, e.markFromJSON(t.mark));
  }
}
K.jsonID('addMark', ve);
class Ae extends K {
  constructor(e, t, n) {
    (super(), (this.from = e), (this.to = t), (this.mark = n));
  }
  apply(e) {
    let t = e.slice(this.from, this.to),
      n = new S(
        Qr(t.content, (i) => i.mark(this.mark.removeFromSet(i.marks)), e),
        t.openStart,
        t.openEnd,
      );
    return J.fromReplace(e, this.from, this.to, n);
  }
  invert(e) {
    let t = [];
    return (
      e.nodesBetween(this.from, this.to, (n, i) => {
        n.isInline &&
          n.isAtom &&
          this.mark.isInSet(n.marks) &&
          Pn(ve, Math.max(this.from, i), Math.min(this.to, i + n.nodeSize), this.mark, t);
      }),
      t.length == 1 ? t[0] : new rt(t)
    );
  }
  map(e) {
    let t = e.map(this.from, 1),
      n = e.map(this.to, -1);
    return t >= n ? null : new Ae(t, n, this.mark);
  }
  merge(e) {
    return e instanceof Ae && e.mark.eq(this.mark) && this.from <= e.to && this.to >= e.from
      ? new Ae(Math.min(this.from, e.from), Math.max(this.to, e.to), this.mark)
      : null;
  }
  toJSON() {
    return { stepType: 'removeMark', mark: this.mark.toJSON(), from: this.from, to: this.to };
  }
  static fromJSON(e, t) {
    if (typeof t.from != 'number' || typeof t.to != 'number')
      throw new RangeError('Invalid input for RemoveMarkStep.fromJSON');
    return new Ae(t.from, t.to, e.markFromJSON(t.mark));
  }
}
K.jsonID('removeMark', Ae);
function Pn(r, e, t, n, i) {
  let o = i.length ? i[i.length - 1] : null;
  o && o instanceof r && o.to == e && o.mark.eq(n)
    ? (i[i.length - 1] = new r(o.from, t, n))
    : i.push(new r(e, t, n));
}
class rt extends K {
  constructor(e) {
    (super(), (this.steps = e));
  }
  apply(e) {
    for (let t of this.steps) {
      let n = t.apply(e);
      if (!n.doc) return n;
      e = n.doc;
    }
    return new J(e, null);
  }
  invert(e) {
    return new rt(this.steps.map((t) => t.invert(e)));
  }
  map(e) {
    let t = [];
    for (let n of this.steps) {
      let i = n.map(e);
      i && t.push(i);
    }
    return t.length ? new rt(t) : null;
  }
  toJSON() {
    return { stepType: 'markSet', steps: this.steps.map((e) => e.toJSON()) };
  }
  static fromJSON(e, t) {
    if (
      !Array.isArray(t.steps) ||
      !t.steps.every((n) => n.stepType == 'addMark' || n.stepType == 'removeMark')
    )
      throw new RangeError('Invalid JSON for MarkSetStep');
    return new rt(t.steps.map((n) => K.fromJSON(e, n)));
  }
}
K.jsonID('markSet', rt);
class qe extends K {
  constructor(e, t) {
    (super(), (this.pos = e), (this.mark = t));
  }
  apply(e) {
    let t = e.nodeAt(this.pos);
    if (!t) return J.fail("No node at mark step's position");
    let n = t.type.create(t.attrs, null, this.mark.addToSet(t.marks));
    return J.fromReplace(e, this.pos, this.pos + 1, new S(k.from(n), 0, t.isLeaf ? 0 : 1));
  }
  invert(e) {
    let t = e.nodeAt(this.pos);
    if (t) {
      let n = this.mark.addToSet(t.marks);
      if (n.length == t.marks.length) {
        for (let i = 0; i < t.marks.length; i++)
          if (!t.marks[i].isInSet(n)) return new qe(this.pos, t.marks[i]);
        return new qe(this.pos, this.mark);
      }
    }
    return new ct(this.pos, this.mark);
  }
  map(e) {
    let t = e.mapResult(this.pos, 1);
    return t.deletedAfter ? null : new qe(t.pos, this.mark);
  }
  toJSON() {
    return { stepType: 'addNodeMark', pos: this.pos, mark: this.mark.toJSON() };
  }
  static fromJSON(e, t) {
    if (typeof t.pos != 'number')
      throw new RangeError('Invalid input for AddNodeMarkStep.fromJSON');
    return new qe(t.pos, e.markFromJSON(t.mark));
  }
}
K.jsonID('addNodeMark', qe);
class ct extends K {
  constructor(e, t) {
    (super(), (this.pos = e), (this.mark = t));
  }
  apply(e) {
    let t = e.nodeAt(this.pos);
    if (!t) return J.fail("No node at mark step's position");
    let n = t.type.create(t.attrs, null, this.mark.removeFromSet(t.marks));
    return J.fromReplace(e, this.pos, this.pos + 1, new S(k.from(n), 0, t.isLeaf ? 0 : 1));
  }
  invert(e) {
    let t = e.nodeAt(this.pos);
    return !t || !this.mark.isInSet(t.marks) ? this : new qe(this.pos, this.mark);
  }
  map(e) {
    let t = e.mapResult(this.pos, 1);
    return t.deletedAfter ? null : new ct(t.pos, this.mark);
  }
  toJSON() {
    return { stepType: 'removeNodeMark', pos: this.pos, mark: this.mark.toJSON() };
  }
  static fromJSON(e, t) {
    if (typeof t.pos != 'number')
      throw new RangeError('Invalid input for RemoveNodeMarkStep.fromJSON');
    return new ct(t.pos, e.markFromJSON(t.mark));
  }
}
K.jsonID('removeNodeMark', ct);
class j extends K {
  constructor(e, t, n, i = !1) {
    (super(), (this.from = e), (this.to = t), (this.slice = n), (this.structure = i));
  }
  apply(e) {
    return this.structure && Er(e, this.from, this.to)
      ? J.fail('Structure replace would overwrite content')
      : J.fromReplace(e, this.from, this.to, this.slice);
  }
  getMap() {
    return new me([this.from, this.to - this.from, this.slice.size]);
  }
  invert(e) {
    return new j(this.from, this.from + this.slice.size, e.slice(this.from, this.to));
  }
  map(e) {
    let t = e.mapResult(this.to, -1),
      n = this.from == this.to && j.MAP_BIAS < 0 ? t : e.mapResult(this.from, 1);
    return n.deletedAcross && t.deletedAcross
      ? null
      : new j(n.pos, Math.max(n.pos, t.pos), this.slice, this.structure);
  }
  merge(e) {
    if (!(e instanceof j) || e.structure || this.structure) return null;
    if (this.from + this.slice.size == e.from && !this.slice.openEnd && !e.slice.openStart) {
      let t =
        this.slice.size + e.slice.size == 0
          ? S.empty
          : new S(
              this.slice.content.append(e.slice.content),
              this.slice.openStart,
              e.slice.openEnd,
            );
      return new j(this.from, this.to + (e.to - e.from), t, this.structure);
    } else if (e.to == this.from && !this.slice.openStart && !e.slice.openEnd) {
      let t =
        this.slice.size + e.slice.size == 0
          ? S.empty
          : new S(
              e.slice.content.append(this.slice.content),
              e.slice.openStart,
              this.slice.openEnd,
            );
      return new j(e.from, this.to, t, this.structure);
    } else return null;
  }
  toJSON() {
    let e = { stepType: 'replace', from: this.from, to: this.to };
    return (
      this.slice.size && (e.slice = this.slice.toJSON()),
      this.structure && (e.structure = !0),
      e
    );
  }
  static fromJSON(e, t) {
    if (typeof t.from != 'number' || typeof t.to != 'number')
      throw new RangeError('Invalid input for ReplaceStep.fromJSON');
    return new j(t.from, t.to, S.fromJSON(e, t.slice), !!t.structure);
  }
}
j.MAP_BIAS = 1;
K.jsonID('replace', j);
class ee extends K {
  constructor(e, t, n, i, o, s, l = !1) {
    (super(),
      (this.from = e),
      (this.to = t),
      (this.gapFrom = n),
      (this.gapTo = i),
      (this.slice = o),
      (this.insert = s),
      (this.structure = l));
  }
  apply(e) {
    if (this.structure && (Er(e, this.from, this.gapFrom) || Er(e, this.gapTo, this.to)))
      return J.fail('Structure gap-replace would overwrite content');
    let t = e.slice(this.gapFrom, this.gapTo);
    if (t.openStart || t.openEnd) return J.fail('Gap is not a flat range');
    let n = this.slice.insertAt(this.insert, t.content);
    return n ? J.fromReplace(e, this.from, this.to, n) : J.fail('Content does not fit in gap');
  }
  getMap() {
    return new me([
      this.from,
      this.gapFrom - this.from,
      this.insert,
      this.gapTo,
      this.to - this.gapTo,
      this.slice.size - this.insert,
    ]);
  }
  invert(e) {
    let t = this.gapTo - this.gapFrom;
    return new ee(
      this.from,
      this.from + this.slice.size + t,
      this.from + this.insert,
      this.from + this.insert + t,
      e.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from),
      this.gapFrom - this.from,
      this.structure,
    );
  }
  map(e) {
    let t = e.mapResult(this.from, 1),
      n = e.mapResult(this.to, -1),
      i = this.from == this.gapFrom ? t.pos : e.map(this.gapFrom, -1),
      o = this.to == this.gapTo ? n.pos : e.map(this.gapTo, 1);
    return (t.deletedAcross && n.deletedAcross) || i < t.pos || o > n.pos || i > o
      ? null
      : new ee(t.pos, n.pos, i, o, this.slice, this.insert, this.structure);
  }
  toJSON() {
    let e = {
      stepType: 'replaceAround',
      from: this.from,
      to: this.to,
      gapFrom: this.gapFrom,
      gapTo: this.gapTo,
      insert: this.insert,
    };
    return (
      this.slice.size && (e.slice = this.slice.toJSON()),
      this.structure && (e.structure = !0),
      e
    );
  }
  static fromJSON(e, t) {
    if (
      typeof t.from != 'number' ||
      typeof t.to != 'number' ||
      typeof t.gapFrom != 'number' ||
      typeof t.gapTo != 'number' ||
      typeof t.insert != 'number'
    )
      throw new RangeError('Invalid input for ReplaceAroundStep.fromJSON');
    return new ee(
      t.from,
      t.to,
      t.gapFrom,
      t.gapTo,
      S.fromJSON(e, t.slice),
      t.insert,
      !!t.structure,
    );
  }
}
K.jsonID('replaceAround', ee);
function Er(r, e, t) {
  let n = r.resolve(e),
    i = t - e,
    o = n.depth;
  for (; i > 0 && o > 0 && n.indexAfter(o) == n.node(o).childCount;) (o--, i--);
  if (i > 0) {
    let s = n.node(o).maybeChild(n.indexAfter(o));
    for (; i > 0;) {
      if (!s || s.isLeaf) return !0;
      ((s = s.firstChild), i--);
    }
  }
  return !1;
}
function Ja(r, e, t, n) {
  let i = [];
  (r.doc.nodesBetween(e, t, (o, s, l) => {
    if (!o.isInline) return;
    let a = o.marks;
    if (!n.isInSet(a) && l.type.allowsMarkType(n.type)) {
      let c = Math.max(s, e),
        u = Math.min(s + o.nodeSize, t);
      Pn(ve, c, u, n, i);
    }
  }),
    i.forEach((o) => r.step(o)));
}
function _a(r, e, t, n) {
  let i = [],
    o = 0;
  (r.doc.nodesBetween(e, t, (s, l) => {
    if (!s.isInline || !s.isAtom) return;
    o++;
    let a = null;
    if (n instanceof Gn) {
      let c = s.marks,
        u;
      for (; (u = n.isInSet(c));) ((a || (a = [])).push(u), (c = u.removeFromSet(c)));
    } else n ? n.isInSet(s.marks) && (a = [n]) : (a = s.marks);
    if (a && a.length) {
      let c = Math.min(l + s.nodeSize, t);
      for (let u = 0; u < a.length; u++) {
        let f = a[u],
          h;
        for (let d = 0; d < i.length; d++) {
          let p = i[d];
          p.step == o - 1 && f.eq(i[d].style) && (h = p);
        }
        h ? ((h.to = c), (h.step = o)) : i.push({ style: f, from: Math.max(l, e), to: c, step: o });
      }
    }
  }),
    i.forEach((s) => r.step(new Ae(s.from, s.to, s.style))));
}
function Zr(r, e, t, n = t.contentMatch, i = !0) {
  let o = r.doc.nodeAt(e),
    s = [],
    l = e + 1;
  for (let a = 0; a < o.childCount; a++) {
    let c = o.child(a),
      u = l + c.nodeSize,
      f = n.matchType(c.type);
    if (!f) s.push(new j(l, u, S.empty));
    else {
      n = f;
      for (let h = 0; h < c.marks.length; h++)
        t.allowsMarkType(c.marks[h].type) || r.step(new Ae(l, u, c.marks[h]));
      if (i && c.isText && t.whitespace != 'pre') {
        let h,
          d = /\r?\n|\r/g,
          p;
        for (; (h = d.exec(c.text));)
          (p || (p = new S(k.from(t.schema.text(' ', t.allowedMarks(c.marks))), 0, 0)),
            s.push(new j(l + h.index, l + h.index + h[0].length, p)));
      }
    }
    l = u;
  }
  if (!n.validEnd) {
    let a = n.fillBefore(k.empty, !0);
    r.replace(l, l, new S(a, 0, 0));
  }
  for (let a = s.length - 1; a >= 0; a--) r.step(s[a]);
}
function Ka(r, e, t) {
  return (e == 0 || r.canReplace(e, r.childCount)) && (t == r.childCount || r.canReplace(0, t));
}
function un(r) {
  let t = r.parent.content.cutByIndex(r.startIndex, r.endIndex);
  for (let n = r.depth, i = 0, o = 0; ; --n) {
    let s = r.$from.node(n),
      l = r.$from.index(n) + i,
      a = r.$to.indexAfter(n) - o;
    if (n < r.depth && s.canReplace(l, a, t)) return n;
    if (n == 0 || s.type.spec.isolating || !Ka(s, l, a)) break;
    (l && (i = 1), a < s.childCount && (o = 1));
  }
  return null;
}
function Ua(r, e, t) {
  let { $from: n, $to: i, depth: o } = e,
    s = n.before(o + 1),
    l = i.after(o + 1),
    a = s,
    c = l,
    u = k.empty,
    f = 0;
  for (let p = o, m = !1; p > t; p--)
    m || n.index(p) > 0 ? ((m = !0), (u = k.from(n.node(p).copy(u))), f++) : a--;
  let h = k.empty,
    d = 0;
  for (let p = o, m = !1; p > t; p--)
    m || i.after(p + 1) < i.end(p) ? ((m = !0), (h = k.from(i.node(p).copy(h))), d++) : c++;
  r.step(new ee(a, c, s, l, new S(u.append(h), f, d), u.size - f, !0));
}
function ei(r, e, t = null, n = r) {
  let i = ja(r, e),
    o = i && Ga(n, e);
  return o ? i.map(Li).concat({ type: e, attrs: t }).concat(o.map(Li)) : null;
}
function Li(r) {
  return { type: r, attrs: null };
}
function ja(r, e) {
  let { parent: t, startIndex: n, endIndex: i } = r,
    o = t.contentMatchAt(n).findWrapping(e);
  if (!o) return null;
  let s = o.length ? o[0] : e;
  return t.canReplaceWith(n, i, s) ? o : null;
}
function Ga(r, e) {
  let { parent: t, startIndex: n, endIndex: i } = r,
    o = t.child(n),
    s = e.contentMatch.findWrapping(o.type);
  if (!s) return null;
  let a = (s.length ? s[s.length - 1] : e).contentMatch;
  for (let c = n; a && c < i; c++) a = a.matchType(t.child(c).type);
  return !a || !a.validEnd ? null : s;
}
function Xa(r, e, t) {
  let n = k.empty;
  for (let s = t.length - 1; s >= 0; s--) {
    if (n.size) {
      let l = t[s].type.contentMatch.matchFragment(n);
      if (!l || !l.validEnd)
        throw new RangeError(
          'Wrapper type given to Transform.wrap does not form valid content of its parent wrapper',
        );
    }
    n = k.from(t[s].type.create(t[s].attrs, n));
  }
  let i = e.start,
    o = e.end;
  r.step(new ee(i, o, i, o, new S(n, 0, 0), t.length, !0));
}
function Ya(r, e, t, n, i) {
  if (!n.isTextblock) throw new RangeError('Type given to setBlockType should be a textblock');
  let o = r.steps.length;
  r.doc.nodesBetween(e, t, (s, l) => {
    let a = typeof i == 'function' ? i(s) : i;
    if (s.isTextblock && !s.hasMarkup(n, a) && Qa(r.doc, r.mapping.slice(o).map(l), n)) {
      let c = null;
      if (n.schema.linebreakReplacement) {
        let d = n.whitespace == 'pre',
          p = !!n.contentMatch.matchType(n.schema.linebreakReplacement);
        d && !p ? (c = !1) : !d && p && (c = !0);
      }
      (c === !1 && Os(r, s, l, o), Zr(r, r.mapping.slice(o).map(l, 1), n, void 0, c === null));
      let u = r.mapping.slice(o),
        f = u.map(l, 1),
        h = u.map(l + s.nodeSize, 1);
      return (
        r.step(new ee(f, h, f + 1, h - 1, new S(k.from(n.create(a, null, s.marks)), 0, 0), 1, !0)),
        c === !0 && Ts(r, s, l, o),
        !1
      );
    }
  });
}
function Ts(r, e, t, n) {
  e.forEach((i, o) => {
    if (i.isText) {
      let s,
        l = /\r?\n|\r/g;
      for (; (s = l.exec(i.text));) {
        let a = r.mapping.slice(n).map(t + 1 + o + s.index);
        r.replaceWith(a, a + 1, e.type.schema.linebreakReplacement.create());
      }
    }
  });
}
function Os(r, e, t, n) {
  e.forEach((i, o) => {
    if (i.type == i.type.schema.linebreakReplacement) {
      let s = r.mapping.slice(n).map(t + 1 + o);
      r.replaceWith(
        s,
        s + 1,
        e.type.schema.text(`
`),
      );
    }
  });
}
function Qa(r, e, t) {
  let n = r.resolve(e),
    i = n.index();
  return n.parent.canReplaceWith(i, i + 1, t);
}
function Za(r, e, t, n, i) {
  let o = r.doc.nodeAt(e);
  if (!o) throw new RangeError('No node at given position');
  t || (t = o.type);
  let s = t.create(n, null, i || o.marks);
  if (o.isLeaf) return r.replaceWith(e, e + o.nodeSize, s);
  if (!t.validContent(o.content)) throw new RangeError('Invalid content for node type ' + t.name);
  r.step(new ee(e, e + o.nodeSize, e + 1, e + o.nodeSize - 1, new S(k.from(s), 0, 0), 1, !0));
}
function Mt(r, e, t = 1, n) {
  let i = r.resolve(e),
    o = i.depth - t,
    s = (n && n[n.length - 1]) || i.parent;
  if (
    o < 0 ||
    i.parent.type.spec.isolating ||
    !i.parent.canReplace(i.index(), i.parent.childCount) ||
    !s.type.validContent(i.parent.content.cutByIndex(i.index(), i.parent.childCount))
  )
    return !1;
  for (let c = i.depth - 1, u = t - 2; c > o; c--, u--) {
    let f = i.node(c),
      h = i.index(c);
    if (f.type.spec.isolating) return !1;
    let d = f.content.cutByIndex(h, f.childCount),
      p = n && n[u + 1];
    p && (d = d.replaceChild(0, p.type.create(p.attrs)));
    let m = (n && n[u]) || f;
    if (!f.canReplace(h + 1, f.childCount) || !m.type.validContent(d)) return !1;
  }
  let l = i.indexAfter(o),
    a = n && n[0];
  return i.node(o).canReplaceWith(l, l, a ? a.type : i.node(o + 1).type);
}
function ec(r, e, t = 1, n) {
  let i = r.doc.resolve(e),
    o = k.empty,
    s = k.empty;
  for (let l = i.depth, a = i.depth - t, c = t - 1; l > a; l--, c--) {
    o = k.from(i.node(l).copy(o));
    let u = n && n[c];
    s = k.from(u ? u.type.create(u.attrs, s) : i.node(l).copy(s));
  }
  r.step(new j(e, e, new S(o.append(s), t, t), !0));
}
function Xn(r, e) {
  let t = r.resolve(e),
    n = t.index();
  return nc(t.nodeBefore, t.nodeAfter) && t.parent.canReplace(n, n + 1);
}
function tc(r, e) {
  e.content.size || r.type.compatibleContent(e.type);
  let t = r.contentMatchAt(r.childCount),
    { linebreakReplacement: n } = r.type.schema;
  for (let i = 0; i < e.childCount; i++) {
    let o = e.child(i),
      s = o.type == n ? r.type.schema.nodes.text : o.type;
    if (((t = t.matchType(s)), !t || !r.type.allowsMarks(o.marks))) return !1;
  }
  return t.validEnd;
}
function nc(r, e) {
  return !!(r && e && !r.isLeaf && tc(r, e));
}
function rc(r, e, t) {
  let n = null,
    { linebreakReplacement: i } = r.doc.type.schema,
    o = r.doc.resolve(e - t),
    s = o.node().type;
  if (i && s.inlineContent) {
    let u = s.whitespace == 'pre',
      f = !!s.contentMatch.matchType(i);
    u && !f ? (n = !1) : !u && f && (n = !0);
  }
  let l = r.steps.length;
  if (n === !1) {
    let u = r.doc.resolve(e + t);
    Os(r, u.node(), u.before(), l);
  }
  s.inlineContent && Zr(r, e + t - 1, s, o.node().contentMatchAt(o.index()), n == null);
  let a = r.mapping.slice(l),
    c = a.map(e - t);
  if ((r.step(new j(c, a.map(e + t, -1), S.empty, !0)), n === !0)) {
    let u = r.doc.resolve(c);
    Ts(r, u.node(), u.before(), r.steps.length);
  }
  return r;
}
function ic(r, e, t) {
  let n = r.resolve(e);
  if (n.parent.canReplaceWith(n.index(), n.index(), t)) return e;
  if (n.parentOffset == 0)
    for (let i = n.depth - 1; i >= 0; i--) {
      let o = n.index(i);
      if (n.node(i).canReplaceWith(o, o, t)) return n.before(i + 1);
      if (o > 0) return null;
    }
  if (n.parentOffset == n.parent.content.size)
    for (let i = n.depth - 1; i >= 0; i--) {
      let o = n.indexAfter(i);
      if (n.node(i).canReplaceWith(o, o, t)) return n.after(i + 1);
      if (o < n.node(i).childCount) return null;
    }
  return null;
}
function Ds(r, e, t) {
  let n = r.resolve(e);
  if (!t.content.size) return e;
  let i = t.content;
  for (let o = 0; o < t.openStart; o++) i = i.firstChild.content;
  for (let o = 1; o <= (t.openStart == 0 && t.size ? 2 : 1); o++)
    for (let s = n.depth; s >= 0; s--) {
      let l = s == n.depth ? 0 : n.pos <= (n.start(s + 1) + n.end(s + 1)) / 2 ? -1 : 1;
      for (let a = 0; a < 2; a++) {
        if (a) {
          if (!l) break;
          l = -l;
        }
        let c = n.index(s) + (l > 0 ? 1 : 0),
          u = n.node(s),
          f = !1;
        if (o == 1) f = u.canReplace(c, c, i);
        else {
          let h = u.contentMatchAt(c).findWrapping(i.firstChild.type);
          f = h && u.canReplaceWith(c, c, h[0]);
        }
        if (f) return l == 0 ? n.pos : l < 0 ? n.before(s + 1) : n.after(s + 1);
      }
    }
  return null;
}
function ti(r, e, t = e, n = S.empty) {
  if (e == t && !n.size) return null;
  let i = r.resolve(e),
    o = r.resolve(t);
  return Rs(i, o, n) ? new j(e, t, n) : new oc(i, o, n).fit();
}
function Rs(r, e, t) {
  return (
    !t.openStart &&
    !t.openEnd &&
    r.start() == e.start() &&
    r.parent.canReplace(r.index(), e.index(), t.content)
  );
}
class oc {
  constructor(e, t, n) {
    ((this.$from = e),
      (this.$to = t),
      (this.unplaced = n),
      (this.frontier = []),
      (this.placed = k.empty));
    for (let i = 0; i <= e.depth; i++) {
      let o = e.node(i);
      this.frontier.push({ type: o.type, match: o.contentMatchAt(e.indexAfter(i)) });
    }
    for (let i = e.depth; i > 0; i--) this.placed = k.from(e.node(i).copy(this.placed));
  }
  get depth() {
    return this.frontier.length - 1;
  }
  fit() {
    for (; this.unplaced.size;) {
      let c = this.findFittable();
      c ? this.placeNodes(c) : this.openMore() || this.dropNode();
    }
    let e = this.mustMoveInline(),
      t = this.placed.size - this.depth - this.$from.depth,
      n = this.$from,
      i = this.close(e < 0 ? this.$to : n.doc.resolve(e));
    if (!i) return null;
    let o = this.placed,
      s = n.depth,
      l = i.depth;
    for (; s && l && o.childCount == 1;) ((o = o.firstChild.content), s--, l--);
    let a = new S(o, s, l);
    return e > -1
      ? new ee(n.pos, e, this.$to.pos, this.$to.end(), a, t)
      : a.size || n.pos != this.$to.pos
        ? new j(n.pos, i.pos, a)
        : null;
  }
  findFittable() {
    let e = this.unplaced.openStart;
    for (let t = this.unplaced.content, n = 0, i = this.unplaced.openEnd; n < e; n++) {
      let o = t.firstChild;
      if ((t.childCount > 1 && (i = 0), o.type.spec.isolating && i <= n)) {
        e = n;
        break;
      }
      t = o.content;
    }
    for (let t = 1; t <= 2; t++)
      for (let n = t == 1 ? e : this.unplaced.openStart; n >= 0; n--) {
        let i,
          o = null;
        n
          ? ((o = zi(this.unplaced.content, n - 1).firstChild), (i = o.content))
          : (i = this.unplaced.content);
        let s = i.firstChild;
        for (let l = this.depth; l >= 0; l--) {
          let { type: a, match: c } = this.frontier[l],
            u,
            f = null;
          if (
            t == 1 &&
            (s
              ? c.matchType(s.type) || (f = c.fillBefore(k.from(s), !1))
              : o && a.compatibleContent(o.type))
          )
            return { sliceDepth: n, frontierDepth: l, parent: o, inject: f };
          if (t == 2 && s && (u = c.findWrapping(s.type)))
            return { sliceDepth: n, frontierDepth: l, parent: o, wrap: u };
          if (o && c.matchType(o.type)) break;
        }
      }
  }
  openMore() {
    let { content: e, openStart: t, openEnd: n } = this.unplaced;
    return Bi(e, -1) <= t
      ? !1
      : (this.unplaced.size > 1 && Bi(e, 1) > n && n++, (this.unplaced = new S(e, t + 1, n)), !0);
  }
  dropNode() {
    let { content: e, openStart: t, openEnd: n } = this.unplaced,
      i = zi(e, t);
    if (i.childCount <= 1 && t > 0) {
      let o = e.size - t <= t + i.size;
      this.unplaced = new S(Ht(e, t - 1, 1), t - 1, o ? t - 1 : n);
    } else this.unplaced = new S(Ht(e, t, 1), t, n);
  }
  placeNodes({ sliceDepth: e, frontierDepth: t, parent: n, inject: i, wrap: o }) {
    for (; this.depth > t;) this.closeFrontierNode();
    if (o) for (let m = 0; m < o.length; m++) this.openFrontierNode(o[m]);
    let s = this.unplaced,
      l = n ? n.content : s.content,
      a = s.openStart - e,
      c = 0,
      u = [],
      { match: f, type: h } = this.frontier[t];
    if (i) {
      for (let m = 0; m < i.childCount; m++) u.push(i.child(m));
      f = f.matchFragment(i);
    }
    let d = l.size + e - (s.content.size - s.openEnd);
    for (; c < l.childCount;) {
      let m = l.child(c),
        b = f.matchType(m.type);
      if (!b) break;
      (c++,
        (c > 1 || a == 0 || m.content.size) &&
          ((f = b),
          u.push(Is(m.mark(h.allowedMarks(m.marks)), c == 1 ? a : 0, c == l.childCount ? d : -1))));
    }
    let p = c == l.childCount;
    (p || (d = -1),
      (this.placed = Wt(this.placed, t, k.from(u))),
      (this.frontier[t].match = f),
      p &&
        d < 0 &&
        n &&
        n.type == this.frontier[this.depth].type &&
        this.frontier.length > 1 &&
        this.closeFrontierNode());
    for (let m = 0, b = u[u.length - 1]; b && m < d; m++)
      (this.frontier.push({ type: b.type, match: b.contentMatchAt(b.childCount) }),
        (b = b.lastChild));
    this.unplaced = p
      ? e == 0
        ? S.empty
        : new S(Ht(s.content, e - 1, 1), e - 1, d < 0 ? s.openEnd : e - 1)
      : new S(Ht(s.content, e, c), e, s.openEnd);
  }
  mustMoveInline() {
    if (!this.$to.parent.isTextblock) return -1;
    let e = this.frontier[this.depth],
      t;
    if (
      !e.type.isTextblock ||
      !lr(this.$to, this.$to.depth, e.type, e.match, !1) ||
      (this.$to.depth == this.depth && (t = this.findCloseLevel(this.$to)) && t.depth == this.depth)
    )
      return -1;
    let { depth: n } = this.$to,
      i = this.$to.after(n);
    for (; n > 1 && i == this.$to.end(--n);) ++i;
    return i;
  }
  findCloseLevel(e) {
    e: for (let t = Math.min(this.depth, e.depth); t >= 0; t--) {
      let { match: n, type: i } = this.frontier[t],
        o = t < e.depth && e.end(t + 1) == e.pos + (e.depth - (t + 1)),
        s = lr(e, t, i, n, o);
      if (s) {
        for (let l = t - 1; l >= 0; l--) {
          let { match: a, type: c } = this.frontier[l],
            u = lr(e, l, c, a, !0);
          if (!u || u.childCount) continue e;
        }
        return { depth: t, fit: s, move: o ? e.doc.resolve(e.after(t + 1)) : e };
      }
    }
  }
  close(e) {
    let t = this.findCloseLevel(e);
    if (!t) return null;
    for (; this.depth > t.depth;) this.closeFrontierNode();
    (t.fit.childCount && (this.placed = Wt(this.placed, t.depth, t.fit)), (e = t.move));
    for (let n = t.depth + 1; n <= e.depth; n++) {
      let i = e.node(n),
        o = i.type.contentMatch.fillBefore(i.content, !0, e.index(n));
      this.openFrontierNode(i.type, i.attrs, o);
    }
    return e;
  }
  openFrontierNode(e, t = null, n) {
    let i = this.frontier[this.depth];
    ((i.match = i.match.matchType(e)),
      (this.placed = Wt(this.placed, this.depth, k.from(e.create(t, n)))),
      this.frontier.push({ type: e, match: e.contentMatch }));
  }
  closeFrontierNode() {
    let t = this.frontier.pop().match.fillBefore(k.empty, !0);
    t.childCount && (this.placed = Wt(this.placed, this.frontier.length, t));
  }
}
function Ht(r, e, t) {
  return e == 0
    ? r.cutByIndex(t, r.childCount)
    : r.replaceChild(0, r.firstChild.copy(Ht(r.firstChild.content, e - 1, t)));
}
function Wt(r, e, t) {
  return e == 0
    ? r.append(t)
    : r.replaceChild(r.childCount - 1, r.lastChild.copy(Wt(r.lastChild.content, e - 1, t)));
}
function zi(r, e) {
  for (let t = 0; t < e; t++) r = r.firstChild.content;
  return r;
}
function Is(r, e, t) {
  if (e <= 0) return r;
  let n = r.content;
  return (
    e > 1 && (n = n.replaceChild(0, Is(n.firstChild, e - 1, n.childCount == 1 ? t - 1 : 0))),
    e > 0 &&
      ((n = r.type.contentMatch.fillBefore(n).append(n)),
      t <= 0 && (n = n.append(r.type.contentMatch.matchFragment(n).fillBefore(k.empty, !0)))),
    r.copy(n)
  );
}
function lr(r, e, t, n, i) {
  let o = r.node(e),
    s = i ? r.indexAfter(e) : r.index(e);
  if (s == o.childCount && !t.compatibleContent(o.type)) return null;
  let l = n.fillBefore(o.content, !0, s);
  return l && !sc(t, o.content, s) ? l : null;
}
function sc(r, e, t) {
  for (let n = t; n < e.childCount; n++) if (!r.allowsMarks(e.child(n).marks)) return !0;
  return !1;
}
function lc(r) {
  return r.spec.defining || r.spec.definingForContent;
}
function Bi(r, e) {
  for (let t = 0; ; t++) {
    let n = e < 0 ? r.firstChild : r.lastChild;
    if (!n || n.isAtom) return t;
    r = n.content;
  }
}
function ac(r, e, t, n) {
  if (!n.size) return r.deleteRange(e, t);
  let i = r.doc.resolve(e),
    o = r.doc.resolve(t);
  if (Rs(i, o, n)) return r.step(new j(e, t, n));
  let s = zs(i, o);
  s[s.length - 1] == 0 && s.pop();
  let l = -(i.depth + 1);
  s.unshift(l);
  for (let h = i.depth, d = i.pos - 1; h > 0; h--, d--) {
    let p = i.node(h).type.spec;
    if (p.defining || p.definingAsContext || p.isolating) break;
    s.indexOf(h) > -1 ? (l = h) : i.before(h) == d && s.splice(1, 0, -h);
  }
  let a = s.indexOf(l),
    c = [],
    u = n.openStart;
  for (let h = n.content, d = 0; ; d++) {
    let p = h.firstChild;
    if ((c.push(p), d == n.openStart)) break;
    h = p.content;
  }
  for (let h = u - 1; h >= 0; h--) {
    let d = c[h],
      p = lc(d.type);
    if (p && !d.sameMarkup(i.node(Math.abs(l) - 1))) u = h;
    else if (p || !d.type.isTextblock) break;
  }
  for (let h = n.openStart; h >= 0; h--) {
    let d = (h + u + 1) % (n.openStart + 1),
      p = c[d];
    if (p)
      for (let m = 0; m < s.length; m++) {
        let b = s[(m + a) % s.length],
          g = !0;
        b < 0 && ((g = !1), (b = -b));
        let y = i.node(b - 1),
          w = i.index(b - 1);
        if (y.canReplaceWith(w, w, p.type, p.marks))
          return r.replace(
            i.before(b),
            g ? o.after(b) : t,
            new S(Ls(n.content, 0, n.openStart, d), d, n.openEnd),
          );
      }
  }
  let f = r.steps.length;
  for (let h = s.length - 1; h >= 0 && (r.replace(e, t, n), !(r.steps.length > f)); h--) {
    let d = s[h];
    d < 0 || ((e = i.before(d)), (t = o.after(d)));
  }
}
function Ls(r, e, t, n, i) {
  if (e < t) {
    let o = r.firstChild;
    r = r.replaceChild(0, o.copy(Ls(o.content, e + 1, t, n, o)));
  }
  if (e > n) {
    let o = i.contentMatchAt(0),
      s = o.fillBefore(r).append(r);
    r = s.append(o.matchFragment(s).fillBefore(k.empty, !0));
  }
  return r;
}
function cc(r, e, t, n) {
  if (!n.isInline && e == t && r.doc.resolve(e).parent.content.size) {
    let i = ic(r.doc, e, n.type);
    i != null && (e = t = i);
  }
  r.replaceRange(e, t, new S(k.from(n), 0, 0));
}
function uc(r, e, t) {
  let n = r.doc.resolve(e),
    i = r.doc.resolve(t);
  if (
    n.parent.isTextblock &&
    i.parent.isTextblock &&
    n.start() != i.start() &&
    n.parentOffset == 0 &&
    i.parentOffset == 0
  ) {
    let s = n.sharedDepth(t),
      l = !1;
    for (let a = n.depth; a > s; a--) n.node(a).type.spec.isolating && (l = !0);
    for (let a = i.depth; a > s; a--) i.node(a).type.spec.isolating && (l = !0);
    if (!l) {
      for (let a = n.depth; a > 0 && e == n.start(a); a--) e = n.before(a);
      for (let a = i.depth; a > 0 && t == i.start(a); a--) t = i.before(a);
      ((n = r.doc.resolve(e)), (i = r.doc.resolve(t)));
    }
  }
  let o = zs(n, i);
  for (let s = 0; s < o.length; s++) {
    let l = o[s],
      a = s == o.length - 1;
    if ((a && l == 0) || n.node(l).type.contentMatch.validEnd)
      return r.delete(n.start(l), i.end(l));
    if (l > 0 && (a || n.node(l - 1).canReplace(n.index(l - 1), i.indexAfter(l - 1))))
      return r.delete(n.before(l), i.after(l));
  }
  for (let s = 1; s <= n.depth && s <= i.depth; s++)
    if (
      e - n.start(s) == n.depth - s &&
      t > n.end(s) &&
      i.end(s) - t != i.depth - s &&
      n.start(s - 1) == i.start(s - 1) &&
      n.node(s - 1).canReplace(n.index(s - 1), i.index(s - 1))
    )
      return r.delete(n.before(s), t);
  r.delete(e, t);
}
function zs(r, e) {
  let t = [],
    n = Math.min(r.depth, e.depth);
  for (let i = n; i >= 0; i--) {
    let o = r.start(i);
    if (
      o < r.pos - (r.depth - i) ||
      e.end(i) > e.pos + (e.depth - i) ||
      r.node(i).type.spec.isolating ||
      e.node(i).type.spec.isolating
    )
      break;
    (o == e.start(i) ||
      (i == r.depth &&
        i == e.depth &&
        r.parent.inlineContent &&
        e.parent.inlineContent &&
        i &&
        e.start(i - 1) == o - 1)) &&
      t.push(i);
  }
  return t;
}
class Ct extends K {
  constructor(e, t, n) {
    (super(), (this.pos = e), (this.attr = t), (this.value = n));
  }
  apply(e) {
    let t = e.nodeAt(this.pos);
    if (!t) return J.fail("No node at attribute step's position");
    let n = Object.create(null);
    for (let o in t.attrs) n[o] = t.attrs[o];
    n[this.attr] = this.value;
    let i = t.type.create(n, null, t.marks);
    return J.fromReplace(e, this.pos, this.pos + 1, new S(k.from(i), 0, t.isLeaf ? 0 : 1));
  }
  getMap() {
    return me.empty;
  }
  invert(e) {
    return new Ct(this.pos, this.attr, e.nodeAt(this.pos).attrs[this.attr]);
  }
  map(e) {
    let t = e.mapResult(this.pos, 1);
    return t.deletedAfter ? null : new Ct(t.pos, this.attr, this.value);
  }
  toJSON() {
    return { stepType: 'attr', pos: this.pos, attr: this.attr, value: this.value };
  }
  static fromJSON(e, t) {
    if (typeof t.pos != 'number' || typeof t.attr != 'string')
      throw new RangeError('Invalid input for AttrStep.fromJSON');
    return new Ct(t.pos, t.attr, t.value);
  }
}
K.jsonID('attr', Ct);
class Zt extends K {
  constructor(e, t) {
    (super(), (this.attr = e), (this.value = t));
  }
  apply(e) {
    let t = Object.create(null);
    for (let i in e.attrs) t[i] = e.attrs[i];
    t[this.attr] = this.value;
    let n = e.type.create(t, e.content, e.marks);
    return J.ok(n);
  }
  getMap() {
    return me.empty;
  }
  invert(e) {
    return new Zt(this.attr, e.attrs[this.attr]);
  }
  map(e) {
    return this;
  }
  toJSON() {
    return { stepType: 'docAttr', attr: this.attr, value: this.value };
  }
  static fromJSON(e, t) {
    if (typeof t.attr != 'string') throw new RangeError('Invalid input for DocAttrStep.fromJSON');
    return new Zt(t.attr, t.value);
  }
}
K.jsonID('docAttr', Zt);
let vt = class extends Error {};
vt = function r(e) {
  let t = Error.call(this, e);
  return ((t.__proto__ = r.prototype), t);
};
vt.prototype = Object.create(Error.prototype);
vt.prototype.constructor = vt;
vt.prototype.name = 'TransformError';
class Bs {
  constructor(e) {
    ((this.doc = e), (this.steps = []), (this.docs = []), (this.mapping = new Qt()));
  }
  get before() {
    return this.docs.length ? this.docs[0] : this.doc;
  }
  step(e) {
    let t = this.maybeStep(e);
    if (t.failed) throw new vt(t.failed);
    return this;
  }
  maybeStep(e) {
    let t = e.apply(this.doc);
    return (t.failed || this.addStep(e, t.doc), t);
  }
  get docChanged() {
    return this.steps.length > 0;
  }
  changedRange() {
    let e = 1e9,
      t = -1e9;
    for (let n = 0; n < this.mapping.maps.length; n++) {
      let i = this.mapping.maps[n];
      (n && ((e = i.map(e, 1)), (t = i.map(t, -1))),
        i.forEach((o, s, l, a) => {
          ((e = Math.min(e, l)), (t = Math.max(t, a)));
        }));
    }
    return e == 1e9 ? null : { from: e, to: t };
  }
  addStep(e, t) {
    (this.docs.push(this.doc),
      this.steps.push(e),
      this.mapping.appendMap(e.getMap()),
      (this.doc = t));
  }
  replace(e, t = e, n = S.empty) {
    let i = ti(this.doc, e, t, n);
    return (i && this.step(i), this);
  }
  replaceWith(e, t, n) {
    return this.replace(e, t, new S(k.from(n), 0, 0));
  }
  delete(e, t) {
    return this.replace(e, t, S.empty);
  }
  insert(e, t) {
    return this.replaceWith(e, e, t);
  }
  replaceRange(e, t, n) {
    return (ac(this, e, t, n), this);
  }
  replaceRangeWith(e, t, n) {
    return (cc(this, e, t, n), this);
  }
  deleteRange(e, t) {
    return (uc(this, e, t), this);
  }
  lift(e, t) {
    return (Ua(this, e, t), this);
  }
  join(e, t = 1) {
    return (rc(this, e, t), this);
  }
  wrap(e, t) {
    return (Xa(this, e, t), this);
  }
  setBlockType(e, t = e, n, i = null) {
    return (Ya(this, e, t, n, i), this);
  }
  setNodeMarkup(e, t, n = null, i) {
    return (Za(this, e, t, n, i), this);
  }
  setNodeAttribute(e, t, n) {
    return (this.step(new Ct(e, t, n)), this);
  }
  setDocAttribute(e, t) {
    return (this.step(new Zt(e, t)), this);
  }
  addNodeMark(e, t) {
    return (this.step(new qe(e, t)), this);
  }
  removeNodeMark(e, t) {
    let n = this.doc.nodeAt(e);
    if (!n) throw new RangeError('No node at position ' + e);
    if (t instanceof P) t.isInSet(n.marks) && this.step(new ct(e, t));
    else {
      let i = n.marks,
        o,
        s = [];
      for (; (o = t.isInSet(i));) (s.push(new ct(e, o)), (i = o.removeFromSet(i)));
      for (let l = s.length - 1; l >= 0; l--) this.step(s[l]);
    }
    return this;
  }
  split(e, t = 1, n) {
    return (ec(this, e, t, n), this);
  }
  addMark(e, t, n) {
    return (Ja(this, e, t, n), this);
  }
  removeMark(e, t, n) {
    return (_a(this, e, t, n), this);
  }
  clearIncompatible(e, t, n) {
    return (Zr(this, e, t, n), this);
  }
}
const ar = Object.create(null);
class I {
  constructor(e, t, n) {
    ((this.$anchor = e), (this.$head = t), (this.ranges = n || [new Ps(e.min(t), e.max(t))]));
  }
  get anchor() {
    return this.$anchor.pos;
  }
  get head() {
    return this.$head.pos;
  }
  get from() {
    return this.$from.pos;
  }
  get to() {
    return this.$to.pos;
  }
  get $from() {
    return this.ranges[0].$from;
  }
  get $to() {
    return this.ranges[0].$to;
  }
  get empty() {
    let e = this.ranges;
    for (let t = 0; t < e.length; t++) if (e[t].$from.pos != e[t].$to.pos) return !1;
    return !0;
  }
  content() {
    return this.$from.doc.slice(this.from, this.to, !0);
  }
  replace(e, t = S.empty) {
    let n = t.content.lastChild,
      i = null;
    for (let l = 0; l < t.openEnd; l++) ((i = n), (n = n.lastChild));
    let o = e.steps.length,
      s = this.ranges;
    for (let l = 0; l < s.length; l++) {
      let { $from: a, $to: c } = s[l],
        u = e.mapping.slice(o);
      (e.replaceRange(u.map(a.pos), u.map(c.pos), l ? S.empty : t),
        l == 0 && $i(e, o, (n ? n.isInline : i && i.isTextblock) ? -1 : 1));
    }
  }
  replaceWith(e, t) {
    let n = e.steps.length,
      i = this.ranges;
    for (let o = 0; o < i.length; o++) {
      let { $from: s, $to: l } = i[o],
        a = e.mapping.slice(n),
        c = a.map(s.pos),
        u = a.map(l.pos);
      o ? e.deleteRange(c, u) : (e.replaceRangeWith(c, u, t), $i(e, n, t.isInline ? -1 : 1));
    }
  }
  static findFrom(e, t, n = !1) {
    let i = e.parent.inlineContent ? new L(e) : bt(e.node(0), e.parent, e.pos, e.index(), t, n);
    if (i) return i;
    for (let o = e.depth - 1; o >= 0; o--) {
      let s =
        t < 0
          ? bt(e.node(0), e.node(o), e.before(o + 1), e.index(o), t, n)
          : bt(e.node(0), e.node(o), e.after(o + 1), e.index(o) + 1, t, n);
      if (s) return s;
    }
    return null;
  }
  static near(e, t = 1) {
    return this.findFrom(e, t) || this.findFrom(e, -t) || new he(e.node(0));
  }
  static atStart(e) {
    return bt(e, e, 0, 0, 1) || new he(e);
  }
  static atEnd(e) {
    return bt(e, e, e.content.size, e.childCount, -1) || new he(e);
  }
  static fromJSON(e, t) {
    if (!t || !t.type) throw new RangeError('Invalid input for Selection.fromJSON');
    let n = ar[t.type];
    if (!n) throw new RangeError(`No selection type ${t.type} defined`);
    return n.fromJSON(e, t);
  }
  static jsonID(e, t) {
    if (e in ar) throw new RangeError('Duplicate use of selection JSON ID ' + e);
    return ((ar[e] = t), (t.prototype.jsonID = e), t);
  }
  getBookmark() {
    return L.between(this.$anchor, this.$head).getBookmark();
  }
}
I.prototype.visible = !0;
class Ps {
  constructor(e, t) {
    ((this.$from = e), (this.$to = t));
  }
}
let Pi = !1;
function Fi(r) {
  !Pi &&
    !r.parent.inlineContent &&
    ((Pi = !0),
    console.warn(
      'TextSelection endpoint not pointing into a node with inline content (' +
        r.parent.type.name +
        ')',
    ));
}
class L extends I {
  constructor(e, t = e) {
    (Fi(e), Fi(t), super(e, t));
  }
  get $cursor() {
    return this.$anchor.pos == this.$head.pos ? this.$head : null;
  }
  map(e, t) {
    let n = e.resolve(t.map(this.head));
    if (!n.parent.inlineContent) return I.near(n);
    let i = e.resolve(t.map(this.anchor));
    return new L(i.parent.inlineContent ? i : n, n);
  }
  replace(e, t = S.empty) {
    if ((super.replace(e, t), t == S.empty)) {
      let n = this.$from.marksAcross(this.$to);
      n && e.ensureMarks(n);
    }
  }
  eq(e) {
    return e instanceof L && e.anchor == this.anchor && e.head == this.head;
  }
  getBookmark() {
    return new Yn(this.anchor, this.head);
  }
  toJSON() {
    return { type: 'text', anchor: this.anchor, head: this.head };
  }
  static fromJSON(e, t) {
    if (typeof t.anchor != 'number' || typeof t.head != 'number')
      throw new RangeError('Invalid input for TextSelection.fromJSON');
    return new L(e.resolve(t.anchor), e.resolve(t.head));
  }
  static create(e, t, n = t) {
    let i = e.resolve(t);
    return new this(i, n == t ? i : e.resolve(n));
  }
  static between(e, t, n) {
    let i = e.pos - t.pos;
    if (((!n || i) && (n = i >= 0 ? 1 : -1), !t.parent.inlineContent)) {
      let o = I.findFrom(t, n, !0) || I.findFrom(t, -n, !0);
      if (o) t = o.$head;
      else return I.near(t, n);
    }
    return (
      e.parent.inlineContent ||
        (i == 0
          ? (e = t)
          : ((e = (I.findFrom(e, -n, !0) || I.findFrom(e, n, !0)).$anchor),
            e.pos < t.pos != i < 0 && (e = t))),
      new L(e, t)
    );
  }
}
I.jsonID('text', L);
class Yn {
  constructor(e, t) {
    ((this.anchor = e), (this.head = t));
  }
  map(e) {
    return new Yn(e.map(this.anchor), e.map(this.head));
  }
  resolve(e) {
    return L.between(e.resolve(this.anchor), e.resolve(this.head));
  }
}
class E extends I {
  constructor(e) {
    let t = e.nodeAfter,
      n = e.node(0).resolve(e.pos + t.nodeSize);
    (super(e, n), (this.node = t));
  }
  map(e, t) {
    let { deleted: n, pos: i } = t.mapResult(this.anchor),
      o = e.resolve(i);
    return n ? I.near(o) : new E(o);
  }
  content() {
    return new S(k.from(this.node), 0, 0);
  }
  eq(e) {
    return e instanceof E && e.anchor == this.anchor;
  }
  toJSON() {
    return { type: 'node', anchor: this.anchor };
  }
  getBookmark() {
    return new ni(this.anchor);
  }
  static fromJSON(e, t) {
    if (typeof t.anchor != 'number')
      throw new RangeError('Invalid input for NodeSelection.fromJSON');
    return new E(e.resolve(t.anchor));
  }
  static create(e, t) {
    return new E(e.resolve(t));
  }
  static isSelectable(e) {
    return !e.isText && e.type.spec.selectable !== !1;
  }
}
E.prototype.visible = !1;
I.jsonID('node', E);
class ni {
  constructor(e) {
    this.anchor = e;
  }
  map(e) {
    let { deleted: t, pos: n } = e.mapResult(this.anchor);
    return t ? new Yn(n, n) : new ni(n);
  }
  resolve(e) {
    let t = e.resolve(this.anchor),
      n = t.nodeAfter;
    return n && E.isSelectable(n) ? new E(t) : I.near(t);
  }
}
class he extends I {
  constructor(e) {
    super(e.resolve(0), e.resolve(e.content.size));
  }
  replace(e, t = S.empty) {
    if (t == S.empty) {
      e.delete(0, e.doc.content.size);
      let n = I.atStart(e.doc);
      n.eq(e.selection) || e.setSelection(n);
    } else super.replace(e, t);
  }
  toJSON() {
    return { type: 'all' };
  }
  static fromJSON(e) {
    return new he(e);
  }
  map(e) {
    return new he(e);
  }
  eq(e) {
    return e instanceof he;
  }
  getBookmark() {
    return fc;
  }
}
I.jsonID('all', he);
const fc = {
  map() {
    return this;
  },
  resolve(r) {
    return new he(r);
  },
};
function bt(r, e, t, n, i, o = !1) {
  if (e.inlineContent) return L.create(r, t);
  for (let s = n - (i > 0 ? 0 : 1); i > 0 ? s < e.childCount : s >= 0; s += i) {
    let l = e.child(s);
    if (l.isAtom) {
      if (!o && E.isSelectable(l)) return E.create(r, t - (i < 0 ? l.nodeSize : 0));
    } else {
      let a = bt(r, l, t + i, i < 0 ? l.childCount : 0, i, o);
      if (a) return a;
    }
    t += l.nodeSize * i;
  }
  return null;
}
function $i(r, e, t) {
  let n = r.steps.length - 1;
  if (n < e) return;
  let i = r.steps[n];
  if (!(i instanceof j || i instanceof ee)) return;
  let o = r.mapping.maps[n],
    s;
  (o.forEach((l, a, c, u) => {
    s == null && (s = u);
  }),
    r.setSelection(I.near(r.doc.resolve(s), t)));
}
const Vi = 1,
  bn = 2,
  Hi = 4;
class hc extends Bs {
  constructor(e) {
    (super(e.doc),
      (this.curSelectionFor = 0),
      (this.updated = 0),
      (this.meta = Object.create(null)),
      (this.time = Date.now()),
      (this.curSelection = e.selection),
      (this.storedMarks = e.storedMarks));
  }
  get selection() {
    return (
      this.curSelectionFor < this.steps.length &&
        ((this.curSelection = this.curSelection.map(
          this.doc,
          this.mapping.slice(this.curSelectionFor),
        )),
        (this.curSelectionFor = this.steps.length)),
      this.curSelection
    );
  }
  setSelection(e) {
    if (e.$from.doc != this.doc)
      throw new RangeError('Selection passed to setSelection must point at the current document');
    return (
      (this.curSelection = e),
      (this.curSelectionFor = this.steps.length),
      (this.updated = (this.updated | Vi) & ~bn),
      (this.storedMarks = null),
      this
    );
  }
  get selectionSet() {
    return (this.updated & Vi) > 0;
  }
  setStoredMarks(e) {
    return ((this.storedMarks = e), (this.updated |= bn), this);
  }
  ensureMarks(e) {
    return (
      P.sameSet(this.storedMarks || this.selection.$from.marks(), e) || this.setStoredMarks(e),
      this
    );
  }
  addStoredMark(e) {
    return this.ensureMarks(e.addToSet(this.storedMarks || this.selection.$head.marks()));
  }
  removeStoredMark(e) {
    return this.ensureMarks(e.removeFromSet(this.storedMarks || this.selection.$head.marks()));
  }
  get storedMarksSet() {
    return (this.updated & bn) > 0;
  }
  addStep(e, t) {
    (super.addStep(e, t), (this.updated = this.updated & ~bn), (this.storedMarks = null));
  }
  setTime(e) {
    return ((this.time = e), this);
  }
  replaceSelection(e) {
    return (this.selection.replace(this, e), this);
  }
  replaceSelectionWith(e, t = !0) {
    let n = this.selection;
    return (
      t &&
        (e = e.mark(
          this.storedMarks || (n.empty ? n.$from.marks() : n.$from.marksAcross(n.$to) || P.none),
        )),
      n.replaceWith(this, e),
      this
    );
  }
  deleteSelection() {
    return (this.selection.replace(this), this);
  }
  insertText(e, t, n) {
    let i = this.doc.type.schema;
    if (t == null) return e ? this.replaceSelectionWith(i.text(e), !0) : this.deleteSelection();
    {
      if ((n == null && (n = t), !e)) return this.deleteRange(t, n);
      let o = this.storedMarks;
      if (!o) {
        let s = this.doc.resolve(t);
        o = n == t ? s.marks() : s.marksAcross(this.doc.resolve(n));
      }
      return (
        this.replaceRangeWith(t, n, i.text(e, o)),
        !this.selection.empty &&
          this.selection.to == t + e.length &&
          this.setSelection(I.near(this.selection.$to)),
        this
      );
    }
  }
  setMeta(e, t) {
    return ((this.meta[typeof e == 'string' ? e : e.key] = t), this);
  }
  getMeta(e) {
    return this.meta[typeof e == 'string' ? e : e.key];
  }
  get isGeneric() {
    for (let e in this.meta) return !1;
    return !0;
  }
  scrollIntoView() {
    return ((this.updated |= Hi), this);
  }
  get scrolledIntoView() {
    return (this.updated & Hi) > 0;
  }
}
function Wi(r, e) {
  return !e || !r ? r : r.bind(e);
}
class qt {
  constructor(e, t, n) {
    ((this.name = e), (this.init = Wi(t.init, n)), (this.apply = Wi(t.apply, n)));
  }
}
const dc = [
  new qt('doc', {
    init(r) {
      return r.doc || r.schema.topNodeType.createAndFill();
    },
    apply(r) {
      return r.doc;
    },
  }),
  new qt('selection', {
    init(r, e) {
      return r.selection || I.atStart(e.doc);
    },
    apply(r) {
      return r.selection;
    },
  }),
  new qt('storedMarks', {
    init(r) {
      return r.storedMarks || null;
    },
    apply(r, e, t, n) {
      return n.selection.$cursor ? r.storedMarks : null;
    },
  }),
  new qt('scrollToSelection', {
    init() {
      return 0;
    },
    apply(r, e) {
      return r.scrolledIntoView ? e + 1 : e;
    },
  }),
];
class cr {
  constructor(e, t) {
    ((this.schema = e),
      (this.plugins = []),
      (this.pluginsByKey = Object.create(null)),
      (this.fields = dc.slice()),
      t &&
        t.forEach((n) => {
          if (this.pluginsByKey[n.key])
            throw new RangeError('Adding different instances of a keyed plugin (' + n.key + ')');
          (this.plugins.push(n),
            (this.pluginsByKey[n.key] = n),
            n.spec.state && this.fields.push(new qt(n.key, n.spec.state, n)));
        }));
  }
}
class wt {
  constructor(e) {
    this.config = e;
  }
  get schema() {
    return this.config.schema;
  }
  get plugins() {
    return this.config.plugins;
  }
  apply(e) {
    return this.applyTransaction(e).state;
  }
  filterTransaction(e, t = -1) {
    for (let n = 0; n < this.config.plugins.length; n++)
      if (n != t) {
        let i = this.config.plugins[n];
        if (i.spec.filterTransaction && !i.spec.filterTransaction.call(i, e, this)) return !1;
      }
    return !0;
  }
  applyTransaction(e) {
    if (!this.filterTransaction(e)) return { state: this, transactions: [] };
    let t = [e],
      n = this.applyInner(e),
      i = null;
    for (;;) {
      let o = !1;
      for (let s = 0; s < this.config.plugins.length; s++) {
        let l = this.config.plugins[s];
        if (l.spec.appendTransaction) {
          let a = i ? i[s].n : 0,
            c = i ? i[s].state : this,
            u = a < t.length && l.spec.appendTransaction.call(l, a ? t.slice(a) : t, c, n);
          if (u && n.filterTransaction(u, s)) {
            if ((u.setMeta('appendedTransaction', e), !i)) {
              i = [];
              for (let f = 0; f < this.config.plugins.length; f++)
                i.push(f < s ? { state: n, n: t.length } : { state: this, n: 0 });
            }
            (t.push(u), (n = n.applyInner(u)), (o = !0));
          }
          i && (i[s] = { state: n, n: t.length });
        }
      }
      if (!o) return { state: n, transactions: t };
    }
  }
  applyInner(e) {
    if (!e.before.eq(this.doc)) throw new RangeError('Applying a mismatched transaction');
    let t = new wt(this.config),
      n = this.config.fields;
    for (let i = 0; i < n.length; i++) {
      let o = n[i];
      t[o.name] = o.apply(e, this[o.name], this, t);
    }
    return t;
  }
  get tr() {
    return new hc(this);
  }
  static create(e) {
    let t = new cr(e.doc ? e.doc.type.schema : e.schema, e.plugins),
      n = new wt(t);
    for (let i = 0; i < t.fields.length; i++) n[t.fields[i].name] = t.fields[i].init(e, n);
    return n;
  }
  reconfigure(e) {
    let t = new cr(this.schema, e.plugins),
      n = t.fields,
      i = new wt(t);
    for (let o = 0; o < n.length; o++) {
      let s = n[o].name;
      i[s] = this.hasOwnProperty(s) ? this[s] : n[o].init(e, i);
    }
    return i;
  }
  toJSON(e) {
    let t = { doc: this.doc.toJSON(), selection: this.selection.toJSON() };
    if (
      (this.storedMarks && (t.storedMarks = this.storedMarks.map((n) => n.toJSON())),
      e && typeof e == 'object')
    )
      for (let n in e) {
        if (n == 'doc' || n == 'selection')
          throw new RangeError('The JSON fields `doc` and `selection` are reserved');
        let i = e[n],
          o = i.spec.state;
        o && o.toJSON && (t[n] = o.toJSON.call(i, this[i.key]));
      }
    return t;
  }
  static fromJSON(e, t, n) {
    if (!t) throw new RangeError('Invalid input for EditorState.fromJSON');
    if (!e.schema) throw new RangeError("Required config field 'schema' missing");
    let i = new cr(e.schema, e.plugins),
      o = new wt(i);
    return (
      i.fields.forEach((s) => {
        if (s.name == 'doc') o.doc = _e.fromJSON(e.schema, t.doc);
        else if (s.name == 'selection') o.selection = I.fromJSON(o.doc, t.selection);
        else if (s.name == 'storedMarks')
          t.storedMarks && (o.storedMarks = t.storedMarks.map(e.schema.markFromJSON));
        else {
          if (n)
            for (let l in n) {
              let a = n[l],
                c = a.spec.state;
              if (
                a.key == s.name &&
                c &&
                c.fromJSON &&
                Object.prototype.hasOwnProperty.call(t, l)
              ) {
                o[s.name] = c.fromJSON.call(a, e, t[l], o);
                return;
              }
            }
          o[s.name] = s.init(e, o);
        }
      }),
      o
    );
  }
}
function Fs(r, e, t) {
  for (let n in r) {
    let i = r[n];
    (i instanceof Function ? (i = i.bind(e)) : n == 'handleDOMEvents' && (i = Fs(i, e, {})),
      (t[n] = i));
  }
  return t;
}
class pe {
  constructor(e) {
    ((this.spec = e),
      (this.props = {}),
      e.props && Fs(e.props, this, this.props),
      (this.key = e.key ? e.key.key : $s('plugin')));
  }
  getState(e) {
    return e[this.key];
  }
}
const ur = Object.create(null);
function $s(r) {
  return r in ur ? r + '$' + ++ur[r] : ((ur[r] = 0), r + '$');
}
class ye {
  constructor(e = 'key') {
    this.key = $s(e);
  }
  get(e) {
    return e.config.pluginsByKey[this.key];
  }
  getState(e) {
    return e[this.key];
  }
}
function pc(r = {}) {
  return new pe({
    view(e) {
      return new mc(e, r);
    },
  });
}
class mc {
  constructor(e, t) {
    var n;
    ((this.editorView = e),
      (this.cursorPos = null),
      (this.element = null),
      (this.timeout = -1),
      (this.lastDragEvent = null),
      (this.width = (n = t.width) !== null && n !== void 0 ? n : 1),
      (this.color = t.color === !1 ? void 0 : t.color || 'black'),
      (this.class = t.class),
      (this.handlers = ['dragover', 'dragend', 'drop', 'dragleave'].map((i) => {
        let o = (s) => {
          this[i](s);
        };
        return (e.dom.addEventListener(i, o), { name: i, handler: o });
      })));
  }
  destroy() {
    (this.setCursor(null),
      this.handlers.forEach(({ name: e, handler: t }) =>
        this.editorView.dom.removeEventListener(e, t),
      ));
  }
  update(e, t) {
    if (this.cursorPos != null && t.doc != e.state.doc)
      if (this.lastDragEvent) {
        let n = this.computeTarget(this.lastDragEvent);
        n == this.cursorPos ? this.updateOverlay() : this.setCursor(n);
      } else this.updateOverlay();
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
      i = this.editorView.dom,
      o = i.getBoundingClientRect(),
      s = o.width / i.offsetWidth,
      l = o.height / i.offsetHeight;
    if (t) {
      let f = e.nodeBefore,
        h = e.nodeAfter;
      if (f || h) {
        let d = this.editorView.nodeDOM(this.cursorPos - (f ? f.nodeSize : 0));
        if (d) {
          let p = d.getBoundingClientRect(),
            m = f ? p.bottom : p.top;
          f &&
            h &&
            (m = (m + this.editorView.nodeDOM(this.cursorPos).getBoundingClientRect().top) / 2);
          let b = (this.width / 2) * l;
          n = { left: p.left, right: p.right, top: m - b, bottom: m + b };
        }
      }
    }
    if (!n) {
      let f = this.editorView.coordsAtPos(this.cursorPos),
        h = (this.width / 2) * s;
      n = { left: f.left - h, right: f.left + h, top: f.top, bottom: f.bottom };
    }
    let a = this.editorView.dom.offsetParent;
    (this.element ||
      ((this.element = a.appendChild(document.createElement('div'))),
      this.class && (this.element.className = this.class),
      (this.element.style.cssText = 'position: absolute; z-index: 50; pointer-events: none;'),
      this.color && (this.element.style.backgroundColor = this.color)),
      this.element.classList.toggle('prosemirror-dropcursor-block', t),
      this.element.classList.toggle('prosemirror-dropcursor-inline', !t));
    let c, u;
    if (!a || (a == document.body && getComputedStyle(a).position == 'static'))
      ((c = -pageXOffset), (u = -pageYOffset));
    else {
      let f = a.getBoundingClientRect(),
        h = f.width / a.offsetWidth,
        d = f.height / a.offsetHeight;
      ((c = f.left - a.scrollLeft * h), (u = f.top - a.scrollTop * d));
    }
    ((this.element.style.left = (n.left - c) / s + 'px'),
      (this.element.style.top = (n.top - u) / l + 'px'),
      (this.element.style.width = (n.right - n.left) / s + 'px'),
      (this.element.style.height = (n.bottom - n.top) / l + 'px'));
  }
  scheduleRemoval(e) {
    (clearTimeout(this.timeout), (this.timeout = setTimeout(() => this.setCursor(null), e)));
  }
  computeTarget(e) {
    let t = this.editorView.posAtCoords({ left: e.clientX, top: e.clientY }),
      n = t && t.inside >= 0 && this.editorView.state.doc.nodeAt(t.inside),
      i = n && n.type.spec.disableDropCursor,
      o = typeof i == 'function' ? i(this.editorView, t, e) : i;
    if (!t || o) return null;
    let s = t.pos;
    if (this.editorView.dragging && this.editorView.dragging.slice) {
      let l = Ds(this.editorView.state.doc, s, this.editorView.dragging.slice);
      l != null && (s = l);
    }
    return s;
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
}
var Ge = {
    8: 'Backspace',
    9: 'Tab',
    10: 'Enter',
    12: 'NumLock',
    13: 'Enter',
    16: 'Shift',
    17: 'Control',
    18: 'Alt',
    20: 'CapsLock',
    27: 'Escape',
    32: ' ',
    33: 'PageUp',
    34: 'PageDown',
    35: 'End',
    36: 'Home',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    44: 'PrintScreen',
    45: 'Insert',
    46: 'Delete',
    59: ';',
    61: '=',
    91: 'Meta',
    92: 'Meta',
    106: '*',
    107: '+',
    108: ',',
    109: '-',
    110: '.',
    111: '/',
    144: 'NumLock',
    145: 'ScrollLock',
    160: 'Shift',
    161: 'Shift',
    162: 'Control',
    163: 'Control',
    164: 'Alt',
    165: 'Alt',
    173: '-',
    186: ';',
    187: '=',
    188: ',',
    189: '-',
    190: '.',
    191: '/',
    192: '`',
    219: '[',
    220: '\\',
    221: ']',
    222: "'",
  },
  Fn = {
    48: ')',
    49: '!',
    50: '@',
    51: '#',
    52: '$',
    53: '%',
    54: '^',
    55: '&',
    56: '*',
    57: '(',
    59: ':',
    61: '+',
    173: '_',
    186: ':',
    187: '+',
    188: '<',
    189: '_',
    190: '>',
    191: '?',
    192: '~',
    219: '{',
    220: '|',
    221: '}',
    222: '"',
  },
  gc = typeof navigator < 'u' && /Mac/.test(navigator.platform),
  bc =
    typeof navigator < 'u' &&
    /MSIE \d|Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);
for (var Q = 0; Q < 10; Q++) Ge[48 + Q] = Ge[96 + Q] = String(Q);
for (var Q = 1; Q <= 24; Q++) Ge[Q + 111] = 'F' + Q;
for (var Q = 65; Q <= 90; Q++)
  ((Ge[Q] = String.fromCharCode(Q + 32)), (Fn[Q] = String.fromCharCode(Q)));
for (var fr in Ge) Fn.hasOwnProperty(fr) || (Fn[fr] = Ge[fr]);
function yc(r) {
  var e =
      (gc && r.metaKey && r.shiftKey && !r.ctrlKey && !r.altKey) ||
      (bc && r.shiftKey && r.key && r.key.length == 1) ||
      r.key == 'Unidentified',
    t = (!e && r.key) || (r.shiftKey ? Fn : Ge)[r.keyCode] || r.key || 'Unidentified';
  return (
    t == 'Esc' && (t = 'Escape'),
    t == 'Del' && (t = 'Delete'),
    t == 'Left' && (t = 'ArrowLeft'),
    t == 'Up' && (t = 'ArrowUp'),
    t == 'Right' && (t = 'ArrowRight'),
    t == 'Down' && (t = 'ArrowDown'),
    t
  );
}
const wc = typeof navigator < 'u' && /Mac|iP(hone|[oa]d)/.test(navigator.platform),
  kc = typeof navigator < 'u' && /Win/.test(navigator.platform);
function xc(r) {
  let e = r.split(/-(?!$)/),
    t = e[e.length - 1];
  t == 'Space' && (t = ' ');
  let n, i, o, s;
  for (let l = 0; l < e.length - 1; l++) {
    let a = e[l];
    if (/^(cmd|meta|m)$/i.test(a)) s = !0;
    else if (/^a(lt)?$/i.test(a)) n = !0;
    else if (/^(c|ctrl|control)$/i.test(a)) i = !0;
    else if (/^s(hift)?$/i.test(a)) o = !0;
    else if (/^mod$/i.test(a)) wc ? (s = !0) : (i = !0);
    else throw new Error('Unrecognized modifier name: ' + a);
  }
  return (
    n && (t = 'Alt-' + t),
    i && (t = 'Ctrl-' + t),
    s && (t = 'Meta-' + t),
    o && (t = 'Shift-' + t),
    t
  );
}
function Mc(r) {
  let e = Object.create(null);
  for (let t in r) e[xc(t)] = r[t];
  return e;
}
function hr(r, e, t = !0) {
  return (
    e.altKey && (r = 'Alt-' + r),
    e.ctrlKey && (r = 'Ctrl-' + r),
    e.metaKey && (r = 'Meta-' + r),
    t && e.shiftKey && (r = 'Shift-' + r),
    r
  );
}
function $n(r) {
  return new pe({ props: { handleKeyDown: ri(r) } });
}
function ri(r) {
  let e = Mc(r);
  return function (t, n) {
    let i = yc(n),
      o,
      s = e[hr(i, n)];
    if (s && s(t.state, t.dispatch, t)) return !0;
    if (i.length == 1 && i != ' ') {
      if (n.shiftKey) {
        let l = e[hr(i, n, !1)];
        if (l && l(t.state, t.dispatch, t)) return !0;
      }
      if (
        (n.altKey || n.metaKey || n.ctrlKey) &&
        !(kc && n.ctrlKey && n.altKey) &&
        (o = Ge[n.keyCode]) &&
        o != i
      ) {
        let l = e[hr(o, n)];
        if (l && l(t.state, t.dispatch, t)) return !0;
      }
    }
    return !1;
  };
}
const se = function (r) {
  for (var e = 0; ; e++) if (((r = r.previousSibling), !r)) return e;
};
function At(r) {
  let e = r.assignedSlot || r.parentNode;
  return e && e.nodeType == 11 ? e.host : e;
}
let Tr = null;
function Re(r, e, t) {
  let n = Tr || (Tr = document.createRange());
  return (n.setEnd(r, t ?? r.nodeValue.length), n.setStart(r, e || 0), n);
}
function Cc() {
  Tr = null;
}
function Vn(r, e, t, n) {
  return t && (Ji(r, e, t, n, -1) || Ji(r, e, t, n, 1));
}
const qi = /^(img|br|input|textarea|hr)$/i;
function Ji(r, e, t, n, i) {
  for (var o; ;) {
    if (r == t && e == n) return !0;
    if (e == (i < 0 ? 0 : re(r))) {
      let s = r.parentNode;
      if (!s || !T(s) || Hn(r) || qi.test(r.nodeName) || r.contentEditable == 'false') return !1;
      ((e = se(r) + (i < 0 ? 0 : 1)), (r = s));
    } else if (T(r)) {
      let s = r.childNodes[e + (i < 0 ? -1 : 0)];
      if (T(s) && s.contentEditable == 'false')
        if (!((o = s.pmViewDesc) === null || o === void 0) && o.ignoreForSelection) e += i;
        else return !1;
      else {
        if (Hn(s) || qi.test(s.nodeName)) return !1;
        ((r = s), (e = i < 0 ? re(r) : 0));
      }
    } else return !1;
  }
}
function re(r) {
  return r.nodeType == 3 ? r.nodeValue.length : r.childNodes.length;
}
function T(r) {
  return r.nodeType == 1;
}
function Z(r) {
  return r.nodeType == 3;
}
function Nt(r, e) {
  return e ? r.contains(T(e) ? e : e.parentNode) : !1;
}
function Vs(r, e) {
  for (;;) {
    if (Z(r) && e) return r;
    if (T(r) && e > 0) {
      if (r.contentEditable == 'false') return null;
      ((r = r.childNodes[e - 1]), (e = re(r)));
    } else if (r.parentNode && !Hn(r, !0)) ((e = se(r)), (r = r.parentNode));
    else return null;
  }
}
function Hs(r, e) {
  for (;;) {
    if (Z(r) && e < r.nodeValue.length) return r;
    if (T(r) && e < r.childNodes.length) {
      if (r.contentEditable == 'false') return null;
      ((r = r.childNodes[e]), (e = 0));
    } else if (r.parentNode && !Hn(r, !0)) ((e = se(r) + 1), (r = r.parentNode));
    else return null;
  }
}
function Sc(r, e, t) {
  for (let n = e == 0, i = e == re(r); n || i;) {
    if (r == t) return !0;
    let o = se(r);
    if (((r = r.parentNode), !r)) return !1;
    ((n = n && o == 0), (i = i && o == re(r)));
  }
}
function Hn(r, e = !1) {
  let t;
  for (let n = r; n && !(t = n.pmViewDesc); n = n.parentNode);
  return t && t.node && (!e || t.node.isBlock) && (t.dom == r || t.contentDOM == r);
}
function Qn(r) {
  return r.focusNode && Vn(r.focusNode, r.focusOffset, r.anchorNode, r.anchorOffset);
}
function Ws(r, e) {
  (r.collapse(e.anchorNode, e.anchorOffset),
    (e.focusNode != e.anchorNode || e.focusOffset != e.anchorOffset) &&
      r.extend(e.focusNode, e.focusOffset));
}
function vc(r, e) {
  let t = document.createEvent('Event');
  return (t.initEvent('keydown', !0, !0), (t.keyCode = r), (t.key = t.code = e), t);
}
function Ac(r) {
  let e = r.activeElement;
  for (; e && e.shadowRoot;) e = e.shadowRoot.activeElement;
  return e;
}
function Nc(r, e, t) {
  if (r.caretPositionFromPoint)
    try {
      let n = r.caretPositionFromPoint(e, t);
      if (n) return { node: n.offsetNode, offset: Math.min(re(n.offsetNode), n.offset) };
    } catch {}
  if (r.caretRangeFromPoint) {
    let n = r.caretRangeFromPoint(e, t);
    if (n) return { node: n.startContainer, offset: Math.min(re(n.startContainer), n.startOffset) };
  }
}
const Ne = typeof navigator < 'u' ? navigator : null,
  _i = typeof document < 'u' ? document : null,
  Et = (Ne && Ne.userAgent) || '',
  Me = /gecko\/(\d+)/i.test(Et) && !/edge?\//i.test(Et);
Me && +(/Firefox\/(\d+)/.exec(Et) || [0, 0])[1];
const Or = /Chrome\/(\d+)/.exec(Et),
  le = !!Or,
  qs = Or ? +Or[1] : 0,
  ae = !!Ne && /Apple Computer/.test(Ne.vendor),
  Tt = ae && (/Mobile\/\w+/.test(Et) || (!!Ne && Ne.maxTouchPoints > 2)),
  be = Tt || (Ne ? /Mac/.test(Ne.platform) : !1),
  Js = Ne ? /Win/.test(Ne.platform) : !1,
  Le = /Android \d/.test(Et),
  Zn = !!_i && 'webkitFontSmoothing' in _i.documentElement.style,
  Ec = Zn ? +(/\bAppleWebKit\/(\d+)/.exec(navigator.userAgent) || [0, 0])[1] : 0;
function Tc(r) {
  let e = r.defaultView && r.defaultView.visualViewport;
  return e
    ? { left: 0, right: e.width, top: 0, bottom: e.height }
    : {
        left: 0,
        right: r.documentElement.clientWidth,
        top: 0,
        bottom: r.documentElement.clientHeight,
      };
}
function Te(r, e) {
  return typeof r == 'number' ? r : r[e];
}
function Oc(r) {
  let e = r.getBoundingClientRect(),
    t = e.width / r.offsetWidth || 1,
    n = e.height / r.offsetHeight || 1;
  return {
    left: e.left,
    right: e.left + r.clientWidth * t,
    top: e.top,
    bottom: e.top + r.clientHeight * n,
  };
}
function Ki(r, e, t) {
  if (!Dr(e) && e.left == 0) return;
  let n = r.someProp('scrollThreshold') || 0,
    i = r.someProp('scrollMargin') || 5,
    o = r.dom.ownerDocument;
  for (let s = t || r.dom; s;) {
    if (!T(s)) {
      s = At(s);
      continue;
    }
    let l = s == o.body,
      a = l ? Tc(o) : Oc(s),
      c = 0,
      u = 0;
    if (
      (e.top < a.top + Te(n, 'top')
        ? (u = -(a.top - e.top + Te(i, 'top')))
        : e.bottom > a.bottom - Te(n, 'bottom') &&
          (u =
            e.bottom - e.top > a.bottom - a.top
              ? e.top + Te(i, 'top') - a.top
              : e.bottom - a.bottom + Te(i, 'bottom')),
      e.left < a.left + Te(n, 'left')
        ? (c = -(a.left - e.left + Te(i, 'left')))
        : e.right > a.right - Te(n, 'right') && (c = e.right - a.right + Te(i, 'right')),
      c || u)
    )
      if (l) o.defaultView.scrollBy(c, u);
      else {
        let h = s.scrollLeft,
          d = s.scrollTop;
        (u && (s.scrollTop += u), c && (s.scrollLeft += c));
        let p = s.scrollLeft - h,
          m = s.scrollTop - d;
        e = { left: e.left - p, top: e.top - m, right: e.right - p, bottom: e.bottom - m };
      }
    let f = l ? 'fixed' : getComputedStyle(s).position;
    if (/^(fixed|sticky)$/.test(f)) break;
    s = f == 'absolute' ? s.offsetParent : At(s);
  }
}
function Dc(r) {
  let e = r.dom.getBoundingClientRect(),
    t = Math.max(0, e.top),
    n,
    i;
  for (let o = (e.left + e.right) / 2, s = t + 1; s < Math.min(innerHeight, e.bottom); s += 5) {
    let l = r.root.elementFromPoint(o, s);
    if (!l || l == r.dom || !r.dom.contains(l)) continue;
    let a = l.getBoundingClientRect();
    if (a.top >= t - 20) {
      ((n = l), (i = a.top));
      break;
    }
  }
  return { refDOM: n, refTop: i, stack: _s(r.dom) };
}
function _s(r) {
  let e = [],
    t = r.ownerDocument;
  for (
    let n = r;
    n && (e.push({ dom: n, top: n.scrollTop, left: n.scrollLeft }), r != t);
    n = At(n)
  );
  return e;
}
function Rc({ refDOM: r, refTop: e, stack: t }) {
  let n = r ? r.getBoundingClientRect().top : 0;
  Ks(t, n == 0 ? 0 : n - e);
}
function Ks(r, e) {
  for (let t = 0; t < r.length; t++) {
    let { dom: n, top: i, left: o } = r[t];
    (n.scrollTop != i + e && (n.scrollTop = i + e), n.scrollLeft != o && (n.scrollLeft = o));
  }
}
let dt = null;
function Us(r) {
  if (r.setActive) return r.setActive();
  if (dt) return r.focus(dt);
  let e = _s(r);
  (r.focus(
    dt == null
      ? {
          get preventScroll() {
            return ((dt = { preventScroll: !0 }), !0);
          },
        }
      : void 0,
  ),
    dt || ((dt = !1), Ks(e, 0)));
}
function js(r, e) {
  let t,
    n = 2e8,
    i,
    o = 0,
    s = e.top,
    l = e.top,
    a,
    c;
  for (let u = r.firstChild, f = 0; u; u = u.nextSibling, f++) {
    let h;
    if (T(u)) h = u.getClientRects();
    else if (Z(u)) h = Re(u).getClientRects();
    else continue;
    for (let d = 0; d < h.length; d++) {
      let p = h[d];
      if (p.top <= s && p.bottom >= l) {
        ((s = Math.max(p.bottom, s)), (l = Math.min(p.top, l)));
        let m = p.left > e.left ? p.left - e.left : p.right < e.left ? e.left - p.right : 0;
        if (m < n) {
          ((t = u),
            (n = m),
            (i = m && Z(t) ? { left: p.right < e.left ? p.right : p.left, top: e.top } : e),
            T(u) && m && (o = f + (e.left >= (p.left + p.right) / 2 ? 1 : 0)));
          continue;
        }
      } else
        p.top > e.top &&
          !a &&
          p.left <= e.left &&
          p.right >= e.left &&
          ((a = u), (c = { left: Math.max(p.left, Math.min(p.right, e.left)), top: p.top }));
      !t &&
        ((e.left >= p.right && e.top >= p.top) || (e.left >= p.left && e.top >= p.bottom)) &&
        (o = f + 1);
    }
  }
  return (
    !t && a && ((t = a), (i = c), (n = 0)),
    t && Z(t) ? Ic(t, i) : !t || n ? { node: r, offset: o } : js(t, i)
  );
}
function Ic(r, e) {
  let t = r.nodeValue.length,
    n = document.createRange(),
    i;
  for (let o = 0; o < t; o++) {
    (n.setEnd(r, o + 1), n.setStart(r, o));
    let s = Pe(n, 1);
    if (s.top != s.bottom && ii(e, s)) {
      i = { node: r, offset: o + (e.left >= (s.left + s.right) / 2 ? 1 : 0) };
      break;
    }
  }
  return (n.detach(), i || { node: r, offset: 0 });
}
function ii(r, e) {
  return (
    r.left >= e.left - 1 && r.left <= e.right + 1 && r.top >= e.top - 1 && r.top <= e.bottom + 1
  );
}
function Lc(r, e) {
  let t = r.parentNode;
  return t && /^li$/i.test(t.nodeName) && e.left < r.getBoundingClientRect().left ? t : r;
}
function zc(r, e, t) {
  let { node: n, offset: i } = js(e, t),
    o = -1;
  if (T(n) && !n.firstChild) {
    let s = n.getBoundingClientRect();
    o = s.left != s.right && t.left > (s.left + s.right) / 2 ? 1 : -1;
  }
  return r.docView.posFromDOM(n, i, o);
}
function Bc(r, e, t, n) {
  let i = -1;
  for (let o = e, s = !1; o != r.dom;) {
    let l = r.docView.nearestDesc(o, !0),
      a;
    if (!l) return null;
    if (
      T(l.dom) &&
      ((l.node.isBlock && l.parent) || !l.contentDOM) &&
      ((a = l.dom.getBoundingClientRect()).width || a.height) &&
      (l.node.isBlock &&
        l.parent &&
        !/^T(R|BODY|HEAD|FOOT)$/.test(l.dom.nodeName) &&
        ((!s && a.left > n.left) || a.top > n.top
          ? (i = l.posBefore)
          : ((!s && a.right < n.left) || a.bottom < n.top) && (i = l.posAfter),
        (s = !0)),
      !l.contentDOM && i < 0 && !l.node.isText)
    )
      return (l.node.isBlock ? n.top < (a.top + a.bottom) / 2 : n.left < (a.left + a.right) / 2)
        ? l.posBefore
        : l.posAfter;
    o = l.dom.parentNode;
  }
  return i > -1 ? i : r.docView.posFromDOM(e, t, -1);
}
function Gs(r, e, t) {
  let n = r.childNodes.length;
  if (n && t.top < t.bottom)
    for (
      let i = Math.max(
          0,
          Math.min(n - 1, Math.floor((n * (e.top - t.top)) / (t.bottom - t.top)) - 2),
        ),
        o = i;
      ;
    ) {
      let s = r.childNodes[o];
      if (T(s)) {
        let l = s.getClientRects();
        for (let a = 0; a < l.length; a++) {
          let c = l[a];
          if (ii(e, c)) return Gs(s, e, c);
        }
      }
      if ((o = (o + 1) % n) == i) break;
    }
  return r;
}
function Pc(r, e) {
  let t = r.dom.ownerDocument,
    n,
    i = 0,
    o = Nc(t, e.left, e.top);
  o && ({ node: n, offset: i } = o);
  let s = (r.root.elementFromPoint ? r.root : t).elementFromPoint(e.left, e.top),
    l;
  if (!s || !r.dom.contains(s)) {
    let c = r.dom.getBoundingClientRect();
    if (!ii(e, c) || ((s = Gs(r.dom, e, c)), !s)) return null;
  }
  if (ae) for (let c = s; n && c; c = At(c)) c.draggable && (n = void 0);
  if (((s = Lc(s, e)), n)) {
    if (Me && T(n) && ((i = Math.min(i, n.childNodes.length)), i < n.childNodes.length)) {
      let u = n.childNodes[i],
        f;
      u.nodeName == 'IMG' &&
        (f = u.getBoundingClientRect()).right <= e.left &&
        f.bottom > e.top &&
        i++;
    }
    let c;
    (Zn &&
      i &&
      T(n) &&
      T((c = n.childNodes[i - 1])) &&
      c.contentEditable == 'false' &&
      c.getBoundingClientRect().top >= e.top &&
      i--,
      n == r.dom &&
      i == n.childNodes.length - 1 &&
      T(n.lastChild) &&
      e.top > n.lastChild.getBoundingClientRect().bottom
        ? (l = r.state.doc.content.size)
        : (i == 0 || !T(n) || n.childNodes[i - 1].nodeName != 'BR') && (l = Bc(r, n, i, e)));
  }
  l == null && (l = zc(r, s, e));
  let a = r.docView.nearestDesc(s, !0);
  return { pos: l, inside: a ? a.posAtStart - a.border : -1 };
}
function Dr(r) {
  return r.top < r.bottom || r.left < r.right;
}
function Pe(r, e) {
  let t = r.getClientRects();
  if (t.length) {
    let n = t[e < 0 ? 0 : t.length - 1];
    if (Dr(n)) return n;
  }
  return Array.prototype.find.call(t, Dr) || r.getBoundingClientRect();
}
const Fc = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
function Xs(r, e, t) {
  let { node: n, offset: i, atom: o } = r.docView.domFromPos(e, t < 0 ? -1 : 1),
    s = Zn || Me;
  if (Z(n))
    if (s && (Fc.test(n.nodeValue) || (t < 0 ? !i : i == n.nodeValue.length))) {
      let a = Pe(Re(n, i, i), t);
      if (Me && i && /\s/.test(n.nodeValue[i - 1]) && i < n.nodeValue.length) {
        let c = Pe(Re(n, i - 1, i - 1), -1);
        if (c.top == a.top) {
          let u = Pe(Re(n, i, i + 1), -1);
          if (u.top != a.top) return zt(u, u.left < c.left);
        }
      }
      return a;
    } else {
      let a = i,
        c = i,
        u = t < 0 ? 1 : -1;
      return (
        t < 0 && !i
          ? (c++, (u = -1))
          : t >= 0 && i == n.nodeValue.length
            ? (a--, (u = 1))
            : t < 0
              ? a--
              : c++,
        zt(Pe(Re(n, a, c), u), u < 0)
      );
    }
  if (!r.state.doc.resolve(e - (o || 0)).parent.inlineContent) {
    if (o == null && i && (t < 0 || i == re(n))) {
      let a = n.childNodes[i - 1];
      if (T(a)) return dr(a.getBoundingClientRect(), !1);
    }
    if (o == null && i < re(n)) {
      let a = n.childNodes[i];
      if (T(a)) return dr(a.getBoundingClientRect(), !0);
    }
    return dr(n.getBoundingClientRect(), t >= 0);
  }
  if (o == null && i && (t < 0 || i == re(n))) {
    let a = n.childNodes[i - 1],
      c = Z(a)
        ? Re(a, re(a) - (s ? 0 : 1))
        : T(a) && (a.nodeName != 'BR' || !a.nextSibling)
          ? a
          : null;
    if (c) return zt(Pe(c, 1), !1);
  }
  if (o == null && i < re(n)) {
    let a = n.childNodes[i];
    for (; a.pmViewDesc && a.pmViewDesc.ignoreForCoords;) a = a.nextSibling;
    let c = a ? (Z(a) ? Re(a, 0, s ? 0 : 1) : T(a) ? a : null) : null;
    if (c) return zt(Pe(c, -1), !0);
  }
  return zt(Pe(Z(n) ? Re(n) : n, -t), t >= 0);
}
function zt(r, e) {
  if (r.width == 0) return r;
  let t = e ? r.left : r.right;
  return { top: r.top, bottom: r.bottom, left: t, right: t };
}
function dr(r, e) {
  if (r.height == 0) return r;
  let t = e ? r.top : r.bottom;
  return { top: t, bottom: t, left: r.left, right: r.right };
}
function Ys(r, e, t) {
  let n = r.state,
    i = r.root.activeElement;
  (n != e && r.updateState(e), i != r.dom && r.focus());
  try {
    return t();
  } finally {
    (n != e && r.updateState(n), i != r.dom && i && i.focus());
  }
}
function $c(r, e, t) {
  let n = e.selection,
    i = t == 'up' ? n.$from : n.$to;
  return Ys(r, e, () => {
    let { node: o } = r.docView.domFromPos(i.pos, t == 'up' ? -1 : 1);
    for (;;) {
      let l = r.docView.nearestDesc(o, !0);
      if (!l) break;
      if (l.node.isBlock) {
        o = l.contentDOM || l.dom;
        break;
      }
      o = l.dom.parentNode;
    }
    let s = Xs(r, i.pos, 1);
    for (let l = o.firstChild; l; l = l.nextSibling) {
      let a;
      if (T(l)) a = l.getClientRects();
      else if (Z(l)) a = Re(l, 0, l.nodeValue.length).getClientRects();
      else continue;
      for (let c = 0; c < a.length; c++) {
        let u = a[c];
        if (
          u.bottom > u.top + 1 &&
          (t == 'up'
            ? s.top - u.top > (u.bottom - s.top) * 2
            : u.bottom - s.bottom > (s.bottom - u.top) * 2)
        )
          return !1;
      }
    }
    return !0;
  });
}
const Vc = /[\u0590-\u08ac]/;
function Hc(r, e, t) {
  let { $head: n } = e.selection;
  if (!n.parent.isTextblock) return !1;
  let i = n.parentOffset,
    o = !i,
    s = i == n.parent.content.size,
    l = r.domSelection();
  return l
    ? !Vc.test(n.parent.textContent) || !l.modify
      ? t == 'left' || t == 'backward'
        ? o
        : s
      : Ys(r, e, () => {
          let a = r.domSel.readRange(),
            c = l.caretBidiLevel;
          l.modify('move', t, 'character');
          let u = n.depth ? r.docView.domAfterPos(n.before()) : r.dom,
            { focusNode: f, focusOffset: h } = r.domSel.readRange(),
            d = (f && !Nt(u, f)) || (a.focusNode == f && a.focusOffset == h);
          return (Ws(l, a), c != null && (l.caretBidiLevel = c), d);
        })
    : n.pos == n.start() || n.pos == n.end();
}
let Ui = null,
  ji = null,
  Gi = !1;
function Wc(r, e, t) {
  return Ui == e && ji == t
    ? Gi
    : ((Ui = e), (ji = t), (Gi = t == 'up' || t == 'down' ? $c(r, e, t) : Hc(r, e, t)));
}
class fn {
  constructor(e, t, n, i) {
    ((this.parent = e),
      (this.children = t),
      (this.dom = n),
      (this.contentDOM = i),
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
      let i = this.children[t];
      if (i == e) return n;
      n += i.size;
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
    if (this.contentDOM && Nt(this.contentDOM, e))
      if (n < 0) {
        let o, s;
        if (e == this.contentDOM) o = e.childNodes[t - 1];
        else {
          for (; e.parentNode != this.contentDOM;) e = e.parentNode;
          o = e.previousSibling;
        }
        for (; o && !((s = o.pmViewDesc) && s.parent == this);) o = o.previousSibling;
        return o ? this.posBeforeChild(s) + s.size : this.posAtStart;
      } else {
        let o, s;
        if (e == this.contentDOM) o = e.childNodes[t];
        else {
          for (; e.parentNode != this.contentDOM;) e = e.parentNode;
          o = e.nextSibling;
        }
        for (; o && !((s = o.pmViewDesc) && s.parent == this);) o = o.nextSibling;
        return o ? this.posBeforeChild(s) : this.posAtEnd;
      }
    let i;
    if (e == this.dom && this.contentDOM) i = t > se(this.contentDOM);
    else if (this.contentDOM && this.contentDOM != this.dom && this.dom.contains(this.contentDOM)) {
      let o = e.compareDocumentPosition(this.contentDOM);
      o & 16
        ? (i = t > Array.from(e.childNodes).findIndex((s) => s.contains(this.contentDOM)))
        : (i = !(o & 4));
    } else if (this.dom.firstChild) {
      if (t == 0)
        for (let o = e; ; o = o.parentNode) {
          if (o == this.dom) {
            i = !1;
            break;
          }
          if (o.previousSibling) break;
        }
      if (i == null && t == e.childNodes.length)
        for (let o = e; ; o = o.parentNode) {
          if (o == this.dom) {
            i = !0;
            break;
          }
          if (o.nextSibling) break;
        }
    }
    return (i ?? n > 0) ? this.posAtEnd : this.posAtStart;
  }
  nearestDesc(e, t = !1) {
    for (let n = !0, i = e; i; i = i.parentNode) {
      let o = this.getDesc(i),
        s;
      if (o && (!t || o.node))
        if (n && (s = o.nodeDOM) && !(T(s) ? Nt(s, e) : s == e)) n = !1;
        else return o;
    }
  }
  getDesc(e) {
    let t = e.pmViewDesc;
    for (let n = t; n; n = n.parent) if (n == this) return t;
  }
  posFromDOM(e, t, n) {
    for (let i = e; i; i = i.parentNode) {
      let o = this.getDesc(i);
      if (o) return o.localPosFromDOM(e, t, n);
    }
    return -1;
  }
  descAt(e) {
    for (let t = 0, n = 0; t < this.children.length; t++) {
      let i = this.children[t],
        o = n + i.size;
      if (n == e && o != n) {
        for (; !i.border && i.children.length;)
          for (let s = 0; s < i.children.length; s++) {
            let l = i.children[s];
            if (l.size) {
              i = l;
              break;
            }
          }
        return i;
      }
      if (e < o) return i.descAt(e - n - i.border);
      n = o;
    }
  }
  domFromPos(e, t) {
    if (!this.contentDOM) return { node: this.dom, offset: 0, atom: e + 1 };
    let n = 0,
      i = 0;
    for (let o = 0; n < this.children.length; n++) {
      let s = this.children[n],
        l = o + s.size;
      if (l > e) {
        i = e - o;
        break;
      }
      o = l;
    }
    if (i) return this.children[n].domFromPos(i - this.children[n].border, t);
    for (; n > 0; n--) {
      let o = this.children[n - 1];
      if (o.size || !(o instanceof Zs || (o instanceof Qs && o.side >= 0))) break;
    }
    if (t <= 0) {
      let o,
        s = !0;
      for (
        ;
        (o = n ? this.children[n - 1] : null), !(!o || o.dom.parentNode == this.contentDOM);
        n--, s = !1
      );
      return o && t && s && !o.border && !o.domAtom
        ? o.domFromPos(o.size, t)
        : { node: this.contentDOM, offset: o ? se(o.dom) + 1 : 0 };
    } else {
      let o,
        s = !0;
      for (
        ;
        (o = n < this.children.length ? this.children[n] : null),
          !(!o || o.dom.parentNode == this.contentDOM);
        n++, s = !1
      );
      return o && s && !o.border && !o.domAtom
        ? o.domFromPos(0, t)
        : { node: this.contentDOM, offset: o ? se(o.dom) : this.contentDOM.childNodes.length };
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
    let i = -1,
      o = -1;
    for (let s = n, l = 0; ; l++) {
      let a = this.children[l],
        c = s + a.size;
      if (i == -1 && e <= c) {
        let u = s + a.border;
        if (
          e >= u &&
          t <= c - a.border &&
          a.node &&
          a.contentDOM &&
          this.contentDOM.contains(a.contentDOM)
        )
          return a.parseRange(e, t, u);
        e = s;
        for (let f = l; f > 0; f--) {
          let h = this.children[f - 1];
          if (h.size && h.dom.parentNode == this.contentDOM && !h.emptyChildAt(1)) {
            i = se(h.dom) + 1;
            break;
          }
          e -= h.size;
        }
        i == -1 && (i = 0);
      }
      if (i > -1 && (c > t || l == this.children.length - 1)) {
        t = c;
        for (let u = l + 1; u < this.children.length; u++) {
          let f = this.children[u];
          if (f.size && f.dom.parentNode == this.contentDOM && !f.emptyChildAt(-1)) {
            o = se(f.dom);
            break;
          }
          t += f.size;
        }
        o == -1 && (o = this.contentDOM.childNodes.length);
        break;
      }
      s = c;
    }
    return { node: this.contentDOM, from: e, to: t, fromOffset: i, toOffset: o };
  }
  emptyChildAt(e) {
    if (this.border || !this.contentDOM || !this.children.length) return !1;
    let t = this.children[e < 0 ? 0 : this.children.length - 1];
    return t.size == 0 || t.emptyChildAt(e);
  }
  domAfterPos(e) {
    let { node: t, offset: n } = this.domFromPos(e, 0);
    if (!T(t) || n == t.childNodes.length) throw new RangeError('No node after pos ' + e);
    return t.childNodes[n];
  }
  ignoreMutation(e) {
    return !this.contentDOM && e.type != 'selection';
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
}
class Qs extends fn {
  constructor(e, t, n, i) {
    let o,
      s = t.type.toDOM;
    if (
      (typeof s == 'function' &&
        (s = s(n, () => {
          if (!o) return i;
          if (o.parent) return o.parent.posBeforeChild(o);
        })),
      !t.type.spec.raw)
    ) {
      let l = T(s) ? s : document.createElement('span');
      (l != s && (l.appendChild(s), (s = l)),
        l.hasAttribute('contenteditable') || (l.contentEditable = 'false'),
        l.classList.add('ProseMirror-widget'));
    }
    (super(e, [], s, null), (this.widget = t), (this.widget = t), (o = this));
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
    return e.type != 'selection' || this.widget.spec.ignoreSelection;
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
}
class qc extends fn {
  constructor(e, t, n, i) {
    (super(e, [], t, null), (this.textDOM = n), (this.text = i));
  }
  get size() {
    return this.text.length;
  }
  localPosFromDOM(e, t) {
    return e != this.textDOM ? this.posAtStart + (t ? this.size : 0) : this.posAtStart + t;
  }
  domFromPos(e) {
    return { node: this.textDOM, offset: e };
  }
  ignoreMutation(e) {
    return e.type === 'characterData' && e.target.nodeValue == e.oldValue;
  }
}
class Ke extends fn {
  constructor(e, t, n, i, o) {
    (super(e, [], n, i), (this.mark = t), (this.spec = o));
  }
  static create(e, t, n, i) {
    let o = i.nodeViews[t.type.name],
      s = o && o(t, i, n);
    return (
      (!s || !s.dom) && (s = Xe.renderSpec(document, t.type.spec.toDOM(t, n), null, t.attrs)),
      new Ke(e, t, s.dom, s.contentDOM || s.dom, s)
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
    ((this.damage |= e), (t = this.parent) === null || t === void 0 || t.markDamage(2));
  }
  slice(e, t, n) {
    let i = Ke.create(this.parent, this.mark, !0, n),
      o = this.children,
      s = this.size;
    (t < s && (o = Rr(o, t, s, n)), e > 0 && (o = Rr(o, 0, e, n)));
    for (let l = 0; l < o.length; l++) o[l].parent = i;
    return ((i.children = o), i);
  }
  ignoreMutation(e) {
    return this.spec.ignoreMutation ? this.spec.ignoreMutation(e) : super.ignoreMutation(e);
  }
  destroy() {
    (this.spec.destroy && this.spec.destroy(), super.destroy());
  }
}
class Ue extends fn {
  constructor(e, t, n, i, o, s, l) {
    (super(e, [], o, s),
      (this.node = t),
      (this.outerDeco = n),
      (this.innerDeco = i),
      (this.nodeDOM = l));
  }
  static create(e, t, n, i, o, s) {
    let l = o.nodeViews[t.type.name],
      a,
      c =
        l &&
        l(
          t,
          o,
          () => {
            if (!a) return s;
            if (a.parent) return a.parent.posBeforeChild(a);
          },
          n,
          i,
        ),
      u = c && c.dom,
      f = c && c.contentDOM;
    if (t.isText) {
      if (!u) u = document.createTextNode(t.text);
      else if (!Z(u)) throw new RangeError('Text must be rendered as a DOM text node');
    } else
      u ||
        ({ dom: u, contentDOM: f } = Xe.renderSpec(document, t.type.spec.toDOM(t), null, t.attrs));
    !f &&
      !t.isText &&
      u.nodeName != 'BR' &&
      (u.hasAttribute('contenteditable') || (u.contentEditable = 'false'),
      t.type.spec.draggable && (u.draggable = !0));
    let h = u;
    return (
      (u = nl(u, n, t)),
      c
        ? (a = new el(e, t, n, i, u, f || null, h, c))
        : t.isText
          ? new hn(e, t, n, i, u, h)
          : new Ue(e, t, n, i, u, f || null, h)
    );
  }
  parseRule(e) {
    if (this.node.type.spec.reparseInView) return null;
    let t = { node: this.node.type.name, attrs: this.node.attrs };
    if ((this.node.type.whitespace == 'pre' && (t.preserveWhitespace = 'full'), !this.contentDOM))
      t.getContent = () => this.node.content;
    else if (!this.contentLost) t.contentElement = this.contentDOM;
    else {
      for (let n = this.children.length - 1; n >= 0; n--) {
        let i = this.children[n];
        if (this.dom.contains(i.dom.parentNode)) {
          t.contentElement = i.dom.parentNode;
          break;
        }
      }
      if (!t.contentElement) {
        let n = e && e.find((i) => T(i) && e.indexOf(i.parentNode) < 0 && this.dom.contains(i));
        n ? (t.contentElement = n) : (t.getContent = () => k.empty);
      }
    }
    return t;
  }
  matchesNode(e, t, n) {
    return !this.damage && e.eq(this.node) && Wn(t, this.outerDeco) && n.eq(this.innerDeco);
  }
  get size() {
    return this.node.nodeSize;
  }
  get border() {
    return this.node.isLeaf ? 0 : 1;
  }
  updateChildren(e, t) {
    let n = this.node.inlineContent,
      i = t,
      o = e.composing ? this.localCompositionInfo(e, t) : null,
      s = o && o.pos > -1 ? o : null,
      l = o && o.pos < 0,
      a = new _c(this, s && s.node, e),
      c = this.node.inlineContent,
      u = c && this.node.isBlock;
    (jc(
      this.node,
      this.innerDeco,
      (f, h, d) => {
        (f.spec.marks
          ? a.syncToMarks(f.spec.marks, n, e, h)
          : f.type.side >= 0 &&
            !d &&
            a.syncToMarks(h == this.node.childCount ? P.none : this.node.child(h).marks, n, e, h),
          a.placeWidget(f, e, i));
      },
      (f, h, d, p) => {
        (a.syncToMarks(f.marks, n, e, p),
          u && f.isAtom && !f.isText && a.addHackNode('IMG', a.top));
        let m;
        (a.findNodeMatch(f, h, d, p) ||
          (l &&
            e.state.selection.from > i &&
            e.state.selection.to < i + f.nodeSize &&
            (m = a.findIndexWithChild(o.node)) > -1 &&
            a.updateNodeAt(f, h, d, m, e, i)) ||
          a.updateNextNode(f, h, d, e, p, i) ||
          a.addNode(f, h, d, e, i),
          (i += f.nodeSize),
          c && (u = f.isAtom && !f.isText));
      },
    ),
      a.syncToMarks([], n, e, 0),
      this.node.isTextblock && a.addTextblockHacks(),
      a.destroyRest(),
      (a.changed || this.damage & 2) &&
        (s && this.protectLocalComposition(e, s),
        tl(this.contentDOM, this.children, e),
        Tt && Gc(this.dom)));
  }
  localCompositionInfo(e, t) {
    let { from: n, to: i } = e.state.selection;
    if (!(e.state.selection instanceof L) || n < t || i > t + this.node.content.size) return null;
    let o = e.input.compositionNode;
    if (!o || !this.dom.contains(o.parentNode)) return null;
    if (this.node.inlineContent) {
      let s = o.nodeValue,
        l = Xc(this.node.content, s, n - t, i - t);
      return l < 0 ? null : { node: o, pos: l, text: s };
    } else return { node: o, pos: -1, text: '' };
  }
  protectLocalComposition(e, { node: t, pos: n, text: i }) {
    if (this.getDesc(t)) return;
    let o = t;
    for (; o.parentNode != this.contentDOM; o = o.parentNode) {
      for (; o.previousSibling;) o.parentNode.removeChild(o.previousSibling);
      for (; o.nextSibling;) o.parentNode.removeChild(o.nextSibling);
      o.pmViewDesc && (o.pmViewDesc = void 0);
    }
    let s = new qc(this, o, t, i);
    (e.input.compositionNodes.push(s), (this.children = Rr(this.children, n, n + i.length, e, s)));
  }
  update(e, t, n, i, o) {
    return this.damage & 4 || !e.sameMarkup(this.node) ? !1 : (this.updateInner(e, t, n, i, o), !0);
  }
  updateInner(e, t, n, i, o) {
    (this.updateOuterDeco(t),
      (this.node = e),
      (this.innerDeco = n),
      this.contentDOM && this.updateChildren(i, o + 1),
      (this.damage = 0));
  }
  updateOuterDeco(e) {
    if (Wn(e, this.outerDeco)) return;
    let t = !T(this.nodeDOM),
      n = this.dom;
    ((this.dom = oi(this.dom, this.nodeDOM, en(this.outerDeco, this.node, t), en(e, this.node, t))),
      this.dom != n && ((n.pmViewDesc = void 0), (this.dom.pmViewDesc = this)),
      (this.outerDeco = e));
  }
  selectNode() {
    T(this.nodeDOM) &&
      (this.nodeDOM.classList.add('ProseMirror-selectednode'),
      (this.contentDOM || !this.node.type.spec.draggable) && (this.nodeDOM.draggable = !0));
  }
  deselectNode() {
    T(this.nodeDOM) &&
      (this.nodeDOM.classList.remove('ProseMirror-selectednode'),
      (this.contentDOM || !this.node.type.spec.draggable) &&
        this.nodeDOM.removeAttribute('draggable'));
  }
  get domAtom() {
    return this.node.isAtom;
  }
}
function Xi(r, e, t, n, i, o) {
  o ? oi(n, n, en(o, r, !1), en(e, r, !1)) : nl(n, e, r);
  let s = new Ue(void 0, r, e, t, n, n, n);
  return (s.contentDOM && s.updateChildren(i, 0), s);
}
class hn extends Ue {
  constructor(e, t, n, i, o, s) {
    super(e, t, n, i, o, null, s);
  }
  parseRule() {
    let e = this.nodeDOM.parentNode;
    for (; e && e != this.dom && !e.pmIsDeco;) e = e.parentNode;
    return { skip: e || !0 };
  }
  update(e, t, n, i) {
    return this.damage & 4 || (this.damage && !this.inParent()) || !e.sameMarkup(this.node)
      ? !1
      : (this.updateOuterDeco(t),
        (this.damage & 8 || e.text != this.node.text) &&
          e.text != this.nodeDOM.nodeValue &&
          ((this.nodeDOM.nodeValue = e.text),
          i.trackWrites == this.nodeDOM && (i.trackWrites = null)),
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
  slice(e, t, n) {
    let i = this.node.cut(e, t),
      o = document.createTextNode(i.text);
    return new hn(this.parent, i, this.outerDeco, this.innerDeco, o, o);
  }
  get domAtom() {
    return !1;
  }
  isText(e) {
    return this.node.text == e;
  }
}
class Zs extends fn {
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
    return this.dom.nodeName == 'IMG';
  }
}
class el extends Ue {
  constructor(e, t, n, i, o, s, l, a) {
    (super(e, t, n, i, o, s, l), (this.spec = a));
  }
  update(e, t, n, i, o) {
    if (this.damage & 4) return !1;
    if (this.spec.update && (this.node.type == e.type || this.spec.multiType)) {
      let s = this.spec.update(e, t, n);
      return (s && this.updateInner(e, t, n, i, o), s);
    } else return !this.contentDOM && !e.isLeaf ? !1 : super.update(e, t, n, i, o);
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
}
function tl(r, e, t) {
  let n = r.firstChild,
    i = !1;
  for (let o = 0; o < e.length; o++) {
    let s = e[o],
      l = s.dom;
    if (l.parentNode == r) {
      for (; l != n;) ((n = Yi(n)), (i = !0));
      n = n.nextSibling;
    } else ((i = !0), r.insertBefore(l, n));
    if (s instanceof Ke) {
      let a = n ? n.previousSibling : r.lastChild;
      (tl(s.contentDOM, s.children, t), (n = a ? a.nextSibling : r.firstChild));
    }
  }
  for (; n;) ((n = Yi(n)), (i = !0));
  i && t.trackWrites == r && (t.trackWrites = null);
}
const Kt = function (r) {
  r && (this.nodeName = r);
};
Kt.prototype = Object.create(null);
const et = [new Kt()];
function en(r, e, t) {
  if (r.length == 0) return et;
  let n = t ? et[0] : new Kt(),
    i = [n];
  for (let o = 0; o < r.length; o++) {
    let s = r[o].type.attrs;
    if (s) {
      s.nodeName && i.push((n = new Kt(s.nodeName)));
      for (let l in s) {
        let a = s[l];
        a != null &&
          (t && i.length == 1 && i.push((n = new Kt(e.isInline ? 'span' : 'div'))),
          l == 'class'
            ? (n.class = (n.class ? n.class + ' ' : '') + a)
            : l == 'style'
              ? (n.style = (n.style ? n.style + ';' : '') + a)
              : l != 'nodeName' && (n[l] = a));
      }
    }
  }
  return i;
}
function oi(r, e, t, n) {
  if (t == et && n == et) return e;
  let i = e;
  for (let o = 0; o < n.length; o++) {
    let s = n[o],
      l = t[o];
    if (o) {
      let a;
      ((l &&
        l.nodeName == s.nodeName &&
        i != r &&
        (a = i.parentNode) &&
        a.nodeName.toLowerCase() == s.nodeName) ||
        ((a = document.createElement(s.nodeName)),
        (a.pmIsDeco = !0),
        a.appendChild(i),
        (l = et[0])),
        (i = a));
    }
    Jc(i, l || et[0], s);
  }
  return i;
}
function Jc(r, e, t) {
  for (let n in e)
    n != 'class' && n != 'style' && n != 'nodeName' && !(n in t) && r.removeAttribute(n);
  for (let n in t)
    n != 'class' && n != 'style' && n != 'nodeName' && t[n] != e[n] && r.setAttribute(n, t[n]);
  if (e.class != t.class) {
    let n = e.class ? e.class.split(' ').filter(Boolean) : [],
      i = t.class ? t.class.split(' ').filter(Boolean) : [];
    for (let o = 0; o < n.length; o++) i.indexOf(n[o]) == -1 && r.classList.remove(n[o]);
    for (let o = 0; o < i.length; o++) n.indexOf(i[o]) == -1 && r.classList.add(i[o]);
    r.classList.length == 0 && r.removeAttribute('class');
  }
  if (e.style != t.style) {
    if (e.style) {
      let n = /\s*([\w\-\xa1-\uffff]+)\s*:(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\(.*?\)|[^;])*/g,
        i;
      for (; (i = n.exec(e.style));) r.style.removeProperty(i[1]);
    }
    t.style && (r.style.cssText += t.style);
  }
}
function nl(r, e, t) {
  return oi(r, r, et, en(e, t, !T(r)));
}
function Wn(r, e) {
  if (r.length != e.length) return !1;
  for (let t = 0; t < r.length; t++) if (!r[t].type.eq(e[t].type)) return !1;
  return !0;
}
function Yi(r) {
  let e = r.nextSibling;
  return (r.parentNode.removeChild(r), e);
}
class _c {
  constructor(e, t, n) {
    ((this.lock = t),
      (this.view = n),
      (this.index = 0),
      (this.stack = []),
      (this.changed = !1),
      (this.top = e),
      (this.preMatch = Kc(e.node.content, e)));
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
  syncToMarks(e, t, n, i) {
    let o = 0,
      s = this.stack.length >> 1,
      l = Math.min(s, e.length);
    for (
      ;
      o < l &&
      (o == s - 1 ? this.top : this.stack[(o + 1) << 1]).matchesMark(e[o]) &&
      e[o].type.spec.spanning !== !1;
    )
      o++;
    for (; o < s;)
      (this.destroyRest(),
        (this.top.damage = 0),
        (this.index = this.stack.pop()),
        (this.top = this.stack.pop()),
        s--);
    for (; s < e.length;) {
      this.stack.push(this.top, this.index + 1);
      let a = -1,
        c = this.top.children.length;
      i < this.preMatch.index && (c = Math.min(this.index + 3, c));
      for (let u = this.index; u < c; u++) {
        let f = this.top.children[u];
        if (f.matchesMark(e[s]) && !this.isLocked(f.dom)) {
          a = u;
          break;
        }
      }
      if (a < 0 && this.index < this.top.children.length) {
        let u = this.top.children[this.index];
        u instanceof Ke &&
          !(u.damage & 4) &&
          u.mark.type == e[s].type &&
          u.spec.update &&
          !this.isLocked(u.dom) &&
          u.spec.update(e[s]) &&
          ((u.mark = e[s]), (a = this.index), (this.changed = !0));
      }
      if (a > -1)
        (a > this.index && ((this.changed = !0), this.destroyBetween(this.index, a)),
          (this.top = this.top.children[this.index]));
      else {
        let u = Ke.create(this.top, e[s], t, n);
        (this.top.children.splice(this.index, 0, u), (this.top = u), (this.changed = !0));
      }
      ((this.index = 0), s++);
    }
  }
  findNodeMatch(e, t, n, i) {
    let o = -1,
      s;
    if (
      i >= this.preMatch.index &&
      (s = this.preMatch.matches[i - this.preMatch.index]).parent == this.top &&
      s.matchesNode(e, t, n)
    )
      o = this.top.children.indexOf(s, this.index);
    else
      for (let l = this.index, a = Math.min(this.top.children.length, l + 5); l < a; l++) {
        let c = this.top.children[l];
        if (c.matchesNode(e, t, n) && !this.preMatch.matched.has(c)) {
          o = l;
          break;
        }
      }
    return o < 0 ? !1 : (this.destroyBetween(this.index, o), this.index++, !0);
  }
  updateNodeAt(e, t, n, i, o, s) {
    let l = this.top.children[i];
    return (
      l.damage & 4 && l.dom == l.contentDOM && (l.damage = 2),
      l.update(e, t, n, o, s) ? (this.destroyBetween(this.index, i), this.index++, !0) : !1
    );
  }
  findIndexWithChild(e) {
    for (;;) {
      let t = e.parentNode;
      if (!t) return -1;
      if (t == this.top.contentDOM) {
        let n = e.pmViewDesc;
        if (n) {
          for (let i = this.index; i < this.top.children.length; i++)
            if (this.top.children[i] == n) return i;
        }
        return -1;
      }
      e = t;
    }
  }
  updateNextNode(e, t, n, i, o, s) {
    for (let l = this.index; l < this.top.children.length; l++) {
      let a = this.top.children[l];
      if (a instanceof Ue) {
        let c = this.preMatch.matched.get(a);
        if (c != null && c != o) return !1;
        let u = a.dom,
          f,
          h =
            this.isLocked(u) &&
            !(
              e.isText &&
              a.node &&
              a.node.isText &&
              a.nodeDOM.nodeValue == e.text &&
              !(a.damage & 4) &&
              Wn(t, a.outerDeco)
            );
        if (!h && a.update(e, t, n, i, s))
          return (
            this.destroyBetween(this.index, l),
            a.dom != u && (this.changed = !0),
            this.index++,
            !0
          );
        if (!h && (f = this.recreateWrapper(a, e, t, n, i, s)))
          return (
            this.destroyBetween(this.index, l),
            (this.top.children[this.index] = f),
            f.contentDOM && ((f.damage |= 2), f.updateChildren(i, s + 1), (f.damage = 0)),
            (this.changed = !0),
            this.index++,
            !0
          );
        break;
      }
    }
    return !1;
  }
  recreateWrapper(e, t, n, i, o, s) {
    if (
      e.damage & 3 ||
      t.isAtom ||
      !e.children.length ||
      !e.node.content.eq(t.content) ||
      !Wn(n, e.outerDeco) ||
      !i.eq(e.innerDeco)
    )
      return null;
    let l = Ue.create(this.top, t, n, i, o, s);
    if (l.contentDOM) {
      ((l.children = e.children), (e.children = []));
      for (let a of l.children) a.parent = l;
    }
    return (e.destroy(), l);
  }
  addNode(e, t, n, i, o) {
    let s = Ue.create(this.top, e, t, n, i, o);
    (s.contentDOM && s.updateChildren(i, o + 1),
      this.top.children.splice(this.index++, 0, s),
      (this.changed = !0));
  }
  placeWidget(e, t, n) {
    let i = this.index < this.top.children.length ? this.top.children[this.index] : null;
    if (i && i.matchesWidget(e) && (e == i.widget || !i.widget.type.toDOM.parentNode)) this.index++;
    else {
      let o = new Qs(this.top, e, t, n);
      (this.top.children.splice(this.index++, 0, o), (this.changed = !0));
    }
  }
  addTextblockHacks() {
    let e = this.top.children[this.index - 1],
      t = this.top;
    for (; e instanceof Ke;) ((t = e), (e = t.children[t.children.length - 1]));
    (!e ||
      !(e instanceof hn) ||
      /\n$/.test(e.node.text) ||
      (this.view.requiresGeckoHackNode && /\s$/.test(e.node.text))) &&
      ((ae || le) && e && e.dom.contentEditable == 'false' && this.addHackNode('IMG', t),
      this.addHackNode('BR', this.top));
  }
  addHackNode(e, t) {
    if (t == this.top && this.index < t.children.length && t.children[this.index].matchesHack(e))
      this.index++;
    else {
      let n = document.createElement(e);
      (e == 'IMG' && ((n.className = 'ProseMirror-separator'), (n.alt = '')),
        e == 'BR' && (n.className = 'ProseMirror-trailingBreak'));
      let i = new Zs(this.top, [], n, null);
      (t != this.top ? t.children.push(i) : t.children.splice(this.index++, 0, i),
        (this.changed = !0));
    }
  }
  isLocked(e) {
    return this.lock && (e == this.lock || (T(e) && e.contains(this.lock.parentNode)));
  }
}
function Kc(r, e) {
  let t = e,
    n = t.children.length,
    i = [],
    o = r.childCount,
    s = new Map(),
    l = [];
  e: for (; o > 0;) {
    let a;
    for (;;)
      if (n) {
        let u = t.children[n - 1];
        if (u instanceof Ke) (i.push(n - 1), (t = u), (n = u.children.length));
        else {
          ((a = u), n--);
          break;
        }
      } else {
        if (t == e) break e;
        ((n = i.pop()), (t = t.parent));
      }
    let c = a.node;
    if (c) {
      if (c != r.child(o - 1)) break;
      (--o, s.set(a, o), l.push(a));
    }
  }
  return { index: o, matched: s, matches: l.reverse() };
}
function Uc(r, e) {
  return r.type.side - e.type.side;
}
function jc(r, e, t, n) {
  let i = e.locals(r),
    o = 0;
  if (i.length == 0) {
    for (let c = 0; c < r.childCount; c++) {
      let u = r.child(c);
      (n(u, i, e.forChild(o, u), c), (o += u.nodeSize));
    }
    return;
  }
  let s = 0,
    l = [],
    a = null;
  for (let c = 0; ;) {
    let u, f;
    for (; s < i.length && i[s].to == o;) {
      let b = i[s++];
      b.widget && (u ? (f || (f = [u])).push(b) : (u = b));
    }
    if (u)
      if (f) {
        f.sort(Uc);
        for (let b = 0; b < f.length; b++) t(f[b], c, !!a);
      } else t(u, c, !!a);
    let h, d;
    if (a) ((d = -1), (h = a), (a = null));
    else if (c < r.childCount) ((d = c), (h = r.child(c++)));
    else break;
    for (let b = 0; b < l.length; b++) l[b].to <= o && l.splice(b--, 1);
    for (; s < i.length && i[s].from <= o && i[s].to > o;) l.push(i[s++]);
    let p = o + h.nodeSize;
    if (h.isText) {
      let b = p;
      s < i.length && i[s].from < b && (b = i[s].from);
      for (let g = 0; g < l.length; g++) l[g].to < b && (b = l[g].to);
      b < p && ((a = h.cut(b - o)), (h = h.cut(0, b - o)), (p = b), (d = -1));
    } else for (; s < i.length && i[s].to < p;) s++;
    let m = h.isInline && !h.isLeaf ? l.filter((b) => !b.inline) : l.slice();
    (n(h, m, e.forChild(o, h), d), (o = p));
  }
}
function Gc(r) {
  if (r.nodeName == 'UL' || r.nodeName == 'OL') {
    let e = r.style.cssText;
    ((r.style.cssText = e + '; list-style: square !important'),
      window.getComputedStyle(r).listStyle,
      (r.style.cssText = e));
  }
}
function Xc(r, e, t, n) {
  for (let i = 0, o = 0; i < r.childCount && o <= n;) {
    let s = r.child(i++),
      l = o;
    if (((o += s.nodeSize), !s.isText)) continue;
    let a = s.text;
    for (; i < r.childCount;) {
      let c = r.child(i++);
      if (((o += c.nodeSize), !c.isText)) break;
      a += c.text;
    }
    if (o >= t) {
      if (o >= n && a.slice(n - e.length - l, n - l) == e) return n - e.length;
      let c = l < n ? a.lastIndexOf(e, n - l - 1) : -1;
      if (c >= 0 && c + e.length + l >= t) return l + c;
      if (t == n && a.length >= n + e.length - l && a.slice(n - l, n - l + e.length) == e) return n;
    }
  }
  return -1;
}
function Rr(r, e, t, n, i) {
  let o = [];
  for (let s = 0, l = 0; s < r.length; s++) {
    let a = r[s],
      c = l,
      u = (l += a.size);
    c >= t || u <= e
      ? o.push(a)
      : (c < e && o.push(a.slice(0, e - c, n)),
        i && (o.push(i), (i = void 0)),
        u > t && o.push(a.slice(t - c, a.size, n)));
  }
  return o;
}
function Ir(r, e) {
  let { $anchor: t, $head: n } = r.selection,
    i = e > 0 ? t.max(n) : t.min(n),
    o = i.parent.inlineContent
      ? i.depth
        ? r.doc.resolve(e > 0 ? i.after() : i.before())
        : null
      : i;
  return o && I.findFrom(o, e);
}
function Fe(r, e) {
  return (r.dispatch(r.state.tr.setSelection(e).scrollIntoView()), !0);
}
function Qi(r, e, t) {
  let n = r.state.selection;
  if (n instanceof L)
    if (t.indexOf('s') > -1) {
      let { $head: i } = n,
        o = i.textOffset ? null : e < 0 ? i.nodeBefore : i.nodeAfter;
      if (!o || o.isText || !o.isLeaf) return !1;
      let s = r.state.doc.resolve(i.pos + o.nodeSize * (e < 0 ? -1 : 1));
      return Fe(r, new L(n.$anchor, s));
    } else if (n.empty) {
      if (r.endOfTextblock(e > 0 ? 'forward' : 'backward')) {
        let i = Ir(r.state, e);
        return i && i instanceof E ? Fe(r, i) : !1;
      } else if (!be || t.indexOf('m') < 0) {
        let i = n.$head,
          o = i.textOffset ? null : e < 0 ? i.nodeBefore : i.nodeAfter,
          s;
        if (!o || o.isText) return !1;
        let l = e < 0 ? i.pos - o.nodeSize : i.pos;
        return o.isAtom || ((s = r.docView.descAt(l)) && !s.contentDOM)
          ? E.isSelectable(o)
            ? Fe(r, new E(e < 0 ? r.state.doc.resolve(i.pos - o.nodeSize) : i))
            : Fe(r, new L(r.state.doc.resolve(e < 0 ? l : l + o.nodeSize)))
          : !1;
      }
    } else return !1;
  else {
    if (n instanceof E && n.node.isInline) return Fe(r, new L(e > 0 ? n.$to : n.$from));
    {
      let i = Ir(r.state, e);
      return i ? Fe(r, i) : !1;
    }
  }
}
function Ut(r, e) {
  let t = r.pmViewDesc;
  return t
    ? t.size == 0 && (e < 0 || r.nextSibling || r.nodeName != 'BR')
    : T(r) && r.contentEditable == 'false';
}
function pt(r, e) {
  return e < 0 ? Yc(r) : Qc(r);
}
function Yc(r) {
  let e = r.domSel.readRange(),
    t = e.focusNode,
    n = e.focusOffset;
  if (!t) return;
  let i,
    o,
    s = !1;
  for (Me && T(t) && n < re(t) && Ut(t.childNodes[n], -1) && (s = !0); ;)
    if (n > 0) {
      if (!T(t)) break;
      let l = t.childNodes[n - 1];
      if (Ut(l, -1)) ((i = t), (o = --n));
      else if (Z(l)) ((t = l), (n = t.nodeValue.length));
      else break;
    } else {
      if (rl(t)) break;
      {
        let l = t.previousSibling;
        for (; l && Ut(l, -1);) ((i = t.parentNode), (o = se(l)), (l = l.previousSibling));
        if (l) ((t = l), (n = re(t)));
        else {
          if (((t = t.parentNode), t == r.dom)) break;
          n = 0;
        }
      }
    }
  s ? Lr(r, t, n) : i && Lr(r, i, o);
}
function Qc(r) {
  let e = r.domSel.readRange(),
    t = e.focusNode,
    n = e.focusOffset;
  if (!t) return;
  let i = re(t),
    o,
    s;
  for (;;)
    if (n < i) {
      if (!T(t)) break;
      let l = t.childNodes[n];
      if (Ut(l, 1)) ((o = t), (s = ++n));
      else break;
    } else {
      if (rl(t)) break;
      {
        let l = t.nextSibling;
        for (; l && Ut(l, 1);) ((o = l.parentNode), (s = se(l) + 1), (l = l.nextSibling));
        if (l) ((t = l), (n = 0), (i = re(t)));
        else {
          if (((t = t.parentNode), t == r.dom)) break;
          n = i = 0;
        }
      }
    }
  o && Lr(r, o, s);
}
function rl(r) {
  for (let e = r; e; e = e.parentNode) {
    let t = e.pmViewDesc;
    if (t) return t.node ? t.node.isBlock : !1;
  }
  return !1;
}
function Lr(r, e, t) {
  if (!Z(e)) {
    let s, l;
    (l = Hs(e, t)) ? ((e = l), (t = 0)) : (s = Vs(e, t)) && ((e = s), (t = s.nodeValue.length));
  }
  let n = r.domSelection(),
    i = r.domSel.readRange();
  if (!n) return;
  (Qn(i)
    ? n.collapse(e, t)
    : n.extend && (n.collapse(i.anchorNode, i.anchorOffset), n.extend(e, t)),
    r.domSel.ignore());
  let { state: o } = r;
  setTimeout(() => {
    r.state == o && r.domSel.sync();
  }, 50);
}
function Zi(r, e) {
  let t = r.state.doc.resolve(e);
  if (!(le || Js) && t.parent.inlineContent) {
    let o = r.coordsAtPos(e);
    if (e > t.start()) {
      let s = r.coordsAtPos(e - 1),
        l = (s.top + s.bottom) / 2;
      if (l > o.top && l < o.bottom && Math.abs(s.left - o.left) > 1)
        return s.left < o.left ? 'ltr' : 'rtl';
    }
    if (e < t.end()) {
      let s = r.coordsAtPos(e + 1),
        l = (s.top + s.bottom) / 2;
      if (l > o.top && l < o.bottom && Math.abs(s.left - o.left) > 1)
        return s.left > o.left ? 'ltr' : 'rtl';
    }
  }
  let n = r.dom;
  for (let o = t.depth; o > 0; o--)
    if (t.node(o).isBlock) {
      n = r.nodeDOM(t.before(o)) || n;
      break;
    }
  return getComputedStyle(n).direction == 'rtl' ? 'rtl' : 'ltr';
}
function eo(r, e, t) {
  let n = r.state.selection;
  if ((n instanceof L && !n.empty) || t.indexOf('s') > -1 || (be && t.indexOf('m') > -1)) return !1;
  let { $from: i, $to: o } = n;
  if (!i.parent.inlineContent || r.endOfTextblock(e < 0 ? 'up' : 'down')) {
    let s = Ir(r.state, e);
    if (s && s instanceof E) return Fe(r, s);
  }
  if (!i.parent.inlineContent) {
    let s = e < 0 ? i : o,
      l = n instanceof he ? I.near(s, e) : I.findFrom(s, e);
    return l ? Fe(r, l) : !1;
  }
  return !1;
}
function to(r, e) {
  if (!(r.state.selection instanceof L)) return !0;
  let { $head: t, $anchor: n, empty: i } = r.state.selection;
  if (!t.sameParent(n)) return !0;
  if (!i) return !1;
  if (r.endOfTextblock(e > 0 ? 'forward' : 'backward')) return !0;
  let o = !t.textOffset && (e < 0 ? t.nodeBefore : t.nodeAfter);
  if (o && !o.isText) {
    let s = r.state.tr;
    return (
      e < 0 ? s.delete(t.pos - o.nodeSize, t.pos) : s.delete(t.pos, t.pos + o.nodeSize),
      r.dispatch(s),
      !0
    );
  }
  return !1;
}
function no(r, e, t) {
  r.domObserver.stopped(() => (e.contentEditable = t));
}
function Zc(r) {
  if (!ae || r.state.selection.$head.parentOffset > 0) return !1;
  let { focusNode: e, focusOffset: t } = r.domSel.readRange();
  if (
    e &&
    T(e) &&
    t == 0 &&
    e.firstChild &&
    T(e.firstChild) &&
    e.firstChild.contentEditable == 'false'
  ) {
    let n = e.firstChild;
    (no(r, n, 'true'), setTimeout(() => no(r, n, 'false'), 20));
  }
  return !1;
}
function eu(r) {
  let e = '';
  return (
    r.ctrlKey && (e += 'c'),
    r.metaKey && (e += 'm'),
    r.altKey && (e += 'a'),
    r.shiftKey && (e += 's'),
    e
  );
}
function tu(r, e) {
  let t = e.keyCode,
    n = eu(e);
  if (t == 8 || (be && t == 72 && n == 'c')) return to(r, -1) || pt(r, -1);
  if ((t == 46 && !e.shiftKey) || (be && t == 68 && n == 'c')) return to(r, 1) || pt(r, 1);
  if (t == 13 || t == 27) return !0;
  if (t == 37 || (be && t == 66 && n == 'c')) {
    let i = t == 37 ? (Zi(r, r.state.selection.from) == 'ltr' ? -1 : 1) : -1;
    return Qi(r, i, n) || pt(r, i);
  } else if (t == 39 || (be && t == 70 && n == 'c')) {
    let i = t == 39 ? (Zi(r, r.state.selection.from) == 'ltr' ? 1 : -1) : 1;
    return Qi(r, i, n) || pt(r, i);
  } else {
    if (t == 38 || (be && t == 80 && n == 'c')) return eo(r, -1, n) || pt(r, -1);
    if (t == 40 || (be && t == 78 && n == 'c')) return Zc(r) || eo(r, 1, n) || pt(r, 1);
    if (n == (be ? 'm' : 'c') && (t == 66 || t == 73 || t == 89 || t == 90)) return !0;
  }
  return !1;
}
function si(r, e) {
  r.someProp('transformCopied', (d) => {
    e = d(e, r);
  });
  let t = [],
    { content: n, openStart: i, openEnd: o } = e;
  for (; i > 1 && o > 1 && n.childCount == 1 && n.firstChild.childCount == 1;) {
    (i--, o--);
    let d = n.firstChild;
    (t.push(d.type.name, d.attrs != d.type.defaultAttrs ? d.attrs : null), (n = d.content));
  }
  let s = r.someProp('clipboardSerializer') || Xe.fromSchema(r.state.schema),
    l = cl(),
    a = l.createElement('div');
  a.appendChild(s.serializeFragment(n, { document: l }));
  let c = a.firstChild,
    u,
    f = 0;
  for (; c && T(c) && (u = al[c.nodeName.toLowerCase()]);) {
    for (let d = u.length - 1; d >= 0; d--) {
      let p = l.createElement(u[d]);
      for (; a.firstChild;) p.appendChild(a.firstChild);
      (a.appendChild(p), f++);
    }
    c = a.firstChild;
  }
  c &&
    T(c) &&
    c.setAttribute('data-pm-slice', `${i} ${o}${f ? ` -${f}` : ''} ${JSON.stringify(t)}`);
  let h =
    r.someProp('clipboardTextSerializer', (d) => d(e, r)) ||
    e.content.textBetween(
      0,
      e.content.size,
      `

`,
    );
  return { dom: a, text: h, slice: e };
}
function il(r, e, t, n, i) {
  let o = i.parent.type.spec.code,
    s,
    l;
  if (!t && !e) return null;
  let a = !!e && (n || o || !t);
  if (a) {
    if (
      (r.someProp('transformPastedText', (h) => {
        e = h(e, o || n, r);
      }),
      o)
    )
      return (
        (l = new S(
          k.from(
            r.state.schema.text(
              e.replace(
                /\r\n?/g,
                `
`,
              ),
            ),
          ),
          0,
          0,
        )),
        r.someProp('transformPasted', (h) => {
          l = h(l, r, !0);
        }),
        l
      );
    let f = r.someProp('clipboardTextParser', (h) => h(e, i, n, r));
    if (f) l = f;
    else {
      let h = i.marks(),
        { schema: d } = r.state,
        p = Xe.fromSchema(d);
      ((s = document.createElement('div')),
        e.split(/(?:\r\n?|\n)+/).forEach((m) => {
          let b = s.appendChild(document.createElement('p'));
          m && b.appendChild(p.serializeNode(d.text(m, h)));
        }));
    }
  } else
    (r.someProp('transformPastedHTML', (f) => {
      t = f(t, r);
    }),
      (s = ou(t)),
      Zn && su(s));
  let c = s && s.querySelector('[data-pm-slice]'),
    u = c && /^(\d+) (\d+)(?: -(\d+))? (.*)/.exec(c.getAttribute('data-pm-slice') || '');
  if (u && u[3])
    for (let f = +u[3]; f > 0; f--) {
      let h = s.firstChild;
      for (; h && !T(h);) h = h.nextSibling;
      if (!h) break;
      s = h;
    }
  if (
    (l ||
      (l = (
        r.someProp('clipboardParser') ||
        r.someProp('domParser') ||
        at.fromSchema(r.state.schema)
      ).parseSlice(s, {
        preserveWhitespace: !!(a || u),
        context: i,
        ruleFromNode(h) {
          return h.nodeName == 'BR' &&
            !h.nextSibling &&
            h.parentNode &&
            !nu.test(h.parentNode.nodeName)
            ? { ignore: !0 }
            : null;
        },
      })),
    u)
  )
    l = lu(ro(l, +u[1], +u[2]), u[4]);
  else if (((l = S.maxOpen(ru(l.content, i), !0)), l.openStart || l.openEnd)) {
    let f = 0,
      h = 0;
    for (
      let d = l.content.firstChild;
      f < l.openStart && !d.type.spec.isolating;
      f++, d = d.firstChild
    );
    for (
      let d = l.content.lastChild;
      h < l.openEnd && !d.type.spec.isolating;
      h++, d = d.lastChild
    );
    l = ro(l, f, h);
  }
  return (
    r.someProp('transformPasted', (f) => {
      l = f(l, r, n);
    }),
    l
  );
}
const nu =
  /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var)$/i;
function ru(r, e) {
  if (r.childCount < 2) return r;
  for (let t = e.depth; t >= 0; t--) {
    let i = e.node(t).contentMatchAt(e.index(t)),
      o,
      s = [];
    if (
      (r.forEach((l) => {
        if (!s) return;
        let a = i.findWrapping(l.type),
          c;
        if (!a) return (s = null);
        if ((c = s.length && o.length && sl(a, o, l, s[s.length - 1], 0))) s[s.length - 1] = c;
        else {
          s.length && (s[s.length - 1] = ll(s[s.length - 1], o.length));
          let u = ol(l, a);
          (s.push(u), (i = i.matchType(u.type)), (o = a));
        }
      }),
      s)
    )
      return k.from(s);
  }
  return r;
}
function ol(r, e, t = 0) {
  for (let n = e.length - 1; n >= t; n--) r = e[n].create(null, k.from(r));
  return r;
}
function sl(r, e, t, n, i) {
  if (i < r.length && i < e.length && r[i] == e[i]) {
    let o = sl(r, e, t, n.lastChild, i + 1);
    if (o) return n.copy(n.content.replaceChild(n.childCount - 1, o));
    if (n.contentMatchAt(n.childCount).matchType(i == r.length - 1 ? t.type : r[i + 1]))
      return n.copy(n.content.append(k.from(ol(t, r, i + 1))));
  }
}
function ll(r, e) {
  if (e == 0) return r;
  let t = r.content.replaceChild(r.childCount - 1, ll(r.lastChild, e - 1)),
    n = r.contentMatchAt(r.childCount).fillBefore(k.empty, !0);
  return r.copy(t.append(n));
}
function zr(r, e, t, n, i, o) {
  let s = e < 0 ? r.firstChild : r.lastChild,
    l = s.content;
  return (
    r.childCount > 1 && (o = 0),
    i < n - 1 && (l = zr(l, e, t, n, i + 1, o)),
    i >= t &&
      (l =
        e < 0
          ? s
              .contentMatchAt(0)
              .fillBefore(l, o <= i)
              .append(l)
          : l.append(s.contentMatchAt(s.childCount).fillBefore(k.empty, !0))),
    r.replaceChild(e < 0 ? 0 : r.childCount - 1, s.copy(l))
  );
}
function ro(r, e, t) {
  return (
    e < r.openStart && (r = new S(zr(r.content, -1, e, r.openStart, 0, r.openEnd), e, r.openEnd)),
    t < r.openEnd && (r = new S(zr(r.content, 1, t, r.openEnd, 0, 0), r.openStart, t)),
    r
  );
}
const al = {
  thead: ['table'],
  tbody: ['table'],
  tfoot: ['table'],
  caption: ['table'],
  colgroup: ['table'],
  col: ['table', 'colgroup'],
  tr: ['table', 'tbody'],
  td: ['table', 'tbody', 'tr'],
  th: ['table', 'tbody', 'tr'],
};
function cl() {
  return document.implementation.createHTMLDocument('title');
}
let Bt = null;
function iu(r) {
  let e = window.trustedTypes;
  if (!e) return r;
  if (!Bt) {
    if ((Bt = e.defaultPolicy))
      try {
        return Bt.createHTML(r);
      } catch {}
    Bt = e.createPolicy('ProseMirrorClipboard', { createHTML: (t) => t });
  }
  return Bt.createHTML(r);
}
function ou(r) {
  let e = /^(\s*<meta [^>]*>)*/.exec(r);
  e && (r = r.slice(e[0].length));
  let t = cl(),
    n = t.body,
    i = /<([a-z][^>\s]+)/i.exec(r),
    o;
  if (
    ((o = i && al[i[1].toLowerCase()]) &&
      (r =
        o.map((s) => '<' + s + '>').join('') +
        r +
        o
          .map((s) => '</' + s + '>')
          .reverse()
          .join('')),
    (n.innerHTML = iu(r)),
    o)
  )
    for (let s = 0; s < o.length; s++) n = n.querySelector(o[s]) || n;
  for (let s = 0; s < t.styleSheets.length; s++) {
    let l = t.styleSheets[s];
    for (let a = 0; a < l.rules.length; a++) {
      let c = l.rules[a];
      if (c instanceof CSSStyleRule) {
        let u = n.querySelectorAll(c.selectorText);
        for (let f = 0; f < u.length; f++) u[f].style.cssText += c.style.cssText;
      }
    }
  }
  return n;
}
function su(r) {
  let e = r.querySelectorAll(le ? 'span:not([class]):not([style])' : 'span.Apple-converted-space');
  for (let t = 0; t < e.length; t++) {
    let n = e[t];
    n.childNodes.length == 1 &&
      n.textContent == ' ' &&
      n.parentNode &&
      n.parentNode.replaceChild(r.ownerDocument.createTextNode(' '), n);
  }
}
function lu(r, e) {
  if (!r.size) return r;
  let t = r.content.firstChild.type.schema,
    n;
  try {
    n = JSON.parse(e);
  } catch {
    return r;
  }
  let { content: i, openStart: o, openEnd: s } = r;
  for (let l = n.length - 2; l >= 0; l -= 2) {
    let a = t.nodes[n[l]];
    if (!a || a.hasRequiredAttrs() || !a.createAndFill(null, i)) break;
    try {
      i = k.from(a.create(n[l + 1], i));
    } catch {
      break;
    }
    (o++, s++);
  }
  return new S(i, o, s);
}
class fe {
  constructor(e, t, n, i) {
    ((this.anchorNode = e), (this.anchorOffset = t), (this.focusNode = n), (this.focusOffset = i));
  }
  static from(e) {
    return e instanceof fe ? e : new fe(e.anchorNode, e.anchorOffset, e.focusNode, e.focusOffset);
  }
  eq(e) {
    return (
      e.anchorNode == this.anchorNode &&
      e.anchorOffset == this.anchorOffset &&
      e.focusNode == this.focusNode &&
      e.focusOffset == this.focusOffset
    );
  }
}
fe.null = new fe(null, 0, null, 0);
class au {
  constructor(e) {
    ((this.view = e),
      (this.range = fe.null),
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
        this.currentDocument.removeEventListener('selectionchange', this.onSelectionChange),
      (this.currentDocument = e),
      e.addEventListener('selectionchange', this.onSelectionChange));
  }
  destroy() {
    (this.currentDocument &&
      (this.currentDocument.removeEventListener('selectionchange', this.onSelectionChange),
      (this.currentDocument = null)),
      (this.active = !1),
      (this.range = fe.null));
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
      ? ae && e.root.nodeType === 11 && Ac(e.dom.ownerDocument) == e.dom
        ? fe.from(cu(e, t) || t)
        : fe.from(t)
      : fe.null;
  }
  read() {
    this.ensureListener();
    let e = hl(this.view);
    if (!e) {
      ((this.active = !1), (this.range = fe.null));
      return;
    }
    return ((this.active = !0), this.range.eq(e) ? !1 : ((this.range = e), (this.synced = !1), !0));
  }
  sync(e = !1) {
    let { view: t } = this;
    t.docView &&
      (this.ensureListener(),
      t.domObserver.stopped(() => {
        pu(t, t.state.selection);
        let n = t.state.selection;
        if (t.input.mouseDown || ul(t)) {
          let { desc: i, start: o } = fl(t.docView, n.from, n.to, 0);
          (t.cursorWrapper
            ? du(t)
            : i instanceof el && i.spec.setSelection
              ? i.spec.setSelection(n.anchor - o, n.head - o, t.root)
              : uu(t, e, i, o),
            (this.synced = this.active = !0));
        }
        (n.visible == t.dom.classList.contains('ProseMirror-hideselection') &&
          (n.visible
            ? t.dom.classList.remove('ProseMirror-hideselection')
            : (t.dom.classList.add('ProseMirror-hideselection'), hu(t))),
          (this.range = this.readRange()));
      }));
  }
  ignore(e = this.readRange()) {
    ((this.range = fe.from(e)), (this.synced = !0));
  }
  deactivate() {
    ((this.range = fe.null), (this.active = this.synced = !1));
  }
}
function cu(r, e) {
  if (e.getComposedRanges) {
    let i = e.getComposedRanges(r.root)[0];
    if (i) return io(r, i);
  }
  let t;
  function n(i) {
    (i.preventDefault(), i.stopImmediatePropagation(), (t = i.getTargetRanges()[0]));
  }
  return (
    r.dom.addEventListener('beforeinput', n, !0),
    document.execCommand('indent'),
    r.dom.removeEventListener('beforeinput', n, !0),
    t ? io(r, t) : null
  );
}
function io(r, e) {
  let t = e.startContainer,
    n = e.startOffset,
    i = e.endContainer,
    o = e.endOffset,
    s = r.domAtPos(r.state.selection.anchor);
  return (Vn(s.node, s.offset, i, o) && ([t, n, i, o] = [i, o, t, n]), new fe(t, n, i, o));
}
function li(r, e, t = null) {
  let n = r.state.doc;
  if (!e.focusNode) return null;
  let i = r.docView.nearestDesc(e.focusNode),
    o = i && i.size == 0,
    s = r.docView.posFromDOM(e.focusNode, e.focusOffset, 1);
  if (s < 0) return null;
  let l = n.resolve(s),
    a,
    c;
  if (Qn(e)) {
    for (a = s; i && !i.node;) i = i.parent;
    if (
      i &&
      i.node.isAtom &&
      E.isSelectable(i.node) &&
      i.parent &&
      !(i.node.isInline && Sc(e.focusNode, e.focusOffset, i.dom))
    ) {
      let f = i.posBefore;
      c = new E(s == f ? l : n.resolve(f));
    } else if (
      Me &&
      t == 'key' &&
      s > r.state.selection.to &&
      T(e.focusNode) &&
      e.focusOffset == e.focusNode.childNodes.length &&
      i &&
      i.posAtStart > r.state.selection.to
    )
      for (let f = e.focusNode; ; f = f.parentNode) {
        if (getComputedStyle(f).overflow != 'visible') {
          c = I.findFrom(n.resolve(i.posAtStart), 1);
          break;
        }
        if (f == i.dom || f.nextSibling || !f.parentNode || !T(f.parentNode)) break;
      }
  } else {
    if (e instanceof r.dom.ownerDocument.defaultView.Selection && e.rangeCount > 1) {
      let f = s,
        h = s;
      for (let d = 0; d < e.rangeCount; d++) {
        let p = e.getRangeAt(d);
        ((f = Math.min(f, r.docView.posFromDOM(p.startContainer, p.startOffset, 1))),
          (h = Math.max(h, r.docView.posFromDOM(p.endContainer, p.endOffset, -1))));
      }
      if (f < 0) return null;
      (([a, s] = h == r.state.selection.anchor ? [h, f] : [f, h]), (l = n.resolve(s)));
    } else a = r.docView.posFromDOM(e.anchorNode, e.anchorOffset, 1);
    if (a < 0) return null;
  }
  let u = n.resolve(a);
  if (!c) {
    let f = t == 'pointer' || (r.state.selection.head < l.pos && !o) ? 1 : -1;
    c = Ot(r, u, l, f);
  }
  return c;
}
function ul(r) {
  return r.editable
    ? r.hasFocus()
    : dl(r, r.domSel.readRange()) &&
        (!document.activeElement || document.activeElement.contains(r.dom));
}
function uu(r, e, t, n) {
  let i = r.state.selection,
    { anchor: o, head: s } = i,
    l,
    a;
  oo &&
    !(i instanceof L) &&
    (i.$from.parent.inlineContent || (l = so(r, i.from)),
    !i.empty && !i.$from.parent.inlineContent && (a = so(r, i.to)));
  let c = t.domFromPos(o - n, o > n ? -1 : 1),
    u = s == o ? c : t.domFromPos(s - n, s > n ? -1 : 1);
  (fu(o, s, c, u, r, e), oo && (l && lo(l), a && lo(a)));
}
function fl(r, e, t, n = 0) {
  for (let i = 0, o = n; i < r.children.length; i++) {
    let s = r.children[i],
      l = o + s.size;
    if (e > o && t < l) return fl(s, e, t, o + s.border);
    o = l;
  }
  return { desc: r, start: n };
}
function fu(r, e, t, n, i, o) {
  let s = !1;
  if ((Me || ae) && r == e) {
    let { node: a, offset: c } = t;
    if (Z(a)) {
      if (
        ((s = !!(
          c &&
          a.nodeValue[c - 1] ==
            `
`
        )),
        s && c == a.nodeValue.length)
      )
        for (let u = a, f; u; u = u.parentNode) {
          if ((f = u.nextSibling)) {
            f.nodeName == 'BR' && (t = n = { node: f.parentNode, offset: se(f) + 1 });
            break;
          }
          let h = u.pmViewDesc;
          if (h && h.node && h.node.isBlock) break;
        }
    } else {
      let u = a.childNodes[c - 1];
      s = u && (u.nodeName == 'BR' || u.contentEditable == 'false');
    }
  }
  let l = i.domSel.readRange();
  if (Me && l.focusNode && l.focusNode != n.node && T(l.focusNode)) {
    let a = l.focusNode.childNodes[l.focusOffset];
    a && a.contentEditable == 'false' && (o = !0);
  }
  (!(o || (s && ae)) &&
    Vn(t.node, t.offset, l.anchorNode, l.anchorOffset) &&
    Vn(n.node, n.offset, l.focusNode, l.focusOffset)) ||
    Ws(i.domSelection(), {
      focusNode: n.node,
      focusOffset: n.offset,
      anchorNode: t.node,
      anchorOffset: t.offset,
    });
}
const oo = ae || (le && qs < 63);
function so(r, e) {
  let { node: t, offset: n } = r.docView.domFromPos(e, 0),
    i = n < t.childNodes.length ? t.childNodes[n] : null,
    o = n ? t.childNodes[n - 1] : null;
  if (ae && i && i.contentEditable == 'false') return pr(i);
  if ((!i || i.contentEditable == 'false') && (!o || o.contentEditable == 'false')) {
    if (i) return pr(i);
    if (o) return pr(o);
  }
}
function pr(r) {
  return (
    (r.contentEditable = 'true'),
    ae && r.draggable && ((r.draggable = !1), (r.wasDraggable = !0)),
    r
  );
}
function lo(r) {
  ((r.contentEditable = 'false'), r.wasDraggable && ((r.draggable = !0), (r.wasDraggable = null)));
}
function hu(r) {
  let e = r.dom.ownerDocument;
  e.removeEventListener('selectionchange', r.input.hideSelectionGuard);
  let t = r.domSel.readRange(),
    n = t.anchorNode,
    i = t.anchorOffset;
  e.addEventListener(
    'selectionchange',
    (r.input.hideSelectionGuard = () => {
      (t.anchorNode != n || t.anchorOffset != i) &&
        (e.removeEventListener('selectionchange', r.input.hideSelectionGuard),
        setTimeout(() => {
          (!ul(r) || r.state.selection.visible) &&
            r.dom.classList.remove('ProseMirror-hideselection');
        }, 20));
    }),
  );
}
function du(r) {
  let e = r.domSelection();
  if (!e) return;
  let t = r.cursorWrapper.dom;
  t.nodeName == 'IMG' ? e.collapse(t.parentNode, se(t) + 1) : e.collapse(t, 0);
}
function pu(r, e) {
  if (e instanceof E) {
    let t = r.docView.descAt(e.from);
    t != r.lastSelectedViewDesc && (ao(r), t && t.selectNode(), (r.lastSelectedViewDesc = t));
  } else ao(r);
}
function ao(r) {
  r.lastSelectedViewDesc &&
    (r.lastSelectedViewDesc.parent && r.lastSelectedViewDesc.deselectNode(),
    (r.lastSelectedViewDesc = void 0));
}
function Ot(r, e, t, n) {
  let i = r.someProp('createSelectionBetween', (o) => o(r, e, t)) || L.between(e, t, n);
  return (
    r.someProp('adjustSelectionFromDOM', (o) => {
      i = o(r, i);
    }),
    i
  );
}
function hl(r) {
  if (r.editable && !r.hasFocus()) return null;
  let e = r.domSel.readRange();
  return e && dl(r, e) ? e : null;
}
function dl(r, e) {
  if (!e.anchorNode) return !1;
  try {
    return Nt(r.dom, e.anchorNode) && (r.editable || Nt(r.dom, e.focusNode));
  } catch {
    return !1;
  }
}
const ce = {},
  ue = {},
  mu = { touchstart: !0, touchmove: !0 };
class gu {
  constructor() {
    ((this.shiftKey = !1),
      (this.mouseDown = null),
      (this.lastKeyCode = null),
      (this.lastKeyCodeTime = 0),
      (this.lastKeyDispatched = !1),
      (this.lastClick = { time: 0, x: 0, y: 0, type: '', button: 0 }),
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
}
function bu(r) {
  for (let e in ce) {
    let t = ce[e];
    r.dom.addEventListener(
      e,
      (r.input.eventHandlers[e] = (n) => {
        wu(r, n) &&
          (r.input.composing &&
            (n.type == 'keydown' || n.type == 'beforeinput') &&
            n.isComposing === !1 &&
            gl(r, !0),
          !ai(r, n) && (r.editable || !(n.type in ue)) && t(r, n));
      }),
      mu[e] ? { passive: !0 } : void 0,
    );
  }
  (ae && r.dom.addEventListener('input', () => null), Br(r));
}
function er(r, e) {
  ((r.input.lastSelectionOrigin = e), (r.input.lastSelectionTime = Date.now()));
}
function yu(r) {
  (r.input.mouseDown && r.input.mouseDown.done(), r.domObserver.stop());
  for (let e in r.input.eventHandlers) r.dom.removeEventListener(e, r.input.eventHandlers[e]);
  (clearTimeout(r.input.composingTimeout), clearTimeout(r.input.lastIOSEnterFallbackTimeout));
}
function Br(r) {
  r.someProp('handleDOMEvents', (e) => {
    for (let t in e)
      r.input.eventHandlers[t] ||
        r.dom.addEventListener(t, (r.input.eventHandlers[t] = (n) => ai(r, n)));
  });
}
function ai(r, e) {
  return r.someProp('handleDOMEvents', (t) => {
    let n = t[e.type];
    return n ? n(r, e) || e.defaultPrevented : !1;
  });
}
function wu(r, e) {
  if (!e.bubbles) return !0;
  if (e.defaultPrevented) return !1;
  for (let t = e.target; t != r.dom; t = t.parentNode)
    if (!t || t.nodeType == 11 || (t.pmViewDesc && t.pmViewDesc.stopEvent(e))) return !1;
  return !0;
}
function ku(r, e) {
  !ai(r, e) && ce[e.type] && (r.editable || !(e.type in ue)) && ce[e.type](r, e);
}
function Ve(r, e) {
  let { input: t } = r;
  return t.lastKeyDispatched || r.composing
    ? !1
    : ((t.lastKeyDispatched = !0),
      typeof e == 'string' && (e = vc(e == 'Backspace' ? 8 : 13, e)),
      r.someProp('handleKeyDown', (n) => n(r, e)));
}
ue.keydown = (r, e) => {
  let t = e;
  if (
    ((r.input.shiftKey = t.keyCode == 16 || t.shiftKey),
    (r.input.lastKeyCode = t.keyCode),
    (r.input.lastKeyCodeTime = Date.now()),
    (r.input.lastKeyDispatched = !1),
    !(Le && le && t.keyCode == 13))
  ) {
    if (Tt && t.keyCode == 13 && !t.ctrlKey && !t.altKey && !t.metaKey) {
      let n = Date.now();
      ((r.input.lastIOSEnter = n),
        (r.input.lastIOSEnterFallbackTimeout = setTimeout(() => {
          r.input.lastIOSEnter == n && (Ve(r, 'Enter'), (r.input.lastIOSEnter = 0));
        }, 200)));
      return;
    }
    (t.keyCode != 229 && r.domObserver.forceFlush(!0),
      Ve(r, t) || tu(r, t) ? t.preventDefault() : er(r, 'key'));
  }
};
ue.keyup = (r, e) => {
  e.keyCode == 16 && (r.input.shiftKey = !1);
};
ue.keypress = (r, e) => {
  let t = e;
  if (Tu(r) || !t.charCode || (t.ctrlKey && !t.altKey) || (be && t.metaKey)) return;
  if (r.someProp('handleKeyPress', (i) => i(r, t))) {
    t.preventDefault();
    return;
  }
  let n = r.state.selection;
  if (!(n instanceof L) || !n.$from.sameParent(n.$to)) {
    let i = String.fromCharCode(t.charCode),
      o = () => r.state.tr.insertText(i).scrollIntoView();
    (!/[\r\n]/.test(i) &&
      !r.someProp('handleTextInput', (s) => s(r, n.$from.pos, n.$to.pos, i, o)) &&
      r.dispatch(o()),
      t.preventDefault());
  }
};
function tn(r) {
  return { left: r.clientX, top: r.clientY };
}
function xu(r, e) {
  let t = e.x - r.clientX,
    n = e.y - r.clientY;
  return t * t + n * n < 100;
}
function ci(r, e, t, n, i) {
  if (n == -1) return !1;
  let o = r.state.doc.resolve(n);
  for (let s = o.depth + 1; s > 0; s--)
    if (
      r.someProp(e, (l) =>
        s > o.depth
          ? l(r, t, o.nodeAfter, o.before(s), i, !0)
          : l(r, t, o.node(s), o.before(s), i, !1),
      )
    )
      return !0;
  return !1;
}
function pl(r, e, t) {
  if ((r.focused || r.focus(), r.state.selection.eq(e))) return;
  let n = r.state.tr.setSelection(e);
  (n.setMeta('pointer', !0), r.dispatch(n));
}
function Mu(r, e) {
  if (e == -1) return !1;
  let t = r.state.doc.resolve(e),
    n = t.nodeAfter;
  return n && n.isAtom && E.isSelectable(n) ? (pl(r, new E(t)), !0) : !1;
}
function Cu(r, e) {
  if (e == -1) return !1;
  let t = r.state.selection,
    n,
    i;
  t instanceof E && (n = t.node);
  let o = r.state.doc.resolve(e);
  for (let s = o.depth + 1; s > 0; s--) {
    let l = s > o.depth ? o.nodeAfter : o.node(s);
    if (E.isSelectable(l)) {
      n && t.$from.depth > 0 && s >= t.$from.depth && o.before(t.$from.depth + 1) == t.$from.pos
        ? (i = o.before(t.$from.depth))
        : (i = o.before(s));
      break;
    }
  }
  return i != null ? (pl(r, E.create(r.state.doc, i)), !0) : !1;
}
function Su(r, e, t, n, i) {
  return (
    ci(r, 'handleClickOn', e, t, n) ||
    r.someProp('handleClick', (o) => o(r, e, n)) ||
    (i ? Cu(r, t) : Mu(r, t))
  );
}
function vu(r, e, t, n) {
  return (
    ci(r, 'handleDoubleClickOn', e, t, n) || r.someProp('handleDoubleClick', (i) => i(r, e, n))
  );
}
function Au(r, e, t, n) {
  return (
    ci(r, 'handleTripleClickOn', e, t, n) || r.someProp('handleTripleClick', (i) => i(r, e, n))
  );
}
function co(r, e, t) {
  if (e == -1) return r.inlineContent ? L.create(r, 0, r.content.size) : null;
  let n = r.resolve(e);
  for (let i = n.depth + 1; i > 0; i--) {
    let o = i > n.depth ? n.nodeAfter : n.node(i),
      s = n.before(i);
    if (o.inlineContent) return L.create(r, s + 1, s + 1 + o.content.size);
    if (t && E.isSelectable(o)) return E.create(r, s);
  }
  return null;
}
let Pr = /[\w_\u00a1-\uffff]+/g;
try {
  Pr = new RegExp('[\\p{L}\\p{N}_]+', 'gu');
} catch {}
function uo(r, e) {
  let t = r.resolve(e),
    n = t.node(),
    i = '',
    o = e,
    s = e;
  for (let m = t.indexAfter(), b = !1; m > 0; m--) {
    let g = n.child(m - 1);
    if (!g.text) break;
    let y = o == e ? e - t.posAtIndex(m - 1) : g.text.length,
      w = y;
    for (; w > 0; w--)
      if (/\S/.test(g.text[w - 1])) b = !0;
      else if (b) break;
    if (((i = g.text.slice(w, y) + i), (o -= y - w), w || o < e - 50)) break;
  }
  for (let m = t.index(), b = !1; m < n.childCount; m++) {
    let g = n.child(m);
    if (!g.text) break;
    let y = s == e ? e - t.posAtIndex(m) : 0,
      w = y;
    for (; w < g.text.length; w++)
      if (/\S/.test(g.text[w])) b = !0;
      else if (b) break;
    if (((i += g.text.slice(y, w)), (s += w - y), w < g.text.length || s > e + 50)) break;
  }
  let l = o,
    a = s;
  if (Intl.Segmenter) {
    for (let m of new Intl.Segmenter(void 0, { granularity: 'word' }).segment(i))
      if (m.isWordLike) {
        let b = m.index + o,
          g = b + m.segment.length;
        if (g < e) l = g;
        else if (b > e) {
          a = b;
          break;
        } else return L.create(r, b, g);
      }
  } else {
    Pr.lastIndex = 0;
    for (let m; (m = Pr.exec(i));) {
      let b = m.index + o,
        g = b + m[0].length;
      if (g < e) l = g;
      else if (b > e) {
        a = b;
        break;
      } else return L.create(r, b, g);
    }
  }
  let c = i.slice(l - o, e - o),
    u = i.slice(e - o, a - o),
    f = /\S*$/.exec(c)[0].length,
    h = /^\S*/.exec(u)[0].length;
  if (f || h) return L.create(r, e - f, e + h);
  let d = /\s*$/.exec(c)[0].length,
    p = /^\s*/.exec(u)[0].length;
  return L.create(r, e - d, e + p);
}
const ml = be ? 'metaKey' : 'ctrlKey';
ce.mousedown = (r, e) => {
  let t = e,
    n = Date.now();
  if (((r.input.shiftKey = t.shiftKey), r.input.lastTouch > n - 500)) return !1;
  ut(r);
  let i = 'singleClick';
  (n - r.input.lastClick.time < 500 &&
    xu(t, r.input.lastClick) &&
    !t[ml] &&
    r.input.lastClick.button == t.button &&
    (r.input.lastClick.type == 'singleClick'
      ? (i = 'doubleClick')
      : r.input.lastClick.type == 'doubleClick' && (i = 'tripleClick')),
    (r.input.lastClick = { time: n, x: t.clientX, y: t.clientY, type: i, button: t.button }),
    r.input.mouseDown && r.input.mouseDown.done());
  let o = r.posAtCoords(tn(t));
  if (o)
    if (t.button == 0) {
      if (!r.hasFocus()) {
        Us(r.dom);
        let l = r.root.activeElement;
        l && !l.contains(r.dom) && l.blur();
      }
      (r.input.mouseDown = new Nu(r, o, t, i)).mightDrag || t.preventDefault();
    } else er(r, 'pointer');
};
class Nu {
  constructor(e, t, n, i) {
    var o;
    ((this.view = e),
      (this.startPos = t),
      (this.event = n),
      (this.type = i),
      (this.didMove = !1),
      (this.lastPos = -1),
      (this.anchorRange = null),
      (this.startDoc = e.state.doc),
      (this.selectNode = !!n[ml]),
      (this.extend = n.shiftKey),
      (this.anchorDoc = this.startDoc));
    let s = fo(e);
    if (this.extend) {
      let l = e.state.selection;
      this.anchorRange =
        l instanceof E ? { from: l.from, to: l.to } : { from: l.anchor, to: l.anchor };
      let a = l instanceof E ? e.nodeDOM(l.from).getBoundingClientRect() : e.coordsAtPos(l.anchor);
      this.anchorOffset = { x: (a.left + a.right) / 2 - s.x, y: (a.top + a.bottom) / 2 - s.y };
    } else this.anchorOffset = { x: n.clientX - s.x, y: n.clientY - s.y };
    if (i == 'singleClick') {
      let { selection: l } = e.state,
        a,
        c,
        u = !1;
      if (l instanceof E && l.from <= t.pos && l.to >= t.pos)
        ((c = l.from), (a = l.node), (u = !0));
      else if (t.inside > -1) ((a = e.state.doc.nodeAt(t.inside)), (c = t.inside));
      else {
        let f = e.state.doc.resolve(t.pos);
        ((a = f.parent), (c = f.depth ? f.before() : -1));
      }
      if (u || (c > -1 && a.type.spec.draggable && a.type.spec.selectable !== !1)) {
        let f = (o = e.docView.descAt(c)) === null || o === void 0 ? void 0 : o.nodeDOM;
        ((this.mightDrag = { node: a, elt: f, pos: c, addAttr: !1 }),
          f &&
            !f.draggable &&
            ((this.mightDrag.addAttr = !0), e.domObserver.stopped(() => (f.draggable = !0))));
      } else this.mightDrag = Eu(e, n);
    } else this.mightDrag = !1;
    (e.root.addEventListener('mouseup', (this.up = this.up.bind(this))),
      e.root.addEventListener('mousemove', (this.move = this.move.bind(this))),
      this.mightDrag || this.select(this.startPos, !0));
  }
  done() {
    (this.view.root.removeEventListener('mouseup', this.up),
      this.view.root.removeEventListener('mousemove', this.move),
      this.view.input.mouseDown == this && (this.view.input.mouseDown = null),
      typeof this.mightDrag == 'object' &&
        this.mightDrag.addAttr &&
        this.view.domObserver.stopped(() => this.mightDrag.elt.removeAttribute('draggable')));
  }
  maybeRunHandler(e, t) {
    return (this.type == 'singleClick' ? Su : this.type == 'doubleClick' ? vu : Au)(
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
    (this.view.state.doc != this.startDoc && (t = this.view.posAtCoords(tn(e))),
      t && (this.didMove || this.maybeRunHandler(t, e) || this.select(t, !0), e.preventDefault()));
  }
  move(e) {
    if (e.buttons == 0) {
      this.done();
      return;
    }
    if (
      (!this.didMove &&
        (Math.abs(this.event.x - e.clientX) > 8 || Math.abs(this.event.y - e.clientY) > 8) &&
        ((this.didMove = !0), (this.mightDrag = !1)),
      !this.mightDrag)
    ) {
      let t = this.view.posAtCoords(tn(e));
      t && this.select(t, !1);
    }
    e.preventDefault();
  }
  select(e, t) {
    if (e.pos == this.lastPos) return;
    this.lastPos = e.pos;
    let { view: n } = this,
      { doc: i } = n.state,
      o =
        this.type == 'singleClick'
          ? ho(n, i, e)
          : this.type == 'doubleClick'
            ? uo(i, e.pos)
            : co(i, e.inside, t);
    o &&
      (t && !this.extend
        ? (this.anchorRange = o)
        : (!t || this.extend) &&
          (i.eq(this.anchorDoc) || this.restoreAnchor(),
          this.anchorRange && this.anchorRange.from < o.from
            ? (o = Ot(n, i.resolve(this.anchorRange.from), i.resolve(o.to)))
            : this.anchorRange &&
              this.anchorRange.to > o.to &&
              (o = Ot(n, i.resolve(this.anchorRange.to), i.resolve(o.from)))),
      o.eq(n.state.selection) ||
        n.dispatch(n.state.tr.setSelection(o).setMeta('pointer', !0).scrollIntoView()));
  }
  restoreAnchor() {
    let e = fo(this.view),
      t = this.view.posAtCoords({
        left: this.anchorOffset.x + e.x,
        top: this.anchorOffset.y + e.y,
      });
    if (!t) this.anchorRange = null;
    else {
      let { doc: n } = this.view.state;
      ((this.anchorRange =
        this.type == 'singleClick'
          ? ho(this.view, n, t)
          : this.type == 'doubleClick'
            ? uo(n, t.pos)
            : co(n, t.inside, !1)),
        (this.anchorDoc = this.view.state.doc));
    }
  }
}
function fo(r) {
  let e = r.dom.getBoundingClientRect();
  return { x: e.left - r.dom.scrollLeft, y: e.top - r.dom.scrollTop };
}
function ho(r, e, t) {
  if (t.inside > -1) {
    let i = e.nodeAt(t.inside);
    if (i.isAtom && E.isSelectable(i)) return E.create(e, t.inside);
  }
  let n = e.resolve(t.pos);
  return Ot(r, n, n);
}
function Eu(r, e) {
  let { selection: t } = r.state;
  if (t.empty) return !1;
  let n = r.domSelection();
  if (!n || n.rangeCount == 0) return !0;
  let i = n.getRangeAt(0).getClientRects();
  for (let o = 0; o < i.length; o++) {
    let s = i[o];
    if (s.left <= e.clientX && s.right >= e.clientX && s.top <= e.clientY && s.bottom >= e.clientY)
      return !0;
  }
  return !1;
}
ce.touchstart = (r) => {
  ((r.input.lastTouch = Date.now()), ut(r), er(r, 'pointer'));
};
ce.touchmove = (r) => {
  ((r.input.lastTouch = Date.now()), er(r, 'pointer'));
};
ce.contextmenu = (r) => ut(r);
function Tu(r, e) {
  return r.composing
    ? !0
    : ae && Math.abs(Date.now() - r.input.compositionEndedAt) < 500
      ? ((r.input.compositionEndedAt = -2e8), !0)
      : !1;
}
const Ou = Le ? 5e3 : -1;
ue.compositionstart = ue.compositionupdate = (r) => {
  if (!r.composing) {
    r.domObserver.flush();
    let { state: e } = r,
      t = e.selection.$to;
    if (
      e.selection instanceof L &&
      e.selection.empty &&
      (e.storedMarks ||
        (!t.textOffset &&
          t.parentOffset &&
          t.nodeBefore.marks.some((n) => n.type.spec.inclusive === !1)) ||
        (le && Js && Du(r)))
    )
      ((r.markCursor = r.state.storedMarks || t.marks()), ut(r, !0), (r.markCursor = null));
    else if (
      (ut(r, !e.selection.empty),
      Me &&
        r.domSel.active &&
        e.selection.empty &&
        t.parentOffset &&
        !t.textOffset &&
        t.nodeBefore.marks.length)
    )
      for (let { focusNode: n, focusOffset: i } = r.domSel.range; n && T(n) && i != 0;) {
        let o = i < 0 ? n.lastChild : n.childNodes[i - 1];
        if (!o) break;
        if (Z(o)) {
          let s = r.domSelection();
          s && s.collapse(o, o.nodeValue.length);
          break;
        } else ((n = o), (i = -1));
      }
    r.input.composing = !0;
  }
  bl(r, Ou);
};
function Du(r) {
  let { focusNode: e, focusOffset: t } = r.domSel.range;
  if (!e || !T(e) || t >= e.childNodes.length) return !1;
  let n = e.childNodes[t];
  return T(n) && n.contentEditable == 'false';
}
ue.compositionend = (r, e) => {
  r.composing && gl(r);
};
function gl(r, e = !1) {
  ((r.input.composing = !1),
    (r.input.compositionEndedAt = Date.now()),
    (r.input.compositionPendingChanges = r.domObserver.pendingRecords().length
      ? r.input.compositionID
      : 0),
    (r.input.compositionNode = null),
    r.input.badSafariComposition
      ? r.domObserver.forceFlush()
      : r.input.compositionPendingChanges && Promise.resolve().then(() => r.domObserver.flush()),
    r.input.compositionID++,
    e ? ut(r) : bl(r, 20));
}
function bl(r, e) {
  (clearTimeout(r.input.composingTimeout),
    e > -1 && (r.input.composingTimeout = setTimeout(() => ut(r), e)));
}
function yl(r) {
  r.composing && ((r.input.composing = !1), (r.input.compositionEndedAt = Date.now()));
  for (let e; (e = r.input.compositionNodes.pop());) e.markParentDamage();
}
function Ru(r) {
  let e = r.domSel.range;
  if (!r.domSel.active || !e.focusNode) return null;
  let t = Vs(e.focusNode, e.focusOffset),
    n = Hs(e.focusNode, e.focusOffset);
  if (t && n && t != n) {
    let i = n.pmViewDesc,
      o = r.domObserver.lastChangedTextNode;
    if (t == o || n == o) return o;
    if (!i || !i.isText(n.nodeValue)) return n;
    if (r.input.compositionNode == n) {
      let s = t.pmViewDesc;
      if (!(!s || !s.isText(t.nodeValue))) return n;
    }
  }
  return t || n;
}
function ut(r, e = !1) {
  if (
    !(Le && r.domObserver.flushingSoon >= 0) &&
    (r.domObserver.forceFlush(), yl(r), e || (r.docView && r.docView.damage))
  ) {
    let t = li(r, r.domSel.readRange()),
      n = r.state.selection;
    t && !t.eq(n)
      ? r.dispatch(r.state.tr.setSelection(t))
      : (r.markCursor || e) && !n.$from.node(n.$from.sharedDepth(n.to)).inlineContent
        ? r.dispatch(r.state.tr.deleteSelection())
        : r.updateState(r.state);
  }
}
function Iu(r, e) {
  if (!r.dom.parentNode) return;
  let t = r.dom.parentNode.appendChild(document.createElement('div'));
  (t.appendChild(e), (t.style.cssText = 'position: fixed; left: -10000px; top: 10px'));
  let n = getSelection(),
    i = document.createRange();
  (i.selectNodeContents(e),
    r.dom.blur(),
    n.removeAllRanges(),
    n.addRange(i),
    setTimeout(() => {
      (t.parentNode && t.parentNode.removeChild(t), r.focus());
    }, 50));
}
const nn = Tt && Ec < 604;
ce.copy = ue.cut = (r, e) => {
  let t = e,
    n = r.state.selection,
    i = t.type == 'cut';
  if (n.empty) return;
  let o = nn ? null : t.clipboardData,
    s = n.content(),
    { dom: l, text: a } = si(r, s);
  (o
    ? (t.preventDefault(),
      o.clearData(),
      o.setData('text/html', l.innerHTML),
      o.setData('text/plain', a))
    : Iu(r, l),
    i && r.dispatch(r.state.tr.deleteSelection().scrollIntoView().setMeta('uiEvent', 'cut')));
};
function Lu(r) {
  return r.openStart == 0 && r.openEnd == 0 && r.content.childCount == 1
    ? r.content.firstChild
    : null;
}
function zu(r, e) {
  if (!r.dom.parentNode) return;
  let t = r.input.shiftKey || r.state.selection.$from.parent.type.spec.code,
    n = r.dom.parentNode.appendChild(document.createElement(t ? 'textarea' : 'div'));
  (t || (n.contentEditable = 'true'),
    (n.style.cssText = 'position: fixed; left: -10000px; top: 10px'),
    n.focus());
  let i = r.input.shiftKey && r.input.lastKeyCode != 45;
  setTimeout(() => {
    (r.focus(),
      n.parentNode && n.parentNode.removeChild(n),
      t ? rn(r, n.value, null, i, e) : rn(r, n.textContent, n.innerHTML, i, e));
  }, 50);
}
function rn(r, e, t, n, i) {
  let o = il(r, e, t, n, r.state.selection.$from);
  if (r.someProp('handlePaste', (a) => a(r, i, o || S.empty))) return !0;
  if (!o) return !1;
  let s = Lu(o),
    l = s ? r.state.tr.replaceSelectionWith(s, n) : r.state.tr.replaceSelection(o);
  return (r.dispatch(l.scrollIntoView().setMeta('paste', !0).setMeta('uiEvent', 'paste')), !0);
}
function wl(r) {
  let e = r.getData('text/plain') || r.getData('Text');
  if (e) return e;
  let t = r.getData('text/uri-list');
  return t ? t.replace(/\r?\n/g, ' ') : '';
}
ue.paste = (r, e) => {
  let t = e;
  if (r.composing && !Le) return;
  let n = nn ? null : t.clipboardData,
    i = r.input.shiftKey && r.input.lastKeyCode != 45;
  n && rn(r, wl(n), n.getData('text/html'), i, t) ? t.preventDefault() : zu(r, t);
};
class kl {
  constructor(e, t, n) {
    ((this.slice = e), (this.move = t), (this.node = n));
  }
}
const Bu = be ? 'altKey' : 'ctrlKey';
function xl(r, e) {
  let t;
  return (
    r.someProp('dragCopies', (n) => {
      t = t || n(e);
    }),
    t != null ? !t : !e[Bu]
  );
}
ce.dragstart = (r, e) => {
  let t = e,
    n = r.input.mouseDown;
  if ((n && n.done(), !t.dataTransfer)) return;
  let i = r.state.selection,
    o = i.empty ? null : r.posAtCoords(tn(t)),
    s;
  if (!(o && o.pos >= i.from && o.pos <= (i instanceof E ? i.to - 1 : i.to))) {
    if (n && typeof n.mightDrag == 'object') s = E.create(r.state.doc, n.mightDrag.pos);
    else if (t.target && T(t.target)) {
      let f = r.docView.nearestDesc(t.target, !0);
      f && f.node.type.spec.draggable && f != r.docView && (s = E.create(r.state.doc, f.posBefore));
    }
  }
  let l = (s || r.state.selection).content(),
    { dom: a, text: c, slice: u } = si(r, l);
  ((!t.dataTransfer.files.length || !le || qs > 120) && t.dataTransfer.clearData(),
    t.dataTransfer.setData(nn ? 'Text' : 'text/html', a.innerHTML),
    (t.dataTransfer.effectAllowed = 'copyMove'),
    nn || t.dataTransfer.setData('text/plain', c),
    (r.dragging = new kl(u, xl(r, t), s)));
};
ce.dragend = (r) => {
  let e = r.dragging;
  window.setTimeout(() => {
    r.dragging == e && (r.dragging = null);
  }, 50);
};
ue.dragover = ue.dragenter = (r, e) => e.preventDefault();
ue.drop = (r, e) => {
  try {
    Pu(r, e, r.dragging);
  } finally {
    r.dragging = null;
  }
};
function Pu(r, e, t) {
  if (!e.dataTransfer) return;
  let n = r.posAtCoords(tn(e));
  if (!n) return;
  let i = r.state.doc.resolve(n.pos),
    o = t && t.slice;
  o
    ? r.someProp('transformPasted', (d) => {
        o = d(o, r, !1);
      })
    : (o = il(r, wl(e.dataTransfer), nn ? null : e.dataTransfer.getData('text/html'), !1, i));
  let s = !!(t && xl(r, e));
  if (r.someProp('handleDrop', (d) => d(r, e, o || S.empty, s))) {
    e.preventDefault();
    return;
  }
  if (!o) return;
  e.preventDefault();
  let l = o ? Ds(r.state.doc, i.pos, o) : i.pos;
  l == null && (l = i.pos);
  let a = r.state.tr;
  if (s) {
    let { node: d } = t;
    d ? d.replace(a) : a.deleteSelection();
  }
  let c = a.mapping.map(l),
    u = o.openStart == 0 && o.openEnd == 0 && o.content.childCount == 1,
    f = a.doc;
  if ((u ? a.replaceRangeWith(c, c, o.content.firstChild) : a.replaceRange(c, c, o), a.doc.eq(f)))
    return;
  let h = a.doc.resolve(c);
  if (
    u &&
    E.isSelectable(o.content.firstChild) &&
    h.nodeAfter &&
    h.nodeAfter.sameMarkup(o.content.firstChild)
  )
    a.setSelection(new E(h));
  else {
    let d = a.mapping.map(l);
    (a.mapping.maps[a.mapping.maps.length - 1].forEach((p, m, b, g) => (d = g)),
      a.setSelection(Ot(r, h, a.doc.resolve(d))));
  }
  (r.focus(), r.dispatch(a.setMeta('uiEvent', 'drop')));
}
ce.focus = (r) => {
  if (
    ((r.input.lastFocus = Date.now()),
    !r.focused &&
      (r.domObserver.stopped(() => r.dom.classList.add('ProseMirror-focused')),
      (r.focused = !0),
      r.domSel.read(),
      !r.domSel.synced))
  ) {
    let e = r.domSel.range;
    setTimeout(() => {
      let t = r.domSel.readRange();
      t && e.eq(t) && r.domSel.sync();
    }, 20);
  }
};
ce.blur = (r, e) => {
  let t = e;
  r.focused &&
    (r.domObserver.stopped(() => r.dom.classList.remove('ProseMirror-focused')),
    t.relatedTarget && r.dom.contains(t.relatedTarget) && r.domSel.deactivate(),
    (r.focused = !1));
};
ce.beforeinput = (r, e) => {
  if (Le && e.inputType == 'deleteContentBackward') {
    r.domObserver.flushSoon();
    let { domChangeCount: n } = r.input;
    setTimeout(() => {
      if (
        r.input.domChangeCount != n ||
        r.domObserver.pendingRecords().length ||
        (r.dom.blur(), r.focus(), Ve(r, 'Backspace'))
      )
        return;
      let { $cursor: i } = r.state.selection;
      i && i.pos > 0 && r.dispatch(r.state.tr.delete(i.pos - 1, i.pos).scrollIntoView());
    }, 50);
  }
};
for (let r in ue) ce[r] = ue[r];
function on(r, e) {
  if (r == e) return !0;
  for (let t in r) if (r[t] !== e[t]) return !1;
  for (let t in e) if (!(t in r)) return !1;
  return !0;
}
class Fr {
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
}
class qn {
  constructor(e, t) {
    ((this.toDOM = e), (this.spec = t || it), (this.side = this.spec.side || 0));
  }
  map(e, t, n, i) {
    let { pos: o, deleted: s } = e.mapResult(t.from + i, this.side < 0 ? -1 : 1);
    return s ? null : new ie(o - n, o - n, this);
  }
  valid() {
    return !0;
  }
  eq(e) {
    return (
      this == e ||
      (e instanceof qn &&
        ((this.spec.key && this.spec.key == e.spec.key) ||
          (this.toDOM == e.toDOM && on(this.spec, e.spec))))
    );
  }
  destroy(e) {
    this.spec.destroy && this.spec.destroy(e);
  }
}
class je {
  constructor(e, t) {
    ((this.attrs = e), (this.spec = t || it));
  }
  map(e, t, n, i) {
    let o = e.map(t.from + i, this.spec.inclusiveStart ? -1 : 1) - n,
      s = e.map(t.to + i, this.spec.inclusiveEnd ? 1 : -1) - n;
    return o >= s ? null : new ie(o, s, this);
  }
  valid(e, t) {
    return t.from < t.to;
  }
  eq(e) {
    return this == e || (e instanceof je && on(this.attrs, e.attrs) && on(this.spec, e.spec));
  }
  static is(e) {
    return e.type instanceof je;
  }
  destroy() {}
}
class ui {
  constructor(e, t) {
    ((this.attrs = e), (this.spec = t || it));
  }
  map(e, t, n, i) {
    let o = e.mapResult(t.from + i, 1);
    if (o.deleted) return null;
    let s = e.mapResult(t.to + i, -1);
    return s.deleted || s.pos <= o.pos ? null : new ie(o.pos - n, s.pos - n, this);
  }
  valid(e, t, n) {
    let i = n.nodeAt(t.from);
    return !!i && !i.isText && t.from + i.nodeSize == t.to;
  }
  eq(e) {
    return this == e || (e instanceof ui && on(this.attrs, e.attrs) && on(this.spec, e.spec));
  }
  destroy() {}
}
class ie {
  constructor(e, t, n) {
    ((this.from = e), (this.to = t), (this.type = n));
  }
  copy(e, t) {
    return new ie(e, t, this.type);
  }
  eq(e, t = 0) {
    return this.type.eq(e.type) && this.from + t == e.from && this.to + t == e.to;
  }
  map(e, t, n) {
    return this.type.map(e, this, t, n);
  }
  static widget(e, t, n) {
    return new ie(e, e, new qn(t, n));
  }
  static inline(e, t, n, i) {
    return new ie(e, t, new je(n, i));
  }
  static node(e, t, n, i) {
    return new ie(e, t, new ui(n, i));
  }
  get spec() {
    return this.type.spec;
  }
  get inline() {
    return this.type instanceof je;
  }
  get widget() {
    return this.type instanceof qn;
  }
}
const yt = [],
  it = {};
class H {
  constructor(e, t) {
    ((this.local = e.length ? e : yt), (this.children = t.length ? t : yt));
  }
  static create(e, t) {
    return t.length ? Jn(t, e, 0, it) : te;
  }
  find(e, t, n) {
    let i = [];
    return (this.findInner(e ?? 0, t ?? 1e9, i, 0, n), i);
  }
  findInner(e, t, n, i, o) {
    for (let s = 0; s < this.local.length; s++) {
      let l = this.local[s];
      if (l.from > t) break;
      l.to >= e && (!o || o(l.spec)) && n.push(l.copy(l.from + i, l.to + i));
    }
    for (let s = 0; s < this.children.length && !(this.children[s] >= t); s += 3)
      if (this.children[s + 1] > e) {
        let l = this.children[s] + 1;
        this.children[s + 2].findInner(e - l, t - l, n, i + l, o);
      }
  }
  map(e, t, n) {
    return this == te || e.maps.length == 0 ? this : this.mapInner(e, t, 0, 0, n || it);
  }
  mapInner(e, t, n, i, o) {
    let s;
    if (this.local.length) {
      let l = new Fr(t.content);
      for (let a = 0; a < this.local.length; a++) {
        let c = this.local[a].map(e, n, i);
        c && c.type.valid(t, c, l)
          ? (s || (s = [])).push(c)
          : o.onRemove && o.onRemove(this.local[a].spec);
      }
    }
    return this.children.length
      ? Fu(this.children, s || [], e, t, n, i, o)
      : s
        ? new H(s.sort(Je), yt)
        : te;
  }
  add(e, t) {
    return t.length ? (this == te ? H.create(e, t) : this.addInner(e, t, 0)) : this;
  }
  addInner(e, t, n) {
    let i,
      o = 0;
    e.forEach((l, a) => {
      let c = a + n,
        u;
      if ((u = Cl(t, l, c))) {
        for (i || (i = this.children.slice()); o < i.length && i[o] < a;) o += 3;
        (i[o] == a
          ? (i[o + 2] = i[o + 2].addInner(l, u, c + 1))
          : i.splice(o, 0, a, a + l.nodeSize, Jn(u, l, c + 1, it)),
          (o += 3));
      }
    });
    let s = Ml(o ? Sl(t) : t, -n).sort(Je);
    if (s.length) {
      let l = new Fr(e.content);
      for (let a = 0; a < s.length; a++) s[a].type.valid(e, s[a], l) || s.splice(a--, 1);
    }
    return new H(s.length ? this.local.concat(s).sort(Je) : this.local, i || this.children);
  }
  remove(e) {
    return e.length == 0 || this == te ? this : this.removeInner(e, 0);
  }
  removeInner(e, t) {
    let n = this.children,
      i = this.local;
    for (let o = 0; o < n.length; o += 3) {
      let s,
        l = n[o] + t,
        a = n[o + 1] + t;
      for (let u = 0, f; u < e.length; u++)
        (f = e[u]) && f.from > l && f.to < a && ((e[u] = null), (s || (s = [])).push(f));
      if (!s) continue;
      n == this.children && (n = this.children.slice());
      let c = n[o + 2].removeInner(s, l + 1);
      c != te ? (n[o + 2] = c) : (n.splice(o, 3), (o -= 3));
    }
    if (i.length) {
      for (let o = 0, s; o < e.length; o++)
        if ((s = e[o]))
          for (let l = 0; l < i.length; l++)
            i[l].eq(s, t) && (i == this.local && (i = this.local.slice()), i.splice(l--, 1));
    }
    return n == this.children && i == this.local ? this : i.length || n.length ? new H(i, n) : te;
  }
  forChild(e, t) {
    if (this == te) return this;
    if (t.isLeaf) return H.empty;
    let n,
      i,
      o = 0,
      s = this.children.length / 3;
    for (; o < s;) {
      let c = (o + s) >>> 1,
        u = c * 3,
        f = this.children[u];
      if (f < e) o = c + 1;
      else if (f > e) s = c;
      else {
        n = this.children[u + 2];
        break;
      }
    }
    let l = e + 1,
      a = l + t.content.size;
    for (let c = 0; c < this.local.length; c++) {
      let u = this.local[c];
      if (u.from < a && u.to > l && u.type instanceof je) {
        let f = Math.max(l, u.from) - l,
          h = Math.min(a, u.to) - l;
        f < h && (i || (i = [])).push(u.copy(f, h));
      }
    }
    if (i) {
      let c = new H(i.sort(Je), yt);
      return n ? new He([c, n]) : c;
    }
    return n || te;
  }
  eq(e) {
    if (this == e) return !0;
    if (
      !(e instanceof H) ||
      this.local.length != e.local.length ||
      this.children.length != e.children.length
    )
      return !1;
    for (let t = 0; t < this.local.length; t++) if (!this.local[t].eq(e.local[t])) return !1;
    for (let t = 0; t < this.children.length; t += 3)
      if (
        this.children[t] != e.children[t] ||
        this.children[t + 1] != e.children[t + 1] ||
        !this.children[t + 2].eq(e.children[t + 2])
      )
        return !1;
    return !0;
  }
  locals(e) {
    return fi(this.localsInner(e));
  }
  localsInner(e) {
    if (this == te) return yt;
    if (e.inlineContent || !this.local.some(je.is)) return this.local;
    let t = [];
    for (let n = 0; n < this.local.length; n++)
      this.local[n].type instanceof je || t.push(this.local[n]);
    return t;
  }
  forEachSet(e) {
    e(this);
  }
}
H.empty = new H([], []);
H.removeOverlap = fi;
const te = H.empty;
class He {
  constructor(e) {
    this.members = e;
  }
  map(e, t) {
    const n = this.members.map((i) => i.map(e, t, it));
    return He.from(n);
  }
  forChild(e, t) {
    if (t.isLeaf) return H.empty;
    let n = [];
    for (let i = 0; i < this.members.length; i++) {
      let o = this.members[i].forChild(e, t);
      o != te && (o instanceof He ? (n = n.concat(o.members)) : n.push(o));
    }
    return He.from(n);
  }
  eq(e) {
    if (!(e instanceof He) || e.members.length != this.members.length) return !1;
    for (let t = 0; t < this.members.length; t++) if (!this.members[t].eq(e.members[t])) return !1;
    return !0;
  }
  locals(e) {
    let t,
      n = !0;
    for (let i = 0; i < this.members.length; i++) {
      let o = this.members[i].localsInner(e);
      if (o.length)
        if (!t) t = o;
        else {
          n && ((t = t.slice()), (n = !1));
          for (let s = 0; s < o.length; s++) t.push(o[s]);
        }
    }
    return t ? fi(n ? t : t.sort(Je)) : yt;
  }
  static from(e) {
    switch (e.length) {
      case 0:
        return te;
      case 1:
        return e[0];
      default:
        return new He(
          e.every((t) => t instanceof H)
            ? e
            : e.reduce((t, n) => t.concat(n instanceof H ? n : n.members), []),
        );
    }
  }
  forEachSet(e) {
    for (let t = 0; t < this.members.length; t++) this.members[t].forEachSet(e);
  }
}
function Fu(r, e, t, n, i, o, s) {
  let l = r.slice();
  for (let c = 0, u = o; c < t.maps.length; c++) {
    let f = 0;
    (t.maps[c].forEach((h, d, p, m) => {
      let b = m - p - (d - h);
      for (let g = 0; g < l.length; g += 3) {
        let y = l[g + 1];
        if (y < 0 || h > y + u - f) continue;
        let w = l[g] + u - f;
        d >= w ? (l[g + 1] = h <= w ? -2 : -1) : h >= u && b && ((l[g] += b), (l[g + 1] += b));
      }
      f += b;
    }),
      (u = t.maps[c].map(u, -1)));
  }
  let a = !1;
  for (let c = 0; c < l.length; c += 3)
    if (l[c + 1] < 0) {
      if (l[c + 1] == -2) {
        ((a = !0), (l[c + 1] = -1));
        continue;
      }
      let u = t.map(r[c] + o),
        f = u - i;
      if (f < 0 || f >= n.content.size) {
        a = !0;
        continue;
      }
      let h = t.map(r[c + 1] + o, -1),
        d = h - i,
        { index: p, offset: m } = n.content.findIndex(f),
        b = n.maybeChild(p);
      if (b && m == f && m + b.nodeSize == d) {
        let g = l[c + 2].mapInner(t, b, u + 1, r[c] + o + 1, s);
        g != te ? ((l[c] = f), (l[c + 1] = d), (l[c + 2] = g)) : ((l[c + 1] = -2), (a = !0));
      } else a = !0;
    }
  if (a) {
    let c = $u(l, r, e, t, i, o, s),
      u = Jn(c, n, 0, s);
    e = u.local;
    for (let f = 0; f < l.length; f += 3) l[f + 1] < 0 && (l.splice(f, 3), (f -= 3));
    for (let f = 0, h = 0; f < u.children.length; f += 3) {
      let d = u.children[f];
      for (; h < l.length && l[h] < d;) h += 3;
      l.splice(h, 0, u.children[f], u.children[f + 1], u.children[f + 2]);
    }
  }
  return new H(e.sort(Je), l);
}
function Ml(r, e) {
  if (!e || !r.length) return r;
  let t = [];
  for (let n = 0; n < r.length; n++) {
    let i = r[n];
    t.push(new ie(i.from + e, i.to + e, i.type));
  }
  return t;
}
function $u(r, e, t, n, i, o, s) {
  function l(a, c) {
    for (let u = 0; u < a.local.length; u++) {
      let f = a.local[u].map(n, i, c);
      f ? t.push(f) : s.onRemove && s.onRemove(a.local[u].spec);
    }
    for (let u = 0; u < a.children.length; u += 3) l(a.children[u + 2], a.children[u] + c + 1);
  }
  for (let a = 0; a < r.length; a += 3) r[a + 1] == -1 && l(r[a + 2], e[a] + o + 1);
  return t;
}
function Cl(r, e, t) {
  if (e.isLeaf) return null;
  let n = t + e.nodeSize,
    i = null;
  for (let o = 0, s; o < r.length; o++)
    (s = r[o]) && s.from > t && s.to < n && ((i || (i = [])).push(s), (r[o] = null));
  return i;
}
function Sl(r) {
  let e = [];
  for (let t = 0; t < r.length; t++) r[t] != null && e.push(r[t]);
  return e;
}
function Jn(r, e, t, n) {
  let i = [],
    o = !1;
  e.forEach((l, a) => {
    let c = Cl(r, l, a + t);
    if (c) {
      o = !0;
      let u = Jn(c, l, t + a + 1, n);
      u != te && i.push(a, a + l.nodeSize, u);
    }
  });
  let s = Ml(o ? Sl(r) : r, -t).sort(Je);
  if (s.length) {
    let l = new Fr(e.content);
    for (let a = 0; a < s.length; a++)
      s[a].type.valid(e, s[a], l) || (n.onRemove && n.onRemove(s[a].spec), s.splice(a--, 1));
  }
  return s.length || i.length ? new H(s, i) : te;
}
function Je(r, e) {
  return r.from - e.from || r.to - e.to;
}
function fi(r) {
  let e = r;
  for (let t = 0; t < e.length - 1; t++) {
    let n = e[t];
    if (n.from != n.to)
      for (let i = t + 1; i < e.length; i++) {
        let o = e[i];
        if (o.from == n.from) {
          o.to != n.to &&
            (e == r && (e = r.slice()),
            (e[i] = o.copy(o.from, n.to)),
            po(e, i + 1, o.copy(n.to, o.to)));
          continue;
        } else {
          o.from < n.to &&
            (e == r && (e = r.slice()),
            (e[t] = n.copy(n.from, o.from)),
            po(e, i, n.copy(o.from, n.to)));
          break;
        }
      }
  }
  return e;
}
function po(r, e, t) {
  for (; e < r.length && Je(t, r[e]) > 0;) e++;
  r.splice(e, 0, t);
}
function mr(r) {
  let e = [];
  return (
    r.someProp('decorations', (t) => {
      let n = t(r.state);
      n && n != te && e.push(n);
    }),
    r.cursorWrapper && e.push(H.create(r.state.doc, [r.cursorWrapper.deco])),
    He.from(e)
  );
}
function Vu(r, e, t, n) {
  let { node: i, fromOffset: o, toOffset: s, from: l, to: a } = r.docView.parseRange(e, t),
    c = r.domSel.range,
    u,
    f = c.anchorNode;
  if (
    (f &&
      Nt(r.dom, f) &&
      ((u = [{ node: f, offset: c.anchorOffset }]),
      Qn(c) || u.push({ node: c.focusNode, offset: c.focusOffset })),
    le && r.input.lastKeyCode === 8)
  )
    for (let g = s; g > o; g--) {
      let y = i.childNodes[g - 1],
        w = y.pmViewDesc;
      if (y.nodeName == 'BR' && !w) {
        s = g;
        break;
      }
      if (!w || w.size) break;
    }
  let h = r.state.doc,
    d = r.someProp('domParser') || at.fromSchema(r.state.schema),
    p = h.resolve(l),
    m = null,
    b = d.parse(i, {
      topNode: p.parent,
      topMatch: p.parent.contentMatchAt(p.index()),
      topOpen: !0,
      from: o,
      to: s,
      preserveWhitespace: p.parent.type.whitespace == 'pre' ? 'full' : !0,
      findPositions: u,
      ruleFromNode: Hu(n),
      context: p,
    });
  if (u && u[0].pos != null) {
    let g = u[0].pos,
      y = u[1] && u[1].pos;
    (y == null && (y = g), (m = { anchor: g + l, head: y + l }));
  }
  return { doc: b, sel: m, from: l, to: a };
}
const Hu = (r) => (e) => {
    let t = e.pmViewDesc;
    if (t) return t.parseRule(r);
    if (e.nodeName == 'BR' && e.parentNode) {
      if (ae && /^(ul|ol)$/i.test(e.parentNode.nodeName)) {
        let n = document.createElement('div');
        return (n.appendChild(document.createElement('li')), { skip: n });
      } else if (e.parentNode.lastChild == e || (ae && /^(tr|table)$/i.test(e.parentNode.nodeName)))
        return { ignore: !0 };
    } else if (e.nodeName == 'IMG' && e.getAttribute('mark-placeholder')) return { ignore: !0 };
    return null;
  },
  Wu =
    /^(a|abbr|acronym|b|bd[io]|big|br|button|cite|code|data(list)?|del|dfn|em|i|img|ins|kbd|label|map|mark|meter|output|q|ruby|s|samp|small|span|strong|su[bp]|time|u|tt|var)$/i;
function qu(r, e, t, n, i, o) {
  let s = r.input.compositionPendingChanges || (r.composing ? r.input.compositionID : 0);
  if (((r.input.compositionPendingChanges = 0), e < 0)) {
    let v = r.input.lastSelectionTime > Date.now() - 50 ? r.input.lastSelectionOrigin : null,
      D = li(r, r.domSel.range, v);
    if (D && !r.state.selection.eq(D) && r.domSel.active) {
      if (
        le &&
        Le &&
        r.input.lastKeyCode === 13 &&
        Date.now() - 100 < r.input.lastKeyCodeTime &&
        Ve(r, 'Enter')
      )
        return;
      let B = r.state.tr.setSelection(D);
      (v == 'pointer' ? B.setMeta('pointer', !0) : v == 'key' && B.scrollIntoView(),
        s && B.setMeta('composition', s),
        r.dispatch(B));
    }
    return;
  }
  let l = r.state.doc.resolve(e),
    a = l.sharedDepth(t);
  ((e = l.before(a + 1)), (t = r.state.doc.resolve(t).after(a + 1)));
  let c = r.state.selection,
    u = Vu(r, e, t, o),
    f = r.state.doc,
    h = f.slice(u.from, u.to),
    d,
    p;
  (r.input.lastKeyCode === 8 && Date.now() - 100 < r.input.lastKeyCodeTime
    ? ((d = r.state.selection.to), (p = 'end'))
    : ((d = r.state.selection.from), (p = 'start')),
    (r.input.lastKeyCode = null));
  let m = Uu(h.content, u.doc.content, u.from, d, p);
  if (
    (m && r.input.domChangeCount++,
    ((Tt && r.input.lastIOSEnter > Date.now() - 225) || Le) &&
      o.some((v) => T(v) && !Wu.test(v.nodeName)) &&
      (!m || m.endA >= m.endB) &&
      Ve(r, 'Enter'))
  ) {
    r.input.lastIOSEnter = 0;
    return;
  }
  if (!m)
    if (
      i &&
      c instanceof L &&
      !c.empty &&
      c.$head.sameParent(c.$anchor) &&
      !r.composing &&
      !(u.sel && u.sel.anchor != u.sel.head)
    )
      m = { start: c.from, endA: c.to, endB: c.to };
    else {
      if (u.sel) {
        let v = mo(r, r.state.doc, u.sel);
        if (v && !v.eq(r.state.selection)) {
          let D = r.state.tr.setSelection(v);
          (s && D.setMeta('composition', s), r.dispatch(D));
        }
      }
      return;
    }
  r.state.selection.from < r.state.selection.to &&
    m.start == m.endB &&
    r.state.selection instanceof L &&
    (m.start > r.state.selection.from &&
    m.start <= r.state.selection.from + 2 &&
    r.state.selection.from >= u.from
      ? (m.start = r.state.selection.from)
      : m.endA < r.state.selection.to &&
        m.endA >= r.state.selection.to - 2 &&
        r.state.selection.to <= u.to &&
        ((m.endB += r.state.selection.to - m.endA), (m.endA = r.state.selection.to)));
  let b = u.doc.resolveNoCache(m.start - u.from),
    g = u.doc.resolveNoCache(m.endB - u.from),
    y = f.resolve(m.start),
    w = b.sameParent(g) && b.parent.inlineContent && y.end() >= m.endA;
  if (
    ((Tt &&
      r.input.lastIOSEnter > Date.now() - 225 &&
      (!w || o.some((v) => v.nodeName == 'DIV' || v.nodeName == 'P'))) ||
      (!w && Ku(u.doc, b.pos, g.pos))) &&
    Ve(r, 'Enter')
  ) {
    r.input.lastIOSEnter = 0;
    return;
  }
  if (
    r.state.selection.anchor > m.start &&
    (w ? m.endA > m.start && m.endB == m.start : _u(f, m.start, m.endA, b, g)) &&
    Ve(r, 'Backspace')
  ) {
    Le && le && r.domSel.suppressChanges();
    return;
  }
  (le && m.endB == m.start && (r.input.lastChromeDelete = Date.now()),
    Le &&
      !w &&
      b.start() != g.start() &&
      g.parentOffset == 0 &&
      b.depth == g.depth &&
      u.sel &&
      u.sel.anchor == u.sel.head &&
      u.sel.head == m.endA &&
      ((m.endB -= 2),
      (g = u.doc.resolveNoCache(m.endB - u.from)),
      setTimeout(() => Ve(r, 'Enter'), 20)));
  let N = m.start,
    z = m.endA,
    F = (v) => {
      let D = v || r.state.tr.replace(N, z, u.doc.slice(m.start - u.from, m.endB - u.from));
      if (u.sel) {
        let B = mo(r, D.doc, u.sel);
        B &&
          !(
            le &&
            r.composing &&
            B.empty &&
            (m.start != m.endB || r.input.lastChromeDelete < Date.now() - 100) &&
            (B.head == N || B.head == D.mapping.map(z) - 1)
          ) &&
          D.setSelection(B);
      }
      return (s && D.setMeta('composition', s), D.scrollIntoView());
    },
    C;
  if (w)
    if (b.pos == g.pos) {
      let v = F(r.state.tr.delete(N, z)),
        D = f.resolve(m.start).marksAcross(f.resolve(m.endA));
      (D && v.ensureMarks(D), r.dispatch(v));
    } else if (
      m.endA == m.endB &&
      (C = Ju(
        b.parent.content.cut(b.parentOffset, g.parentOffset),
        y.parent.content.cut(y.parentOffset, m.endA - y.start()),
      ))
    ) {
      let v = F(r.state.tr);
      (C.type == 'add' ? v.addMark(N, z, C.mark) : v.removeMark(N, z, C.mark), r.dispatch(v));
    } else if (
      b.parent.child(b.index()).isText &&
      b.index() == g.index() - (g.textOffset ? 0 : 1)
    ) {
      let v = b.parent.textBetween(b.parentOffset, g.parentOffset),
        D = () => F(r.state.tr.insertText(v, N, z));
      r.someProp('handleTextInput', (B) => B(r, N, z, v, D)) || r.dispatch(D());
    } else r.dispatch(F());
  else r.dispatch(F());
}
function mo(r, e, t) {
  return Math.max(t.anchor, t.head) > e.content.size
    ? null
    : Ot(r, e.resolve(t.anchor), e.resolve(t.head));
}
function Ju(r, e) {
  let t = r.firstChild.marks,
    n = e.firstChild.marks,
    i = t,
    o = n,
    s,
    l,
    a;
  for (let u = 0; u < n.length; u++) i = n[u].removeFromSet(i);
  for (let u = 0; u < t.length; u++) o = t[u].removeFromSet(o);
  if (i.length == 1 && o.length == 0)
    ((l = i[0]), (s = 'add'), (a = (u) => u.mark(l.addToSet(u.marks))));
  else if (i.length == 0 && o.length == 1)
    ((l = o[0]), (s = 'remove'), (a = (u) => u.mark(l.removeFromSet(u.marks))));
  else return null;
  let c = [];
  for (let u = 0; u < e.childCount; u++) c.push(a(e.child(u)));
  if (k.from(c).eq(r)) return { mark: l, type: s };
}
function _u(r, e, t, n, i) {
  if (t - e <= i.pos - n.pos || gr(n, !0, !1) < i.pos) return !1;
  let o = r.resolve(e);
  if (!n.parent.inlineContent) {
    let l = o.nodeAfter;
    return l != null && t == e + l.nodeSize;
  }
  if (o.parentOffset < o.parent.content.size || !o.parent.isTextblock) return !1;
  let s = r.resolve(gr(o, !0, !0));
  return !s.parent.isTextblock || s.pos > t || gr(s, !0, !1) < t
    ? !1
    : n.parent.content.cut(n.parentOffset).eq(s.parent.content);
}
function Ku(r, e, t) {
  let n = 0,
    i = 0;
  return (
    r.nodesBetween(e, t, (o, s) => {
      o.isTextblock && s >= e && s < t
        ? n++
        : (o.isText
            ? /\S/.test(o.text.slice(Math.max(0, e - s), Math.min(o.nodeSize, t - s)))
            : o.isLeaf) && i++;
    }),
    i == 0 && n == 1
  );
}
function gr(r, e, t) {
  let n = r.depth,
    i = e ? r.end() : r.pos;
  for (; n > 0 && (e || r.indexAfter(n) == r.node(n).childCount);) (n--, i++, (e = !1));
  if (t) {
    let o = r.node(n).maybeChild(r.indexAfter(n));
    for (; o && !o.isLeaf;) ((o = o.firstChild), i++);
  }
  return i;
}
function Uu(r, e, t, n, i) {
  let o = r.findDiffStart(e, t),
    s = t + r.size,
    l = t + e.size;
  if (o == null) return null;
  let { a, b: c } = r.findDiffEnd(e, s, l);
  if (i == 'end') {
    let u = Math.max(0, o - Math.min(a, c));
    n -= a + u - o;
  }
  if (a < o && s < l) {
    let u = n <= o && n >= a ? o - n : 0;
    ((o -= u), (c = o + (c - a)), (a = o));
  } else if (c < o) {
    let u = n <= o && n >= c ? o - n : 0;
    ((o -= u), (a = o + (a - c)), (c = o));
  }
  return { start: o, endA: a, endB: c };
}
const ju = {
  childList: !0,
  characterData: !0,
  characterDataOldValue: !0,
  attributes: !0,
  attributeOldValue: !0,
  subtree: !0,
};
class Gu {
  constructor(e) {
    ((this.view = e),
      (this.queue = []),
      (this.flushingSoon = -1),
      (this.suppressingSelectionUpdates = !1),
      (this.lastChangedTextNode = null),
      (this.started = !1),
      (this.observer = new window.MutationObserver((t) => {
        for (let n = 0; n < t.length; n++) this.queue.push(t[n]);
        ae && e.composing && t.some((n) => n.type == 'childList' && n.target.nodeName == 'TR')
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
    (this.observer.takeRecords(), this.observer.observe(this.view.dom, ju), (this.started = !0));
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
    for (let o = e.focusNode; o; o = At(o)) t.add(o);
    for (let o = e.anchorNode; o; o = At(o))
      if (t.has(o)) {
        n = o;
        break;
      }
    let i = n && this.view.docView.nearestDesc(n);
    if (i && i.ignoreMutation({ type: 'selection', target: Z(n) ? n.parentNode : n }))
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
    let i =
        !t.domSel.suppress &&
        !t.domSel.synced &&
        !!hl(t) &&
        !this.ignoreSelectionChange(t.domSel.range),
      o = -1,
      s = -1,
      l = !1,
      a = [];
    if (t.editable)
      for (let u = 0; u < n.length; u++) {
        let f = this.registerMutation(n[u], a);
        f &&
          ((o = o < 0 ? f.from : Math.min(f.from, o)),
          (s = s < 0 ? f.to : Math.max(f.to, s)),
          f.typeOver && (l = !0));
      }
    if (
      a.some((u) => u.nodeName == 'BR') &&
      (t.input.lastKeyCode == 8 ||
        t.input.lastKeyCode == 46 ||
        (le &&
          (t.composing || t.input.compositionEndedAt > Date.now() - 50) &&
          n.some((u) => u.type == 'childList' && u.removedNodes.length)))
    ) {
      for (let u of a)
        if (u.nodeName == 'BR' && u.parentNode) {
          let f = u.nextSibling;
          for (; f && T(f);) {
            if (f.contentEditable == 'false') {
              u.parentNode.removeChild(u);
              break;
            }
            f = f.firstChild;
          }
        }
    } else if (Me && a.length) {
      let u = a.filter((f) => f.nodeName == 'BR');
      if (u.length == 2) {
        let [f, h] = u;
        f.parentNode && f.parentNode.parentNode == h.parentNode ? h.remove() : f.remove();
      } else {
        let { focusNode: f } = t.domSel.range;
        for (let h of u) {
          let d = h.parentNode;
          d && d.nodeName == 'LI' && (!f || Yu(t, f) != d) && h.remove();
        }
      }
    }
    let c = null;
    o < 0 &&
    i &&
    t.domSel.active &&
    t.input.lastFocus > Date.now() - 200 &&
    Math.max(t.input.lastTouch, t.input.lastClick.time) < Date.now() - 300 &&
    Qn(t.domSel.range) &&
    (c = li(t, t.domSel.range)) &&
    c.eq(I.near(t.state.doc.resolve(0), 1))
      ? ((t.input.lastFocus = 0), t.domSel.sync(), t.scrollToSelection())
      : (o > -1 || i) &&
        (o > -1 && Xu(t),
        t.input.badSafariComposition && ((t.input.badSafariComposition = !1), Qu(t, a)),
        qu(this.view, o, s, i, l, a),
        t.docView && t.docView.damage ? t.updateState(t.state) : i && t.domSel.sync());
  }
  registerMutation(e, t) {
    var n;
    if (t.indexOf(e.target) > -1) return null;
    let i;
    for (let o = e.target; o && !(i = this.view.docView.getDesc(o)); o = o.parentNode);
    if (
      (e.type == 'attributes' &&
        (i == this.view.docView ||
          e.attributeName == 'contenteditable' ||
          (e.attributeName == 'style' && !e.oldValue && !e.target.getAttribute('style')))) ||
      !i ||
      i.ignoreMutation(e)
    )
      return null;
    if (e.type == 'childList') {
      for (let f = 0; f < e.addedNodes.length; f++) {
        let h = e.addedNodes[f];
        (t.push(h), Z(h) && (this.lastChangedTextNode = h));
      }
      if (i.contentDOM && i.contentDOM != i.dom && !i.contentDOM.contains(e.target))
        return (i.markDamage(4), { from: i.posBefore, to: i.posAfter });
      let o = e.previousSibling,
        s = e.nextSibling,
        l = o && o.parentNode == e.target ? se(o) + 1 : 0,
        a = i.localPosFromDOM(e.target, l, -1),
        c = s && s.parentNode == e.target ? se(s) : e.target.childNodes.length,
        u = i.localPosFromDOM(e.target, c, 1);
      return (
        i.markDamage(
          !((n = i.contentDOM) === null || n === void 0) && n.contains(e.target) ? 2 : 4,
        ),
        { from: a, to: u }
      );
    } else
      return e.type == 'attributes'
        ? (i.markDamage(4), { from: i.posAtStart - i.border, to: i.posAtEnd + i.border })
        : ((this.lastChangedTextNode = e.target),
          i.markDamage(i instanceof hn && e.target == i.nodeDOM ? 8 : 4),
          { from: i.posAtStart, to: i.posAtEnd, typeOver: e.target.nodeValue == e.oldValue });
  }
}
let go = new WeakMap(),
  bo = !1;
function Xu(r) {
  if (
    !go.has(r) &&
    (go.set(r, null),
    ['normal', 'nowrap', 'pre-line'].indexOf(getComputedStyle(r.dom).whiteSpace) !== -1)
  ) {
    if (((r.requiresGeckoHackNode = Me), bo)) return;
    (console.warn(
      "ProseMirror expects the CSS white-space property to be set, preferably to 'pre-wrap'. It is recommended to load style/prosemirror.css from the prosemirror-view package.",
    ),
      (bo = !0));
  }
}
function Yu(r, e) {
  for (let t = e.parentNode; t && t != r.dom; t = t.parentNode) {
    let n = r.docView.nearestDesc(t, !0);
    if (n && n.node.isBlock) return t;
  }
  return null;
}
function Qu(r, e) {
  var t;
  let { focusNode: n, focusOffset: i } = r.domSel.range;
  for (let o of e)
    if (((t = o.parentNode) === null || t === void 0 ? void 0 : t.nodeName) == 'TR') {
      let s = o.nextSibling;
      for (; s && s.nodeName != 'TD' && s.nodeName != 'TH';) s = s.nextSibling;
      if (s) {
        let l = s;
        for (;;) {
          let a = l.firstChild;
          if (!a || !T(a) || a.contentEditable == 'false' || /^(BR|IMG)$/.test(a.nodeName)) break;
          l = a;
        }
        (l.insertBefore(o, l.firstChild), n == o && r.domSelection().collapse(o, i));
      } else o.parentNode.removeChild(o);
    }
}
class vl {
  constructor(e, t) {
    ((this._root = null),
      (this.focused = !1),
      (this.trackWrites = null),
      (this.mounted = !1),
      (this.markCursor = null),
      (this.cursorWrapper = null),
      (this.lastSelectedViewDesc = void 0),
      (this.input = new gu()),
      (this.prevDirectPlugins = []),
      (this.pluginViews = []),
      (this.requiresGeckoHackNode = !1),
      (this.dragging = null),
      (this._props = t),
      (this.state = t.state),
      (this.directPlugins = t.plugins || []),
      this.directPlugins.forEach(Mo),
      (this.dispatch = this.dispatch.bind(this)),
      (this.dom = (e && e.mount) || document.createElement('div')),
      e &&
        (e.appendChild
          ? e.appendChild(this.dom)
          : typeof e == 'function'
            ? e(this.dom)
            : e.mount && (this.mounted = !0)),
      (this.editable = ko(this)),
      wo(this),
      (this.nodeViews = xo(this)),
      (this.docView = Xi(this.state.doc, yo(this), mr(this), this.dom, this)),
      (this.domObserver = new Gu(this)),
      (this.domSel = new au(this)),
      this.domObserver.start(),
      this.domSel.read(),
      bu(this),
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
    e.handleDOMEvents != this._props.handleDOMEvents && Br(this);
    let t = this._props;
    ((this._props = e),
      e.plugins && (e.plugins.forEach(Mo), (this.directPlugins = e.plugins)),
      this.updateStateInner(e.state, t));
  }
  setProps(e) {
    let t = {};
    for (let n in this._props) t[n] = this._props[n];
    t.state = this.state;
    for (let n in e) t[n] = e[n];
    this.update(t);
  }
  updateState(e) {
    this.updateStateInner(e, this._props);
  }
  updateStateInner(e, t) {
    var n;
    let i = this.state,
      o = !1,
      s = !1;
    (e.storedMarks && this.composing && (yl(this), (s = !0)), (this.state = e));
    let l = i.plugins != e.plugins || this._props.plugins != t.plugins;
    if (l || this._props.plugins != t.plugins || this._props.nodeViews != t.nodeViews) {
      let d = xo(this);
      ef(d, this.nodeViews) && ((this.nodeViews = d), (o = !0));
    }
    ((l || t.handleDOMEvents != this._props.handleDOMEvents) && Br(this),
      (this.editable = ko(this)),
      wo(this));
    let a = mr(this),
      c = yo(this),
      u =
        i.plugins != e.plugins && !i.doc.eq(e.doc)
          ? 'reset'
          : e.scrollToSelection > i.scrollToSelection
            ? 'to selection'
            : 'preserve',
      f = o || !this.docView.matchesNode(e.doc, c, a);
    (f || !e.selection.eq(i.selection)) && (s = !0);
    let h = u == 'preserve' && s && this.dom.style.overflowAnchor == null && Dc(this);
    (s &&
      this.domObserver.stopped(() => {
        let d =
          f &&
          le &&
          !this.composing &&
          !i.selection.empty &&
          !e.selection.empty &&
          Zu(i.selection, e.selection);
        if (f) {
          let p = le ? (this.trackWrites = this.domSel.range.focusNode) : null;
          if (
            (this.composing && (this.input.compositionNode = Ru(this)),
            o || !this.docView.update(e.doc, c, a, this, -1))
          ) {
            let m = this.docView.outerDeco;
            (this.docView.destroy(), (this.docView = Xi(e.doc, c, a, this.dom, this, m)));
          }
          p && (!this.trackWrites || !this.dom.contains(this.trackWrites)) && (d = !0);
        }
        this.domSel.sync(d);
      }),
      this.updatePluginViews(i),
      !((n = this.dragging) === null || n === void 0) &&
        n.node &&
        !i.doc.eq(e.doc) &&
        this.updateDraggedNode(this.dragging, i),
      u == 'reset'
        ? (this.dom.scrollTop = 0)
        : u == 'to selection'
          ? this.scrollToSelection()
          : h && Rc(h));
  }
  scrollToSelection() {
    let e = this.domSel.range.focusNode;
    if (!(!e || !this.domSel.active)) {
      if (!this.someProp('handleScrollToSelection', (t) => t(this)))
        if (this.state.selection instanceof E) {
          let t = this.docView.domAfterPos(this.state.selection.from);
          T(t) && Ki(this, t.getBoundingClientRect(), e);
        } else Ki(this, this.coordsAtPos(this.state.selection.head, 1), e);
    }
  }
  destroyPluginViews() {
    let e;
    for (; (e = this.pluginViews.pop());) e.destroy && e.destroy();
  }
  updatePluginViews(e) {
    if (!e || e.plugins != this.state.plugins || this.directPlugins != this.prevDirectPlugins) {
      ((this.prevDirectPlugins = this.directPlugins), this.destroyPluginViews());
      for (let t = 0; t < this.directPlugins.length; t++) {
        let n = this.directPlugins[t];
        n.spec.view && this.pluginViews.push(n.spec.view(this));
      }
      for (let t = 0; t < this.state.plugins.length; t++) {
        let n = this.state.plugins[t];
        n.spec.view && this.pluginViews.push(n.spec.view(this));
      }
    } else
      for (let t = 0; t < this.pluginViews.length; t++) {
        let n = this.pluginViews[t];
        n.update && n.update(this, e);
      }
  }
  updateDraggedNode(e, t) {
    let n = e.node,
      i = -1;
    if (n.from < this.state.doc.content.size && this.state.doc.nodeAt(n.from) == n.node) i = n.from;
    else {
      let o = n.from + (this.state.doc.content.size - t.doc.content.size);
      (o > 0 && o < this.state.doc.content.size && this.state.doc.nodeAt(o)) == n.node && (i = o);
    }
    this.dragging = new kl(e.slice, e.move, i < 0 ? void 0 : E.create(this.state.doc, i));
  }
  someProp(e, t) {
    let n = this._props && this._props[e],
      i;
    if (n != null && (i = t ? t(n) : n)) return i;
    for (let s = 0; s < this.directPlugins.length; s++) {
      let l = this.directPlugins[s].props[e];
      if (l != null && (i = t ? t(l) : l)) return i;
    }
    let o = this.state.plugins;
    if (o)
      for (let s = 0; s < o.length; s++) {
        let l = o[s].props[e];
        if (l != null && (i = t ? t(l) : l)) return i;
      }
  }
  hasFocus() {
    return this.root.activeElement == this.dom;
  }
  focus() {
    (this.editable && Us(this.dom), this.domSel.sync());
  }
  get root() {
    let e = this.dom.isConnected !== !1;
    e || (this._root = null);
    let t = this._root;
    if (t == null && e) {
      for (let n = this.dom.parentNode; n; n = n.parentNode)
        if (n.nodeType == 9 || (n.nodeType == 11 && n.host))
          return (
            n.getSelection ||
              (Object.getPrototypeOf(n).getSelection = () => n.ownerDocument.getSelection()),
            (this._root = n)
          );
    }
    return t || document;
  }
  updateRoot() {
    this._root = null;
  }
  posAtCoords(e) {
    return Pc(this, e);
  }
  coordsAtPos(e, t = 1) {
    return Xs(this, e, t);
  }
  domAtPos(e, t = 0) {
    return this.docView.domFromPos(e, t);
  }
  nodeDOM(e) {
    let t = this.docView.descAt(e);
    return t ? t.nodeDOM : null;
  }
  posAtDOM(e, t, n = -1) {
    let i = this.docView.posFromDOM(e, t, n);
    if (i == null) throw new RangeError('DOM position not inside the editor');
    return i;
  }
  endOfTextblock(e, t) {
    return Wc(this, t || this.state, e);
  }
  pasteHTML(e, t) {
    return rn(this, '', e, !1, t || new ClipboardEvent('paste'));
  }
  pasteText(e, t) {
    return rn(this, e, null, !0, t || new ClipboardEvent('paste'));
  }
  serializeForClipboard(e) {
    return si(this, e);
  }
  destroy() {
    this.docView &&
      (yu(this),
      this.domSel.destroy(),
      this.destroyPluginViews(),
      this.mounted
        ? (this.docView.update(this.state.doc, [], mr(this), this, -1), (this.dom.textContent = ''))
        : this.dom.parentNode && this.dom.parentNode.removeChild(this.dom),
      this.docView.destroy(),
      (this.docView = null),
      Cc());
  }
  get isDestroyed() {
    return this.docView == null;
  }
  dispatchEvent(e) {
    return ku(this, e);
  }
  domSelection() {
    return this.root.getSelection();
  }
}
vl.prototype.dispatch = function (r) {
  let e = this._props.dispatchTransaction;
  e ? e.call(this, r) : this.updateState(this.state.apply(r));
};
function yo(r) {
  let e = Object.create(null);
  return (
    (e.class = 'ProseMirror'),
    (e.contenteditable = String(r.editable)),
    r.someProp('attributes', (t) => {
      if ((typeof t == 'function' && (t = t(r.state)), t))
        for (let n in t)
          n == 'class'
            ? (e.class += ' ' + t[n])
            : n == 'style'
              ? (e.style = (e.style ? e.style + ';' : '') + t[n])
              : !e[n] && n != 'contenteditable' && n != 'nodeName' && (e[n] = String(t[n]));
    }),
    e.translate || (e.translate = 'no'),
    [ie.node(0, r.state.doc.content.size, e)]
  );
}
function wo(r) {
  if (r.markCursor) {
    let e = document.createElement('img');
    ((e.className = 'ProseMirror-separator'),
      e.setAttribute('mark-placeholder', 'true'),
      e.setAttribute('alt', ''),
      (r.cursorWrapper = {
        dom: e,
        deco: ie.widget(r.state.selection.from, e, { raw: !0, marks: r.markCursor }),
      }));
  } else r.cursorWrapper = null;
}
function ko(r) {
  return !r.someProp('editable', (e) => e(r.state) === !1);
}
function Zu(r, e) {
  let t = Math.min(r.$anchor.sharedDepth(r.head), e.$anchor.sharedDepth(e.head));
  return r.$anchor.start(t) != e.$anchor.start(t);
}
function xo(r) {
  let e = Object.create(null);
  function t(n) {
    for (let i in n) Object.prototype.hasOwnProperty.call(e, i) || (e[i] = n[i]);
  }
  return (r.someProp('nodeViews', t), r.someProp('markViews', t), e);
}
function ef(r, e) {
  let t = 0,
    n = 0;
  for (let i in r) {
    if (r[i] != e[i]) return !0;
    t++;
  }
  for (let i in e) n++;
  return t != n;
}
function Mo(r) {
  if (r.spec.state || r.spec.filterTransaction || r.spec.appendTransaction)
    throw new RangeError('Plugins passed directly to the view must not have a state component');
}
class W extends I {
  constructor(e) {
    super(e, e);
  }
  map(e, t) {
    let n = e.resolve(t.map(this.head));
    return W.valid(n) ? new W(n) : I.near(n);
  }
  content() {
    return S.empty;
  }
  eq(e) {
    return e instanceof W && e.head == this.head;
  }
  toJSON() {
    return { type: 'gapcursor', pos: this.head };
  }
  static fromJSON(e, t) {
    if (typeof t.pos != 'number') throw new RangeError('Invalid input for GapCursor.fromJSON');
    return new W(e.resolve(t.pos));
  }
  getBookmark() {
    return new hi(this.anchor);
  }
  static valid(e) {
    let t = e.parent;
    if (t.inlineContent || !tf(e) || !nf(e)) return !1;
    let n = t.type.spec.allowGapCursor;
    if (n != null) return n;
    let i = t.contentMatchAt(e.index()).defaultType;
    return i && i.isTextblock;
  }
  static findGapCursorFrom(e, t, n = !1) {
    e: for (;;) {
      if (!n && W.valid(e)) return e;
      let i = e.pos,
        o = null;
      for (let s = e.depth; ; s--) {
        let l = e.node(s);
        if (t > 0 ? e.indexAfter(s) < l.childCount : e.index(s) > 0) {
          o = l.child(t > 0 ? e.indexAfter(s) : e.index(s) - 1);
          break;
        } else if (s == 0) return null;
        i += t;
        let a = e.doc.resolve(i);
        if (W.valid(a)) return a;
      }
      for (;;) {
        let s = t > 0 ? o.firstChild : o.lastChild;
        if (!s) {
          if (o.isAtom && !o.isText && !E.isSelectable(o)) {
            ((e = e.doc.resolve(i + o.nodeSize * t)), (n = !1));
            continue e;
          }
          break;
        }
        ((o = s), (i += t));
        let l = e.doc.resolve(i);
        if (W.valid(l)) return l;
      }
      return null;
    }
  }
}
W.prototype.visible = !1;
W.findFrom = W.findGapCursorFrom;
I.jsonID('gapcursor', W);
class hi {
  constructor(e) {
    this.pos = e;
  }
  map(e) {
    return new hi(e.map(this.pos));
  }
  resolve(e) {
    let t = e.resolve(this.pos);
    return W.valid(t) ? new W(t) : I.near(t);
  }
}
function Al(r) {
  return r.isAtom || r.spec.isolating || r.spec.createGapCursor;
}
function tf(r) {
  for (let e = r.depth; e >= 0; e--) {
    let t = r.index(e),
      n = r.node(e);
    if (t == 0) {
      if (n.type.spec.isolating) return !0;
      continue;
    }
    for (let i = n.child(t - 1); ; i = i.lastChild) {
      if ((i.childCount == 0 && !i.inlineContent) || Al(i.type)) return !0;
      if (i.inlineContent) return !1;
    }
  }
  return !0;
}
function nf(r) {
  for (let e = r.depth; e >= 0; e--) {
    let t = r.indexAfter(e),
      n = r.node(e);
    if (t == n.childCount) {
      if (n.type.spec.isolating) return !0;
      continue;
    }
    for (let i = n.child(t); ; i = i.firstChild) {
      if ((i.childCount == 0 && !i.inlineContent) || Al(i.type)) return !0;
      if (i.inlineContent) return !1;
    }
  }
  return !0;
}
function rf() {
  return new pe({
    props: {
      decorations: af,
      createSelectionBetween(r, e, t) {
        return e.pos == t.pos && W.valid(t) ? new W(t) : null;
      },
      handleClick: sf,
      handleKeyDown: of,
      handleDOMEvents: { beforeinput: lf },
    },
  });
}
const of = ri({
  ArrowLeft: yn('horiz', -1),
  ArrowRight: yn('horiz', 1),
  ArrowUp: yn('vert', -1),
  ArrowDown: yn('vert', 1),
});
function yn(r, e) {
  const t = r == 'vert' ? (e > 0 ? 'down' : 'up') : e > 0 ? 'right' : 'left';
  return function (n, i, o) {
    let s = n.selection,
      l = e > 0 ? s.$to : s.$from,
      a = s.empty;
    if (s instanceof L) {
      if (!o.endOfTextblock(t) || l.depth == 0) return !1;
      ((a = !1), (l = n.doc.resolve(e > 0 ? l.after() : l.before())));
    }
    let c = W.findGapCursorFrom(l, e, a);
    return c ? (i && i(n.tr.setSelection(new W(c))), !0) : !1;
  };
}
function sf(r, e, t) {
  if (!r || !r.editable) return !1;
  let n = r.state.doc.resolve(e);
  if (!W.valid(n)) return !1;
  let i = r.posAtCoords({ left: t.clientX, top: t.clientY });
  return i && i.inside > -1 && E.isSelectable(r.state.doc.nodeAt(i.inside))
    ? !1
    : (r.dispatch(r.state.tr.setSelection(new W(n))), !0);
}
function lf(r, e) {
  if (e.inputType != 'insertCompositionText' || !(r.state.selection instanceof W)) return !1;
  let { $from: t } = r.state.selection,
    n = t.parent.contentMatchAt(t.index()).findWrapping(r.state.schema.nodes.text);
  if (!n) return !1;
  let i = k.empty;
  for (let s = n.length - 1; s >= 0; s--) i = k.from(n[s].createAndFill(null, i));
  let o = r.state.tr.replace(t.pos, t.pos, new S(i, 0, 0));
  return (o.setSelection(L.near(o.doc.resolve(t.pos + 1))), r.dispatch(o), !1);
}
function af(r) {
  if (!(r.selection instanceof W)) return null;
  let e = document.createElement('div');
  return (
    (e.className = 'ProseMirror-gapcursor'),
    H.create(r.doc, [ie.widget(r.selection.head, e, { key: 'gapcursor' })])
  );
}
var _n = 200,
  G = function () {};
G.prototype.append = function (e) {
  return e.length
    ? ((e = G.from(e)),
      (!this.length && e) ||
        (e.length < _n && this.leafAppend(e)) ||
        (this.length < _n && e.leafPrepend(this)) ||
        this.appendInner(e))
    : this;
};
G.prototype.prepend = function (e) {
  return e.length ? G.from(e).append(this) : this;
};
G.prototype.appendInner = function (e) {
  return new cf(this, e);
};
G.prototype.slice = function (e, t) {
  return (
    e === void 0 && (e = 0),
    t === void 0 && (t = this.length),
    e >= t ? G.empty : this.sliceInner(Math.max(0, e), Math.min(this.length, t))
  );
};
G.prototype.get = function (e) {
  if (!(e < 0 || e >= this.length)) return this.getInner(e);
};
G.prototype.forEach = function (e, t, n) {
  (t === void 0 && (t = 0),
    n === void 0 && (n = this.length),
    t <= n ? this.forEachInner(e, t, n, 0) : this.forEachInvertedInner(e, t, n, 0));
};
G.prototype.map = function (e, t, n) {
  (t === void 0 && (t = 0), n === void 0 && (n = this.length));
  var i = [];
  return (
    this.forEach(
      function (o, s) {
        return i.push(e(o, s));
      },
      t,
      n,
    ),
    i
  );
};
G.from = function (e) {
  return e instanceof G ? e : e && e.length ? new Nl(e) : G.empty;
};
var Nl = (function (r) {
  function e(n) {
    (r.call(this), (this.values = n));
  }
  (r && (e.__proto__ = r),
    (e.prototype = Object.create(r && r.prototype)),
    (e.prototype.constructor = e));
  var t = { length: { configurable: !0 }, depth: { configurable: !0 } };
  return (
    (e.prototype.flatten = function () {
      return this.values;
    }),
    (e.prototype.sliceInner = function (i, o) {
      return i == 0 && o == this.length ? this : new e(this.values.slice(i, o));
    }),
    (e.prototype.getInner = function (i) {
      return this.values[i];
    }),
    (e.prototype.forEachInner = function (i, o, s, l) {
      for (var a = o; a < s; a++) if (i(this.values[a], l + a) === !1) return !1;
    }),
    (e.prototype.forEachInvertedInner = function (i, o, s, l) {
      for (var a = o - 1; a >= s; a--) if (i(this.values[a], l + a) === !1) return !1;
    }),
    (e.prototype.leafAppend = function (i) {
      if (this.length + i.length <= _n) return new e(this.values.concat(i.flatten()));
    }),
    (e.prototype.leafPrepend = function (i) {
      if (this.length + i.length <= _n) return new e(i.flatten().concat(this.values));
    }),
    (t.length.get = function () {
      return this.values.length;
    }),
    (t.depth.get = function () {
      return 0;
    }),
    Object.defineProperties(e.prototype, t),
    e
  );
})(G);
G.empty = new Nl([]);
var cf = (function (r) {
  function e(t, n) {
    (r.call(this),
      (this.left = t),
      (this.right = n),
      (this.length = t.length + n.length),
      (this.depth = Math.max(t.depth, n.depth) + 1));
  }
  return (
    r && (e.__proto__ = r),
    (e.prototype = Object.create(r && r.prototype)),
    (e.prototype.constructor = e),
    (e.prototype.flatten = function () {
      return this.left.flatten().concat(this.right.flatten());
    }),
    (e.prototype.getInner = function (n) {
      return n < this.left.length ? this.left.get(n) : this.right.get(n - this.left.length);
    }),
    (e.prototype.forEachInner = function (n, i, o, s) {
      var l = this.left.length;
      if (
        (i < l && this.left.forEachInner(n, i, Math.min(o, l), s) === !1) ||
        (o > l &&
          this.right.forEachInner(n, Math.max(i - l, 0), Math.min(this.length, o) - l, s + l) ===
            !1)
      )
        return !1;
    }),
    (e.prototype.forEachInvertedInner = function (n, i, o, s) {
      var l = this.left.length;
      if (
        (i > l && this.right.forEachInvertedInner(n, i - l, Math.max(o, l) - l, s + l) === !1) ||
        (o < l && this.left.forEachInvertedInner(n, Math.min(i, l), o, s) === !1)
      )
        return !1;
    }),
    (e.prototype.sliceInner = function (n, i) {
      if (n == 0 && i == this.length) return this;
      var o = this.left.length;
      return i <= o
        ? this.left.slice(n, i)
        : n >= o
          ? this.right.slice(n - o, i - o)
          : this.left.slice(n, o).append(this.right.slice(0, i - o));
    }),
    (e.prototype.leafAppend = function (n) {
      var i = this.right.leafAppend(n);
      if (i) return new e(this.left, i);
    }),
    (e.prototype.leafPrepend = function (n) {
      var i = this.left.leafPrepend(n);
      if (i) return new e(i, this.right);
    }),
    (e.prototype.appendInner = function (n) {
      return this.left.depth >= Math.max(this.right.depth, n.depth) + 1
        ? new e(this.left, new e(this.right, n))
        : new e(this, n);
    }),
    e
  );
})(G);
const uf = 500;
class xe {
  constructor(e, t) {
    ((this.items = e), (this.eventCount = t));
  }
  popEvent(e, t) {
    if (this.eventCount == 0) return null;
    let n = this.items.length;
    for (; ; n--)
      if (this.items.get(n - 1).selection) {
        --n;
        break;
      }
    let i, o;
    t && ((i = this.remapping(n, this.items.length)), (o = i.maps.length));
    let s = e.tr,
      l,
      a,
      c = [],
      u = [];
    return (
      this.items.forEach(
        (f, h) => {
          if (!f.step) {
            (i || ((i = this.remapping(n, h + 1)), (o = i.maps.length)), o--, u.push(f));
            return;
          }
          if (i) {
            u.push(new Se(f.map));
            let d = f.step.map(i.slice(o)),
              p;
            (d &&
              s.maybeStep(d).doc &&
              ((p = s.mapping.maps[s.mapping.maps.length - 1]),
              c.push(new Se(p, void 0, void 0, c.length + u.length))),
              o--,
              p && i.appendMap(p, o));
          } else s.maybeStep(f.step);
          if (f.selection)
            return (
              (l = i ? f.selection.map(i.slice(o)) : f.selection),
              (a = new xe(
                this.items.slice(0, n).append(u.reverse().concat(c)),
                this.eventCount - 1,
              )),
              !1
            );
        },
        this.items.length,
        0,
      ),
      { remaining: a, transform: s, selection: l }
    );
  }
  addTransform(e, t, n, i) {
    let o = [],
      s = this.eventCount,
      l = this.items,
      a = !i && l.length ? l.get(l.length - 1) : null;
    for (let u = 0; u < e.steps.length; u++) {
      let f = e.steps[u].invert(e.docs[u]),
        h = new Se(e.mapping.maps[u], f, t),
        d;
      ((d = a && a.merge(h)) && ((h = d), u ? o.pop() : (l = l.slice(0, l.length - 1))),
        o.push(h),
        t && (s++, (t = void 0)),
        i || (a = h));
    }
    let c = s - n.depth;
    return (c > hf && ((l = ff(l, c)), (s -= c)), new xe(l.append(o), s));
  }
  remapping(e, t) {
    let n = new Qt();
    return (
      this.items.forEach(
        (i, o) => {
          let s =
            i.mirrorOffset != null && o - i.mirrorOffset >= e
              ? n.maps.length - i.mirrorOffset
              : void 0;
          n.appendMap(i.map, s);
        },
        e,
        t,
      ),
      n
    );
  }
  addMaps(e) {
    return this.eventCount == 0
      ? this
      : new xe(this.items.append(e.map((t) => new Se(t))), this.eventCount);
  }
  rebased(e, t) {
    if (!this.eventCount) return this;
    t = Math.min(this.items.length, t);
    let n = [],
      i = this.items.length - t,
      o = e.mapping,
      s = e.steps.length,
      l = this.eventCount;
    this.items.forEach((h) => {
      h.selection && l--;
    }, i);
    let a = t;
    this.items.forEach((h) => {
      let d = o.getMirror(--a);
      if (d == null) return;
      s = Math.min(s, d);
      let p = o.maps[d];
      if (h.step) {
        let m = e.steps[d].invert(e.docs[d]),
          b = h.selection && h.selection.map(o.slice(a + 1, d));
        (b && l++, n.push(new Se(p, m, b)));
      } else n.push(new Se(p));
    }, i);
    let c = [];
    for (let h = t; h < s; h++) c.push(new Se(o.maps[h]));
    let u = this.items.slice(0, i).append(c).append(n),
      f = new xe(u, l);
    return (f.emptyItemCount() > uf && (f = f.compress(this.items.length - n.length)), f);
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
  compress(e = this.items.length) {
    let t = this.remapping(0, e),
      n = t.maps.length,
      i = [],
      o = 0;
    return (
      this.items.forEach(
        (s, l) => {
          if (l >= e) (i.push(s), s.selection && o++);
          else if (s.step) {
            let a = s.step.map(t.slice(n)),
              c = a && a.getMap();
            if ((n--, c && t.appendMap(c, n), a)) {
              let u = s.selection && s.selection.map(t.slice(n));
              u && o++;
              let f = new Se(c.invert(), a, u),
                h,
                d = i.length - 1;
              (h = i.length && i[d].merge(f)) ? (i[d] = h) : i.push(f);
            }
          } else s.map && n--;
        },
        this.items.length,
        0,
      ),
      new xe(G.from(i.reverse()), o)
    );
  }
}
xe.empty = new xe(G.empty, 0);
function ff(r, e) {
  let t;
  return (
    r.forEach((n, i) => {
      if (n.selection && e-- == 0) return ((t = i), !1);
    }),
    r.slice(t)
  );
}
class Se {
  constructor(e, t, n, i) {
    ((this.map = e), (this.step = t), (this.selection = n), (this.mirrorOffset = i));
  }
  merge(e) {
    if (this.step && e.step && !e.selection) {
      let t = e.step.merge(this.step);
      if (t) return new Se(t.getMap().invert(), t, this.selection);
    }
  }
}
class $e {
  constructor(e, t, n, i, o) {
    ((this.done = e),
      (this.undone = t),
      (this.prevRanges = n),
      (this.prevTime = i),
      (this.prevComposition = o));
  }
}
const hf = 20;
function df(r, e, t, n) {
  let i = t.getMeta(ot),
    o;
  if (i) return i.historyState;
  t.getMeta(bf) && (r = new $e(r.done, r.undone, null, 0, -1));
  let s = t.getMeta('appendedTransaction');
  if (t.steps.length == 0) return r;
  if (s && s.getMeta(ot))
    return s.getMeta(ot).redo
      ? new $e(
          r.done.addTransform(t, void 0, n, Tn(e)),
          r.undone,
          Co(t.mapping.maps),
          r.prevTime,
          r.prevComposition,
        )
      : new $e(
          r.done,
          r.undone.addTransform(t, void 0, n, Tn(e)),
          null,
          r.prevTime,
          r.prevComposition,
        );
  if (t.getMeta('addToHistory') !== !1 && !(s && s.getMeta('addToHistory') === !1)) {
    let l = t.getMeta('composition'),
      a =
        r.prevTime == 0 ||
        (!s &&
          r.prevComposition != l &&
          (r.prevTime < (t.time || 0) - n.newGroupDelay || !pf(t, r.prevRanges))),
      c = s ? br(r.prevRanges, t.mapping) : Co(t.mapping.maps);
    return new $e(
      r.done.addTransform(t, a ? e.selection.getBookmark() : void 0, n, Tn(e)),
      xe.empty,
      c,
      t.time,
      l ?? r.prevComposition,
    );
  } else
    return (o = t.getMeta('rebased'))
      ? new $e(
          r.done.rebased(t, o),
          r.undone.rebased(t, o),
          br(r.prevRanges, t.mapping),
          r.prevTime,
          r.prevComposition,
        )
      : new $e(
          r.done.addMaps(t.mapping.maps),
          r.undone.addMaps(t.mapping.maps),
          br(r.prevRanges, t.mapping),
          r.prevTime,
          r.prevComposition,
        );
}
function pf(r, e) {
  if (!e) return !1;
  if (!r.docChanged) return !0;
  let t = !1;
  return (
    r.mapping.maps[0].forEach((n, i) => {
      for (let o = 0; o < e.length; o += 2) n <= e[o + 1] && i >= e[o] && (t = !0);
    }),
    t
  );
}
function Co(r) {
  let e = [];
  for (let t = r.length - 1; t >= 0 && e.length == 0; t--)
    r[t].forEach((n, i, o, s) => e.push(o, s));
  return e;
}
function br(r, e) {
  if (!r) return null;
  let t = [];
  for (let n = 0; n < r.length; n += 2) {
    let i = e.map(r[n], 1),
      o = e.map(r[n + 1], -1);
    i <= o && t.push(i, o);
  }
  return t;
}
function mf(r, e) {
  for (let t = 0; t < e.steps.length; t++) {
    let n = e.mapping.maps[t],
      i = -1;
    if ((n.forEach((o, s) => (i = s)), i < 0)) {
      let o = e.steps[t];
      (o instanceof ve || o instanceof Ae) && (i = o.to);
    }
    if (i > -1) return I.near(r.doc.resolve(i));
  }
  return r.selection;
}
function gf(r, e, t) {
  let n = Tn(e),
    i = ot.get(e).spec.config,
    o = (t ? r.undone : r.done).popEvent(e, n);
  if (!o) return null;
  let s = o.selection.resolve(o.transform.doc),
    l = (t ? r.done : r.undone).addTransform(o.transform, mf(e, o.transform).getBookmark(), i, n),
    a = new $e(t ? l : o.remaining, t ? o.remaining : l, null, 0, -1);
  return o.transform.setSelection(s).setMeta(ot, { redo: t, historyState: a });
}
let yr = !1,
  So = null;
function Tn(r) {
  let e = r.plugins;
  if (So != e) {
    ((yr = !1), (So = e));
    for (let t = 0; t < e.length; t++)
      if (e[t].spec.historyPreserveItems) {
        yr = !0;
        break;
      }
  }
  return yr;
}
const ot = new ye('history'),
  bf = new ye('closeHistory');
function yf(r = {}) {
  return (
    (r = { depth: r.depth || 100, newGroupDelay: r.newGroupDelay || 500 }),
    new pe({
      key: ot,
      state: {
        init() {
          return new $e(xe.empty, xe.empty, null, 0, -1);
        },
        apply(e, t, n) {
          return df(t, n, e, r);
        },
      },
      config: r,
      props: {
        handleDOMEvents: {
          beforeinput(e, t) {
            let n = t.inputType,
              i = n == 'historyUndo' ? Tl : n == 'historyRedo' ? Ol : null;
            return !i || !e.editable ? !1 : (t.preventDefault(), i(e.state, e.dispatch));
          },
        },
      },
    })
  );
}
function El(r, e) {
  return (t, n) => {
    let i = ot.getState(t);
    if (!i || (r ? i.undone : i.done).eventCount == 0) return !1;
    if (n) {
      let o = gf(i, t, r);
      o && n(e ? o.scrollIntoView() : o);
    }
    return !0;
  };
}
const Tl = El(!1, !0),
  Ol = El(!0, !0),
  Dl = (r, e) => (r.selection.empty ? !1 : (e && e(r.tr.deleteSelection().scrollIntoView()), !0));
function wf(r, e) {
  let { $cursor: t } = r.selection;
  return !t || (e ? !e.endOfTextblock('backward', r) : t.parentOffset > 0) ? null : t;
}
const kf = (r, e, t) => {
  let n = wf(r, t);
  if (!n) return !1;
  let i = Rl(n);
  if (!i) {
    let s = n.blockRange(),
      l = s && un(s);
    return l == null ? !1 : (e && e(r.tr.lift(s, l).scrollIntoView()), !0);
  }
  let o = i.nodeBefore;
  if (zl(r, i, e, -1)) return !0;
  if (n.parent.content.size == 0 && (Dt(o, 'end') || E.isSelectable(o)))
    for (let s = n.depth; ; s--) {
      let l = ti(r.doc, n.before(s), n.after(s), S.empty);
      if (l && l.slice.size < l.to - l.from) {
        if (e) {
          let a = r.tr.step(l);
          (a.setSelection(
            Dt(o, 'end')
              ? I.findFrom(a.doc.resolve(a.mapping.map(i.pos, -1)), -1)
              : E.create(a.doc, i.pos - o.nodeSize),
          ),
            e(a.scrollIntoView()));
        }
        return !0;
      }
      if (s == 1 || n.node(s - 1).childCount > 1) break;
    }
  return o.isAtom && i.depth == n.depth - 1
    ? (e && e(r.tr.delete(i.pos - o.nodeSize, i.pos).scrollIntoView()), !0)
    : !1;
};
function Dt(r, e, t = !1) {
  for (let n = r; n; n = e == 'start' ? n.firstChild : n.lastChild) {
    if (n.isTextblock) return !0;
    if (t && n.childCount != 1) return !1;
  }
  return !1;
}
const xf = (r, e, t) => {
  let { $head: n, empty: i } = r.selection,
    o = n;
  if (!i) return !1;
  if (n.parent.isTextblock) {
    if (t ? !t.endOfTextblock('backward', r) : n.parentOffset > 0) return !1;
    o = Rl(n);
  }
  let s = o && o.nodeBefore;
  return !s || !E.isSelectable(s)
    ? !1
    : (e && e(r.tr.setSelection(E.create(r.doc, o.pos - s.nodeSize)).scrollIntoView()), !0);
};
function Rl(r) {
  if (!r.parent.type.spec.isolating)
    for (let e = r.depth - 1; e >= 0; e--) {
      if (r.index(e) > 0) return r.doc.resolve(r.before(e + 1));
      if (r.node(e).type.spec.isolating) break;
    }
  return null;
}
function Mf(r, e) {
  let { $cursor: t } = r.selection;
  return !t || (e ? !e.endOfTextblock('forward', r) : t.parentOffset < t.parent.content.size)
    ? null
    : t;
}
const Cf = (r, e, t) => {
    let n = Mf(r, t);
    if (!n) return !1;
    let i = Il(n);
    if (!i) return !1;
    let o = i.nodeAfter;
    if (zl(r, i, e, 1)) return !0;
    if (n.parent.content.size == 0 && (Dt(o, 'start') || E.isSelectable(o))) {
      let s = ti(r.doc, n.before(), n.after(), S.empty);
      if (s && s.slice.size < s.to - s.from) {
        if (e) {
          let l = r.tr.step(s);
          (l.setSelection(
            Dt(o, 'start')
              ? I.findFrom(l.doc.resolve(l.mapping.map(i.pos)), 1)
              : E.create(l.doc, l.mapping.map(i.pos)),
          ),
            e(l.scrollIntoView()));
        }
        return !0;
      }
    }
    return o.isAtom && i.depth == n.depth - 1
      ? (e && e(r.tr.delete(i.pos, i.pos + o.nodeSize).scrollIntoView()), !0)
      : !1;
  },
  Sf = (r, e, t) => {
    let { $head: n, empty: i } = r.selection,
      o = n;
    if (!i) return !1;
    if (n.parent.isTextblock) {
      if (t ? !t.endOfTextblock('forward', r) : n.parentOffset < n.parent.content.size) return !1;
      o = Il(n);
    }
    let s = o && o.nodeAfter;
    return !s || !E.isSelectable(s)
      ? !1
      : (e && e(r.tr.setSelection(E.create(r.doc, o.pos)).scrollIntoView()), !0);
  };
function Il(r) {
  if (!r.parent.type.spec.isolating)
    for (let e = r.depth - 1; e >= 0; e--) {
      let t = r.node(e);
      if (r.index(e) + 1 < t.childCount) return r.doc.resolve(r.after(e + 1));
      if (t.type.spec.isolating) break;
    }
  return null;
}
const vf = (r, e) => {
    let { $from: t, $to: n } = r.selection,
      i = t.blockRange(n),
      o = i && un(i);
    return o == null ? !1 : (e && e(r.tr.lift(i, o).scrollIntoView()), !0);
  },
  Af = (r, e) => {
    let { $head: t, $anchor: n } = r.selection;
    return !t.parent.type.spec.code || !t.sameParent(n)
      ? !1
      : (e &&
          e(
            r.tr
              .insertText(
                `
`,
              )
              .scrollIntoView(),
          ),
        !0);
  };
function di(r) {
  for (let e = 0; e < r.edgeCount; e++) {
    let { type: t } = r.edge(e);
    if (t.isTextblock && !t.hasRequiredAttrs()) return t;
  }
  return null;
}
const Ll = (r, e) => {
    let { $head: t, $anchor: n } = r.selection;
    if (!t.parent.type.spec.code || !t.sameParent(n)) return !1;
    let i = t.node(-1),
      o = t.indexAfter(-1),
      s = di(i.contentMatchAt(o));
    if (!s || !i.canReplaceWith(o, o, s)) return !1;
    if (e) {
      let l = t.after(),
        a = r.tr.replaceWith(l, l, s.createAndFill());
      (a.setSelection(I.near(a.doc.resolve(l), 1)), e(a.scrollIntoView()));
    }
    return !0;
  },
  Nf = (r, e) => {
    let t = r.selection,
      { $from: n, $to: i } = t;
    if (t instanceof he || n.parent.inlineContent || i.parent.inlineContent) return !1;
    let o = di(i.parent.contentMatchAt(i.indexAfter()));
    if (!o || !o.isTextblock) return !1;
    if (e) {
      let s = (!n.parentOffset && i.index() < i.parent.childCount ? n : i).pos,
        l = r.tr.insert(s, o.createAndFill());
      (l.setSelection(L.create(l.doc, s + 1)), e(l.scrollIntoView()));
    }
    return !0;
  },
  Ef = (r, e) => {
    let { $cursor: t } = r.selection;
    if (!t || t.parent.content.size) return !1;
    if (t.depth > 1 && t.after() != t.end(-1)) {
      let o = t.before();
      if (Mt(r.doc, o)) return (e && e(r.tr.split(o).scrollIntoView()), !0);
    }
    let n = t.blockRange(),
      i = n && un(n);
    return i == null ? !1 : (e && e(r.tr.lift(n, i).scrollIntoView()), !0);
  };
function Tf(r) {
  return (e, t) => {
    if (e.selection instanceof E && e.selection.node.isBlock) {
      let { $from: d } = e.selection;
      return !d.parentOffset || !Mt(e.doc, d.pos)
        ? !1
        : (t && t(e.tr.split(d.pos).scrollIntoView()), !0);
    }
    if (!e.selection.$from.depth) return !1;
    let n = e.tr;
    !e.selection.empty &&
      (e.selection instanceof L || e.selection instanceof he) &&
      n.deleteSelection();
    let { $from: i } = n.selection,
      o = n.steps.length,
      s = [],
      l,
      a,
      c = !1,
      u = !1;
    for (let d = i.depth; ; d--)
      if (i.node(d).isBlock) {
        ((c = i.end(d) == i.pos + (i.depth - d)),
          (u = i.start(d) == i.pos - (i.depth - d)),
          (a = di(i.node(d - 1).contentMatchAt(i.indexAfter(d - 1)))),
          s.unshift(c && a ? { type: a } : null),
          (l = d));
        break;
      } else {
        if (d == 1) return !1;
        s.unshift(null);
      }
    let f = i.pos,
      h = Mt(n.doc, f, s.length, s);
    if ((h || ((s[0] = a ? { type: a } : null), (h = Mt(n.doc, f, s.length, s))), !h)) return !1;
    if ((n.split(f, s.length, s), !c && u && i.node(l).type != a)) {
      let d = n.mapping.slice(o),
        p = d.map(i.before(l)),
        m = n.doc.resolve(p);
      a &&
        i.node(l - 1).canReplaceWith(m.index(), m.index() + 1, a) &&
        n.setNodeMarkup(d.map(i.before(l)), a);
    }
    return (t && t(n.scrollIntoView()), !0);
  };
}
const Of = Tf(),
  Df = (r, e) => (e && e(r.tr.setSelection(new he(r.doc))), !0);
function Rf(r, e, t) {
  let n = e.nodeBefore,
    i = e.nodeAfter,
    o = e.index();
  return !n || !i || !n.type.compatibleContent(i.type)
    ? !1
    : !n.content.size && e.parent.canReplace(o - 1, o)
      ? (t && t(r.tr.delete(e.pos - n.nodeSize, e.pos).scrollIntoView()), !0)
      : !e.parent.canReplace(o, o + 1) || !(i.isTextblock || Xn(r.doc, e.pos))
        ? !1
        : (t && t(r.tr.join(e.pos).scrollIntoView()), !0);
}
function zl(r, e, t, n) {
  let i = e.nodeBefore,
    o = e.nodeAfter,
    s,
    l,
    a = i.type.spec.isolating || o.type.spec.isolating;
  if (!a && Rf(r, e, t)) return !0;
  let c = !a && e.parent.canReplace(e.index(), e.index() + 1);
  if (
    c &&
    (s = (l = i.contentMatchAt(i.childCount)).findWrapping(o.type)) &&
    l.matchType(s[0] || o.type).validEnd
  ) {
    if (t) {
      let d = e.pos + o.nodeSize,
        p = k.empty;
      for (let g = s.length - 1; g >= 0; g--) p = k.from(s[g].create(null, p));
      p = k.from(i.copy(p));
      let m = r.tr.step(new ee(e.pos - 1, d, e.pos, d, new S(p, 1, 0), s.length, !0)),
        b = m.doc.resolve(d + 2 * s.length);
      (b.nodeAfter && b.nodeAfter.type == i.type && Xn(m.doc, b.pos) && m.join(b.pos),
        t(m.scrollIntoView()));
    }
    return !0;
  }
  let u = o.type.spec.isolating || (n > 0 && a) ? null : I.findFrom(e, 1),
    f = u && u.$from.blockRange(u.$to),
    h = f && un(f);
  if (h != null && h >= e.depth) return (t && t(r.tr.lift(f, h).scrollIntoView()), !0);
  if (c && Dt(o, 'start', !0) && Dt(i, 'end')) {
    let d = i,
      p = [];
    for (; p.push(d), !d.isTextblock;) d = d.lastChild;
    let m = o,
      b = 1;
    for (; !m.isTextblock; m = m.firstChild) b++;
    if (d.canReplace(d.childCount, d.childCount, m.content)) {
      if (t) {
        let g = k.empty;
        for (let w = p.length - 1; w >= 0; w--) g = k.from(p[w].copy(g));
        let y = r.tr.step(
          new ee(
            e.pos - p.length,
            e.pos + o.nodeSize,
            e.pos + b,
            e.pos + o.nodeSize - b,
            new S(g, p.length, 0),
            0,
            !0,
          ),
        );
        t(y.scrollIntoView());
      }
      return !0;
    }
  }
  return !1;
}
function Bl(r) {
  return function (e, t) {
    let n = e.selection,
      i = r < 0 ? n.$from : n.$to,
      o = i.depth;
    for (; i.node(o).isInline;) {
      if (!o) return !1;
      o--;
    }
    return i.node(o).isTextblock
      ? (t && t(e.tr.setSelection(L.create(e.doc, r < 0 ? i.start(o) : i.end(o)))), !0)
      : !1;
  };
}
const If = Bl(-1),
  Lf = Bl(1);
function zf(r, e = null) {
  return function (t, n) {
    let { $from: i, $to: o } = t.selection,
      s = i.blockRange(o),
      l = s && ei(s, r, e);
    return l ? (n && n(t.tr.wrap(s, l).scrollIntoView()), !0) : !1;
  };
}
function Pl(r, e = null) {
  return function (t, n) {
    let i = !1;
    for (let o = 0; o < t.selection.ranges.length && !i; o++) {
      let {
        $from: { pos: s },
        $to: { pos: l },
      } = t.selection.ranges[o];
      t.doc.nodesBetween(s, l, (a, c) => {
        if (i) return !1;
        if (!(!a.isTextblock || a.hasMarkup(r, e)))
          if (a.type == r) i = !0;
          else {
            let u = t.doc.resolve(c),
              f = u.index();
            i = u.parent.canReplaceWith(f, f + 1, r);
          }
      });
    }
    if (!i) return !1;
    if (n) {
      let o = t.tr;
      for (let s = 0; s < t.selection.ranges.length; s++) {
        let {
          $from: { pos: l },
          $to: { pos: a },
        } = t.selection.ranges[s];
        o.setBlockType(l, a, r, e);
      }
      n(o.scrollIntoView());
    }
    return !0;
  };
}
function Bf(r, e, t, n) {
  for (let i = 0; i < e.length; i++) {
    let { $from: o, $to: s } = e[i],
      l = o.depth == 0 ? r.inlineContent && r.type.allowsMarkType(t) : !1;
    if (
      (r.nodesBetween(o.pos, s.pos, (a, c) => {
        if (l) return !1;
        l = a.inlineContent && a.type.allowsMarkType(t);
      }),
      l)
    )
      return !0;
  }
  return !1;
}
function Qe(r, e = null, t) {
  return function (n, i) {
    let { empty: o, $cursor: s, ranges: l } = n.selection;
    if ((o && !s) || !Bf(n.doc, l, r)) return !1;
    if (i)
      if (s)
        r.isInSet(n.storedMarks || s.marks())
          ? i(n.tr.removeStoredMark(r))
          : i(n.tr.addStoredMark(r.create(e)));
      else {
        let a,
          c = n.tr;
        a = !l.some((u) => n.doc.rangeHasMark(u.$from.pos, u.$to.pos, r));
        for (let u = 0; u < l.length; u++) {
          let { $from: f, $to: h } = l[u];
          if (!a) c.removeMark(f.pos, h.pos, r);
          else {
            let d = f.pos,
              p = h.pos,
              m = f.nodeAfter,
              b = h.nodeBefore,
              g = m && m.isText ? /^\s*/.exec(m.text)[0].length : 0,
              y = b && b.isText ? /\s*$/.exec(b.text)[0].length : 0;
            (d + g < p && ((d += g), (p -= y)), c.addMark(d, p, r.create(e)));
          }
        }
        i(c.scrollIntoView());
      }
    return !0;
  };
}
function tr(...r) {
  return function (e, t, n) {
    for (let i = 0; i < r.length; i++) if (r[i](e, t, n)) return !0;
    return !1;
  };
}
let wr = tr(Dl, kf, xf),
  vo = tr(Dl, Cf, Sf);
const Ie = {
    Enter: tr(Af, Nf, Ef, Of),
    'Mod-Enter': Ll,
    Backspace: wr,
    'Mod-Backspace': wr,
    'Shift-Backspace': wr,
    Delete: vo,
    'Mod-Delete': vo,
    'Mod-a': Df,
  },
  Fl = {
    'Ctrl-h': Ie.Backspace,
    'Alt-Backspace': Ie['Mod-Backspace'],
    'Ctrl-d': Ie.Delete,
    'Ctrl-Alt-Backspace': Ie['Mod-Delete'],
    'Alt-Delete': Ie['Mod-Delete'],
    'Alt-d': Ie['Mod-Delete'],
    'Ctrl-a': If,
    'Ctrl-e': Lf,
  };
for (let r in Ie) Fl[r] = Ie[r];
const Pf =
    typeof navigator < 'u'
      ? /Mac|iP(hone|[oa]d)/.test(navigator.platform)
      : typeof os < 'u' && os.platform
        ? os.platform() == 'darwin'
        : !1,
  Ff = Pf ? Fl : Ie;
function $f(r, e = null) {
  return function (t, n) {
    let { $from: i, $to: o } = t.selection,
      s = i.blockRange(o);
    if (!s) return !1;
    let l = n ? t.tr : null;
    return Vf(l, s, r, e) ? (n && n(l.scrollIntoView()), !0) : !1;
  };
}
function Vf(r, e, t, n = null) {
  let i = !1,
    o = e,
    s = e.$from.doc;
  if (e.depth >= 2 && e.$from.node(e.depth - 1).type.compatibleContent(t) && e.startIndex == 0) {
    if (e.$from.index(e.depth - 1) == 0) return !1;
    let a = s.resolve(e.start - 2);
    ((o = new zn(a, a, e.depth)),
      e.endIndex < e.parent.childCount &&
        (e = new zn(e.$from, s.resolve(e.$to.end(e.depth)), e.depth)),
      (i = !0));
  }
  let l = ei(o, t, n, e);
  return l ? (r && Hf(r, e, l, i, t), !0) : !1;
}
function Hf(r, e, t, n, i) {
  let o = k.empty;
  for (let u = t.length - 1; u >= 0; u--) o = k.from(t[u].type.create(t[u].attrs, o));
  r.step(new ee(e.start - (n ? 2 : 0), e.end, e.start, e.end, new S(o, 0, 0), t.length, !0));
  let s = 0;
  for (let u = 0; u < t.length; u++) t[u].type == i && (s = u + 1);
  let l = t.length - s,
    a = e.start + t.length - (n ? 2 : 0),
    c = e.parent;
  for (let u = e.startIndex, f = e.endIndex, h = !0; u < f; u++, h = !1)
    (!h && l && Mt(r.doc, a, l) && (r.split(a, l), (a += 2 * l)), (a += c.child(u).nodeSize));
  return r;
}
function Rt(r, e) {
  return r instanceof Xt ? e == r : r.indexOf(e) > -1;
}
function Wf(r, e) {
  return function (t, n) {
    let { $from: i, $to: o, node: s } = t.selection;
    if ((s && s.isBlock) || i.depth < 2 || !i.sameParent(o)) return !1;
    let l = i.node(-1);
    if (!Rt(r, l.type)) return !1;
    if (i.parent.content.size == 0 && i.node(-1).childCount == i.indexAfter(-1)) {
      if (i.depth == 3 || !Rt(r, i.node(-3).type) || i.index(-2) != i.node(-2).childCount - 1)
        return !1;
      if (n) {
        let f = k.empty,
          h = i.index(-1) ? 1 : i.index(-2) ? 2 : 3;
        for (let g = i.depth - h; g >= i.depth - 3; g--) f = k.from(i.node(g).copy(f));
        let d =
          i.indexAfter(-1) < i.node(-2).childCount
            ? 1
            : i.indexAfter(-2) < i.node(-3).childCount
              ? 2
              : 3;
        f = f.append(k.from(i.node(-3).type.createAndFill()));
        let p = i.before(i.depth - (h - 1)),
          m = t.tr.replace(p, i.after(-d), new S(f, 4 - h, 0)),
          b = -1;
        (m.doc.nodesBetween(p, m.doc.content.size, (g, y) => {
          if (b > -1) return !1;
          g.isTextblock && g.content.size == 0 && (b = y + 1);
        }),
          b > -1 && m.setSelection(I.near(m.doc.resolve(b))),
          n(m.scrollIntoView()));
      }
      return !0;
    }
    let a = o.pos == i.end() ? l.contentMatchAt(0).defaultType : null,
      c = t.tr.delete(i.pos, o.pos),
      u = a || e ? [null, a ? { type: a } : null] : void 0;
    return Mt(c.doc, i.pos, 2, u) ? (n && n(c.split(i.pos, 2, u).scrollIntoView()), !0) : !1;
  };
}
function $l(r) {
  return function (e, t) {
    let { $from: n, $to: i } = e.selection,
      o = n.blockRange(i, (s) => s.childCount > 0 && Rt(r, s.firstChild.type));
    return o ? (t ? (Rt(r, n.node(o.depth - 1).type) ? qf(e, t, o) : Jf(e, t, o)) : !0) : !1;
  };
}
function qf(r, e, t) {
  let n = r.tr,
    i = t.end,
    o = t.$to.end(t.depth),
    s = t.parent.child(t.endIndex - 1).type;
  i < o &&
    (n.step(new ee(i - 1, o, i, o, new S(k.from(s.create(null, t.parent.copy())), 1, 0), 1, !0)),
    (t = new zn(n.doc.resolve(t.$from.pos), n.doc.resolve(o), t.depth)));
  const l = un(t);
  if (l == null) return !1;
  n.lift(t, l);
  let a = n.doc.resolve(n.mapping.map(i, -1) - 1);
  return (
    Xn(n.doc, a.pos) && a.nodeBefore.type == a.nodeAfter.type && n.join(a.pos),
    e(n.scrollIntoView()),
    !0
  );
}
function Jf(r, e, t) {
  let n = r.tr,
    i = t.parent;
  for (let d = t.end, p = t.endIndex - 1, m = t.startIndex; p > m; p--)
    ((d -= i.child(p).nodeSize), n.delete(d - 1, d + 1));
  let o = n.doc.resolve(t.start),
    s = o.nodeAfter;
  if (n.mapping.map(t.end) != t.start + o.nodeAfter.nodeSize) return !1;
  let l = t.startIndex == 0,
    a = t.endIndex == i.childCount,
    c = o.node(-1),
    u = o.index(-1);
  if (!c.canReplace(u + (l ? 0 : 1), u + 1, s.content.append(a ? k.empty : k.from(i)))) return !1;
  let f = o.pos,
    h = f + s.nodeSize;
  return (
    n.step(
      new ee(
        f - (l ? 1 : 0),
        h + (a ? 1 : 0),
        f + 1,
        h - 1,
        new S(
          (l ? k.empty : k.from(i.copy(k.empty))).append(a ? k.empty : k.from(i.copy(k.empty))),
          l ? 0 : 1,
          a ? 0 : 1,
        ),
        l ? 0 : 1,
      ),
    ),
    e(n.scrollIntoView()),
    !0
  );
}
function _f(r) {
  return function (e, t) {
    let { $from: n, $to: i } = e.selection,
      o = n.blockRange(i, (c) => c.childCount > 0 && Rt(r, c.firstChild.type));
    if (!o) return !1;
    let s = o.startIndex;
    if (s == 0) return !1;
    let l = o.parent,
      a = l.child(s - 1);
    if (!Rt(r, a.type)) return !1;
    if (t) {
      let c = a.lastChild && a.lastChild.type == l.type,
        u = k.from(c ? a.lastChild.lastChild.type.create() : null),
        f = new S(k.from(a.type.create(null, k.from(l.type.create(null, u)))), c ? 3 : 1, 0),
        h = o.start,
        d = o.end;
      t(e.tr.step(new ee(h - (c ? 3 : 1), d, h, d, f, 1, !0)).scrollIntoView());
    }
    return !0;
  };
}
let $r, Vr;
if (typeof WeakMap < 'u') {
  let r = new WeakMap();
  (($r = (e) => r.get(e)), (Vr = (e, t) => (r.set(e, t), t)));
} else {
  const r = [];
  let t = 0;
  (($r = (n) => {
    for (let i = 0; i < r.length; i += 2) if (r[i] == n) return r[i + 1];
  }),
    (Vr = (n, i) => (t == 10 && (t = 0), (r[t++] = n), (r[t++] = i))));
}
var q = class {
  constructor(r, e, t, n) {
    ((this.width = r), (this.height = e), (this.map = t), (this.problems = n));
  }
  findCell(r) {
    for (let e = 0; e < this.map.length; e++) {
      const t = this.map[e];
      if (t != r) continue;
      const n = e % this.width,
        i = (e / this.width) | 0;
      let o = n + 1,
        s = i + 1;
      for (let l = 1; o < this.width && this.map[e + l] == t; l++) o++;
      for (let l = 1; s < this.height && this.map[e + this.width * l] == t; l++) s++;
      return { left: n, top: i, right: o, bottom: s };
    }
    throw new RangeError(`No cell with offset ${r} found`);
  }
  colCount(r) {
    for (let e = 0; e < this.map.length; e++) if (this.map[e] == r) return e % this.width;
    throw new RangeError(`No cell with offset ${r} found`);
  }
  nextCell(r, e, t) {
    const { left: n, right: i, top: o, bottom: s } = this.findCell(r);
    return e == 'horiz'
      ? (t < 0 ? n == 0 : i == this.width)
        ? null
        : this.map[o * this.width + (t < 0 ? n - 1 : i)]
      : (t < 0 ? o == 0 : s == this.height)
        ? null
        : this.map[n + this.width * (t < 0 ? o - 1 : s)];
  }
  rectBetween(r, e) {
    const { left: t, right: n, top: i, bottom: o } = this.findCell(r),
      { left: s, right: l, top: a, bottom: c } = this.findCell(e);
    return {
      left: Math.min(t, s),
      top: Math.min(i, a),
      right: Math.max(n, l),
      bottom: Math.max(o, c),
    };
  }
  cellsInRect(r) {
    const e = [],
      t = {};
    for (let n = r.top; n < r.bottom; n++)
      for (let i = r.left; i < r.right; i++) {
        const o = n * this.width + i,
          s = this.map[o];
        t[s] ||
          ((t[s] = !0),
          !(
            (i == r.left && i && this.map[o - 1] == s) ||
            (n == r.top && n && this.map[o - this.width] == s)
          ) && e.push(s));
      }
    return e;
  }
  positionAt(r, e, t) {
    for (let n = 0, i = 0; ; n++) {
      const o = i + t.child(n).nodeSize;
      if (n == r) {
        let s = e + r * this.width;
        const l = (r + 1) * this.width;
        for (; s < l && this.map[s] < i;) s++;
        return s == l ? o - 1 : this.map[s];
      }
      i = o;
    }
  }
  static get(r) {
    return $r(r) || Vr(r, Kf(r));
  }
};
function Kf(r) {
  if (r.type.spec.tableRole != 'table') throw new RangeError('Not a table node: ' + r.type.name);
  const e = Uf(r),
    t = r.childCount,
    n = [];
  let i = 0,
    o = null;
  const s = [];
  for (let c = 0, u = e * t; c < u; c++) n[c] = 0;
  for (let c = 0, u = 0; c < t; c++) {
    const f = r.child(c);
    u++;
    for (let p = 0; ; p++) {
      for (; i < n.length && n[i] != 0;) i++;
      if (p == f.childCount) break;
      const m = f.child(p),
        { colspan: b, rowspan: g, colwidth: y } = m.attrs;
      for (let w = 0; w < g; w++) {
        if (w + c >= t) {
          (o || (o = [])).push({ type: 'overlong_rowspan', pos: u, n: g - w });
          break;
        }
        const N = i + w * e;
        for (let z = 0; z < b; z++) {
          n[N + z] == 0
            ? (n[N + z] = u)
            : (o || (o = [])).push({ type: 'collision', row: c, pos: u, n: b - z });
          const F = y && y[z];
          if (F) {
            const C = ((N + z) % e) * 2,
              v = s[C];
            v == null || (v != F && s[C + 1] == 1)
              ? ((s[C] = F), (s[C + 1] = 1))
              : v == F && s[C + 1]++;
          }
        }
      }
      ((i += b), (u += m.nodeSize));
    }
    const h = (c + 1) * e;
    let d = 0;
    for (; i < h;) n[i++] == 0 && d++;
    (d && (o || (o = [])).push({ type: 'missing', row: c, n: d }), u++);
  }
  (e === 0 || t === 0) && (o || (o = [])).push({ type: 'zero_sized' });
  const l = new q(e, t, n, o);
  let a = !1;
  for (let c = 0; !a && c < s.length; c += 2) s[c] != null && s[c + 1] < t && (a = !0);
  return (a && jf(l, s, r), l);
}
function Uf(r) {
  let e = -1,
    t = !1;
  for (let n = 0; n < r.childCount; n++) {
    const i = r.child(n);
    let o = 0;
    if (t)
      for (let s = 0; s < n; s++) {
        const l = r.child(s);
        for (let a = 0; a < l.childCount; a++) {
          const c = l.child(a);
          s + c.attrs.rowspan > n && (o += c.attrs.colspan);
        }
      }
    for (let s = 0; s < i.childCount; s++) {
      const l = i.child(s);
      ((o += l.attrs.colspan), l.attrs.rowspan > 1 && (t = !0));
    }
    e == -1 ? (e = o) : e != o && (e = Math.max(e, o));
  }
  return e;
}
function jf(r, e, t) {
  r.problems || (r.problems = []);
  const n = {};
  for (let i = 0; i < r.map.length; i++) {
    const o = r.map[i];
    if (n[o]) continue;
    n[o] = !0;
    const s = t.nodeAt(o);
    if (!s) throw new RangeError(`No cell with offset ${o} found`);
    let l = null;
    const a = s.attrs;
    for (let c = 0; c < a.colspan; c++) {
      const u = e[((i + c) % r.width) * 2];
      u != null && (!a.colwidth || a.colwidth[c] != u) && ((l || (l = Gf(a)))[c] = u);
    }
    l && r.problems.unshift({ type: 'colwidth mismatch', pos: o, colwidth: l });
  }
}
function Gf(r) {
  if (r.colwidth) return r.colwidth.slice();
  const e = [];
  for (let t = 0; t < r.colspan; t++) e.push(0);
  return e;
}
function Ao(r, e) {
  if (typeof r == 'string') return {};
  const t = r.getAttribute('data-colwidth'),
    n = t && /^\d+(,\d+)*$/.test(t) ? t.split(',').map((s) => Number(s)) : null,
    i = Number(r.getAttribute('colspan') || 1),
    o = {
      colspan: i,
      rowspan: Number(r.getAttribute('rowspan') || 1),
      colwidth: n && n.length == i ? n : null,
    };
  for (const s in e) {
    const l = e[s].getFromDOM,
      a = l && l(r);
    a != null && (o[s] = a);
  }
  return o;
}
function No(r, e) {
  const t = {};
  (r.attrs.colspan != 1 && (t.colspan = r.attrs.colspan),
    r.attrs.rowspan != 1 && (t.rowspan = r.attrs.rowspan),
    r.attrs.colwidth && (t['data-colwidth'] = r.attrs.colwidth.join(',')));
  for (const n in e) {
    const i = e[n].setDOMAttr;
    i && i(r.attrs[n], t);
  }
  return t;
}
function Xf(r) {
  if (r !== null) {
    if (!Array.isArray(r)) throw new TypeError('colwidth must be null or an array');
    for (const e of r)
      if (typeof e != 'number') throw new TypeError('colwidth must be null or an array of numbers');
  }
}
function Yf(r) {
  const e = r.cellAttributes || {},
    t = {
      colspan: { default: 1, validate: 'number' },
      rowspan: { default: 1, validate: 'number' },
      colwidth: { default: null, validate: Xf },
    };
  for (const n in e) t[n] = { default: e[n].default, validate: e[n].validate };
  return {
    table: {
      content: 'table_row+',
      tableRole: 'table',
      isolating: !0,
      group: r.tableGroup,
      parseDOM: [{ tag: 'table' }],
      toDOM() {
        return ['table', ['tbody', 0]];
      },
    },
    table_row: {
      content: '(table_cell | table_header)*',
      tableRole: 'row',
      parseDOM: [{ tag: 'tr' }],
      toDOM() {
        return ['tr', 0];
      },
    },
    table_cell: {
      content: r.cellContent,
      attrs: t,
      tableRole: 'cell',
      isolating: !0,
      parseDOM: [{ tag: 'td', getAttrs: (n) => Ao(n, e) }],
      toDOM(n) {
        return ['td', No(n, e), 0];
      },
    },
    table_header: {
      content: r.cellContent,
      attrs: t,
      tableRole: 'header_cell',
      isolating: !0,
      parseDOM: [{ tag: 'th', getAttrs: (n) => Ao(n, e) }],
      toDOM(n) {
        return ['th', No(n, e), 0];
      },
    },
  };
}
function oe(r) {
  let e = r.cached.tableNodeTypes;
  if (!e) {
    e = r.cached.tableNodeTypes = {};
    for (const t in r.nodes) {
      const n = r.nodes[t],
        i = n.spec.tableRole;
      i && (e[i] = n);
    }
  }
  return e;
}
const We = new ye('selectingCells');
function ft(r) {
  for (let e = r.depth - 1; e > 0; e--)
    if (r.node(e).type.spec.tableRole == 'row') return r.node(0).resolve(r.before(e + 1));
  return null;
}
function Qf(r) {
  for (let e = r.depth; e > 0; e--) {
    const t = r.node(e).type.spec.tableRole;
    if (t === 'cell' || t === 'header_cell') return r.node(e);
  }
  return null;
}
function X(r) {
  const e = r.selection.$head;
  for (let t = e.depth; t > 0; t--) if (e.node(t).type.spec.tableRole == 'row') return !0;
  return !1;
}
function nr(r) {
  const e = r.selection;
  if ('$anchorCell' in e && e.$anchorCell)
    return e.$anchorCell.pos > e.$headCell.pos ? e.$anchorCell : e.$headCell;
  if ('node' in e && e.node && e.node.type.spec.tableRole == 'cell') return e.$anchor;
  const t = ft(e.$head) || Zf(e.$head);
  if (t) return t;
  throw new RangeError(`No cell found around position ${e.head}`);
}
function Zf(r) {
  for (let e = r.nodeAfter, t = r.pos; e; e = e.firstChild, t++) {
    const n = e.type.spec.tableRole;
    if (n == 'cell' || n == 'header_cell') return r.doc.resolve(t);
  }
  for (let e = r.nodeBefore, t = r.pos; e; e = e.lastChild, t--) {
    const n = e.type.spec.tableRole;
    if (n == 'cell' || n == 'header_cell') return r.doc.resolve(t - e.nodeSize);
  }
}
function Hr(r) {
  return r.parent.type.spec.tableRole == 'row' && !!r.nodeAfter;
}
function eh(r) {
  return r.node(0).resolve(r.pos + r.nodeAfter.nodeSize);
}
function pi(r, e) {
  return r.depth == e.depth && r.pos >= e.start(-1) && r.pos <= e.end(-1);
}
function Vl(r, e, t) {
  const n = r.node(-1),
    i = q.get(n),
    o = r.start(-1),
    s = i.nextCell(r.pos - o, e, t);
  return s == null ? null : r.node(0).resolve(o + s);
}
function ht(r, e, t = 1) {
  const n = { ...r, colspan: r.colspan - t };
  return (
    n.colwidth &&
      ((n.colwidth = n.colwidth.slice()),
      n.colwidth.splice(e, t),
      n.colwidth.some((i) => i > 0) || (n.colwidth = null)),
    n
  );
}
function Hl(r, e, t = 1) {
  const n = { ...r, colspan: r.colspan + t };
  if (n.colwidth) {
    n.colwidth = n.colwidth.slice();
    for (let i = 0; i < t; i++) n.colwidth.splice(e, 0, 0);
  }
  return n;
}
function th(r, e, t) {
  const n = oe(e.type.schema).header_cell;
  for (let i = 0; i < r.height; i++) if (e.nodeAt(r.map[t + i * r.width]).type != n) return !1;
  return !0;
}
var V = class De extends I {
  constructor(e, t = e) {
    const n = e.node(-1),
      i = q.get(n),
      o = e.start(-1),
      s = i.rectBetween(e.pos - o, t.pos - o),
      l = e.node(0),
      a = i.cellsInRect(s).filter((u) => u != t.pos - o);
    a.unshift(t.pos - o);
    const c = a.map((u) => {
      const f = n.nodeAt(u);
      if (!f) throw new RangeError(`No cell with offset ${u} found`);
      const h = o + u + 1;
      return new Ps(l.resolve(h), l.resolve(h + f.content.size));
    });
    (super(c[0].$from, c[0].$to, c), (this.$anchorCell = e), (this.$headCell = t));
  }
  map(e, t) {
    const n = e.resolve(t.map(this.$anchorCell.pos)),
      i = e.resolve(t.map(this.$headCell.pos));
    if (Hr(n) && Hr(i) && pi(n, i)) {
      const o = this.$anchorCell.node(-1) != n.node(-1);
      return o && this.isRowSelection()
        ? De.rowSelection(n, i)
        : o && this.isColSelection()
          ? De.colSelection(n, i)
          : new De(n, i);
    }
    return L.between(n, i);
  }
  content() {
    const e = this.$anchorCell.node(-1),
      t = q.get(e),
      n = this.$anchorCell.start(-1),
      i = t.rectBetween(this.$anchorCell.pos - n, this.$headCell.pos - n),
      o = {},
      s = [];
    for (let a = i.top; a < i.bottom; a++) {
      const c = [];
      for (let u = a * t.width + i.left, f = i.left; f < i.right; f++, u++) {
        const h = t.map[u];
        if (o[h]) continue;
        o[h] = !0;
        const d = t.findCell(h);
        let p = e.nodeAt(h);
        if (!p) throw new RangeError(`No cell with offset ${h} found`);
        const m = i.left - d.left,
          b = d.right - i.right;
        if (m > 0 || b > 0) {
          let g = p.attrs;
          if (
            (m > 0 && (g = ht(g, 0, m)), b > 0 && (g = ht(g, g.colspan - b, b)), d.left < i.left)
          ) {
            if (((p = p.type.createAndFill(g)), !p))
              throw new RangeError(`Could not create cell with attrs ${JSON.stringify(g)}`);
          } else p = p.type.create(g, p.content);
        }
        if (d.top < i.top || d.bottom > i.bottom) {
          const g = { ...p.attrs, rowspan: Math.min(d.bottom, i.bottom) - Math.max(d.top, i.top) };
          d.top < i.top ? (p = p.type.createAndFill(g)) : (p = p.type.create(g, p.content));
        }
        c.push(p);
      }
      s.push(e.child(a).copy(k.from(c)));
    }
    const l = this.isColSelection() && this.isRowSelection() ? e : s;
    return new S(k.from(l), 1, 1);
  }
  replace(e, t = S.empty) {
    const n = e.steps.length,
      i = this.ranges;
    for (let s = 0; s < i.length; s++) {
      const { $from: l, $to: a } = i[s],
        c = e.mapping.slice(n);
      e.replace(c.map(l.pos), c.map(a.pos), s ? S.empty : t);
    }
    const o = I.findFrom(e.doc.resolve(e.mapping.slice(n).map(this.to)), -1);
    o && e.setSelection(o);
  }
  replaceWith(e, t) {
    this.replace(e, new S(k.from(t), 0, 0));
  }
  forEachCell(e) {
    const t = this.$anchorCell.node(-1),
      n = q.get(t),
      i = this.$anchorCell.start(-1),
      o = n.cellsInRect(n.rectBetween(this.$anchorCell.pos - i, this.$headCell.pos - i));
    for (let s = 0; s < o.length; s++) e(t.nodeAt(o[s]), i + o[s]);
  }
  isColSelection() {
    const e = this.$anchorCell.index(-1),
      t = this.$headCell.index(-1);
    if (Math.min(e, t) > 0) return !1;
    const n = e + this.$anchorCell.nodeAfter.attrs.rowspan,
      i = t + this.$headCell.nodeAfter.attrs.rowspan;
    return Math.max(n, i) == this.$headCell.node(-1).childCount;
  }
  static colSelection(e, t = e) {
    const n = e.node(-1),
      i = q.get(n),
      o = e.start(-1),
      s = i.findCell(e.pos - o),
      l = i.findCell(t.pos - o),
      a = e.node(0);
    return (
      s.top <= l.top
        ? (s.top > 0 && (e = a.resolve(o + i.map[s.left])),
          l.bottom < i.height && (t = a.resolve(o + i.map[i.width * (i.height - 1) + l.right - 1])))
        : (l.top > 0 && (t = a.resolve(o + i.map[l.left])),
          s.bottom < i.height &&
            (e = a.resolve(o + i.map[i.width * (i.height - 1) + s.right - 1]))),
      new De(e, t)
    );
  }
  isRowSelection() {
    const e = this.$anchorCell.node(-1),
      t = q.get(e),
      n = this.$anchorCell.start(-1),
      i = t.colCount(this.$anchorCell.pos - n),
      o = t.colCount(this.$headCell.pos - n);
    if (Math.min(i, o) > 0) return !1;
    const s = i + this.$anchorCell.nodeAfter.attrs.colspan,
      l = o + this.$headCell.nodeAfter.attrs.colspan;
    return Math.max(s, l) == t.width;
  }
  eq(e) {
    return (
      e instanceof De &&
      e.$anchorCell.pos == this.$anchorCell.pos &&
      e.$headCell.pos == this.$headCell.pos
    );
  }
  static rowSelection(e, t = e) {
    const n = e.node(-1),
      i = q.get(n),
      o = e.start(-1),
      s = i.findCell(e.pos - o),
      l = i.findCell(t.pos - o),
      a = e.node(0);
    return (
      s.left <= l.left
        ? (s.left > 0 && (e = a.resolve(o + i.map[s.top * i.width])),
          l.right < i.width && (t = a.resolve(o + i.map[i.width * (l.top + 1) - 1])))
        : (l.left > 0 && (t = a.resolve(o + i.map[l.top * i.width])),
          s.right < i.width && (e = a.resolve(o + i.map[i.width * (s.top + 1) - 1]))),
      new De(e, t)
    );
  }
  toJSON() {
    return { type: 'cell', anchor: this.$anchorCell.pos, head: this.$headCell.pos };
  }
  static fromJSON(e, t) {
    return new De(e.resolve(t.anchor), e.resolve(t.head));
  }
  static create(e, t, n = t) {
    return new De(e.resolve(t), e.resolve(n));
  }
  getBookmark() {
    return new nh(this.$anchorCell.pos, this.$headCell.pos);
  }
};
V.prototype.visible = !1;
I.jsonID('cell', V);
var nh = class Wl {
  constructor(e, t) {
    ((this.anchor = e), (this.head = t));
  }
  map(e) {
    return new Wl(e.map(this.anchor), e.map(this.head));
  }
  resolve(e) {
    const t = e.resolve(this.anchor),
      n = e.resolve(this.head);
    return t.parent.type.spec.tableRole == 'row' &&
      n.parent.type.spec.tableRole == 'row' &&
      t.index() < t.parent.childCount &&
      n.index() < n.parent.childCount &&
      pi(t, n)
      ? new V(t, n)
      : I.near(n, 1);
  }
};
function rh(r) {
  if (!(r.selection instanceof V)) return null;
  const e = [];
  return (
    r.selection.forEachCell((t, n) => {
      e.push(ie.node(n, n + t.nodeSize, { class: 'selectedCell' }));
    }),
    H.create(r.doc, e)
  );
}
function ih({ $from: r, $to: e }) {
  if (r.pos == e.pos || r.pos < e.pos - 6) return !1;
  let t = r.pos,
    n = e.pos,
    i = r.depth;
  for (; i >= 0 && !(r.after(i + 1) < r.end(i)); i--, t++);
  for (let o = e.depth; o >= 0 && !(e.before(o + 1) > e.start(o)); o--, n--);
  return t == n && /row|table/.test(r.node(i).type.spec.tableRole);
}
function oh({ $from: r, $to: e }) {
  let t, n;
  for (let i = r.depth; i > 0; i--) {
    const o = r.node(i);
    if (o.type.spec.tableRole === 'cell' || o.type.spec.tableRole === 'header_cell') {
      t = o;
      break;
    }
  }
  for (let i = e.depth; i > 0; i--) {
    const o = e.node(i);
    if (o.type.spec.tableRole === 'cell' || o.type.spec.tableRole === 'header_cell') {
      n = o;
      break;
    }
  }
  return t !== n && e.parentOffset === 0;
}
function sh(r, e, t) {
  const n = (e || r).selection,
    i = (e || r).doc;
  let o, s;
  if (n instanceof E && (s = n.node.type.spec.tableRole)) {
    if (s == 'cell' || s == 'header_cell') o = V.create(i, n.from);
    else if (s == 'row') {
      const l = i.resolve(n.from + 1);
      o = V.rowSelection(l, l);
    } else if (!t) {
      const l = q.get(n.node),
        a = n.from + 1,
        c = a + l.map[l.width * l.height - 1];
      o = V.create(i, a + 1, c);
    }
  } else
    n instanceof L && ih(n)
      ? (o = L.create(i, n.from))
      : n instanceof L && oh(n) && (o = L.create(i, n.$from.start(), n.$from.end()));
  return (o && (e || (e = r.tr)).setSelection(o), e);
}
const lh = new ye('fix-tables');
function ql(r, e, t, n) {
  const i = r.childCount,
    o = e.childCount;
  e: for (let s = 0, l = 0; s < o; s++) {
    const a = e.child(s);
    for (let c = l, u = Math.min(i, s + 3); c < u; c++)
      if (r.child(c) == a) {
        ((l = c + 1), (t += a.nodeSize));
        continue e;
      }
    (n(a, t),
      l < i && r.child(l).sameMarkup(a)
        ? ql(r.child(l), a, t + 1, n)
        : a.nodesBetween(0, a.content.size, n, t + 1),
      (t += a.nodeSize));
  }
}
function ah(r, e) {
  let t;
  const n = (i, o) => {
    i.type.spec.tableRole == 'table' && (t = ch(r, i, o, t));
  };
  return (e ? e.doc != r.doc && ql(e.doc, r.doc, 0, n) : r.doc.descendants(n), t);
}
function ch(r, e, t, n) {
  const i = q.get(e);
  if (!i.problems) return n;
  n || (n = r.tr);
  const o = [];
  for (let a = 0; a < i.height; a++) o.push(0);
  for (let a = 0; a < i.problems.length; a++) {
    const c = i.problems[a];
    if (c.type == 'collision') {
      const u = e.nodeAt(c.pos);
      if (!u) continue;
      const f = u.attrs;
      for (let h = 0; h < f.rowspan; h++) o[c.row + h] += c.n;
      n.setNodeMarkup(n.mapping.map(t + 1 + c.pos), null, ht(f, f.colspan - c.n, c.n));
    } else if (c.type == 'missing') o[c.row] += c.n;
    else if (c.type == 'overlong_rowspan') {
      const u = e.nodeAt(c.pos);
      if (!u) continue;
      n.setNodeMarkup(n.mapping.map(t + 1 + c.pos), null, {
        ...u.attrs,
        rowspan: u.attrs.rowspan - c.n,
      });
    } else if (c.type == 'colwidth mismatch') {
      const u = e.nodeAt(c.pos);
      if (!u) continue;
      n.setNodeMarkup(n.mapping.map(t + 1 + c.pos), null, { ...u.attrs, colwidth: c.colwidth });
    } else if (c.type == 'zero_sized') {
      const u = n.mapping.map(t);
      n.delete(u, u + e.nodeSize);
    }
  }
  let s, l;
  for (let a = 0; a < o.length; a++) o[a] && (s == null && (s = a), (l = a));
  for (let a = 0, c = t + 1; a < i.height; a++) {
    const u = e.child(a),
      f = c + u.nodeSize,
      h = o[a];
    if (h > 0) {
      let d = 'cell';
      u.firstChild && (d = u.firstChild.type.spec.tableRole);
      const p = [];
      for (let b = 0; b < h; b++) {
        const g = oe(r.schema)[d].createAndFill();
        g && p.push(g);
      }
      const m = (a == 0 || s == a - 1) && l == a ? c + 1 : f - 1;
      n.insert(n.mapping.map(m), p);
    }
    c = f;
  }
  return n.setMeta(lh, { fixTables: !0 });
}
function mi(r) {
  return uh((e) => e.type.spec.tableRole === 'table', r);
}
function uh(r, e) {
  for (let t = e.depth; t >= 0; t -= 1) {
    const n = e.node(t);
    if (r(n)) return { node: n, pos: t === 0 ? 0 : e.before(t), start: e.start(t), depth: t };
  }
  return null;
}
function Ee(r) {
  const e = r.selection,
    t = nr(r),
    n = t.node(-1),
    i = t.start(-1),
    o = q.get(n);
  return {
    ...(e instanceof V
      ? o.rectBetween(e.$anchorCell.pos - i, e.$headCell.pos - i)
      : o.findCell(t.pos - i)),
    tableStart: i,
    map: o,
    table: n,
  };
}
function Jl(r, { map: e, tableStart: t, table: n }, i) {
  let o = i > 0 ? -1 : 0;
  th(e, n, i + o) && (o = i == 0 || i == e.width ? null : 0);
  for (let s = 0; s < e.height; s++) {
    const l = s * e.width + i;
    if (i > 0 && i < e.width && e.map[l - 1] == e.map[l]) {
      const a = e.map[l],
        c = n.nodeAt(a);
      (r.setNodeMarkup(r.mapping.map(t + a), null, Hl(c.attrs, i - e.colCount(a))),
        (s += c.attrs.rowspan - 1));
    } else {
      const a = o == null ? oe(n.type.schema).cell : n.nodeAt(e.map[l + o]).type,
        c = e.positionAt(s, i, n);
      r.insert(r.mapping.map(t + c), a.createAndFill());
    }
  }
  return r;
}
function fh(r, e) {
  if (!X(r)) return !1;
  if (e) {
    const t = Ee(r);
    e(Jl(r.tr, t, t.left));
  }
  return !0;
}
function hh(r, e) {
  if (!X(r)) return !1;
  if (e) {
    const t = Ee(r);
    e(Jl(r.tr, t, t.right));
  }
  return !0;
}
function dh(r, { map: e, table: t, tableStart: n }, i) {
  const o = r.mapping.maps.length;
  for (let s = 0; s < e.height;) {
    const l = s * e.width + i,
      a = e.map[l],
      c = t.nodeAt(a),
      u = c.attrs;
    if ((i > 0 && e.map[l - 1] == a) || (i < e.width - 1 && e.map[l + 1] == a))
      r.setNodeMarkup(r.mapping.slice(o).map(n + a), null, ht(u, i - e.colCount(a)));
    else {
      const f = r.mapping.slice(o).map(n + a);
      r.delete(f, f + c.nodeSize);
    }
    s += u.rowspan;
  }
}
function ph(r, e) {
  if (!X(r)) return !1;
  if (e) {
    const t = Ee(r),
      n = r.tr;
    if (t.left == 0 && t.right == t.map.width) return !1;
    for (let i = t.right - 1; dh(n, t, i), i != t.left; i--) {
      const o = t.tableStart ? n.doc.nodeAt(t.tableStart - 1) : n.doc;
      if (!o) throw new RangeError('No table found');
      ((t.table = o), (t.map = q.get(o)));
    }
    e(n);
  }
  return !0;
}
function mh(r, e, t) {
  var n;
  const i = oe(e.type.schema).header_cell;
  for (let o = 0; o < r.width; o++)
    if (((n = e.nodeAt(r.map[o + t * r.width])) === null || n === void 0 ? void 0 : n.type) != i)
      return !1;
  return !0;
}
function _l(r, { map: e, tableStart: t, table: n }, i) {
  let o = t;
  for (let c = 0; c < i; c++) o += n.child(c).nodeSize;
  const s = [];
  let l = i > 0 ? -1 : 0;
  mh(e, n, i + l) && (l = i == 0 || i == e.height ? null : 0);
  for (let c = 0, u = e.width * i; c < e.width; c++, u++)
    if (i > 0 && i < e.height && e.map[u] == e.map[u - e.width]) {
      const f = e.map[u],
        h = n.nodeAt(f).attrs;
      (r.setNodeMarkup(t + f, null, { ...h, rowspan: h.rowspan + 1 }), (c += h.colspan - 1));
    } else {
      var a;
      const f =
          l == null
            ? oe(n.type.schema).cell
            : (a = n.nodeAt(e.map[u + l * e.width])) === null || a === void 0
              ? void 0
              : a.type,
        h = f == null ? void 0 : f.createAndFill();
      h && s.push(h);
    }
  return (r.insert(o, oe(n.type.schema).row.create(null, s)), r);
}
function gh(r, e) {
  if (!X(r)) return !1;
  if (e) {
    const t = Ee(r);
    e(_l(r.tr, t, t.top));
  }
  return !0;
}
function Kl(r, e) {
  if (!X(r)) return !1;
  if (e) {
    const t = Ee(r);
    e(_l(r.tr, t, t.bottom));
  }
  return !0;
}
function bh(r, { map: e, table: t, tableStart: n }, i) {
  let o = 0;
  for (let c = 0; c < i; c++) o += t.child(c).nodeSize;
  const s = o + t.child(i).nodeSize,
    l = r.mapping.maps.length;
  r.delete(o + n, s + n);
  const a = new Set();
  for (let c = 0, u = i * e.width; c < e.width; c++, u++) {
    const f = e.map[u];
    if (!a.has(f)) {
      if ((a.add(f), i > 0 && f == e.map[u - e.width])) {
        const h = t.nodeAt(f).attrs;
        (r.setNodeMarkup(r.mapping.slice(l).map(f + n), null, { ...h, rowspan: h.rowspan - 1 }),
          (c += h.colspan - 1));
      } else if (i < e.height && f == e.map[u + e.width]) {
        const h = t.nodeAt(f),
          d = h.attrs,
          p = h.type.create({ ...d, rowspan: h.attrs.rowspan - 1 }, h.content),
          m = e.positionAt(i + 1, c, t);
        (r.insert(r.mapping.slice(l).map(n + m), p), (c += d.colspan - 1));
      }
    }
  }
}
function yh(r, e) {
  if (!X(r)) return !1;
  if (e) {
    const t = Ee(r),
      n = r.tr;
    if (t.top == 0 && t.bottom == t.map.height) return !1;
    for (let i = t.bottom - 1; bh(n, t, i), i != t.top; i--) {
      const o = t.tableStart ? n.doc.nodeAt(t.tableStart - 1) : n.doc;
      if (!o) throw new RangeError('No table found');
      ((t.table = o), (t.map = q.get(t.table)));
    }
    e(n);
  }
  return !0;
}
function Eo(r) {
  const e = r.content;
  return e.childCount == 1 && e.child(0).isTextblock && e.child(0).childCount == 0;
}
function wh({ width: r, height: e, map: t }, n) {
  let i = n.top * r + n.left,
    o = i,
    s = (n.bottom - 1) * r + n.left,
    l = i + (n.right - n.left - 1);
  for (let a = n.top; a < n.bottom; a++) {
    if ((n.left > 0 && t[o] == t[o - 1]) || (n.right < r && t[l] == t[l + 1])) return !0;
    ((o += r), (l += r));
  }
  for (let a = n.left; a < n.right; a++) {
    if ((n.top > 0 && t[i] == t[i - r]) || (n.bottom < e && t[s] == t[s + r])) return !0;
    (i++, s++);
  }
  return !1;
}
function kh(r, e) {
  const t = r.selection;
  if (!(t instanceof V) || t.$anchorCell.pos == t.$headCell.pos) return !1;
  const n = Ee(r),
    { map: i } = n;
  if (wh(i, n)) return !1;
  if (e) {
    const o = r.tr,
      s = {};
    let l = k.empty,
      a,
      c;
    for (let u = n.top; u < n.bottom; u++)
      for (let f = n.left; f < n.right; f++) {
        const h = i.map[u * i.width + f],
          d = n.table.nodeAt(h);
        if (!(s[h] || !d))
          if (((s[h] = !0), a == null)) ((a = h), (c = d));
          else {
            Eo(d) || (l = l.append(d.content));
            const p = o.mapping.map(h + n.tableStart);
            o.delete(p, p + d.nodeSize);
          }
      }
    if (a == null || c == null) return !0;
    if (
      (o.setNodeMarkup(a + n.tableStart, null, {
        ...Hl(c.attrs, c.attrs.colspan, n.right - n.left - c.attrs.colspan),
        rowspan: n.bottom - n.top,
      }),
      l.size > 0)
    ) {
      const u = a + 1 + c.content.size,
        f = Eo(c) ? a + 1 : u;
      o.replaceWith(f + n.tableStart, u + n.tableStart, l);
    }
    (o.setSelection(new V(o.doc.resolve(a + n.tableStart))), e(o));
  }
  return !0;
}
function xh(r, e) {
  const t = oe(r.schema);
  return Mh(({ node: n }) => t[n.type.spec.tableRole])(r, e);
}
function Mh(r) {
  return (e, t) => {
    const n = e.selection;
    let i, o;
    if (n instanceof V) {
      if (n.$anchorCell.pos != n.$headCell.pos) return !1;
      ((i = n.$anchorCell.nodeAfter), (o = n.$anchorCell.pos));
    } else {
      var s;
      if (((i = Qf(n.$from)), !i)) return !1;
      o = (s = ft(n.$from)) === null || s === void 0 ? void 0 : s.pos;
    }
    if (i == null || o == null || (i.attrs.colspan == 1 && i.attrs.rowspan == 1)) return !1;
    if (t) {
      let l = i.attrs;
      const a = [],
        c = l.colwidth;
      (l.rowspan > 1 && (l = { ...l, rowspan: 1 }), l.colspan > 1 && (l = { ...l, colspan: 1 }));
      const u = Ee(e),
        f = e.tr;
      for (let d = 0; d < u.right - u.left; d++)
        a.push(c ? { ...l, colwidth: c && c[d] ? [c[d]] : null } : l);
      let h;
      for (let d = u.top; d < u.bottom; d++) {
        let p = u.map.positionAt(d, u.left, u.table);
        d == u.top && (p += i.nodeSize);
        for (let m = u.left, b = 0; m < u.right; m++, b++)
          (m == u.left && d == u.top) ||
            f.insert(
              (h = f.mapping.map(p + u.tableStart, 1)),
              r({ node: i, row: d, col: m }).createAndFill(a[b]),
            );
      }
      (f.setNodeMarkup(o, r({ node: i, row: u.top, col: u.left }), a[0]),
        n instanceof V &&
          f.setSelection(new V(f.doc.resolve(n.$anchorCell.pos), h ? f.doc.resolve(h) : void 0)),
        t(f));
    }
    return !0;
  };
}
function Ch(r, e) {
  return function (t, n) {
    if (!X(t)) return !1;
    const i = nr(t);
    if (i.nodeAfter.attrs[r] === e) return !1;
    if (n) {
      const o = t.tr;
      (t.selection instanceof V
        ? t.selection.forEachCell((s, l) => {
            s.attrs[r] !== e && o.setNodeMarkup(l, null, { ...s.attrs, [r]: e });
          })
        : o.setNodeMarkup(i.pos, null, { ...i.nodeAfter.attrs, [r]: e }),
        n(o));
    }
    return !0;
  };
}
function Sh(r) {
  return function (e, t) {
    if (!X(e)) return !1;
    if (t) {
      const n = oe(e.schema),
        i = Ee(e),
        o = e.tr,
        s = i.map.cellsInRect(
          r == 'column'
            ? { left: i.left, top: 0, right: i.right, bottom: i.map.height }
            : r == 'row'
              ? { left: 0, top: i.top, right: i.map.width, bottom: i.bottom }
              : i,
        ),
        l = s.map((a) => i.table.nodeAt(a));
      for (let a = 0; a < s.length; a++)
        l[a].type == n.header_cell && o.setNodeMarkup(i.tableStart + s[a], n.cell, l[a].attrs);
      if (o.steps.length === 0)
        for (let a = 0; a < s.length; a++)
          o.setNodeMarkup(i.tableStart + s[a], n.header_cell, l[a].attrs);
      t(o);
    }
    return !0;
  };
}
function To(r, e, t) {
  const n = e.map.cellsInRect({
    left: 0,
    top: 0,
    right: r == 'row' ? e.map.width : 1,
    bottom: r == 'column' ? e.map.height : 1,
  });
  for (let i = 0; i < n.length; i++) {
    const o = e.table.nodeAt(n[i]);
    if (o && o.type !== t.header_cell) return !1;
  }
  return !0;
}
function sn(r, e) {
  return (
    (e = e || { useDeprecatedLogic: !1 }),
    e.useDeprecatedLogic
      ? Sh(r)
      : function (t, n) {
          if (!X(t)) return !1;
          if (n) {
            const i = oe(t.schema),
              o = Ee(t),
              s = t.tr,
              l = To('row', o, i),
              a = To('column', o, i),
              c = (r === 'column' ? l : r === 'row' && a) ? 1 : 0,
              u =
                r == 'column'
                  ? { left: 0, top: c, right: 1, bottom: o.map.height }
                  : r == 'row'
                    ? { left: c, top: 0, right: o.map.width, bottom: 1 }
                    : o,
              f =
                r == 'column'
                  ? a
                    ? i.cell
                    : i.header_cell
                  : r == 'row'
                    ? l
                      ? i.cell
                      : i.header_cell
                    : i.cell;
            (o.map.cellsInRect(u).forEach((h) => {
              const d = h + o.tableStart,
                p = s.doc.nodeAt(d);
              p && s.setNodeMarkup(d, f, p.attrs);
            }),
              n(s));
          }
          return !0;
        }
  );
}
sn('row', { useDeprecatedLogic: !0 });
sn('column', { useDeprecatedLogic: !0 });
sn('cell', { useDeprecatedLogic: !0 });
function vh(r, e) {
  if (e < 0) {
    const t = r.nodeBefore;
    if (t) return r.pos - t.nodeSize;
    for (let n = r.index(-1) - 1, i = r.before(); n >= 0; n--) {
      const o = r.node(-1).child(n),
        s = o.lastChild;
      if (s) return i - 1 - s.nodeSize;
      i -= o.nodeSize;
    }
  } else {
    if (r.index() < r.parent.childCount - 1) return r.pos + r.nodeAfter.nodeSize;
    const t = r.node(-1);
    for (let n = r.indexAfter(-1), i = r.after(); n < t.childCount; n++) {
      const o = t.child(n);
      if (o.childCount) return i + 1;
      i += o.nodeSize;
    }
  }
  return null;
}
function Wr(r) {
  return function (e, t) {
    if (!X(e)) return !1;
    const n = vh(nr(e), r);
    if (n == null) return !1;
    if (t) {
      const i = e.doc.resolve(n);
      t(e.tr.setSelection(L.between(i, eh(i))).scrollIntoView());
    }
    return !0;
  };
}
function Ah(r, e) {
  const t = r.selection.$anchor;
  for (let n = t.depth; n > 0; n--)
    if (t.node(n).type.spec.tableRole == 'table')
      return (e && e(r.tr.delete(t.before(n), t.after(n)).scrollIntoView()), !0);
  return !1;
}
function wn(r, e) {
  const t = r.selection;
  if (!(t instanceof V)) return !1;
  if (e) {
    const n = r.tr,
      i = oe(r.schema).cell.createAndFill().content;
    (t.forEachCell((o, s) => {
      o.content.eq(i) ||
        n.replace(n.mapping.map(s + 1), n.mapping.map(s + o.nodeSize - 1), new S(i, 0, 0));
    }),
      n.docChanged && e(n));
  }
  return !0;
}
function Nh(r) {
  if (r.size === 0) return null;
  let { content: e, openStart: t, openEnd: n } = r;
  for (; e.childCount == 1 && ((t > 0 && n > 0) || e.child(0).type.spec.tableRole == 'table');)
    (t--, n--, (e = e.child(0).content));
  const i = e.child(0),
    o = i.type.spec.tableRole,
    s = i.type.schema,
    l = [];
  if (o == 'row')
    for (let a = 0; a < e.childCount; a++) {
      let c = e.child(a).content;
      const u = a ? 0 : Math.max(0, t - 1),
        f = a < e.childCount - 1 ? 0 : Math.max(0, n - 1);
      ((u || f) && (c = qr(oe(s).row, new S(c, u, f)).content), l.push(c));
    }
  else if (o == 'cell' || o == 'header_cell')
    l.push(t || n ? qr(oe(s).row, new S(e, t, n)).content : e);
  else return null;
  return Eh(s, l);
}
function Eh(r, e) {
  const t = [];
  for (let i = 0; i < e.length; i++) {
    const o = e[i];
    for (let s = o.childCount - 1; s >= 0; s--) {
      const { rowspan: l, colspan: a } = o.child(s).attrs;
      for (let c = i; c < i + l; c++) t[c] = (t[c] || 0) + a;
    }
  }
  let n = 0;
  for (let i = 0; i < t.length; i++) n = Math.max(n, t[i]);
  for (let i = 0; i < t.length; i++)
    if ((i >= e.length && e.push(k.empty), t[i] < n)) {
      const o = oe(r).cell.createAndFill(),
        s = [];
      for (let l = t[i]; l < n; l++) s.push(o);
      e[i] = e[i].append(k.from(s));
    }
  return { height: e.length, width: n, rows: e };
}
function qr(r, e) {
  const t = r.createAndFill();
  return new Bs(t).replace(0, t.content.size, e).doc;
}
function Th({ width: r, height: e, rows: t }, n, i) {
  if (r != n) {
    const o = [],
      s = [];
    for (let l = 0; l < t.length; l++) {
      const a = t[l],
        c = [];
      for (let u = o[l] || 0, f = 0; u < n; f++) {
        let h = a.child(f % a.childCount);
        (u + h.attrs.colspan > n &&
          (h = h.type.createChecked(
            ht(h.attrs, h.attrs.colspan, u + h.attrs.colspan - n),
            h.content,
          )),
          c.push(h),
          (u += h.attrs.colspan));
        for (let d = 1; d < h.attrs.rowspan; d++) o[l + d] = (o[l + d] || 0) + h.attrs.colspan;
      }
      s.push(k.from(c));
    }
    ((t = s), (r = n));
  }
  if (e != i) {
    const o = [];
    for (let s = 0, l = 0; s < i; s++, l++) {
      const a = [],
        c = t[l % e];
      for (let u = 0; u < c.childCount; u++) {
        let f = c.child(u);
        (s + f.attrs.rowspan > i &&
          (f = f.type.create({ ...f.attrs, rowspan: Math.max(1, i - f.attrs.rowspan) }, f.content)),
          a.push(f));
      }
      o.push(k.from(a));
    }
    ((t = o), (e = i));
  }
  return { width: r, height: e, rows: t };
}
function Oh(r, e, t, n, i, o, s) {
  const l = r.doc.type.schema,
    a = oe(l);
  let c, u;
  if (i > e.width)
    for (let f = 0, h = 0; f < e.height; f++) {
      const d = t.child(f);
      h += d.nodeSize;
      const p = [];
      let m;
      d.lastChild == null || d.lastChild.type == a.cell
        ? (m = c || (c = a.cell.createAndFill()))
        : (m = u || (u = a.header_cell.createAndFill()));
      for (let b = e.width; b < i; b++) p.push(m);
      r.insert(r.mapping.slice(s).map(h - 1 + n), p);
    }
  if (o > e.height) {
    const f = [];
    for (let p = 0, m = (e.height - 1) * e.width; p < Math.max(e.width, i); p++) {
      const b = p >= e.width ? !1 : t.nodeAt(e.map[m + p]).type == a.header_cell;
      f.push(b ? u || (u = a.header_cell.createAndFill()) : c || (c = a.cell.createAndFill()));
    }
    const h = a.row.create(null, k.from(f)),
      d = [];
    for (let p = e.height; p < o; p++) d.push(h);
    r.insert(r.mapping.slice(s).map(n + t.nodeSize - 2), d);
  }
  return !!(c || u);
}
function Oo(r, e, t, n, i, o, s, l) {
  if (s == 0 || s == e.height) return !1;
  let a = !1;
  for (let c = i; c < o; c++) {
    const u = s * e.width + c,
      f = e.map[u];
    if (e.map[u - e.width] == f) {
      a = !0;
      const h = t.nodeAt(f),
        { top: d, left: p } = e.findCell(f);
      (r.setNodeMarkup(r.mapping.slice(l).map(f + n), null, { ...h.attrs, rowspan: s - d }),
        r.insert(
          r.mapping.slice(l).map(e.positionAt(s, p, t)),
          h.type.createAndFill({ ...h.attrs, rowspan: d + h.attrs.rowspan - s }),
        ),
        (c += h.attrs.colspan - 1));
    }
  }
  return a;
}
function Do(r, e, t, n, i, o, s, l) {
  if (s == 0 || s == e.width) return !1;
  let a = !1;
  for (let c = i; c < o; c++) {
    const u = c * e.width + s,
      f = e.map[u];
    if (e.map[u - 1] == f) {
      a = !0;
      const h = t.nodeAt(f),
        d = e.colCount(f),
        p = r.mapping.slice(l).map(f + n);
      (r.setNodeMarkup(p, null, ht(h.attrs, s - d, h.attrs.colspan - (s - d))),
        r.insert(p + h.nodeSize, h.type.createAndFill(ht(h.attrs, 0, s - d))),
        (c += h.attrs.rowspan - 1));
    }
  }
  return a;
}
function Ro(r, e, t, n, i) {
  let o = t ? r.doc.nodeAt(t - 1) : r.doc;
  if (!o) throw new Error('No table found');
  let s = q.get(o);
  const { top: l, left: a } = n,
    c = a + i.width,
    u = l + i.height,
    f = r.tr;
  let h = 0;
  function d() {
    if (((o = t ? f.doc.nodeAt(t - 1) : f.doc), !o)) throw new Error('No table found');
    ((s = q.get(o)), (h = f.mapping.maps.length));
  }
  (Oh(f, s, o, t, c, u, h) && d(),
    Oo(f, s, o, t, a, c, l, h) && d(),
    Oo(f, s, o, t, a, c, u, h) && d(),
    Do(f, s, o, t, l, u, a, h) && d(),
    Do(f, s, o, t, l, u, c, h) && d());
  for (let p = l; p < u; p++) {
    const m = s.positionAt(p, a, o),
      b = s.positionAt(p, c, o);
    f.replace(
      f.mapping.slice(h).map(m + t),
      f.mapping.slice(h).map(b + t),
      new S(i.rows[p - l], 0, 0),
    );
  }
  (d(),
    f.setSelection(
      new V(
        f.doc.resolve(t + s.positionAt(l, a, o)),
        f.doc.resolve(t + s.positionAt(u - 1, c - 1, o)),
      ),
    ),
    e(f));
}
const Dh = ri({
  ArrowLeft: kn('horiz', -1),
  ArrowRight: kn('horiz', 1),
  ArrowUp: kn('vert', -1),
  ArrowDown: kn('vert', 1),
  'Shift-ArrowLeft': xn('horiz', -1),
  'Shift-ArrowRight': xn('horiz', 1),
  'Shift-ArrowUp': xn('vert', -1),
  'Shift-ArrowDown': xn('vert', 1),
  Backspace: wn,
  'Mod-Backspace': wn,
  Delete: wn,
  'Mod-Delete': wn,
});
function On(r, e, t) {
  return t.eq(r.selection) ? !1 : (e && e(r.tr.setSelection(t).scrollIntoView()), !0);
}
function kn(r, e) {
  return (t, n, i) => {
    if (!i) return !1;
    const o = t.selection;
    if (o instanceof V) return On(t, n, I.near(o.$headCell, e));
    if (r != 'horiz' && !o.empty) return !1;
    const s = Ul(i, r, e);
    if (s == null) return !1;
    if (r == 'horiz') return On(t, n, I.near(t.doc.resolve(o.head + e), e));
    {
      const l = t.doc.resolve(s),
        a = Vl(l, r, e);
      let c;
      return (
        a
          ? (c = I.near(a, 1))
          : e < 0
            ? (c = I.near(t.doc.resolve(l.before(-1)), -1))
            : (c = I.near(t.doc.resolve(l.after(-1)), 1)),
        On(t, n, c)
      );
    }
  };
}
function xn(r, e) {
  return (t, n, i) => {
    if (!i) return !1;
    const o = t.selection;
    let s;
    if (o instanceof V) s = o;
    else {
      const a = Ul(i, r, e);
      if (a == null) return !1;
      s = new V(t.doc.resolve(a));
    }
    const l = Vl(s.$headCell, r, e);
    return l ? On(t, n, new V(s.$anchorCell, l)) : !1;
  };
}
function Rh(r, e) {
  const t = r.state.doc,
    n = ft(t.resolve(e));
  return n ? (r.dispatch(r.state.tr.setSelection(new V(n))), !0) : !1;
}
function Ih(r, e, t) {
  if (!X(r.state)) return !1;
  let n = Nh(t);
  const i = r.state.selection;
  if (i instanceof V) {
    n || (n = { width: 1, height: 1, rows: [k.from(qr(oe(r.state.schema).cell, t))] });
    const o = i.$anchorCell.node(-1),
      s = i.$anchorCell.start(-1),
      l = q.get(o).rectBetween(i.$anchorCell.pos - s, i.$headCell.pos - s);
    return ((n = Th(n, l.right - l.left, l.bottom - l.top)), Ro(r.state, r.dispatch, s, l, n), !0);
  } else if (n) {
    const o = nr(r.state),
      s = o.start(-1);
    return (Ro(r.state, r.dispatch, s, q.get(o.node(-1)).findCell(o.pos - s), n), !0);
  } else return !1;
}
function Lh(r, e) {
  var t;
  if (e.button != 0 || e.ctrlKey || e.metaKey) return;
  const n = Io(r, e.target);
  let i;
  if (e.shiftKey && r.state.selection instanceof V)
    (o(r.state.selection.$anchorCell, e), e.preventDefault());
  else if (
    e.shiftKey &&
    n &&
    (i = ft(r.state.selection.$anchor)) != null &&
    ((t = kr(r, e)) === null || t === void 0 ? void 0 : t.pos) != i.pos
  )
    (o(i, e), e.preventDefault());
  else if (!n) return;
  function o(a, c) {
    let u = kr(r, c);
    const f = We.getState(r.state) == null;
    if (!u || !pi(a, u))
      if (f) u = a;
      else return;
    const h = new V(a, u);
    if (f || !r.state.selection.eq(h)) {
      const d = r.state.tr.setSelection(h);
      (f && d.setMeta(We, a.pos), r.dispatch(d));
    }
  }
  function s() {
    (r.root.removeEventListener('mouseup', s),
      r.root.removeEventListener('dragstart', s),
      r.root.removeEventListener('mousemove', l),
      We.getState(r.state) != null && r.dispatch(r.state.tr.setMeta(We, -1)));
  }
  function l(a) {
    const c = a,
      u = We.getState(r.state);
    let f;
    if (u != null) f = r.state.doc.resolve(u);
    else if (Io(r, c.target) != n && ((f = kr(r, e)), !f)) return s();
    f && o(f, c);
  }
  (r.root.addEventListener('mouseup', s),
    r.root.addEventListener('dragstart', s),
    r.root.addEventListener('mousemove', l));
}
function Ul(r, e, t) {
  if (!(r.state.selection instanceof L)) return null;
  const { $head: n } = r.state.selection;
  for (let i = n.depth - 1; i >= 0; i--) {
    const o = n.node(i);
    if ((t < 0 ? n.index(i) : n.indexAfter(i)) != (t < 0 ? 0 : o.childCount)) return null;
    if (o.type.spec.tableRole == 'cell' || o.type.spec.tableRole == 'header_cell') {
      const s = n.before(i),
        l = e == 'vert' ? (t > 0 ? 'down' : 'up') : t > 0 ? 'right' : 'left';
      return r.endOfTextblock(l) ? s : null;
    }
  }
  return null;
}
function Io(r, e) {
  for (; e && e != r.dom; e = e.parentNode) if (e.nodeName == 'TD' || e.nodeName == 'TH') return e;
  return null;
}
function kr(r, e) {
  const t = r.posAtCoords({ left: e.clientX, top: e.clientY });
  if (!t) return null;
  let { inside: n, pos: i } = t;
  return (n >= 0 && ft(r.state.doc.resolve(n))) || ft(r.state.doc.resolve(i));
}
var zh = class {
  constructor(r, e) {
    ((this.node = r),
      (this.defaultCellMinWidth = e),
      (this.dom = document.createElement('div')),
      (this.dom.className = 'tableWrapper'),
      (this.table = this.dom.appendChild(document.createElement('table'))),
      this.table.style.setProperty('--default-cell-min-width', `${e}px`),
      (this.colgroup = this.table.appendChild(document.createElement('colgroup'))),
      Jr(r, this.colgroup, this.table, e),
      (this.contentDOM = this.table.appendChild(document.createElement('tbody'))));
  }
  update(r) {
    return r.type != this.node.type
      ? !1
      : ((this.node = r), Jr(r, this.colgroup, this.table, this.defaultCellMinWidth), !0);
  }
  ignoreMutation(r) {
    return r.type == 'attributes' && (r.target == this.table || this.colgroup.contains(r.target));
  }
};
function Jr(r, e, t, n, i, o) {
  let s = 0,
    l = !0,
    a = e.firstChild;
  const c = r.firstChild;
  if (c) {
    for (let f = 0, h = 0; f < c.childCount; f++) {
      const { colspan: d, colwidth: p } = c.child(f).attrs;
      for (let m = 0; m < d; m++, h++) {
        const b = i == h ? o : p && p[m],
          g = b ? b + 'px' : '';
        if (((s += b || n), b || (l = !1), a))
          (a.style.width != g && (a.style.width = g), (a = a.nextSibling));
        else {
          const y = document.createElement('col');
          ((y.style.width = g), e.appendChild(y));
        }
      }
    }
    for (; a;) {
      var u;
      const f = a.nextSibling;
      ((u = a.parentNode) === null || u === void 0 || u.removeChild(a), (a = f));
    }
    l
      ? ((t.style.width = s + 'px'), (t.style.minWidth = ''))
      : ((t.style.width = ''), (t.style.minWidth = s + 'px'));
  }
}
const ge = new ye('tableColumnResizing');
function Bh({
  handleWidth: r = 5,
  cellMinWidth: e = 25,
  defaultCellMinWidth: t = 100,
  View: n = zh,
  lastColumnResizable: i = !0,
} = {}) {
  const o = new pe({
    key: ge,
    state: {
      init(s, l) {
        var a;
        const c =
            (a = o.spec) === null || a === void 0 || (a = a.props) === null || a === void 0
              ? void 0
              : a.nodeViews,
          u = oe(l.schema).table.name;
        return (n && c && (c[u] = (f, h) => new n(f, t, h)), new Ph(-1, !1));
      },
      apply(s, l) {
        return l.apply(s);
      },
    },
    props: {
      attributes: (s) => {
        const l = ge.getState(s);
        return l && l.activeHandle > -1 ? { class: 'resize-cursor' } : {};
      },
      handleDOMEvents: {
        mousemove: (s, l) => {
          Fh(s, l, r, i);
        },
        mouseleave: (s) => {
          $h(s);
        },
        mousedown: (s, l) => {
          Vh(s, l, e, t);
        },
      },
      decorations: (s) => {
        const l = ge.getState(s);
        if (l && l.activeHandle > -1) return _h(s, l.activeHandle);
      },
      nodeViews: {},
    },
  });
  return o;
}
var Ph = class Dn {
  constructor(e, t) {
    ((this.activeHandle = e), (this.dragging = t));
  }
  apply(e) {
    const t = this,
      n = e.getMeta(ge);
    if (n && n.setHandle != null) return new Dn(n.setHandle, !1);
    if (n && n.setDragging !== void 0) return new Dn(t.activeHandle, n.setDragging);
    if (t.activeHandle > -1 && e.docChanged) {
      let i = e.mapping.map(t.activeHandle, -1);
      return (Hr(e.doc.resolve(i)) || (i = -1), new Dn(i, t.dragging));
    }
    return t;
  }
};
function Fh(r, e, t, n) {
  if (!r.editable) return;
  const i = ge.getState(r.state);
  if (i && !i.dragging) {
    const o = Wh(e.target);
    let s = -1;
    if (o) {
      const { left: l, right: a } = o.getBoundingClientRect();
      e.clientX - l <= t
        ? (s = Lo(r, e, 'left', t))
        : a - e.clientX <= t && (s = Lo(r, e, 'right', t));
    }
    if (s != i.activeHandle) {
      if (!n && s !== -1) {
        const l = r.state.doc.resolve(s),
          a = l.node(-1),
          c = q.get(a),
          u = l.start(-1);
        if (c.colCount(l.pos - u) + l.nodeAfter.attrs.colspan - 1 == c.width - 1) return;
      }
      jl(r, s);
    }
  }
}
function $h(r) {
  if (!r.editable) return;
  const e = ge.getState(r.state);
  e && e.activeHandle > -1 && !e.dragging && jl(r, -1);
}
function Vh(r, e, t, n) {
  var i;
  if (!r.editable) return !1;
  const o = (i = r.dom.ownerDocument.defaultView) !== null && i !== void 0 ? i : window,
    s = ge.getState(r.state);
  if (!s || s.activeHandle == -1 || s.dragging) return !1;
  const l = r.state.doc.nodeAt(s.activeHandle),
    a = Hh(r, s.activeHandle, l.attrs);
  r.dispatch(r.state.tr.setMeta(ge, { setDragging: { startX: e.clientX, startWidth: a } }));
  function c(f) {
    (o.removeEventListener('mouseup', c), o.removeEventListener('mousemove', u));
    const h = ge.getState(r.state);
    h != null &&
      h.dragging &&
      (qh(r, h.activeHandle, zo(h.dragging, f, t)),
      r.dispatch(r.state.tr.setMeta(ge, { setDragging: null })));
  }
  function u(f) {
    if (!f.which) return c(f);
    const h = ge.getState(r.state);
    if (h && h.dragging) {
      const d = zo(h.dragging, f, t);
      Bo(r, h.activeHandle, d, n);
    }
  }
  return (
    Bo(r, s.activeHandle, a, n),
    o.addEventListener('mouseup', c),
    o.addEventListener('mousemove', u),
    e.preventDefault(),
    !0
  );
}
function Hh(r, e, { colspan: t, colwidth: n }) {
  const i = n && n[n.length - 1];
  if (i) return i;
  const o = r.domAtPos(e);
  let s = o.node.childNodes[o.offset].offsetWidth,
    l = t;
  if (n) for (let a = 0; a < t; a++) n[a] && ((s -= n[a]), l--);
  return s / l;
}
function Wh(r) {
  for (; r && r.nodeName != 'TD' && r.nodeName != 'TH';)
    r = r.classList && r.classList.contains('ProseMirror') ? null : r.parentNode;
  return r;
}
function Lo(r, e, t, n) {
  const i = t == 'right' ? -n : n,
    o = r.posAtCoords({ left: e.clientX + i, top: e.clientY });
  if (!o) return -1;
  const { pos: s } = o,
    l = ft(r.state.doc.resolve(s));
  if (!l) return -1;
  if (t == 'right') return l.pos;
  const a = q.get(l.node(-1)),
    c = l.start(-1),
    u = a.map.indexOf(l.pos - c);
  return u % a.width == 0 ? -1 : c + a.map[u - 1];
}
function zo(r, e, t) {
  const n = e.clientX - r.startX;
  return Math.max(t, r.startWidth + n);
}
function jl(r, e) {
  r.dispatch(r.state.tr.setMeta(ge, { setHandle: e }));
}
function qh(r, e, t) {
  const n = r.state.doc.resolve(e),
    i = n.node(-1),
    o = q.get(i),
    s = n.start(-1),
    l = o.colCount(n.pos - s) + n.nodeAfter.attrs.colspan - 1,
    a = r.state.tr;
  for (let c = 0; c < o.height; c++) {
    const u = c * o.width + l;
    if (c && o.map[u] == o.map[u - o.width]) continue;
    const f = o.map[u],
      h = i.nodeAt(f).attrs,
      d = h.colspan == 1 ? 0 : l - o.colCount(f);
    if (h.colwidth && h.colwidth[d] == t) continue;
    const p = h.colwidth ? h.colwidth.slice() : Jh(h.colspan);
    ((p[d] = t), a.setNodeMarkup(s + f, null, { ...h, colwidth: p }));
  }
  a.docChanged && r.dispatch(a);
}
function Bo(r, e, t, n) {
  const i = r.state.doc.resolve(e),
    o = i.node(-1),
    s = i.start(-1),
    l = q.get(o).colCount(i.pos - s) + i.nodeAfter.attrs.colspan - 1;
  let a = r.domAtPos(i.start(-1)).node;
  for (; a && a.nodeName != 'TABLE';) a = a.parentNode;
  a && Jr(o, a.firstChild, a, n, l, t);
}
function Jh(r) {
  return Array(r).fill(0);
}
function _h(r, e) {
  const t = [],
    n = r.doc.resolve(e),
    i = n.node(-1);
  if (!i) return H.empty;
  const o = q.get(i),
    s = n.start(-1),
    l = o.colCount(n.pos - s) + n.nodeAfter.attrs.colspan - 1;
  for (let c = 0; c < o.height; c++) {
    const u = l + c * o.width;
    if (
      (l == o.width - 1 || o.map[u] != o.map[u + 1]) &&
      (c == 0 || o.map[u] != o.map[u - o.width])
    ) {
      var a;
      const f = o.map[u],
        h = s + f + i.nodeAt(f).nodeSize - 1,
        d = document.createElement('div');
      ((d.className = 'column-resize-handle'),
        !((a = ge.getState(r)) === null || a === void 0) &&
          a.dragging &&
          t.push(ie.node(s + f, s + f + i.nodeAt(f).nodeSize, { class: 'column-resize-dragging' })),
        t.push(ie.widget(h, d)));
    }
  }
  return H.create(r.doc, t);
}
function Kh({ allowTableNodeSelection: r = !1 } = {}) {
  return new pe({
    key: We,
    state: {
      init() {
        return null;
      },
      apply(e, t) {
        const n = e.getMeta(We);
        if (n != null) return n == -1 ? null : n;
        if (t == null || !e.docChanged) return t;
        const { deleted: i, pos: o } = e.mapping.mapResult(t);
        return i ? null : o;
      },
    },
    props: {
      decorations: rh,
      handleDOMEvents: { mousedown: Lh },
      createSelectionBetween(e) {
        return We.getState(e.state) != null ? e.state.selection : null;
      },
      handleTripleClick: Rh,
      handleKeyDown: Dh,
      handlePaste: Ih,
    },
    appendTransaction(e, t, n) {
      return sh(n, ah(n, t), r);
    },
  });
}
const Uh = new Set(['http:', 'https:', 'mailto:', 'tel:']),
  jh = new Set(['http:', 'https:', 'blob:']),
  Gh = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,/i;
function Gl(r) {
  const t = r.replace(/[\u0000- \u007f-\u009f]/g, '').match(/^([a-z][a-z0-9+.-]*):/i);
  return t ? `${t[1].toLowerCase()}:` : null;
}
function ln(r) {
  const e = Gl(r);
  return e === null || Uh.has(e);
}
function It(r) {
  if (Gh.test(r.trim())) return !0;
  const e = Gl(r);
  return e === null || jh.has(e);
}
const Xl = ['left', 'center', 'right', 'justify'],
  Xh =
    /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)|[a-z]{3,20})$/i,
  Yh = /^\d{1,4}(\.\d{1,3})?(px|pt|em|rem|%)$/,
  Qh = /^\d{1,2}(\.\d{1,3})?(px|em|%)?$/,
  Zh = /^[\w\s,'"-]{1,200}$/;
function ed(r) {
  const e = r.trim().toLowerCase(),
    t = e.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(1|1\.0+)\s*)?\)$/);
  if (t)
    return (
      '#' +
      t
        .slice(1, 4)
        .map((i) => Math.min(255, Number(i)).toString(16).padStart(2, '0'))
        .join('')
    );
  const n = e.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  return n ? `#${n[1]}${n[1]}${n[2]}${n[2]}${n[3]}${n[3]}` : e;
}
const U = {
  color: (r) =>
    typeof r == 'string' &&
    Xh.test(r.trim()) &&
    !/^(inherit|initial|unset|currentcolor)$/i.test(r.trim())
      ? ed(r)
      : null,
  length: (r) => (typeof r == 'string' && Yh.test(r.trim()) ? r.trim() : null),
  lineHeight: (r) =>
    typeof r == 'string' && Qh.test(r.trim()) && r.trim() !== 'normal' ? r.trim() : null,
  fontFamily: (r) => (typeof r == 'string' && Zh.test(r.trim()) ? r.trim() : null),
};
function Po(r) {
  const e = r.style.textAlign;
  return { align: Xl.includes(e) ? e : null, lineHeight: U.lineHeight(r.style.lineHeight) };
}
function Fo(r) {
  const e = [],
    t = r.align;
  t && Xl.includes(t) && e.push(`text-align: ${t};`);
  const n = U.lineHeight(r.lineHeight);
  return (n && e.push(`line-height: ${n};`), e.length ? { style: e.join(' ') } : {});
}
const $o = { align: { default: null }, lineHeight: { default: null } },
  td = {
    left: 'float: left; margin: 0 1em 1em 0;',
    right: 'float: right; margin: 0 0 1em 1em;',
    center: 'display: block; margin-left: auto; margin-right: auto;',
  };
function nd(r) {
  const e = r.style.float || r.getAttribute('align');
  return e === 'left' || e === 'right'
    ? e
    : r.style.display === 'block' && r.style.marginLeft === 'auto' && r.style.marginRight === 'auto'
      ? 'center'
      : null;
}
function kt(r) {
  if (r == null || r === '') return null;
  const e = String(r)
    .trim()
    .match(/^(\d{1,5})(px)?$/);
  if (!e) return null;
  const t = Number(e[1]);
  return t >= 1 && t <= 1e4 ? t : null;
}
const rd = 100;
function id() {
  const r = Yf({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: {
      background: {
        default: null,
        getFromDOM: (e) => U.color(e.getAttribute('data-nova-cell-bg') ?? e.style.backgroundColor),
        setDOMAttr: (e, t) => {
          const n = U.color(e);
          n && (t.style = `${t.style ?? ''}background-color: ${n};`);
        },
      },
    },
  });
  for (const e of ['table_cell', 'table_header']) {
    const t = r[e],
      n = t.parseDOM[0],
      i = n.getAttrs;
    n.getAttrs = (s) => {
      const l = i(s);
      if (!l) return l;
      const a = (c) => Math.min(rd, Math.max(1, Number.isFinite(c) ? Math.floor(c) : 1));
      return { ...l, colspan: a(l.colspan), rowspan: a(l.rowspan) };
    };
    const o = t.toDOM;
    t.toDOM = (s) => {
      const l = o(s),
        a = s.attrs.colwidth;
      if (a != null && a.every((c) => c > 0)) {
        const c = a.reduce((f, h) => f + h, 0),
          u = l[1].style ? ` ${l[1].style}` : '';
        l[1] = { ...l[1], style: `width: ${c}px;${u}` };
      }
      return l;
    };
  }
  return r;
}
const od = {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { ...$o },
      parseDOM: [{ tag: 'p', getAttrs: (r) => Po(r) }],
      toDOM: (r) => ['p', Fo(r.attrs), 0],
    },
    heading: {
      group: 'block',
      content: 'inline*',
      defining: !0,
      attrs: { level: { default: 1 }, ...$o },
      parseDOM: [1, 2, 3, 4, 5, 6].map((r) => ({
        tag: `h${r}`,
        getAttrs: (e) => ({ level: r, ...Po(e) }),
      })),
      toDOM: (r) => [`h${r.attrs.level}`, Fo(r.attrs), 0],
    },
    blockquote: {
      group: 'block',
      content: 'block+',
      defining: !0,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    },
    horizontal_rule: { group: 'block', parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: !0,
      defining: !0,
      attrs: { language: { default: null } },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: (r) => {
            const e = r.querySelector('code'),
              t = e == null ? void 0 : e.className.match(/language-([\w-]+)/);
            return { language: (t == null ? void 0 : t[1]) ?? null };
          },
        },
      ],
      toDOM: (r) => [
        'pre',
        ['code', r.attrs.language ? { class: `language-${r.attrs.language}` } : {}, 0],
      ],
    },
    bullet_list: {
      group: 'block',
      content: 'list_item+',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },
    ordered_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { start: { default: 1 } },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: (r) => {
            const e = r.getAttribute('start');
            return { start: e ? Number(e) : 1 };
          },
        },
      ],
      toDOM: (r) => (r.attrs.start === 1 ? ['ol', 0] : ['ol', { start: r.attrs.start }, 0]),
    },
    list_item: {
      content: 'paragraph block*',
      defining: !0,
      parseDOM: [{ tag: 'li' }],
      toDOM: () => ['li', 0],
    },
    text: { group: 'inline' },
    image: {
      group: 'inline',
      inline: !0,
      draggable: !0,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
        width: { default: null },
        height: { default: null },
        align: { default: null },
      },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs: (r) => {
            const e = r;
            return It(e.getAttribute('src') ?? '')
              ? {
                  src: e.getAttribute('src'),
                  alt: e.getAttribute('alt'),
                  title: e.getAttribute('title'),
                  width: kt(e.getAttribute('width') ?? e.style.width),
                  height: kt(e.getAttribute('height') ?? e.style.height),
                  align: nd(e),
                }
              : !1;
          },
        },
      ],
      toDOM: (r) => {
        const { alt: e, title: t } = r.attrs,
          n = It(r.attrs.src) ? r.attrs.src : '',
          i = kt(r.attrs.width),
          o = kt(r.attrs.height),
          s = td[r.attrs.align];
        return [
          'img',
          {
            src: n,
            ...(e ? { alt: e } : {}),
            ...(t ? { title: t } : {}),
            ...(i ? { width: String(i) } : {}),
            ...(o ? { height: String(o) } : {}),
            ...(s ? { style: s } : {}),
          },
        ];
      },
    },
    hard_break: {
      group: 'inline',
      inline: !0,
      selectable: !1,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
    ...id(),
  },
  sd = {
    link: {
      attrs: { href: {}, title: { default: null }, target: { default: null } },
      inclusive: !1,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (r) => {
            const e = r;
            return ln(e.getAttribute('href') ?? '')
              ? {
                  href: e.getAttribute('href'),
                  title: e.getAttribute('title'),
                  target: e.getAttribute('target'),
                }
              : !1;
          },
        },
      ],
      toDOM: (r) => {
        const { title: e, target: t } = r.attrs;
        return [
          'a',
          {
            href: ln(r.attrs.href) ? r.attrs.href : '#',
            ...(e ? { title: e } : {}),
            ...(t ? { target: t, rel: 'noopener noreferrer' } : {}),
          },
          0,
        ];
      },
    },
    bold: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b', getAttrs: (r) => r.style.fontWeight !== 'normal' && null },
        { style: 'font-weight', getAttrs: (r) => /^(bold(er)?|[5-9]\d{2,})$/.test(r) && null },
      ],
      toDOM: () => ['strong', 0],
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
      toDOM: () => ['em', 0],
    },
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM: () => ['u', 0],
    },
    strike: {
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        { tag: 'strike' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM: () => ['s', 0],
    },
    code: { parseDOM: [{ tag: 'code' }], toDOM: () => ['code', 0] },
    subscript: { excludes: 'superscript', parseDOM: [{ tag: 'sub' }], toDOM: () => ['sub', 0] },
    superscript: { excludes: 'subscript', parseDOM: [{ tag: 'sup' }], toDOM: () => ['sup', 0] },
    color: {
      attrs: { value: {} },
      parseDOM: [
        { style: 'color', getAttrs: (r) => Pt(U.color(r)) },
        { tag: 'font[color]', getAttrs: (r) => Pt(U.color(r.getAttribute('color'))) },
      ],
      toDOM: (r) => Mn('color', U.color(r.attrs.value)),
    },
    background: {
      attrs: { value: {} },
      parseDOM: [
        { style: 'background-color', getAttrs: (r) => Pt(U.color(r)) },
        { tag: 'mark', getAttrs: () => ({ value: 'yellow' }) },
      ],
      toDOM: (r) => Mn('background-color', U.color(r.attrs.value)),
    },
    font_family: {
      attrs: { value: {} },
      parseDOM: [{ style: 'font-family', getAttrs: (r) => Pt(U.fontFamily(r)) }],
      toDOM: (r) => Mn('font-family', U.fontFamily(r.attrs.value)),
    },
    font_size: {
      attrs: { value: {} },
      parseDOM: [{ style: 'font-size', getAttrs: (r) => Pt(U.length(r)) }],
      toDOM: (r) => Mn('font-size', U.length(r.attrs.value)),
    },
  };
function Pt(r) {
  return r ? { value: r } : !1;
}
function Mn(r, e) {
  return e ? ['span', { style: `${r}: ${e};` }, 0] : ['span', 0];
}
const R = new La({ nodes: od, marks: sd }),
  { nodes: _, marks: ne } = R;
function Cn(r) {
  return (e, t) => {
    const { from: n, to: i } = e.selection;
    let o = e.tr,
      s = !1;
    return (
      e.doc.nodesBetween(n, i, (l, a) => {
        (l.type === _.paragraph || l.type === _.heading) &&
          ((s = !0), (o = o.setNodeMarkup(a, void 0, { ...l.attrs, align: r })));
      }),
      s ? (t == null || t(o), !0) : !1
    );
  };
}
const ld = (r, e) => (
    e == null || e(r.tr.replaceSelectionWith(_.horizontal_rule.create()).scrollIntoView()),
    !0
  ),
  ad = (r, e) => {
    const { from: t, to: n, empty: i, $from: o } = r.selection;
    if (i) {
      const s = bi(r, ne.link, o.pos);
      return s ? (e == null || e(r.tr.removeMark(s.from, s.to, ne.link)), !0) : !1;
    }
    return r.doc.rangeHasMark(t, n, ne.link)
      ? (e == null || e(r.tr.removeMark(t, n, ne.link)), !0)
      : !1;
  },
  cd = (r, e) => {
    const { from: t, to: n, empty: i } = r.selection;
    if (i) return !1;
    if (e) {
      let o = r.tr;
      for (const s of Object.values(ne)) s !== ne.link && (o = o.removeMark(t, n, s));
      e(o);
    }
    return !0;
  };
function Yl(r, e = {}) {
  const t = Pl(r, e);
  return (n, i) => {
    if (!t(n)) return !1;
    if (i) {
      const o = n.tr;
      for (const s of n.selection.ranges)
        o.setBlockType(s.$from.pos, s.$to.pos, r, (l) => ({
          ...e,
          ...('align' in r.spec.attrs && l.attrs.align ? { align: l.attrs.align } : {}),
          ...('lineHeight' in r.spec.attrs && l.attrs.lineHeight
            ? { lineHeight: l.attrs.lineHeight }
            : {}),
        }));
      i(o.scrollIntoView());
    }
    return !0;
  };
}
function mt(r) {
  return Yl(_.heading, { level: r });
}
const $ = {
  bold: Qe(ne.bold),
  italic: Qe(ne.italic),
  underline: Qe(ne.underline),
  strike: Qe(ne.strike),
  code: Qe(ne.code),
  subscript: Qe(ne.subscript),
  superscript: Qe(ne.superscript),
  paragraph: Yl(_.paragraph),
  h1: mt(1),
  h2: mt(2),
  h3: mt(3),
  h4: mt(4),
  h5: mt(5),
  h6: mt(6),
  blockquote: (r, e) => (ze(r, _.blockquote) ? vf(r, e) : zf(_.blockquote)(r, e)),
  codeBlock: Pl(_.code_block),
  bulletList: Vo(_.bullet_list),
  orderedList: Vo(_.ordered_list),
  indent: _f(_.list_item),
  outdent: $l(_.list_item),
  alignLeft: Cn(null),
  alignCenter: Cn('center'),
  alignRight: Cn('right'),
  alignJustify: Cn('justify'),
  horizontalRule: ld,
  unlink: ad,
  clearFormatting: cd,
  undo: Tl,
  redo: Ol,
};
function Vo(r) {
  return (e, t) => (ze(e, r) ? $l(_.list_item)(e, t) : $f(r)(e, t));
}
function ud(r, e) {
  return (t, n) =>
    It(r)
      ? (n == null ||
          n(t.tr.replaceSelectionWith(_.image.create({ src: r, alt: e ?? null })).scrollIntoView()),
        !0)
      : !1;
}
function Rn(r, e) {
  const { from: t, $from: n, to: i, empty: o } = r.selection;
  return o ? !!e.isInSet(r.storedMarks ?? n.marks()) : r.doc.rangeHasMark(t, i, e);
}
function ze(r, e, t) {
  const { $from: n, to: i } = r.selection;
  for (let o = n.depth; o > 0; o--) if (n.node(o).type === e) return i <= n.end(o);
  return !1;
}
function xt(r) {
  return r.selection.$from.parent.attrs.align ?? 'left';
}
function fd(r, e) {
  const t = r.selection.$from.parent;
  switch (e) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'code':
    case 'subscript':
    case 'superscript':
      return Rn(r, ne[e]);
    case 'paragraph':
      return t.type === _.paragraph;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return t.type === _.heading && t.attrs.level === Number(e[1]);
    case 'codeBlock':
      return t.type === _.code_block;
    case 'blockquote':
      return ze(r, _.blockquote);
    case 'bulletList':
      return ze(r, _.bullet_list);
    case 'orderedList':
      return ze(r, _.ordered_list);
    case 'alignLeft':
      return xt(r) === 'left';
    case 'alignCenter':
      return xt(r) === 'center';
    case 'alignRight':
      return xt(r) === 'right';
    case 'alignJustify':
      return xt(r) === 'justify';
    default:
      return !1;
  }
}
function gi(r) {
  var n;
  const { $from: e } = r.selection,
    t =
      ne.link.isInSet(e.marks()) ??
      ne.link.isInSet(((n = e.nodeAfter) == null ? void 0 : n.marks) ?? []);
  return t ? t.attrs : null;
}
function bi(r, e, t) {
  const n = r.doc.resolve(t),
    i = n.start(),
    o = [];
  return (
    n.parent.forEach((s, l) => {
      if (!e.isInSet(s.marks)) return;
      const a = i + l,
        c = a + s.nodeSize,
        u = o[o.length - 1];
      u && u.to === a ? (u.to = c) : o.push({ from: a, to: c });
    }),
    o.find((s) => s.from <= t && t <= s.to) ?? null
  );
}
const _r = {
    'toolbar.label': 'Formatting',
    'editor.label': 'Rich text editor',
    undo: 'Undo',
    redo: 'Redo',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    strike: 'Strikethrough',
    code: 'Inline code',
    subscript: 'Subscript',
    superscript: 'Superscript',
    link: 'Link',
    unlink: 'Remove link',
    image: 'Image',
    bulletList: 'Bulleted list',
    orderedList: 'Numbered list',
    indent: 'Increase indent',
    outdent: 'Decrease indent',
    align: 'Alignment',
    alignLeft: 'Align left',
    alignCenter: 'Align center',
    alignRight: 'Align right',
    alignJustify: 'Justify',
    blockquote: 'Quote',
    codeBlock: 'Code block',
    horizontalRule: 'Horizontal line',
    clearFormatting: 'Clear formatting',
    more: 'More',
    moreFormats: 'More formatting',
    blocks: 'Text style',
    paragraph: 'Paragraph',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    h4: 'Heading 4',
    h5: 'Heading 5',
    h6: 'Heading 6',
    fontFamily: 'Font',
    fontSize: 'Font size',
    lineHeight: 'Line height',
    default: 'Default',
    textColor: 'Text color',
    backgroundColor: 'Highlight color',
    removeColor: 'Remove color',
    customColor: 'Custom color',
    'dialog.cancel': 'Cancel',
    'dialog.save': 'Save',
    'dialog.insert': 'Insert',
    'dialog.close': 'Close',
    'link.title': 'Insert link',
    'link.editTitle': 'Edit link',
    'link.url': 'URL',
    'link.text': 'Text to display',
    'link.tooltip': 'Title (tooltip)',
    'link.newTab': 'Open in new tab',
    'link.open': 'Open link',
    'link.edit': 'Edit link',
    'link.copy': 'Copy link',
    'link.copied': 'Link copied',
    'link.invalid': 'This URL is not allowed',
    'image.title': 'Insert image',
    'image.url': 'Image URL',
    'image.alt': 'Alternative text',
    'image.altHint': 'Describe the image for people using screen readers',
    'image.upload': 'Upload',
    'image.drop': 'Drop an image here or click to choose',
    'image.uploading': 'Uploading image…',
    'image.uploadFailed': 'Image upload failed',
    'image.invalid': 'This image URL is not allowed',
    'image.or': 'or',
    'image.toolbar': 'Image options',
    'image.alignLeft': 'Float left',
    'image.alignCenter': 'Center',
    'image.alignRight': 'Float right',
    'image.editAlt': 'Alternative text',
    'image.size': 'Size',
    'image.sizeSmall': 'Small (25%)',
    'image.sizeMedium': 'Medium (50%)',
    'image.sizeLarge': 'Large (75%)',
    'image.sizeFull': 'Full width',
    'image.sizeOriginal': 'Original size',
    'image.delete': 'Remove image',
    'status.words': '{count} words',
    pasteAsText: 'Paste as text',
    'menu.label': 'Menu',
    'menu.file': 'File',
    'menu.edit': 'Edit',
    'menu.view': 'View',
    'menu.insert': 'Insert',
    'menu.format': 'Format',
    'menu.table': 'Table',
    'menu.help': 'Help',
    selectAll: 'Select all',
    print: 'Print',
    'table.rows': 'Rows',
    'table.cols': 'Columns',
    'table.invalidSize': 'Enter a number from 1 to 50',
    'quickbars.selection': 'Quick formatting',
    'quickbars.insert': 'Quick insert',
    'search.title': 'Find and replace',
    'search.find': 'Find',
    'search.replace': 'Replace with',
    'search.next': 'Next match',
    'search.prev': 'Previous match',
    'search.replaceOne': 'Replace',
    'search.replaceAll': 'Replace all',
    'search.matchCase': 'Match case',
    'search.wholeWord': 'Whole words only',
    'search.count': '{current} of {total}',
    'search.none': 'No results',
    fullscreen: 'Fullscreen',
    preview: 'Preview',
    sourceCode: 'Source code',
    help: 'Keyboard shortcuts',
    'help.formatting': 'Text formatting',
    'help.blocks': 'Paragraphs and lists',
    'help.editing': 'Editing',
    'help.navigation': 'Navigation',
    'help.slash': 'Insert block (slash commands)',
    'help.toMenubar': 'Move to the menu bar',
    'help.toToolbar': 'Move to the toolbar',
    'help.toContextToolbar': 'Move to the image/table toolbar',
    'help.toEditor': 'Back to the text',
    'help.nextCell': 'Next table cell',
    table: 'Table',
    'table.insert': 'Insert table',
    'table.size': '{rows} × {cols}',
    'table.toolbar': 'Table options',
    'table.rowBefore': 'Insert row above',
    'table.rowAfter': 'Insert row below',
    'table.rowDelete': 'Delete row',
    'table.colBefore': 'Insert column left',
    'table.colAfter': 'Insert column right',
    'table.colDelete': 'Delete column',
    'table.merge': 'Merge cells',
    'table.split': 'Split cell',
    'table.rowHeader': 'Header row',
    'table.colHeader': 'Header column',
    'table.cellBackground': 'Cell background',
    'table.delete': 'Delete table',
    'slash.label': 'Commands',
    'slash.empty': 'No matching commands',
  },
  hd = {
    'toolbar.label': 'Форматирование',
    'editor.label': 'Текстовый редактор',
    undo: 'Отменить',
    redo: 'Повторить',
    bold: 'Жирный',
    italic: 'Курсив',
    underline: 'Подчёркнутый',
    strike: 'Зачёркнутый',
    code: 'Код в строке',
    subscript: 'Подстрочный',
    superscript: 'Надстрочный',
    link: 'Ссылка',
    unlink: 'Убрать ссылку',
    image: 'Изображение',
    bulletList: 'Маркированный список',
    orderedList: 'Нумерованный список',
    indent: 'Увеличить отступ',
    outdent: 'Уменьшить отступ',
    align: 'Выравнивание',
    alignLeft: 'По левому краю',
    alignCenter: 'По центру',
    alignRight: 'По правому краю',
    alignJustify: 'По ширине',
    blockquote: 'Цитата',
    codeBlock: 'Блок кода',
    horizontalRule: 'Горизонтальная линия',
    clearFormatting: 'Очистить форматирование',
    more: 'Ещё',
    moreFormats: 'Ещё форматирование',
    blocks: 'Стиль текста',
    paragraph: 'Обычный текст',
    h1: 'Заголовок 1',
    h2: 'Заголовок 2',
    h3: 'Заголовок 3',
    h4: 'Заголовок 4',
    h5: 'Заголовок 5',
    h6: 'Заголовок 6',
    fontFamily: 'Шрифт',
    fontSize: 'Размер шрифта',
    lineHeight: 'Межстрочный интервал',
    default: 'По умолчанию',
    textColor: 'Цвет текста',
    backgroundColor: 'Цвет выделения',
    removeColor: 'Убрать цвет',
    customColor: 'Свой цвет',
    'dialog.cancel': 'Отмена',
    'dialog.save': 'Сохранить',
    'dialog.insert': 'Вставить',
    'dialog.close': 'Закрыть',
    'link.title': 'Вставить ссылку',
    'link.editTitle': 'Изменить ссылку',
    'link.url': 'Адрес',
    'link.text': 'Текст ссылки',
    'link.tooltip': 'Подсказка (title)',
    'link.newTab': 'Открывать в новой вкладке',
    'link.open': 'Открыть ссылку',
    'link.edit': 'Изменить ссылку',
    'link.copy': 'Копировать ссылку',
    'link.copied': 'Ссылка скопирована',
    'link.invalid': 'Такой адрес не разрешён',
    'image.title': 'Вставить изображение',
    'image.url': 'Адрес изображения',
    'image.alt': 'Альтернативный текст',
    'image.altHint': 'Опишите изображение для людей, использующих экранный диктор',
    'image.upload': 'Загрузить',
    'image.drop': 'Перетащите изображение сюда или нажмите, чтобы выбрать',
    'image.uploading': 'Загрузка изображения…',
    'image.uploadFailed': 'Не удалось загрузить изображение',
    'image.invalid': 'Такой адрес изображения не разрешён',
    'image.or': 'или',
    'image.toolbar': 'Параметры изображения',
    'image.alignLeft': 'Обтекание, слева',
    'image.alignCenter': 'По центру',
    'image.alignRight': 'Обтекание, справа',
    'image.editAlt': 'Альтернативный текст',
    'image.size': 'Размер',
    'image.sizeSmall': 'Маленький (25%)',
    'image.sizeMedium': 'Средний (50%)',
    'image.sizeLarge': 'Большой (75%)',
    'image.sizeFull': 'Во всю ширину',
    'image.sizeOriginal': 'Исходный размер',
    'image.delete': 'Удалить изображение',
    'status.words': 'Слов: {count}',
    pasteAsText: 'Вставлять как текст',
    'menu.label': 'Меню',
    'menu.file': 'Файл',
    'menu.edit': 'Правка',
    'menu.view': 'Вид',
    'menu.insert': 'Вставка',
    'menu.format': 'Формат',
    'menu.table': 'Таблица',
    'menu.help': 'Справка',
    selectAll: 'Выделить всё',
    print: 'Печать',
    'table.rows': 'Строки',
    'table.cols': 'Столбцы',
    'table.invalidSize': 'Введите число от 1 до 50',
    'quickbars.selection': 'Быстрое форматирование',
    'quickbars.insert': 'Быстрая вставка',
    'search.title': 'Найти и заменить',
    'search.find': 'Найти',
    'search.replace': 'Заменить на',
    'search.next': 'Следующее совпадение',
    'search.prev': 'Предыдущее совпадение',
    'search.replaceOne': 'Заменить',
    'search.replaceAll': 'Заменить все',
    'search.matchCase': 'Учитывать регистр',
    'search.wholeWord': 'Только слово целиком',
    'search.count': '{current} из {total}',
    'search.none': 'Не найдено',
    fullscreen: 'На весь экран',
    preview: 'Предпросмотр',
    sourceCode: 'HTML-код',
    help: 'Горячие клавиши',
    'help.formatting': 'Форматирование текста',
    'help.blocks': 'Абзацы и списки',
    'help.editing': 'Редактирование',
    'help.navigation': 'Навигация',
    'help.slash': 'Вставить блок (слэш-команды)',
    'help.toMenubar': 'Перейти в главное меню',
    'help.toToolbar': 'Перейти на панель инструментов',
    'help.toContextToolbar': 'Перейти на панель картинки/таблицы',
    'help.toEditor': 'Вернуться в текст',
    'help.nextCell': 'Следующая ячейка таблицы',
    table: 'Таблица',
    'table.insert': 'Вставить таблицу',
    'table.size': '{rows} × {cols}',
    'table.toolbar': 'Параметры таблицы',
    'table.rowBefore': 'Вставить строку выше',
    'table.rowAfter': 'Вставить строку ниже',
    'table.rowDelete': 'Удалить строку',
    'table.colBefore': 'Вставить столбец слева',
    'table.colAfter': 'Вставить столбец справа',
    'table.colDelete': 'Удалить столбец',
    'table.merge': 'Объединить ячейки',
    'table.split': 'Разделить ячейку',
    'table.rowHeader': 'Строка заголовков',
    'table.colHeader': 'Столбец заголовков',
    'table.cellBackground': 'Фон ячейки',
    'table.delete': 'Удалить таблицу',
    'slash.label': 'Команды',
    'slash.empty': 'Нет подходящих команд',
  },
  Ho = { en: _r, ru: hd };
function dd(r = 'en', e = {}) {
  const t = r.toLowerCase(),
    n = Ho[t] ?? Ho[t.split('-')[0]] ?? _r,
    i = { ..._r, ...n, ...e };
  return (o, s) => {
    const l = i[o] ?? o;
    return s ? l.replace(/\{(\w+)\}/g, (a, c) => String(s[c] ?? `{${c}}`)) : l;
  };
}
function x(r, e = {}, ...t) {
  const n = document.createElement(r);
  for (const [i, o] of Object.entries(e))
    o == null ||
      o === !1 ||
      (typeof o == 'function'
        ? n.addEventListener(i.replace(/^on/, '').toLowerCase(), o)
        : i === 'className'
          ? (n.className = String(o))
          : n.setAttribute(i, o === !0 ? '' : String(o)));
  for (const i of t.flat()) i == null || i === !1 || n.append(i);
  return n;
}
function de(r) {
  const e = document.createElement('span');
  return ((e.className = 'nova-icon'), (e.innerHTML = r), e);
}
let Wo = 0;
function Lt(r = 'nova') {
  return ((Wo += 1), `${r}-${Wo}`);
}
const pd = typeof navigator < 'u' && /Mac|iP(hone|[oa]d)/.test(navigator.platform);
function rr(r) {
  const e = r.split('-'),
    t = e.pop(),
    n = t.length === 1 ? t.toUpperCase() : t;
  if (pd) {
    const o = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' };
    return e.map((s) => o[s] ?? s).join('') + n;
  }
  const i = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Ctrl: 'Ctrl' };
  return [...e.map((o) => i[o] ?? o), n].join('+');
}
const qo =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  A = (r) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${r}</svg>`,
  M = {
    undo: A('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    redo: A('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
    bold: A('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
    italic: A('<path d="M14 5h-4M14 19h-4M14 5l-4 14"/>'),
    underline: A('<path d="M7 4v6a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>'),
    strike: A(
      '<path d="M4 12h16"/><path d="M16 7a4 3 0 0 0-4-2c-2.5 0-4 1.3-4 3"/><path d="M8 17a4 3 0 0 0 4 2c2.5 0 4-1.3 4-3"/>',
    ),
    code: A('<path d="m9 8-4 4 4 4"/><path d="m15 8 4 4-4 4"/>'),
    subscript: A(
      '<path d="m4 6 8 9M12 6l-8 9"/><path d="M20 20h-4c0-1.5 4-2 4-4a1.5 1.5 0 0 0-3-.5"/>',
    ),
    superscript: A(
      '<path d="m4 9 8 9M12 9l-8 9"/><path d="M20 10h-4c0-1.5 4-2 4-4a1.5 1.5 0 0 0-3-.5"/>',
    ),
    bulletList: A(
      '<circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9 7h11M9 12h11M9 17h11"/>',
    ),
    orderedList: A(
      '<path d="M4 5h1v4M4 9h2"/><path d="M4 14h2l-2 3h2"/><path d="M10 7h10M10 12h10M10 17h10"/>',
    ),
    indent: A('<path d="M4 6h16M10 12h10M4 18h16"/><path d="m4 10 3 2-3 2"/>'),
    outdent: A('<path d="M4 6h16M10 12h10M4 18h16"/><path d="m7 10-3 2 3 2"/>'),
    blockquote: A(
      '<path d="M6 17c-1.5 0-2.5-1-2.5-3 0-3 2-6 5-7"/><path d="M15 17c-1.5 0-2.5-1-2.5-3 0-3 2-6 5-7"/><circle cx="6" cy="14" r="2.5"/><circle cx="15" cy="14" r="2.5"/>',
    ),
    codeBlock: A(
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m9 10-2 2 2 2M15 10l2 2-2 2"/>',
    ),
    alignLeft: A('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    alignCenter: A('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    alignRight: A('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    alignJustify: A('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>'),
    horizontalRule: A('<path d="M4 12h16"/><path d="M8 7h8M8 17h8" opacity=".4"/>'),
    link: A(
      '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    ),
    unlink: A(
      '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/><path d="M3 3l18 18"/>',
    ),
    image: A(
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    ),
    clearFormatting: A('<path d="M6 5h12M12 5l-3 14"/><path d="m15 15 5 5M20 15l-5 5"/>'),
    formatMore: A(
      '<path d="M3 7h10M8 7v12"/><path d="M21 11h-4c0-1.5 4-2 4-4a1.5 1.5 0 0 0-3-.5"/>',
    ),
    imageLeft: A(
      '<rect x="3" y="5" width="8" height="8" rx="1"/><path d="M14 6h7M14 10h7M3 17h18M3 20h12"/>',
    ),
    imageCenter: A('<rect x="7" y="4" width="10" height="9" rx="1"/><path d="M3 17h18M6 20h12"/>'),
    imageRight: A(
      '<rect x="13" y="5" width="8" height="8" rx="1"/><path d="M3 6h7M3 10h7M3 17h18M9 20h12"/>',
    ),
    resize: A('<path d="M15 3h6v6M9 21H3v-6"/><path d="m21 3-7 7M3 21l7-7"/>'),
    altText: A(
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l2.5-6 2.5 6M7.8 13h3.4M15 9v6h3"/>',
    ),
    trash: A('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    paragraph: A('<path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>'),
    h1: A('<path d="M4 6v12M12 6v12M4 12h8"/><path d="m16 9 3-2v11"/>'),
    h2: A(
      '<path d="M4 6v12M12 6v12M4 12h8"/><path d="M16 9.5a2.5 2.5 0 1 1 5 .5c0 1.5-5 4-5 8h5"/>',
    ),
    h3: A('<path d="M4 6v12M12 6v12M4 12h8"/><path d="M16 7.5h4.5l-2.5 3.5a3 3 0 1 1-2.5 5"/>'),
    pasteText: A(
      '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M12 10v7"/>',
    ),
    table: A(
      '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
    ),
    rowBefore: A('<rect x="3" y="12" width="18" height="8" rx="1"/><path d="M12 3v6M9 6h6"/>'),
    rowAfter: A('<rect x="3" y="4" width="18" height="8" rx="1"/><path d="M12 15v6M9 18h6"/>'),
    rowDelete: A(
      '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="m10 10 4 4M14 10l-4 4"/>',
    ),
    colBefore: A('<rect x="12" y="3" width="8" height="18" rx="1"/><path d="M3 12h6M6 9v6"/>'),
    colAfter: A('<rect x="4" y="3" width="8" height="18" rx="1"/><path d="M15 12h6M18 9v6"/>'),
    colDelete: A(
      '<rect x="8" y="3" width="8" height="18" rx="1"/><path d="m10 10 4 4M14 10l-4 4"/>',
    ),
    merge: A(
      '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M6 12h4M14 12h4M8 10l2 2-2 2M16 10l-2 2 2 2"/>',
    ),
    split: A(
      '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M5 12h4M15 12h4M7 10l-2 2 2 2M17 10l2 2-2 2"/>',
    ),
    rowHeader: A(
      '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18"/><path d="M4 5h16v4H4z" fill="currentColor" opacity=".35" stroke="none"/>',
    ),
    colHeader: A(
      '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9.5 4v16"/><path d="M4 5h5v14H4z" fill="currentColor" opacity=".35" stroke="none"/>',
    ),
    tableDelete: A(
      '<rect x="3" y="4" width="13" height="12" rx="1"/><path d="M3 10h13M9.5 4v12"/><path d="m17 15 4 4M21 15l-4 4"/>',
    ),
    chevronUp: A('<path d="m7 14 5-5 5 5"/>'),
    search: A('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
    fullscreen: A('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    fullscreenExit: A('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    preview: A(
      '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    ),
    sourceCode: A('<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'),
    help: A(
      '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    ),
    print: A(
      '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    ),
    check: A('<path d="m5 12 5 5 9-10"/>'),
    close: A('<path d="M6 6l12 12M18 6 6 18"/>'),
    chevronDown: A('<path d="m7 10 5 5 5-5"/>'),
    more: A(
      '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
    ),
    textColor: A('<path d="m6 16 6-12 6 12"/><path d="M8.5 11h7"/>'),
    highlight: A('<path d="m14 4 6 6-8 8H6v-6z"/><path d="m11 7 6 6"/>'),
    lineHeight: A(
      '<path d="M11 6h10M11 12h10M11 18h10"/><path d="m3 8 3-3 3 3M3 16l3 3 3-3M6 5v14"/>',
    ),
    upload: A(
      '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    ),
    externalLink: A(
      '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    ),
    copy: A(
      '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    ),
    edit: A('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  };
function md(r) {
  const e = Lt('nova-dialog-title'),
    t = x('p', { className: 'nova-dialog-error', role: 'alert', hidden: !0 }),
    n = x(
      'button',
      { type: 'submit', className: 'nova-button nova-button-primary', hidden: !r.submitLabel },
      r.submitLabel ?? '',
    ),
    i = x('button', { type: 'button', className: 'nova-button' }, r.cancelLabel),
    o = x(
      'button',
      { type: 'button', className: 'nova-btn nova-dialog-close', 'aria-label': r.closeLabel },
      de(M.close),
    ),
    s = x(
      'form',
      {
        className: r.size === 'large' ? 'nova-dialog nova-dialog-large' : 'nova-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': e,
        novalidate: !0,
      },
      x('header', { className: 'nova-dialog-header' }, x('h2', { id: e }, r.title), o),
      x('div', { className: 'nova-dialog-body' }, r.body, t),
      x('footer', { className: 'nova-dialog-footer' }, i, n),
    ),
    l = x('div', { className: 'nova-dialog-backdrop' }, s);
  r.host.append(l);
  let a = !1;
  const c = () => {
      var p, m;
      a ||
        ((a = !0),
        l.remove(),
        document.removeEventListener('focusin', h, !0),
        (p = r.onClose) == null || p.call(r),
        (m = r.returnFocus) == null || m.call(r));
    },
    u = (p) => {
      ((t.hidden = !p), (t.textContent = p ?? ''));
    },
    f = (p) => {
      ((n.disabled = p), s.setAttribute('aria-busy', String(p)));
    };
  (s.addEventListener('submit', async (p) => {
    (p.preventDefault(), u(null), f(!0));
    try {
      const m = r.onSubmit ? await r.onSubmit() : !0;
      typeof m == 'string' ? u(m) : m !== !1 && c();
    } finally {
      a || f(!1);
    }
  }),
    i.addEventListener('click', c),
    o.addEventListener('click', c),
    l.addEventListener('mousedown', (p) => {
      p.target === l && c();
    }),
    s.addEventListener('keydown', (p) => {
      if (p.key === 'Escape') (p.preventDefault(), p.stopPropagation(), c());
      else if (p.key === 'Tab') {
        const m = [...s.querySelectorAll(qo)].filter((y) => !y.hidden),
          b = m[0],
          g = m[m.length - 1];
        if (!b || !g) return;
        p.shiftKey && document.activeElement === b
          ? (p.preventDefault(), g.focus())
          : !p.shiftKey && document.activeElement === g && (p.preventDefault(), b.focus());
      }
    }));
  const h = (p) => {
    s.contains(p.target) || (s.querySelector(qo) ?? s).focus();
  };
  return (
    document.addEventListener('focusin', h, !0),
    (
      r.initialFocus ??
      s.querySelector('.nova-dialog-body input, .nova-dialog-body textarea') ??
      (r.submitLabel ? n : i)
    ).focus(),
    { el: s, close: c, setError: u, setBusy: f }
  );
}
function Be(r) {
  const e = Lt('nova-field'),
    t = r.hint ? `${e}-hint` : void 0,
    n = x('input', {
      id: e,
      type: r.type ?? 'text',
      className: 'nova-input',
      value: r.value ?? '',
      placeholder: r.placeholder,
      required: r.required ?? !1,
      autocomplete: r.autocomplete ?? 'off',
      spellcheck: 'false',
      'aria-describedby': t,
    });
  return (
    (n.value = r.value ?? ''),
    {
      el: x(
        'div',
        { className: 'nova-field' },
        x('label', { for: e, className: 'nova-label' }, r.label),
        n,
        r.hint ? x('p', { id: t, className: 'nova-hint' }, r.hint) : null,
      ),
      input: n,
    }
  );
}
function gd(r, e = !1) {
  const t = Lt('nova-check'),
    n = x('input', { id: t, type: 'checkbox', className: 'nova-checkbox' });
  return (
    (n.checked = e),
    {
      el: x('div', { className: 'nova-field nova-field-inline' }, n, x('label', { for: t }, r)),
      input: n,
    }
  );
}
const bd = /^image\/(png|jpe?g|gif|webp|avif|bmp)$/;
function Kn(r) {
  return bd.test(r.type);
}
function yd(r) {
  return new Promise((e, t) => {
    const n = new FileReader();
    ((n.onload = () => e(String(n.result))),
      (n.onerror = () => t(n.error ?? new Error('FileReader failed'))),
      n.readAsDataURL(r));
  });
}
function Jo(r, e) {
  let t = null;
  return (
    r.state.doc.descendants((n, i) =>
      t !== null ? !1 : (n.type === R.nodes.image && n.attrs.src === e && (t = i), !0),
    ),
    t
  );
}
function Kr(r, e, t) {
  const n = e.filter(Kn),
    i = r.view;
  for (const o of n) {
    const s = URL.createObjectURL(o),
      l = R.nodes.image.create({ src: s, alt: null }),
      a = i.state.tr;
    (t !== void 0 ? a.insert(Math.min(t, a.doc.content.size), l) : a.replaceSelectionWith(l),
      i.dispatch(a.scrollIntoView()));
    const c = r.options.uploadImage,
      u = c ? r.ui.notify({ text: r.ui.t('image.uploading'), timeout: 0 }) : null;
    (c
      ? c(o, (h) =>
          u == null ? void 0 : u.setText(`${r.ui.t('image.uploading')} ${Math.round(h)}%`),
        )
      : yd(o)
    )
      .then((h) => {
        if (!It(h)) throw new Error(`Unsafe image URL returned: ${h}`);
        const d = Jo(i, s);
        if (d === null) return;
        const p = i.state.doc.nodeAt(d);
        i.dispatch(
          i.state.tr.setNodeMarkup(d, void 0, { ...p.attrs, src: h }).setMeta('addToHistory', !1),
        );
      })
      .catch((h) => {
        console.error('[nova] image upload failed', h);
        const d = Jo(i, s);
        (d !== null && i.dispatch(i.state.tr.delete(d, d + 1).setMeta('addToHistory', !1)),
          r.ui.notify({ text: r.ui.t('image.uploadFailed'), type: 'error' }));
      })
      .finally(() => {
        (u == null || u.close(), URL.revokeObjectURL(s));
      });
  }
}
function wd(r) {
  return new pe({
    key: new ye('nova-image-drop-paste'),
    props: {
      handlePaste(e, t) {
        if (!r.isAllowed('image')) return !1;
        const n = t.clipboardData;
        if (!n || n.getData('text/html')) return !1;
        const i = [...n.files].filter(Kn);
        return i.length ? (Kr(r, i), !0) : !1;
      },
      handleDrop(e, t) {
        var o;
        if (!r.isAllowed('image')) return !1;
        const n = [...(((o = t.dataTransfer) == null ? void 0 : o.files) ?? [])].filter(Kn);
        if (!n.length) return !1;
        t.preventDefault();
        const i = e.posAtCoords({ left: t.clientX, top: t.clientY });
        return (Kr(r, n, i == null ? void 0 : i.pos), !0);
      },
    },
  });
}
function Ql(r) {
  const { t: e } = r.ui,
    t = x('input', {
      type: 'file',
      accept: 'image/png,image/jpeg,image/gif,image/webp,image/avif',
      className: 'nova-visually-hidden',
      tabindex: '-1',
    }),
    n = x(
      'button',
      { type: 'button', className: 'nova-dropzone' },
      de(M.upload),
      x('span', {}, e('image.drop')),
    ),
    i = Be({ label: e('image.url'), type: 'url', placeholder: 'https://' }),
    o = Be({ label: e('image.alt'), hint: e('image.altHint') }),
    s = x(
      'div',
      { className: 'nova-form' },
      n,
      t,
      x('div', { className: 'nova-divider' }, x('span', {}, e('image.or'))),
      i.el,
      o.el,
    ),
    l = r.ui.openDialog({
      title: e('image.title'),
      body: s,
      submitLabel: e('dialog.insert'),
      initialFocus: i.input,
      onSubmit: () => {
        const c = i.input.value.trim();
        return !c || !It(c)
          ? (i.input.setAttribute('aria-invalid', 'true'), i.input.focus(), e('image.invalid'))
          : (r.exec(ud(c, o.input.value.trim() || void 0)), !0);
      },
    }),
    a = (c) => {
      const u = c.filter(Kn);
      u.length && (l.close(), Kr(r, u));
    };
  (n.addEventListener('click', () => t.click()),
    t.addEventListener('change', () => a([...(t.files ?? [])])),
    n.addEventListener('dragover', (c) => {
      (c.preventDefault(), n.classList.add('is-dragover'));
    }),
    n.addEventListener('dragleave', () => n.classList.remove('is-dragover')),
    n.addEventListener('drop', (c) => {
      var u;
      (c.preventDefault(),
        n.classList.remove('is-dragover'),
        a([...(((u = c.dataTransfer) == null ? void 0 : u.files) ?? [])]));
    }));
}
function St(r) {
  const { selection: e } = r;
  return e instanceof E && e.node.type === R.nodes.image ? { node: e.node, pos: e.from } : null;
}
function Un(r) {
  return (e, t) => {
    const n = St(e);
    if (!n) return !1;
    if (t) {
      const i = e.tr.setNodeMarkup(n.pos, void 0, { ...n.node.attrs, ...r });
      (i.setSelection(E.create(i.doc, n.pos)), t(i));
    }
    return !0;
  };
}
function kd(r, e) {
  const t = St(r.view.state);
  if (!t) return !1;
  if (e === null) return r.exec(Un({ width: null, height: null }));
  const n = r.view.nodeDOM(t.pos),
    i = (n == null ? void 0 : n.querySelector('img')) ?? null,
    o = getComputedStyle(r.view.dom),
    s =
      r.view.dom.clientWidth - parseFloat(o.paddingLeft || '0') - parseFloat(o.paddingRight || '0'),
    l = Math.max(24, Math.round(s * e)),
    a = i && i.naturalWidth ? i.naturalHeight / i.naturalWidth : null;
  return r.exec(Un({ width: l, height: a ? Math.round(l * a) : null }));
}
function xd(r) {
  const e = St(r.view.state);
  if (!e) return;
  const { t } = r.ui,
    n = Be({ label: t('image.alt'), value: e.node.attrs.alt ?? '', hint: t('image.altHint') }),
    i = Be({ label: t('link.tooltip'), value: e.node.attrs.title ?? '' });
  r.ui.openDialog({
    title: t('image.editAlt'),
    body: x('div', { className: 'nova-form' }, n.el, i.el),
    submitLabel: t('dialog.save'),
    initialFocus: n.input,
    onSubmit: () => (
      r.exec(Un({ alt: n.input.value.trim() || null, title: i.input.value.trim() || null })),
      !0
    ),
  });
}
class Ye {
  constructor(e, t, n = {}) {
    ((this.match = e),
      (this.match = e),
      (this.handler = typeof t == 'string' ? Md(t) : t),
      (this.undoable = n.undoable !== !1),
      (this.inCode = n.inCode || !1),
      (this.inCodeMark = n.inCodeMark !== !1));
  }
}
function Md(r) {
  return function (e, t, n, i) {
    let o = r;
    if (t[1]) {
      let s = t[0].lastIndexOf(t[1]);
      ((o += t[0].slice(s + t[1].length)), (n += s));
      let l = n - i;
      l > 0 && ((o = t[0].slice(s - l, s) + o), (n = i));
    }
    return e.tr.insertText(o, n, i);
  };
}
const Cd = 500;
function Sd({ rules: r }) {
  let e = new pe({
    state: {
      init() {
        return null;
      },
      apply(t, n) {
        let i = t.getMeta(this);
        return i || (t.selectionSet || t.docChanged ? null : n);
      },
    },
    props: {
      handleTextInput(t, n, i, o) {
        return _o(t, n, i, o, r, e);
      },
      handleDOMEvents: {
        compositionend: (t) => {
          setTimeout(() => {
            let { $cursor: n } = t.state.selection;
            n && _o(t, n.pos, n.pos, '', r, e);
          });
        },
      },
    },
    isInputRules: !0,
  });
  return e;
}
function _o(r, e, t, n, i, o) {
  if (r.composing) return !1;
  let s = r.state,
    l = s.doc.resolve(e),
    a = r.state.selection,
    c = l.parent.textBetween(Math.max(0, l.parentOffset - Cd), l.parentOffset, null, '￼') + n,
    u =
      (e == a.from && t == a.to && r.state.storedMarks) ||
      (e == t ? l.marks() : l.marksAcross(s.doc.resolve(t)) || []);
  for (let f = 0; f < i.length; f++) {
    let h = i[f];
    if (!h.inCodeMark && u.some((b) => b.type.spec.code)) continue;
    if (l.parent.type.spec.code) {
      if (!h.inCode) continue;
    } else if (h.inCode === 'only') continue;
    let d = h.match.exec(c);
    if (!d || d[0].length < n.length) continue;
    let p = e - (d[0].length - n.length);
    if (!h.inCodeMark) {
      let b = !1;
      if (
        (s.doc.nodesBetween(p, l.pos, (g) => {
          g.isInline && g.marks.some((y) => y.type.spec.code) && (b = !0);
        }),
        b)
      )
        continue;
    }
    let m = h.handler(s, d, p, t, n);
    if (m)
      return (
        h.undoable && m.setMeta(o, { transform: m, from: e, to: t, text: n }),
        r.dispatch(m),
        !0
      );
  }
  return !1;
}
const vd = new Ye(/--$/, '—', { inCodeMark: !1 }),
  Ad = new Ye(/\.\.\.$/, '…', { inCodeMark: !1 });
new Ye(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, '“', { inCodeMark: !1 });
new Ye(/"$/, '”', { inCodeMark: !1 });
new Ye(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, '‘', { inCodeMark: !1 });
new Ye(/'$/, '’', { inCodeMark: !1 });
function xr(r, e, t, n) {
  let i, o;
  return (
    e instanceof Xt
      ? (o = e)
      : ((i = e), (o = e.nodeType), (t = e.getAttrs), (n = e.joinPredicate)),
    new Ye(
      r,
      (s, l, a, c) => {
        let u = t instanceof Function ? t(l) : t,
          f = s.tr.delete(a, c),
          h = f.doc.resolve(a),
          d = h.blockRange(),
          p = d && ei(d, o, u);
        if (!p) return null;
        f.wrap(d, p);
        let m = f.doc.resolve(a - 1).nodeBefore;
        return (m && m.type == o && Xn(f.doc, a - 1) && (!n || n(l, m)) && f.join(a - 1), f);
      },
      i,
    )
  );
}
function Ko(r, e, t) {
  let n, i;
  return (
    e instanceof Xt ? (i = e) : ((n = e), (i = e.nodeType), (t = e.getAttrs)),
    new Ye(
      r,
      (o, s, l, a) => {
        let c = o.doc.resolve(l),
          u = t instanceof Function ? t(s) : t;
        return c.node(-1).canReplaceWith(c.index(-1), c.indexAfter(-1), i)
          ? o.tr.delete(l, a).setBlockType(l, l, i, u)
          : null;
      },
      n,
    )
  );
}
function Nd(r = () => !0) {
  const { nodes: e } = R,
    t = [Ad, vd];
  (r('blockquote') && t.push(xr(/^\s*>\s$/, e.blockquote)),
    r('numlist') &&
      t.push(
        xr(
          /^(\d+)\.\s$/,
          e.ordered_list,
          (n) => ({ start: Number(n[1]) }),
          (n, i) => i.childCount + i.attrs.start === Number(n[1]),
        ),
      ),
    r('bullist') && t.push(xr(/^\s*([-+*])\s$/, e.bullet_list)),
    r('codeblock') && t.push(Ko(/^```$/, e.code_block)));
  for (let n = 1; n <= 6; n++)
    r(`h${n}`) && t.push(Ko(new RegExp(`^(#{${n}})\\s$`), e.heading, { level: n }));
  return Sd({ rules: t });
}
const Ed = typeof navigator < 'u' && /Mac|iP(hone|[oa]d)/.test(navigator.platform),
  Td = tr(
    Ll,
    (r, e) => (
      e == null || e(r.tr.replaceSelectionWith(R.nodes.hard_break.create()).scrollIntoView()),
      !0
    ),
  );
function Od() {
  const r = {
    'Mod-z': $.undo,
    'Shift-Mod-z': $.redo,
    'Mod-b': $.bold,
    'Mod-i': $.italic,
    'Mod-u': $.underline,
    'Mod-Shift-x': $.strike,
    'Mod-e': $.code,
    'Mod-,': $.subscript,
    'Mod-.': $.superscript,
    'Mod-Alt-0': $.paragraph,
    'Mod-Alt-1': $.h1,
    'Mod-Alt-2': $.h2,
    'Mod-Alt-3': $.h3,
    'Mod-Alt-4': $.h4,
    'Mod-Alt-5': $.h5,
    'Mod-Alt-6': $.h6,
    'Mod-Shift-7': $.orderedList,
    'Mod-Shift-8': $.bulletList,
    'Mod-Shift-l': $.alignLeft,
    'Mod-Shift-e': $.alignCenter,
    'Mod-Shift-r': $.alignRight,
    'Mod-Shift-j': $.alignJustify,
    'Mod-\\': $.clearFormatting,
    'Shift-Enter': Td,
    Enter: Wf(R.nodes.list_item),
    Tab: $.indent,
    'Shift-Tab': $.outdent,
  };
  return (Ed || (r['Mod-y'] = $.redo), [$n(r), $n(Ff)]);
}
function Zl(r) {
  const e = r.trim();
  return e
    ? /^[a-z][a-z0-9+.-]*:/i.test(e) || /^[/#?.]/.test(e)
      ? e
      : /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(e)
        ? `mailto:${e}`
        : /^(www\.)?[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i.test(e)
          ? `https://${e}`
          : e
    : '';
}
function yi(r) {
  const { from: e, to: t, empty: n, $from: i } = r.selection;
  return n ? (bi(r, R.marks.link, i.pos) ?? { from: e, to: t }) : { from: e, to: t };
}
function Dd(r) {
  return (e, t) => {
    var u;
    const n = Zl(r.href);
    if (!n || !ln(n)) return !1;
    if (!t) return !0;
    const { from: i, to: o } = yi(e),
      s = R.marks.link.create({ href: n, title: r.title || null, target: r.target || null }),
      l = e.doc.textBetween(i, o),
      a = (u = r.text) != null && u.trim() ? r.text : null,
      c = e.tr;
    if (i === o || (a !== null && a !== l)) {
      const f = R.marks.link.removeFromSet(e.doc.resolve(i).marks()),
        h = R.text(a ?? (l || n), s.addToSet(f));
      c.replaceWith(i, o, h);
    } else c.removeMark(i, o, R.marks.link).addMark(i, o, s);
    return (t(c.scrollIntoView()), !0);
  };
}
function Ur() {
  return (r, e) => {
    const { from: t, to: n } = yi(r);
    return t === n || !r.doc.rangeHasMark(t, n, R.marks.link)
      ? !1
      : (e == null || e(r.tr.removeMark(t, n, R.marks.link)), !0);
  };
}
function ir(r) {
  const { t: e } = r.ui,
    t = r.view.state,
    n = gi(t),
    i = yi(t),
    o = t.doc.textBetween(i.from, i.to),
    s =
      !o.includes(`
`) && t.selection.$from.sameParent(t.doc.resolve(i.to)),
    l = Be({
      label: e('link.url'),
      type: 'url',
      value: (n == null ? void 0 : n.href) ?? '',
      placeholder: 'https://',
      required: !0,
    }),
    a = Be({ label: e('link.text'), value: o }),
    c = Be({ label: e('link.tooltip'), value: (n == null ? void 0 : n.title) ?? '' }),
    u = gd(e('link.newTab'), (n == null ? void 0 : n.target) === '_blank'),
    f = x('div', { className: 'nova-form' }, l.el, s ? a.el : null, c.el, u.el);
  r.ui.openDialog({
    title: e(n ? 'link.editTitle' : 'link.title'),
    body: f,
    submitLabel: e(n ? 'dialog.save' : 'dialog.insert'),
    initialFocus: l.input,
    onSubmit: () => {
      const h = Zl(l.input.value);
      return !h || !ln(h)
        ? (l.input.setAttribute('aria-invalid', 'true'), l.input.focus(), e('link.invalid'))
        : (r.exec(
            Dd({
              href: h,
              ...(s ? { text: a.input.value } : {}),
              title: c.input.value.trim() || null,
              target: u.input.checked ? '_blank' : null,
            }),
          ),
          !0);
    },
  });
}
const Rd = new ye('nova-paste');
function Id(r) {
  const e = document.createElement('template');
  e.innerHTML = r;
  const t = /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|TR|SECTION|ARTICLE|HEADER|FOOTER)$/;
  let n = '';
  const i = (o) => {
    if (o.nodeType === Node.TEXT_NODE) {
      n += (o.textContent ?? '').replace(/\s+/g, ' ');
      return;
    }
    if (!(o instanceof Element)) {
      o.childNodes.forEach(i);
      return;
    }
    if (/^(SCRIPT|STYLE|META|TITLE|HEAD)$/.test(o.tagName)) return;
    if (o.tagName === 'BR') {
      n += `
`;
      return;
    }
    const s = t.test(o.tagName);
    (s &&
      n &&
      !n.endsWith(`
`) &&
      (n += `
`),
      o.childNodes.forEach(i),
      s &&
        (n += `
`));
  };
  return (
    e.content.childNodes.forEach(i),
    n
      .split(
        `
`,
      )
      .map((o) => o.trim())
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
function Ld(r) {
  let e = !1;
  return new pe({
    key: Rd,
    props: {
      transformPastedHTML(t) {
        const { pastePreprocess: n, pastePostprocess: i } = r.options;
        let o = n ? n(t, r) : t;
        if (i) {
          const s = document.createElement('template');
          s.innerHTML = o;
          const l = document.createElement('div');
          (l.append(s.content), i(l, r), (o = l.innerHTML));
        }
        return o;
      },
      handlePaste(t, n, i) {
        var l, a;
        if (e || !r.isPasteAsText()) return !1;
        const o = (l = n.clipboardData) == null ? void 0 : l.getData('text/html'),
          s = o
            ? Id(o)
            : ((a = n.clipboardData) == null ? void 0 : a.getData('text/plain')) ||
              i.content.textBetween(
                0,
                i.content.size,
                `

`,
              );
        if (!s) return !1;
        e = !0;
        try {
          t.pasteText(s);
        } finally {
          e = !1;
        }
        return !0;
      },
    },
  });
}
const Ft = 10;
function zd(r, e, t = !0) {
  const { table: n, table_row: i, table_cell: o, table_header: s, paragraph: l } = R.nodes,
    a = [];
  for (let c = 0; c < r; c++) {
    const u = t && c === 0 ? s : o,
      f = [];
    for (let h = 0; h < e; h++) f.push(u.create(null, l.create()));
    a.push(i.create(null, f));
  }
  return n.create(null, a);
}
function an(r, e, t = !0) {
  return (n, i) => {
    if (r < 1 || e < 1 || r > 100 || e > 50 || X(n)) return !1;
    if (i) {
      const o = zd(r, e, t),
        s = n.tr.replaceSelectionWith(o);
      let l = -1;
      (s.doc.descendants((a, c) => (a === o && (l = c), l < 0)),
        l >= 0 && s.setSelection(L.near(s.doc.resolve(l + 3))),
        i(s.scrollIntoView()));
    }
    return !0;
  };
}
const Bd = (r, e, t) => {
  if (!X(r)) return !1;
  if (Wr(1)(r, e) || !e) return !0;
  let n = r;
  return (
    Kl(r, (i) => {
      ((n = r.apply(i)), e(i));
    }),
    Wr(1)(n, e)
  );
};
function Pd() {
  return [Bh({ cellMinWidth: 48 }), Kh(), $n({ Tab: Bd, 'Shift-Tab': Wr(-1) })];
}
const we = {
  addRowBefore: gh,
  addRowAfter: Kl,
  deleteRow: yh,
  addColumnBefore: fh,
  addColumnAfter: hh,
  deleteColumn: ph,
  mergeCells: kh,
  splitCell: xh,
  toggleHeaderRow: sn('row'),
  toggleHeaderColumn: sn('column'),
  deleteTable: Ah,
};
function Fd(r) {
  return Ch('background', r);
}
function $d(r) {
  var n;
  if (!X(r)) return !1;
  const e = (n = mi(r.selection.$from)) == null ? void 0 : n.node.firstChild;
  if (!e || e.childCount === 0) return !1;
  let t = !0;
  return (
    e.forEach((i) => {
      i.type !== R.nodes.table_header && (t = !1);
    }),
    t
  );
}
function Vd(r) {
  var n;
  if (!X(r)) return !1;
  const e = (n = mi(r.selection.$from)) == null ? void 0 : n.node;
  if (!e) return !1;
  let t = !0;
  return (
    e.forEach((i) => {
      var o;
      ((o = i.firstChild) == null ? void 0 : o.type) !== R.nodes.table_header && (t = !1);
    }),
    t
  );
}
function Hd(r) {
  const { state: e } = r.view;
  if (!X(e)) return null;
  const t = mi(e.selection.$from);
  if (!t) return null;
  const n = r.view.nodeDOM(t.pos);
  return (n == null ? void 0 : n.getBoundingClientRect()) ?? null;
}
function Wd(r, e, t) {
  let n = 1,
    i = 1;
  const o = [],
    s = x('div', { className: 'nova-grid-caption', 'aria-live': 'polite' }),
    l = x('div', { className: 'nova-grid', role: 'grid', 'aria-label': t }),
    a = () => {
      for (const c of o) {
        const u = Number(c.dataset.row),
          f = Number(c.dataset.col);
        (c.classList.toggle('is-on', u <= n && f <= i), (c.tabIndex = u === n && f === i ? 0 : -1));
      }
      s.textContent = e(n, i);
    };
  for (let c = 1; c <= Ft; c++)
    for (let u = 1; u <= Ft; u++) {
      const f = x('button', {
        type: 'button',
        className: 'nova-grid-cell',
        role: 'gridcell',
        'aria-label': e(c, u),
        'data-row': String(c),
        'data-col': String(u),
      });
      (f.addEventListener('mouseenter', () => {
        ((n = c), (i = u), a());
      }),
        f.addEventListener('click', () => r(c, u)),
        o.push(f),
        l.append(f));
    }
  return (
    l.addEventListener('keydown', (c) => {
      const f = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[
        c.key
      ];
      f &&
        (c.preventDefault(),
        (n = Math.min(Ft, Math.max(1, n + f[0]))),
        (i = Math.min(Ft, Math.max(1, i + f[1]))),
        a(),
        o[(n - 1) * Ft + (i - 1)].focus());
    }),
    a(),
    x('div', { className: 'nova-grid-panel' }, l, s)
  );
}
const qd = 'data-nova-cell-bg';
function Uo(r) {
  r.querySelectorAll('td, th').forEach((e) => {
    const t = e.style.backgroundColor;
    t &&
      (e.setAttribute(qd, t),
      e.style.removeProperty('background-color'),
      e.getAttribute('style') || e.removeAttribute('style'));
  });
}
class Jd extends at {
  parse(e, t) {
    return (Uo(e), super.parse(e, t));
  }
  parseSlice(e, t) {
    return (Uo(e), super.parseSlice(e, t));
  }
}
const ea = new Jd(R, at.fromSchema(R).rules);
function ta(r, e, t) {
  const n = [],
    i = x('div', { className: 'nova-menu', role: 'menu', 'aria-label': t }),
    o = r.some((a) => a.type !== 'separator' && a.active !== void 0);
  for (const a of r) {
    if (a.type === 'separator') {
      i.append(x('div', { className: 'nova-menu-sep', role: 'separator' }));
      continue;
    }
    const c = x('span', { className: 'nova-menu-label' }, a.label);
    a.labelStyle && c.setAttribute('style', a.labelStyle);
    const u = x(
      'button',
      {
        type: 'button',
        className: 'nova-menu-item',
        role: a.active === void 0 ? 'menuitem' : a.checkbox ? 'menuitemcheckbox' : 'menuitemradio',
        tabindex: '-1',
        'data-id': a.id,
        disabled: a.disabled ?? !1,
        ...(a.active !== void 0 ? { 'aria-checked': String(a.active) } : {}),
      },
      o ? x('span', { className: 'nova-menu-check' }, a.active ? de(M.check) : null) : null,
      a.icon ? de(a.icon) : null,
      c,
      a.shortcut ? x('kbd', { className: 'nova-menu-shortcut' }, rr(a.shortcut)) : null,
    );
    (u.addEventListener('click', () => {
      (e(), a.onSelect());
    }),
      n.push(u),
      i.append(u));
  }
  const s = () => n.filter((a) => !a.disabled),
    l = (a) => {
      const c = s();
      c.length && c[(a + c.length) % c.length].focus();
    };
  return (
    i.addEventListener('keydown', (a) => {
      var f;
      const c = s(),
        u = c.indexOf(document.activeElement);
      switch (a.key) {
        case 'ArrowDown':
          (a.preventDefault(), l(u + 1));
          break;
        case 'ArrowUp':
          (a.preventDefault(), l(u - 1));
          break;
        case 'Home':
          (a.preventDefault(), l(0));
          break;
        case 'End':
          (a.preventDefault(), l(c.length - 1));
          break;
        case 'Tab':
          a.preventDefault();
          break;
        default:
          if (a.key.length === 1 && /\S/.test(a.key)) {
            const h = a.key.toLowerCase(),
              d = u + 1;
            (f = [...c.slice(d), ...c.slice(0, d)].find((m) => {
              var b;
              return (b = m.textContent) == null ? void 0 : b.trim().toLowerCase().startsWith(h);
            })) == null || f.focus();
          }
      }
    }),
    i
  );
}
function na(r) {
  const e =
    r.querySelector('[aria-checked="true"]:not(:disabled)') ??
    r.querySelector('.nova-menu-item:not(:disabled)');
  e == null || e.focus();
}
const _d = {
    file: { title: 'menu.file', items: 'preview | print' },
    edit: { title: 'menu.edit', items: 'undo redo | selectall | searchreplace pastetext' },
    view: { title: 'menu.view', items: 'code preview | fullscreen' },
    insert: { title: 'menu.insert', items: 'image link inserttable hr | insertdatetime' },
    format: {
      title: 'menu.format',
      items:
        'bold italic underline strikethrough superscript subscript inlinecode | paragraph h1 h2 h3 blockquote codeblock | alignleft aligncenter alignright alignjustify | removeformat',
    },
    table: {
      title: 'menu.table',
      items:
        'inserttable | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablemergecells tablesplitcells | tabledelete',
    },
    help: { title: 'menu.help', items: 'help' },
  },
  Kd = 'file edit view insert format table help';
function Ud(r, e, t, n) {
  const { t: i } = r.ui;
  ((e.className = 'nova-menubar'),
    e.setAttribute('role', 'menubar'),
    e.setAttribute('aria-label', i('menu.label')));
  const o = new AbortController(),
    { signal: s } = o,
    l = (d) => (d.title.startsWith('menu.') ? i(d.title) : d.title),
    a = (d) => {
      const p = [];
      for (const m of d.items.split(/\s+/)) {
        if (!m) continue;
        if (m === '|') {
          p.length && p[p.length - 1].type !== 'separator' && p.push({ type: 'separator' });
          continue;
        }
        if (!r.isAllowed(m)) continue;
        const b = r.ui.registry.getMenuItem(m);
        b &&
          p.push({
            id: m,
            label: b.text,
            ...(b.icon ? { icon: b.icon } : {}),
            ...(b.shortcut ? { shortcut: b.shortcut } : {}),
            ...(b.isActive ? { active: b.isActive(r), checkbox: !0 } : {}),
            disabled: !r.isEditable() || (b.isEnabled ? !b.isEnabled(r) : !1),
            onSelect: () => b.onAction(r),
          });
      }
      for (; p.length && p[p.length - 1].type === 'separator';) p.pop();
      return p;
    },
    c = [];
  let u = null;
  const f = () => {
      (u == null || u.popover.close(), (u = null));
    },
    h = (d, p) => {
      f();
      const m = c[d],
        b = n[m.dataset.menu],
        g = a(b);
      if (!g.length) return;
      const y = ta(g, () => r.ui.closePopover(), l(b));
      (y.addEventListener('keydown', (N) => {
        if (N.key !== 'ArrowLeft' && N.key !== 'ArrowRight') return;
        N.preventDefault();
        const z = (d + (N.key === 'ArrowRight' ? 1 : -1) + c.length) % c.length;
        h(z, !0);
      }),
        m.setAttribute('aria-expanded', 'true'));
      const w = r.ui.openPopover({
        anchor: m,
        content: y,
        ignore: [e],
        className: 'nova-popover-menu',
        onClose: (N) => {
          (m.setAttribute('aria-expanded', 'false'),
            (u == null ? void 0 : u.popover) === w && (u = null),
            N === 'escape' && m.focus());
        },
      });
      ((u = { index: d, popover: w }), p && na(y));
    };
  for (const d of t.split(/\s+/).filter(Boolean)) {
    const p = n[d];
    if (!p) continue;
    const m = x(
        'button',
        {
          type: 'button',
          className: 'nova-menubar-item',
          role: 'menuitem',
          'aria-haspopup': 'menu',
          'aria-expanded': 'false',
          'data-menu': d,
          tabindex: c.length === 0 ? '0' : '-1',
        },
        l(p),
      ),
      b = c.length;
    (m.addEventListener('click', (g) => {
      if ((u == null ? void 0 : u.index) === b) return f();
      h(b, g.detail === 0);
    }),
      m.addEventListener('mouseenter', () => {
        u && u.index !== b && h(b, !1);
      }),
      c.push(m),
      e.append(m));
  }
  return (
    e.addEventListener(
      'keydown',
      (d) => {
        const p = c.indexOf(document.activeElement);
        if (p < 0) return;
        const m = (b) => {
          d.preventDefault();
          const g = (b + c.length) % c.length;
          (c.forEach((y, w) => (y.tabIndex = w === g ? 0 : -1)), c[g].focus());
        };
        d.key === 'ArrowRight'
          ? m(p + 1)
          : d.key === 'ArrowLeft'
            ? m(p - 1)
            : d.key === 'Home'
              ? m(0)
              : d.key === 'End'
                ? m(c.length - 1)
                : d.key === 'ArrowDown'
                  ? (d.preventDefault(), h(p, !0))
                  : d.key === 'Escape' && (d.preventDefault(), r.focus());
      },
      { signal: s },
    ),
    e.addEventListener(
      'mousedown',
      (d) => {
        d.target.closest('button') && d.preventDefault();
      },
      { signal: s },
    ),
    {
      focus: () => {
        var d;
        return (d = c.find((p) => p.tabIndex === 0) ?? c[0]) == null ? void 0 : d.focus();
      },
      destroy: () => {
        (f(), o.abort(), e.replaceChildren());
      },
    }
  );
}
const jd = `
  body { font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #000; margin: 2cm; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
  pre { white-space: pre-wrap; background: #f5f5f5; padding: 8px; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #444; }
`;
function Gd(r) {
  const e = x('iframe', { title: 'print', 'aria-hidden': 'true', tabindex: '-1' });
  ((e.style.cssText =
    'position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden'),
    document.body.append(e));
  const t = e.contentDocument;
  if (!t) return e.remove();
  const n = t.createElement('style');
  ((n.textContent = jd),
    t.head.append(n),
    t.body.append(Xe.fromSchema(R).serializeFragment(r.view.state.doc.content, { document: t })));
  const i = e.contentWindow,
    o = () => setTimeout(() => e.remove(), 1e3);
  (i == null || i.addEventListener('afterprint', o),
    i == null || i.focus(),
    i == null || i.print(),
    o());
}
function Xd(r) {
  const { t: e } = r.ui,
    t = Be({ label: e('table.rows'), value: '3' }),
    n = Be({ label: e('table.cols'), value: '3' });
  for (const i of [t, n])
    ((i.input.type = 'number'),
      (i.input.min = '1'),
      (i.input.max = '50'),
      (i.input.inputMode = 'numeric'));
  r.ui.openDialog({
    title: e('table.insert'),
    body: x('div', { className: 'nova-form nova-form-row' }, t.el, n.el),
    submitLabel: e('dialog.insert'),
    initialFocus: t.input,
    onSubmit: () => {
      const i = Number(t.input.value),
        o = Number(n.input.value);
      return !Number.isInteger(i) || !Number.isInteger(o) || i < 1 || o < 1 || i > 50 || o > 50
        ? e('table.invalidSize')
        : (r.exec(an(i, o)), !0);
    },
  });
}
function Yd(r) {
  const { registry: e, t } = r.ui;
  (e.addToggleMenuItem('paragraph', {
    text: t('paragraph'),
    icon: M.paragraph,
    shortcut: 'Mod-Alt-0',
    isActive: (n) => n.view.state.selection.$from.parent.type.name === 'paragraph',
    onAction: (n) => n.exec('paragraph'),
  }),
    e.addMenuItem('selectall', {
      text: t('selectAll'),
      shortcut: 'Mod-a',
      onAction: (n) => {
        (n.view.dispatch(n.view.state.tr.setSelection(new he(n.view.state.doc))), n.focus());
      },
    }),
    e.addMenuItem('print', {
      text: t('print'),
      icon: M.print,
      shortcut: 'Mod-p',
      onAction: (n) => Gd(n),
    }),
    e.addMenuItem('inserttable', {
      text: t('table.insert'),
      icon: M.table,
      isEnabled: (n) => n.can(an(1, 1)),
      onAction: (n) => Xd(n),
    }));
}
const ra = {
    b: 'strong',
    i: 'em',
    strike: 's',
    del: 's',
    tbody: 'table',
    thead: 'table',
    tfoot: 'table',
    caption: 'table',
    colgroup: 'table',
    col: 'table',
  },
  Qd = [
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'hr',
    'ul',
    'ol',
    'li',
    'img',
    'br',
    'table',
    'tr',
    'td',
    'th',
    'strong',
    'em',
    'u',
    's',
    'code',
    'a',
    'sub',
    'sup',
    'span',
  ],
  Zd = {
    bold: ['strong'],
    italic: ['em'],
    underline: ['u'],
    strikethrough: ['s'],
    strike: ['s'],
    inlinecode: ['code'],
    code: ['code'],
    subscript: ['sub'],
    superscript: ['sup'],
    link: ['a'],
    unlink: ['a'],
    quicklink: ['a'],
    image: ['img'],
    quickimage: ['img'],
    table: ['table'],
    quicktable: ['table'],
    inserttable: ['table'],
    tableinsertrowbefore: ['table'],
    tableinsertrowafter: ['table'],
    tabledeleterow: ['table'],
    tableinsertcolbefore: ['table'],
    tableinsertcolafter: ['table'],
    tabledeletecol: ['table'],
    tablemergecells: ['table'],
    tablesplitcells: ['table'],
    tabledelete: ['table'],
    tablerowheader: ['th'],
    tablecolheader: ['th'],
    tablecellbackground: ['style:background-color'],
    bullist: ['ul'],
    bulletlist: ['ul'],
    numlist: ['ol'],
    orderedlist: ['ol'],
    blockquote: ['blockquote'],
    codeblock: ['pre'],
    hr: ['hr'],
    horizontalrule: ['hr'],
    h1: ['h1'],
    h2: ['h2'],
    h3: ['h3'],
    h4: ['h4'],
    h5: ['h5'],
    h6: ['h6'],
    forecolor: ['span', 'style:color'],
    backcolor: ['span', 'style:background-color'],
    fontfamily: ['span', 'style:font-family'],
    fontsize: ['span', 'style:font-size'],
    lineheight: ['style:line-height'],
    align: ['style:text-align'],
    alignleft: ['style:text-align'],
    aligncenter: ['style:text-align'],
    alignright: ['style:text-align'],
    alignjustify: ['style:text-align'],
    imagealignleft: ['style:float'],
    imagealigncenter: ['style:float'],
    imagealignright: ['style:float'],
  };
function jo(r) {
  if (r === void 0) return null;
  const e = new Set();
  for (const t of r.split(',')) {
    const n = t
      .trim()
      .replace(/^[-#+!]+/, '')
      .replace(/\[.*$/, '')
      .toLowerCase();
    for (const i of n.split('/')) {
      const o = i.trim();
      o && e.add(ra[o] ?? o);
    }
  }
  return e;
}
function ep(r) {
  if (r === void 0) return null;
  const e = typeof r == 'string' ? r : Object.values(r).join(',');
  return new Set(
    e
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
}
class tp {
  constructor(e) {
    O(this, 'tags');
    O(this, 'styles');
    const t = jo(e.validElements),
      n = jo(e.invalidElements) ?? new Set(),
      i = new Set(t ?? Qd);
    ((i.has('ul') || i.has('ol')) && i.add('li'), i.has('table') && (i.add('tr'), i.add('td')));
    for (const o of n) i.delete(o);
    (i.add('p'), (this.tags = i), (this.styles = ep(e.validStyles)));
  }
  isTagAllowed(e) {
    const t = e.toLowerCase();
    return this.tags.has(ra[t] ?? t);
  }
  isStyleAllowed(e) {
    return !this.styles || this.styles.has(e.toLowerCase());
  }
  isAllowed(e) {
    const t = Zd[e.toLowerCase()];
    return t
      ? t.every((n) =>
          n.startsWith('style:') ? this.isStyleAllowed(n.slice(6)) : this.isTagAllowed(n),
        )
      : !0;
  }
  markAllowed(e) {
    switch (e.type.name) {
      case 'bold':
        return this.isTagAllowed('strong');
      case 'italic':
        return this.isTagAllowed('em');
      case 'underline':
        return this.isTagAllowed('u');
      case 'strike':
        return this.isTagAllowed('s');
      case 'code':
        return this.isTagAllowed('code');
      case 'link':
        return this.isTagAllowed('a');
      case 'subscript':
        return this.isTagAllowed('sub');
      case 'superscript':
        return this.isTagAllowed('sup');
      case 'color':
        return this.isTagAllowed('span') && this.isStyleAllowed('color');
      case 'background':
        return this.isTagAllowed('span') && this.isStyleAllowed('background-color');
      case 'font_family':
        return this.isTagAllowed('span') && this.isStyleAllowed('font-family');
      case 'font_size':
        return this.isTagAllowed('span') && this.isStyleAllowed('font-size');
      default:
        return !0;
    }
  }
  blockAttrs(e) {
    return {
      ...e,
      ...(this.isStyleAllowed('text-align') ? {} : { align: null }),
      ...(this.isStyleAllowed('line-height') ? {} : { lineHeight: null }),
    };
  }
  normalize(e) {
    const { nodes: t } = R;
    if (e.isText) {
      const s = e.marks.filter((l) => this.markAllowed(l));
      return [s.length === e.marks.length ? e : e.mark(s)];
    }
    const n = e.marks.filter((s) => this.markAllowed(s));
    switch (e.type) {
      case t.image:
        return this.isTagAllowed('img')
          ? [
              t.image.create(
                { ...e.attrs, ...(this.isStyleAllowed('float') ? {} : { align: null }) },
                null,
                n,
              ),
            ]
          : [];
      case t.hard_break:
        return this.isTagAllowed('br') ? [e.mark(n)] : [R.text(' ', n)];
      case t.horizontal_rule:
        return this.isTagAllowed('hr') ? [e] : [];
    }
    const i = this.normalizeChildren(e.content),
      o = (s = e.type, l = e.attrs) => {
        try {
          return [s.createChecked(l, i, e.marks)];
        } catch {
          const a = s.createAndFill(l, i, e.marks);
          return a ? [a] : i.content.length ? jr(i) : [];
        }
      };
    switch (e.type) {
      case t.paragraph:
        return o(t.paragraph, this.blockAttrs(e.attrs));
      case t.heading:
        return this.isTagAllowed(`h${e.attrs.level}`)
          ? o(t.heading, this.blockAttrs(e.attrs))
          : o(
              t.paragraph,
              this.blockAttrs({ align: e.attrs.align, lineHeight: e.attrs.lineHeight }),
            );
      case t.blockquote:
        return this.isTagAllowed('blockquote') ? o() : jr(i);
      case t.code_block:
        return this.isTagAllowed('pre')
          ? o()
          : e.textContent
              .split(
                `
`,
              )
              .map((s) => t.paragraph.create(null, s ? R.text(s) : null));
      case t.bullet_list:
        return this.isTagAllowed('ul') ? o() : Go(i);
      case t.ordered_list:
        return this.isTagAllowed('ol') ? o() : Go(i);
      case t.table:
        return this.isTagAllowed('table') ? o() : np(i);
      case t.table_header:
        return this.isTagAllowed('th') ? o() : o(t.table_cell, e.attrs);
      case t.table_cell:
        return o(t.table_cell, {
          ...e.attrs,
          ...(this.isStyleAllowed('background-color') ? {} : { background: null }),
        });
      default:
        return o();
    }
  }
  normalizeChildren(e) {
    const t = [];
    return (e.forEach((n) => t.push(...this.normalize(n))), k.from(t));
  }
  normalizeDoc(e) {
    const t = this.normalizeChildren(e.content);
    return e.type.createAndFill(null, t.size ? t : R.nodes.paragraph.create());
  }
}
function jr(r) {
  const e = [];
  let t = [];
  const n = () => {
    (t.length && e.push(R.nodes.paragraph.create(null, t)), (t = []));
  };
  return (
    r.forEach((i) => {
      i.isInline ? t.push(i) : (n(), e.push(i));
    }),
    n(),
    e
  );
}
function Go(r) {
  const e = [];
  return (
    r.forEach((t) => {
      t.type === R.nodes.list_item ? t.content.forEach((n) => e.push(n)) : e.push(...jr(k.from(t)));
    }),
    e
  );
}
function np(r) {
  const e = [];
  return (r.forEach((t) => t.forEach((n) => n.forEach((i) => e.push(i)))), e);
}
const rp = new ye('nova-content-rules');
function ip(r) {
  return new pe({
    key: rp,
    appendTransaction(e, t, n) {
      var c;
      if (!e.some((u) => u.docChanged)) return null;
      const i = t.doc.content.findDiffStart(n.doc.content);
      if (i === null) return null;
      const o =
          ((c = t.doc.content.findDiffEnd(n.doc.content)) == null ? void 0 : c.b) ??
          n.doc.content.size,
        s = n.doc,
        l = [];
      if (
        (s.forEach((u, f) => {
          const h = f,
            d = f + u.nodeSize;
          if (d < i || h > Math.max(i, o)) return;
          const p = r.normalize(u);
          (p.length === 1 && p[0].eq(u)) || l.push({ from: h, to: d, nodes: p });
        }),
        !l.length)
      )
        return null;
      const a = n.tr;
      for (const { from: u, to: f, nodes: h } of l.reverse())
        h.length
          ? a.replaceWith(u, f, h)
          : a.doc.childCount > 1
            ? a.delete(u, f)
            : a.replaceWith(u, f, R.nodes.paragraph.create());
      return a.setMeta(
        'addToHistory',
        e.every((u) => u.getMeta('addToHistory') !== !1),
      );
    },
  });
}
const jn = 1e4,
  op = '￼',
  st = new ye('nova-search'),
  Gr = { query: '', caseSensitive: !1, wholeWord: !1, matches: [], current: -1 };
function sp({ query: r, caseSensitive: e, wholeWord: t }) {
  if (!r) return null;
  const n = r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    i = t ? `(?<![\\p{L}\\p{N}_])${n}(?![\\p{L}\\p{N}_])` : n;
  return new RegExp(i, e ? 'gu' : 'giu');
}
function Xo(r, e) {
  const t = sp(e);
  if (!t) return [];
  const n = [];
  return (
    r.descendants((i, o) => {
      if (n.length >= jn) return !1;
      if (!i.isTextblock) return !0;
      const s = i.textBetween(0, i.content.size, void 0, op);
      t.lastIndex = 0;
      let l;
      for (; (l = t.exec(s)) && n.length < jn;) {
        if (l[0].length === 0) {
          t.lastIndex += 1;
          continue;
        }
        n.push({ from: o + 1 + l.index, to: o + 1 + l.index + l[0].length });
      }
      return !1;
    }),
    n
  );
}
function Yo(r, e) {
  if (!r.length) return -1;
  const t = r.findIndex((n) => n.from >= e);
  return t < 0 ? 0 : t;
}
function lp() {
  return new pe({
    key: st,
    state: {
      init: () => Gr,
      apply(r, e, t, n) {
        var o;
        const i = r.getMeta(st);
        if ((i == null ? void 0 : i.type) === 'clear') return Gr;
        if ((i == null ? void 0 : i.type) === 'set') {
          const s = Xo(n.doc, i.options);
          return { ...i.options, matches: s, current: Yo(s, n.selection.from) };
        }
        if ((i == null ? void 0 : i.type) === 'goto') return { ...e, current: i.index };
        if (r.docChanged && e.query) {
          const s = Xo(n.doc, e),
            l = (o = e.matches[e.current]) == null ? void 0 : o.from,
            a = l === void 0 ? -1 : Yo(s, r.mapping.map(l));
          return { ...e, matches: s, current: a };
        }
        return e;
      },
    },
    props: {
      decorations(r) {
        const e = st.getState(r);
        return e != null && e.matches.length
          ? H.create(
              r.doc,
              e.matches.map((t, n) =>
                ie.inline(t.from, t.to, {
                  class:
                    n === e.current ? 'nova-search-match nova-search-current' : 'nova-search-match',
                }),
              ),
            )
          : null;
      },
    },
  });
}
function cn(r) {
  return st.getState(r) ?? Gr;
}
function ap(r) {
  return (e, t) => (t == null || t(e.tr.setMeta(st, { type: 'set', options: r })), !0);
}
const cp = (r, e) => (e == null || e(r.tr.setMeta(st, { type: 'clear' })), !0);
function up(r, e, t) {
  return r
    .setMeta(st, { type: 'goto', index: t })
    .setSelection(L.create(r.doc, e.from, e.to))
    .scrollIntoView();
}
function Sn(r = 1) {
  return (e, t) => {
    const { matches: n, current: i } = cn(e);
    if (!n.length) return !1;
    const s =
      (i >= 0 && e.selection.from === n[i].from && e.selection.to === n[i].to) || i < 0
        ? (Math.max(i, 0) + r + n.length) % n.length
        : i;
    return (t && t(up(e.tr, n[s], s)), !0);
  };
}
function fp(r) {
  return (e, t) => {
    const { matches: n, current: i } = cn(e),
      o = n[i];
    if (!o) return !1;
    if (t) {
      const s = e.tr,
        l = e.doc.resolve(o.from).marksAcross(e.doc.resolve(o.to)) ?? [];
      r ? s.replaceWith(o.from, o.to, e.schema.text(r, l)) : s.delete(o.from, o.to);
      const a = s.mapping.map(o.to);
      t(s.setSelection(L.create(s.doc, a)).scrollIntoView());
    }
    return !0;
  };
}
function hp(r) {
  return (e, t) => {
    const { matches: n } = cn(e);
    if (!n.length) return !1;
    if (t) {
      const i = e.tr;
      for (let o = n.length - 1; o >= 0; o--) {
        const { from: s, to: l } = n[o],
          a = e.doc.resolve(s).marksAcross(e.doc.resolve(l)) ?? [];
        r ? i.replaceWith(s, l, e.schema.text(r, a)) : i.delete(s, l);
      }
      t(i.scrollIntoView());
    }
    return !0;
  };
}
function dp(r, e) {
  const { t } = r.ui,
    n = Lt('nova-find'),
    i = Lt('nova-replace'),
    o = x('input', {
      id: n,
      type: 'search',
      className: 'nova-input',
      placeholder: t('search.find'),
      'aria-label': t('search.find'),
      autocomplete: 'off',
      spellcheck: 'false',
    }),
    s = x('input', {
      id: i,
      type: 'text',
      className: 'nova-input',
      placeholder: t('search.replace'),
      'aria-label': t('search.replace'),
      autocomplete: 'off',
      spellcheck: 'false',
    }),
    l = x('span', { className: 'nova-search-count', 'aria-live': 'polite' }),
    a = (C, v) => {
      const D = x(
        'button',
        {
          type: 'button',
          className: 'nova-btn nova-search-toggle',
          'aria-pressed': 'false',
          'aria-label': C,
          'data-tooltip': C,
        },
        v,
      );
      return (
        r.ui.tooltip.attach(D),
        D.addEventListener('click', () => {
          (D.setAttribute('aria-pressed', String(D.getAttribute('aria-pressed') !== 'true')),
            w(),
            o.focus());
        }),
        D
      );
    },
    c = a(t('search.matchCase'), 'Aa'),
    u = a(t('search.wholeWord'), 'ab|'),
    f = (C, v, D) => {
      const B = x(
        'button',
        { type: 'button', className: 'nova-btn', 'aria-label': v, 'data-tooltip': v },
        de(C),
      );
      return (r.ui.tooltip.attach(B), B.addEventListener('click', D), B);
    },
    h = f(M.chevronUp, t('search.prev'), () => {
      (r.exec(Sn(-1)), o.focus());
    }),
    d = f(M.chevronDown, t('search.next'), () => {
      (r.exec(Sn(1)), o.focus());
    }),
    p = f(M.close, t('dialog.close'), () => F.close()),
    m = x('button', { type: 'button', className: 'nova-button' }, t('search.replaceOne')),
    b = x('button', { type: 'button', className: 'nova-button' }, t('search.replaceAll'));
  (m.addEventListener('click', () => {
    (N(), r.exec(fp(s.value)), r.exec(Sn(1)), s.focus());
  }),
    b.addEventListener('click', () => {
      (N(), r.exec(hp(s.value)), s.focus());
    }));
  const g = x(
    'div',
    { className: 'nova-search', role: 'search', 'aria-label': t('search.title'), hidden: !0 },
    x('div', { className: 'nova-search-row' }, o, l, c, u, h, d, p),
    x('div', { className: 'nova-search-row' }, s, m, b),
  );
  e.parentElement.insertBefore(g, e);
  let y = null;
  const w = () => {
      (y && clearTimeout(y),
        (y = null),
        ap({
          query: o.value,
          caseSensitive: c.getAttribute('aria-pressed') === 'true',
          wholeWord: u.getAttribute('aria-pressed') === 'true',
        })(r.view.state, r.view.dispatch));
    },
    N = () => {
      (y || cn(r.view.state).query !== o.value) && w();
    };
  (o.addEventListener('input', () => {
    (y && clearTimeout(y), (y = setTimeout(w, 120)));
  }),
    o.addEventListener('keydown', (C) => {
      C.key === 'Enter' && (C.preventDefault(), N(), r.exec(Sn(C.shiftKey ? -1 : 1)), o.focus());
    }),
    s.addEventListener('keydown', (C) => {
      C.key === 'Enter' && (C.preventDefault(), m.click(), s.focus());
    }),
    g.addEventListener('keydown', (C) => {
      C.key === 'Escape' && (C.preventDefault(), C.stopPropagation(), F.close());
    }),
    g.addEventListener('mousedown', (C) => {
      C.target.closest('button') && C.preventDefault();
    }));
  const z = () => {
      if (g.hidden) return;
      const { matches: C, current: v, query: D } = cn(r.view.state),
        B = C.length;
      (D
        ? B
          ? (l.textContent = t('search.count', { current: v + 1, total: B >= jn ? `${jn}+` : B }))
          : (l.textContent = t('search.none'))
        : (l.textContent = ''),
        g.classList.toggle('is-empty', !!D && !B));
      for (const Ce of [h, d, m, b]) Ce.disabled = !B;
      ((m.disabled = !B || !r.isEditable()), (b.disabled = !B || !r.isEditable()));
    },
    F = {
      open() {
        const C = g.hidden;
        g.hidden = !1;
        const { from: v, to: D, empty: B } = r.view.state.selection,
          Ce = B ? '' : r.view.state.doc.textBetween(v, D, ' ');
        (Ce &&
          !Ce.includes(`
`) &&
          Ce.length <= 100 &&
          (o.value = Ce),
          (C || Ce) && w(),
          o.focus(),
          o.select(),
          z());
      },
      close() {
        g.hidden ||
          ((g.hidden = !0), y && clearTimeout(y), cp(r.view.state, r.view.dispatch), r.focus());
      },
      isOpen: () => !g.hidden,
      update: z,
      destroy() {
        (y && clearTimeout(y), g.remove());
      },
    };
  return F;
}
function ia(r) {
  return r.root.classList.contains('nova-fullscreen');
}
function Xr(r, e = !ia(r)) {
  (r.root.classList.toggle('nova-fullscreen', e),
    document.documentElement.classList.toggle('nova-fullscreen-lock', e),
    r.ui.closePopover(),
    r.focus());
}
function pp(r) {
  const { t: e } = r.ui,
    t = x('div', { className: 'nova-prosemirror nova-preview' });
  (t.append(Xe.fromSchema(R).serializeFragment(r.view.state.doc.content)),
    t.querySelectorAll('a[href]').forEach((n) => {
      (n.setAttribute('target', '_blank'), n.setAttribute('rel', 'noopener noreferrer'));
    }),
    r.ui.openDialog({
      title: e('preview'),
      body: t,
      size: 'large',
      cancelLabel: e('dialog.close'),
    }));
}
function mp(r) {
  return r
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
function gp(r) {
  const { t: e } = r.ui,
    t = mp(r.getHTML()),
    n = x('textarea', {
      className: 'nova-input nova-source',
      spellcheck: 'false',
      'aria-label': e('sourceCode'),
      autocomplete: 'off',
      rows: '18',
    });
  ((n.value = t),
    r.ui.openDialog({
      title: e('sourceCode'),
      body: n,
      size: 'large',
      submitLabel: e('dialog.save'),
      initialFocus: n,
      onSubmit: () => (n.value !== t && r.setContent(n.value), !0),
    }));
}
const bp = [
  {
    group: 'help.formatting',
    rows: [
      { label: 'bold', keys: 'Mod-b' },
      { label: 'italic', keys: 'Mod-i' },
      { label: 'underline', keys: 'Mod-u' },
      { label: 'strike', keys: 'Mod-Shift-x' },
      { label: 'code', keys: 'Mod-e' },
      { label: 'superscript', keys: 'Mod-.' },
      { label: 'subscript', keys: 'Mod-,' },
      { label: 'link', keys: 'Mod-k' },
      { label: 'clearFormatting', keys: 'Mod-\\' },
    ],
  },
  {
    group: 'help.blocks',
    rows: [
      { label: 'paragraph', keys: 'Mod-Alt-0' },
      { label: 'h1', keys: 'Mod-Alt-1' },
      { label: 'h2', keys: 'Mod-Alt-2' },
      { label: 'h3', keys: 'Mod-Alt-3' },
      { label: 'bulletList', keys: 'Mod-Shift-8' },
      { label: 'orderedList', keys: 'Mod-Shift-7' },
      { label: 'alignCenter', keys: 'Mod-Shift-e' },
    ],
  },
  {
    group: 'help.editing',
    rows: [
      { label: 'undo', keys: 'Mod-z' },
      { label: 'redo', keys: 'Mod-Shift-z' },
      { label: 'search.title', keys: 'Mod-f' },
      { label: 'pasteAsText', keys: 'Mod-Shift-v' },
      { label: 'fullscreen', keys: 'Mod-Shift-f' },
      { label: 'help.slash', keys: '/' },
    ],
  },
  {
    group: 'help.navigation',
    rows: [
      { label: 'help.toMenubar', keys: 'Alt-F9' },
      { label: 'help.toToolbar', keys: 'Alt-F10' },
      { label: 'help.toContextToolbar', keys: 'Ctrl-F9' },
      { label: 'help.toEditor', keys: 'Escape' },
      { label: 'help.nextCell', keys: 'Tab' },
      { label: 'help', keys: 'Alt-0' },
    ],
  },
];
function oa(r) {
  const { t: e } = r.ui,
    t = x('div', { className: 'nova-help' });
  for (const { group: n, rows: i } of bp)
    t.append(
      x(
        'section',
        {},
        x('h3', {}, e(n)),
        x(
          'table',
          { className: 'nova-help-table' },
          x(
            'tbody',
            {},
            i.map(({ label: o, keys: s }) =>
              x('tr', {}, x('td', {}, e(o)), x('td', {}, x('kbd', {}, s.length === 1 ? s : rr(s)))),
            ),
          ),
        ),
      ),
    );
  r.ui.openDialog({ title: e('help'), body: t, size: 'large', cancelLabel: e('dialog.close') });
}
const yp = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'source',
    'track',
    'wbr',
  ]),
  sa = new RegExp(' ', 'g');
function la(r) {
  return r.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(sa, '&nbsp;');
}
function wp(r) {
  return r
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(sa, '&nbsp;');
}
const kp = /^[a-z][a-z0-9-]*$/i,
  xp = /^[a-z_:][a-z0-9_.:-]*$/i;
function Yr(r) {
  if (typeof r == 'string') return { open: '', close: '', hole: !1, html: la(r) };
  if (!Array.isArray(r))
    throw new Error('[nova] serializer supports only array/string toDOM specs');
  const [e, ...t] = r,
    n = e.includes(' ') ? e.split(' ')[1] : e;
  if (!kp.test(n)) throw new Error(`[nova] invalid tag in toDOM: ${n}`);
  let i = '',
    o = t;
  const s = t[0];
  if (s && typeof s == 'object' && !Array.isArray(s)) {
    for (const [h, d] of Object.entries(s)) {
      if (d == null) continue;
      const p = h.includes(' ') ? h.split(' ')[1] : h;
      xp.test(p) && (i += ` ${p}="${wp(String(d))}"`);
    }
    o = t.slice(1);
  }
  const l = `<${n}${i}>`;
  if (yp.has(n.toLowerCase())) return { open: l, close: '', hole: !1, html: l };
  let a = '',
    c = '',
    u = !1;
  for (const h of o) {
    if (h === 0) {
      if (u) throw new Error('[nova] toDOM spec has more than one content hole');
      u = !0;
      continue;
    }
    const d = Yr(h);
    if (u) {
      if (d.hole) throw new Error('[nova] toDOM spec has more than one content hole');
      c += d.html;
    } else d.hole ? ((a += d.open), (c += d.close), (u = !0)) : (a += d.html);
  }
  const f = `</${n}>`;
  return { open: l + a, close: c + f, hole: u, html: l + a + c + f };
}
class Mp {
  constructor() {
    O(this, 'cache', new Map());
  }
  serializeFragment(e) {
    let t = '',
      n = [],
      i = [];
    const o = (s) => {
      for (; n.length > s;) ((t += i.pop()), n.pop());
    };
    return (
      e.forEach((s) => {
        if (!s.isInline) {
          (o(0), (t += this.serializeNode(s)));
          return;
        }
        let l = 0;
        for (; l < n.length && l < s.marks.length && n[l].eq(s.marks[l]);) l++;
        o(l);
        for (let a = l; a < s.marks.length; a++) {
          const c = s.marks[a],
            u = this.renderMark(c, s.isText);
          ((t += u.open), i.push(u.close), n.push(c));
        }
        t += s.isText ? la(s.text ?? '') : this.serializeNode(s);
      }),
      o(0),
      (n = []),
      (i = []),
      t
    );
  }
  serializeNode(e) {
    const t = e.type.spec.toDOM;
    if (!t) throw new Error(`[nova] node "${e.type.name}" has no toDOM`);
    const n = Yr(t(e));
    return n.hole ? n.open + this.serializeFragment(e.content) + n.close : n.html;
  }
  renderMark(e, t) {
    const n = e.type.spec.toDOM;
    if (!n) throw new Error(`[nova] mark "${e.type.name}" has no toDOM`);
    const i = `${e.type.name}:${JSON.stringify(e.attrs)}`;
    let o = this.cache.get(i);
    return (
      o || ((o = Yr(n(e, t))), this.cache.size > 500 && this.cache.clear(), this.cache.set(i, o)),
      o
    );
  }
}
const Cp = { color: U.color, background: U.color, font_family: U.fontFamily, font_size: U.length };
function $t(r, e) {
  return (t, n) => {
    const i = R.marks[r],
      o = e === null ? null : Cp[r](e);
    if (e !== null && !o) return !1;
    const { empty: s } = t.selection;
    if (!n) return !0;
    const l = t.tr;
    if (s) (l.removeStoredMark(i), o && l.addStoredMark(i.create({ value: o })));
    else
      for (const a of t.selection.ranges)
        (l.removeMark(a.$from.pos, a.$to.pos, i),
          o && l.addMark(a.$from.pos, a.$to.pos, i.create({ value: o })));
    return (n(l.scrollIntoView()), !0);
  };
}
function gt(r, e) {
  var l;
  const t = R.marks[e],
    { $from: n, empty: i } = r.selection,
    o = i
      ? (r.storedMarks ?? n.marks())
      : (((l = n.nodeAfter) == null ? void 0 : l.marks) ?? n.marks()),
    s = t.isInSet(o);
  return s ? s.attrs.value : null;
}
function Mr(r) {
  return (e, t) => {
    const n = r === null ? null : U.lineHeight(r);
    if (r !== null && !n) return !1;
    const { from: i, to: o } = e.selection,
      s = e.tr;
    let l = !1;
    return (
      e.doc.nodesBetween(i, o, (a, c) => {
        (a.type === R.nodes.paragraph || a.type === R.nodes.heading) &&
          ((l = !0), s.setNodeMarkup(c, void 0, { ...a.attrs, lineHeight: n }));
      }),
      l ? (t == null || t(s), !0) : !1
    );
  };
}
function Sp(r) {
  return r.selection.$from.parent.attrs.lineHeight ?? null;
}
const aa = [
  '#000000',
  '#434343',
  '#666666',
  '#999999',
  '#b7b7b7',
  '#d9d9d9',
  '#efefef',
  '#ffffff',
  '#b91c1c',
  '#c2410c',
  '#a16207',
  '#15803d',
  '#0e7490',
  '#1d4ed8',
  '#6d28d9',
  '#be185d',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#fecaca',
  '#fed7aa',
  '#fef08a',
  '#bbf7d0',
  '#a5f3fc',
  '#bfdbfe',
  '#ddd6fe',
  '#fbcfe8',
];
function ca(r) {
  var l, a;
  const t = [],
    n = ((l = r.current) == null ? void 0 : l.toLowerCase()) ?? null,
    i = x('div', { className: 'nova-swatches', role: 'grid', 'aria-label': r.label });
  for (const c of r.colors) {
    const u = n === c.toLowerCase(),
      f = x(
        'button',
        {
          type: 'button',
          className: 'nova-swatch',
          role: 'gridcell',
          'aria-label': c,
          'aria-selected': String(u),
          title: c,
          tabindex: '-1',
        },
        u ? de(M.check) : null,
      );
    (f.style.setProperty('--swatch', c),
      f.addEventListener('click', () => r.onPick(c)),
      t.push(f),
      i.append(f));
  }
  ((a = t.find((c) => c.getAttribute('aria-selected') === 'true') ?? t[0]) == null ||
    a.setAttribute('tabindex', '0'),
    i.addEventListener('keydown', (c) => {
      const u = t.indexOf(document.activeElement);
      if (u < 0) return;
      const h = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 }[c.key];
      if (h === void 0) return;
      c.preventDefault();
      const d = t[Math.min(t.length - 1, Math.max(0, u + h))];
      ((t[u].tabIndex = -1), (d.tabIndex = 0), d.focus());
    }));
  const o = x(
    'button',
    { type: 'button', className: 'nova-panel-action' },
    de(M.clearFormatting),
    r.removeLabel,
  );
  o.addEventListener('click', () => r.onPick(null));
  const s = x('input', {
    type: 'color',
    className: 'nova-color-input',
    'aria-label': r.customLabel,
    value: /^#[0-9a-f]{6}$/i.test(n ?? '') ? n : '#000000',
  });
  return (
    s.addEventListener('change', () => r.onPick(s.value)),
    x(
      'div',
      { className: 'nova-color-panel' },
      i,
      x(
        'div',
        { className: 'nova-panel-footer' },
        o,
        x('label', { className: 'nova-panel-action' }, s, r.customLabel),
      ),
    )
  );
}
function vp(r) {
  const { registry: e, t } = r.ui,
    n = (o, s) => t('table.size', { rows: o, cols: s });
  e.addPanelButton('table', {
    icon: M.table,
    tooltip: t('table.insert'),
    isEnabled: (o) => o.can(an(1, 1)),
    render: (o, s) =>
      Wd(
        (l, a) => {
          (s(), o.exec(an(l, a)));
        },
        n,
        t('table.insert'),
      ),
  });
  const i = (o, s, l, a, c) =>
    e.addButton(o, {
      icon: l,
      tooltip: t(s),
      onAction: (u) => u.exec(a),
      isEnabled: (u) => u.can(a),
      ...(c ? { isActive: c } : {}),
    });
  (i('tableinsertrowbefore', 'table.rowBefore', M.rowBefore, we.addRowBefore),
    i('tableinsertrowafter', 'table.rowAfter', M.rowAfter, we.addRowAfter),
    i('tabledeleterow', 'table.rowDelete', M.rowDelete, we.deleteRow),
    i('tableinsertcolbefore', 'table.colBefore', M.colBefore, we.addColumnBefore),
    i('tableinsertcolafter', 'table.colAfter', M.colAfter, we.addColumnAfter),
    i('tabledeletecol', 'table.colDelete', M.colDelete, we.deleteColumn),
    i('tablemergecells', 'table.merge', M.merge, we.mergeCells),
    i('tablesplitcells', 'table.split', M.split, we.splitCell),
    i('tablerowheader', 'table.rowHeader', M.rowHeader, we.toggleHeaderRow, (o) =>
      $d(o.view.state),
    ),
    i('tablecolheader', 'table.colHeader', M.colHeader, we.toggleHeaderColumn, (o) =>
      Vd(o.view.state),
    ),
    i('tabledelete', 'table.delete', M.tableDelete, we.deleteTable),
    e.addPanelButton('tablecellbackground', {
      icon: M.highlight,
      tooltip: t('table.cellBackground'),
      isEnabled: (o) => X(o.view.state),
      render: (o, s) =>
        ca({
          colors: o.options.colors ?? aa,
          current: null,
          label: t('table.cellBackground'),
          removeLabel: t('removeColor'),
          customLabel: t('customColor'),
          onPick: (l) => {
            (s(), o.exec(Fd(l)));
          },
        }),
    }),
    e.addContextToolbar('table', {
      label: t('table.toolbar'),
      predicate: (o) => X(o.view.state),
      anchor: (o) => Hd(o),
      placement: 'bottom-start',
      items:
        'tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablemergecells tablesplitcells | tablerowheader tablecolheader tablecellbackground | tabledelete',
    }));
}
const Ap = [
    { label: 'Sans Serif', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
    { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
    { label: 'Monospace', value: 'ui-monospace, Menlo, Consolas, monospace' },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  ],
  Np = ['8pt', '10pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt', '48pt'],
  Ep = ['1', '1.15', '1.5', '2', '2.5', '3'],
  ke = {
    undo: 'Mod-z',
    redo: 'Mod-Shift-z',
    bold: 'Mod-b',
    italic: 'Mod-i',
    underline: 'Mod-u',
    strike: 'Mod-Shift-x',
    code: 'Mod-e',
    subscript: 'Mod-,',
    superscript: 'Mod-.',
    bulletList: 'Mod-Shift-8',
    orderedList: 'Mod-Shift-7',
    alignLeft: 'Mod-Shift-l',
    alignCenter: 'Mod-Shift-e',
    alignRight: 'Mod-Shift-r',
    alignJustify: 'Mod-Shift-j',
    clearFormatting: 'Mod-\\',
    paragraph: 'Mod-Alt-0',
    h1: 'Mod-Alt-1',
    h2: 'Mod-Alt-2',
    h3: 'Mod-Alt-3',
    h4: 'Mod-Alt-4',
    h5: 'Mod-Alt-5',
    h6: 'Mod-Alt-6',
  };
function Qo(r) {
  try {
    const { node: e } = r.view.domAtPos(r.view.state.selection.from),
      t = e.nodeType === Node.TEXT_NODE ? e.parentElement : e;
    return t ? getComputedStyle(t) : null;
  } catch {
    return null;
  }
}
const Tp = {
  'system-ui': 'Sans Serif',
  '-apple-system': 'Sans Serif',
  'sans-serif': 'Sans Serif',
  serif: 'Serif',
  monospace: 'Monospace',
  'ui-monospace': 'Monospace',
};
function Zo(r) {
  const e = r.split(',')[0].trim().replace(/["']/g, '');
  return Tp[e.toLowerCase()] ?? e;
}
function Op(r) {
  const e = parseFloat(r);
  return !Number.isFinite(e) || e <= 0 ? null : `${Math.round(e * 0.75 * 2) / 2}pt`;
}
const es = (r, e) =>
  r !== null && r.replace(/["'\s]/g, '').toLowerCase() === e.replace(/["'\s]/g, '').toLowerCase();
function Dp(r) {
  const { registry: e, t } = r.ui,
    n = () => r.view.state,
    i = (g, y, w, N) =>
      e.addButton(g, {
        icon: w,
        tooltip: t(y),
        ...(ke[y] ? { shortcut: ke[y] } : {}),
        onAction: (z) => z.exec(y),
        isEnabled: (z) => z.can(y),
        ...(N ? { isActive: N } : {}),
      }),
    o = (g, y, w, N) => i(g, y, N, () => Rn(n(), R.marks[w]));
  (i('undo', 'undo', M.undo),
    i('redo', 'redo', M.redo),
    o('bold', 'bold', 'bold', M.bold),
    o('italic', 'italic', 'italic', M.italic),
    o('underline', 'underline', 'underline', M.underline),
    o('strikethrough', 'strike', 'strike', M.strike),
    o('inlinecode', 'code', 'code', M.code),
    o('subscript', 'subscript', 'subscript', M.subscript),
    o('superscript', 'superscript', 'superscript', M.superscript),
    i('bullist', 'bulletList', M.bulletList, () => ze(n(), R.nodes.bullet_list)),
    i('numlist', 'orderedList', M.orderedList, () => ze(n(), R.nodes.ordered_list)),
    i('indent', 'indent', M.indent),
    i('outdent', 'outdent', M.outdent),
    i('blockquote', 'blockquote', M.blockquote, () => ze(n(), R.nodes.blockquote)),
    i('codeblock', 'codeBlock', M.codeBlock, () => ze(n(), R.nodes.code_block)),
    i('hr', 'horizontalRule', M.horizontalRule),
    i('removeformat', 'clearFormatting', M.clearFormatting));
  const s = [
    ['alignLeft', 'left', M.alignLeft],
    ['alignCenter', 'center', M.alignCenter],
    ['alignRight', 'right', M.alignRight],
    ['alignJustify', 'justify', M.alignJustify],
  ];
  for (const [g, y, w] of s) i(g.toLowerCase(), g, w, () => xt(n()) === y);
  e.addMenuButton('align', {
    icon: M.alignLeft,
    tooltip: t('align'),
    isEnabled: (g) => g.can('alignLeft'),
    items: (g) =>
      s.map(([y, w, N]) => ({
        id: y,
        label: t(y),
        icon: N,
        ...(ke[y] ? { shortcut: ke[y] } : {}),
        active: xt(g.view.state) === w,
        onSelect: () => g.exec(y),
      })),
  });
  const l = [
      { command: 'paragraph', style: '' },
      { command: 'h1', style: 'font-size: 1.6em; font-weight: 700' },
      { command: 'h2', style: 'font-size: 1.35em; font-weight: 700' },
      { command: 'h3', style: 'font-size: 1.15em; font-weight: 700' },
      { command: 'h4', style: 'font-size: 1em; font-weight: 700' },
      { command: 'h5', style: 'font-size: 0.9em; font-weight: 700' },
      { command: 'h6', style: 'font-size: 0.85em; font-weight: 700' },
      { command: 'codeBlock', style: 'font-family: ui-monospace, monospace' },
    ],
    a = () => {
      const g = n().selection.$from.parent;
      return g.type === R.nodes.heading
        ? `h${g.attrs.level}`
        : g.type === R.nodes.code_block
          ? 'codeBlock'
          : 'paragraph';
    };
  for (let g = 1; g <= 6; g++) {
    const y = `h${g}`;
    e.addToggleButton(y, {
      ...(g <= 3 ? { icon: M[`h${g}`] } : { text: `H${g}` }),
      tooltip: t(y),
      ...(ke[y] ? { shortcut: ke[y] } : {}),
      isActive: () => a() === y,
      isEnabled: (w) => w.can(y) || a() === y,
      onAction: (w) => w.exec(a() === y ? 'paragraph' : y),
    });
  }
  e.addMenuButton('blocks', {
    tooltip: t('blocks'),
    label: () => t(a()),
    minChars: 11,
    isEnabled: (g) => l.some(({ command: y }) => g.can(y)),
    items: (g) =>
      l
        .filter(({ command: y }) => g.isAllowed(y))
        .map(({ command: y, style: w }) => ({
          id: y,
          label: t(y),
          labelStyle: w,
          ...(ke[y] ? { shortcut: ke[y] } : {}),
          active: a() === y,
          onSelect: () => g.exec(y),
        })),
  });
  const c = r.options.fontFamilies ?? Ap;
  e.addMenuButton('fontfamily', {
    tooltip: t('fontFamily'),
    minChars: 9,
    label: (g) => {
      var N, z;
      const y = gt(n(), 'font_family');
      if (y) return ((N = c.find((F) => es(y, F.value))) == null ? void 0 : N.label) ?? Zo(y);
      const w = (z = Qo(g)) == null ? void 0 : z.fontFamily;
      return w ? Zo(w) : t('fontFamily');
    },
    items: (g) => {
      const y = gt(g.view.state, 'font_family');
      return [
        {
          id: 'default',
          label: t('default'),
          active: y === null,
          onSelect: () => g.exec($t('font_family', null)),
        },
        { type: 'separator' },
        ...c.map((w) => ({
          id: w.label,
          label: w.label,
          labelStyle: `font-family: ${w.value}`,
          active: es(y, w.value),
          onSelect: () => g.exec($t('font_family', w.value)),
        })),
      ];
    },
  });
  const u = r.options.fontSizes ?? Np;
  e.addMenuButton('fontsize', {
    tooltip: t('fontSize'),
    minChars: 4,
    label: (g) => {
      var y;
      return gt(n(), 'font_size') ?? Op(((y = Qo(g)) == null ? void 0 : y.fontSize) ?? '') ?? '—';
    },
    items: (g) => {
      const y = gt(g.view.state, 'font_size');
      return [
        {
          id: 'default',
          label: t('default'),
          active: y === null,
          onSelect: () => g.exec($t('font_size', null)),
        },
        { type: 'separator' },
        ...u.map((w) => ({
          id: w,
          label: w,
          active: y === w,
          onSelect: () => g.exec($t('font_size', w)),
        })),
      ];
    },
  });
  const f = r.options.lineHeights ?? Ep;
  e.addMenuButton('lineheight', {
    icon: M.lineHeight,
    tooltip: t('lineHeight'),
    isEnabled: (g) => g.can(Mr(null)),
    items: (g) => {
      const y = Sp(g.view.state);
      return [
        {
          id: 'default',
          label: t('default'),
          active: y === null,
          onSelect: () => g.exec(Mr(null)),
        },
        ...f.map((w) => ({ id: w, label: w, active: y === w, onSelect: () => g.exec(Mr(w)) })),
      ];
    },
  });
  const h = (g, y, w, N) =>
    e.addPanelButton(g, {
      icon: w,
      tooltip: t(N),
      indicator: () => gt(n(), y),
      render: (z, F) =>
        ca({
          colors: z.options.colors ?? aa,
          current: gt(z.view.state, y),
          label: t(N),
          removeLabel: t('removeColor'),
          customLabel: t('customColor'),
          onPick: (C) => {
            (F(), z.exec($t(y, C)));
          },
        }),
    });
  (h('forecolor', 'color', M.textColor, 'textColor'),
    h('backcolor', 'background', M.highlight, 'backgroundColor'));
  const d = [
    ['superscript', 'superscript', M.superscript],
    ['subscript', 'subscript', M.subscript],
    ['code', 'code', M.code],
  ];
  (e.addMenuButton('moreformats', {
    icon: M.formatMore,
    tooltip: t('moreFormats'),
    isActive: (g) => d.some(([, y]) => Rn(g.view.state, R.marks[y])),
    items: (g) => [
      ...d
        .filter(([y]) => g.isAllowed(y))
        .map(([y, w, N]) => ({
          id: y,
          label: t(y),
          icon: N,
          checkbox: !0,
          active: Rn(g.view.state, R.marks[w]),
          disabled: !g.can(y),
          ...(ke[y] ? { shortcut: ke[y] } : {}),
          onSelect: () => g.exec(y),
        })),
      { type: 'separator' },
      {
        id: 'clearFormatting',
        label: t('clearFormatting'),
        icon: M.clearFormatting,
        disabled: !g.can('clearFormatting'),
        shortcut: ke.clearFormatting,
        onSelect: () => g.exec('clearFormatting'),
      },
      {
        id: 'pasteAsText',
        label: t('pasteAsText'),
        icon: M.pasteText,
        checkbox: !0,
        active: g.isPasteAsText(),
        onSelect: () => {
          (g.setPasteAsText(!g.isPasteAsText()), g.focus());
        },
      },
    ],
  }),
    e.addToggleButton('pastetext', {
      icon: M.pasteText,
      tooltip: t('pasteAsText'),
      isActive: (g) => g.isPasteAsText(),
      onAction: (g) => {
        (g.setPasteAsText(!g.isPasteAsText()), g.focus());
      },
    }),
    e.addButton('link', {
      icon: M.link,
      tooltip: t('link'),
      shortcut: 'Mod-k',
      onAction: (g) => ir(g),
      isActive: () => !!gi(n()),
    }),
    e.addButton('unlink', {
      icon: M.unlink,
      tooltip: t('unlink'),
      onAction: (g) => g.exec(Ur()),
      isEnabled: (g) => g.can(Ur()),
    }),
    e.addButton('image', { icon: M.image, tooltip: t('image'), onAction: (g) => Ql(g) }));
  const p = () => {
      var g;
      return ((g = St(n())) == null ? void 0 : g.node.attrs.align) ?? null;
    },
    m = (g, y, w, N) =>
      e.addToggleButton(g, {
        icon: w,
        tooltip: t(N),
        isActive: () => p() === y,
        onAction: (z) => z.exec(Un({ align: p() === y ? null : y })),
      });
  (m('imagealignleft', 'left', M.imageLeft, 'image.alignLeft'),
    m('imagealigncenter', 'center', M.imageCenter, 'image.alignCenter'),
    m('imagealignright', 'right', M.imageRight, 'image.alignRight'));
  const b = [
    ['image.sizeSmall', 0.25],
    ['image.sizeMedium', 0.5],
    ['image.sizeLarge', 0.75],
    ['image.sizeFull', 1],
    ['image.sizeOriginal', null],
  ];
  (e.addMenuButton('imagesize', {
    icon: M.resize,
    tooltip: t('image.size'),
    items: (g) => b.map(([y, w]) => ({ id: y, label: t(y), onSelect: () => kd(g, w) })),
  }),
    e.addButton('imagealt', {
      icon: M.altText,
      tooltip: t('image.editAlt'),
      onAction: (g) => xd(g),
    }),
    e.addButton('imagedelete', {
      icon: M.trash,
      tooltip: t('image.delete'),
      onAction: (g) =>
        g.exec((y, w) =>
          St(y) ? (w == null || w(y.tr.deleteSelection().scrollIntoView()), !0) : !1,
        ),
    }),
    vp(r),
    e.addButton('searchreplace', {
      icon: M.search,
      tooltip: t('search.title'),
      shortcut: 'Mod-f',
      onAction: (g) => g.openSearch(),
    }),
    e.addToggleButton('fullscreen', {
      icon: M.fullscreen,
      tooltip: t('fullscreen'),
      shortcut: 'Mod-Shift-f',
      isActive: (g) => ia(g),
      onAction: (g) => Xr(g),
    }),
    e.addButton('preview', { icon: M.preview, tooltip: t('preview'), onAction: (g) => pp(g) }),
    e.addButton('code', { icon: M.sourceCode, tooltip: t('sourceCode'), onAction: (g) => gp(g) }),
    e.addButton('help', {
      icon: M.help,
      tooltip: t('help'),
      shortcut: 'Alt-0',
      onAction: (g) => oa(g),
    }),
    e.addContextToolbar('image', {
      label: t('image.toolbar'),
      predicate: (g) => !!St(g.view.state),
      items: 'imagealignleft imagealigncenter imagealignright | imagesize imagealt | imagedelete',
    }));
}
const vn = 6,
  An = 8;
function dn(r, e, t) {
  const n = window.innerWidth,
    i = window.innerHeight,
    { width: o, height: s } = r.getBoundingClientRect(),
    l = i - e.bottom,
    a = e.top,
    u = t === 'top-start' ? a >= s + vn || a > l : l < s + vn && a > l;
  let f = u ? e.top - s - vn : e.bottom + vn,
    h = t === 'bottom-end' ? e.right - o : t === 'bottom' ? e.left + e.width / 2 - o / 2 : e.left;
  ((h = Math.max(An, Math.min(h, n - o - An))),
    (f = Math.max(An, Math.min(f, i - s - An))),
    (r.style.left = `${Math.round(h)}px`),
    (r.style.top = `${Math.round(f)}px`),
    (r.dataset.side = u ? 'top' : 'bottom'));
}
const Vt = [];
class ua {
  constructor(e) {
    O(this, 'el');
    O(this, 'options');
    O(this, 'closed', !1);
    O(this, 'reposition', () => {
      if (this.closed) return;
      const { anchor: e, placement: t = 'bottom-start' } = this.options,
        n = typeof e == 'function' ? e() : e.getBoundingClientRect();
      dn(this.el, n, t);
    });
    O(this, 'focusWasInside', !1);
    O(this, 'onKeyDown', (e) => {
      var t, n;
      e.key !== 'Escape' ||
        e.defaultPrevented ||
        (Vt[Vt.length - 1] === this &&
          (((n = (t = e.target) == null ? void 0 : t.closest) != null &&
            n.call(t, '.nova-dialog')) ||
            (e.preventDefault(),
            e.stopPropagation(),
            (this.focusWasInside = this.el.contains(document.activeElement)),
            this.close('escape'))));
    });
    O(this, 'onPointerDown', (e) => {
      var n;
      if (this.options.dismissOnOutside === !1) return;
      const t = e.target;
      this.el.contains(t) ||
        ((n = this.options.ignore) != null && n.some((i) => i.contains(t))) ||
        this.close('outside');
    });
    ((this.options = e),
      (this.el = document.createElement('div')),
      (this.el.className = `nova-popover ${e.className ?? ''}`.trim()),
      this.el.append(e.content),
      e.host.append(this.el),
      this.reposition(),
      document.addEventListener('keydown', this.onKeyDown, !0),
      document.addEventListener('pointerdown', this.onPointerDown, !0),
      Vt.push(this),
      window.addEventListener('resize', this.reposition),
      window.addEventListener('scroll', this.reposition, !0));
  }
  get isOpen() {
    return !this.closed;
  }
  close(e = 'api') {
    var t, n;
    this.closed ||
      ((this.closed = !0),
      Vt.splice(Vt.indexOf(this), 1),
      document.removeEventListener('keydown', this.onKeyDown, !0),
      document.removeEventListener('pointerdown', this.onPointerDown, !0),
      window.removeEventListener('resize', this.reposition),
      window.removeEventListener('scroll', this.reposition, !0),
      this.el.remove(),
      (n = (t = this.options).onClose) == null || n.call(t, e));
  }
}
function Rp(r) {
  return new pe({
    key: new ye('nova-link-bubble'),
    view(e) {
      const { t } = r.ui,
        n = x('a', { className: 'nova-bubble-link', target: '_blank', rel: 'noopener noreferrer' }),
        i = (c, u, f) => {
          const h = x(
            'button',
            { type: 'button', className: 'nova-btn', 'aria-label': u, 'data-tooltip': u },
            de(c),
          );
          return (h.addEventListener('click', f), r.ui.tooltip.attach(h), h);
        },
        o = x(
          'div',
          { className: 'nova-bubble', role: 'toolbar', 'aria-label': t('link'), hidden: !0 },
          de(M.externalLink),
          n,
          x('span', { className: 'nova-bubble-sep' }),
          i(M.edit, t('link.edit'), () => ir(r)),
          i(M.copy, t('link.copy'), () => {
            var c;
            (c = navigator.clipboard) == null ||
              c
                .writeText(n.href)
                .then(() => r.ui.notify({ text: t('link.copied'), type: 'success', timeout: 2e3 }));
          }),
          i(M.unlink, t('unlink'), () => r.exec(Ur())),
        );
      (o.addEventListener('mousedown', (c) => {
        c.target.closest('button') && c.preventDefault();
      }),
        r.ui.overlayHost.append(o));
      const s = () => {
          o.hidden = !0;
        },
        l = () => {
          const c = e.state,
            u = gi(c),
            f = e.hasFocus() || o.contains(document.activeElement);
          if (!u || !f || !r.isEditable() || r.ui.activeDialog || !c.selection.empty) {
            s();
            return;
          }
          const h = bi(c, R.marks.link, c.selection.from);
          if (!h) return s();
          ((n.textContent = u.href),
            (n.title = u.href),
            ln(u.href) ? n.setAttribute('href', u.href) : n.removeAttribute('href'),
            (o.hidden = !1));
          const d = e.coordsAtPos(h.from),
            p = e.coordsAtPos(h.to),
            m = new DOMRect(d.left, d.top, Math.max(1, p.right - d.left), p.bottom - d.top);
          dn(o, m, 'bottom-start');
        },
        a = (c) => {
          o.contains(c.relatedTarget) || s();
        };
      return (
        e.dom.addEventListener('blur', a),
        o.addEventListener('focusout', (c) => {
          !o.contains(c.relatedTarget) && !e.hasFocus() && s();
        }),
        {
          update: l,
          destroy() {
            (e.dom.removeEventListener('blur', a), o.remove());
          },
        }
      );
    },
  });
}
const ts =
  'undo redo | blocks | bold italic underline strikethrough moreformats | forecolor backcolor | link image table | bullist numlist | align lineheight outdent indent | fontfamily fontsize | blockquote codeblock hr | removeformat | searchreplace preview code fullscreen help';
function fa(r) {
  const e = Array.isArray(r) ? r : r.split(/\s+/),
    t = [[]];
  for (const n of e) {
    const i = n.trim();
    i && (i === '|' ? t.push([]) : t[t.length - 1].push(i));
  }
  return t.filter((n) => n.length > 0);
}
function ns(r, e, t, n, { warnUnknown: i = !0 } = {}) {
  const { ui: o } = r,
    s = o.t,
    l = new AbortController(),
    { signal: a } = l;
  ((e.className = `nova-toolbar nova-toolbar-${n}`),
    e.setAttribute('role', 'toolbar'),
    e.setAttribute('aria-label', s('toolbar.label')));
  const c = [],
    u = [];
  for (const C of fa(t)) {
    const v = x('div', { className: 'nova-tb-group', role: 'group' });
    for (const D of C) {
      if (!r.isAllowed(D)) continue;
      const B = o.registry.get(D);
      if (!B) {
        i && console.warn(`[nova] Unknown toolbar item "${D}"`);
        continue;
      }
      const Ce = ha(r, D, B);
      (c.push(Ce), v.append(Ce.el));
    }
    v.childElementCount && (u.push(v), e.append(v));
  }
  const f = x('div', { className: 'nova-toolbar nova-tb-overflow', role: 'group' }),
    h = x(
      'button',
      {
        type: 'button',
        className: 'nova-btn nova-tb-more',
        'aria-label': s('more'),
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
        'data-tooltip': s('more'),
        hidden: !0,
      },
      de(M.more),
    );
  o.tooltip.attach(h);
  let d = null;
  const p = () => {
    (d == null || d.close(), (d = null));
  };
  (h.addEventListener('click', (C) => {
    var D;
    if (d) return p();
    h.setAttribute('aria-expanded', 'true');
    const v = new ua({
      host: o.overlayHost,
      anchor: h,
      placement: 'bottom-end',
      content: f,
      className: 'nova-tb-overflow-popover',
      ignore: [o.overlayHost, h],
      onClose: (B) => {
        ((d = null),
          h.setAttribute('aria-expanded', 'false'),
          B === 'escape' && v.focusWasInside && h.focus());
      },
    });
    ((d = v),
      C.detail === 0 && ((D = f.querySelector('button:not(:disabled)')) == null || D.focus()));
  }),
    n === 'sliding' && e.append(h));
  const m = () => {
    if (n !== 'sliding') return;
    for (const v of u) e.insertBefore(v, h);
    if (((h.hidden = !0), e.scrollWidth <= e.clientWidth + 1)) {
      p();
      return;
    }
    h.hidden = !1;
    let C = u.length;
    for (; C > 1 && e.scrollWidth > e.clientWidth + 1;) ((C -= 1), f.prepend(u[C]));
    (f.childElementCount || (h.hidden = !0), d == null || d.reposition(), N());
  };
  let b = -1;
  const g =
    typeof ResizeObserver < 'u' && n === 'sliding'
      ? new ResizeObserver(() => {
          e.clientWidth !== b && ((b = e.clientWidth), m());
        })
      : null;
  g == null || g.observe(e);
  const y = () => [...e.querySelectorAll('button')].filter((C) => !C.disabled && !C.hidden);
  let w = null;
  const N = () => {
    const C = y();
    (!w || !C.includes(w)) && (w = C[0] ?? null);
    for (const v of e.querySelectorAll('button')) v.tabIndex = v === w ? 0 : -1;
  };
  (e.addEventListener(
    'focusin',
    (C) => {
      const v = C.target;
      v instanceof HTMLButtonElement && e.contains(v) && ((w = v), N());
    },
    { signal: a },
  ),
    e.addEventListener(
      'keydown',
      (C) => {
        const v = y(),
          D = v.indexOf(document.activeElement);
        if (D < 0) return;
        let B = null;
        if (C.key === 'ArrowRight') B = D + 1;
        else if (C.key === 'ArrowLeft') B = D - 1;
        else if (C.key === 'Home') B = 0;
        else if (C.key === 'End') B = v.length - 1;
        else if (C.key === 'Escape') {
          (C.preventDefault(), r.focus());
          return;
        }
        B !== null && (C.preventDefault(), v[(B + v.length) % v.length].focus());
      },
      { signal: a },
    ));
  const z = (C) => {
    C.target.closest('button') && C.preventDefault();
  };
  (e.addEventListener('mousedown', z, { signal: a }),
    f.addEventListener('mousedown', z),
    f.addEventListener('keydown', (C) => {
      if (C.key === 'Escape') return;
      const v = [...f.querySelectorAll('button')].filter((B) => !B.disabled),
        D = v.indexOf(document.activeElement);
      D < 0 ||
        (C.key === 'ArrowRight' || C.key === 'ArrowDown'
          ? (C.preventDefault(), v[(D + 1) % v.length].focus())
          : (C.key === 'ArrowLeft' || C.key === 'ArrowUp') &&
            (C.preventDefault(), v[(D - 1 + v.length) % v.length].focus()));
    }));
  const F = () => {
    for (const C of c) C.update();
    N();
  };
  return (
    F(),
    m(),
    {
      update: F,
      focus: () => {
        (N(), w == null || w.focus());
      },
      destroy: () => {
        (g == null || g.disconnect(), p(), l.abort(), e.replaceChildren());
      },
    }
  );
}
function ha(r, e, t) {
  var a;
  const { ui: n } = r,
    i = x('button', {
      type: 'button',
      className: `nova-btn nova-tb-${t.type}`,
      'aria-label': t.tooltip,
      'data-tooltip': t.tooltip,
      'data-control': e,
      ...(t.shortcut ? { 'data-shortcut': t.shortcut } : {}),
    });
  (n.tooltip.attach(i), t.icon && i.append(de(t.icon)));
  const o =
    t.type === 'menu' && (t.label || t.text) ? x('span', { className: 'nova-tb-label' }) : null;
  o
    ? (t.type === 'menu' && t.minChars && (o.style.minWidth = `${t.minChars}ch`),
      i.append(o),
      i.classList.add('nova-tb-has-label'))
    : !t.icon && t.text && i.append(t.text);
  let s = null;
  return (
    t.type === 'panel' &&
      t.indicator &&
      ((s = x('span', { className: 'nova-color-bar' })), i.append(s)),
    t.type !== 'button' &&
      (i.setAttribute('aria-haspopup', t.type === 'menu' ? 'menu' : 'dialog'),
      i.setAttribute('aria-expanded', 'false'),
      i.append(de(M.chevronDown)),
      (a = i.lastElementChild) == null || a.classList.add('nova-chevron')),
    i.addEventListener('click', (c) => {
      var p;
      if (t.type === 'button') {
        t.onAction(r);
        return;
      }
      if (i.getAttribute('aria-expanded') === 'true') {
        n.closePopover();
        return;
      }
      const u = c.detail === 0,
        f = () => n.closePopover(),
        h = t.type === 'menu' ? ta(t.items(r), f, t.tooltip) : t.render(r, f);
      i.setAttribute('aria-expanded', 'true');
      const d = n.openPopover({
        anchor: i,
        content: h,
        ignore: [i],
        className: t.type === 'menu' ? 'nova-popover-menu' : 'nova-popover-panel',
        onClose: (m) => {
          (i.setAttribute('aria-expanded', 'false'),
            m === 'escape' && d.focusWasInside && i.focus());
        },
      });
      t.type === 'menu'
        ? na(h)
        : u && ((p = h.querySelector('button, input')) == null || p.focus());
    }),
    t.type !== 'button' &&
      i.addEventListener('keydown', (c) => {
        c.key === 'ArrowDown' &&
          i.getAttribute('aria-expanded') !== 'true' &&
          (c.preventDefault(), i.click());
      }),
    {
      el: i,
      update: () => {
        var u;
        const c = r.isEditable();
        if (((i.disabled = !c || (t.isEnabled ? !t.isEnabled(r) : !1)), t.isActive)) {
          const f = t.isActive(r);
          (i.classList.toggle('is-active', f),
            t.type === 'button' && i.setAttribute('aria-pressed', String(f)));
        }
        if (
          (o &&
            t.type === 'menu' &&
            (o.textContent = ((u = t.label) == null ? void 0 : u.call(t, r)) ?? t.text ?? ''),
          s && t.type === 'panel' && t.indicator)
        ) {
          const f = t.indicator(r);
          ((s.style.background = f ?? ''), s.classList.toggle('is-empty', !f));
        }
      },
    }
  );
}
function Ip(r) {
  return new pe({
    key: new ye('nova-context-toolbar'),
    view(e) {
      const t = x('div', {
        className: 'nova-bubble nova-context-toolbar',
        role: 'toolbar',
        hidden: !0,
      });
      r.ui.overlayHost.append(t);
      const n = new Map();
      let i = null;
      const o = (m, b) => {
          let g = n.get(m);
          if (g) return g;
          const y = x('div', { className: 'nova-context-items' }),
            w = [];
          return (
            fa(b.items).forEach((N, z) => {
              z > 0 && y.append(x('span', { className: 'nova-bubble-sep', role: 'separator' }));
              for (const F of N) {
                if (!r.isAllowed(F)) continue;
                const C = r.ui.registry.get(F);
                if (!C) continue;
                const v = ha(r, F, C);
                (w.push(v), y.append(v.el));
              }
            }),
            (g = { el: y, controls: w }),
            n.set(m, g),
            g
          );
        },
        s = () => {
          ((t.hidden = !0), (i = null));
        },
        l = (m) => {
          const { selection: b } = e.state;
          if ((m.position ?? 'node') === 'node' && b instanceof E) {
            const w = e.nodeDOM(b.from);
            return (w == null ? void 0 : w.getBoundingClientRect()) ?? null;
          }
          const g = e.coordsAtPos(b.from),
            y = e.coordsAtPos(b.to);
          return new DOMRect(g.left, g.top, Math.max(1, y.right - g.left), y.bottom - g.top);
        };
      let a = !1;
      const c = (m) => {
          m.pointerType === 'mouse' && m.button === 0 && (a = !0);
        },
        u = () => {
          a && ((a = !1), setTimeout(() => h(e), 0));
        };
      (e.dom.addEventListener('pointerdown', c), document.addEventListener('pointerup', u));
      const f = typeof matchMedia == 'function' && matchMedia('(pointer: coarse)').matches,
        h = (m) => {
          if (
            !(m.hasFocus() || t.contains(document.activeElement)) ||
            !r.isEditable() ||
            r.ui.activeDialog ||
            a
          )
            return s();
          const g = r.ui.registry.getContextToolbars().find(([, C]) => C.predicate(r));
          if (!g) return s();
          const [y, w] = g,
            N = o(y, w);
          i !== y && (t.replaceChildren(N.el), t.setAttribute('aria-label', w.label), (i = y));
          for (const C of N.controls) C.update();
          const z = w.anchor ? w.anchor(r) : l(w);
          if (!z) return s();
          t.hidden = !1;
          let F = w.placement ?? (w.position === 'selection' ? 'bottom-start' : 'top-start');
          (f && w.position === 'selection' && (F = 'bottom-start'), dn(t, z, F));
        };
      (t.addEventListener('mousedown', (m) => {
        m.target.closest('button') && m.preventDefault();
      }),
        t.addEventListener('keydown', (m) => {
          const b = [...t.querySelectorAll('button:not(:disabled)')],
            g = b.indexOf(document.activeElement);
          if (m.key === 'Escape') (m.preventDefault(), r.focus());
          else if (g >= 0 && (m.key === 'ArrowRight' || m.key === 'ArrowLeft')) {
            m.preventDefault();
            const y = m.key === 'ArrowRight' ? 1 : -1;
            b[(g + y + b.length) % b.length].focus();
          }
        }));
      const d = (m) => {
        const b = m.relatedTarget;
        !t.contains(b) && !r.ui.overlayHost.contains(b) && s();
      };
      (e.dom.addEventListener('blur', d),
        t.addEventListener('focusout', (m) => {
          const b = m.relatedTarget;
          !t.contains(b) && !e.hasFocus() && !r.ui.overlayHost.contains(b) && s();
        }));
      const p = () => {
        t.hidden || h(e);
      };
      return (
        window.addEventListener('scroll', p, !0),
        window.addEventListener('resize', p),
        {
          update: h,
          destroy() {
            (e.dom.removeEventListener('blur', d),
              e.dom.removeEventListener('pointerdown', c),
              document.removeEventListener('pointerup', u),
              window.removeEventListener('scroll', p, !0),
              window.removeEventListener('resize', p),
              t.remove());
          },
        }
      );
    },
  });
}
function Lp(r) {
  const e = r.ui.overlayHost.querySelector(
    '.nova-context-toolbar:not([hidden]) button:not(:disabled)',
  );
  return (e == null || e.focus(), !!e);
}
const rs = 24;
class zp {
  constructor(e, t, n, i) {
    O(this, 'dom');
    O(this, 'img');
    O(this, 'node');
    O(this, 'resizing', !1);
    ((this.view = t),
      (this.getPos = n),
      (this.editor = i),
      (this.node = e),
      (this.dom = document.createElement('span')),
      (this.dom.className = 'nova-image'),
      (this.img = document.createElement('img')),
      (this.img.draggable = !1),
      this.dom.append(this.img));
    for (const o of ['nw', 'ne', 'sw', 'se']) {
      const s = document.createElement('span');
      ((s.className = `nova-image-handle nova-image-handle-${o}`),
        (s.dataset.corner = o),
        s.addEventListener('pointerdown', (l) => this.startResize(l, o)),
        this.dom.append(s));
    }
    this.render();
  }
  render() {
    const { src: e, alt: t, title: n, width: i, height: o, align: s } = this.node.attrs,
      l = It(e) ? e : '';
    (this.img.getAttribute('src') !== l && this.img.setAttribute('src', l),
      this.setAttr('alt', t),
      this.setAttr('title', n));
    const a = kt(i),
      c = kt(o);
    ((this.img.style.width = a ? `${a}px` : ''),
      (this.img.style.aspectRatio = a && c ? `${a} / ${c}` : ''),
      (this.dom.dataset.align = s ?? ''));
  }
  setAttr(e, t) {
    t ? this.img.setAttribute(e, t) : this.img.removeAttribute(e);
  }
  update(e) {
    return e.type !== this.node.type ? !1 : ((this.node = e), this.resizing || this.render(), !0);
  }
  selectNode() {
    this.dom.classList.add('is-selected');
  }
  deselectNode() {
    this.dom.classList.remove('is-selected');
  }
  stopEvent(e) {
    var t;
    return ((t = e.target.classList) == null ? void 0 : t.contains('nova-image-handle')) ?? !1;
  }
  ignoreMutation() {
    return !0;
  }
  startResize(e, t) {
    if (!this.editor.isEditable()) return;
    (e.preventDefault(), e.stopPropagation());
    const n = e.currentTarget;
    n.setPointerCapture(e.pointerId);
    const i = this.img.getBoundingClientRect(),
      o = e.clientX,
      s = i.width,
      l = i.width > 0 ? i.height / i.width : this.img.naturalHeight / (this.img.naturalWidth || 1),
      a = Math.max(rs, this.view.dom.clientWidth - 40),
      c = t === 'ne' || t === 'se' ? 1 : -1;
    let u = s;
    ((this.resizing = !0), this.dom.classList.add('is-resizing'));
    const f = (d) => {
        ((u = Math.round(Math.min(a, Math.max(rs, s + c * (d.clientX - o))))),
          (this.img.style.width = `${u}px`),
          (this.dom.dataset.size = `${u} × ${Math.round(u * l)}`));
      },
      h = () => {
        (n.removeEventListener('pointermove', f),
          n.removeEventListener('pointerup', h),
          n.removeEventListener('pointercancel', h),
          (this.resizing = !1),
          this.dom.classList.remove('is-resizing'),
          delete this.dom.dataset.size);
        const d = this.getPos();
        if (d === void 0 || Math.abs(u - s) < 1) return this.render();
        const p = this.view.state.tr.setNodeMarkup(d, void 0, {
          ...this.node.attrs,
          width: u,
          height: Math.round(u * l),
        });
        (p.setSelection(E.create(p.doc, d)), this.view.dispatch(p));
      };
    (n.addEventListener('pointermove', f),
      n.addEventListener('pointerup', h),
      n.addEventListener('pointercancel', h));
  }
}
const Bp = 30;
function Pp(r) {
  return r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function Fp(r, e) {
  const { selection: t } = r.state;
  if (!t.empty) return null;
  const n = t.$from;
  if (!n.parent.isTextblock || n.parent.type.spec.code) return null;
  const i = n.parent.textBetween(Math.max(0, n.parentOffset - Bp - 1), n.parentOffset, '\0', '\0');
  for (const [o, s] of e.ui.registry.getAutocompleters()) {
    const l = new RegExp(`(?:^|\\s)${Pp(s.trigger)}([\\p{L}\\p{N}_-]*)$`, 'u'),
      a = i.match(l);
    if (!a) continue;
    const c = a[1] ?? '';
    if (c.length < (s.minChars ?? 0)) continue;
    const u = n.parentOffset - c.length - s.trigger.length,
      f = u > 0 ? n.parent.textBetween(u - 1, u, '\0', '\0') : '';
    if (!(f && !/\s/.test(f)))
      return { name: o, spec: s, from: n.pos - c.length - s.trigger.length, to: n.pos, query: c };
  }
  return null;
}
function $p(r) {
  let e,
    t = [],
    n = 0,
    i = null,
    o = null,
    s = 0;
  const l = Lt('nova-ac'),
    a = () => !e.hidden,
    c = (p) => {
      ((e.hidden = !0),
        (i = null),
        (t = []),
        p.dom.removeAttribute('aria-activedescendant'),
        p.dom.removeAttribute('aria-controls'),
        p.dom.setAttribute('aria-expanded', 'false'));
    },
    u = (p, m) => {
      const b = t[m];
      if (!b || !i) return;
      const { spec: g, from: y, to: w } = i;
      (c(p), g.onSelect(b, { from: y, to: w }, r));
    },
    f = (p) => {
      if (!i) return;
      const { spec: m } = i;
      if ((e.replaceChildren(), e.setAttribute('aria-label', m.label), !t.length)) {
        if (!m.emptyText) return c(p);
        e.append(x('div', { className: 'nova-ac-empty' }, m.emptyText));
      }
      (t.forEach((g, y) => {
        const w = x(
          'div',
          {
            id: `${l}-${y}`,
            className: 'nova-menu-item nova-ac-item',
            role: 'option',
            'aria-selected': String(y === n),
          },
          g.icon ? de(g.icon) : null,
          x('span', { className: 'nova-menu-label' }, g.label),
          g.shortcut ? x('kbd', { className: 'nova-menu-shortcut' }, rr(g.shortcut)) : null,
        );
        (w.addEventListener('mousedown', (N) => {
          (N.preventDefault(), u(p, y));
        }),
          w.addEventListener('mousemove', () => {
            n !== y && h(p, y);
          }),
          e.append(w));
      }),
        (e.hidden = !1),
        p.dom.setAttribute('aria-controls', l),
        p.dom.setAttribute('aria-expanded', 'true'),
        h(p, Math.min(n, Math.max(0, t.length - 1))));
      const b = p.coordsAtPos(i.from);
      dn(e, new DOMRect(b.left, b.top, 1, b.bottom - b.top), 'bottom-start');
    },
    h = (p, m) => {
      var g;
      ((n = m),
        e
          .querySelectorAll('[role="option"]')
          .forEach((y, w) => y.setAttribute('aria-selected', String(w === m))));
      const b = e.querySelector(`#${l}-${m}`);
      b &&
        (p.dom.setAttribute('aria-activedescendant', b.id),
        (g = b.scrollIntoView) == null || g.call(b, { block: 'nearest' }));
    },
    d = (p) => {
      const m = r.isEditable() && p.hasFocus() ? Fp(p, r) : null;
      if (!m || m.from === o) {
        (m || (o = null), (a() || i) && c(p));
        return;
      }
      const b = !i || i.query !== m.query || i.from !== m.from;
      if (((i = m), !b && a())) return f(p);
      const g = ++s;
      Promise.resolve(m.spec.fetch(m.query, r)).then((y) => {
        g !== s || !i || ((t = y.slice(0, m.spec.maxResults ?? 10)), (n = 0), f(p));
      });
    };
  return new pe({
    key: new ye('nova-autocompleter'),
    view(p) {
      ((e = x('div', { className: 'nova-popover nova-ac', id: l, role: 'listbox', hidden: !0 })),
        r.ui.overlayHost.append(e),
        p.dom.setAttribute('aria-autocomplete', 'list'));
      const m = () => c(p);
      return (
        p.dom.addEventListener('blur', m),
        {
          update: (b) => d(b),
          destroy() {
            (p.dom.removeEventListener('blur', m), e.remove());
          },
        }
      );
    },
    props: {
      handleKeyDown(p, m) {
        if (!a() || !i) return !1;
        const b = t.length;
        switch (m.key) {
          case 'ArrowDown':
            return (b && h(p, (n + 1) % b), !0);
          case 'ArrowUp':
            return (b && h(p, (n - 1 + b) % b), !0);
          case 'Enter':
          case 'Tab':
            return b ? (u(p, n), !0) : !1;
          case 'Escape':
            return ((o = i.from), c(p), !0);
          default:
            return !1;
        }
      },
    },
  });
}
const Oe = (r) => (e) => e.exec(r),
  Vp = [
    {
      name: 'paragraph',
      label: 'paragraph',
      icon: M.paragraph,
      keywords: ['text', 'p', 'paragraph'],
      run: Oe('paragraph'),
    },
    {
      name: 'h1',
      label: 'h1',
      icon: M.h1,
      keywords: ['h1', 'heading', 'title'],
      shortcut: 'Mod-Alt-1',
      run: Oe('h1'),
    },
    {
      name: 'h2',
      label: 'h2',
      icon: M.h2,
      keywords: ['h2', 'heading', 'subtitle'],
      shortcut: 'Mod-Alt-2',
      run: Oe('h2'),
    },
    {
      name: 'h3',
      label: 'h3',
      icon: M.h3,
      keywords: ['h3', 'heading'],
      shortcut: 'Mod-Alt-3',
      run: Oe('h3'),
    },
    {
      name: 'bullist',
      label: 'bulletList',
      icon: M.bulletList,
      keywords: ['ul', 'list', 'bullet'],
      shortcut: 'Mod-Shift-8',
      run: Oe('bulletList'),
    },
    {
      name: 'numlist',
      label: 'orderedList',
      icon: M.orderedList,
      keywords: ['ol', 'list', 'numbered'],
      shortcut: 'Mod-Shift-7',
      run: Oe('orderedList'),
    },
    {
      name: 'blockquote',
      label: 'blockquote',
      icon: M.blockquote,
      keywords: ['quote', 'blockquote', 'citation'],
      run: Oe('blockquote'),
    },
    {
      name: 'codeblock',
      label: 'codeBlock',
      icon: M.codeBlock,
      keywords: ['code', 'pre', 'snippet'],
      run: Oe('codeBlock'),
    },
    {
      name: 'hr',
      label: 'horizontalRule',
      icon: M.horizontalRule,
      keywords: ['hr', 'divider', 'line', 'separator'],
      run: Oe('horizontalRule'),
    },
    {
      name: 'table',
      label: 'table',
      icon: M.table,
      keywords: ['table', 'grid'],
      run: (r) => r.exec(an(3, 3)),
    },
    {
      name: 'image',
      label: 'image',
      icon: M.image,
      keywords: ['image', 'picture', 'photo', 'img'],
      run: (r) => Ql(r),
    },
    {
      name: 'link',
      label: 'link',
      icon: M.link,
      keywords: ['link', 'url', 'href'],
      shortcut: 'Mod-k',
      run: (r) => ir(r),
    },
  ];
function Hp(r, e, t) {
  const n = e.toLowerCase();
  if (!n) return r;
  const i = [];
  return (
    r.forEach((o, s) => {
      const l = t(o.label).toLowerCase(),
        a = [l, ...l.split(/\s+/), ...o.keywords];
      let c = -1;
      (l.startsWith(n)
        ? (c = 3)
        : a.some((u) => u.startsWith(n))
          ? (c = 2)
          : a.some((u) => u.includes(n)) && (c = 1),
        c > 0 && i.push([c, s, o]));
    }),
    i.sort((o, s) => s[0] - o[0] || o[1] - s[1]).map(([, , o]) => o)
  );
}
function Wp(r, e = []) {
  const { t } = r.ui,
    n = [...Vp, ...e].filter((i) => r.isAllowed(i.name));
  r.ui.registry.addAutocompleter('slashcommands', {
    trigger: '/',
    label: t('slash.label'),
    emptyText: t('slash.empty'),
    fetch: (i) =>
      Hp(n, i, t).map((o) => ({
        value: o.name,
        label: t(o.label),
        icon: o.icon,
        ...(o.shortcut ? { shortcut: o.shortcut } : {}),
      })),
    onSelect: (i, o, s) => {
      const l = n.find((a) => a.name === i.value);
      l && (s.view.dispatch(s.view.state.tr.delete(o.from, o.to)), l.run(s));
    },
  });
}
class qp {
  constructor(e, t) {
    O(this, 'region');
    O(this, 'closeLabel');
    ((this.closeLabel = t),
      (this.region = x('div', { className: 'nova-notifications', 'aria-live': 'polite' })),
      e.append(this.region));
  }
  open(e) {
    const t = e.type ?? 'info',
      n = e.timeout ?? (t === 'error' ? 0 : 4e3),
      i = x('span', { className: 'nova-notification-text' }, e.text),
      o = x(
        'button',
        { type: 'button', className: 'nova-btn', 'aria-label': this.closeLabel },
        de(M.close),
      ),
      s = x(
        'div',
        {
          className: `nova-notification nova-notification-${t}`,
          role: t === 'error' ? 'alert' : 'status',
        },
        i,
        o,
      );
    this.region.append(s);
    let l = null;
    const a = () => {
      (l && clearTimeout(l), s.remove());
    };
    return (
      o.addEventListener('click', a),
      n > 0 && (l = setTimeout(a, n)),
      { close: a, setText: (c) => (i.textContent = c) }
    );
  }
  destroy() {
    this.region.remove();
  }
}
class Jp {
  constructor() {
    O(this, 'controls', new Map());
    O(this, 'menuItems', new Map());
    O(this, 'contextToolbars', new Map());
    O(this, 'autocompleters', new Map());
  }
  addButton(e, t) {
    this.controls.set(e.toLowerCase(), { type: 'button', ...t });
  }
  addToggleButton(e, t) {
    this.addButton(e, t);
  }
  addMenuButton(e, t) {
    this.controls.set(e.toLowerCase(), { type: 'menu', ...t });
  }
  addPanelButton(e, t) {
    this.controls.set(e.toLowerCase(), { type: 'panel', ...t });
  }
  addMenuItem(e, t) {
    this.menuItems.set(e.toLowerCase(), t);
  }
  addToggleMenuItem(e, t) {
    this.addMenuItem(e, t);
  }
  getMenuItem(e) {
    const t = this.menuItems.get(e.toLowerCase());
    if (t) return t;
    const n = this.get(e);
    if ((n == null ? void 0 : n.type) === 'button')
      return {
        text: n.tooltip,
        ...(n.icon ? { icon: n.icon } : {}),
        ...(n.shortcut ? { shortcut: n.shortcut } : {}),
        onAction: n.onAction,
        ...(n.isActive ? { isActive: n.isActive } : {}),
        ...(n.isEnabled ? { isEnabled: n.isEnabled } : {}),
      };
  }
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
}
const _p = 450;
class Kp {
  constructor(e) {
    O(this, 'el');
    O(this, 'timer', null);
    O(this, 'target', null);
    ((this.el = x('div', { className: 'nova-tooltip', role: 'tooltip', hidden: !0 })),
      e.append(this.el));
  }
  attach(e) {
    (e.addEventListener('pointerenter', (t) => {
      t.pointerType === 'mouse' && this.schedule(e);
    }),
      e.addEventListener('pointerleave', () => this.hide()),
      e.addEventListener('focus', () => {
        e.matches(':focus-visible') && this.show(e);
      }),
      e.addEventListener('blur', () => this.hide()),
      e.addEventListener('pointerdown', () => this.hide()));
  }
  schedule(e) {
    (this.clearTimer(), (this.timer = setTimeout(() => this.show(e), _p)));
  }
  show(e) {
    this.clearTimer();
    const t = e.dataset.tooltip;
    if (!t || e.getAttribute('aria-expanded') === 'true') return;
    this.target = e;
    const n = e.dataset.shortcut;
    (this.el.replaceChildren(x('span', {}, t)),
      n && this.el.append(x('kbd', {}, rr(n))),
      (this.el.hidden = !1),
      dn(this.el, e.getBoundingClientRect(), 'bottom'));
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
}
class Up {
  constructor(e, t, n) {
    O(this, 'registry', new Jp());
    O(this, 't');
    O(this, 'overlayHost');
    O(this, 'tooltip');
    O(this, 'notifications');
    O(this, 'popover', null);
    O(this, 'dialog', null);
    ((this.focusEditor = n),
      (this.t = t),
      (this.overlayHost = x('div', { className: 'nova-overlays' })),
      e.append(this.overlayHost),
      (this.tooltip = new Kp(this.overlayHost)),
      (this.notifications = new qp(e, t('dialog.close'))));
  }
  openPopover(e) {
    (this.closePopover(), this.tooltip.hide());
    const t = new ua({
      ...e,
      host: this.overlayHost,
      onClose: (n) => {
        var i;
        (this.popover === t && (this.popover = null), (i = e.onClose) == null || i.call(e, n));
      },
    });
    return ((this.popover = t), t);
  }
  closePopover() {
    var e;
    ((e = this.popover) == null || e.close('api'), (this.popover = null));
  }
  get activePopover() {
    return this.popover;
  }
  openDialog(e) {
    var n;
    (this.closePopover(), (n = this.dialog) == null || n.close());
    const t = md({
      cancelLabel: this.t('dialog.cancel'),
      closeLabel: this.t('dialog.close'),
      ...e,
      host: this.overlayHost,
      returnFocus: this.focusEditor,
      onClose: () => {
        var i;
        (this.dialog === t && (this.dialog = null), (i = e.onClose) == null || i.call(e));
      },
    });
    return ((this.dialog = t), t);
  }
  get activeDialog() {
    return this.dialog;
  }
  notify(e) {
    return this.notifications.open(typeof e == 'string' ? { text: e } : e);
  }
  destroy() {
    var e;
    (this.closePopover(),
      (e = this.dialog) == null || e.close(),
      this.tooltip.destroy(),
      this.notifications.destroy(),
      this.overlayHost.remove());
  }
}
const Cr = {
    paragraph: () => 'p',
    heading: (r) => `h${r.attrs.level}`,
    blockquote: () => 'blockquote',
    code_block: () => 'pre',
    bullet_list: () => 'ul',
    ordered_list: () => 'ol',
    list_item: () => 'li',
    table: () => 'table',
    table_row: () => 'tr',
    table_cell: () => 'td',
    table_header: () => 'th',
  },
  jp = {
    bold: 'strong',
    italic: 'em',
    underline: 'u',
    strike: 's',
    code: 'code',
    link: 'a',
    subscript: 'sub',
    superscript: 'sup',
  };
function Gp(r) {
  const e = r.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return e ? e.length : 0;
}
function Xp(r, e) {
  e.className = 'nova-statusbar';
  const t = x('div', { className: 'nova-path', 'aria-hidden': 'true' }),
    n = x('div', { className: 'nova-wordcount', 'aria-live': 'off' });
  e.append(t, n);
  let i = null;
  const o = () => {
      const l = r.view.state.doc;
      n.textContent = r.ui.t('status.words', {
        count: Gp(l.textBetween(0, l.content.size, ' ', ' ')),
      });
    },
    s = (l) => {
      var f;
      const { $from: a } = r.view.state.selection,
        c = [];
      for (let h = 1; h <= a.depth; h++) {
        const d = a.node(h),
          p = (f = Cr[d.type.name]) == null ? void 0 : f.call(Cr, d);
        p && c.push(p);
      }
      const u = r.view.state.selection.node;
      (u == null ? void 0 : u.type.name) === 'image' && c.push('img');
      for (const h of a.marks()) {
        const d = jp[h.type.name];
        d && c.push(d);
      }
      ((t.textContent = c.join(' › ')), l && (i && clearTimeout(i), (i = setTimeout(o, 250))));
    };
  return (
    o(),
    s(!1),
    {
      update: s,
      destroy: () => {
        (i && clearTimeout(i), e.replaceChildren());
      },
    }
  );
}
const Yp = new Mp();
class Qp {
  constructor(e) {
    O(this, 'view');
    O(this, 'root');
    O(this, 'ui');
    O(this, 'options');
    O(this, 'listeners', new Map());
    O(this, 'ready');
    O(this, 'toolbar');
    O(this, 'toolbarHost');
    O(this, 'menubar');
    O(this, 'mode');
    O(this, 'pluginsByName', new Map());
    O(this, 'cleanups', []);
    O(this, 'contentRules');
    O(this, 'statusbar');
    O(this, 'searchBar');
    O(this, 'destroyed', !1);
    O(this, 'editable');
    O(this, 'pasteAsText');
    var w;
    ((this.options = e),
      (this.root = document.createElement('div')),
      (this.root.className = 'nova-editor'),
      e.element.appendChild(this.root));
    const t = document.createElement('div'),
      n = document.createElement('div'),
      i = document.createElement('div');
    n.className = 'nova-content';
    const o = document.createElement('div');
    o.className = 'nova-header';
    const s = document.createElement('div');
    (o.append(s, t),
      this.root.append(o, n, i),
      (this.toolbarHost = t),
      (this.mode = e.mode ?? 'classic'),
      this.root.classList.add(`nova-mode-${this.mode}`));
    const l = this.mode === 'distraction-free';
    (this.mode !== 'classic' &&
      (this.root.addEventListener('focusin', () => this.root.classList.add('is-focused')),
      this.root.addEventListener('focusout', () => {
        setTimeout(() => {
          this.root.contains(document.activeElement) || this.root.classList.remove('is-focused');
        }, 0);
      })),
      (this.ui = new Up(this.root, dd(e.language, e.translations), () => this.focus())));
    const a = $n({
        'Mod-k': () => (ir(this), !0),
        'Alt-F9': () => (this.menubar ? (this.menubar.focus(), !0) : !1),
        'Alt-F10': () => (this.toolbar ? (this.toolbar.focus(), !0) : !1),
        'Ctrl-F9': () => Lp(this),
        'Mod-f': () => (this.openSearch(), !0),
        'Mod-Shift-f': () => (Xr(this), !0),
        'Alt-0': () => (oa(this), !0),
        Escape: () => (this.searchBar.isOpen() ? (this.searchBar.close(), !0) : !1),
      }),
      c = [...(e.plugins ?? [])];
    l && !c.includes('quickbars') && c.push('quickbars');
    const u = ga(c);
    u.errors.forEach((N) => Ze(N));
    const { ordered: f, errors: h } = ki(u.plugins);
    h.forEach((N) => Ze(N));
    const d = f.flatMap((N) => this.collectPmPlugins(N)),
      p = e.validElements !== void 0 || e.invalidElements !== void 0 || e.validStyles !== void 0;
    this.contentRules = p ? new tp(e) : null;
    const m = is(e.content ?? ''),
      b = wt.create({
        doc: this.contentRules ? this.contentRules.normalizeDoc(m) : m,
        plugins: [
          $p(this),
          Nd((N) => this.isAllowed(N)),
          a,
          ...Pd(),
          lp(),
          ...Od(),
          yf(),
          pc({ color: 'var(--nova-accent)', width: 2 }),
          rf(),
          wd(this),
          Ld(this),
          Rp(this),
          Ip(this),
          ...(this.contentRules ? [ip(this.contentRules)] : []),
          ...d,
          ...(e.prosemirrorPlugins ?? []),
        ],
      });
    ((this.editable = e.editable ?? !0),
      (this.pasteAsText = e.pasteAsText ?? !1),
      (this.view = new vl(n, {
        state: b,
        editable: () => this.editable,
        attributes: {
          class: 'nova-prosemirror',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': this.ui.t('editor.label'),
          ...(e.placeholder ? { 'data-placeholder': e.placeholder } : {}),
        },
        dispatchTransaction: (N) => this.handleTransaction(N),
        clipboardParser: ea,
        nodeViews: { image: (N, z, F) => new zp(N, z, F, this) },
        handleDOMEvents: {
          focus: () => (this.emit('focus'), !1),
          blur: () => (this.emit('blur'), !1),
        },
      })),
      this.root.classList.toggle('nova-readonly', !this.editable),
      Dp(this),
      Yd(this),
      e.slashCommands !== !1 && Wp(this, e.slashCommands ?? []),
      f.forEach((N) => this.setupPlugin(N)),
      (w = e.setup) == null || w.call(e, this));
    const g = e.menubar === !0 ? Kd : typeof e.menubar == 'string' ? e.menubar : null;
    ((this.menubar = g ? Ud(this, s, g, { ..._d, ...e.menu }) : null),
      this.menubar || s.remove(),
      (this.toolbar =
        e.toolbar === !1 || (l && e.toolbar === void 0)
          ? null
          : ns(this, t, this.toolbarConfig(), e.toolbarMode ?? 'sliding', {
              warnUnknown: u.loaders.length === 0,
            })),
      this.toolbar || t.remove(),
      !this.toolbar && !this.menubar && o.remove(),
      (this.searchBar = dp(this, n)));
    const y = e.statusbar ?? this.mode === 'classic';
    ((this.statusbar = y ? Xp(this, i) : null),
      this.statusbar || i.remove(),
      e.onChange && this.on('change', e.onChange),
      this.updatePlaceholder(),
      (this.ready = u.loaders.length ? this.loadLazyPlugins(u.loaders) : Promise.resolve()));
  }
  isAllowed(e) {
    var t;
    return ((t = this.contentRules) == null ? void 0 : t.isAllowed(e)) ?? !0;
  }
  hasPlugin(e) {
    return this.pluginsByName.has(e);
  }
  collectPmPlugins(e) {
    var t;
    try {
      return ((t = e.prosemirrorPlugins) == null ? void 0 : t.call(e, this)) ?? [];
    } catch (n) {
      return (Ze(`Plugin "${e.name}" failed to create ProseMirror plugins`, n), []);
    }
  }
  setupPlugin(e) {
    var t;
    try {
      const n = (t = e.setup) == null ? void 0 : t.call(e, this);
      (typeof n == 'function' && this.cleanups.push(n), this.pluginsByName.set(e.name, e));
    } catch (n) {
      Ze(`Plugin "${e.name}" failed during setup`, n);
    }
  }
  async loadLazyPlugins(e) {
    const t = await Promise.all(
      e.map((l) => ba(l).catch((a) => (Ze('Failed to load plugin', a), null))),
    );
    if (this.destroyed) return;
    const n = t.filter((l) => !!l),
      { ordered: i, errors: o } = ki(n, new Set(this.pluginsByName.keys()));
    o.forEach((l) => Ze(l));
    const s = i.flatMap((l) => this.collectPmPlugins(l));
    if (s.length) {
      const l = this.view.state;
      this.view.updateState(l.reconfigure({ plugins: [...l.plugins, ...s] }));
    }
    (i.forEach((l) => this.setupPlugin(l)), this.rebuildToolbar());
  }
  rebuildToolbar() {
    !this.toolbar ||
      this.destroyed ||
      (this.toolbar.destroy(),
      (this.toolbar = ns(
        this,
        this.toolbarHost,
        this.toolbarConfig(),
        this.options.toolbarMode ?? 'sliding',
      )));
  }
  toolbarConfig() {
    if (this.options.toolbar) return this.options.toolbar;
    const e = [...this.pluginsByName.values()].map((t) => t.toolbar).filter(Boolean);
    return e.length ? `${ts} | ${e.join(' ')}` : ts;
  }
  handleTransaction(e) {
    var n, i, o;
    const t = this.view.state.apply(e);
    (this.view.updateState(t),
      (n = this.toolbar) == null || n.update(),
      (i = this.statusbar) == null || i.update(e.docChanged),
      (o = this.searchBar) == null || o.update(),
      this.updatePlaceholder(),
      e.docChanged && this.emit('change'),
      (e.selectionSet || e.docChanged) && this.emit('selectionChange'));
  }
  updatePlaceholder() {
    var n;
    const e = this.view.state.doc,
      t =
        e.childCount === 1 &&
        ((n = e.firstChild) == null ? void 0 : n.type) === R.nodes.paragraph &&
        e.firstChild.content.size === 0;
    this.view.dom.classList.toggle('nova-empty', t);
  }
  getHTML() {
    return Yp.serializeFragment(this.view.state.doc.content);
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
    const n = is(e),
      i = this.view.state.tr.replaceWith(0, this.view.state.doc.content.size, n.content);
    (t || i.setMeta('addToHistory', !1), this.view.dispatch(i));
  }
  isEmpty() {
    return this.view.dom.classList.contains('nova-empty');
  }
  exec(e) {
    const n = (typeof e == 'string' ? $[e] : e)(this.view.state, this.view.dispatch, this.view);
    return (n && this.view.focus(), n);
  }
  can(e) {
    return (typeof e == 'string' ? $[e] : e)(this.view.state, void 0, this.view);
  }
  isActive(e) {
    return fd(this.view.state, e);
  }
  focus() {
    this.destroyed || this.view.focus();
  }
  isPasteAsText() {
    return this.pasteAsText;
  }
  setPasteAsText(e) {
    var t;
    ((this.pasteAsText = e), (t = this.toolbar) == null || t.update());
  }
  openSearch() {
    this.searchBar.open();
  }
  closeSearch() {
    this.searchBar.close();
  }
  isEditable() {
    return this.editable;
  }
  setEditable(e) {
    var t;
    this.editable !== e &&
      ((this.editable = e),
      this.view.setProps({}),
      this.root.classList.toggle('nova-readonly', !e),
      e || this.ui.closePopover(),
      (t = this.toolbar) == null || t.update(),
      this.emit('editableChange'));
  }
  on(e, t) {
    let n = this.listeners.get(e);
    return (n || this.listeners.set(e, (n = new Set())), n.add(t), () => this.off(e, t));
  }
  off(e, t) {
    var n;
    (n = this.listeners.get(e)) == null || n.delete(t);
  }
  emit(e) {
    for (const t of this.listeners.get(e) ?? []) t(this);
  }
  destroy() {
    var e, t, n;
    if (!this.destroyed) {
      (this.emit('destroy'),
        (this.destroyed = !0),
        (e = this.menubar) == null || e.destroy(),
        this.ui.destroy(),
        (t = this.toolbar) == null || t.destroy(),
        (n = this.statusbar) == null || n.destroy());
      for (const i of this.cleanups.splice(0))
        try {
          i();
        } catch (o) {
          Ze('Plugin cleanup failed', o);
        }
      (this.searchBar.destroy(),
        this.root.classList.contains('nova-fullscreen') && Xr(this, !1),
        this.view.destroy(),
        this.root.remove(),
        this.listeners.clear());
    }
  }
}
function Ze(r, e) {
  console.error(`[nova] ${r}`, ...(e === void 0 ? [] : [e]));
}
function is(r) {
  if (typeof r != 'string') return _e.fromJSON(R, r);
  const e = document.createElement('div'),
    t = document.createElement('template');
  return ((t.innerHTML = r), e.appendChild(t.content), ea.parse(e));
}
function em(r) {
  return new Qp(r);
}
export { em as c };
