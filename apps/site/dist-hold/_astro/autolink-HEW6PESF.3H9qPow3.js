import { d as e, l as t } from './chunk-MTSFB6UL.BsO1pwz8.js';
import { t as n } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import { l as r, u as i } from './style.jq9nI6HT.js';
import { i as a, o } from './dist.DtV7jSsK.js';
var s =
    /(?:^|[\s(])((?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,;:!?)\]'"]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)([.,;:!?)\]'"]*)$/i,
  c = /^(?:https?:\/\/|www\.)\S+$|^mailto:\S+$/i;
function l(e) {
  return /^www\./i.test(e) ? `https://${e}` : /^[\w.+-]+@/.test(e) ? `mailto:${e}` : e;
}
function u(n, r, i) {
  let a = n.doc.resolve(i);
  if (!a.parent.isTextblock || a.parent.type.spec.code) return !1;
  let o = a.parent.textBetween(0, a.parentOffset, void 0, `￼`).match(s);
  if (!o) return !1;
  let c = o[1],
    u = i - o[2].length,
    d = u - c.length,
    f = e(n).link;
  if (n.doc.rangeHasMark(d, u, f)) return !1;
  let p = l(c);
  return t(p) ? (r.addMark(d, u, f.create({ href: p })), !0) : !1;
}
var d = n({
  name: `autolink`,
  prosemirrorPlugins: (n) => [
    i({
      rules: [
        new r(/\S\s$/, (t, r, i, a) => {
          if (!n.isAllowed(`link`)) return null;
          let o = t.tr;
          return u(t, o, i + r[0].length - 1)
            ? o.insertText(r[0].slice(-1), a).removeStoredMark(e(t).link)
            : null;
        }),
      ],
    }),
    new a({
      appendTransaction(e, t, r) {
        if (!n.isAllowed(`link`) || !e.some((e) => e.docChanged)) return null;
        let { $from: i, empty: a } = r.selection;
        if (!a || i.parentOffset !== 0 || i.depth < 1) return null;
        let s = o.findFrom(r.doc.resolve(i.before()), -1, !0);
        if (!s || !s.empty || s.$from.parentOffset !== s.$from.parent.content.size) return null;
        let c = r.tr;
        return u(r, c, s.from) ? c : null;
      },
    }),
    new a({
      props: {
        handlePaste(r, i) {
          let { state: a } = r;
          if (a.selection.empty || !n.isAllowed(`link`)) return !1;
          let o = (i.clipboardData?.getData(`text/plain`) ?? ``).trim();
          if (!c.test(o)) return !1;
          let s = l(o);
          if (!t(s)) return !1;
          let { from: u, to: d } = a.selection,
            f = e(a).link;
          return (r.dispatch(a.tr.removeMark(u, d, f).addMark(u, d, f.create({ href: s }))), !0);
        },
      },
    }),
  ],
});
export { d as default };
