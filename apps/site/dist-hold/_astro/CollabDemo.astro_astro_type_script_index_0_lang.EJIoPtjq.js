import { a as e, i as t, n } from './style.jq9nI6HT.js';
import { C as r, a as i, c as a, i as o, k as s, r as c, t as l } from './dist.DtV7jSsK.js';
import { t as u } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import { O as d, k as f } from './chunk-N3URGMQ5.BakyJphD.js';
var p = Math.floor,
  ee = Math.abs,
  m = (e, t) => (e < t ? e : t),
  h = (e, t) => (e > t ? e : t);
Number.isNaN;
var te = (e) => (e === 0 ? 1 / e < 0 : e < 0),
  ne = 1 << 29,
  re = 2 ** 53 - 1,
  ie = -(2 ** 53 - 1),
  ae = Number.isInteger || ((e) => typeof e == `number` && isFinite(e) && p(e) === e);
(Number.isNaN, Number.parseInt);
var oe = () => new Set(),
  se = (e) => e[e.length - 1],
  ce = (e, t) => {
    for (let n = 0; n < t.length; n++) e.push(t[n]);
  },
  g = Array.from,
  le = (e, t) => {
    for (let n = 0; n < e.length; n++) if (!t(e[n], n, e)) return !1;
    return !0;
  },
  ue = (e, t) => {
    for (let n = 0; n < e.length; n++) if (t(e[n], n, e)) return !0;
    return !1;
  },
  de = (e, t) => {
    let n = Array(e);
    for (let r = 0; r < e; r++) n[r] = t(r, n);
    return n;
  },
  fe = Array.isArray,
  pe = String.fromCharCode;
(String.fromCodePoint, pe(65535));
var me = (e) => e.toLowerCase(),
  he = /^\s*/g,
  ge = (e) => e.replace(he, ``),
  _e = /([A-Z])/g,
  ve = (e, t) => ge(e.replace(_e, (e) => `${t}${me(e)}`)),
  ye = (e) => {
    let t = unescape(encodeURIComponent(e)),
      n = t.length,
      r = new Uint8Array(n);
    for (let e = 0; e < n; e++) r[e] = t.codePointAt(e);
    return r;
  },
  be = typeof TextEncoder < `u` ? new TextEncoder() : null,
  xe = be ? (e) => be.encode(e) : ye,
  Se = typeof TextDecoder > `u` ? null : new TextDecoder(`utf-8`, { fatal: !0, ignoreBOM: !0 });
Se && Se.decode(new Uint8Array()).length === 1 && (Se = null);
var Ce = (e, t) => de(t, () => e).join(``),
  we = class {
    constructor() {
      ((this.cpos = 0), (this.cbuf = new Uint8Array(100)), (this.bufs = []));
    }
  },
  _ = () => new we(),
  Te = (e) => {
    let t = _();
    return (e(t), v(t));
  },
  Ee = (e) => {
    let t = e.cpos;
    for (let n = 0; n < e.bufs.length; n++) t += e.bufs[n].length;
    return t;
  },
  v = (e) => {
    let t = new Uint8Array(Ee(e)),
      n = 0;
    for (let r = 0; r < e.bufs.length; r++) {
      let i = e.bufs[r];
      (t.set(i, n), (n += i.length));
    }
    return (t.set(new Uint8Array(e.cbuf.buffer, 0, e.cpos), n), t);
  },
  De = (e, t) => {
    let n = e.cbuf.length;
    n - e.cpos < t &&
      (e.bufs.push(new Uint8Array(e.cbuf.buffer, 0, e.cpos)),
      (e.cbuf = new Uint8Array(h(n, t) * 2)),
      (e.cpos = 0));
  },
  y = (e, t) => {
    let n = e.cbuf.length;
    (e.cpos === n && (e.bufs.push(e.cbuf), (e.cbuf = new Uint8Array(n * 2)), (e.cpos = 0)),
      (e.cbuf[e.cpos++] = t));
  },
  Oe = y,
  b = (e, t) => {
    for (; t > 127;) (y(e, 128 | (127 & t)), (t = p(t / 128)));
    y(e, 127 & t);
  },
  ke = (e, t) => {
    let n = te(t);
    for (n && (t = -t), y(e, (t > 63 ? 128 : 0) | (n ? 64 : 0) | (63 & t)), t = p(t / 64); t > 0;)
      (y(e, (t > 127 ? 128 : 0) | (127 & t)), (t = p(t / 128)));
  },
  Ae = new Uint8Array(3e4),
  je = Ae.length / 3,
  x =
    be && be.encodeInto
      ? (e, t) => {
          if (t.length < je) {
            let n = be.encodeInto(t, Ae).written || 0;
            b(e, n);
            for (let t = 0; t < n; t++) y(e, Ae[t]);
          } else S(e, xe(t));
        }
      : (e, t) => {
          let n = unescape(encodeURIComponent(t)),
            r = n.length;
          b(e, r);
          for (let t = 0; t < r; t++) y(e, n.codePointAt(t));
        },
  Me = (e, t) => {
    let n = e.cbuf.length,
      r = e.cpos,
      i = m(n - r, t.length),
      a = t.length - i;
    (e.cbuf.set(t.subarray(0, i), r),
      (e.cpos += i),
      a > 0 &&
        (e.bufs.push(e.cbuf),
        (e.cbuf = new Uint8Array(h(n * 2, a))),
        e.cbuf.set(t.subarray(i)),
        (e.cpos = a)));
  },
  S = (e, t) => {
    (b(e, t.byteLength), Me(e, t));
  },
  Ne = (e, t) => {
    De(e, t);
    let n = new DataView(e.cbuf.buffer, e.cpos, t);
    return ((e.cpos += t), n);
  },
  Pe = (e, t) => Ne(e, 4).setFloat32(0, t, !1),
  Fe = (e, t) => Ne(e, 8).setFloat64(0, t, !1),
  Ie = (e, t) => Ne(e, 8).setBigInt64(0, t, !1),
  Le = new DataView(new ArrayBuffer(4)),
  Re = (e) => (Le.setFloat32(0, e), Le.getFloat32(0) === e),
  ze = (e, t) => {
    switch (typeof t) {
      case `string`:
        (y(e, 119), x(e, t));
        break;
      case `number`:
        ae(t) && ee(t) <= 2147483647
          ? (y(e, 125), ke(e, t))
          : Re(t)
            ? (y(e, 124), Pe(e, t))
            : (y(e, 123), Fe(e, t));
        break;
      case `bigint`:
        (y(e, 122), Ie(e, t));
        break;
      case `object`:
        if (t === null) y(e, 126);
        else if (fe(t)) {
          (y(e, 117), b(e, t.length));
          for (let n = 0; n < t.length; n++) ze(e, t[n]);
        } else if (t instanceof Uint8Array) (y(e, 116), S(e, t));
        else {
          y(e, 118);
          let n = Object.keys(t);
          b(e, n.length);
          for (let r = 0; r < n.length; r++) {
            let i = n[r];
            (x(e, i), ze(e, t[i]));
          }
        }
        break;
      case `boolean`:
        y(e, t ? 120 : 121);
        break;
      default:
        y(e, 127);
    }
  },
  Be = class extends we {
    constructor(e) {
      (super(), (this.w = e), (this.s = null), (this.count = 0));
    }
    write(e) {
      this.s === e
        ? this.count++
        : (this.count > 0 && b(this, this.count - 1),
          (this.count = 1),
          this.w(this, e),
          (this.s = e));
    }
  },
  Ve = (e) => {
    e.count > 0 &&
      (ke(e.encoder, e.count === 1 ? e.s : -e.s), e.count > 1 && b(e.encoder, e.count - 2));
  },
  He = class {
    constructor() {
      ((this.encoder = new we()), (this.s = 0), (this.count = 0));
    }
    write(e) {
      this.s === e ? this.count++ : (Ve(this), (this.count = 1), (this.s = e));
    }
    toUint8Array() {
      return (Ve(this), v(this.encoder));
    }
  },
  Ue = (e) => {
    if (e.count > 0) {
      let t = e.diff * 2 + (e.count === 1 ? 0 : 1);
      (ke(e.encoder, t), e.count > 1 && b(e.encoder, e.count - 2));
    }
  },
  We = class {
    constructor() {
      ((this.encoder = new we()), (this.s = 0), (this.count = 0), (this.diff = 0));
    }
    write(e) {
      this.diff === e - this.s
        ? ((this.s = e), this.count++)
        : (Ue(this), (this.count = 1), (this.diff = e - this.s), (this.s = e));
    }
    toUint8Array() {
      return (Ue(this), v(this.encoder));
    }
  },
  Ge = class {
    constructor() {
      ((this.sarr = []), (this.s = ``), (this.lensE = new He()));
    }
    write(e) {
      ((this.s += e),
        this.s.length > 19 && (this.sarr.push(this.s), (this.s = ``)),
        this.lensE.write(e.length));
    }
    toUint8Array() {
      let e = new we();
      return (
        this.sarr.push(this.s),
        (this.s = ``),
        x(e, this.sarr.join(``)),
        Me(e, this.lensE.toUint8Array()),
        v(e)
      );
    }
  },
  C = (e) => Error(e),
  w = () => {
    throw C(`Method unimplemented`);
  },
  T = () => {
    throw C(`Unexpected case`);
  },
  Ke = C(`Unexpected end of array`),
  qe = C(`Integer out of Range`),
  Je = (e, t, n) => {
    if (t < 0 || n < 0 || t + n > e.length) throw Ke;
    return new Uint8Array(e.buffer, e.byteOffset + t, n);
  },
  Ye = (e, t, n) => {
    if (t < 0 || n < 0 || t + n > e.length) throw Ke;
    return new DataView(e.buffer, e.byteOffset + t, n);
  },
  Xe = class {
    constructor(e) {
      ((this.arr = e), (this.pos = 0));
    }
  },
  Ze = (e) => new Xe(e),
  Qe = (e) => e.pos !== e.arr.length,
  $e = (e, t) => {
    let n = Je(e.arr, e.pos, t);
    return ((e.pos += t), n);
  },
  E = (e) => $e(e, D(e)),
  et = (e) => e.arr[e.pos++],
  D = (e) => {
    let t = 0,
      n = 1,
      r = e.arr.length;
    for (; e.pos < r;) {
      let r = e.arr[e.pos++];
      if (((t += (r & 127) * n), (n *= 128), r < 128)) return t;
      if (t > re) throw qe;
    }
    throw Ke;
  },
  tt = (e) => {
    let t = e.arr[e.pos++],
      n = t & 63,
      r = 64,
      i = (t & 64) > 0 ? -1 : 1;
    if (!(t & 128)) return i * n;
    let a = e.arr.length;
    for (; e.pos < a;) {
      if (((t = e.arr[e.pos++]), (n += (t & 127) * r), (r *= 128), t < 128)) return i * n;
      if (n > re) throw qe;
    }
    throw Ke;
  },
  O = Se
    ? (e) => Se.decode(E(e))
    : (e) => {
        let t = D(e);
        if (t === 0) return ``;
        {
          let n = String.fromCodePoint(et(e));
          if (--t < 100) for (; t--;) n += String.fromCodePoint(et(e));
          else
            for (; t > 0;) {
              let r = t < 1e4 ? t : 1e4,
                i = e.arr.subarray(e.pos, e.pos + r);
              ((e.pos += r), (n += String.fromCodePoint.apply(null, i)), (t -= r));
            }
          return decodeURIComponent(escape(n));
        }
      },
  nt = (e) => {
    let t = e.pos,
      n = O(e);
    return ((e.pos = t), n);
  },
  rt = (e, t) => {
    let n = Ye(e.arr, e.pos, t);
    return ((e.pos += t), n);
  },
  it = [
    (e) => void 0,
    (e) => null,
    tt,
    (e) => rt(e, 4).getFloat32(0, !1),
    (e) => rt(e, 8).getFloat64(0, !1),
    (e) => rt(e, 8).getBigInt64(0, !1),
    (e) => !1,
    (e) => !0,
    O,
    (e) => {
      let t = D(e),
        n = {};
      for (let r = 0; r < t; r++) {
        let t = O(e);
        n[t] = at(e);
      }
      return n;
    },
    (e) => {
      let t = D(e),
        n = [];
      for (let r = 0; r < t; r++) n.push(at(e));
      return n;
    },
    E,
  ],
  at = (e) => it[127 - et(e)](e),
  ot = class extends Xe {
    constructor(e, t) {
      (super(e), (this.reader = t), (this.s = null), (this.count = 0));
    }
    read() {
      return (
        this.count === 0 &&
          ((this.s = this.reader(this)), (this.count = Qe(this) ? D(this) + 1 : -1)),
        this.count--,
        this.s
      );
    }
  },
  st = class extends Xe {
    constructor(e) {
      (super(e), (this.s = 0), (this.count = 0));
    }
    read() {
      if (this.count === 0) {
        this.s = tt(this);
        let e = te(this.s);
        ((this.count = 1), e && ((this.s = -this.s), (this.count = D(this) + 2)));
      }
      return (this.count--, this.s);
    }
  },
  ct = class extends Xe {
    constructor(e) {
      (super(e), (this.s = 0), (this.count = 0), (this.diff = 0));
    }
    read() {
      if (this.count === 0) {
        let e = tt(this),
          t = e & 1;
        ((this.diff = p(e / 2)), (this.count = 1), t && (this.count = D(this) + 2));
      }
      return ((this.s += this.diff), this.count--, this.s);
    }
  },
  lt = class {
    constructor(e) {
      ((this.decoder = new st(e)), (this.str = O(this.decoder)), (this.spos = 0));
    }
    read() {
      let e = this.spos + this.decoder.read(),
        t = this.str.slice(this.spos, e);
      return ((this.spos = e), t);
    }
  },
  ut = (function (e) {
    return (
      (e[(e.Token = 0)] = `Token`),
      (e[(e.PermissionDenied = 1)] = `PermissionDenied`),
      (e[(e.Authenticated = 2)] = `Authenticated`),
      e
    );
  })({}),
  dt = (e, t) => {
    (b(e, ut.Token), x(e, t));
  },
  ft = (e, t, n, r) => {
    switch (D(e)) {
      case ut.Token:
        t();
        break;
      case ut.PermissionDenied:
        n(O(e));
        break;
      case ut.Authenticated:
        r(O(e));
    }
  },
  pt = (e) => Array.from(e.entries()).map(([e, t]) => ({ clientId: e, ...t })),
  mt = `\0`;
function ht(e, t) {
  return e + mt + t;
}
function gt(e) {
  let t = e.indexOf(mt);
  return t === -1
    ? { documentName: e, sessionId: null }
    : { documentName: e.substring(0, t), sessionId: e.substring(t + 1) };
}
var _t = (function (e) {
    return (
      (e[(e.Connecting = 0)] = `Connecting`),
      (e[(e.Open = 1)] = `Open`),
      (e[(e.Closing = 2)] = `Closing`),
      (e[(e.Closed = 3)] = `Closed`),
      e
    );
  })({}),
  vt = Date.now,
  k = () => new Map(),
  yt = (e) => {
    let t = k();
    return (
      e.forEach((e, n) => {
        t.set(n, e);
      }),
      t
    );
  },
  A = (e, t, n) => {
    let r = e.get(t);
    return (r === void 0 && e.set(t, (r = n())), r);
  },
  bt = (e, t) => {
    let n = [];
    for (let [r, i] of e) n.push(t(i, r));
    return n;
  },
  xt = (e, t) => {
    for (let [n, r] of e) if (t(r, n)) return !0;
    return !1;
  },
  St = class {
    constructor() {
      this._observers = k();
    }
    on(e, t) {
      return (A(this._observers, e, oe).add(t), t);
    }
    once(e, t) {
      let n = (...r) => {
        (this.off(e, n), t(...r));
      };
      this.on(e, n);
    }
    off(e, t) {
      let n = this._observers.get(e);
      n !== void 0 && (n.delete(t), n.size === 0 && this._observers.delete(e));
    }
    emit(e, t) {
      return g((this._observers.get(e) || k()).values()).forEach((e) => e(...t));
    }
    destroy() {
      this._observers = k();
    }
  },
  Ct = class {
    constructor() {
      this._observers = k();
    }
    on(e, t) {
      A(this._observers, e, oe).add(t);
    }
    once(e, t) {
      let n = (...r) => {
        (this.off(e, n), t(...r));
      };
      this.on(e, n);
    }
    off(e, t) {
      let n = this._observers.get(e);
      n !== void 0 && (n.delete(t), n.size === 0 && this._observers.delete(e));
    }
    emit(e, t) {
      return g((this._observers.get(e) || k()).values()).forEach((e) => e(...t));
    }
    destroy() {
      this._observers = k();
    }
  },
  wt = Symbol(`Equality`),
  Tt = (e, t) => e === t || !!e?.[wt]?.(t) || !1,
  Et = (e) => typeof e == `object`,
  Dt = Object.assign,
  Ot = Object.keys,
  kt = (e, t) => {
    for (let n in e) t(e[n], n);
  },
  At = (e) => Ot(e).length,
  jt = (e) => {
    for (let t in e) return !1;
    return !0;
  },
  Mt = (e, t) => {
    for (let n in e) if (!t(e[n], n)) return !1;
    return !0;
  },
  Nt = (e, t) => Object.prototype.hasOwnProperty.call(e, t),
  Pt = (e, t) =>
    e === t || (At(e) === At(t) && Mt(e, (e, n) => (e !== void 0 || Nt(t, n)) && Tt(t[n], e))),
  Ft = Object.freeze,
  It = (e) => {
    for (let t in e) {
      let n = e[t];
      (typeof n == `object` || typeof n == `function`) && It(e[t]);
    }
    return Ft(e);
  },
  Lt = (e, t, n = 0) => {
    try {
      for (; n < e.length; n++) e[n](...t);
    } finally {
      n < e.length && Lt(e, t, n + 1);
    }
  },
  Rt = (e) => e,
  zt = (e, t) => {
    if (e === t) return !0;
    if (
      e == null ||
      t == null ||
      (e.constructor !== t.constructor && (e.constructor || Object) !== (t.constructor || Object))
    )
      return !1;
    if (e[wt] != null) return e[wt](t);
    switch (e.constructor) {
      case ArrayBuffer:
        ((e = new Uint8Array(e)), (t = new Uint8Array(t)));
      case Uint8Array:
        if (e.byteLength !== t.byteLength) return !1;
        for (let n = 0; n < e.length; n++) if (e[n] !== t[n]) return !1;
        break;
      case Set:
        if (e.size !== t.size) return !1;
        for (let n of e) if (!t.has(n)) return !1;
        break;
      case Map:
        if (e.size !== t.size) return !1;
        for (let n of e.keys()) if (!t.has(n) || !zt(e.get(n), t.get(n))) return !1;
        break;
      case void 0:
      case Object:
        if (At(e) !== At(t)) return !1;
        for (let n in e) if (!Nt(e, n) || !zt(e[n], t[n])) return !1;
        break;
      case Array:
        if (e.length !== t.length) return !1;
        for (let n = 0; n < e.length; n++) if (!zt(e[n], t[n])) return !1;
        break;
      default:
        return !1;
    }
    return !0;
  },
  Bt = (e, t) => t.includes(e);
crypto.subtle;
var Vt = crypto.getRandomValues.bind(crypto),
  Ht = Math.random,
  Ut = () => Vt(new Uint32Array(1))[0],
  Wt = (e) => e[p(Ht() * e.length)],
  Gt = `10000000-1000-4000-8000-100000000000`,
  Kt = () => Gt.replace(/[018]/g, (e) => (e ^ (Ut() & (15 >> (e / 4)))).toString(16)),
  qt = (e) => new Promise(e);
Promise.all.bind(Promise);
var Jt = (e) => (e === void 0 ? null : e),
  Yt = new (class {
    constructor() {
      this.map = new Map();
    }
    setItem(e, t) {
      this.map.set(e, t);
    }
    getItem(e) {
      return this.map.get(e);
    }
  })();
try {
  typeof window < `u` && typeof localStorage < `u` && localStorage && (Yt = localStorage);
} catch {}
var Xt = Yt,
  Zt =
    typeof process < `u` &&
    process.release &&
    /node|io\.js/.test(process.release.name) &&
    Object.prototype.toString.call(typeof process < `u` ? process : 0) === `[object process]`,
  Qt = typeof window < `u` && typeof document < `u` && !Zt;
typeof navigator < `u` && /Mac/.test(navigator.platform);
var j,
  $t = [],
  en = () => {
    if (j === void 0) {
      if (Zt) {
        j = k();
        let e = process.argv,
          t = null;
        for (let n = 0; n < e.length; n++) {
          let r = e[n];
          r[0] === `-`
            ? (t !== null && j.set(t, ``), (t = r))
            : t === null
              ? $t.push(r)
              : (j.set(t, r), (t = null));
        }
        t !== null && j.set(t, ``);
      } else
        typeof location == `object`
          ? ((j = k()),
            (location.search || `?`)
              .slice(1)
              .split(`&`)
              .forEach((e) => {
                if (e.length !== 0) {
                  let [t, n] = e.split(`=`);
                  (j.set(`--${ve(t, `-`)}`, n), j.set(`-${ve(t, `-`)}`, n));
                }
              }))
          : (j = k());
    }
    return j;
  },
  tn = (e) => en().has(e),
  nn = (e) => Jt(Zt ? {}[e.toUpperCase().replaceAll(`-`, `_`)] : Xt.getItem(e)),
  rn = (e) => tn(`--` + e) || nn(e) !== null,
  an = rn(`production`),
  on =
    (Zt && Bt({}.FORCE_COLOR, [`true`, `1`, `2`])) ||
    (!tn(`--no-colors`) &&
      !rn(`no-color`) &&
      (!Zt || process.stdout.isTTY) &&
      (!Zt || tn(`--color`) || nn(`COLORTERM`) !== null || (nn(`TERM`) || ``).includes(`color`))),
  sn = (e) => new Uint8Array(e),
  cn = Qt
    ? (e) => {
        let t = ``;
        for (let n = 0; n < e.byteLength; n++) t += pe(e[n]);
        return btoa(t);
      }
    : (e) => Buffer.from(e.buffer, e.byteOffset, e.byteLength).toString(`base64`),
  ln = (e) => {
    let t = sn(e.byteLength);
    return (t.set(e), t);
  },
  un = (e) => Te((t) => ze(t, e)),
  dn = class {
    constructor(e, t) {
      ((this.left = e), (this.right = t));
    }
  },
  fn = (e, t) => new dn(e, t),
  pn = (e) => e.next() >= 0.5,
  mn = (e, t, n) => p(e.next() * (n + 1 - t) + t),
  hn = (e, t, n) => p(e.next() * (n + 1 - t) + t),
  gn = (e, t, n) => hn(e, t, n),
  _n = (e) => pe(gn(e, 97, 122)),
  vn = (e, t = 0, n = 20) => {
    let r = gn(e, t, n),
      i = ``;
    for (let t = 0; t < r; t++) i += _n(e);
    return i;
  },
  yn = (e, t) => t[gn(e, 0, t.length - 1)],
  bn = Symbol(`0schema`),
  xn = class {
    constructor() {
      this._rerrs = [];
    }
    extend(e, t, n, r = null) {
      this._rerrs.push({ path: e, expected: t, has: n, message: r });
    }
    toString() {
      let e = [];
      for (let t = this._rerrs.length - 1; t > 0; t--) {
        let n = this._rerrs[t];
        e.push(
          Ce(` `, (this._rerrs.length - t) * 2) +
            `${n.path == null ? `` : `[${n.path}] `}${n.has} doesn't match ${n.expected}. ${n.message}`,
        );
      }
      return e.join(`
`);
    }
  },
  Sn = (e, t) =>
    e === t
      ? !0
      : e == null || t == null || e.constructor !== t.constructor
        ? !1
        : e[wt]
          ? Tt(e, t)
          : fe(e)
            ? le(e, (e) => ue(t, (t) => Sn(e, t)))
            : Et(e)
              ? Mt(e, (e, n) => Sn(e, t[n]))
              : !1,
  M = class {
    static _dilutes = !1;
    extends(e) {
      let [t, n] = [this.shape, e.shape];
      return (this.constructor._dilutes && ([n, t] = [t, n]), Sn(t, n));
    }
    equals(e) {
      return this.constructor === e.constructor && zt(this.shape, e.shape);
    }
    [bn]() {
      return !0;
    }
    [wt](e) {
      return this.equals(e);
    }
    validate(e) {
      return this.check(e);
    }
    check(e, t) {
      w();
    }
    get nullable() {
      return $n(this, mr);
    }
    get optional() {
      return new jn(this);
    }
    cast(e) {
      return (vr(e, this), e);
    }
    expect(e) {
      return (vr(e, this), e);
    }
  },
  Cn = class extends M {
    constructor(e, t) {
      (super(), (this.shape = e), (this._c = t));
    }
    check(e, t = void 0) {
      let n = e?.constructor === this.shape && (this._c == null || this._c(e));
      return (
        !n &&
          t?.extend(
            null,
            this.shape.name,
            e?.constructor.name,
            e?.constructor === this.shape ? `Check failed` : `Constructor match failed`,
          ),
        n
      );
    }
  },
  N = (e, t = null) => new Cn(e, t);
N(Cn);
var wn = class extends M {
    constructor(e) {
      (super(), (this.shape = e));
    }
    check(e, t) {
      let n = this.shape(e);
      return (
        !n && t?.extend(null, `custom prop`, e?.constructor.name, `failed to check custom prop`),
        n
      );
    }
  },
  P = (e) => new wn(e);
N(wn);
var Tn = class extends M {
    constructor(e) {
      (super(), (this.shape = e));
    }
    check(e, t) {
      let n = this.shape.some((t) => t === e);
      return (!n && t?.extend(null, this.shape.join(` | `), e.toString()), n);
    }
  },
  En = (...e) => new Tn(e),
  Dn = N(Tn),
  On = RegExp.escape || ((e) => e.replace(/[().|&,$^[\]]/g, (e) => `\\` + e)),
  kn = (e) => {
    if (lr.check(e)) return [On(e)];
    if (Dn.check(e)) return e.shape.map((e) => e + ``);
    if (cr.check(e)) return [`[+-]?\\d+.?\\d*`];
    if (ur.check(e)) return [`.*`];
    if (er.check(e)) return e.shape.map(kn).flat(1);
    T();
  };
N(
  class extends M {
    constructor(e) {
      (super(),
        (this.shape = e),
        (this._r = RegExp(
          `^` +
            e
              .map(kn)
              .map((e) => `(${e.join(`|`)})`)
              .join(``) +
            `$`,
        )));
    }
    check(e, t) {
      let n = this._r.exec(e) != null;
      return (
        !n &&
          t?.extend(
            null,
            this._r.toString(),
            e.toString(),
            `String doesn't match string template.`,
          ),
        n
      );
    }
  },
);
var An = Symbol(`optional`),
  jn = class extends M {
    constructor(e) {
      (super(), (this.shape = e));
    }
    check(e, t) {
      let n = e === void 0 || this.shape.check(e);
      return (!n && t?.extend(null, `undefined (optional)`, `()`), n);
    }
    get [An]() {
      return !0;
    }
  },
  Mn = N(jn),
  Nn = class extends M {
    check(e, t) {
      return (t?.extend(null, `never`, typeof e), !1);
    }
  };
(new Nn(), N(Nn));
var Pn = class e extends M {
    constructor(e, t = !1) {
      (super(), (this.shape = e), (this._isPartial = t));
    }
    static _dilutes = !0;
    get partial() {
      return new e(this.shape, !0);
    }
    check(e, t) {
      return e == null
        ? (t?.extend(null, `object`, `null`), !1)
        : Mt(this.shape, (n, r) => {
            let i = (this._isPartial && !Nt(e, r)) || n.check(e[r], t);
            return (
              !i &&
                t?.extend(
                  r.toString(),
                  n.toString(),
                  typeof e[r],
                  `Object property does not match`,
                ),
              i
            );
          });
    }
  },
  Fn = (e) => new Pn(e),
  In = N(Pn),
  Ln = P((e) => e != null && (e.constructor === Object || e.constructor == null)),
  Rn = class extends M {
    constructor(e, t) {
      (super(), (this.shape = { keys: e, values: t }));
    }
    check(e, t) {
      return (
        e != null &&
        Mt(e, (n, r) => {
          let i = this.shape.keys.check(r, t);
          return (
            !i &&
              t?.extend(
                r + ``,
                `Record`,
                typeof e,
                i ? `Key doesn't match schema` : `Value doesn't match value`,
              ),
            i && this.shape.values.check(n, t)
          );
        })
      );
    }
  },
  zn = (e, t) => new Rn(e, t),
  Bn = N(Rn),
  Vn = class extends M {
    constructor(e) {
      (super(), (this.shape = e));
    }
    check(e, t) {
      return (
        e != null &&
        Mt(this.shape, (n, r) => {
          let i = n.check(e[r], t);
          return (!i && t?.extend(r.toString(), `Tuple`, typeof n), i);
        })
      );
    }
  },
  Hn = (...e) => new Vn(e);
N(Vn);
var Un = class extends M {
    constructor(e) {
      (super(), (this.shape = e.length === 1 ? e[0] : new Qn(e)));
    }
    check(e, t) {
      let n = fe(e) && le(e, (e) => this.shape.check(e));
      return (!n && t?.extend(null, `Array`, ``), n);
    }
  },
  Wn = (...e) => new Un(e),
  Gn = N(Un),
  Kn = P((e) => fe(e)),
  qn = class extends M {
    constructor(e, t) {
      (super(), (this.shape = e), (this._c = t));
    }
    check(e, t) {
      let n = e instanceof this.shape && (this._c == null || this._c(e));
      return (!n && t?.extend(null, this.shape.name, e?.constructor.name), n);
    }
  },
  Jn = (e, t = null) => new qn(e, t);
