import { O as e, d as t, h as n, u as r } from './chunk-3UQTYDSY.0j1Eea0P.js';
import { x as i } from './chunk-N3URGMQ5.BakyJphD.js';
import './chunk-MTSFB6UL.BsO1pwz8.js';
import { t as a } from './chunk-NPKAIW34.BN8oA196.js';
import { t as o } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import './chunk-HZRIBOPW.C3RYobae.js';
import { c as s } from './dist.DtV7jSsK.js';
var c = `bold italic underline | quicklink h2 h3 blockquote`,
  l = `quickimage quicktable`;
function u(e) {
  let { selection: t } = e.view.state;
  return !(t instanceof s) || t.empty || t.$from.parent.type.spec.code
    ? !1
    : e.view.state.doc.textBetween(t.from, t.to).trim().length > 0;
}
function d(e) {
  let { selection: t } = e.view.state;
  if (!t.empty) return !1;
  let { $from: n } = t;
  return (
    n.depth === 1 &&
    n.parent.type === e.schema.nodes.paragraph &&
    n.parent.content.size === 0 &&
    !i(e.view.state)
  );
}
function f(n) {
  let r = document.createElement(`input`);
  ((r.type = `file`),
    (r.accept = `image/png,image/jpeg,image/gif,image/webp,image/avif`),
    r.addEventListener(`change`, () => {
      let i = [...(r.files ?? [])].filter(t);
      i.length && e(n, i);
    }),
    r.click());
}
var p = o({
  name: `quickbars`,
  setup(e) {
    let { registry: t, t: i } = e.ui,
      o = e.options.pluginOptions?.quickbars ?? {};
    (t.addButton(`quicklink`, {
      icon: a.link,
      tooltip: i(`link`),
      shortcut: `Mod-k`,
      onAction: (e) => n(e),
    }),
      t.addButton(`quickimage`, { icon: a.image, tooltip: i(`image`), onAction: (e) => f(e) }),
      t.addButton(`quicktable`, {
        icon: a.table,
        tooltip: i(`table.insert`),
        onAction: (e) => e.exec(r(2, 2)),
      }));
    let s = o.selection === void 0 ? c : o.selection;
    s &&
      t.addContextToolbar(`quickbars-selection`, {
        label: i(`quickbars.selection`),
        predicate: u,
        items: s,
        position: `selection`,
        placement: `top-start`,
        priority: 10,
      });
    let p = o.insert === void 0 ? l : o.insert;
    p &&
      t.addContextToolbar(`quickbars-insert`, {
        label: i(`quickbars.insert`),
        predicate: d,
        items: p,
        position: `selection`,
        placement: `bottom-start`,
      });
  },
});
export {
  l as DEFAULT_INSERT,
  c as DEFAULT_SELECTION,
  p as default,
  u as hasTextSelection,
  d as isOnEmptyLine,
};
