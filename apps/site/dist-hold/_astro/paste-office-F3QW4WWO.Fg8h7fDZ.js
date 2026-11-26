function e(e) {
  return /data-pm-slice=/.test(e)
    ? `nova`
    : /<google-sheets-html-origin|data-sheets-(root|value)/i.test(e)
      ? `google-sheets`
      : /id="docs-internal-guid-/.test(e)
        ? `google-docs`
        : /urn:schemas-microsoft-com:office:excel|ProgId"?\s+content="?Excel\.Sheet/i.test(e)
          ? `excel`
          : /urn:schemas-microsoft-com:office:word|class="?Mso|mso-list:|content="?Microsoft Word/i.test(
                e,
              )
            ? `word`
            : /class="[^"]*\b(TextRun|OutlineElement|EOP|SCXW\d+|BCX\d+)\b|data-ccp-props|paraid=/.test(
                  e,
                )
              ? `word-online`
              : /content="?LibreOffice|content="?OpenOffice/i.test(e)
                ? `libreoffice`
                : `web`;
}
function t(t, n = `clean`) {
  let r = e(t);
  if (r === `nova`) return t;
  let a = document.createElement(`template`);
  a.innerHTML = t;
  let s = document.createElement(`div`);
  return (
    s.append(a.content),
    i(s),
    o(s),
    r === `word` && m(s),
    r === `google-docs` && x(s),
    v(s),
    S(s),
    s.querySelectorAll(`[style]`).forEach((e) => E(e, n)),
    n === `clean` && D(s),
    O(s),
    A(s),
    M(s),
    N(s),
    r !== `web` && s.querySelectorAll(`[class]`).forEach((e) => e.removeAttribute(`class`)),
    s.innerHTML
  );
}
function n(e) {
  let t = new Map();
  for (let n of e.split(`;`)) {
    let e = n.indexOf(`:`);
    if (e < 0) continue;
    let r = n.slice(0, e).trim().toLowerCase(),
      i = n
        .slice(e + 1)
        .trim()
        .replace(/\s*!important$/i, ``);
    r && i && t.set(r, i);
  }
  return t;
}
function r(e) {
  return [...e].map(([e, t]) => `${e}: ${t}`).join(`; `);
}
function i(e) {
  let t = [...e.querySelectorAll(`style`)].map((e) => e.textContent ?? ``);
  if (!t.length) return;
  let i = [],
    a = t
      .join(
        `
`,
      )
      .replace(/\/\*[\s\S]*?\*\//g, ``)
      .replace(/<!--|-->/g, ``);
  for (let e of a.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    let t = n(e[2]);
    for (let n of e[1].split(`,`)) {
      let e = n.trim().match(/^([a-z][a-z0-9]*)?\.([\w-]+)$/i);
      e && i.push({ tag: (e[1] ?? ``).toLowerCase(), cls: e[2], decls: t });
    }
  }
  i.length &&
    e.querySelectorAll(`[class]`).forEach((e) => {
      let t = e.className.split(/\s+/).filter(Boolean),
        a = new Map();
      for (let n of i)
        t.includes(n.cls) &&
          ((n.tag && n.tag !== e.tagName.toLowerCase()) || n.decls.forEach((e, t) => a.set(t, e)));
      a.size &&
        (n(e.getAttribute(`style`) ?? ``).forEach((e, t) => a.set(t, e)),
        e.setAttribute(`style`, r(a)));
    });
}
var a = /^(STYLE|SCRIPT|META|LINK|TITLE|XML|HEAD|NOSCRIPT|TEMPLATE)$/;
function o(e) {
  let t = document.createTreeWalker(e, NodeFilter.SHOW_COMMENT),
    n = [];
  for (; t.nextNode();) n.push(t.currentNode);
  n.forEach((e) => e.parentNode?.removeChild(e));
  for (let t of [...e.querySelectorAll(`*`)]) {
    if (!e.contains(t)) continue;
    let n = t.tagName.toUpperCase();
    if (a.test(n)) t.remove();
    else if (n.includes(`:`)) {
      let e = n.split(`:`)[0];
      e === `O` || e === `V` ? t.remove() : P(t);
    }
  }
  (e.querySelectorAll(`span.EOP`).forEach((e) => {
    /^\s*$/.test(e.textContent ?? ``) && e.remove();
  }),
    e.querySelectorAll(`a`).forEach((e) => {
      let t = e.getAttribute(`href`) ?? ``,
        n = t.match(/^https?:\/\/(www\.)?google\.[a-z.]+\/url\?(.*)$/i);
      if (n) {
        let t = new URLSearchParams(n[2]).get(`q`);
        t && e.setAttribute(`href`, t);
      }
      (!t || /^#_(ftn|edn|msocom|Toc|Ref)/i.test(t)) && P(e);
    }),
    e.querySelectorAll(`br[style*="page-break"]`).forEach((e) => e.remove()),
    e
      .querySelectorAll(
        `[style*="mso-element:footnote-list"], [style*="mso-element:comment-list"], [style*="mso-element:endnote-list"]`,
      )
      .forEach((e) => e.remove()));
}
var s = /^[([]?(\d+(\.\d+)*[.)\]]?|[a-z]{1,4}[.)\]])$/i;
function c(e) {
  let t = (e.getAttribute(`style`) ?? ``).match(/mso-list:\s*(l\d+)\s+level(\d+)/i);
  if (!t) return null;
  let n = [...e.querySelectorAll(`[style]`)].find((e) =>
      /mso-list:\s*Ignore/i.test(e.getAttribute(`style`) ?? ``),
    ),
    r = (n?.textContent ?? ``).replace(/\s+/g, ``);
  n?.remove();
  let i = s.test(r),
    { style: a, start: o } = i ? f(r) : { style: p(r), start: 1 };
  return { el: e, level: Math.max(1, Math.min(9, Number(t[2]))), ordered: i, start: o, style: a };
}
var l = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i,
  u = { i: 1, v: 5, x: 10 };