N(qn);
var Yn = Jn(M),
  Xn = N(
    class extends M {
      constructor(e) {
        (super(),
          (this.len = e.length - 1),
          (this.args = Hn(...e.slice(-1))),
          (this.res = e[this.len]));
      }
      check(e, t) {
        let n = e.constructor === Function && e.length <= this.len;
        return (!n && t?.extend(null, `function`, typeof e), n);
      }
    },
  ),
  Zn = P((e) => typeof e == `function`);
N(
  class extends M {
    constructor(e) {
      (super(), (this.shape = e));
    }
    check(e, t) {
      let n = le(this.shape, (n) => n.check(e, t));
      return (!n && t?.extend(null, `Intersectinon`, typeof e), n);
    }
  },
  (e) => e.shape.length > 0,
);
var Qn = class extends M {
    static _dilutes = !0;
    constructor(e) {
      (super(), (this.shape = e));
    }
    check(e, t) {
      let n = ue(this.shape, (n) => n.check(e, t));
      return (t?.extend(null, `Union`, typeof e), n);
    }
  },
  $n = (...e) =>
    e.findIndex((e) => er.check(e)) >= 0
      ? $n(
          ...e
            .map((e) => _r(e))
            .map((e) => (er.check(e) ? e.shape : [e]))
            .flat(1),
        )
      : e.length === 1
        ? e[0]
        : new Qn(e),
  er = N(Qn),
  tr = () => !0,
  nr = P(tr),
  rr = N(wn, (e) => e.shape === tr),
  ir = P((e) => typeof e == `bigint`),
  ar = P((e) => e === ir),
  or = P((e) => typeof e == `symbol`);
P((e) => e === or);
var sr = P((e) => typeof e == `number`),
  cr = P((e) => e === sr),
  lr = P((e) => typeof e == `string`),
  ur = P((e) => e === lr),
  dr = P((e) => typeof e == `boolean`),
  fr = P((e) => e === dr),
  pr = En(void 0);
(N(Tn, (e) => e.shape.length === 1 && e.shape[0] === void 0), En(void 0));
var mr = En(null),
  hr = N(Tn, (e) => e.shape.length === 1 && e.shape[0] === null);
(N(Uint8Array), N(Cn, (e) => e.shape === Uint8Array));
var gr = $n(sr, lr, mr, pr, ir, dr, or);
(() => {
  let e = Wn(nr),
    t = zn(lr, nr),
    n = $n(sr, lr, mr, dr, e, t);
  return ((e.shape = n), (t.shape.values = n), n);
})();
var _r = (e) => {
    if (Yn.check(e)) return e;
    if (Ln.check(e)) {
      let t = {};
      for (let n in e) t[n] = _r(e[n]);
      return Fn(t);
    }
    if (Kn.check(e)) return $n(...e.map(_r));
    if (gr.check(e)) return En(e);
    if (Zn.check(e)) return N(e);
    T();
  },
  vr = an
    ? () => {}
    : (e, t) => {
        let n = new xn();
        if (!t.check(e, n))
          throw C(`Expected value to be of type ${t.constructor.name}.\n${n.toString()}`);
      },
  yr = class {
    constructor(e) {
      ((this.patterns = []), (this.$state = e));
    }
    if(e, t) {
      return (this.patterns.push({ if: _r(e), h: t }), this);
    }
    else(e) {
      return this.if(nr, e);
    }
    done() {
      return (e, t) => {
        for (let n = 0; n < this.patterns.length; n++) {
          let r = this.patterns[n];
          if (r.if.check(e)) return r.h(e, t);
        }
        throw C(`Unhandled pattern`);
      };
    }
  },
  br = ((e) => new yr(e))(nr)
    .if(cr, (e, t) => mn(t, ie, re))
    .if(ur, (e, t) => vn(t))
    .if(fr, (e, t) => pn(t))
    .if(ar, (e, t) => BigInt(mn(t, ie, re)))
    .if(er, (e, t) => xr(t, yn(t, e.shape)))
    .if(In, (e, t) => {
      let n = {};
      for (let r in e.shape) {
        let i = e.shape[r];
        if (Mn.check(i)) {
          if (pn(t)) continue;
          i = i.shape;
        }
        n[r] = br(i, t);
      }
      return n;
    })
    .if(Gn, (e, t) => {
      let n = [],
        r = hn(t, 0, 42);
      for (let i = 0; i < r; i++) n.push(xr(t, e.shape));
      return n;
    })
    .if(Dn, (e, t) => yn(t, e.shape))
    .if(hr, (e, t) => null)
    .if(Xn, (e, t) => {
      let n = xr(t, e.res);
      return () => n;
    })
    .if(rr, (e, t) => xr(t, yn(t, [sr, lr, mr, pr, ir, dr, Wn(sr), zn($n(`a`, `b`, `c`), sr)])))
    .if(Bn, (e, t) => {
      let n = {},
        r = mn(t, 0, 3);
      for (let i = 0; i < r; i++) {
        let r = xr(t, e.shape.keys);
        n[r] = xr(t, e.shape.values);
      }
      return n;
    })
    .done(),
  xr = (e, t) => br(_r(t), e),
  Sr = typeof document < `u` ? document : {};
(P((e) => e.nodeType === Dr),
  typeof DOMParser < `u` && new DOMParser(),
  P((e) => e.nodeType === wr),
  P((e) => e.nodeType === Tr));
var Cr = (e) => bt(e, (e, t) => `${t}:${e};`).join(``),
  wr = Sr.ELEMENT_NODE,
  Tr = Sr.TEXT_NODE;
(Sr.CDATA_SECTION_NODE, Sr.COMMENT_NODE);
var Er = Sr.DOCUMENT_NODE;
Sr.DOCUMENT_TYPE_NODE;
var Dr = Sr.DOCUMENT_FRAGMENT_NODE;
P((e) => e.nodeType === Er);
var Or = ((e) =>
    class {
      constructor(e) {
        this._ = e;
      }
      destroy() {
        e(this._);
      }
    })(clearTimeout),
  kr = (e, t) => new Or(setTimeout(t, e)),
  F = Symbol,
  Ar = F(),
  jr = F(),
  Mr = F(),
  Nr = F(),
  Pr = F(),
  Fr = F(),
  Ir = F(),
  Lr = F(),
  Rr = F(),
  zr = (e) => {
    e.length === 1 && e[0]?.constructor === Function && (e = e[0]());
    let t = [],
      n = [],
      r = 0;
    for (; r < e.length; r++) {
      let n = e[r];
      if (n === void 0) break;
      if (n.constructor === String || n.constructor === Number) t.push(n);
      else if (n.constructor === Object) break;
    }
    for (r > 0 && n.push(t.join(``)); r < e.length; r++) {
      let t = e[r];
      t instanceof Symbol || n.push(t);
    }
    return n;
  };
vt();
var Br = {
    [Ar]: fn(`font-weight`, `bold`),
    [jr]: fn(`font-weight`, `normal`),
    [Mr]: fn(`color`, `blue`),
    [Pr]: fn(`color`, `green`),
    [Nr]: fn(`color`, `grey`),
    [Fr]: fn(`color`, `red`),
    [Ir]: fn(`color`, `purple`),
    [Lr]: fn(`color`, `orange`),
    [Rr]: fn(`color`, `black`),
  },
  Vr = on
    ? (e) => {
        e.length === 1 && e[0]?.constructor === Function && (e = e[0]());
        let t = [],
          n = [],
          r = k(),
          i = [],
          a = 0;
        for (; a < e.length; a++) {
          let i = e[a],
            o = Br[i];
          if (o !== void 0) r.set(o.left, o.right);
          else {
            if (i === void 0) break;
            if (i.constructor === String || i.constructor === Number) {
              let e = Cr(r);
              a > 0 || e.length > 0 ? (t.push(`%c` + i), n.push(e)) : t.push(i);
            } else break;
          }
        }
        for (a > 0 && ((i = n), i.unshift(t.join(``))); a < e.length; a++) {
          let t = e[a];
          t instanceof Symbol || i.push(t);
        }
        return i;
      }
    : zr,
  Hr = (...e) => {
    (console.log(...Vr(e)), Wr.forEach((t) => t.print(e)));
  },
  Ur = (...e) => {
    (console.warn(...Vr(e)), e.unshift(Lr), Wr.forEach((t) => t.print(e)));
  },
  Wr = oe(),
  Gr = (e) => ({
    [Symbol.iterator]() {
      return this;
    },
    next: e,
  }),
  Kr = (e, t) =>
    Gr(() => {
      let n;
      do n = e.next();
      while (!n.done && !t(n.value));
      return n;
    }),
  qr = (e, t) =>
    Gr(() => {
      let { done: n, value: r } = e.next();
      return { done: n, value: n ? void 0 : t(r) };
    }),
  Jr = class {
    constructor(e, t) {
      ((this.clock = e), (this.len = t));
    }
  },
  Yr = class {
    constructor() {
      this.clients = new Map();
    }
  },
  Xr = (e, t, n) =>
    t.clients.forEach((t, r) => {
      let i = e.doc.store.clients.get(r);
      if (i != null) {
        let r = i[i.length - 1],
          a = r.id.clock + r.length;
        for (let r = 0, o = t[r]; r < t.length && o.clock < a; o = t[++r])
          ua(e, i, o.clock, o.len, n);
      }
    }),
  Zr = (e, t) => {
    let n = 0,
      r = e.length - 1;
    for (; n <= r;) {
      let i = p((n + r) / 2),
        a = e[i],
        o = a.clock;
      if (o <= t) {
        if (t < o + a.len) return i;
        n = i + 1;
      } else r = i - 1;
    }
    return null;
  },
  Qr = (e, t) => {
    let n = e.clients.get(t.client);
    return n !== void 0 && Zr(n, t.clock) !== null;
  },
  $r = (e) => {
    e.clients.forEach((e) => {
      e.sort((e, t) => e.clock - t.clock);
      let t, n;
      for (t = 1, n = 1; t < e.length; t++) {
        let r = e[n - 1],
          i = e[t];
        r.clock + r.len >= i.clock
          ? (e[n - 1] = new Jr(r.clock, h(r.len, i.clock + i.len - r.clock)))
          : (n < t && (e[n] = i), n++);
      }
      e.length = n;
    });
  },
  ei = (e) => {
    let t = new Yr();
    for (let n = 0; n < e.length; n++)
      e[n].clients.forEach((r, i) => {
        if (!t.clients.has(i)) {
          let a = r.slice();
          for (let t = n + 1; t < e.length; t++) ce(a, e[t].clients.get(i) || []);
          t.clients.set(i, a);
        }
      });
    return ($r(t), t);
  },
  ti = (e, t, n, r) => {
    A(e.clients, t, () => []).push(new Jr(n, r));
  },
  ni = () => new Yr(),
  ri = (e) => {
    let t = ni();
    return (
      e.clients.forEach((e, n) => {
        let r = [];
        for (let t = 0; t < e.length; t++) {
          let n = e[t];
          if (n.deleted) {
            let i = n.id.clock,
              a = n.length;
            if (t + 1 < e.length)
              for (let n = e[t + 1]; t + 1 < e.length && n.deleted; n = e[++t + 1]) a += n.length;
            r.push(new Jr(i, a));
          }
        }
        r.length > 0 && t.clients.set(n, r);
      }),
      t
    );
  },
  ii = (e, t) => {
    (b(e.restEncoder, t.clients.size),
      g(t.clients.entries())
        .sort((e, t) => t[0] - e[0])
        .forEach(([t, n]) => {
          (e.resetDsCurVal(), b(e.restEncoder, t));
          let r = n.length;
          b(e.restEncoder, r);
          for (let t = 0; t < r; t++) {
            let r = n[t];
            (e.writeDsClock(r.clock), e.writeDsLen(r.len));
          }
        }));
  },
  ai = (e) => {
    let t = new Yr(),
      n = D(e.restDecoder);
    for (let r = 0; r < n; r++) {
      e.resetDsCurVal();
      let n = D(e.restDecoder),
        r = D(e.restDecoder);
      if (r > 0) {
        let i = A(t.clients, n, () => []);
        for (let t = 0; t < r; t++) i.push(new Jr(e.readDsClock(), e.readDsLen()));
      }
    }
    return t;
  },
  oi = (e, t, n) => {
    let r = new Yr(),
      i = D(e.restDecoder);
    for (let a = 0; a < i; a++) {
      e.resetDsCurVal();
      let i = D(e.restDecoder),
        a = D(e.restDecoder),
        o = n.clients.get(i) || [],
        s = L(n, i);
      for (let n = 0; n < a; n++) {
        let n = e.readDsClock(),
          a = n + e.readDsLen();
        if (n < s) {
          s < a && ti(r, i, s, a - s);
          let e = R(o, n),
            c = o[e];
          for (
            !c.deleted && c.id.clock < n && (o.splice(e + 1, 0, bs(t, c, n - c.id.clock)), e++);
            e < o.length && ((c = o[e++]), c.id.clock < a);
          )
            c.deleted ||
              (a < c.id.clock + c.length && o.splice(e, 0, bs(t, c, a - c.id.clock)), c.delete(t));
        } else ti(r, i, n, a - n);
      }
    }
    if (r.clients.size > 0) {
      let e = new gi();
      return (b(e.restEncoder, 0), ii(e, r), e.toUint8Array());
    }
    return null;
  },
  si = Ut,
  ci = class e extends St {
    constructor({
      guid: e = Kt(),
      collectionid: t = null,
      gc: n = !0,
      gcFilter: r = () => !0,
      meta: i = null,
      autoLoad: a = !1,
      shouldLoad: o = !0,
    } = {}) {
      (super(),
        (this.gc = n),
        (this.gcFilter = r),
        (this.clientID = si()),
        (this.guid = e),
        (this.collectionid = t),
        (this.share = new Map()),
        (this.store = new ra()),
        (this._transaction = null),
        (this._transactionCleanups = []),
        (this.subdocs = new Set()),
        (this._item = null),
        (this.shouldLoad = o),
        (this.autoLoad = a),
        (this.meta = i),
        (this.isLoaded = !1),
        (this.isSynced = !1),
        (this.isDestroyed = !1),
        (this.whenLoaded = qt((e) => {
          this.on(`load`, () => {
            ((this.isLoaded = !0), e(this));
          });
        })));
      let s = () =>
        qt((e) => {
          let t = (n) => {
            (n === void 0 || n === !0) && (this.off(`sync`, t), e());
          };
          this.on(`sync`, t);
        });
      (this.on(`sync`, (e) => {
        (e === !1 && this.isSynced && (this.whenSynced = s()),
          (this.isSynced = e === void 0 || e === !0),
          this.isSynced && !this.isLoaded && this.emit(`load`, [this]));
      }),
        (this.whenSynced = s()));
    }
    load() {
      let e = this._item;
      (e !== null &&
        !this.shouldLoad &&
        B(
          e.parent.doc,
          (e) => {
            e.subdocsLoaded.add(this);
          },
          null,
          !0,
        ),
        (this.shouldLoad = !0));
    }
    getSubdocs() {
      return this.subdocs;
    }
    getSubdocGuids() {
      return new Set(g(this.subdocs).map((e) => e.guid));
    }
    transact(e, t = null) {
      return B(this, e, t);
    }
    get(e, t = H) {
      let n = A(this.share, e, () => {
          let e = new t();
          return (e._integrate(this, null), e);
        }),
        r = n.constructor;
      if (t !== H && r !== t) {
        if (r === H) {
          let r = new t();
          ((r._map = n._map),
            n._map.forEach((e) => {
              for (; e !== null; e = e.left) e.parent = r;
            }),
            (r._start = n._start));
          for (let e = r._start; e !== null; e = e.right) e.parent = r;
          return ((r._length = n._length), this.share.set(e, r), r._integrate(this, null), r);
        }
        throw Error(
          `Type with the name ${e} has already been defined with a different constructor`,
        );
      }
      return n;
    }
    getArray(e = ``) {
      return this.get(e, po);
    }
    getText(e = ``) {
      return this.get(e, Po);
    }
    getMap(e = ``) {
      return this.get(e, go);
    }
    getXmlElement(e = ``) {
      return this.get(e, U);
    }
    getXmlFragment(e = ``) {
      return this.get(e, Lo);
    }
    toJSON() {
      let e = {};
      return (
        this.share.forEach((t, n) => {
          e[n] = t.toJSON();
        }),
        e
      );
    }
    destroy() {
      ((this.isDestroyed = !0), g(this.subdocs).forEach((e) => e.destroy()));
      let t = this._item;
      if (t !== null) {
        this._item = null;
        let n = t.content;
        ((n.doc = new e({ guid: this.guid, ...n.opts, shouldLoad: !1 })),
          (n.doc._item = t),
          B(
            t.parent.doc,
            (e) => {
              let r = n.doc;
              (t.deleted || e.subdocsAdded.add(r), e.subdocsRemoved.add(this));
            },
            null,
            !0,
          ));
      }
      (this.emit(`destroyed`, [!0]), this.emit(`destroy`, [this]), super.destroy());
    }
  },
  li = class {
    constructor(e) {
      this.restDecoder = e;
    }
    resetDsCurVal() {}
    readDsClock() {
      return D(this.restDecoder);
    }
    readDsLen() {
      return D(this.restDecoder);
    }
  },
  ui = class extends li {
    readLeftID() {
      return I(D(this.restDecoder), D(this.restDecoder));
    }
    readRightID() {
      return I(D(this.restDecoder), D(this.restDecoder));
    }
    readClient() {
      return D(this.restDecoder);
    }
    readInfo() {
      return et(this.restDecoder);
    }
    readString() {
      return O(this.restDecoder);
    }
    readParentInfo() {
      return D(this.restDecoder) === 1;
    }
    readTypeRef() {
      return D(this.restDecoder);
    }
    readLen() {
      return D(this.restDecoder);
    }
    readAny() {
      return at(this.restDecoder);
    }
    readBuf() {
      return ln(E(this.restDecoder));
    }
    readJSON() {
      return JSON.parse(O(this.restDecoder));
    }
    readKey() {
      return O(this.restDecoder);
    }
  },
  di = class {
    constructor(e) {
      ((this.dsCurrVal = 0), (this.restDecoder = e));
    }
    resetDsCurVal() {
      this.dsCurrVal = 0;
    }
    readDsClock() {
      return ((this.dsCurrVal += D(this.restDecoder)), this.dsCurrVal);
    }
    readDsLen() {
      let e = D(this.restDecoder) + 1;
      return ((this.dsCurrVal += e), e);
    }
  },
  fi = class extends di {
    constructor(e) {
      (super(e),
        (this.keys = []),
        D(e),
        (this.keyClockDecoder = new ct(E(e))),
        (this.clientDecoder = new st(E(e))),
        (this.leftClockDecoder = new ct(E(e))),
        (this.rightClockDecoder = new ct(E(e))),
        (this.infoDecoder = new ot(E(e), et)),
        (this.stringDecoder = new lt(E(e))),
        (this.parentInfoDecoder = new ot(E(e), et)),
        (this.typeRefDecoder = new st(E(e))),
        (this.lenDecoder = new st(E(e))));
    }
    readLeftID() {
      return new zi(this.clientDecoder.read(), this.leftClockDecoder.read());
    }
    readRightID() {
      return new zi(this.clientDecoder.read(), this.rightClockDecoder.read());
    }
    readClient() {
      return this.clientDecoder.read();
    }
    readInfo() {
      return this.infoDecoder.read();
    }
    readString() {
      return this.stringDecoder.read();
    }
    readParentInfo() {
      return this.parentInfoDecoder.read() === 1;
    }
    readTypeRef() {
      return this.typeRefDecoder.read();
    }
    readLen() {
      return this.lenDecoder.read();
    }
    readAny() {
      return at(this.restDecoder);
    }
    readBuf() {
      return E(this.restDecoder);
    }
    readJSON() {
      return at(this.restDecoder);
    }
    readKey() {
      let e = this.keyClockDecoder.read();
      if (e < this.keys.length) return this.keys[e];
      {
        let e = this.stringDecoder.read();
        return (this.keys.push(e), e);
      }
    }
  },
  pi = class {
    constructor() {
      this.restEncoder = _();
    }
    toUint8Array() {
      return v(this.restEncoder);
    }
    resetDsCurVal() {}
    writeDsClock(e) {
      b(this.restEncoder, e);
    }
    writeDsLen(e) {
      b(this.restEncoder, e);
    }
  },
  mi = class extends pi {
    writeLeftID(e) {
      (b(this.restEncoder, e.client), b(this.restEncoder, e.clock));
    }
    writeRightID(e) {
      (b(this.restEncoder, e.client), b(this.restEncoder, e.clock));
    }
    writeClient(e) {
      b(this.restEncoder, e);
    }
    writeInfo(e) {
      Oe(this.restEncoder, e);
    }
    writeString(e) {
      x(this.restEncoder, e);
    }
    writeParentInfo(e) {
      b(this.restEncoder, +!!e);
    }
    writeTypeRef(e) {
      b(this.restEncoder, e);
    }
    writeLen(e) {
      b(this.restEncoder, e);
    }
    writeAny(e) {
      ze(this.restEncoder, e);
    }
    writeBuf(e) {
      S(this.restEncoder, e);
    }
    writeJSON(e) {
      x(this.restEncoder, JSON.stringify(e));
    }
    writeKey(e) {
      x(this.restEncoder, e);
    }
  },
  hi = class {
    constructor() {
      ((this.restEncoder = _()), (this.dsCurrVal = 0));
    }
    toUint8Array() {
      return v(this.restEncoder);
    }
    resetDsCurVal() {
      this.dsCurrVal = 0;
    }
    writeDsClock(e) {
      let t = e - this.dsCurrVal;
      ((this.dsCurrVal = e), b(this.restEncoder, t));
    }
    writeDsLen(e) {
      (e === 0 && T(), b(this.restEncoder, e - 1), (this.dsCurrVal += e));
    }
  },
  gi = class extends hi {
    constructor() {
      (super(),
        (this.keyMap = new Map()),
        (this.keyClock = 0),
        (this.keyClockEncoder = new We()),
        (this.clientEncoder = new He()),
        (this.leftClockEncoder = new We()),
        (this.rightClockEncoder = new We()),
        (this.infoEncoder = new Be(Oe)),
        (this.stringEncoder = new Ge()),
        (this.parentInfoEncoder = new Be(Oe)),
        (this.typeRefEncoder = new He()),
        (this.lenEncoder = new He()));
    }
    toUint8Array() {
      let e = _();
      return (
        b(e, 0),
        S(e, this.keyClockEncoder.toUint8Array()),
        S(e, this.clientEncoder.toUint8Array()),
        S(e, this.leftClockEncoder.toUint8Array()),
        S(e, this.rightClockEncoder.toUint8Array()),
        S(e, v(this.infoEncoder)),
        S(e, this.stringEncoder.toUint8Array()),
        S(e, v(this.parentInfoEncoder)),
        S(e, this.typeRefEncoder.toUint8Array()),
        S(e, this.lenEncoder.toUint8Array()),
        Me(e, v(this.restEncoder)),
        v(e)
      );
    }
    writeLeftID(e) {
      (this.clientEncoder.write(e.client), this.leftClockEncoder.write(e.clock));
    }
    writeRightID(e) {
      (this.clientEncoder.write(e.client), this.rightClockEncoder.write(e.clock));
    }
    writeClient(e) {
      this.clientEncoder.write(e);
    }
    writeInfo(e) {
      this.infoEncoder.write(e);
    }
    writeString(e) {
      this.stringEncoder.write(e);
    }
    writeParentInfo(e) {
      this.parentInfoEncoder.write(+!!e);
    }
    writeTypeRef(e) {
      this.typeRefEncoder.write(e);
    }
    writeLen(e) {
      this.lenEncoder.write(e);
    }
    writeAny(e) {
      ze(this.restEncoder, e);
    }
    writeBuf(e) {
      S(this.restEncoder, e);
    }
    writeJSON(e) {
      ze(this.restEncoder, e);
    }
    writeKey(e) {
      let t = this.keyMap.get(e);
      t === void 0
        ? (this.keyClockEncoder.write(this.keyClock++), this.stringEncoder.write(e))
        : this.keyClockEncoder.write(t);
    }
  },
  _i = (e, t, n, r) => {
    r = h(r, t[0].id.clock);
    let i = R(t, r);
    (b(e.restEncoder, t.length - i), e.writeClient(n), b(e.restEncoder, r));
    let a = t[i];
    a.write(e, r - a.id.clock);
    for (let n = i + 1; n < t.length; n++) t[n].write(e, 0);
  },
  vi = (e, t, n) => {
    let r = new Map();
    (n.forEach((e, n) => {
      L(t, n) > e && r.set(n, e);
    }),
      ia(t).forEach((e, t) => {
        n.has(t) || r.set(t, 0);
      }),
      b(e.restEncoder, r.size),
      g(r.entries())
        .sort((e, t) => t[0] - e[0])
        .forEach(([n, r]) => {
          _i(e, t.clients.get(n), n, r);
        }));
  },
  yi = (e, t) => {
    let n = k(),
      r = D(e.restDecoder);
    for (let i = 0; i < r; i++) {
      let r = D(e.restDecoder),
        i = Array(r),
        a = e.readClient(),
        o = D(e.restDecoder);
      n.set(a, { i: 0, refs: i });
      for (let n = 0; n < r; n++) {
        let r = e.readInfo();
        switch (31 & r) {
          case 0: {
            let t = e.readLen();
            ((i[n] = new G(I(a, o), t)), (o += t));
            break;
          }
          case 10: {
            let t = D(e.restDecoder);
            ((i[n] = new Y(I(a, o), t)), (o += t));
            break;
          }
          default: {
            let s = !(r & 192),
              c = new J(
                I(a, o),
                null,
                (r & 128) == 128 ? e.readLeftID() : null,
                null,
                (r & 64) == 64 ? e.readRightID() : null,
                s ? (e.readParentInfo() ? t.get(e.readString()) : e.readLeftID()) : null,
                s && (r & 32) == 32 ? e.readString() : null,
                Cs(e, r),
              );
            ((i[n] = c), (o += c.length));
          }
        }
      }
    }
    return n;
  },
  bi = (e, t, n) => {
    let r = [],
      i = g(n.keys()).sort((e, t) => e - t);
    if (i.length === 0) return null;
    let a = () => {
        if (i.length === 0) return null;
        let e = n.get(i[i.length - 1]);
        for (; e.refs.length === e.i;)
          if ((i.pop(), i.length > 0)) e = n.get(i[i.length - 1]);
          else return null;
        return e;
      },
      o = a();
    if (o === null) return null;
    let s = new ra(),
      c = new Map(),
      l = (e, t) => {
        let n = c.get(e);
        (n == null || n > t) && c.set(e, t);
      },
      u = o.refs[o.i++],
      d = new Map(),
      f = () => {
        for (let e of r) {
          let t = e.id.client,
            r = n.get(t);
          (r
            ? (r.i--, s.clients.set(t, r.refs.slice(r.i)), n.delete(t), (r.i = 0), (r.refs = []))
            : s.clients.set(t, [e]),
            (i = i.filter((e) => e !== t)));
        }
        r.length = 0;
      };
    for (;;) {
      if (u.constructor !== Y) {
        let i = A(d, u.id.client, () => L(t, u.id.client)) - u.id.clock;
        if (i < 0) (r.push(u), l(u.id.client, u.id.clock - 1), f());
        else {
          let a = u.getMissing(e, t);
          if (a !== null) {
            r.push(u);
            let e = n.get(a) || { refs: [], i: 0 };
            if (e.refs.length === e.i) (l(a, L(t, a)), f());
            else {
              u = e.refs[e.i++];
              continue;
            }
          } else
            (i === 0 || i < u.length) &&
              (u.integrate(e, i), d.set(u.id.client, u.id.clock + u.length));
        }
      }
      if (r.length > 0) u = r.pop();
      else if (o !== null && o.i < o.refs.length) u = o.refs[o.i++];
      else {
        if (((o = a()), o === null)) break;
        u = o.refs[o.i++];
      }
    }
    if (s.clients.size > 0) {
      let e = new gi();
      return (vi(e, s, new Map()), b(e.restEncoder, 0), { missing: c, update: e.toUint8Array() });
    }
    return null;
  },
  xi = (e, t) => vi(e, t.doc.store, t.beforeState),
  Si = (e, t, n, r = new fi(e)) =>
    B(
      t,
      (e) => {
        e.local = !1;
        let t = !1,
          n = e.doc,
          i = n.store,
          a = bi(e, i, yi(r, n)),
          o = i.pendingStructs;
        if (o) {
          for (let [e, n] of o.missing)
            if (n < L(i, e)) {
              t = !0;
              break;
            }
          if (a) {
            for (let [e, t] of a.missing) {
              let n = o.missing.get(e);
              (n == null || n > t) && o.missing.set(e, t);
            }
            o.update = Da([o.update, a.update]);
          }
        } else i.pendingStructs = a;
        let s = oi(r, e, i);
        if (i.pendingDs) {
          let t = new fi(Ze(i.pendingDs));
          D(t.restDecoder);
          let n = oi(t, e, i);
          i.pendingDs = s && n ? Da([s, n]) : s || n;
        } else i.pendingDs = s;
        if (t) {
          let t = i.pendingStructs.update;
          ((i.pendingStructs = null), Ci(e.doc, t));
        }
      },
      n,
      !1,
    ),
  Ci = (e, t, n, r = fi) => {
    let i = Ze(t);
    Si(i, e, n, new r(i));
  },
  wi = (e, t, n) => Ci(e, t, n, ui),
  Ti = (e, t, n = new Map()) => {
    (vi(e, t.store, n), ii(e, ri(t.store)));
  },
  Ei = (e, t = new Uint8Array([0]), n = new gi()) => {
    Ti(n, e, ki(t));
    let r = [n.toUint8Array()];
    if (
      (e.store.pendingDs && r.push(e.store.pendingDs),
      e.store.pendingStructs && r.push(Oa(e.store.pendingStructs.update, t)),
      r.length > 1)
    ) {
      if (n.constructor === mi) return Ta(r.map((e, t) => (t === 0 ? e : Na(e))));
      if (n.constructor === gi) return Da(r);
    }
    return r[0];
  },
  Di = (e, t) => Ei(e, t, new mi()),
  Oi = (e) => {
    let t = new Map(),
      n = D(e.restDecoder);
    for (let r = 0; r < n; r++) {
      let n = D(e.restDecoder),
        r = D(e.restDecoder);
      t.set(n, r);
    }
    return t;
  },
  ki = (e) => Oi(new li(Ze(e))),
  Ai = (e, t) => (
    b(e.restEncoder, t.size),
    g(t.entries())
      .sort((e, t) => t[0] - e[0])
      .forEach(([t, n]) => {
        (b(e.restEncoder, t), b(e.restEncoder, n));
      }),
    e
  ),
  ji = (e, t) => Ai(e, ia(t.store)),
  Mi = (e, t = new hi()) => (e instanceof Map ? Ai(t, e) : ji(t, e), t.toUint8Array()),
  Ni = (e) => Mi(e, new pi()),
  Pi = class {
    constructor() {
      this.l = [];
    }
  },
  Fi = () => new Pi(),
  Ii = (e, t) => e.l.push(t),
  Li = (e, t) => {
    let n = e.l,
      r = n.length;
    ((e.l = n.filter((e) => t !== e)),
      r === e.l.length && console.error(`[yjs] Tried to remove event handler that doesn't exist.`));
  },
  Ri = (e, t, n) => Lt(e.l, [t, n]),
  zi = class {
    constructor(e, t) {
      ((this.client = e), (this.clock = t));
    }
  },
  Bi = (e, t) =>
    e === t || (e !== null && t !== null && e.client === t.client && e.clock === t.clock),
  I = (e, t) => new zi(e, t),
  Vi = (e) => {
    for (let [t, n] of e.doc.share.entries()) if (n === e) return t;
    throw T();
  },
  Hi = (e, t) => {
    for (; t !== null;) {
      if (t.parent === e) return !0;
      t = t.parent._item;
    }
    return !1;
  },
  Ui = class {
    constructor(e, t, n, r = 0) {
      ((this.type = e), (this.tname = t), (this.item = n), (this.assoc = r));
    }
  },
  Wi = (e) =>
    new Ui(
      e.type == null ? null : I(e.type.client, e.type.clock),
      e.tname ?? null,
      e.item == null ? null : I(e.item.client, e.item.clock),
      e.assoc == null ? 0 : e.assoc,
    ),
  Gi = class {
    constructor(e, t, n = 0) {
      ((this.type = e), (this.index = t), (this.assoc = n));
    }
  },
  Ki = (e, t, n = 0) => new Gi(e, t, n),
  qi = (e, t, n) => {
    let r = null,
      i = null;
    return (
      e._item === null ? (i = Vi(e)) : (r = I(e._item.id.client, e._item.id.clock)),
      new Ui(r, i, t, n)
    );
  },
  Ji = (e, t, n = 0) => {
    let r = e._start;
    if (n < 0) {
      if (t === 0) return qi(e, null, n);
      t--;
    }
    for (; r !== null;) {
      if (!r.deleted && r.countable) {
        if (r.length > t) return qi(e, I(r.id.client, r.id.clock + t), n);
        t -= r.length;
      }
      if (r.right === null && n < 0) return qi(e, r.lastId, n);
      r = r.right;
    }
    return qi(e, null, n);
  },
  Yi = (e, t) => {
    let n = oa(e, t);
    return { item: n, diff: t.clock - n.id.clock };
  },
  Xi = (e, t, n = !0) => {
    let r = t.store,
      i = e.item,
      a = e.type,
      o = e.tname,
      s = e.assoc,
      c = null,
      l = 0;
    if (i !== null) {
      if (L(r, i.client) <= i.clock) return null;
      let e = n ? vs(r, i) : Yi(r, i),
        t = e.item;
      if (!(t instanceof J)) return null;
      if (((c = t.parent), c._item === null || !c._item.deleted)) {
        l = t.deleted || !t.countable ? 0 : e.diff + (s >= 0 ? 0 : 1);
        let n = t.left;
        for (; n !== null;) (!n.deleted && n.countable && (l += n.length), (n = n.left));
      }
    } else {
      if (o !== null) c = t.get(o);
      else if (a !== null) {
        if (L(r, a.client) <= a.clock) return null;
        let { item: e } = n ? vs(r, a) : { item: oa(r, a) };
        if (e instanceof J && e.content instanceof q) c = e.content.type;
        else return null;
      } else throw T();
      l = s >= 0 ? c._length : 0;
    }
    return Ki(c, l, e.assoc);
  },
  Zi = (e, t) =>
    e === t ||
    (e !== null &&
      t !== null &&
      e.tname === t.tname &&
      Bi(e.item, t.item) &&
      Bi(e.type, t.type) &&
      e.assoc === t.assoc),
  Qi = class {
    constructor(e, t) {
      ((this.ds = e), (this.sv = t));
    }
  },
  $i = (e, t) => new Qi(e, t);
