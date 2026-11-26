import { i as e, n as t } from './chunk-YZ7YYYBN.B2vxnPKW.js';
import { t as n } from './chunk-NPKAIW34.BN8oA196.js';
import { t as r } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import './chunk-HZRIBOPW.C3RYobae.js';
import { n as i } from './dist.FSNhl50G.js';
var a = `\xA0`,
  o = n.nonBreaking,
  s = { en: { title: `Nonbreaking space` }, ru: { title: `Неразрывный пробел` } },
  c = r({
    name: `nonbreaking`,
    toolbar: `nonbreaking`,
    prosemirrorPlugins: () => [
      i({ 'Mod-Shift-Space': (e, t) => (t?.(e.tr.insertText(a).scrollIntoView()), !0) }),
    ],
    setup(n) {
      let { title: r } = e(n, `nonbreaking`, s),
        i = {
          icon: o,
          tooltip: r,
          shortcut: `Mod-Shift-Space`,
          isEnabled: () => n.isEditable(),
          onAction: () => t(n, a),
        };
      (n.ui.registry.addButton(`nonbreaking`, i),
        n.ui.registry.addMenuItem(`nonbreaking`, { text: r, icon: o, onAction: i.onAction }));
    },
  });
export { s as LABELS, c as default };
