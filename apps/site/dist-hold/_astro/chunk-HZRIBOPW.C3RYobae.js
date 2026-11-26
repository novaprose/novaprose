function e(e, t = {}, ...n) {
  let r = document.createElement(e);
  for (let [e, n] of Object.entries(t))
    n != null &&
      n !== !1 &&
      (typeof n == `function`
        ? r.addEventListener(e.replace(/^on/, ``).toLowerCase(), n)
        : e === `className`
          ? (r.className = String(n))
          : r.setAttribute(e, n === !0 ? `` : String(n)));
  for (let e of n.flat()) e != null && e !== !1 && r.append(e);
  return r;
}
function t(e) {
  let t = document.createElement(`span`);
  return ((t.className = `nova-icon`), (t.innerHTML = e), t);
}
var n = 0;
function r(e = `nova`) {
  return ((n += 1), `${e}-${n}`);
}
var i = typeof navigator < `u` && /Mac|iP(hone|[oa]d)/.test(navigator.platform);
function a(e) {
  let t = e.split(`-`),
    n = t.pop(),
    r = n.length === 1 ? n.toUpperCase() : n;
  if (i) {
    let e = { Mod: `⌘`, Shift: `⇧`, Alt: `⌥`, Ctrl: `⌃` };
    return t.map((t) => e[t] ?? t).join(``) + r;
  }
  let a = { Mod: `Ctrl`, Shift: `Shift`, Alt: `Alt`, Ctrl: `Ctrl` };
  return [...t.map((e) => a[e] ?? e), r].join(`+`);
}
var o = `a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`;
export { r as a, t as i, a as n, e as r, o as t };