$i(ni(), new Map());
var ea = (e) => $i(ri(e.store), ia(e.store)),
  ta = (e, t) =>
    t === void 0
      ? !e.deleted
      : t.sv.has(e.id.client) && (t.sv.get(e.id.client) || 0) > e.id.clock && !Qr(t.ds, e.id),
  na = (e, t) => {
    let n = A(e.meta, na, oe),
      r = e.doc.store;
    n.has(t) ||
      (t.sv.forEach((t, n) => {
        t < L(r, n) && z(e, I(n, t));
      }),
      Xr(e, t.ds, (e) => {}),
      n.add(t));
  },
  ra = class {
    constructor() {
      ((this.clients = new Map()), (this.pendingStructs = null), (this.pendingDs = null));
    }
  },
  ia = (e) => {
    let t = new Map();
    return (
      e.clients.forEach((e, n) => {
        let r = e[e.length - 1];
        t.set(n, r.id.clock + r.length);
      }),
      t
    );
  },
  L = (e, t) => {
    let n = e.clients.get(t);
    if (n === void 0) return 0;
    let r = n[n.length - 1];
    return r.id.clock + r.length;
  },
  aa = (e, t) => {
    let n = e.clients.get(t.id.client);
    if (n === void 0) ((n = []), e.clients.set(t.id.client, n));
    else {
      let e = n[n.length - 1];
      if (e.id.clock + e.length !== t.id.clock) throw T();
    }
    n.push(t);
  },
  R = (e, t) => {
    let n = 0,
      r = e.length - 1,
      i = e[r],
      a = i.id.clock;
    if (a === t) return r;
    let o = p((t / (a + i.length - 1)) * r);
    for (; n <= r;) {
      if (((i = e[o]), (a = i.id.clock), a <= t)) {
        if (t < a + i.length) return o;
        n = o + 1;
      } else r = o - 1;
      o = p((n + r) / 2);
    }
    throw T();
  },
  oa = (e, t) => {
    let n = e.clients.get(t.client);
    return n[R(n, t.clock)];
  },
  sa = (e, t, n) => {
    let r = R(t, n),
      i = t[r];
    return i.id.clock < n && i instanceof J
      ? (t.splice(r + 1, 0, bs(e, i, n - i.id.clock)), r + 1)
      : r;
  },
  z = (e, t) => {
    let n = e.doc.store.clients.get(t.client);
    return n[sa(e, n, t.clock)];
  },
  ca = (e, t, n) => {
    let r = t.clients.get(n.client),
      i = R(r, n.clock),
      a = r[i];
    return (
      n.clock !== a.id.clock + a.length - 1 &&
        a.constructor !== G &&
        r.splice(i + 1, 0, bs(e, a, n.clock - a.id.clock + 1)),
      a
    );
  },
  la = (e, t, n) => {
    let r = e.clients.get(t.id.client);
    r[R(r, t.id.clock)] = n;
  },
  ua = (e, t, n, r, i) => {
    if (r === 0) return;
    let a = n + r,
      o = sa(e, t, n),
      s;
    do ((s = t[o++]), a < s.id.clock + s.length && sa(e, t, a), i(s));
    while (o < t.length && t[o].id.clock < a);
  },
  da = class {
    constructor(e, t, n) {
      ((this.doc = e),
        (this.deleteSet = new Yr()),
        (this.beforeState = ia(e.store)),
        (this.afterState = new Map()),
        (this.changed = new Map()),
        (this.changedParentTypes = new Map()),
        (this._mergeStructs = []),
        (this.origin = t),
        (this.meta = new Map()),
        (this.local = n),
        (this.subdocsAdded = new Set()),
        (this.subdocsRemoved = new Set()),
        (this.subdocsLoaded = new Set()),
        (this._needFormattingCleanup = !1));
    }
  },
  fa = (e, t) =>
    t.deleteSet.clients.size === 0 && !xt(t.afterState, (e, n) => t.beforeState.get(n) !== e)
      ? !1
      : ($r(t.deleteSet), xi(e, t), ii(e, t.deleteSet), !0),
  pa = (e, t, n) => {
    let r = t._item;
    (r === null || (r.id.clock < (e.beforeState.get(r.id.client) || 0) && !r.deleted)) &&
      A(e.changed, t, oe).add(n);
  },
  ma = (e, t) => {
    let n = e[t],
      r = e[t - 1],
      i = t;
    for (
      ;
      i > 0 && r.deleted === n.deleted && r.constructor === n.constructor && r.mergeWith(n);
      n = r, r = e[--i - 1]
    )
      n instanceof J &&
        n.parentSub !== null &&
        n.parent._map.get(n.parentSub) === n &&
        n.parent._map.set(n.parentSub, r);
    let a = t - i;
    return (a && e.splice(t + 1 - a, a), a);
  },
  ha = (e, t, n) => {
    for (let [r, i] of e.clients.entries()) {
      let e = t.clients.get(r);
      for (let r = i.length - 1; r >= 0; r--) {
        let a = i[r],
          o = a.clock + a.len;
        for (let r = R(e, a.clock), i = e[r]; r < e.length && i.id.clock < o; i = e[++r]) {
          let i = e[r];
          if (a.clock + a.len <= i.id.clock) break;
          i instanceof J && i.deleted && !i.keep && n(i) && i.gc(t, !1);
        }
      }
    }
  },
  ga = (e, t) => {
    e.clients.forEach((e, n) => {
      let r = t.clients.get(n);
      for (let t = e.length - 1; t >= 0; t--) {
        let n = e[t],
          i = m(r.length - 1, 1 + R(r, n.clock + n.len - 1));
        for (let e = i, t = r[e]; e > 0 && t.id.clock >= n.clock; t = r[e]) e -= 1 + ma(r, e);
      }
    });
  },
  _a = (e, t) => {
    if (t < e.length) {
      let n = e[t],
        r = n.doc,
        i = r.store,
        a = n.deleteSet,
        o = n._mergeStructs;
      try {
        ($r(a), (n.afterState = ia(n.doc.store)), r.emit(`beforeObserverCalls`, [n, r]));
        let e = [];
        (n.changed.forEach((t, r) =>
          e.push(() => {
            (r._item !== null && r._item.deleted) || r._callObserver(n, t);
          }),
        ),
          e.push(() => {
            (n.changedParentTypes.forEach((t, r) => {
              r._dEH.l.length > 0 &&
                (r._item === null || !r._item.deleted) &&
                e.push(() => {
                  ((t = t.filter((e) => e.target._item === null || !e.target._item.deleted)),
                    t.forEach((e) => {
                      ((e.currentTarget = r), (e._path = null));
                    }),
                    t.sort((e, t) => e.path.length - t.path.length),
                    Ri(r._dEH, t, n));
                });
            }),
              e.push(() => r.emit(`afterTransaction`, [n, r])),
              e.push(() => {
                n._needFormattingCleanup && jo(n);
              }));
          }),
          Lt(e, []));
      } finally {
        (r.gc && ha(a, i, r.gcFilter),
          ga(a, i),
          n.afterState.forEach((e, t) => {
            let r = n.beforeState.get(t) || 0;
            if (r !== e) {
              let e = i.clients.get(t),
                n = h(R(e, r), 1);
              for (let t = e.length - 1; t >= n;) t -= 1 + ma(e, t);
            }
          }));
        for (let e = o.length - 1; e >= 0; e--) {
          let { client: t, clock: n } = o[e].id,
            r = i.clients.get(t),
            a = R(r, n);
          (a + 1 < r.length && ma(r, a + 1) > 1) || (a > 0 && ma(r, a));
        }
        if (
          (!n.local &&
            n.afterState.get(r.clientID) !== n.beforeState.get(r.clientID) &&
            (Hr(
              Lr,
              Ar,
              `[yjs] `,
              jr,
              Fr,
              `Changed the client-id because another client seems to be using it.`,
            ),
            (r.clientID = si())),
          r.emit(`afterTransactionCleanup`, [n, r]),
          r._observers.has(`update`))
        ) {
          let e = new mi();
          fa(e, n) && r.emit(`update`, [e.toUint8Array(), n.origin, r, n]);
        }
        if (r._observers.has(`updateV2`)) {
          let e = new gi();
          fa(e, n) && r.emit(`updateV2`, [e.toUint8Array(), n.origin, r, n]);
        }
        let { subdocsAdded: s, subdocsLoaded: c, subdocsRemoved: l } = n;
        ((s.size > 0 || l.size > 0 || c.size > 0) &&
          (s.forEach((e) => {
            ((e.clientID = r.clientID), (e.collectionid ??= r.collectionid), r.subdocs.add(e));
          }),
          l.forEach((e) => r.subdocs.delete(e)),
          r.emit(`subdocs`, [{ loaded: c, added: s, removed: l }, r, n]),
          l.forEach((e) => e.destroy())),
          e.length <= t + 1
            ? ((r._transactionCleanups = []), r.emit(`afterAllTransactions`, [r, e]))
            : _a(e, t + 1));
      }
    }
  },
  B = (e, t, n = null, r = !0) => {
    let i = e._transactionCleanups,
      a = !1,
      o = null;
    e._transaction === null &&
      ((a = !0),
      (e._transaction = new da(e, n, r)),
      i.push(e._transaction),
      i.length === 1 && e.emit(`beforeAllTransactions`, [e]),
      e.emit(`beforeTransaction`, [e._transaction, e]));
    try {
      o = t(e._transaction);
    } finally {
      if (a) {
        let t = e._transaction === i[0];
        ((e._transaction = null), t && _a(i, 0));
      }
    }
    return o;
  },
  va = class {
    constructor(e, t) {
      ((this.insertions = t), (this.deletions = e), (this.meta = new Map()));
    }
  },
  ya = (e, t, n) => {
    Xr(e, n.deletions, (n) => {
      n instanceof J && t.scope.some((t) => t === e.doc || Hi(t, n)) && ys(n, !1);
    });
  },
  ba = (e, t, n) => {
    let r = null,
      i = e.doc,
      a = e.scope;
    B(
      i,
      (n) => {
        for (; t.length > 0 && e.currStackItem === null;) {
          let r = i.store,
            o = t.pop(),
            s = new Set(),
            c = [],
            l = !1;
          (Xr(n, o.insertions, (e) => {
            if (e instanceof J) {
              if (e.redone !== null) {
                let { item: t, diff: i } = vs(r, e.id);
                (i > 0 && (t = z(n, I(t.id.client, t.id.clock + i))), (e = t));
              }
              !e.deleted && a.some((t) => t === n.doc || Hi(t, e)) && c.push(e);
            }
          }),
            Xr(n, o.deletions, (e) => {
              e instanceof J &&
                a.some((t) => t === n.doc || Hi(t, e)) &&
                !Qr(o.insertions, e.id) &&
                s.add(e);
            }),
            s.forEach((t) => {
              l = Ss(n, t, s, o.insertions, e.ignoreRemoteMapChanges, e) !== null || l;
            }));
          for (let t = c.length - 1; t >= 0; t--) {
            let r = c[t];
            e.deleteFilter(r) && (r.delete(n), (l = !0));
          }
          e.currStackItem = l ? o : null;
        }
        (n.changed.forEach((e, t) => {
          e.has(null) && t._searchMarker && (t._searchMarker.length = 0);
        }),
          (r = n));
      },
      e,
    );
    let o = e.currStackItem;
    if (o != null) {
      let t = r.changedParentTypes;
      (e.emit(`stack-item-popped`, [
        { stackItem: o, type: n, changedParentTypes: t, origin: e },
        e,
      ]),
        (e.currStackItem = null));
    }
    return o;
  },
  xa = class extends St {
    constructor(
      e,
      {
        captureTimeout: t = 500,
        captureTransaction: n = (e) => !0,
        deleteFilter: r = () => !0,
        trackedOrigins: i = new Set([null]),
        ignoreRemoteMapChanges: a = !1,
        doc: o = fe(e) ? e[0].doc : e instanceof ci ? e : e.doc,
      } = {},
    ) {
      (super(),
        (this.scope = []),
        (this.doc = o),
        this.addToScope(e),
        (this.deleteFilter = r),
        i.add(this),
        (this.trackedOrigins = i),
        (this.captureTransaction = n),
        (this.undoStack = []),
        (this.redoStack = []),
        (this.undoing = !1),
        (this.redoing = !1),
        (this.currStackItem = null),
        (this.lastChange = 0),
        (this.ignoreRemoteMapChanges = a),
        (this.captureTimeout = t),
        (this.afterTransactionHandler = (e) => {
          if (
            !this.captureTransaction(e) ||
            !this.scope.some((t) => e.changedParentTypes.has(t) || t === this.doc) ||
            (!this.trackedOrigins.has(e.origin) &&
              (!e.origin || !this.trackedOrigins.has(e.origin.constructor)))
          )
            return;
          let t = this.undoing,
            n = this.redoing,
            r = t ? this.redoStack : this.undoStack;
          t ? this.stopCapturing() : n || this.clear(!1, !0);
          let i = new Yr();
          e.afterState.forEach((t, n) => {
            let r = e.beforeState.get(n) || 0,
              a = t - r;
            a > 0 && ti(i, n, r, a);
          });
          let a = vt(),
            o = !1;
          if (
            this.lastChange > 0 &&
            a - this.lastChange < this.captureTimeout &&
            r.length > 0 &&
            !t &&
            !n
          ) {
            let t = r[r.length - 1];
            ((t.deletions = ei([t.deletions, e.deleteSet])),
              (t.insertions = ei([t.insertions, i])));
          } else (r.push(new va(e.deleteSet, i)), (o = !0));
          (!t && !n && (this.lastChange = a),
            Xr(e, e.deleteSet, (t) => {
              t instanceof J && this.scope.some((n) => n === e.doc || Hi(n, t)) && ys(t, !0);
            }));
          let s = [
            {
              stackItem: r[r.length - 1],
              origin: e.origin,
              type: t ? `redo` : `undo`,
              changedParentTypes: e.changedParentTypes,
            },
            this,
          ];
          o ? this.emit(`stack-item-added`, s) : this.emit(`stack-item-updated`, s);
        }),
        (this.destroy = this.destroy.bind(this)),
        this.doc.on(`afterTransaction`, this.afterTransactionHandler),
        this.doc.on(`destroy`, this.destroy));
    }
    addToScope(e) {
      let t = new Set(this.scope);
      ((e = fe(e) ? e : [e]),
        e.forEach((e) => {
          t.has(e) ||
            (t.add(e),
            (e instanceof H ? e.doc !== this.doc : e !== this.doc) &&
              Ur(`[yjs#509] Not same Y.Doc`),
            this.scope.push(e));
        }));
    }
    addTrackedOrigin(e) {
      this.trackedOrigins.add(e);
    }
    removeTrackedOrigin(e) {
      this.trackedOrigins.delete(e);
    }
    clear(e = !0, t = !0) {
      ((e && this.canUndo()) || (t && this.canRedo())) &&
        this.doc.transact((n) => {
          (e && (this.undoStack.forEach((e) => ya(n, this, e)), (this.undoStack = [])),
            t && (this.redoStack.forEach((e) => ya(n, this, e)), (this.redoStack = [])),
            this.emit(`stack-cleared`, [{ undoStackCleared: e, redoStackCleared: t }]));
        });
    }
    stopCapturing() {
      this.lastChange = 0;
    }
    undo() {
      this.undoing = !0;
      let e;
      try {
        e = ba(this, this.undoStack, `undo`);
      } finally {
        this.undoing = !1;
      }
      return e;
    }
    redo() {
      this.redoing = !0;
      let e;
      try {
        e = ba(this, this.redoStack, `redo`);
      } finally {
        this.redoing = !1;
      }
      return e;
    }
    canUndo() {
      return this.undoStack.length > 0;
    }
    canRedo() {
      return this.redoStack.length > 0;
    }
    destroy() {
      (this.trackedOrigins.delete(this),
        this.doc.off(`afterTransaction`, this.afterTransactionHandler),
        this.doc.off(`destroy`, this.destroy),
        super.destroy());
    }
  };
