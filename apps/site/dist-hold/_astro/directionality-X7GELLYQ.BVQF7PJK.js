import { f as e } from './chunk-MTSFB6UL.BsO1pwz8.js';
import { i as t } from './chunk-YZ7YYYBN.B2vxnPKW.js';
import { t as n } from './chunk-NPKAIW34.BN8oA196.js';
import { t as r } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import './chunk-HZRIBOPW.C3RYobae.js';
var i = { ltr: n.ltr, rtl: n.rtl },
  a = {
    en: { ltr: `Left to right`, rtl: `Right to left` },
    ru: { ltr: `Слева направо`, rtl: `Справа налево` },
  };
function o(e) {
  return e.view.state.selection.$from.parent.attrs.dir ?? null;
}
function s(t) {
  return (n, r) => {
    let { paragraph: i, heading: a } = e(n),
      o = n.tr,
      s = !1;
    return (
      n.doc.nodesBetween(
        n.selection.from,
        n.selection.to,
        (e, n) =>
          (e.type !== i && e.type !== a) ||
          ((s = !0), o.setNodeMarkup(n, void 0, { ...e.attrs, dir: t }), !1),
      ),
      s ? (r?.(o), !0) : !1
    );
  };
}
var c = r({
  name: `directionality`,
  toolbar: `ltr rtl`,
  setup(e) {
    let n = t(e, `directionality`, a);
    for (let t of [`ltr`, `rtl`]) {
      let r = () => o(e) === t,
        a = () => {
          (e.exec(s(r() ? null : t)), e.focus());
        };
      (e.ui.registry.addToggleButton(t, {
        icon: i[t],
        tooltip: n[t],
        isActive: r,
        isEnabled: (e) => e.can(s(t)),
        onAction: a,
      }),
        e.ui.registry.addToggleMenuItem(t, { text: n[t], icon: i[t], isActive: r, onAction: a }));
    }
  },
});
export { a as LABELS, c as default };