function d(e) {
  let t = 0,
    n = e.toLowerCase();
  for (let e = 0; e < n.length; e++) {
    let r = u[n[e]],
      i = u[n[e + 1] ?? ``] ?? 0;
    t += r < i ? -r : r;
  }
  return t;
}
function f(e) {
  let t = e.match(/\d+/);
  if (t) return { style: null, start: Number(t[0]) };
  let n = e.replace(/[^a-z]/gi, ``);
  return l.test(n)
    ? { style: n === n.toLowerCase() ? `lower-roman` : `upper-roman`, start: d(n) }
    : {
        style: n === n.toLowerCase() ? `lower-alpha` : `upper-alpha`,
        start: n.toLowerCase().charCodeAt(0) - 96,
      };
}
function p(e) {
  return e === `o` ? `circle` : /^[§▪■]$/.test(e) ? `square` : null;
}
function m(e) {
  let t = [...e.querySelectorAll(`p, div, h1, h2, h3, h4, h5, h6`)].filter((e) =>
    /mso-list:\s*l\d+\s+level\d+/i.test(e.getAttribute(`style`) ?? ``),
  );
  for (let e of t.filter((e) => /^H[1-6]$/.test(e.tagName)))
    e.querySelectorAll(`[style]`).forEach((e) => {
      if (!/mso-list:\s*Ignore/i.test(e.getAttribute(`style`) ?? ``)) return;
      let t = (e.textContent ?? ``).replace(/\s+/g, ``);
      e.replaceWith(e.ownerDocument.createTextNode(`${t} `));
    });
  let n = t.filter((e) => !/^H[1-6]$/.test(e.tagName)),
    r = new Set();
  for (let e of n) {
    if (r.has(e)) continue;
    let t = [],
      i = e;
    for (; i instanceof HTMLElement && n.includes(i);) {
      let e = c(i);
      if (!e) break;
      (t.push(e), r.add(i), (i = h(i)));
    }
    t.length && g(t);
  }
}
function h(e) {
  let t = e.nextSibling;
  for (; t && t.nodeType === Node.TEXT_NODE && !t.textContent?.trim();) t = t.nextSibling;
  return t instanceof Element ? t : null;
}
function g(e) {
  let t = e[0].el.ownerDocument,
    n = e[0].el,
    r = [],
    i = null;
  for (let n of e) {
    for (; r.length && r[r.length - 1].level > n.level;) r.pop();
    let e = r[r.length - 1];
    if (!e || e.level < n.level) {
      let a = t.createElement(n.ordered ? `ol` : `ul`);
      (n.ordered && n.start !== 1 && a.setAttribute(`start`, String(n.start)),
        n.style && (a.style.listStyleType = n.style),
        e
          ? (e.list.lastElementChild ?? e.list.appendChild(t.createElement(`li`))).appendChild(a)
          : (i = a),
        (e = { list: a, level: n.level }),
        r.push(e));
    }
    let a = t.createElement(`li`),
      o = t.createElement(`p`);
    for (; n.el.firstChild;) o.appendChild(n.el.firstChild);
    (a.appendChild(o), e.list.appendChild(a));
  }
  (n.replaceWith(i), e.slice(1).forEach((e) => e.el.remove()));
}
function _(e) {
  let t = e.getAttribute(`aria-level`) ?? e.getAttribute(`data-aria-level`),
    n = t ? Number(t) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(9, n) : null;
}
function v(e) {
  (e.querySelectorAll(`div`).forEach((e) => {
    let t = e.children.length === 1 ? e.firstElementChild : null;
    t &&
      /^(UL|OL)$/.test(t.tagName) &&
      !e.textContent?.replace(t.textContent ?? ``, ``).trim() &&
      P(e);
  }),
    e.querySelectorAll(`ul > ul, ul > ol, ol > ul, ol > ol`).forEach((e) => {
      let t = e.previousElementSibling;
      t?.tagName === `LI` && t.appendChild(e);
    }));
  let t = [...e.querySelectorAll(`ul, ol`)].filter(
      (e) =>
        !e.parentElement?.closest(`ul, ol`) &&
        e.querySelector(`li[aria-level], li[data-aria-level]`),
    ),
    n = new Set();
  for (let r of t) {
    if (n.has(r) || !e.contains(r)) continue;
    let t = [],
      i = r;
    for (; i && /^(UL|OL)$/.test(i.tagName);) {
      (n.add(i), y(i, 1, t));
      let e = h(i);
      (i !== r && i.remove(), (i = e));
    }
    if (!t.length) continue;
    let a = r.ownerDocument.createElement(`div`);
    (r.replaceWith(a), b(t, a));
  }
}
function y(e, t, n) {
  for (let r of [...e.children]) {
    if (r.tagName !== `LI`) continue;
    let i = _(r) ?? t,
      a = [...r.children].filter((e) => /^(UL|OL)$/.test(e.tagName));
    a.forEach((e) => e.remove());
    let o = r.ownerDocument.createElement(`div`);
    for (; r.firstChild;) o.appendChild(r.firstChild);
    (n.push({
      el: o,
      level: i,
      ordered: e.tagName === `OL`,
      start: Number(e.getAttribute(`start`) ?? 1) || 1,
    }),
      a.forEach((e) => y(e, i + 1, n)));
  }
}
function b(e, t) {
  let n = t.ownerDocument,
    r = [],
    i = null;
  for (let t of e) {
    for (; r.length && r[r.length - 1].level > t.level;) r.pop();
    let e = r[r.length - 1];
    if (!e || e.level < t.level) {
      let a = n.createElement(t.ordered ? `ol` : `ul`);
      (t.ordered && t.start !== 1 && !e && a.setAttribute(`start`, String(t.start)),
        e
          ? (e.list.lastElementChild ?? e.list.appendChild(n.createElement(`li`))).appendChild(a)
          : (i = a),
        (e = { list: a, level: t.level }),
        r.push(e));
    }
    let a = n.createElement(`li`);
    for (; t.el.firstChild;) a.appendChild(t.el.firstChild);
    e.list.appendChild(a);
  }
  t.replaceWith(i);
}
function x(e) {
  (e.querySelectorAll(`[id^="docs-internal-guid-"]`).forEach(P),
    e.querySelectorAll(`li[role="checkbox"]`).forEach((e) => {
      (e.removeAttribute(`role`), e.removeAttribute(`aria-checked`));
    }));
}
function S(e) {
  (e.querySelectorAll(`p.MsoTitle, p[class*="Title"]`).forEach((e) => {
    /\bMsoTitle\b|^Title$/.test(e.className) && F(e, `h1`);
  }),
    e.querySelectorAll(`div.WordSection1, div[class^="WordSection"], div.Section1`).forEach(P));
}
var C = /^(black|windowtext|auto|#000|#000000|rgb\(0,\s*0,\s*0\)|initial|inherit)$/i,
  w =
    /^(transparent|white|window|auto|none|#fff|#ffffff|rgba?\(255,\s*255,\s*255(,\s*1)?\)|rgba\(\d+,\s*\d+,\s*\d+,\s*0\)|initial|inherit)$/i,
  T =
    /^(font|font-family|font-size|line-height|margin|margin-.+|padding|padding-.+|text-indent|letter-spacing|word-spacing|white-space|height|width|min-height|border|border-.+|tab-stops|layout-grid-mode|page-break-.+|break-.+|orphans|widows|direction|unicode-bidi|font-variant.*|text-transform)$/i;
function E(e, t) {
  let i = n(e.getAttribute(`style`) ?? ``),
    a = new Map();
  i.forEach((n, r) => {
    if (r.startsWith(`mso-`))
      r === `mso-highlight` &&
        !w.test(n) &&
        !i.has(`background-color`) &&
        a.set(`background-color`, n);
    else if (!(r.startsWith(`-webkit-`) || r.startsWith(`-moz-`))) {
      if (r === `background`) {
        let e = n.split(/\s+/)[0];
        /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)$/i.test(e) &&
          !a.has(`background-color`) &&
          a.set(`background-color`, e);
      } else
        r === `text-decoration` || r === `text-decoration-line`
          ? /underline/.test(n)
            ? a.set(`text-decoration`, `underline`)
            : /line-through/.test(n) && a.set(`text-decoration`, `line-through`)
          : (t === `clean` && T.test(r)) ||
            (t === `clean` && r === `vertical-align` && /^(TD|TH)$/.test(e.tagName)) ||
            a.set(r, n);
    }
  });
  let o = a.get(`color`);
  o && C.test(o.trim()) && t === `clean` && a.delete(`color`);
  let s = a.get(`background-color`);
  (s && w.test(s.trim()) && a.delete(`background-color`),
    a.get(`font-weight`) === `normal` && e.tagName !== `B` && a.delete(`font-weight`),
    a.get(`font-style`) === `normal` && a.delete(`font-style`),
    a.get(`text-decoration`) === `none` && a.delete(`text-decoration`),
    a.get(`vertical-align`) === `baseline` && a.delete(`vertical-align`),
    /^(left|start)$/i.test(a.get(`text-align`) ?? ``) && a.delete(`text-align`),
    t === `clean` &&
      e.closest(`a`) &&
      (a.delete(`color`), a.get(`text-decoration`) === `underline` && a.delete(`text-decoration`)),
    a.size ? e.setAttribute(`style`, r(a)) : e.removeAttribute(`style`));
}
function D(e) {
  e.querySelectorAll(`table, tr, td, th, col, colgroup`).forEach((e) => {
    (e.removeAttribute(`width`), e.removeAttribute(`height`), e.removeAttribute(`valign`));
  });
}
function O(e) {
  for (let t of [...e.querySelectorAll(`span, font`)].reverse())
    e.contains(t) &&
      (t.hasAttribute(`style`) || (t.tagName === `FONT` && t.hasAttribute(`color`)) || P(t));
  (e.querySelectorAll(`[class]`).forEach((e) => e.removeAttribute(`class`)),
    e.querySelectorAll(`[lang]`).forEach((e) => e.removeAttribute(`lang`)),
    e.querySelectorAll(`[dir]`).forEach((e) => {
      /^rtl$/i.test(e.getAttribute(`dir`) ?? ``) || e.removeAttribute(`dir`);
    }));
}
var k = /^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE|HR)$/;
function A(e) {
  e.querySelectorAll(`br`).forEach((t) => {
    let n = t.parentElement;
    if (!n || (n !== e && n.tagName !== `DIV` && n.tagName !== `TD` && n.tagName !== `LI`)) return;
    let r = j(t, -1),
      i = j(t, 1);
    ((r && k.test(r.tagName)) || (i && k.test(i.tagName)) || (!r && !i && n === e)) && t.remove();
  });
}
function j(e, t) {
  let n = t < 0 ? e.previousSibling : e.nextSibling;
  for (; n && n.nodeType === Node.TEXT_NODE && !n.textContent?.trim();)
    n = t < 0 ? n.previousSibling : n.nextSibling;
  return n instanceof Element ? n : null;
}
function M(e) {
  e.querySelectorAll(`p`).forEach((e) => {
    e.children.length === 0 && /^\s*$/.test(e.textContent ?? ``) && (e.textContent = ``);
  });
}
function N(e) {
  e.querySelectorAll(`td, th`).forEach((e) => {
    if (!e.style) return;
    let t = e.style.textAlign,
      n = [...e.children].some((e) => k.test(e.tagName));
    if (!t || n || !e.textContent?.trim()) return;
    let r = e.ownerDocument.createElement(`p`);
    for (r.style.textAlign = t; e.firstChild;) r.appendChild(e.firstChild);
    (e.appendChild(r),
      e.style.removeProperty(`text-align`),
      e.getAttribute(`style`) || e.removeAttribute(`style`));
  });
}
function P(e) {
  let t = e.parentNode;
  if (t) {
    for (; e.firstChild;) t.insertBefore(e.firstChild, e);
    t.removeChild(e);
  }
}
function F(e, t) {
  let n = e.ownerDocument.createElement(t);
  for (let t of [...e.attributes]) n.setAttribute(t.name, t.value);
  for (; e.firstChild;) n.appendChild(e.firstChild);
  return (e.replaceWith(n), n);
}
export { t as cleanPastedHTML, e as detectPasteSource };