function* Sa(e) {
  let t = D(e.restDecoder);
  for (let n = 0; n < t; n++) {
    let t = D(e.restDecoder),
      n = e.readClient(),
      r = D(e.restDecoder);
    for (let i = 0; i < t; i++) {
      let t = e.readInfo();
      if (t === 10) {
        let t = D(e.restDecoder);
        (yield new Y(I(n, r), t), (r += t));
      } else if (31 & t) {
        let i = !(t & 192),
          a = new J(
            I(n, r),
            null,
            (t & 128) == 128 ? e.readLeftID() : null,
            null,
            (t & 64) == 64 ? e.readRightID() : null,
            i ? (e.readParentInfo() ? e.readString() : e.readLeftID()) : null,
            i && (t & 32) == 32 ? e.readString() : null,
            Cs(e, t),
          );
        (yield a, (r += a.length));
      } else {
        let t = e.readLen();
        (yield new G(I(n, r), t), (r += t));
      }
    }
  }
}
var Ca = class {
    constructor(e, t) {
      ((this.gen = Sa(e)),
        (this.curr = null),
        (this.done = !1),
        (this.filterSkips = t),
        this.next());
    }
    next() {
      do this.curr = this.gen.next().value || null;
      while (this.filterSkips && this.curr !== null && this.curr.constructor === Y);
      return this.curr;
    }
  },
  wa = class {
    constructor(e) {
      ((this.currClient = 0),
        (this.startClock = 0),
        (this.written = 0),
        (this.encoder = e),
        (this.clientStructs = []));
    }
  },
  Ta = (e) => Da(e, ui, mi),
  Ea = (e, t) => {
    if (e.constructor === G) {
      let { client: n, clock: r } = e.id;
      return new G(I(n, r + t), e.length - t);
    }
    if (e.constructor === Y) {
      let { client: n, clock: r } = e.id;
      return new Y(I(n, r + t), e.length - t);
    }
    {
      let n = e,
        { client: r, clock: i } = n.id;
      return new J(
        I(r, i + t),
        null,
        I(r, i + t - 1),
        null,
        n.rightOrigin,
        n.parent,
        n.parentSub,
        n.content.splice(t),
      );
    }
  },
  Da = (e, t = fi, n = gi) => {
    if (e.length === 1) return e[0];
    let r = e.map((e) => new t(Ze(e))),
      i = r.map((e) => new Ca(e, !0)),
      a = null,
      o = new n(),
      s = new wa(o);
    for (
      ;
      (i = i.filter((e) => e.curr !== null)),
        i.sort((e, t) => {
          if (e.curr.id.client === t.curr.id.client) {
            let n = e.curr.id.clock - t.curr.id.clock;
            return n === 0
              ? e.curr.constructor === t.curr.constructor
                ? 0
                : e.curr.constructor === Y
                  ? 1
                  : -1
              : n;
          }
          return t.curr.id.client - e.curr.id.client;
        }),
        i.length !== 0;
    ) {
      let e = i[0],
        t = e.curr.id.client;
      if (a !== null) {
        let n = e.curr,
          r = !1;
        for (
          ;
          n !== null &&
          n.id.clock + n.length <= a.struct.id.clock + a.struct.length &&
          n.id.client >= a.struct.id.client;
        )
          ((n = e.next()), (r = !0));
        if (
          n === null ||
          n.id.client !== t ||
          (r && n.id.clock > a.struct.id.clock + a.struct.length)
        )
          continue;
        if (t !== a.struct.id.client)
          (Aa(s, a.struct, a.offset), (a = { struct: n, offset: 0 }), e.next());
        else if (a.struct.id.clock + a.struct.length < n.id.clock) {
          if (a.struct.constructor === Y)
            a.struct.length = n.id.clock + n.length - a.struct.id.clock;
          else {
            Aa(s, a.struct, a.offset);
            let e = n.id.clock - a.struct.id.clock - a.struct.length;
            a = { struct: new Y(I(t, a.struct.id.clock + a.struct.length), e), offset: 0 };
          }
        } else {
          let t = a.struct.id.clock + a.struct.length - n.id.clock;
          (t > 0 && (a.struct.constructor === Y ? (a.struct.length -= t) : (n = Ea(n, t))),
            a.struct.mergeWith(n) ||
              (Aa(s, a.struct, a.offset), (a = { struct: n, offset: 0 }), e.next()));
        }
      } else ((a = { struct: e.curr, offset: 0 }), e.next());
      for (
        let n = e.curr;
        n !== null &&
        n.id.client === t &&
        n.id.clock === a.struct.id.clock + a.struct.length &&
        n.constructor !== Y;
        n = e.next()
      )
        (Aa(s, a.struct, a.offset), (a = { struct: n, offset: 0 }));
    }
    return (
      a !== null && (Aa(s, a.struct, a.offset), (a = null)),
      ja(s),
      ii(o, ei(r.map((e) => ai(e)))),
      o.toUint8Array()
    );
  },
  Oa = (e, t, n = fi, r = gi) => {
    let i = ki(t),
      a = new r(),
      o = new wa(a),
      s = new n(Ze(e)),
      c = new Ca(s, !1);
    for (; c.curr;) {
      let e = c.curr,
        t = e.id.client,
        n = i.get(t) || 0;
      if (c.curr.constructor === Y) c.next();
      else if (e.id.clock + e.length > n)
        for (Aa(o, e, h(n - e.id.clock, 0)), c.next(); c.curr && c.curr.id.client === t;)
          (Aa(o, c.curr, 0), c.next());
      else
        for (; c.curr && c.curr.id.client === t && c.curr.id.clock + c.curr.length <= n;) c.next();
    }
    return (ja(o), ii(a, ai(s)), a.toUint8Array());
  },
  ka = (e) => {
    e.written > 0 &&
      (e.clientStructs.push({ written: e.written, restEncoder: v(e.encoder.restEncoder) }),
      (e.encoder.restEncoder = _()),
      (e.written = 0));
  },
  Aa = (e, t, n) => {
    (e.written > 0 && e.currClient !== t.id.client && ka(e),
      e.written === 0 &&
        ((e.currClient = t.id.client),
        e.encoder.writeClient(t.id.client),
        b(e.encoder.restEncoder, t.id.clock + n)),
      t.write(e.encoder, n),
      e.written++);
  },
  ja = (e) => {
    ka(e);
    let t = e.encoder.restEncoder;
    b(t, e.clientStructs.length);
    for (let n = 0; n < e.clientStructs.length; n++) {
      let r = e.clientStructs[n];
      (b(t, r.written), Me(t, r.restEncoder));
    }
  },
  Ma = (e, t, n, r) => {
    let i = new n(Ze(e)),
      a = new Ca(i, !1),
      o = new r(),
      s = new wa(o);
    for (let e = a.curr; e !== null; e = a.next()) Aa(s, t(e), 0);
    return (ja(s), ii(o, ai(i)), o.toUint8Array());
  },
  Na = (e) => Ma(e, Rt, fi, mi),
  Pa = `You must not compute changes after the event-handler fired.`,
  Fa = class {
    constructor(e, t) {
      ((this.target = e),
        (this.currentTarget = e),
        (this.transaction = t),
        (this._changes = null),
        (this._keys = null),
        (this._delta = null),
        (this._path = null));
    }
    get path() {
      return (this._path ||= Ia(this.currentTarget, this.target));
    }
    deletes(e) {
      return Qr(this.transaction.deleteSet, e.id);
    }
    get keys() {
      if (this._keys === null) {
        if (this.transaction.doc._transactionCleanups.length === 0) throw C(Pa);
        let e = new Map(),
          t = this.target;
        (this.transaction.changed.get(t).forEach((n) => {
          if (n !== null) {
            let r = t._map.get(n),
              i,
              a;
            if (this.adds(r)) {
              let e = r.left;
              for (; e !== null && this.adds(e);) e = e.left;
              if (this.deletes(r)) {
                if (e !== null && this.deletes(e))
                  ((i = `delete`), (a = se(e.content.getContent())));
                else return;
              } else
                e !== null && this.deletes(e)
                  ? ((i = `update`), (a = se(e.content.getContent())))
                  : ((i = `add`), (a = void 0));
            } else if (this.deletes(r)) ((i = `delete`), (a = se(r.content.getContent())));
            else return;
            e.set(n, { action: i, oldValue: a });
          }
        }),
          (this._keys = e));
      }
      return this._keys;
    }
    get delta() {
      return this.changes.delta;
    }
    adds(e) {
      return e.id.clock >= (this.transaction.beforeState.get(e.id.client) || 0);
    }
    get changes() {
      let e = this._changes;
      if (e === null) {
        if (this.transaction.doc._transactionCleanups.length === 0) throw C(Pa);
        let t = this.target,
          n = oe(),
          r = oe(),
          i = [];
        if (
          ((e = { added: n, deleted: r, delta: i, keys: this.keys }),
          this.transaction.changed.get(t).has(null))
        ) {
          let e = null,
            a = () => {
              e && i.push(e);
            };
          for (let i = t._start; i !== null; i = i.right)
            i.deleted
              ? this.deletes(i) &&
                !this.adds(i) &&
                ((e === null || e.delete === void 0) && (a(), (e = { delete: 0 })),
                (e.delete += i.length),
                r.add(i))
              : this.adds(i)
                ? ((e === null || e.insert === void 0) && (a(), (e = { insert: [] })),
                  (e.insert = e.insert.concat(i.content.getContent())),
                  n.add(i))
                : ((e === null || e.retain === void 0) && (a(), (e = { retain: 0 })),
                  (e.retain += i.length));
          e !== null && e.retain === void 0 && a();
        }
        this._changes = e;
      }
      return e;
    }
  },
  Ia = (e, t) => {
    let n = [];
    for (; t._item !== null && t !== e;) {
      if (t._item.parentSub !== null) n.unshift(t._item.parentSub);
      else {
        let e = 0,
          r = t._item.parent._start;
        for (; r !== t._item && r !== null;)
          (!r.deleted && r.countable && (e += r.length), (r = r.right));
        n.unshift(e);
      }
      t = t._item.parent;
    }
    return n;
  },
  V = () => {
    Ur(`Invalid access: Add Yjs type to a document before reading data.`);
  },
  La = 80,
  Ra = 0,
  za = class {
    constructor(e, t) {
      ((e.marker = !0), (this.p = e), (this.index = t), (this.timestamp = Ra++));
    }
  },
  Ba = (e) => {
    e.timestamp = Ra++;
  },
  Va = (e, t, n) => {
    ((e.p.marker = !1), (e.p = t), (t.marker = !0), (e.index = n), (e.timestamp = Ra++));
  },
  Ha = (e, t, n) => {
    if (e.length >= La) {
      let r = e.reduce((e, t) => (e.timestamp < t.timestamp ? e : t));
      return (Va(r, t, n), r);
    }
    {
      let r = new za(t, n);
      return (e.push(r), r);
    }
  },
  Ua = (e, t) => {
    if (e._start === null || t === 0 || e._searchMarker === null) return null;
    let n =
        e._searchMarker.length === 0
          ? null
          : e._searchMarker.reduce((e, n) => (ee(t - e.index) < ee(t - n.index) ? e : n)),
      r = e._start,
      i = 0;
    for (n !== null && ((r = n.p), (i = n.index), Ba(n)); r.right !== null && i < t;) {
      if (!r.deleted && r.countable) {
        if (t < i + r.length) break;
        i += r.length;
      }
      r = r.right;
    }
    for (; r.left !== null && i > t;) ((r = r.left), !r.deleted && r.countable && (i -= r.length));
    for (
      ;
      r.left !== null &&
      r.left.id.client === r.id.client &&
      r.left.id.clock + r.left.length === r.id.clock;
    )
      ((r = r.left), !r.deleted && r.countable && (i -= r.length));
    return n !== null && ee(n.index - i) < r.parent.length / La
      ? (Va(n, r, i), n)
      : Ha(e._searchMarker, r, i);
  },
  Wa = (e, t, n) => {
    for (let r = e.length - 1; r >= 0; r--) {
      let i = e[r];
      if (n > 0) {
        let t = i.p;
        for (t.marker = !1; t && (t.deleted || !t.countable);)
          ((t = t.left), t && !t.deleted && t.countable && (i.index -= t.length));
        if (t === null || t.marker === !0) {
          e.splice(r, 1);
          continue;
        }
        ((i.p = t), (t.marker = !0));
      }
      (t < i.index || (n > 0 && t === i.index)) && (i.index = h(t, i.index + n));
    }
  },
  Ga = (e, t, n) => {
    let r = e,
      i = t.changedParentTypes;
    for (; A(i, e, () => []).push(n), e._item !== null;) e = e._item.parent;
    Ri(r._eH, n, t);
  },
  H = class {
    constructor() {
      ((this._item = null),
        (this._map = new Map()),
        (this._start = null),
        (this.doc = null),
        (this._length = 0),
        (this._eH = Fi()),
        (this._dEH = Fi()),
        (this._searchMarker = null));
    }
    get parent() {
      return this._item ? this._item.parent : null;
    }
    _integrate(e, t) {
      ((this.doc = e), (this._item = t));
    }
    _copy() {
      throw w();
    }
    clone() {
      throw w();
    }
    _write(e) {}
    get _first() {
      let e = this._start;
      for (; e !== null && e.deleted;) e = e.right;
      return e;
    }
    _callObserver(e, t) {
      !e.local && this._searchMarker && (this._searchMarker.length = 0);
    }
    observe(e) {
      Ii(this._eH, e);
    }
    observeDeep(e) {
      Ii(this._dEH, e);
    }
    unobserve(e) {
      Li(this._eH, e);
    }
    unobserveDeep(e) {
      Li(this._dEH, e);
    }
    toJSON() {}
  },
  Ka = (e, t, n) => {
    (e.doc ?? V(), t < 0 && (t = e._length + t), n < 0 && (n = e._length + n));
    let r = n - t,
      i = [],
      a = e._start;
    for (; a !== null && r > 0;) {
      if (a.countable && !a.deleted) {
        let e = a.content.getContent();
        if (e.length <= t) t -= e.length;
        else {
          for (let n = t; n < e.length && r > 0; n++) (i.push(e[n]), r--);
          t = 0;
        }
      }
      a = a.right;
    }
    return i;
  },
  qa = (e) => {
    e.doc ?? V();
    let t = [],
      n = e._start;
    for (; n !== null;) {
      if (n.countable && !n.deleted) {
        let e = n.content.getContent();
        for (let n = 0; n < e.length; n++) t.push(e[n]);
      }
      n = n.right;
    }
    return t;
  },
  Ja = (e, t) => {
    let n = [],
      r = e._start;
    for (; r !== null;) {
      if (r.countable && ta(r, t)) {
        let e = r.content.getContent();
        for (let t = 0; t < e.length; t++) n.push(e[t]);
      }
      r = r.right;
    }
    return n;
  },
  Ya = (e, t) => {
    let n = 0,
      r = e._start;
    for (e.doc ?? V(); r !== null;) {
      if (r.countable && !r.deleted) {
        let i = r.content.getContent();
        for (let r = 0; r < i.length; r++) t(i[r], n++, e);
      }
      r = r.right;
    }
  },
  Xa = (e, t) => {
    let n = [];
    return (
      Ya(e, (r, i) => {
        n.push(t(r, i, e));
      }),
      n
    );
  },
  Za = (e) => {
    let t = e._start,
      n = null,
      r = 0;
    return {
      [Symbol.iterator]() {
        return this;
      },
      next: () => {
        if (n === null) {
          for (; t !== null && t.deleted;) t = t.right;
          if (t === null) return { done: !0, value: void 0 };
          ((n = t.content.getContent()), (r = 0), (t = t.right));
        }
        let e = n[r++];
        return (n.length <= r && (n = null), { done: !1, value: e });
      },
    };
  },
  Qa = (e, t) => {
    e.doc ?? V();
    let n = Ua(e, t),
      r = e._start;
    for (n !== null && ((r = n.p), (t -= n.index)); r !== null; r = r.right)
      if (!r.deleted && r.countable) {
        if (t < r.length) return r.content.getContent()[t];
        t -= r.length;
      }
  },
  $a = (e, t, n, r) => {
    let i = n,
      a = e.doc,
      o = a.clientID,
      s = a.store,
      c = n === null ? t._start : n.right,
      l = [],
      u = () => {
        l.length > 0 &&
          ((i = new J(I(o, L(s, o)), i, i && i.lastId, c, c && c.id, t, null, new as(l))),
          i.integrate(e, 0),
          (l = []));
      };
    (r.forEach((n) => {
      if (n === null) l.push(n);
      else
        switch (n.constructor) {
          case Number:
          case Object:
          case Boolean:
          case Array:
          case String:
            l.push(n);
            break;
          default:
            switch ((u(), n.constructor)) {
              case Uint8Array:
              case ArrayBuffer:
                ((i = new J(
                  I(o, L(s, o)),
                  i,
                  i && i.lastId,
                  c,
                  c && c.id,
                  t,
                  null,
                  new Ko(new Uint8Array(n)),
                )),
                  i.integrate(e, 0));
                break;
              case ci:
                ((i = new J(I(o, L(s, o)), i, i && i.lastId, c, c && c.id, t, null, new Zo(n))),
                  i.integrate(e, 0));
                break;
              default:
                if (n instanceof H)
                  ((i = new J(I(o, L(s, o)), i, i && i.lastId, c, c && c.id, t, null, new q(n))),
                    i.integrate(e, 0));
                else throw Error(`Unexpected content type in insert operation`);
            }
        }
    }),
      u());
  },
  eo = () => C(`Length exceeded!`),
  to = (e, t, n, r) => {
    if (n > t._length) throw eo();
    if (n === 0) return (t._searchMarker && Wa(t._searchMarker, n, r.length), $a(e, t, null, r));
    let i = n,
      a = Ua(t, n),
      o = t._start;
    for (
      a !== null &&
      ((o = a.p),
      (n -= a.index),
      n === 0 && ((o = o.prev), (n += o && o.countable && !o.deleted ? o.length : 0)));
      o !== null;
      o = o.right
    )
      if (!o.deleted && o.countable) {
        if (n <= o.length) {
          n < o.length && z(e, I(o.id.client, o.id.clock + n));
          break;
        }
        n -= o.length;
      }
    return (t._searchMarker && Wa(t._searchMarker, i, r.length), $a(e, t, o, r));
  },
  no = (e, t, n) => {
    let r = (t._searchMarker || []).reduce((e, t) => (t.index > e.index ? t : e), {
      index: 0,
      p: t._start,
    }).p;
    if (r) for (; r.right;) r = r.right;
    return $a(e, t, r, n);
  },
  ro = (e, t, n, r) => {
    if (r === 0) return;
    let i = n,
      a = r,
      o = Ua(t, n),
      s = t._start;
    for (o !== null && ((s = o.p), (n -= o.index)); s !== null && n > 0; s = s.right)
      !s.deleted &&
        s.countable &&
        (n < s.length && z(e, I(s.id.client, s.id.clock + n)), (n -= s.length));
    for (; r > 0 && s !== null;)
      (s.deleted ||
        (r < s.length && z(e, I(s.id.client, s.id.clock + r)), s.delete(e), (r -= s.length)),
        (s = s.right));
    if (r > 0) throw eo();
    t._searchMarker && Wa(t._searchMarker, i, -a + r);
  },
  io = (e, t, n) => {
    let r = t._map.get(n);
    r !== void 0 && r.delete(e);
  },
  ao = (e, t, n, r) => {
    let i = t._map.get(n) || null,
      a = e.doc,
      o = a.clientID,
      s;
    if (r == null) s = new as([r]);
    else
      switch (r.constructor) {
        case Number:
        case Object:
        case Boolean:
        case Array:
        case String:
        case Date:
        case BigInt:
          s = new as([r]);
          break;
        case Uint8Array:
          s = new Ko(r);
          break;
        case ci:
          s = new Zo(r);
          break;
        default:
          if (r instanceof H) s = new q(r);
          else throw Error(`Unexpected content type`);
      }
    new J(I(o, L(a.store, o)), i, i && i.lastId, null, null, t, n, s).integrate(e, 0);
  },
  oo = (e, t) => {
    e.doc ?? V();
    let n = e._map.get(t);
    return n !== void 0 && !n.deleted ? n.content.getContent()[n.length - 1] : void 0;
  },
  so = (e) => {
    let t = {};
    return (
      e.doc ?? V(),
      e._map.forEach((e, n) => {
        e.deleted || (t[n] = e.content.getContent()[e.length - 1]);
      }),
      t
    );
  },
  co = (e, t) => {
    e.doc ?? V();
    let n = e._map.get(t);
    return n !== void 0 && !n.deleted;
  },
  lo = (e, t) => {
    let n = {};
    return (
      e._map.forEach((e, r) => {
        let i = e;
        for (
          ;
          i !== null && (!t.sv.has(i.id.client) || i.id.clock >= (t.sv.get(i.id.client) || 0));
        )
          i = i.left;
        i !== null && ta(i, t) && (n[r] = i.content.getContent()[i.length - 1]);
      }),
      n
    );
  },
  uo = (e) => (e.doc ?? V(), Kr(e._map.entries(), (e) => !e[1].deleted)),
  fo = class extends Fa {},
  po = class e extends H {
    constructor() {
      (super(), (this._prelimContent = []), (this._searchMarker = []));
    }
    static from(t) {
      let n = new e();
      return (n.push(t), n);
    }
    _integrate(e, t) {
      (super._integrate(e, t), this.insert(0, this._prelimContent), (this._prelimContent = null));
    }
    _copy() {
      return new e();
    }
    clone() {
      let t = new e();
      return (
        t.insert(
          0,
          this.toArray().map((e) => (e instanceof H ? e.clone() : e)),
        ),
        t
      );
    }
    get length() {
      return (this.doc ?? V(), this._length);
    }
    _callObserver(e, t) {
      (super._callObserver(e, t), Ga(this, e, new fo(this, e)));
    }
    insert(e, t) {
      this.doc === null
        ? this._prelimContent.splice(e, 0, ...t)
        : B(this.doc, (n) => {
            to(n, this, e, t);
          });
    }
    push(e) {
      this.doc === null
        ? this._prelimContent.push(...e)
        : B(this.doc, (t) => {
            no(t, this, e);
          });
    }
    unshift(e) {
      this.insert(0, e);
    }
    delete(e, t = 1) {
      this.doc === null
        ? this._prelimContent.splice(e, t)
        : B(this.doc, (n) => {
            ro(n, this, e, t);
          });
    }
    get(e) {
      return Qa(this, e);
    }
    toArray() {
      return qa(this);
    }
    slice(e = 0, t = this.length) {
      return Ka(this, e, t);
    }
    toJSON() {
      return this.map((e) => (e instanceof H ? e.toJSON() : e));
    }
    map(e) {
      return Xa(this, e);
    }
    forEach(e) {
      Ya(this, e);
    }
    [Symbol.iterator]() {
      return Za(this);
    }
    _write(e) {
      e.writeTypeRef(us);
    }
  },
  mo = (e) => new po(),
  ho = class extends Fa {
    constructor(e, t, n) {
      (super(e, t), (this.keysChanged = n));
    }
  },
  go = class e extends H {
    constructor(e) {
      (super(),
        (this._prelimContent = null),
        (this._prelimContent = e === void 0 ? new Map() : new Map(e)));
    }
    _integrate(e, t) {
      (super._integrate(e, t),
        this._prelimContent.forEach((e, t) => {
          this.set(t, e);
        }),
        (this._prelimContent = null));
    }
    _copy() {
      return new e();
    }
    clone() {
      let t = new e();
      return (
        this.forEach((e, n) => {
          t.set(n, e instanceof H ? e.clone() : e);
        }),
        t
      );
    }
    _callObserver(e, t) {
      Ga(this, e, new ho(this, e, t));
    }
    toJSON() {
      this.doc ?? V();
      let e = {};
      return (
        this._map.forEach((t, n) => {
          if (!t.deleted) {
            let r = t.content.getContent()[t.length - 1];
            e[n] = r instanceof H ? r.toJSON() : r;
          }
        }),
        e
      );
    }
    get size() {
      return [...uo(this)].length;
    }
    keys() {
      return qr(uo(this), (e) => e[0]);
    }
    values() {
      return qr(uo(this), (e) => e[1].content.getContent()[e[1].length - 1]);
    }
    entries() {
      return qr(uo(this), (e) => [e[0], e[1].content.getContent()[e[1].length - 1]]);
    }
    forEach(e) {
      (this.doc ?? V(),
        this._map.forEach((t, n) => {
          t.deleted || e(t.content.getContent()[t.length - 1], n, this);
        }));
    }
    [Symbol.iterator]() {
      return this.entries();
    }
    delete(e) {
      this.doc === null
        ? this._prelimContent.delete(e)
        : B(this.doc, (t) => {
            io(t, this, e);
          });
    }
    set(e, t) {
      return (
        this.doc === null
          ? this._prelimContent.set(e, t)
          : B(this.doc, (n) => {
              ao(n, this, e, t);
            }),
        t
      );
    }
    get(e) {
      return oo(this, e);
    }
    has(e) {
      return co(this, e);
    }
    clear() {
      this.doc === null
        ? this._prelimContent.clear()
        : B(this.doc, (e) => {
            this.forEach(function (t, n, r) {
              io(e, r, n);
            });
          });
    }
    _write(e) {
      e.writeTypeRef(ds);
    }
  },
  _o = (e) => new go(),
  vo = (e, t) => e === t || (typeof e == `object` && typeof t == `object` && e && t && Pt(e, t)),
  yo = class {
    constructor(e, t, n, r) {
      ((this.left = e), (this.right = t), (this.index = n), (this.currentAttributes = r));
    }
    forward() {
      switch ((this.right === null && T(), this.right.content.constructor)) {
        case K:
          this.right.deleted || Co(this.currentAttributes, this.right.content);
          break;
        default:
          this.right.deleted || (this.index += this.right.length);
      }
      ((this.left = this.right), (this.right = this.right.right));
    }
  },
  bo = (e, t, n) => {
    for (; t.right !== null && n > 0;) {
      switch (t.right.content.constructor) {
        case K:
          t.right.deleted || Co(t.currentAttributes, t.right.content);
          break;
        default:
          t.right.deleted ||
            (n < t.right.length && z(e, I(t.right.id.client, t.right.id.clock + n)),
            (t.index += t.right.length),
            (n -= t.right.length));
      }
      ((t.left = t.right), (t.right = t.right.right));
    }
    return t;
  },
  xo = (e, t, n, r) => {
    let i = new Map(),
      a = r ? Ua(t, n) : null;
    return a
      ? bo(e, new yo(a.p.left, a.p, a.index, i), n - a.index)
      : bo(e, new yo(null, t._start, 0, i), n);
  },
  So = (e, t, n, r) => {
    for (
      ;
      n.right !== null &&
      (n.right.deleted === !0 ||
        (n.right.content.constructor === K &&
          vo(r.get(n.right.content.key), n.right.content.value)));
    )
      (n.right.deleted || r.delete(n.right.content.key), n.forward());
    let i = e.doc,
      a = i.clientID;
    r.forEach((r, o) => {
      let s = n.left,
        c = n.right,
        l = new J(I(a, L(i.store, a)), s, s && s.lastId, c, c && c.id, t, null, new K(o, r));
      (l.integrate(e, 0), (n.right = l), n.forward());
    });
  },
  Co = (e, t) => {
    let { key: n, value: r } = t;
    r === null ? e.delete(n) : e.set(n, r);
  },
  wo = (e, t) => {
    for (
      ;
      e.right !== null &&
      (e.right.deleted ||
        (e.right.content.constructor === K &&
          vo(t[e.right.content.key] ?? null, e.right.content.value)));
    )
      e.forward();
  },
  To = (e, t, n, r) => {
    let i = e.doc,
      a = i.clientID,
      o = new Map();
    for (let s in r) {
      let c = r[s],
        l = n.currentAttributes.get(s) ?? null;
      if (!vo(l, c)) {
        o.set(s, l);
        let { left: r, right: u } = n;
        ((n.right = new J(
          I(a, L(i.store, a)),
          r,
          r && r.lastId,
          u,
          u && u.id,
          t,
          null,
          new K(s, c),
        )),
          n.right.integrate(e, 0),
          n.forward());
      }
    }
    return o;
  },
  Eo = (e, t, n, r, i) => {
    n.currentAttributes.forEach((e, t) => {
      i[t] === void 0 && (i[t] = null);
    });
    let a = e.doc,
      o = a.clientID;
    wo(n, i);
    let s = To(e, t, n, i),
      c = r.constructor === String ? new ss(r) : r instanceof H ? new q(r) : new $o(r),
      { left: l, right: u, index: d } = n;
    (t._searchMarker && Wa(t._searchMarker, n.index, c.getLength()),
      (u = new J(I(o, L(a.store, o)), l, l && l.lastId, u, u && u.id, t, null, c)),
      u.integrate(e, 0),
      (n.right = u),
      (n.index = d),
      n.forward(),
      So(e, t, n, s));
  },
  Do = (e, t, n, r, i) => {
    let a = e.doc,
      o = a.clientID;
    wo(n, i);
    let s = To(e, t, n, i);
    iterationLoop: for (
      ;
      n.right !== null &&
      (r > 0 || (s.size > 0 && (n.right.deleted || n.right.content.constructor === K)));
    ) {
      if (!n.right.deleted)
        switch (n.right.content.constructor) {
          case K: {
            let { key: t, value: a } = n.right.content,
              o = i[t];
            if (o !== void 0) {
              if (vo(o, a)) s.delete(t);
              else {
                if (r === 0) break iterationLoop;
                s.set(t, a);
              }
              n.right.delete(e);
            } else n.currentAttributes.set(t, a);
            break;
          }
          default:
            (r < n.right.length && z(e, I(n.right.id.client, n.right.id.clock + r)),
              (r -= n.right.length));
        }
      n.forward();
    }
    if (r > 0) {
      let i = ``;
      for (; r > 0; r--)
        i += `
`;
      ((n.right = new J(
        I(o, L(a.store, o)),
        n.left,
        n.left && n.left.lastId,
        n.right,
        n.right && n.right.id,
        t,
        null,
        new ss(i),
      )),
        n.right.integrate(e, 0),
        n.forward());
    }
    So(e, t, n, s);
  },
  Oo = (e, t, n, r, i) => {
    let a = t,
      o = k();
    for (; a && (!a.countable || a.deleted);) {
      if (!a.deleted && a.content.constructor === K) {
        let e = a.content;
        o.set(e.key, e);
      }
      a = a.right;
    }
    let s = 0,
      c = !1;
    for (; t !== a;) {
      if ((n === t && (c = !0), !t.deleted)) {
        let n = t.content;
        switch (n.constructor) {
          case K: {
            let { key: a, value: l } = n,
              u = r.get(a) ?? null;
            ((o.get(a) !== n || u === l) &&
              (t.delete(e),
              s++,
              !c &&
                (i.get(a) ?? null) === l &&
                u !== l &&
                (u === null ? i.delete(a) : i.set(a, u))),
              !c && !t.deleted && Co(i, n));
            break;
          }
        }
      }
      t = t.right;
    }
    return s;
  },
  ko = (e, t) => {
    for (; t && t.right && (t.right.deleted || !t.right.countable);) t = t.right;
    let n = new Set();
    for (; t && (t.deleted || !t.countable);) {
      if (!t.deleted && t.content.constructor === K) {
        let r = t.content.key;
        n.has(r) ? t.delete(e) : n.add(r);
      }
      t = t.left;
    }
  },
  Ao = (e) => {
    let t = 0;
    return (
      B(e.doc, (n) => {
        let r = e._start,
          i = e._start,
          a = k(),
          o = yt(a);
        for (; i;) {
          if (i.deleted === !1)
            switch (i.content.constructor) {
              case K:
                Co(o, i.content);
                break;
              default:
                ((t += Oo(n, r, i, a, o)), (a = yt(o)), (r = i));
            }
          i = i.right;
        }
      }),
      t
    );
  },
  jo = (e) => {
    let t = new Set(),
      n = e.doc;
    for (let [r, i] of e.afterState.entries()) {
      let a = e.beforeState.get(r) || 0;
      i !== a &&
        ua(e, n.store.clients.get(r), a, i, (e) => {
          !e.deleted && e.content.constructor === K && e.constructor !== G && t.add(e.parent);
        });
    }
    B(n, (n) => {
      Xr(e, e.deleteSet, (e) => {
        if (e instanceof G || !e.parent._hasFormatting || t.has(e.parent)) return;
        let r = e.parent;
        e.content.constructor === K ? t.add(r) : ko(n, e);
      });
      for (let e of t) Ao(e);
    });
  },
  Mo = (e, t, n) => {
    let r = n,
      i = yt(t.currentAttributes),
      a = t.right;
    for (; n > 0 && t.right !== null;) {
      if (t.right.deleted === !1)
        switch (t.right.content.constructor) {
          case q:
          case $o:
          case ss:
            (n < t.right.length && z(e, I(t.right.id.client, t.right.id.clock + n)),
              (n -= t.right.length),
              t.right.delete(e));
        }
      t.forward();
    }
    a && Oo(e, a, t.right, i, t.currentAttributes);
    let o = (t.left || t.right).parent;
    return (o._searchMarker && Wa(o._searchMarker, t.index, -r + n), t);
  },
  No = class extends Fa {
    constructor(e, t, n) {
      (super(e, t),
        (this.childListChanged = !1),
        (this.keysChanged = new Set()),
        n.forEach((e) => {
          e === null ? (this.childListChanged = !0) : this.keysChanged.add(e);
        }));
    }
    get changes() {
      if (this._changes === null) {
        let e = { keys: this.keys, delta: this.delta, added: new Set(), deleted: new Set() };
        this._changes = e;
      }
      return this._changes;
    }
    get delta() {
      if (this._delta === null) {
        let e = this.target.doc,
          t = [];
        (B(e, (e) => {
          let n = new Map(),
            r = new Map(),
            i = this.target._start,
            a = null,
            o = {},
            s = ``,
            c = 0,
            l = 0,
            u = () => {
              if (a !== null) {
                let e = null;
                switch (a) {
                  case `delete`:
                    (l > 0 && (e = { delete: l }), (l = 0));
                    break;
                  case `insert`:
                    ((typeof s == `object` || s.length > 0) &&
                      ((e = { insert: s }),
                      n.size > 0 &&
                        ((e.attributes = {}),
                        n.forEach((t, n) => {
                          t !== null && (e.attributes[n] = t);
                        }))),
                      (s = ``));
                    break;
                  case `retain`:
                    (c > 0 && ((e = { retain: c }), jt(o) || (e.attributes = Dt({}, o))), (c = 0));
                }
                (e && t.push(e), (a = null));
              }
            };
          for (; i !== null;) {
            switch (i.content.constructor) {
              case q:
              case $o:
                this.adds(i)
                  ? this.deletes(i) || (u(), (a = `insert`), (s = i.content.getContent()[0]), u())
                  : this.deletes(i)
                    ? (a !== `delete` && (u(), (a = `delete`)), (l += 1))
                    : i.deleted || (a !== `retain` && (u(), (a = `retain`)), (c += 1));
                break;
              case ss:
                this.adds(i)
                  ? this.deletes(i) ||
                    (a !== `insert` && (u(), (a = `insert`)), (s += i.content.str))
                  : this.deletes(i)
                    ? (a !== `delete` && (u(), (a = `delete`)), (l += i.length))
                    : i.deleted || (a !== `retain` && (u(), (a = `retain`)), (c += i.length));
                break;
              case K: {
                let { key: t, value: s } = i.content;
                if (this.adds(i))
                  this.deletes(i) ||
                    (vo(n.get(t) ?? null, s)
                      ? s !== null && i.delete(e)
                      : (a === `retain` && u(),
                        vo(s, r.get(t) ?? null) ? delete o[t] : (o[t] = s)));
                else if (this.deletes(i)) {
                  r.set(t, s);
                  let e = n.get(t) ?? null;
                  vo(e, s) || (a === `retain` && u(), (o[t] = e));
                } else if (!i.deleted) {
                  r.set(t, s);
                  let n = o[t];
                  n !== void 0 &&
                    (vo(n, s)
                      ? n !== null && i.delete(e)
                      : (a === `retain` && u(), s === null ? delete o[t] : (o[t] = s)));
                }
                i.deleted || (a === `insert` && u(), Co(n, i.content));
                break;
              }
            }
            i = i.right;
          }
          for (u(); t.length > 0;) {
            let e = t[t.length - 1];
            if (e.retain !== void 0 && e.attributes === void 0) t.pop();
            else break;
          }
        }),
          (this._delta = t));
      }
      return this._delta;
    }
  },
  Po = class e extends H {
    constructor(e) {
      (super(),
        (this._pending = e === void 0 ? [] : [() => this.insert(0, e)]),
        (this._searchMarker = []),
        (this._hasFormatting = !1));
    }
    get length() {
      return (this.doc ?? V(), this._length);
    }
    _integrate(e, t) {
      super._integrate(e, t);
      try {
        this._pending.forEach((e) => e());
      } catch (e) {
        console.error(e);
      }
      this._pending = null;
    }
    _copy() {
      return new e();
    }
    clone() {
      let t = new e();
      return (t.applyDelta(this.toDelta()), t);
    }
    _callObserver(e, t) {
      super._callObserver(e, t);
      let n = new No(this, e, t);
      (Ga(this, e, n), !e.local && this._hasFormatting && (e._needFormattingCleanup = !0));
    }
    toString() {
      this.doc ?? V();
      let e = ``,
        t = this._start;
      for (; t !== null;)
        (!t.deleted && t.countable && t.content.constructor === ss && (e += t.content.str),
          (t = t.right));
      return e;
    }
    toJSON() {
      return this.toString();
    }
    applyDelta(e, { sanitize: t = !0 } = {}) {
      this.doc === null
        ? this._pending.push(() => this.applyDelta(e))
        : B(this.doc, (n) => {
            let r = new yo(null, this._start, 0, new Map());
            for (let i = 0; i < e.length; i++) {
              let a = e[i];
              if (a.insert !== void 0) {
                let o =
                  !t &&
                  typeof a.insert == `string` &&
                  i === e.length - 1 &&
                  r.right === null &&
                  a.insert.slice(-1) ===
                    `
`
                    ? a.insert.slice(0, -1)
                    : a.insert;
                (typeof o != `string` || o.length > 0) && Eo(n, this, r, o, a.attributes || {});
              } else
                a.retain === void 0
                  ? a.delete !== void 0 && Mo(n, r, a.delete)
                  : Do(n, this, r, a.retain, a.attributes || {});
            }
          });
    }
    toDelta(e, t, n) {
      this.doc ?? V();
      let r = [],
        i = new Map(),
        a = this.doc,
        o = ``,
        s = this._start;
      function c() {
        if (o.length > 0) {
          let e = {},
            t = !1;
          i.forEach((n, r) => {
            ((t = !0), (e[r] = n));
          });
          let n = { insert: o };
          (t && (n.attributes = e), r.push(n), (o = ``));
        }
      }
      let l = () => {
        for (; s !== null;) {
          if (ta(s, e) || (t !== void 0 && ta(s, t)))
            switch (s.content.constructor) {
              case ss: {
                let r = i.get(`ychange`);
                (e !== void 0 && !ta(s, e)
                  ? (r === void 0 || r.user !== s.id.client || r.type !== `removed`) &&
                    (c(), i.set(`ychange`, n ? n(`removed`, s.id) : { type: `removed` }))
                  : t !== void 0 && !ta(s, t)
                    ? (r === void 0 || r.user !== s.id.client || r.type !== `added`) &&
                      (c(), i.set(`ychange`, n ? n(`added`, s.id) : { type: `added` }))
                    : r !== void 0 && (c(), i.delete(`ychange`)),
                  (o += s.content.str));
                break;
              }
              case q:
              case $o: {
                c();
                let e = { insert: s.content.getContent()[0] };
                if (i.size > 0) {
                  let t = {};
                  ((e.attributes = t),
                    i.forEach((e, n) => {
                      t[n] = e;
                    }));
                }
                r.push(e);
                break;
              }
              case K:
                ta(s, e) && (c(), Co(i, s.content));
            }
          s = s.right;
        }
        c();
      };
      return (
        e || t
          ? B(
              a,
              (n) => {
                (e && na(n, e), t && na(n, t), l());
              },
              `cleanup`,
            )
          : l(),
        r
      );
    }
    insert(e, t, n) {
      if (t.length <= 0) return;
      let r = this.doc;
      r === null
        ? this._pending.push(() => this.insert(e, t, n))
        : B(r, (r) => {
            let i = xo(r, this, e, !n);
            (n ||
              ((n = {}),
              i.currentAttributes.forEach((e, t) => {
                n[t] = e;
              })),
              Eo(r, this, i, t, n));
          });
    }
    insertEmbed(e, t, n) {
      let r = this.doc;
      r === null
        ? this._pending.push(() => this.insertEmbed(e, t, n || {}))
        : B(r, (r) => {
            let i = xo(r, this, e, !n);
            Eo(r, this, i, t, n || {});
          });
    }
    delete(e, t) {
      if (t === 0) return;
      let n = this.doc;
      n === null
        ? this._pending.push(() => this.delete(e, t))
        : B(n, (n) => {
            Mo(n, xo(n, this, e, !0), t);
          });
    }
    format(e, t, n) {
      if (t === 0) return;
      let r = this.doc;
      r === null
        ? this._pending.push(() => this.format(e, t, n))
        : B(r, (r) => {
            let i = xo(r, this, e, !1);
            i.right !== null && Do(r, this, i, t, n);
          });
    }
    removeAttribute(e) {
      this.doc === null
        ? this._pending.push(() => this.removeAttribute(e))
        : B(this.doc, (t) => {
            io(t, this, e);
          });
    }
    setAttribute(e, t) {
      this.doc === null
        ? this._pending.push(() => this.setAttribute(e, t))
        : B(this.doc, (n) => {
            ao(n, this, e, t);
          });
    }
    getAttribute(e) {
      return oo(this, e);
    }
    getAttributes() {
      return so(this);
    }
    _write(e) {
      e.writeTypeRef(fs);
    }
  },
  Fo = (e) => new Po(),
  Io = class {
    constructor(e, t = () => !0) {
      ((this._filter = t),
        (this._root = e),
        (this._currentNode = e._start),
        (this._firstCall = !0),
        e.doc ?? V());
    }
    [Symbol.iterator]() {
      return this;
    }
    next() {
      let e = this._currentNode,
        t = e && e.content && e.content.type;
      if (e !== null && (!this._firstCall || e.deleted || !this._filter(t)))
        do
          if (
            ((t = e.content.type),
            !e.deleted && (t.constructor === U || t.constructor === Lo) && t._start !== null)
          )
            e = t._start;
          else
            for (; e !== null;) {
              let t = e.next;
              if (t !== null) {
                e = t;
                break;
              }
              e = e.parent === this._root ? null : e.parent._item;
            }
        while (e !== null && (e.deleted || !this._filter(e.content.type)));
      return (
        (this._firstCall = !1),
        e === null
          ? { value: void 0, done: !0 }
          : ((this._currentNode = e), { value: e.content.type, done: !1 })
      );
    }
  },
  Lo = class e extends H {
    constructor() {
      (super(), (this._prelimContent = []));
    }
    get firstChild() {
      let e = this._first;
      return e ? e.content.getContent()[0] : null;
    }
    _integrate(e, t) {
      (super._integrate(e, t), this.insert(0, this._prelimContent), (this._prelimContent = null));
    }
    _copy() {
      return new e();
    }
    clone() {
      let t = new e();
      return (
        t.insert(
          0,
          this.toArray().map((e) => (e instanceof H ? e.clone() : e)),
        ),
        t
      );
    }
    get length() {
      return (
        this.doc ?? V(),
        this._prelimContent === null ? this._length : this._prelimContent.length
      );
    }
    createTreeWalker(e) {
      return new Io(this, e);
    }
    querySelector(e) {
      e = e.toUpperCase();
      let t = new Io(this, (t) => t.nodeName && t.nodeName.toUpperCase() === e).next();
      return t.done ? null : t.value;
    }
    querySelectorAll(e) {
      return (
        (e = e.toUpperCase()),
        g(new Io(this, (t) => t.nodeName && t.nodeName.toUpperCase() === e))
      );
    }
    _callObserver(e, t) {
      Ga(this, e, new Bo(this, t, e));
    }
    toString() {
      return Xa(this, (e) => e.toString()).join(``);
    }
    toJSON() {
      return this.toString();
    }
    toDOM(e = document, t = {}, n) {
      let r = e.createDocumentFragment();
      return (
        n !== void 0 && n._createAssociation(r, this),
        Ya(this, (i) => {
          r.insertBefore(i.toDOM(e, t, n), null);
        }),
        r
      );
    }
    insert(e, t) {
      this.doc === null
        ? this._prelimContent.splice(e, 0, ...t)
        : B(this.doc, (n) => {
            to(n, this, e, t);
          });
    }
    insertAfter(e, t) {
      if (this.doc !== null)
        B(this.doc, (n) => {
          let r = e && e instanceof H ? e._item : e;
          $a(n, this, r, t);
        });
      else {
        let n = this._prelimContent,
          r = e === null ? 0 : n.findIndex((t) => t === e) + 1;
        if (r === 0 && e !== null) throw C(`Reference item not found`);
        n.splice(r, 0, ...t);
      }
    }
    delete(e, t = 1) {
      this.doc === null
        ? this._prelimContent.splice(e, t)
        : B(this.doc, (n) => {
            ro(n, this, e, t);
          });
    }
    toArray() {
      return qa(this);
    }
    push(e) {
      this.insert(this.length, e);
    }
    unshift(e) {
      this.insert(0, e);
    }
    get(e) {
      return Qa(this, e);
    }
    slice(e = 0, t = this.length) {
      return Ka(this, e, t);
    }
    forEach(e) {
      Ya(this, e);
    }
    _write(e) {
      e.writeTypeRef(ms);
    }
  },
  Ro = (e) => new Lo(),
  U = class e extends Lo {
    constructor(e = `UNDEFINED`) {
      (super(), (this.nodeName = e), (this._prelimAttrs = new Map()));
    }
    get nextSibling() {
      let e = this._item ? this._item.next : null;
      return e ? e.content.type : null;
    }
    get prevSibling() {
      let e = this._item ? this._item.prev : null;
      return e ? e.content.type : null;
    }
    _integrate(e, t) {
      (super._integrate(e, t),
        this._prelimAttrs.forEach((e, t) => {
          this.setAttribute(t, e);
        }),
        (this._prelimAttrs = null));
    }
    _copy() {
      return new e(this.nodeName);
    }
    clone() {
      let t = new e(this.nodeName);
      return (
        kt(this.getAttributes(), (e, n) => {
          t.setAttribute(n, e);
        }),
        t.insert(
          0,
          this.toArray().map((e) => (e instanceof H ? e.clone() : e)),
        ),
        t
      );
    }
    toString() {
      let e = this.getAttributes(),
        t = [],
        n = [];
      for (let t in e) n.push(t);
      n.sort();
      let r = n.length;
      for (let i = 0; i < r; i++) {
        let r = n[i];
        t.push(r + `="` + e[r] + `"`);
      }
      let i = this.nodeName.toLocaleLowerCase();
      return `<${i}${t.length > 0 ? ` ` + t.join(` `) : ``}>${super.toString()}</${i}>`;
    }
    removeAttribute(e) {
      this.doc === null
        ? this._prelimAttrs.delete(e)
        : B(this.doc, (t) => {
            io(t, this, e);
          });
    }
    setAttribute(e, t) {
      this.doc === null
        ? this._prelimAttrs.set(e, t)
        : B(this.doc, (n) => {
            ao(n, this, e, t);
          });
    }
    getAttribute(e) {
      return oo(this, e);
    }
    hasAttribute(e) {
      return co(this, e);
    }
    getAttributes(e) {
      return e ? lo(this, e) : so(this);
    }
    toDOM(e = document, t = {}, n) {
      let r = e.createElement(this.nodeName),
        i = this.getAttributes();
      for (let e in i) {
        let t = i[e];
        typeof t == `string` && r.setAttribute(e, t);
      }
      return (
        Ya(this, (i) => {
          r.appendChild(i.toDOM(e, t, n));
        }),
        n !== void 0 && n._createAssociation(r, this),
        r
      );
    }
    _write(e) {
      (e.writeTypeRef(ps), e.writeKey(this.nodeName));
    }
  },
  zo = (e) => new U(e.readKey()),
  Bo = class extends Fa {
    constructor(e, t, n) {
      (super(e, n),
        (this.childListChanged = !1),
        (this.attributesChanged = new Set()),
        t.forEach((e) => {
          e === null ? (this.childListChanged = !0) : this.attributesChanged.add(e);
        }));
    }
  },
  Vo = class e extends go {
    constructor(e) {
      (super(), (this.hookName = e));
    }
    _copy() {
      return new e(this.hookName);
    }
    clone() {
      let t = new e(this.hookName);
      return (
        this.forEach((e, n) => {
          t.set(n, e);
        }),
        t
      );
    }
    toDOM(e = document, t = {}, n) {
      let r = t[this.hookName],
        i;
      return (
        (i = r === void 0 ? document.createElement(this.hookName) : r.createDom(this)),
        i.setAttribute(`data-yjs-hook`, this.hookName),
        n !== void 0 && n._createAssociation(i, this),
        i
      );
    }
    _write(e) {
      (e.writeTypeRef(hs), e.writeKey(this.hookName));
    }
  },
  Ho = (e) => new Vo(e.readKey()),
  W = class e extends Po {
    get nextSibling() {
      let e = this._item ? this._item.next : null;
      return e ? e.content.type : null;
    }
    get prevSibling() {
      let e = this._item ? this._item.prev : null;
      return e ? e.content.type : null;
    }
    _copy() {
      return new e();
    }
    clone() {
      let t = new e();
      return (t.applyDelta(this.toDelta()), t);
    }
    toDOM(e = document, t, n) {
      let r = e.createTextNode(this.toString());
      return (n !== void 0 && n._createAssociation(r, this), r);
    }
    toString() {
      return this.toDelta()
        .map((e) => {
          let t = [];
          for (let n in e.attributes) {
            let r = [];
            for (let t in e.attributes[n]) r.push({ key: t, value: e.attributes[n][t] });
            (r.sort((e, t) => (e.key < t.key ? -1 : 1)), t.push({ nodeName: n, attrs: r }));
          }
          t.sort((e, t) => (e.nodeName < t.nodeName ? -1 : 1));
          let n = ``;
          for (let e = 0; e < t.length; e++) {
            let r = t[e];
            n += `<${r.nodeName}`;
            for (let e = 0; e < r.attrs.length; e++) {
              let t = r.attrs[e];
              n += ` ${t.key}="${t.value}"`;
            }
            n += `>`;
          }
          n += e.insert;
          for (let e = t.length - 1; e >= 0; e--) n += `</${t[e].nodeName}>`;
          return n;
        })
        .join(``);
    }
    toJSON() {
      return this.toString();
    }
    _write(e) {
      e.writeTypeRef(gs);
    }
  },
  Uo = (e) => new W(),
  Wo = class {
    constructor(e, t) {
      ((this.id = e), (this.length = t));
    }
    get deleted() {
      throw w();
    }
    mergeWith(e) {
      return !1;
    }
    write(e, t, n) {
      throw w();
    }
    integrate(e, t) {
      throw w();
    }
  },
  Go = 0,
  G = class extends Wo {
    get deleted() {
      return !0;
    }
    delete() {}
    mergeWith(e) {
      return this.constructor === e.constructor && ((this.length += e.length), !0);
    }
    integrate(e, t) {
      (t > 0 && ((this.id.clock += t), (this.length -= t)), aa(e.doc.store, this));
    }
    write(e, t) {
      (e.writeInfo(Go), e.writeLen(this.length - t));
    }
    getMissing(e, t) {
      return null;
    }
  },
  Ko = class e {
    constructor(e) {
      this.content = e;
    }
    getLength() {
      return 1;
    }
    getContent() {
      return [this.content];
    }
    isCountable() {
      return !0;
    }
    copy() {
      return new e(this.content);
    }
    splice(e) {
      throw w();
    }
    mergeWith(e) {
      return !1;
    }
    integrate(e, t) {}
    delete(e) {}
    gc(e) {}
    write(e, t) {
      e.writeBuf(this.content);
    }
    getRef() {
      return 3;
    }
  },
  qo = (e) => new Ko(e.readBuf()),
  Jo = class e {
    constructor(e) {
      this.len = e;
    }
    getLength() {
      return this.len;
    }
    getContent() {
      return [];
    }
    isCountable() {
      return !1;
    }
    copy() {
      return new e(this.len);
    }
    splice(t) {
      let n = new e(this.len - t);
      return ((this.len = t), n);
    }
    mergeWith(e) {
      return ((this.len += e.len), !0);
    }
    integrate(e, t) {
      (ti(e.deleteSet, t.id.client, t.id.clock, this.len), t.markDeleted());
    }
    delete(e) {}
    gc(e) {}
    write(e, t) {
      e.writeLen(this.len - t);
    }
    getRef() {
      return 1;
    }
  },
  Yo = (e) => new Jo(e.readLen()),
  Xo = (e, t) => new ci({ guid: e, ...t, shouldLoad: t.shouldLoad || t.autoLoad || !1 }),
  Zo = class e {
    constructor(e) {
      (e._item &&
        console.error(
          `This document was already integrated as a sub-document. You should create a second instance instead with the same guid.`,
        ),
        (this.doc = e));
      let t = {};
      ((this.opts = t),
        e.gc || (t.gc = !1),
        e.autoLoad && (t.autoLoad = !0),
        e.meta !== null && (t.meta = e.meta));
    }
    getLength() {
      return 1;
    }
    getContent() {
      return [this.doc];
    }
    isCountable() {
      return !0;
    }
    copy() {
      return new e(Xo(this.doc.guid, this.opts));
    }
    splice(e) {
      throw w();
    }
    mergeWith(e) {
      return !1;
    }
    integrate(e, t) {
      ((this.doc._item = t),
        e.subdocsAdded.add(this.doc),
        this.doc.shouldLoad && e.subdocsLoaded.add(this.doc));
    }
    delete(e) {
      e.subdocsAdded.has(this.doc)
        ? e.subdocsAdded.delete(this.doc)
        : e.subdocsRemoved.add(this.doc);
    }
    gc(e) {}
    write(e, t) {
      (e.writeString(this.doc.guid), e.writeAny(this.opts));
    }
    getRef() {
      return 9;
    }
  },
  Qo = (e) => new Zo(Xo(e.readString(), e.readAny())),
  $o = class e {
    constructor(e) {
      this.embed = e;
    }
    getLength() {
      return 1;
    }
    getContent() {
      return [this.embed];
    }
    isCountable() {
      return !0;
    }
    copy() {
      return new e(this.embed);
    }
    splice(e) {
      throw w();
    }
    mergeWith(e) {
      return !1;
    }
    integrate(e, t) {}
    delete(e) {}
    gc(e) {}
    write(e, t) {
      e.writeJSON(this.embed);
    }
    getRef() {
      return 5;
    }
  },
  es = (e) => new $o(e.readJSON()),
  K = class e {
    constructor(e, t) {
      ((this.key = e), (this.value = t));
    }
    getLength() {
      return 1;
    }
    getContent() {
      return [];
    }
    isCountable() {
      return !1;
    }
    copy() {
      return new e(this.key, this.value);
    }
    splice(e) {
      throw w();
    }
    mergeWith(e) {
      return !1;
    }
    integrate(e, t) {
      let n = t.parent;
      ((n._searchMarker = null), (n._hasFormatting = !0));
    }
    delete(e) {}
    gc(e) {}
    write(e, t) {
      (e.writeKey(this.key), e.writeJSON(this.value));
    }
    getRef() {
      return 6;
    }
  },
  ts = (e) => new K(e.readKey(), e.readJSON()),
  ns = class e {
    constructor(e) {
      this.arr = e;
    }
    getLength() {
      return this.arr.length;
    }
    getContent() {
      return this.arr;
    }
    isCountable() {
      return !0;
    }
    copy() {
      return new e(this.arr);
    }
    splice(t) {
      let n = new e(this.arr.slice(t));
      return ((this.arr = this.arr.slice(0, t)), n);
    }
    mergeWith(e) {
      return ((this.arr = this.arr.concat(e.arr)), !0);
    }
    integrate(e, t) {}
    delete(e) {}
    gc(e) {}
    write(e, t) {
      let n = this.arr.length;
      e.writeLen(n - t);
      for (let r = t; r < n; r++) {
        let t = this.arr[r];
        e.writeString(t === void 0 ? `undefined` : JSON.stringify(t));
      }
    }
    getRef() {
      return 2;
    }
  },
  rs = (e) => {
    let t = e.readLen(),
      n = [];
    for (let r = 0; r < t; r++) {
      let t = e.readString();
      t === `undefined` ? n.push(void 0) : n.push(JSON.parse(t));
    }
    return new ns(n);
  },
  is = nn(`node_env`) === `development`,
  as = class e {
    constructor(e) {
      ((this.arr = e), is && It(e));
    }
    getLength() {
      return this.arr.length;
    }
    getContent() {
      return this.arr;
    }
    isCountable() {
      return !0;
    }
    copy() {
      return new e(this.arr);
    }
    splice(t) {
      let n = new e(this.arr.slice(t));
      return ((this.arr = this.arr.slice(0, t)), n);
    }
    mergeWith(e) {
      return ((this.arr = this.arr.concat(e.arr)), !0);
    }
    integrate(e, t) {}
    delete(e) {}
    gc(e) {}
    write(e, t) {
      let n = this.arr.length;
      e.writeLen(n - t);
      for (let r = t; r < n; r++) {
        let t = this.arr[r];
        e.writeAny(t);
      }
    }
    getRef() {
      return 8;
    }
  },
  os = (e) => {
    let t = e.readLen(),
      n = [];
    for (let r = 0; r < t; r++) n.push(e.readAny());
    return new as(n);
  },
  ss = class e {
    constructor(e) {
      this.str = e;
    }
    getLength() {
      return this.str.length;
    }
    getContent() {
      return this.str.split(``);
    }
    isCountable() {
      return !0;
    }
    copy() {
      return new e(this.str);
    }
    splice(t) {
      let n = new e(this.str.slice(t));
      this.str = this.str.slice(0, t);
      let r = this.str.charCodeAt(t - 1);
      return (
        r >= 55296 &&
          r <= 56319 &&
          ((this.str = this.str.slice(0, t - 1) + `�`), (n.str = `�` + n.str.slice(1))),
        n
      );
    }
    mergeWith(e) {
      return ((this.str += e.str), !0);
    }
    integrate(e, t) {}
    delete(e) {}
    gc(e) {}
    write(e, t) {
      e.writeString(t === 0 ? this.str : this.str.slice(t));
    }
    getRef() {
      return 4;
    }
  },
  cs = (e) => new ss(e.readString()),
  ls = [mo, _o, Fo, zo, Ro, Ho, Uo],
  us = 0,
  ds = 1,
  fs = 2,
  ps = 3,
  ms = 4,
  hs = 5,
  gs = 6,
  q = class e {
    constructor(e) {
      this.type = e;
    }
    getLength() {
      return 1;
    }
    getContent() {
      return [this.type];
    }
    isCountable() {
      return !0;
    }
    copy() {
      return new e(this.type._copy());
    }
    splice(e) {
      throw w();
    }
    mergeWith(e) {
      return !1;
    }
    integrate(e, t) {
      this.type._integrate(e.doc, t);
    }
    delete(e) {
      let t = this.type._start;
      for (; t !== null;)
        (t.deleted
          ? t.id.clock < (e.beforeState.get(t.id.client) || 0) && e._mergeStructs.push(t)
          : t.delete(e),
          (t = t.right));
      (this.type._map.forEach((t) => {
        t.deleted
          ? t.id.clock < (e.beforeState.get(t.id.client) || 0) && e._mergeStructs.push(t)
          : t.delete(e);
      }),
        e.changed.delete(this.type));
    }
    gc(e) {
      let t = this.type._start;
      for (; t !== null;) (t.gc(e, !0), (t = t.right));
      ((this.type._start = null),
        this.type._map.forEach((t) => {
          for (; t !== null;) (t.gc(e, !0), (t = t.left));
        }),
        (this.type._map = new Map()));
    }
    write(e, t) {
      this.type._write(e);
    }
    getRef() {
      return 7;
    }
  },
  _s = (e) => new q(ls[e.readTypeRef()](e)),
  vs = (e, t) => {
    let n = t,
      r = 0,
      i;
    do
      (r > 0 && (n = I(n.client, n.clock + r)),
        (i = oa(e, n)),
        (r = n.clock - i.id.clock),
        (n = i.redone));
    while (n !== null && i instanceof J);
    return { item: i, diff: r };
  },
  ys = (e, t) => {
    for (; e !== null && e.keep !== t;) ((e.keep = t), (e = e.parent._item));
  },
  bs = (e, t, n) => {
    let { client: r, clock: i } = t.id,
      a = new J(
        I(r, i + n),
        t,
        I(r, i + n - 1),
        t.right,
        t.rightOrigin,
        t.parent,
        t.parentSub,
        t.content.splice(n),
      );
    return (
      t.deleted && a.markDeleted(),
      t.keep && (a.keep = !0),
      t.redone !== null && (a.redone = I(t.redone.client, t.redone.clock + n)),
      (t.right = a),
      a.right !== null && (a.right.left = a),
      e._mergeStructs.push(a),
      a.parentSub !== null && a.right === null && a.parent._map.set(a.parentSub, a),
      (t.length = n),
      a
    );
  },
  xs = (e, t) => ue(e, (e) => Qr(e.deletions, t)),
  Ss = (e, t, n, r, i, a) => {
    let o = e.doc,
      s = o.store,
      c = o.clientID,
      l = t.redone;
    if (l !== null) return z(e, l);
    let u = t.parent._item,
      d = null,
      f;
    if (u !== null && u.deleted === !0) {
      if (u.redone === null && (!n.has(u) || Ss(e, u, n, r, i, a) === null)) return null;
      for (; u.redone !== null;) u = z(e, u.redone);
    }
    let p = u === null ? t.parent : u.content.type;
    if (t.parentSub === null) {
      for (d = t.left, f = t; d !== null;) {
        let t = d;
        for (; t !== null && t.parent._item !== u;) t = t.redone === null ? null : z(e, t.redone);
        if (t !== null && t.parent._item === u) {
          d = t;
          break;
        }
        d = d.left;
      }
      for (; f !== null;) {
        let t = f;
        for (; t !== null && t.parent._item !== u;) t = t.redone === null ? null : z(e, t.redone);
        if (t !== null && t.parent._item === u) {
          f = t;
          break;
        }
        f = f.right;
      }
    } else {
      if (((f = null), t.right && !i)) {
        for (
          d = t;
          d !== null &&
          d.right !== null &&
          (d.right.redone ||
            Qr(r, d.right.id) ||
            xs(a.undoStack, d.right.id) ||
            xs(a.redoStack, d.right.id));
        )
          for (d = d.right; d.redone;) d = z(e, d.redone);
        if (d && d.right !== null) return null;
      } else d = p._map.get(t.parentSub) || null;
      d !== null && d.parent._item !== u && (d = p._map.get(t.parentSub) || null);
    }
    let ee = I(c, L(s, c)),
      m = new J(ee, d, d && d.lastId, f, f && f.id, p, t.parentSub, t.content.copy());
    return ((t.redone = ee), ys(m, !0), m.integrate(e, 0), m);
  },
  J = class e extends Wo {
    constructor(e, t, n, r, i, a, o, s) {
      (super(e, s.getLength()),
        (this.origin = n),
        (this.left = t),
        (this.right = r),
        (this.rightOrigin = i),
        (this.parent = a),
        (this.parentSub = o),
        (this.redone = null),
        (this.content = s),
        (this.info = this.content.isCountable() ? 2 : 0));
    }
    set marker(e) {
      (this.info & 8) > 0 !== e && (this.info ^= 8);
    }
    get marker() {
      return (this.info & 8) > 0;
    }
    get keep() {
      return (this.info & 1) > 0;
    }
    set keep(e) {
      this.keep !== e && (this.info ^= 1);
    }
    get countable() {
      return (this.info & 2) > 0;
    }
    get deleted() {
      return (this.info & 4) > 0;
    }
    set deleted(e) {
      this.deleted !== e && (this.info ^= 4);
    }
    markDeleted() {
      this.info |= 4;
    }
    getMissing(t, n) {
      if (
        this.origin &&
        this.origin.client !== this.id.client &&
        this.origin.clock >= L(n, this.origin.client)
      )
        return this.origin.client;
      if (
        this.rightOrigin &&
        this.rightOrigin.client !== this.id.client &&
        this.rightOrigin.clock >= L(n, this.rightOrigin.client)
      )
        return this.rightOrigin.client;
      if (
        this.parent &&
        this.parent.constructor === zi &&
        this.id.client !== this.parent.client &&
        this.parent.clock >= L(n, this.parent.client)
      )
        return this.parent.client;
      if (
        ((this.origin &&= ((this.left = ca(t, n, this.origin)), this.left.lastId)),
        (this.rightOrigin &&= ((this.right = z(t, this.rightOrigin)), this.right.id)),
        (this.left && this.left.constructor === G) || (this.right && this.right.constructor === G))
      )
        this.parent = null;
      else if (!this.parent)
        this.left && this.left.constructor === e
          ? ((this.parent = this.left.parent), (this.parentSub = this.left.parentSub))
          : this.right &&
            this.right.constructor === e &&
            ((this.parent = this.right.parent), (this.parentSub = this.right.parentSub));
      else if (this.parent.constructor === zi) {
        let e = oa(n, this.parent);
        this.parent = e.constructor === G ? null : e.content.type;
      }
      return null;
    }
    integrate(e, t) {
      if (
        (t > 0 &&
          ((this.id.clock += t),
          (this.left = ca(e, e.doc.store, I(this.id.client, this.id.clock - 1))),
          (this.origin = this.left.lastId),
          (this.content = this.content.splice(t)),
          (this.length -= t)),
        this.parent)
      ) {
        if (
          (!this.left && (!this.right || this.right.left !== null)) ||
          (this.left && this.left.right !== this.right)
        ) {
          let t = this.left,
            n;
          if (t !== null) n = t.right;
          else if (this.parentSub !== null)
            for (n = this.parent._map.get(this.parentSub) || null; n !== null && n.left !== null;)
              n = n.left;
          else n = this.parent._start;
          let r = new Set(),
            i = new Set();
          for (; n !== null && n !== this.right;) {
            if ((i.add(n), r.add(n), Bi(this.origin, n.origin))) {
              if (n.id.client < this.id.client) ((t = n), r.clear());
              else if (Bi(this.rightOrigin, n.rightOrigin)) break;
            } else if (n.origin !== null && i.has(oa(e.doc.store, n.origin)))
              r.has(oa(e.doc.store, n.origin)) || ((t = n), r.clear());
            else break;
            n = n.right;
          }
          this.left = t;
        }
        if (this.left !== null) {
          let e = this.left.right;
          ((this.right = e), (this.left.right = this));
        } else {
          let e;
          if (this.parentSub !== null)
            for (e = this.parent._map.get(this.parentSub) || null; e !== null && e.left !== null;)
              e = e.left;
          else ((e = this.parent._start), (this.parent._start = this));
          this.right = e;
        }
        (this.right === null
          ? this.parentSub !== null &&
            (this.parent._map.set(this.parentSub, this), this.left !== null && this.left.delete(e))
          : (this.right.left = this),
          this.parentSub === null &&
            this.countable &&
            !this.deleted &&
            (this.parent._length += this.length),
          aa(e.doc.store, this),
          this.content.integrate(e, this),
          pa(e, this.parent, this.parentSub),
          ((this.parent._item !== null && this.parent._item.deleted) ||
            (this.parentSub !== null && this.right !== null)) &&
            this.delete(e));
      } else new G(this.id, this.length).integrate(e, 0);
    }
    get next() {
      let e = this.right;
      for (; e !== null && e.deleted;) e = e.right;
      return e;
    }
    get prev() {
      let e = this.left;
      for (; e !== null && e.deleted;) e = e.left;
      return e;
    }
    get lastId() {
      return this.length === 1 ? this.id : I(this.id.client, this.id.clock + this.length - 1);
    }
    mergeWith(e) {
      if (
        this.constructor === e.constructor &&
        Bi(e.origin, this.lastId) &&
        this.right === e &&
        Bi(this.rightOrigin, e.rightOrigin) &&
        this.id.client === e.id.client &&
        this.id.clock + this.length === e.id.clock &&
        this.deleted === e.deleted &&
        this.redone === null &&
        e.redone === null &&
        this.content.constructor === e.content.constructor &&
        this.content.mergeWith(e.content)
      ) {
        let t = this.parent._searchMarker;
        return (
          t &&
            t.forEach((t) => {
              t.p === e &&
                ((t.p = this), !this.deleted && this.countable && (t.index -= this.length));
            }),
          e.keep && (this.keep = !0),
          (this.right = e.right),
          this.right !== null && (this.right.left = this),
          (this.length += e.length),
          !0
        );
      }
      return !1;
    }
    delete(e) {
      if (!this.deleted) {
        let t = this.parent;
        (this.countable && this.parentSub === null && (t._length -= this.length),
          this.markDeleted(),
          ti(e.deleteSet, this.id.client, this.id.clock, this.length),
          pa(e, t, this.parentSub),
          this.content.delete(e));
      }
    }
    gc(e, t) {
      if (!this.deleted) throw T();
      (this.content.gc(e),
        t ? la(e, this, new G(this.id, this.length)) : (this.content = new Jo(this.length)));
    }
    write(e, t) {
      let n = t > 0 ? I(this.id.client, this.id.clock + t - 1) : this.origin,
        r = this.rightOrigin,
        i = this.parentSub,
        a =
          (this.content.getRef() & 31) |
          (n === null ? 0 : 128) |
          (r === null ? 0 : 64) |
          (i === null ? 0 : 32);
      if (
        (e.writeInfo(a),
        n !== null && e.writeLeftID(n),
        r !== null && e.writeRightID(r),
        n === null && r === null)
      ) {
        let t = this.parent;
        if (t._item !== void 0) {
          let n = t._item;
          if (n === null) {
            let n = Vi(t);
            (e.writeParentInfo(!0), e.writeString(n));
          } else (e.writeParentInfo(!1), e.writeLeftID(n.id));
        } else
          t.constructor === String
            ? (e.writeParentInfo(!0), e.writeString(t))
            : t.constructor === zi
              ? (e.writeParentInfo(!1), e.writeLeftID(t))
              : T();
        i !== null && e.writeString(i);
      }
      this.content.write(e, t);
    }
  },
  Cs = (e, t) => ws[t & 31](e),
  ws = [
    () => {
      T();
    },
    Yo,
    rs,
    qo,
    cs,
    es,
    ts,
    _s,
    os,
    Qo,
    () => {
      T();
    },
  ],
  Ts = 10,
  Y = class extends Wo {
    get deleted() {
      return !0;
    }
    delete() {}
    mergeWith(e) {
      return this.constructor === e.constructor && ((this.length += e.length), !0);
    }
    integrate(e, t) {
      T();
    }
    write(e, t) {
      (e.writeInfo(Ts), b(e.restEncoder, this.length - t));
    }
    getMissing(e, t) {
      return null;
    }
  },
  Es =
    typeof globalThis < `u`
      ? globalThis
      : typeof window < `u`
        ? window
        : typeof global < `u`
          ? global
          : {},
  Ds = `__ $YJS$ __`;
