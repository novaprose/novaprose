function e(e) {
  return e;
}
var t = new Map();
function n(e, n) {
  t.set(e, n);
}
function r(e) {
  return t.has(e);
}
function i(e) {
  return typeof e == `function`;
}
function a(e) {
  let n = [],
    r = [],
    a = [];
  for (let o of e)
    if (typeof o == `string`) {
      let e = t.get(o);
      e ? (i(e) ? r.push(e) : n.push(e)) : a.push(`Plugin "${o}" is not registered`);
    } else i(o) ? r.push(o) : n.push(o);
  return { plugins: n, loaders: r, errors: a };
}
function o(e, t = new Set()) {
  let n = new Map(e.map((e) => [e.name, e])),
    r = [],
    i = [],
    a = new Map(),
    o = (e, s) => {
      let c = a.get(e.name);
      if (c === `done`) return !0;
      if (c === `failed`) return !1;
      if (c === `visiting`)
        return (i.push(`Plugin dependency cycle: ${[...s, e.name].join(` → `)}`), !1);
      a.set(e.name, `visiting`);
      for (let r of e.requires ?? []) {
        if (t.has(r)) continue;
        let c = n.get(r);
        if (!c)
          return (
            i.push(`Plugin "${e.name}" requires "${r}", which is not loaded`),
            a.set(e.name, `failed`),
            !1
          );
        if (!o(c, [...s, e.name])) return (a.set(e.name, `failed`), !1);
      }
      return (a.set(e.name, `done`), r.push(e), !0);
    };
  for (let t of e) o(t, []);
  return { ordered: r, errors: i };
}
async function s(e) {
  let t = await e();
  return `default` in t && t.default ? t.default : t;
}
export { n as a, o as i, r as n, a as o, s as r, e as t };