(Es[Ds] === !0 &&
  console.error(
    `Yjs was already imported. This breaks constructor checks and will lead to issues! - https://github.com/yjs/yjs/issues/438`,
  ),
  (Es[Ds] = !0));
var Os = 3e4,
  ks = class extends Ct {
    constructor(e) {
      (super(),
        (this.doc = e),
        (this.clientID = e.clientID),
        (this.states = new Map()),
        (this.meta = new Map()),
        (this._checkInterval = setInterval(
          () => {
            let e = vt();
            this.getLocalState() !== null &&
              15e3 <= e - this.meta.get(this.clientID).lastUpdated &&
              this.setLocalState(this.getLocalState());
            let t = [];
            (this.meta.forEach((n, r) => {
              r !== this.clientID && 3e4 <= e - n.lastUpdated && this.states.has(r) && t.push(r);
            }),
              t.length > 0 && As(this, t, `timeout`));
          },
          p(Os / 10),
        )),
        e.on(`destroy`, () => {
          this.destroy();
        }),
        this.setLocalState({}));
    }
    destroy() {
      (this.emit(`destroy`, [this]),
        this.setLocalState(null),
        super.destroy(),
        clearInterval(this._checkInterval));
    }
    getLocalState() {
      return this.states.get(this.clientID) || null;
    }
    setLocalState(e) {
      let t = this.clientID,
        n = this.meta.get(t),
        r = n === void 0 ? 0 : n.clock + 1,
        i = this.states.get(t);
      (e === null ? this.states.delete(t) : this.states.set(t, e),
        this.meta.set(t, { clock: r, lastUpdated: vt() }));
      let a = [],
        o = [],
        s = [],
        c = [];
      (e === null
        ? c.push(t)
        : i == null
          ? e != null && a.push(t)
          : (o.push(t), zt(i, e) || s.push(t)),
        (a.length > 0 || s.length > 0 || c.length > 0) &&
          this.emit(`change`, [{ added: a, updated: s, removed: c }, `local`]),
        this.emit(`update`, [{ added: a, updated: o, removed: c }, `local`]));
    }
    setLocalStateField(e, t) {
      let n = this.getLocalState();
      n !== null && this.setLocalState({ ...n, [e]: t });
    }
    getStates() {
      return this.states;
    }
  },
  As = (e, t, n) => {
    let r = [];
    for (let n = 0; n < t.length; n++) {
      let i = t[n];
      if (e.states.has(i)) {
        if ((e.states.delete(i), i === e.clientID)) {
          let t = e.meta.get(i);
          e.meta.set(i, { clock: t.clock + 1, lastUpdated: vt() });
        }
        r.push(i);
      }
    }
    r.length > 0 &&
      (e.emit(`change`, [{ added: [], updated: [], removed: r }, n]),
      e.emit(`update`, [{ added: [], updated: [], removed: r }, n]));
  },
  js = (e, t, n = e.states) => {
    let r = t.length,
      i = _();
    b(i, r);
    for (let a = 0; a < r; a++) {
      let r = t[a],
        o = n.get(r) || null,
        s = e.meta.get(r).clock;
      (b(i, r), b(i, s), x(i, JSON.stringify(o)));
    }
    return v(i);
  },
  Ms = (e, t, n) => {
    let r = Ze(t),
      i = vt(),
      a = [],
      o = [],
      s = [],
      c = [],
      l = D(r);
    for (let t = 0; t < l; t++) {
      let t = D(r),
        n = D(r),
        l = JSON.parse(O(r)),
        u = e.meta.get(t),
        d = e.states.get(t),
        f = u === void 0 ? 0 : u.clock;
      (f < n || (f === n && l === null && e.states.has(t))) &&
        (l === null
          ? t === e.clientID && e.getLocalState() != null
            ? n++
            : e.states.delete(t)
          : e.states.set(t, l),
        e.meta.set(t, { clock: n, lastUpdated: i }),
        u === void 0 && l !== null
          ? a.push(t)
          : u !== void 0 && l === null
            ? c.push(t)
            : l !== null && (zt(l, d) || s.push(t), o.push(t)));
    }
    ((a.length > 0 || s.length > 0 || c.length > 0) &&
      e.emit(`change`, [{ added: a, updated: s, removed: c }, n]),
      (a.length > 0 || o.length > 0 || c.length > 0) &&
        e.emit(`update`, [{ added: a, updated: o, removed: c }, n]));
  };
function Ns(e) {
  return (
    (e ||= {}),
    {
      delay: e.delay === void 0 ? 200 : e.delay,
      initialDelay: e.initialDelay === void 0 ? 0 : e.initialDelay,
      minDelay: e.minDelay === void 0 ? 0 : e.minDelay,
      maxDelay: e.maxDelay === void 0 ? 0 : e.maxDelay,
      factor: e.factor === void 0 ? 0 : e.factor,
      maxAttempts: e.maxAttempts === void 0 ? 3 : e.maxAttempts,
      timeout: e.timeout === void 0 ? 0 : e.timeout,
      jitter: e.jitter === !0,
      initialJitter: e.initialJitter === !0,
      handleError: e.handleError === void 0 ? null : e.handleError,
      handleTimeout: e.handleTimeout === void 0 ? null : e.handleTimeout,
      beforeAttempt: e.beforeAttempt === void 0 ? null : e.beforeAttempt,
      calculateDelay: e.calculateDelay === void 0 ? null : e.calculateDelay,
    }
  );
}
async function Ps(e) {
  return new Promise((t) => setTimeout(t, e));
}
function Fs(e, t) {
  let n = t.delay;
  if (n === 0) return 0;
  if (
    (t.factor &&
      ((n *= t.factor ** (e.attemptNum - 1)), t.maxDelay !== 0 && (n = Math.min(n, t.maxDelay))),
    t.jitter)
  ) {
    let e = Math.ceil(t.minDelay);
    n = Math.floor(Math.random() * (Math.floor(n) - e + 1)) + e;
  }
  return Math.round(n);
}
async function Is(e, t) {
  let n = Ns(t);
  for (let e of [`delay`, `initialDelay`, `minDelay`, `maxDelay`, `maxAttempts`, `timeout`]) {
    let t = n[e];
    if (!Number.isInteger(t) || t < 0)
      throw Error(`Value for ${e} must be an integer greater than or equal to 0`);
  }
  if (n.factor.constructor !== Number || n.factor < 0)
    throw Error(`Value for factor must be a number greater than or equal to 0`);
  if (n.delay < n.minDelay)
    throw Error(`delay cannot be less than minDelay (delay: ${n.delay}, minDelay: ${n.minDelay}`);
  let r = {
      attemptNum: 0,
      attemptsRemaining: n.maxAttempts ? n.maxAttempts : -1,
      aborted: !1,
      abort() {
        r.aborted = !0;
      },
    },
    i = n.calculateDelay || Fs;
  async function a() {
    if ((n.beforeAttempt && n.beforeAttempt(r, n), r.aborted)) {
      let e = Error(`Attempt aborted`);
      throw ((e.code = `ATTEMPT_ABORTED`), e);
    }
    let t = async (e) => {
      if ((n.handleError && (await n.handleError(e, r, n)), r.aborted || r.attemptsRemaining === 0))
        throw e;
      r.attemptNum++;
      let t = i(r, n);
      return (t && (await Ps(t)), a());
    };
    return (
      r.attemptsRemaining > 0 && r.attemptsRemaining--,
      n.timeout
        ? new Promise((i, a) => {
            let o = setTimeout(() => {
              if (n.handleTimeout)
                try {
                  i(n.handleTimeout(r, n));
                } catch (e) {
                  a(e);
                }
              else {
                let e = Error(`Retry timeout (attemptNum: ${r.attemptNum}, timeout: ${n.timeout})`);
                ((e.code = `ATTEMPT_TIMEOUT`), a(e));
              }
            }, n.timeout);
            e(r, n)
              .then((e) => {
                (clearTimeout(o), i(e));
              })
              .catch((e) => {
                (clearTimeout(o), t(e).then(i).catch(a));
              });
          })
        : e(r, n).catch(t)
    );
  }
  let o = n.calculateDelay ? n.calculateDelay(r, n) : n.initialDelay;
  if ((o && (await Ps(o)), r.attemptNum < 1 && n.initialJitter)) {
    let e = i(r, n);
    e && (await Ps(e));
  }
  return a();
}
var Ls = (e, t) => {
    (b(e, 0), S(e, Ni(t)));
  },
  Rs = (e, t, n) => {
    (b(e, 1), S(e, Di(t, n)));
  },
  zs = (e, t, n) => Rs(t, n, E(e)),
  Bs = (e, t, n, r) => {
    try {
      wi(t, E(e), n);
    } catch (e) {
      (r?.(e), console.error(`Caught error while handling a Yjs update`, e));
    }
  },
  Vs = (e, t) => {
    (b(e, 2), S(e, t));
  },
  Hs = Bs,
  Us = (e, t, n, r, i) => {
    let a = D(e);
    switch (a) {
      case 0:
        zs(e, t, n);
        break;
      case 1:
        Bs(e, n, r, i);
        break;
      case 2:
        Hs(e, n, r, i);
        break;
      default:
        throw Error(`Unknown message type`);
    }
    return a;
  },
  Ws = class {
    constructor() {
      this.callbacks = {};
    }
    on(e, t) {
      return (this.callbacks[e] || (this.callbacks[e] = []), this.callbacks[e].push(t), this);
    }
    emit(e, ...t) {
      let n = this.callbacks[e];
      return (n && n.forEach((e) => e.apply(this, t)), this);
    }
    off(e, t) {
      let n = this.callbacks[e];
      return (
        n && (t ? (this.callbacks[e] = n.filter((e) => e !== t)) : delete this.callbacks[e]),
        this
      );
    }
    removeAllListeners() {
      this.callbacks = {};
    }
  },
  Gs = class {
    constructor(e) {
      ((this.data = e), (this.encoder = _()), (this.decoder = Ze(new Uint8Array(this.data))));
    }
    peekVarString() {
      return nt(this.decoder);
    }
    readVarUint() {
      return D(this.decoder);
    }
    readVarString() {
      return O(this.decoder);
    }
    readVarUint8Array() {
      return E(this.decoder);
    }
    writeVarUint(e) {
      return b(this.encoder, e);
    }
    writeVarString(e) {
      return x(this.encoder, e);
    }
    writeVarUint8Array(e) {
      return S(this.encoder, e);
    }
    length() {
      return Ee(this.encoder);
    }
  },
  X = (function (e) {
    return (
      (e[(e.Sync = 0)] = `Sync`),
      (e[(e.Awareness = 1)] = `Awareness`),
      (e[(e.Auth = 2)] = `Auth`),
      (e[(e.QueryAwareness = 3)] = `QueryAwareness`),
      (e[(e.Stateless = 5)] = `Stateless`),
      (e[(e.CLOSE = 7)] = `CLOSE`),
      (e[(e.SyncStatus = 8)] = `SyncStatus`),
      (e[(e.Ping = 9)] = `Ping`),
      (e[(e.Pong = 10)] = `Pong`),
      e
    );
  })({}),
  Z = (function (e) {
    return (
      (e.Connecting = `connecting`),
      (e.Connected = `connected`),
      (e.Disconnected = `disconnected`),
      e
    );
  })({}),
  Ks = class {
    constructor() {
      this.encoder = _();
    }
    get(e) {
      return e.encoder;
    }
    toUint8Array() {
      return v(this.encoder);
    }
  },
  qs = class extends Ks {
    constructor(...e) {
      (super(...e),
        (this.type = X.CLOSE),
        (this.description = `Ask the server to close the connection`));
    }
    get(e) {
      return (x(this.encoder, e.documentName), b(this.encoder, this.type), this.encoder);
    }
  },
  Js = class e extends Ws {
    static {
      this.DEDUPLICATABLE_TYPES = new Set([X.Awareness, X.QueryAwareness]);
    }
    constructor(e) {
      (super(),
        (this.messageQueue = []),
        (this.configuration = {
          url: ``,
          autoConnect: !0,
          preserveTrailingSlash: !1,
          document: void 0,
          WebSocketPolyfill: void 0,
          messageReconnectTimeout: 3e4,
          delay: 1e3,
          initialDelay: 0,
          factor: 2,
          maxAttempts: 0,
          minDelay: 1e3,
          maxDelay: 3e4,
          jitter: !0,
          timeout: 0,
          onOpen: () => null,
          onConnect: () => null,
          onMessage: () => null,
          onOutgoingMessage: () => null,
          onStatus: () => null,
          onDisconnect: () => null,
          onClose: () => null,
          onMaxAttemptsFailed: () => null,
          onDestroy: () => null,
          onAwarenessUpdate: () => null,
          onAwarenessChange: () => null,
          handleTimeout: null,
          providerMap: new Map(),
        }),
        (this.webSocket = null),
        (this.webSocketHandlers = {}),
        (this.shouldConnect = !0),
        (this.status = Z.Disconnected),
        (this.lastMessageReceived = 0),
        (this.identifier = 0),
        (this.intervals = { connectionChecker: null }),
        (this.connectionAttempt = null),
        (this.receivedOnOpenPayload = void 0),
        (this.reconnectTimeout = null),
        (this.closeTries = 0),
        this.setConfiguration(e),
        (this.configuration.WebSocketPolyfill = e.WebSocketPolyfill
          ? e.WebSocketPolyfill
          : WebSocket),
        this.on(`open`, this.configuration.onOpen),
        this.on(`open`, this.onOpen.bind(this)),
        this.on(`connect`, this.configuration.onConnect),
        this.on(`message`, this.configuration.onMessage),
        this.on(`outgoingMessage`, this.configuration.onOutgoingMessage),
        this.on(`status`, this.configuration.onStatus),
        this.on(`disconnect`, this.configuration.onDisconnect),
        this.on(`close`, this.configuration.onClose),
        this.on(`maxAttemptsFailed`, this.configuration.onMaxAttemptsFailed),
        this.on(`destroy`, this.configuration.onDestroy),
        this.on(`awarenessUpdate`, this.configuration.onAwarenessUpdate),
        this.on(`awarenessChange`, this.configuration.onAwarenessChange),
        this.on(`close`, this.onClose.bind(this)),
        this.on(`message`, this.onMessage.bind(this)),
        (this.intervals.connectionChecker = setInterval(
          this.checkConnection.bind(this),
          this.configuration.messageReconnectTimeout / 10,
        )),
        this.shouldConnect && this.connect());
    }
    async onOpen(e) {
      ((this.status = Z.Connected),
        this.emit(`status`, { status: Z.Connected }),
        (this.receivedOnOpenPayload = e));
    }
    attach(e) {
      let t = e.effectiveName,
        n = this.configuration.providerMap.get(t);
      if (n && n !== e && n.isAuthenticated)
        throw Error(
          `Cannot attach two providers with the same effective name "${t}". Use sessionAwareness: true to multiplex providers with the same document name.`,
        );
      (this.configuration.providerMap.set(t, e),
        this.status === Z.Disconnected && this.shouldConnect && this.connect(),
        this.receivedOnOpenPayload &&
          this.status === Z.Connected &&
          e.onOpen(this.receivedOnOpenPayload));
    }
    detach(e) {
      let t = e.effectiveName;
      this.configuration.providerMap.has(t) &&
        (e.send(qs, { documentName: t }), this.configuration.providerMap.delete(t));
    }
    setConfiguration(e = {}) {
      ((this.configuration = { ...this.configuration, ...e }),
        this.configuration.autoConnect || (this.shouldConnect = !1));
    }
    clearReconnectTimeout() {
      this.reconnectTimeout &&= (clearTimeout(this.reconnectTimeout), null);
    }
    async connect() {
      if (this.status === Z.Connected) return;
      (this.clearReconnectTimeout(),
        (this.cancelWebsocketRetry &&= (this.cancelWebsocketRetry(), void 0)),
        (this.receivedOnOpenPayload = void 0),
        (this.shouldConnect = !0));
      let { retryPromise: e, cancelFunc: t } = (() => {
        let e = !1;
        return {
          retryPromise: Is(this.createWebSocketConnection.bind(this), {
            delay: this.configuration.delay,
            initialDelay: this.configuration.initialDelay,
            factor: this.configuration.factor,
            maxAttempts: this.configuration.maxAttempts,
            minDelay: this.configuration.minDelay,
            maxDelay: this.configuration.maxDelay,
            jitter: this.configuration.jitter,
            timeout: this.configuration.timeout,
            handleTimeout: this.configuration.handleTimeout,
            beforeAttempt: (t) => {
              (!this.shouldConnect || e) && t.abort();
            },
          }).catch((e) => {
            e?.code !== `ATTEMPT_ABORTED` && this.emit(`maxAttemptsFailed`, { error: e });
          }),
          cancelFunc: () => {
            e = !0;
          },
        };
      })();
      return ((this.cancelWebsocketRetry = t), e);
    }
    attachWebSocketListeners(e, t) {
      let { identifier: n } = e,
        r = (e) => this.emit(`message`, e),
        i = (e) => this.emit(`close`, { event: e }),
        a = (e) => this.emit(`open`, e),
        o = (e) => {
          t(e);
        };
      this.webSocketHandlers[n] = { message: r, close: i, open: a, error: o };
      let s = this.webSocketHandlers[e.identifier];
      Object.keys(s).forEach((t) => {
        e.addEventListener(t, s[t]);
      });
    }
    cleanupWebSocket() {
      if (!this.webSocket) return;
      let { identifier: e } = this.webSocket,
        t = this.webSocketHandlers[e];
      (Object.keys(t).forEach((n) => {
        (this.webSocket?.removeEventListener(n, t[n]), delete this.webSocketHandlers[e]);
      }),
        this.webSocket.close(),
        (this.webSocket = null));
    }
    createWebSocketConnection() {
      return new Promise((e, t) => {
        (this.webSocket && ((this.messageQueue = []), this.cleanupWebSocket()),
          (this.lastMessageReceived = 0),
          (this.identifier += 1));
        let n = new this.configuration.WebSocketPolyfill(this.url);
        ((n.binaryType = `arraybuffer`),
          (n.identifier = this.identifier),
          this.attachWebSocketListeners(n, t),
          (this.webSocket = n),
          (this.status = Z.Connecting),
          this.emit(`status`, { status: Z.Connecting }),
          (this.connectionAttempt = { resolve: e, reject: t }));
      });
    }
    onMessage(e) {
      (this.resolveConnectionAttempt(), (this.lastMessageReceived = vt()));
      let t = new Uint8Array(e.data);
      if (t.length === 1 && t[0] === X.Ping) {
        this.sendPong();
        return;
      }
      let n = new Gs(t).peekVarString();
      this.configuration.providerMap.get(n)?.onMessage(e);
    }
    sendPong() {
      let e = _();
      (b(e, X.Pong), this.send(v(e)));
    }
    resolveConnectionAttempt() {
      this.connectionAttempt &&
        ((this.cancelWebsocketRetry = void 0),
        this.connectionAttempt.resolve(),
        (this.connectionAttempt = null),
        (this.status = Z.Connected),
        this.emit(`status`, { status: Z.Connected }),
        this.emit(`connect`),
        this.messageQueue.forEach((e) => this.send(e)),
        (this.messageQueue = []));
    }
    stopConnectionAttempt() {
      this.connectionAttempt = null;
    }
    rejectConnectionAttempt(e) {
      (this.connectionAttempt?.reject(e), (this.connectionAttempt = null));
    }
    checkConnection() {
      this.status === Z.Connected &&
        this.lastMessageReceived &&
        (this.configuration.messageReconnectTimeout >= vt() - this.lastMessageReceived ||
          ((this.closeTries += 1),
          this.closeTries > 2
            ? (this.emit(`close`, { event: { code: 4408, reason: `forced` } }),
              (this.closeTries = 0))
            : (this.webSocket?.close(), (this.messageQueue = []))));
    }
    get serverUrl() {
      if (this.configuration.preserveTrailingSlash) return this.configuration.url;
      let e = this.configuration.url;
      for (; e[e.length - 1] === `/`;) e = e.slice(0, e.length - 1);
      return e;
    }
    get url() {
      return this.serverUrl;
    }
    disconnect() {
      if (((this.shouldConnect = !1), this.clearReconnectTimeout(), this.webSocket !== null))
        try {
          (this.webSocket.close(), (this.messageQueue = []));
        } catch (e) {
          console.error(e);
        }
    }
    parseQueuedMessage(e) {
      try {
        let t = Ze(e);
        return { documentName: O(t), messageType: D(t) };
      } catch {
        return null;
      }
    }
    addToQueue(t) {
      if (t instanceof Uint8Array) {
        let n = this.parseQueuedMessage(t);
        n &&
          e.DEDUPLICATABLE_TYPES.has(n.messageType) &&
          (this.messageQueue = this.messageQueue.filter((e) => {
            if (!(e instanceof Uint8Array)) return !0;
            let t = this.parseQueuedMessage(e);
            return !t || t.documentName !== n.documentName || t.messageType !== n.messageType;
          }));
      }
      this.messageQueue.push(t);
    }
    send(e) {
      this.webSocket?.readyState === _t.Open ? this.webSocket.send(e) : this.addToQueue(e);
    }
    onClose({ event: e }) {
      ((this.closeTries = 0),
        this.cleanupWebSocket(),
        this.connectionAttempt &&
          this.rejectConnectionAttempt(
            Error(
              `WebSocket closed before the connection was established (code: ${e?.code}, reason: ${e?.reason || `none`})`,
            ),
          ),
        (this.status = Z.Disconnected),
        this.emit(`status`, { status: Z.Disconnected }),
        this.emit(`disconnect`, { event: e }),
        !this.cancelWebsocketRetry &&
          this.shouldConnect &&
          (this.reconnectTimeout = setTimeout(() => {
            ((this.reconnectTimeout = null), this.connect());
          }, this.configuration.delay)));
    }
    destroy() {
      (this.emit(`destroy`),
        clearInterval(this.intervals.connectionChecker),
        this.stopConnectionAttempt(),
        this.disconnect(),
        this.removeAllListeners(),
        this.cleanupWebSocket());
    }
  },
  Ys = class {
    constructor(e) {
      this.message = e;
    }
    apply(e, t) {
      let { message: n } = this,
        r = n.readVarUint(),
        i = n.length();
      switch (r) {
        case X.Sync:
          this.applySyncMessage(e, t);
          break;
        case X.Awareness:
          this.applyAwarenessMessage(e);
          break;
        case X.Auth:
          this.applyAuthMessage(e);
          break;
        case X.QueryAwareness:
          this.applyQueryAwarenessMessage(e);
          break;
        case X.Stateless:
          e.receiveStateless(O(n.decoder));
          break;
        case X.SyncStatus:
          this.applySyncStatusMessage(e, tt(n.decoder) === 1);
          break;
        case X.CLOSE: {
          let t = { code: 1e3, reason: O(n.decoder) };
          (e.onClose(), e.configuration.onClose({ event: t }), e.forwardClose({ event: t }));
          break;
        }
        default:
          console.error(`Can’t apply message of unknown type: ${r}`);
      }
      n.length() > i + 1 && e.send(Ks, { encoder: n.encoder });
    }
    applySyncMessage(e, t) {
      let { message: n } = this;
      n.writeVarUint(X.Sync);
      let r = Us(n.decoder, n.encoder, e.document, e);
      t && r === 1 && (e.synced = !0);
    }
    applySyncStatusMessage(e, t) {
      t && e.decrementUnsyncedChanges();
    }
    applyAwarenessMessage(e) {
      if (!e.awareness) return;
      let { message: t } = this;
      Ms(e.awareness, t.readVarUint8Array(), e);
    }
    applyAuthMessage(e) {
      let { message: t } = this;
      ft(
        t.decoder,
        e.sendToken.bind(e),
        e.permissionDeniedHandler.bind(e),
        e.authenticatedHandler.bind(e),
      );
    }
    applyQueryAwarenessMessage(e) {
      if (!e.awareness) return;
      let { message: t } = this;
      (t.writeVarUint(X.Awareness),
        t.writeVarUint8Array(js(e.awareness, Array.from(e.awareness.getStates().keys()))));
    }
  },
  Xs = class {
    constructor(e, t = {}) {
      ((this.message = new e()), (this.encoder = this.message.get(t)));
    }
    create() {
      return v(this.encoder);
    }
    send(e) {
      e?.send(this.create());
    }
  },
  Zs = `4.9.0`,
  Qs = class extends Ks {
    constructor(...e) {
      (super(...e), (this.type = X.Auth), (this.description = `Authentication`));
    }
    get(e) {
      if (e.token === void 0)
        throw Error('The authentication message requires `token` as an argument.');
      return (
        x(this.encoder, e.documentName),
        b(this.encoder, this.type),
        dt(this.encoder, e.token),
        x(this.encoder, Zs),
        this.encoder
      );
    }
  },
  $s = class extends Ks {
    constructor(...e) {
      (super(...e), (this.type = X.Awareness), (this.description = `Awareness states update`));
    }
    get(e) {
      if (e.awareness === void 0)
        throw Error(`The awareness message requires awareness as an argument`);
      if (e.clients === void 0)
        throw Error(`The awareness message requires clients as an argument`);
      (x(this.encoder, e.documentName), b(this.encoder, this.type));
      let t;
      return (
        (t =
          e.states === void 0 ? js(e.awareness, e.clients) : js(e.awareness, e.clients, e.states)),
        S(this.encoder, t),
        this.encoder
      );
    }
  },
  ec = class extends Ks {
    constructor(...e) {
      (super(...e), (this.type = X.Stateless), (this.description = `A stateless message`));
    }
    get(e) {
      return (
        x(this.encoder, e.documentName),
        b(this.encoder, this.type),
        x(this.encoder, e.payload ?? ``),
        this.encoder
      );
    }
  },
  tc = class extends Ks {
    constructor(...e) {
      (super(...e), (this.type = X.Sync), (this.description = `First sync step`));
    }
    get(e) {
      if (e.document === void 0)
        throw Error(`The sync step one message requires document as an argument`);
      return (
        x(this.encoder, e.documentName),
        b(this.encoder, this.type),
        Ls(this.encoder, e.document),
        this.encoder
      );
    }
  },
  nc = class extends Ks {
    constructor(...e) {
      (super(...e), (this.type = X.Sync), (this.description = `A document update`));
    }
    get(e) {
      return (
        x(this.encoder, e.documentName),
        b(this.encoder, this.type),
        Vs(this.encoder, e.update),
        this.encoder
      );
    }
  },
  rc = class extends Error {
    constructor(...e) {
      (super(...e), (this.code = 1001));
    }
  },
  ic = class extends Ws {
    get effectiveName() {
      return this.configuration.sessionAwareness
        ? ht(this.configuration.name, this.sessionId)
        : this.configuration.name;
    }
    constructor(e) {
      (super(),
        (this.configuration = {
          name: ``,
          document: void 0,
          awareness: void 0,
          token: null,
          sessionAwareness: !1,
          forceSyncInterval: !1,
          flushDelay: !1,
          onAuthenticated: () => null,
          onAuthenticationFailed: () => null,
          onOpen: () => null,
          onConnect: () => null,
          onMessage: () => null,
          onOutgoingMessage: () => null,
          onSynced: () => null,
          onStatus: () => null,
          onDisconnect: () => null,
          onClose: () => null,
          onDestroy: () => null,
          onAwarenessUpdate: () => null,
          onAwarenessChange: () => null,
          onStateless: () => null,
          onUnsyncedChanges: () => null,
        }),
        (this.isSynced = !1),
        (this.unsyncedChanges = 0),
        (this.isAuthenticated = !1),
        (this.authorizedScope = void 0),
        (this.manageSocket = !1),
        (this._isAttached = !1),
        (this.pendingUpdates = []),
        (this.pendingAwarenessClients = new Set()),
        (this.flushTimeout = null),
        (this.sessionId = Math.random().toString(36).slice(2)),
        (this.intervals = { forceSync: null }),
        (this.boundDocumentUpdateHandler = this.documentUpdateHandler.bind(this)),
        (this.boundAwarenessUpdateHandler = this.awarenessUpdateHandler.bind(this)),
        (this.boundPageHide = this.pageHide.bind(this)),
        (this.boundOnOpen = this.onOpen.bind(this)),
        (this.boundOnClose = this.onClose.bind(this)),
        (this.forwardConnect = () => this.emit(`connect`)),
        (this.forwardStatus = (e) => this.emit(`status`, e)),
        (this.forwardClose = (e) => this.emit(`close`, e)),
        (this.forwardDisconnect = (e) => this.emit(`disconnect`, e)),
        (this.forwardDestroy = () => this.emit(`destroy`)),
        this.setConfiguration(e),
        (this.configuration.document = e.document ? e.document : new ci()),
        (this.configuration.awareness =
          e.awareness === void 0 ? new ks(this.document) : e.awareness),
        this.on(`open`, this.configuration.onOpen),
        this.on(`message`, this.configuration.onMessage),
        this.on(`outgoingMessage`, this.configuration.onOutgoingMessage),
        this.on(`synced`, this.configuration.onSynced),
        this.on(`destroy`, this.configuration.onDestroy),
        this.on(`awarenessUpdate`, this.configuration.onAwarenessUpdate),
        this.on(`awarenessChange`, this.configuration.onAwarenessChange),
        this.on(`stateless`, this.configuration.onStateless),
        this.on(`unsyncedChanges`, this.configuration.onUnsyncedChanges),
        this.on(`authenticated`, this.configuration.onAuthenticated),
        this.on(`authenticationFailed`, this.configuration.onAuthenticationFailed),
        this.awareness?.on(`update`, () => {
          this.emit(`awarenessUpdate`, { states: pt(this.awareness.getStates()) });
        }),
        this.awareness?.on(`change`, () => {
          this.emit(`awarenessChange`, { states: pt(this.awareness.getStates()) });
        }),
        this.document.on(`update`, this.boundDocumentUpdateHandler),
        this.awareness?.on(`update`, this.boundAwarenessUpdateHandler),
        this.registerEventListeners(),
        this.configuration.forceSyncInterval &&
          typeof this.configuration.forceSyncInterval == `number` &&
          (this.intervals.forceSync = setInterval(
            this.forceSync.bind(this),
            this.configuration.forceSyncInterval,
          )),
        this.manageSocket && this.attach());
    }
    setConfiguration(e = {}) {
      (e.websocketProvider ||
        ((this.manageSocket = !0), (this.configuration.websocketProvider = new Js(e))),
        (this.configuration = { ...this.configuration, ...e }));
    }
    get document() {
      return this.configuration.document;
    }
    get isAttached() {
      return this._isAttached;
    }
    get awareness() {
      return this.configuration.awareness;
    }
    get hasUnsyncedChanges() {
      return this.unsyncedChanges > 0;
    }
    resetUnsyncedChanges() {
      ((this.unsyncedChanges = 1), this.emit(`unsyncedChanges`, { number: this.unsyncedChanges }));
    }
    incrementUnsyncedChanges() {
      ((this.unsyncedChanges += 1), this.emit(`unsyncedChanges`, { number: this.unsyncedChanges }));
    }
    decrementUnsyncedChanges() {
      (this.unsyncedChanges > 0 && --this.unsyncedChanges,
        this.unsyncedChanges === 0 && (this.synced = !0),
        this.emit(`unsyncedChanges`, { number: this.unsyncedChanges }));
    }
    forceSync() {
      (this.resetUnsyncedChanges(),
        this.send(tc, { document: this.document, documentName: this.effectiveName }));
    }
    pageHide() {
      (this.awareness && As(this.awareness, [this.document.clientID], `page hide`),
        this.flushPendingUpdates());
    }
    registerEventListeners() {
      typeof window < `u` &&
        `addEventListener` in window &&
        window.addEventListener(`pagehide`, this.boundPageHide);
    }
    sendStateless(e) {
      this.send(ec, { documentName: this.effectiveName, payload: e });
    }
    async sendToken() {
      let e;
      try {
        e = await this.getToken();
      } catch (e) {
        this.permissionDeniedHandler(`Failed to get token during sendToken(): ${e}`);
        return;
      }
      this.send(Qs, { token: e ?? ``, documentName: this.effectiveName });
    }
    get batchingEnabled() {
      return !!this.configuration.flushDelay && typeof this.configuration.flushDelay == `number`;
    }
    documentUpdateHandler(e, t) {
      t !== this &&
        (this.batchingEnabled
          ? (this.pendingUpdates.length === 0 && this.incrementUnsyncedChanges(),
            this.pendingUpdates.push(e),
            this.scheduleFlush())
          : (this.incrementUnsyncedChanges(),
            this.send(nc, { update: e, documentName: this.effectiveName })));
    }
    awarenessUpdateHandler({ added: e, updated: t, removed: n }, r) {
      if (r === this) return;
      let i = e.concat(t).concat(n);
      if (!this.batchingEnabled)
        this.send($s, { awareness: this.awareness, clients: i, documentName: this.effectiveName });
      else {
        for (let e of i) this.pendingAwarenessClients.add(e);
        this.scheduleFlush();
      }
    }
    scheduleFlush() {
      this.flushTimeout === null &&
        (this.flushTimeout = setTimeout(() => {
          ((this.flushTimeout = null), this.flushPendingUpdates());
        }, this.configuration.flushDelay));
    }
    flushPendingUpdates() {
      if (
        (this.flushTimeout !== null &&
          (clearTimeout(this.flushTimeout), (this.flushTimeout = null)),
        this.pendingUpdates.length > 0)
      ) {
        let e = this.pendingUpdates.length === 1 ? this.pendingUpdates[0] : Ta(this.pendingUpdates);
        ((this.pendingUpdates = []),
          this.send(nc, { update: e, documentName: this.effectiveName }));
      }
      if (this.pendingAwarenessClients.size > 0) {
        let e = Array.from(this.pendingAwarenessClients);
        (this.pendingAwarenessClients.clear(),
          this.send($s, {
            awareness: this.awareness,
            clients: e,
            documentName: this.effectiveName,
          }));
      }
    }
    get synced() {
      return this.isSynced;
    }
    set synced(e) {
      this.isSynced !== e && ((this.isSynced = e), e && this.emit(`synced`, { state: e }));
    }
    receiveStateless(e) {
      this.emit(`stateless`, { payload: e });
    }
    async connect() {
      if (this.manageSocket) return this.configuration.websocketProvider.connect();
      console.warn(
        `HocuspocusProvider::connect() is deprecated and does not do anything. Please connect/disconnect on the websocketProvider, or attach/deattach providers.`,
      );
    }
    disconnect() {
      if (this.manageSocket) return this.configuration.websocketProvider.disconnect();
      console.warn(
        `HocuspocusProvider::disconnect() is deprecated and does not do anything. Please connect/disconnect on the websocketProvider, or attach/deattach providers.`,
      );
    }
    async onOpen(e) {
      ((this.isAuthenticated = !1),
        this.emit(`open`, { event: e }),
        await this.sendToken(),
        this.startSync());
    }
    async getToken() {
      return typeof this.configuration.token == `function`
        ? await this.configuration.token()
        : this.configuration.token;
    }
    startSync() {
      (this.resetUnsyncedChanges(),
        this.send(tc, { document: this.document, documentName: this.effectiveName }),
        this.awareness &&
          this.awareness.getLocalState() !== null &&
          this.send($s, {
            awareness: this.awareness,
            clients: [this.document.clientID],
            documentName: this.effectiveName,
          }));
    }
    send(e, t) {
      if (!this._isAttached) return;
      let n = new Xs(e, t);
      (this.emit(`outgoingMessage`, { message: n.message }),
        n.send(this.configuration.websocketProvider));
    }
    onMessage(e) {
      let t = new Gs(e.data),
        { documentName: n } = gt(t.readVarString());
      (t.writeVarString(this.effectiveName),
        this.emit(`message`, { event: e, message: new Gs(e.data) }),
        new Ys(t).apply(this, !0));
    }
    onClose() {
      ((this.isAuthenticated = !1),
        (this.synced = !1),
        this.flushTimeout !== null && (clearTimeout(this.flushTimeout), (this.flushTimeout = null)),
        (this.pendingUpdates = []),
        this.pendingAwarenessClients.clear(),
        this.awareness &&
          As(
            this.awareness,
            Array.from(this.awareness.getStates().keys()).filter(
              (e) => e !== this.document.clientID,
            ),
            this,
          ));
    }
    destroy() {
      (this.emit(`destroy`),
        this.intervals.forceSync && clearInterval(this.intervals.forceSync),
        this.awareness &&
          (As(this.awareness, [this.document.clientID], `provider destroy`),
          this.awareness.off(`update`, this.boundAwarenessUpdateHandler),
          this.awareness.destroy()),
        this.flushPendingUpdates(),
        this.document.off(`update`, this.boundDocumentUpdateHandler),
        this.removeAllListeners(),
        this.detach(),
        this.manageSocket && this.configuration.websocketProvider.destroy(),
        typeof window < `u` &&
          `removeEventListener` in window &&
          window.removeEventListener(`pagehide`, this.boundPageHide));
    }
    detach() {
      (this.configuration.websocketProvider.off(`connect`, this.configuration.onConnect),
        this.configuration.websocketProvider.off(`connect`, this.forwardConnect),
        this.configuration.websocketProvider.off(`status`, this.forwardStatus),
        this.configuration.websocketProvider.off(`status`, this.configuration.onStatus),
        this.configuration.websocketProvider.off(`open`, this.boundOnOpen),
        this.configuration.websocketProvider.off(`close`, this.boundOnClose),
        this.configuration.websocketProvider.off(`close`, this.configuration.onClose),
        this.configuration.websocketProvider.off(`close`, this.forwardClose),
        this.configuration.websocketProvider.off(`disconnect`, this.configuration.onDisconnect),
        this.configuration.websocketProvider.off(`disconnect`, this.forwardDisconnect),
        this.configuration.websocketProvider.off(`destroy`, this.configuration.onDestroy),
        this.configuration.websocketProvider.off(`destroy`, this.forwardDestroy),
        this.configuration.websocketProvider.detach(this),
        (this._isAttached = !1));
    }
    attach() {
      this._isAttached ||=
        (this.configuration.websocketProvider.on(`connect`, this.configuration.onConnect),
        this.configuration.websocketProvider.on(`connect`, this.forwardConnect),
        this.configuration.websocketProvider.on(`status`, this.configuration.onStatus),
        this.configuration.websocketProvider.on(`status`, this.forwardStatus),
        this.configuration.websocketProvider.on(`open`, this.boundOnOpen),
        this.configuration.websocketProvider.on(`close`, this.boundOnClose),
        this.configuration.websocketProvider.on(`close`, this.configuration.onClose),
        this.configuration.websocketProvider.on(`close`, this.forwardClose),
        this.configuration.websocketProvider.on(`disconnect`, this.configuration.onDisconnect),
        this.configuration.websocketProvider.on(`disconnect`, this.forwardDisconnect),
        this.configuration.websocketProvider.on(`destroy`, this.configuration.onDestroy),
        this.configuration.websocketProvider.on(`destroy`, this.forwardDestroy),
        this.configuration.websocketProvider.attach(this),
        !0);
    }
    permissionDeniedHandler(e) {
      (this.emit(`authenticationFailed`, { reason: e }), (this.isAuthenticated = !1));
    }
    authenticatedHandler(e) {
      ((this.isAuthenticated = !0),
        (this.authorizedScope = e),
        this.emit(`authenticated`, { scope: e }));
    }
    setAwarenessField(e, t) {
      if (!this.awareness)
        throw new rc(
          `Cannot set awareness field "${e}" to ${JSON.stringify(t)}. You have disabled Awareness for this provider by explicitly passing awareness: null in the provider configuration.`,
        );
      this.awareness.setLocalStateField(e, t);
    }
  },
  ac = () => {
    let e = !0;
    return (t, n) => {
      if (e) {
        e = !1;
        try {
          t();
        } finally {
          e = !0;
        }
      } else n !== void 0 && n();
    };
  },
  oc = /[\uD800-\uDBFF]/,
  sc = /[\uDC00-\uDFFF]/,
  cc = (e, t) => {
    let n = 0,
      r = 0;
    for (; n < e.length && n < t.length && e[n] === t[n];) n++;
    for (
      n > 0 && oc.test(e[n - 1]) && n--;
      r + n < e.length && r + n < t.length && e[e.length - r - 1] === t[t.length - r - 1];
    )
      r++;
    return (
      r > 0 && sc.test(e[e.length - r]) && r--,
      { index: n, remove: e.length - n - r, insert: t.slice(n, t.length - r) }
    );
  },
  Q = new i(`y-sync`),
  lc = new i(`y-undo`),
  uc = new i(`yjs-cursor`),
  $ = (e, t) => (e >>> t) | (e << (32 - t)),
  dc = (e) => $(e, 2) ^ $(e, 13) ^ $(e, 22),
  fc = (e) => $(e, 6) ^ $(e, 11) ^ $(e, 25),
  pc = (e) => $(e, 7) ^ $(e, 18) ^ (e >>> 3),
  mc = (e) => $(e, 17) ^ $(e, 19) ^ (e >>> 10),
  hc = new Uint32Array([
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
    3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
    3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
    2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
    666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
    2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
    430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
    1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298,
  ]),
  gc = new Uint32Array([
    1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225,
  ]),
  _c = class {
    constructor() {
      let e = new ArrayBuffer(320);
      ((this._H = new Uint32Array(e, 0, 8)),
        this._H.set(gc),
        (this._W = new Uint32Array(e, 64, 64)));
    }
    _updateHash() {
      let e = this._H,
        t = this._W;
      for (let e = 16; e < 64; e++) t[e] = mc(t[e - 2]) + t[e - 7] + pc(t[e - 15]) + t[e - 16];
      let n = e[0],
        r = e[1],
        i = e[2],
        a = e[3],
        o = e[4],
        s = e[5],
        c = e[6],
        l = e[7];
      for (let e = 0, u, d; e < 64; e++)
        ((u = (l + fc(o) + ((o & s) ^ (~o & c)) + hc[e] + t[e]) >>> 0),
          (d = (dc(n) + ((n & r) ^ (n & i) ^ (r & i))) >>> 0),
          (l = c),
          (c = s),
          (s = o),
          (o = (a + u) >>> 0),
          (a = i),
          (i = r),
          (r = n),
          (n = (u + d) >>> 0));
      ((e[0] += n),
        (e[1] += r),
        (e[2] += i),
        (e[3] += a),
        (e[4] += o),
        (e[5] += s),
        (e[6] += c),
        (e[7] += l));
    }
    digest(e) {
      let t = 0;
      for (; t + 56 <= e.length;) {
        let n = 0;
        for (; n < 16 && t + 3 < e.length; n++)
          this._W[n] = (e[t++] << 24) | (e[t++] << 16) | (e[t++] << 8) | e[t++];
        if (t % 64 != 0) {
          for (this._W.fill(0, n, 16); t < e.length;)
            ((this._W[n] |= e[t] << ((3 - (t % 4)) * 8)), t++);
          this._W[n] |= 128 << ((3 - (t % 4)) * 8);
        }
        this._updateHash();
      }
      let n = t % 64 != 0;
      this._W.fill(0, 0, 16);
      let r = 0;
      for (; t < e.length; r++)
        for (let n = 3; n >= 0 && t < e.length; n--) this._W[r] |= e[t++] << (n * 8);
      (n || (this._W[r - (t % 4 == 0 ? 0 : 1)] |= 128 << ((3 - (t % 4)) * 8)),
        (this._W[14] = e.byteLength / ne),
        (this._W[15] = e.byteLength * 8),
        this._updateHash());
      let i = new Uint8Array(32);
      for (let e = 0; e < this._H.length; e++)
        for (let t = 0; t < 4; t++) i[e * 4 + t] = this._H[e] >>> ((3 - t) * 8);
      return i;
    }
  },
  vc = (e) => new _c().digest(e),
  yc = (e) => {
    for (let t = 6; t < e.length; t++) e[t % 6] = e[t % 6] ^ e[t];
    return e.slice(0, 6);
  },
  bc = (e) => cn(yc(vc(un(e)))),
  xc = () => ({ mapping: new Map(), isOMark: new Map() }),
  Sc = (e, t) =>
    t === void 0
      ? !e.deleted
      : t.sv.has(e.id.client) && t.sv.get(e.id.client) > e.id.clock && !Qr(t.ds, e.id),
  Cc = [{ light: `#ecd44433`, dark: `#ecd444` }],
  wc = (e, t, n) => {
    if (!e.has(n)) {
      if (e.size < t.length) {
        let n = oe();
        (e.forEach((e) => n.add(e)), (t = t.filter((e) => !n.has(e))));
      }
      e.set(n, Wt(t));
    }
    return e.get(n);
  },
  Tc = (
    e,
    {
      colors: t = Cc,
      colorMapping: n = new Map(),
      permanentUserData: r = null,
      onFirstRender: i = () => {},
      mapping: a,
    } = {},
  ) => {
    let s = !1,
      c = new Oc(e, a),
      l = new o({
        props: {
          editable: (e) => {
            let t = Q.getState(e);
            return t.snapshot == null && t.prevSnapshot == null;
          },
        },
        key: Q,
        state: {
          init: (i, a) => ({
            type: e,
            doc: e.doc,
            binding: c,
            snapshot: null,
            prevSnapshot: null,
            isChangeOrigin: !1,
            isUndoRedoOperation: !1,
            addToHistory: !0,
            colors: t,
            colorMapping: n,
            permanentUserData: r,
          }),
          apply: (e, t) => {
            let n = e.getMeta(Q);
            if (n !== void 0) {
              t = Object.assign({}, t);
              for (let e in n) t[e] = n[e];
            }
            return (
              (t.addToHistory = e.getMeta(`addToHistory`) !== !1),
              (t.isChangeOrigin = n !== void 0 && !!n.isChangeOrigin),
              (t.isUndoRedoOperation =
                n !== void 0 && !!n.isChangeOrigin && !!n.isUndoRedoOperation),
              c.prosemirrorView !== null &&
                n !== void 0 &&
                (n.snapshot != null || n.prevSnapshot != null) &&
                kr(0, () => {
                  c.prosemirrorView != null &&
                    (n.restore == null
                      ? c._renderSnapshot(n.snapshot, n.prevSnapshot, t)
                      : (c._renderSnapshot(n.snapshot, n.snapshot, t),
                        delete t.restore,
                        delete t.snapshot,
                        delete t.prevSnapshot,
                        c.mux(() => {
                          c._prosemirrorChanged(c.prosemirrorView.state.doc);
                        })));
                }),
              t
            );
          },
        },
        view: (e) => (
          c.initView(e),
          a ?? c._forceRerender(),
          i(),
          {
            update: () => {
              let t = l.getState(e.state);
              if (
                t.snapshot == null &&
                t.prevSnapshot == null &&
                (s ||
                  e.state.doc.content.findDiffStart(e.state.doc.type.createAndFill().content) !==
                    null)
              ) {
                if (((s = !0), t.addToHistory === !1 && !t.isChangeOrigin)) {
                  let t = lc.getState(e.state),
                    n = t && t.undoManager;
                  n && n.stopCapturing();
                }
                c.mux(() => {
                  t.doc.transact((n) => {
                    (n.meta.set(`addToHistory`, t.addToHistory),
                      c._prosemirrorChanged(e.state.doc));
                  }, Q);
                });
              }
            },
            destroy: () => {
              c.destroy();
            },
          }
        ),
      });
    return l;
  },
  Ec = (e, t, n) => {
    if (t !== null && t.anchor !== null && t.head !== null) {
      if (t.type === `all`) e.setSelection(new l(e.doc));
      else if (t.type === `node`) {
        let r = tl(n.doc, n.type, t.anchor, n.mapping);
        e.setSelection(c.create(e.doc, r));
      } else {
        let r = tl(n.doc, n.type, t.anchor, n.mapping),
          i = tl(n.doc, n.type, t.head, n.mapping);
        if (r !== null && i !== null) {
          let t = a.between(e.doc.resolve(r), e.doc.resolve(i));
          e.setSelection(t);
        }
      }
    }
  },
  Dc = (e, t) => ({
    type: t.selection.jsonID,
    anchor: $c(t.selection.anchor, e.type, e.mapping),
    head: $c(t.selection.head, e.type, e.mapping),
  }),
  Oc = class {
    constructor(e, t = new Map()) {
      ((this.type = e),
        (this.prosemirrorView = null),
        (this.mux = ac()),
        (this.mapping = t),
        (this.isOMark = new Map()),
        (this._observeFunction = this._typeChanged.bind(this)),
        (this.doc = e.doc),
        (this.beforeTransactionSelection = null),
        (this.beforeAllTransactions = () => {
          this.beforeTransactionSelection === null &&
            this.prosemirrorView != null &&
            (this.beforeTransactionSelection = Dc(this, this.prosemirrorView.state));
        }),
        (this.afterAllTransactions = () => {
          this.beforeTransactionSelection = null;
        }),
        (this._domSelectionInView = null));
    }
    get _tr() {
      return this.prosemirrorView.state.tr.setMeta(`addToHistory`, !1);
    }
    _isLocalCursorInView() {
      return this.prosemirrorView.hasFocus()
        ? (Qt &&
            this._domSelectionInView === null &&
            (kr(0, () => {
              this._domSelectionInView = null;
            }),
            (this._domSelectionInView = this._isDomSelectionInView())),
          this._domSelectionInView)
        : !1;
    }
    _isDomSelectionInView() {
      let e = this.prosemirrorView._root.getSelection();
      if (e == null || e.anchorNode == null) return !1;
      let t = this.prosemirrorView._root.createRange();
      (t.setStart(e.anchorNode, e.anchorOffset),
        t.setEnd(e.focusNode, e.focusOffset),
        t.getClientRects().length === 0 &&
          t.startContainer &&
          t.collapsed &&
          t.selectNodeContents(t.startContainer));
      let n = t.getBoundingClientRect(),
        r = Sr.documentElement;
      return (
        n.bottom >= 0 &&
        n.right >= 0 &&
        n.left <= (window.innerWidth || r.clientWidth || 0) &&
        n.top <= (window.innerHeight || r.clientHeight || 0)
      );
    }
    renderSnapshot(e, t) {
      ((t ||= $i(ni(), new Map())),
        this.prosemirrorView.dispatch(this._tr.setMeta(Q, { snapshot: e, prevSnapshot: t })));
    }
    unrenderSnapshot() {
      (this.mapping.clear(),
        this.mux(() => {
          let e = this.type
              .toArray()
              .map((e) => Ac(e, this.prosemirrorView.state.schema, this))
              .filter((e) => e !== null),
            t = this._tr.replace(
              0,
              this.prosemirrorView.state.doc.content.size,
              new s(r.from(e), 0, 0),
            );
          (t.setMeta(Q, { snapshot: null, prevSnapshot: null }), this.prosemirrorView.dispatch(t));
        }));
    }
    _forceRerender() {
      (this.mapping.clear(),
        this.mux(() => {
          let e =
              this.beforeTransactionSelection === null
                ? this.prosemirrorView.state.selection
                : null,
            t = this.type
              .toArray()
              .map((e) => Ac(e, this.prosemirrorView.state.schema, this))
              .filter((e) => e !== null),
            n = this._tr.replace(
              0,
              this.prosemirrorView.state.doc.content.size,
              new s(r.from(t), 0, 0),
            );
          if (e) {
            let t = m(h(e.anchor, 0), n.doc.content.size),
              r = m(h(e.head, 0), n.doc.content.size);
            n.setSelection(a.create(n.doc, t, r));
          }
          this.prosemirrorView.dispatch(n.setMeta(Q, { isChangeOrigin: !0, binding: this }));
        }));
    }
    _renderSnapshot(e, t, n) {
      let i = this.doc,
        a = this.type;
      if (((e ||= ea(this.doc)), e instanceof Uint8Array || t instanceof Uint8Array)) {
        if (
          ((e instanceof Uint8Array && t instanceof Uint8Array) || T(),
          (i = new ci({ gc: !1 })),
          Ci(i, t),
          (t = ea(i)),
          Ci(i, e),
          (e = ea(i)),
          a._item === null)
        ) {
          let e = Array.from(this.doc.share.keys()).find(
            (e) => this.doc.share.get(e) === this.type,
          );
          a = i.getXmlFragment(e);
        } else {
          let e = i.store.clients.get(a._item.id.client) ?? [];
          a = e[R(e, a._item.id.clock)].content.type;
        }
      }
      (this.mapping.clear(),
        this.mux(() => {
          i.transact((i) => {
            let o = n.permanentUserData;
            o &&
              o.dss.forEach((e) => {
                Xr(i, e, (e) => {});
              });
            let c = (e, t) => {
                let r = e === `added` ? o.getUserByClientId(t.client) : o.getUserByDeletedId(t);
                return { user: r, type: e, color: wc(n.colorMapping, n.colors, r) };
              },
              l = Ja(a, new Qi(t.ds, e.sv))
                .map((n) =>
                  !n._item.deleted || Sc(n._item, e) || Sc(n._item, t)
                    ? Ac(
                        n,
                        this.prosemirrorView.state.schema,
                        { mapping: new Map(), isOMark: new Map() },
                        e,
                        t,
                        c,
                      )
                    : null,
                )
                .filter((e) => e !== null),
              u = this._tr.replace(
                0,
                this.prosemirrorView.state.doc.content.size,
                new s(r.from(l), 0, 0),
              );
            this.prosemirrorView.dispatch(u.setMeta(Q, { isChangeOrigin: !0 }));
          }, Q);
        }));
    }
    _typeChanged(e, t) {
      if (this.prosemirrorView == null) return;
      let n = Q.getState(this.prosemirrorView.state);
      e.length === 0 || n.snapshot != null || n.prevSnapshot != null
        ? this.renderSnapshot(n.snapshot, n.prevSnapshot)
        : this.mux(() => {
            let e = (e, t) => this.mapping.delete(t);
            (Xr(t, t.deleteSet, (e) => {
              if (e.constructor === J) {
                let t = e.content.type;
                t && this.mapping.delete(t);
              }
            }),
              t.changed.forEach(e),
              t.changedParentTypes.forEach(e));
            let n = this.type
                .toArray()
                .map((e) => kc(e, this.prosemirrorView.state.schema, this))
                .filter((e) => e !== null),
              i = this._tr.replace(
                0,
                this.prosemirrorView.state.doc.content.size,
                new s(r.from(n), 0, 0),
              );
            (Ec(i, this.beforeTransactionSelection, this),
              (i = i.setMeta(Q, {
                isChangeOrigin: !0,
                isUndoRedoOperation: t.origin instanceof xa,
              })),
              this.beforeTransactionSelection !== null &&
                this._isLocalCursorInView() &&
                i.scrollIntoView(),
              this.prosemirrorView.dispatch(i));
          });
    }
    _prosemirrorChanged(e) {
      this.doc.transact(() => {
        (Jc(this.doc, this.type, e, this),
          (this.beforeTransactionSelection = Dc(this, this.prosemirrorView.state)));
      }, Q);
    }
    initView(e) {
      (this.prosemirrorView != null && this.destroy(),
        (this.prosemirrorView = e),
        this.doc.on(`beforeAllTransactions`, this.beforeAllTransactions),
        this.doc.on(`afterAllTransactions`, this.afterAllTransactions),
        this.type.observeDeep(this._observeFunction));
    }
    destroy() {
      this.prosemirrorView != null &&
        ((this.prosemirrorView = null),
        this.type.unobserveDeep(this._observeFunction),
        this.doc.off(`beforeAllTransactions`, this.beforeAllTransactions),
        this.doc.off(`afterAllTransactions`, this.afterAllTransactions));
    }
  },
  kc = (e, t, n, r, i, a) => {
    let o = n.mapping.get(e);
    if (o === void 0) {
      if (e instanceof U) return Ac(e, t, n, r, i, a);
      throw w();
    }
    return o;
  },
  Ac = (e, t, n, r, i, a) => {
    let o = [],
      s = (e) => {
        if (e instanceof U) {
          let s = kc(e, t, n, r, i, a);
          s !== null && o.push(s);
        } else {
          let s = e._item.right?.content?.type;
          s instanceof Po &&
            !s._item.deleted &&
            s._item.id.client === s.doc.clientID &&
            (e.applyDelta([{ retain: e.length }, ...s.toDelta()]),
            s.doc.transact((e) => {
              s._item.delete(e);
            }));
          let c = jc(e, t, n, r, i, a);
          c !== null &&
            c.forEach((e) => {
              e !== null && o.push(e);
            });
        }
      };
    r === void 0 || i === void 0 ? e.toArray().forEach(s) : Ja(e, new Qi(i.ds, r.sv)).forEach(s);
    try {
      let s = e.getAttributes(r);
      r !== void 0 &&
        (Sc(e._item, r)
          ? Sc(e._item, i) || (s.ychange = a ? a(`added`, e._item.id) : { type: `added` })
          : (s.ychange = a ? a(`removed`, e._item.id) : { type: `removed` }));
      let c = t.node(e.nodeName, s, o);
      return (n.mapping.set(e, c), c);
    } catch {
      return (
        e.doc.transact((t) => {
          e._item.delete(t);
        }, Q),
        n.mapping.delete(e),
        null
      );
    }
  },
  jc = (e, t, n, r, i, a) => {
    let o = [],
      s = e.toDelta(r, i, a);
    try {
      for (let e = 0; e < s.length; e++) {
        let n = s[e];
        o.push(t.text(n.insert, Kc(n.attributes, t)));
      }
    } catch {
      return (
        e.doc.transact((t) => {
          e._item.delete(t);
        }, Q),
        null
      );
    }
    return o;
  },
  Mc = (e, t) => {
    let n = new W(),
      r = e.map((e) => ({ insert: e.text, attributes: qc(e.marks, t) }));
    return (n.applyDelta(r), t.mapping.set(n, e), n);
  },
  Nc = (e, t) => {
    let n = new U(e.type.name);
    for (let t in e.attrs) {
      let r = e.attrs[t];
      r !== null && t !== `ychange` && n.setAttribute(t, r);
    }
    return (
      n.insert(
        0,
        Lc(e).map((e) => Pc(e, t)),
      ),
      t.mapping.set(n, e),
      n
    );
  },
  Pc = (e, t) => (e instanceof Array ? Mc(e, t) : Nc(e, t)),
  Fc = (e) => typeof e == `object` && !!e,
  Ic = (e, t) => {
    let n = Object.keys(e).filter((t) => e[t] !== null),
      r = n.length === (t == null ? 0 : Object.keys(t).filter((e) => t[e] !== null).length);
    for (let i = 0; i < n.length && r; i++) {
      let a = n[i],
        o = e[a],
        s = t[a];
      r = a === `ychange` || o === s || (Fc(o) && Fc(s) && Ic(o, s));
    }
    return r;
  },
  Lc = (e) => {
    let t = e.content.content,
      n = [];
    for (let e = 0; e < t.length; e++) {
      let r = t[e];
      if (r.isText) {
        let r = [];
        for (let n = t[e]; e < t.length && n.isText; n = t[++e]) r.push(n);
        (e--, n.push(r));
      } else n.push(r);
    }
    return n;
  },
  Rc = (e, t) => {
    let n = e.toDelta();
    return (
      n.length === t.length &&
      n.every(
        (e, n) =>
          e.insert === t[n].text &&
          Ot(e.attributes || {}).length === t[n].marks.length &&
          Mt(e.attributes, (e, r) => {
            let i = Gc(r),
              a = t[n].marks;
            return Ic(e, a.find((e) => e.type.name === i)?.attrs);
          }),
      )
    );
  },
  zc = (e, t) => {
    if (e instanceof U && !(t instanceof Array) && Yc(e, t)) {
      let n = Lc(t);
      return (
        e._length === n.length &&
        Ic(e.getAttributes(), t.attrs) &&
        e.toArray().every((e, t) => zc(e, n[t]))
      );
    }
    return e instanceof W && t instanceof Array && Rc(e, t);
  },
  Bc = (e, t) =>
    e === t ||
    (e instanceof Array &&
      t instanceof Array &&
      e.length === t.length &&
      e.every((e, n) => t[n] === e)),
  Vc = (e, t, n) => {
    let r = e.toArray(),
      i = Lc(t),
      a = i.length,
      o = r.length,
      s = m(o, a),
      c = 0,
      l = 0,
      u = !1;
    for (; c < s; c++) {
      let e = r[c],
        t = i[c];
      if (Bc(n.mapping.get(e), t)) u = !0;
      else if (!zc(e, t)) break;
    }
    for (; c + l < s; l++) {
      let e = r[o - l - 1],
        t = i[a - l - 1];
      if (Bc(n.mapping.get(e), t)) u = !0;
      else if (!zc(e, t)) break;
    }
    return { equalityFactor: c + l, foundMappedChild: u };
  },
  Hc = (e) => {
    let t = ``,
      n = e._start,
      r = {};
    for (; n !== null;)
      (n.deleted ||
        (n.countable && n.content instanceof ss
          ? (t += n.content.str)
          : n.content instanceof K && (r[n.content.key] = null)),
        (n = n.right));
    return { str: t, nAttrs: r };
  },
  Uc = (e, t, n) => {
    n.mapping.set(e, t);
    let { nAttrs: r, str: i } = Hc(e),
      a = t.map((e) => ({ insert: e.text, attributes: Object.assign({}, r, qc(e.marks, n)) })),
      { insert: o, remove: s, index: c } = cc(i, a.map((e) => e.insert).join(``));
    (e.delete(c, s),
      e.insert(c, o),
      e.applyDelta(a.map((e) => ({ retain: e.insert.length, attributes: e.attributes }))));
  },
  Wc = /(.*)(--[a-zA-Z0-9+/=]{8})$/,
  Gc = (e) => Wc.exec(e)?.[1] ?? e,
  Kc = (e, t) => {
    let n = [];
    for (let r in e) n.push(t.mark(Gc(r), e[r]));
    return n;
  },
  qc = (e, t) => {
    let n = {};
    return (
      e.forEach((e) => {
        if (e.type.name !== `ychange`) {
          let r = A(t.isOMark, e.type, () => !e.type.excludes(e.type));
          n[r ? `${e.type.name}--${bc(e.toJSON())}` : e.type.name] = e.attrs;
        }
      }),
      n
    );
  },
  Jc = (e, t, n, r) => {
    if (t instanceof U && t.nodeName !== n.type.name) throw Error(`node name mismatch!`);
    if ((r.mapping.set(t, n), t instanceof U)) {
      let e = t.getAttributes(),
        r = n.attrs;
      for (let n in r)
        r[n] === null
          ? t.removeAttribute(n)
          : e[n] !== r[n] && n !== `ychange` && t.setAttribute(n, r[n]);
      for (let n in e) r[n] === void 0 && t.removeAttribute(n);
    }
    let i = Lc(n),
      a = i.length,
      o = t.toArray(),
      s = o.length,
      c = m(a, s),
      l = 0,
      u = 0;
    for (; l < c; l++) {
      let e = o[l],
        t = i[l];
      if (!Bc(r.mapping.get(e), t)) {
        if (zc(e, t)) r.mapping.set(e, t);
        else break;
      }
    }
    for (; u + l < c; u++) {
      let e = o[s - u - 1],
        t = i[a - u - 1];
      if (!Bc(r.mapping.get(e), t)) {
        if (zc(e, t)) r.mapping.set(e, t);
        else break;
      }
    }
    e.transact(() => {
      for (; s - l - u > 0 && a - l - u > 0;) {
        let n = o[l],
          c = i[l],
          d = o[s - u - 1],
          f = i[a - u - 1];
        if (n instanceof W && c instanceof Array) (Rc(n, c) || Uc(n, c, r), (l += 1));
        else {
          let i = n instanceof U && Yc(n, c),
            a = d instanceof U && Yc(d, f);
          if (i && a) {
            let e = Vc(n, c, r),
              t = Vc(d, f, r);
            e.foundMappedChild && !t.foundMappedChild
              ? (a = !1)
              : (!e.foundMappedChild && t.foundMappedChild) || e.equalityFactor < t.equalityFactor
                ? (i = !1)
                : (a = !1);
          }
          i
            ? (Jc(e, n, c, r), (l += 1))
            : a
              ? (Jc(e, d, f, r), (u += 1))
              : (r.mapping.delete(t.get(l)), t.delete(l, 1), t.insert(l, [Pc(c, r)]), (l += 1));
        }
      }
      let n = s - l - u;
      if (
        (s === 1 && a === 0 && o[0] instanceof W
          ? (r.mapping.delete(o[0]), o[0].delete(0, o[0].length))
          : n > 0 && (t.slice(l, l + n).forEach((e) => r.mapping.delete(e)), t.delete(l, n)),
        l + u < a)
      ) {
        let e = [];
        for (let t = l; t < a - u; t++) e.push(Pc(i[t], r));
        t.insert(l, e);
      }
    }, Q);
  },
  Yc = (e, t) => !(t instanceof Array) && e.nodeName === t.type.name,
  Xc = null,
  Zc = () => {
    let e = Xc;
    ((Xc = null),
      e.forEach((e, t) => {
        let n = t.state.tr,
          r = Q.getState(t.state);
        r &&
          r.binding &&
          !r.binding.isDestroyed &&
          (e.forEach((e, t) => {
            n.setMeta(t, e);
          }),
          t.dispatch(n));
      }));
  },
  Qc = (e, t, n) => {
    (Xc || ((Xc = new Map()), kr(0, Zc)), A(Xc, e, k).set(t, n));
  },
  $c = (e, t, n) => {
    if (e === 0) return Ji(t, 0, t.length === 0 ? -1 : 0);
    let r = t._first === null ? null : t._first.content.type;
    for (; r !== null && t !== r;) {
      if (r instanceof W) {
        if (r._length >= e) return Ji(r, e, t.length === 0 ? -1 : 0);
        if (((e -= r._length), r._item !== null && r._item.next !== null))
          r = r._item.next.content.type;
        else {
          do ((r = r._item === null ? null : r._item.parent), e--);
          while (r !== t && r !== null && r._item !== null && r._item.next === null);
          r !== null && r !== t && (r = r._item === null ? null : r._item.next.content.type);
        }
      } else {
        let i = (n.get(r) || { nodeSize: 0 }).nodeSize;
        if (r._first !== null && e < i) ((r = r._first.content.type), e--);
        else {
          if (e === 1 && r._length === 0 && i > 1)
            return new Ui(
              r._item === null ? null : r._item.id,
              r._item === null ? Vi(r) : null,
              null,
            );
          if (((e -= i), r._item !== null && r._item.next !== null)) r = r._item.next.content.type;
          else {
            if (e === 0)
              return (
                (r = r._item === null ? r : r._item.parent),
                new Ui(r._item === null ? null : r._item.id, r._item === null ? Vi(r) : null, null)
              );
            do ((r = r._item.parent), e--);
            while (r !== t && r._item.next === null);
            r !== t && (r = r._item.next.content.type);
          }
        }
      }
      if (r === null) throw T();
      if (e === 0 && r.constructor !== W && r !== t) return el(r._item.parent, r._item);
    }
    return Ji(t, t._length, t.length === 0 ? -1 : 0);
  },
  el = (e, t) => {
    let n = null,
      r = null;
    return (
      e._item === null ? (r = Vi(e)) : (n = I(e._item.id.client, e._item.id.clock)),
      new Ui(n, r, t.id)
    );
  },
  tl = (e, t, n, r) => {
    let i = Xi(n, e);
    if (i === null || (i.type !== t && !Hi(t, i.type._item))) return null;
    let a = i.type,
      o = 0;
    if (a.constructor === W) o = i.index;
    else if (a._item === null || !a._item.deleted) {
      let e = a._first,
        t = 0;
      for (; t < a._length && t < i.index && e !== null;) {
        if (!e.deleted) {
          let n = e.content.type;
          (t++, n instanceof W ? (o += n._length) : (o += r.get(n).nodeSize));
        }
        e = e.right;
      }
      o += 1;
    }
    for (; a !== t && a._item !== null;) {
      let e = a._item.parent;
      if (e._item === null || !e._item.deleted) {
        o += 1;
        let t = e._first;
        for (; t !== null;) {
          let e = t.content.type;
          if (e === a) break;
          (t.deleted || (e instanceof W ? (o += e._length) : (o += r.get(e).nodeSize)),
            (t = t.right));
        }
      }
      a = e;
    }
    return o - 1;
  },
  nl = (e, t) => {
    let n = e
      .toArray()
      .map((e) => Ac(e, t, xc()))
      .filter((e) => e !== null);
    return r.fromArray(n);
  },
  rl = (e, t) => t.topNodeType.create(null, nl(e, t)),
  il = (e, t, n) => e !== t,
  al = (e) => {
    let t = document.createElement(`span`);
    (t.classList.add(`ProseMirror-yjs-cursor`),
      t.setAttribute(`style`, `border-color: ${e.color}`));
    let n = document.createElement(`div`);
    (n.setAttribute(`style`, `background-color: ${e.color}`),
      n.insertBefore(document.createTextNode(e.name), null));
    let r = document.createTextNode(`⁠`),
      i = document.createTextNode(`⁠`);
    return (t.insertBefore(r, null), t.insertBefore(n, null), t.insertBefore(i, null), t);
  },
  ol = (e) => ({ style: `background-color: ${e.color}70`, class: `ProseMirror-yjs-selection` }),
  sl = /^#[0-9a-fA-F]{6}$/,
  cl = (e, t, n, r, i) => {
    let a = Q.getState(e),
      o = a.doc,
      s = [];
    return a.snapshot != null || a.prevSnapshot != null || a.binding.mapping.size === 0
      ? f.create(e.doc, [])
      : (t.getStates().forEach((t, c) => {
          if (n(o.clientID, c, t) && t.cursor != null) {
            let n = t.user || {};
            (n.color == null
              ? (n.color = `#ffa500`)
              : sl.test(n.color) || console.warn(`A user uses an unsupported color format`, n),
              (n.name ??= `User: ${c}`));
            let l = tl(o, a.type, Wi(t.cursor.anchor), a.binding.mapping),
              u = tl(o, a.type, Wi(t.cursor.head), a.binding.mapping);
            if (l !== null && u !== null) {
              let t = h(e.doc.content.size - 1, 0);
              ((l = m(l, t)),
                (u = m(u, t)),
                s.push(d.widget(u, () => r(n, c), { key: c + ``, side: 10 })));
              let a = m(l, u),
                o = h(l, u);
              s.push(d.inline(a, o, i(n, c), { inclusiveEnd: !0, inclusiveStart: !1 }));
            }
          }
        }),
        f.create(e.doc, s));
  },
  ll = (
    e,
    {
      awarenessStateFilter: t = il,
      cursorBuilder: n = al,
      selectionBuilder: r = ol,
      getSelection: i = (e) => e.selection,
    } = {},
    a = `cursor`,
  ) =>
    new o({
      key: uc,
      state: {
        init(i, a) {
          return cl(a, e, t, n, r);
        },
        apply(i, a, o, s) {
          let c = Q.getState(s),
            l = i.getMeta(uc);
          return (c && c.isChangeOrigin) || (l && l.awarenessUpdated)
            ? cl(s, e, t, n, r)
            : a.map(i.mapping, i.doc);
        },
      },
      props: { decorations: (e) => uc.getState(e) },
      view: (t) => {
        let n = () => {
            t.docView && Qc(t, uc, { awarenessUpdated: !0 });
          },
          r = () => {
            let n = Q.getState(t.state),
              r = e.getLocalState() || {};
            if (t.hasFocus()) {
              let o = i(t.state),
                s = $c(o.anchor, n.type, n.binding.mapping),
                c = $c(o.head, n.type, n.binding.mapping);
              (r.cursor != null && Zi(Wi(r.cursor.anchor), s) && Zi(Wi(r.cursor.head), c)) ||
                e.setLocalStateField(a, { anchor: s, head: c });
            } else
              r.cursor != null &&
                tl(n.doc, n.type, Wi(r.cursor.anchor), n.binding.mapping) !== null &&
                e.setLocalStateField(a, null);
          };
        return (
          e.on(`change`, n),
          t.dom.addEventListener(`focusin`, r),
          t.dom.addEventListener(`focusout`, r),
          {
            update: r,
            destroy: () => {
              (t.dom.removeEventListener(`focusin`, r),
                t.dom.removeEventListener(`focusout`, r),
                e.off(`change`, n),
                e.setLocalStateField(a, null));
            },
          }
        );
      },
    }),
  ul = (e) => lc.getState(e)?.undoManager?.undo() != null,
  dl = (e) => lc.getState(e)?.undoManager?.redo() != null,
  fl = (e, t) => (t == null ? lc.getState(e)?.undoManager?.canUndo() : ul(e)),
  pl = (e, t) => (t == null ? lc.getState(e)?.undoManager?.canRedo() : dl(e)),
  ml = new Set([`paragraph`]),
  hl = (e, t) =>
    !(e instanceof J) ||
    !(e.content instanceof q) ||
    !(
      e.content.type instanceof Po ||
      (e.content.type instanceof U && t.has(e.content.type.nodeName))
    ) ||
    e.content.type._length === 0,
  gl = ({ protectedNodes: e = ml, trackedOrigins: t = [], undoManager: n = null } = {}) =>
    new o({
      key: lc,
      state: {
        init: (r, i) => {
          let a = Q.getState(i),
            o =
              n ||
              new xa(a.type, {
                trackedOrigins: new Set([Q].concat(t)),
                deleteFilter: (t) => hl(t, e),
                captureTransaction: (e) => e.meta.get(`addToHistory`) !== !1,
              });
          return {
            undoManager: o,
            prevSel: null,
            hasUndoOps: o.undoStack.length > 0,
            hasRedoOps: o.redoStack.length > 0,
          };
        },
        apply: (e, t, n, r) => {
          let i = Q.getState(r).binding,
            a = t.undoManager,
            o = a.undoStack.length > 0,
            s = a.redoStack.length > 0;
          return i
            ? { undoManager: a, prevSel: Dc(i, n), hasUndoOps: o, hasRedoOps: s }
            : o !== t.hasUndoOps || s !== t.hasRedoOps
              ? Object.assign({}, t, {
                  hasUndoOps: a.undoStack.length > 0,
                  hasRedoOps: a.redoStack.length > 0,
                })
              : t;
        },
      },
      view: (e) => {
        let t = Q.getState(e.state),
          n = lc.getState(e.state).undoManager;
        return (
          n.on(`stack-item-added`, ({ stackItem: n }) => {
            let r = t.binding;
            r && n.meta.set(r, lc.getState(e.state).prevSel);
          }),
          n.on(`stack-item-popped`, ({ stackItem: e }) => {
            let n = t.binding;
            n && (n.beforeTransactionSelection = e.meta.get(n) || n.beforeTransactionSelection);
          }),
          {
            destroy: () => {
              n.destroy();
            },
          }
        );
      },
    });
function _l(e, t = `comments`) {
  let r = e.getMap(t),
    i = [],
    a = new Set(),
    o = () => {
      let e = [];
      (r.forEach((t) => {
        if (!(t instanceof go)) return;
        let r = t.get(`comments`),
          i = n({
            id: t.get(`id`),
            createdAt: t.get(`createdAt`),
            resolved: t.get(`resolved`),
            comments: r instanceof po ? r.toArray() : [],
          });
        i && e.push(i);
      }),
        (i = e));
    };
  (o(),
    r.observeDeep(() => {
      (o(), a.forEach((e) => e()));
    }));
  let s = (e) => {
      let t = r.get(e)?.get(`comments`);
      return t instanceof po ? t : null;
    },
    c = (e, t) => e.toArray().findIndex((e) => e.id === t);
  return {
    threads: () => i,
    subscribe(e) {
      return (a.add(e), () => a.delete(e));
    },
    createThread(t) {
      let i = n(t);
      i &&
        !r.has(i.id) &&
        e.transact(() => {
          let e = new go();
          (e.set(`id`, i.id),
            e.set(`createdAt`, i.createdAt),
            e.set(`resolved`, i.resolved ?? null));
          let t = new po();
          (t.push(i.comments), e.set(`comments`, t), r.set(i.id, e));
        });
    },
    reply(e, t) {
      let r = n({ id: e, comments: [t] })?.comments[0];
      r && s(e)?.push([{ ...r }]);
    },
    editComment(t, n, r) {
      let i = s(t),
        a = i ? c(i, n) : -1;
      if (!i || a < 0) return;
      let o = i.get(a);
      e.transact(() => {
        (i.delete(a, 1), i.insert(a, [{ ...o, text: r.slice(0, 5e3), editedAt: Date.now() }]));
      });
    },
    deleteComment(e, t) {
      let n = s(e),
        r = n ? c(n, t) : -1;
      n && r >= 0 && n.delete(r, 1);
    },
    setResolved(e, t) {
      r.get(e)?.set(`resolved`, t ?? null);
    },
    deleteThread(e) {
      r.delete(e);
    },
  };
}
function vl(e) {
  let t = atob(e),
    n = new Uint8Array(t.length);
  for (let e = 0; e < t.length; e += 1) n[e] = t.charCodeAt(e);
  return n;
}
var yl = (e) => Error(`[nova] versions: ${String(e.error ?? `unexpected reply`)}`);
function bl(e, t) {
  return {
    async list() {
      let t = await e({ nova: `versions` });
      if (t.nova !== `versions` || !Array.isArray(t.versions)) throw yl(t);
      return t.versions.map((e) => ({
        id: String(e.id),
        createdAt: Number(e.createdAt) || 0,
        authors: Array.isArray(e.authors) ? e.authors.map(String) : [],
        label: typeof e.label == `string` ? e.label : null,
      }));
    },
    async load(n, r) {
      let i = await e({ nova: `version`, id: Number(n.id) });
      if (i.nova !== `version` || typeof i.state != `string`) throw yl(i);
      let a = new ci();
      try {
        return (wi(a, vl(i.state)), rl(a.getXmlFragment(t), r.schema).toJSON());
      } finally {
        a.destroy();
      }
    },
    async save(t) {
      let n = await e({ nova: `save-version`, ...(t ? { label: t } : {}) });
      if (n.nova !== `saved`) throw yl(n);
    },
  };
}
var xl = [`#2563eb`, `#db2777`, `#16a34a`, `#ea580c`, `#7c3aed`, `#0891b2`, `#ca8a04`, `#dc2626`];
function Sl(e) {
  let t = 0;
  for (let n of e) t = (t * 31 + n.charCodeAt(0)) | 0;
  return xl[Math.abs(t) % xl.length];
}
function Cl(e) {
  let t = typeof e.color == `string` && /^#[0-9a-f]{3,8}$/i.test(e.color) ? e.color : `#64748b`,
    n = document.createElement(`span`);
  ((n.className = `nova-collab-caret`), (n.style.borderColor = t));
  let r = document.createElement(`span`);
  return (
    (r.className = `nova-collab-label`),
    (r.style.backgroundColor = t),
    (r.textContent = String(e.name ?? ``).slice(0, 40) || `…`),
    n.append(r),
    n
  );
}
function wl(e) {
  return {
    class: `nova-collab-selection`,
    style: `background-color: ${typeof e.color == `string` && /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : `#64748b`}33;`,
  };
}
var Tl = /^#[0-9a-f]{3,8}$/i;
function El(e) {
  let t = [];
  return (
    e.getStates().forEach((n, r) => {
      let i = n.user;
      if (!i) return;
      let a = String(i.name ?? ``).slice(0, 40) || `…`,
        o = typeof i.color == `string` && Tl.test(i.color) ? i.color : `#64748b`;
      t.push({ clientId: r, name: a, color: o, self: r === e.clientID });
    }),
    t.sort((e, t) => Number(t.self) - Number(e.self) || e.name.localeCompare(t.name))
  );
}
var Dl = 15e3;
function Ol(e) {
  if (e.ydoc) {
    let t = e.awareness ?? new ks(e.ydoc);
    return { ydoc: e.ydoc, awareness: t, destroy: () => {} };
  }
  if (!e.url || !e.document) throw Error(`[nova] collab: pass url and document, or your own ydoc`);
  let t = new ci(),
    n = new Map(),
    r = 0,
    i = new ic({
      url: e.url,
      name: e.document,
      document: t,
      ...(e.token === void 0 ? {} : { token: e.token }),
      onStatus: ({ status: t }) => e.onStatus?.(t),
      onSynced: () => e.onSynced?.(),
      onAuthenticationFailed: ({ reason: t }) => e.onAuthenticationFailed?.(t),
      onStateless: ({ payload: e }) => {
        let t;
        try {
          t = JSON.parse(e);
        } catch {
          return;
        }
        let r = n.get(t.rid);
        r && (clearTimeout(r.timer), n.delete(t.rid), r.resolve(t));
      },
    });
  return {
    ydoc: t,
    awareness: i.awareness,
    request: (e) =>
      new Promise((t, a) => {
        let o = ++r,
          s = setTimeout(() => {
            (n.delete(o), a(Error(`[nova] sync server did not answer`)));
          }, Dl);
        (n.set(o, { resolve: t, timer: s }), i.sendStateless(JSON.stringify({ ...e, rid: o })));
      }),
    destroy: () => {
      (n.forEach(({ timer: e }) => clearTimeout(e)), n.clear(), i.destroy(), t.destroy());
    },
  };
}
function kl(e) {
  let n = null,
    r = () => (n ??= Ol(e)),
    i = (e) =>
      r().awareness.setLocalStateField(`user`, { name: e.name, color: e.color ?? Sl(e.name) }),
    a = u({
      name: `collab`,
      replaceHistory: !0,
      commands: { undo: fl, redo: pl },
      transformTransaction: (e) => (e.getMeta(Q)?.isChangeOrigin ? e.setMeta(t, !0) : e),
      prosemirrorPlugins: () => {
        let { ydoc: t, awareness: n } = r();
        return [
          Tc(t.getXmlFragment(e.field ?? `prosemirror`)),
          ll(n, { cursorBuilder: Cl, selectionBuilder: wl }),
          gl(),
        ];
      },
      setup(t) {
        let { awareness: a } = r();
        (e.user && i(e.user), t.root.classList.add(`nova-collab`));
        let o = () => e.onUsers?.(El(a));
        return (
          a.on(`change`, o),
          o(),
          () => {
            (a.off(`change`, o),
              t.root.classList.remove(`nova-collab`),
              a.setLocalState(null),
              n?.destroy(),
              (n = null));
          }
        );
      },
    }),
    o = null;
  return Object.assign(a, {
    setUser: i,
    commentStore: () => (o ??= _l(r().ydoc)),
    versions: () =>
      bl((e) => {
        let t = n?.request;
        return t
          ? t(e)
          : Promise.reject(Error(`[nova] versions need a sync server (url + document)`));
      }, e.field ?? `prosemirror`),
  });
}
var Al = `wss://sync.novaprose.cloud`,
  jl = `<h2>Edit this together</h2>
<p>Send the invite link to a colleague, or open a second window, and type at the same time. You will
see each other's cursors and changes instantly.</p>
<ul><li><p><strong>Undo is personal:</strong> Ctrl+Z reverts only your own changes.</p></li>
<li><p>Edits merge without conflicts, even after a dropped connection.</p></li>
<li><p>Select a phrase and press <strong>Ctrl+Alt+M</strong> to start a discussion; type <strong>@</strong> to mention someone in the room.</p></li>
<li><p>Open <strong>Version history</strong> to compare and restore earlier versions.</p></li>
<li><p>Turn on <strong>Suggest edits</strong> (Ctrl+Alt+Shift+E): your changes become suggestions others can accept or reject.</p></li></ul>`,
  Ml = [`Fox`, `Owl`, `Lynx`, `Otter`, `Heron`, `Panda`, `Koala`, `Falcon`, `Badger`, `Seal`],
  Nl = new URLSearchParams(location.hash.slice(1)).get(`room`) ?? ``,
  Pl = /^[a-z0-9]{6,32}$/.test(Nl)
    ? Nl
    : Array.from(crypto.getRandomValues(new Uint8Array(10)), (e) => (e % 36).toString(36)).join(``);
history.replaceState(null, ``, `#room=${Pl}`);
var Fl = location.href,
  Il = document.getElementById(`np-collab-name`),
  Ll =
    localStorage.getItem(`np-collab-name`) ||
    `Guest ${Ml[crypto.getRandomValues(new Uint8Array(1))[0] % Ml.length]}`;
Il.value = Ll;
var Rl = document.querySelector(`.np-collab-status`),
  zl = document.getElementById(`np-collab-status-text`),
  Bl = document.getElementById(`np-collab-users`),
  Vl = { connecting: `Connecting…`, connected: `Live`, disconnected: `Offline — reconnecting` },
  Hl = (e) =>
    e
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((e) => [...e][0].toUpperCase())
      .join(``) || `?`;
function Ul(e) {
  (Bl.replaceChildren(
    ...e.map((e) => {
      let t = document.createElement(`li`);
      return (
        (t.className = `np-collab-user`),
        t.style.setProperty(`--np-user`, e.color),
        (t.title = e.self ? `${e.name} (you)` : e.name),
        (t.textContent = Hl(e.name)),
        t
      );
    }),
  ),
    Bl.setAttribute(
      `aria-label`,
      `${e.length} ${e.length === 1 ? `person` : `people`} in this document`,
    ));
}
var Wl,
  Gl = [],
  Kl = !1,
  ql = kl({
    url: Al,
    document: `demo/${Pl}`,
    user: { name: Ll },
    onStatus: (e) => {
      ((Rl.dataset.status = e), (zl.textContent = Vl[e]));
    },
    onSynced: () => {
      (!Kl && Wl && Wl.getHTML() === `<p></p>` && Wl.setContent(jl), (Kl = !0));
    },
    onUsers: (e) => {
      ((Gl = e), Ul(e));
    },
  });
((Wl = e({
  element: document.getElementById(`np-collab-editor`),
  plugins: [ql, `quickbars`, `comments`, `mentions`, `revisionhistory`, `suggestions`],
  pluginOptions: {
    comments: { author: { id: Ll, name: Ll }, store: ql.commentStore() },
    revisionhistory: ql.versions(),
    suggestions: { author: { id: `guest-${crypto.randomUUID().slice(0, 8)}`, name: Ll } },
    mentions: {
      fetch: (e) =>
        Gl.filter((t) => !t.self && t.name.toLowerCase().includes(e.toLowerCase())).map((e) => ({
          id: `guest-${e.clientId}`,
          name: e.name,
        })),
    },
  },
  placeholder: `Loading the shared document…`,
})),
  Il.addEventListener(`change`, () => {
    let e = Il.value.trim().slice(0, 40);
    e && (localStorage.setItem(`np-collab-name`, e), ql.setUser({ name: e }));
  }));
var Jl = document.getElementById(`np-collab-copy`);
(Jl.addEventListener(`click`, async () => {
  try {
    (await navigator.clipboard.writeText(Fl), (Jl.textContent = `Link copied`));
  } catch {
    prompt(`Copy this link:`, Fl);
  }
  setTimeout(() => (Jl.textContent = `Copy link`), 2e3);
}),
  document.getElementById(`np-collab-window`).addEventListener(`click`, () => {
    window.open(Fl, `_blank`, `popup,width=760,height=720`);
  }));
