import { i as e } from './chunk-YZ7YYYBN.B2vxnPKW.js';
import { t } from './chunk-NPKAIW34.BN8oA196.js';
import { t as n } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import './chunk-HZRIBOPW.C3RYobae.js';
var r = t.visualBlocks,
  i = { en: { title: `Show blocks` }, ru: { title: `Показать блоки` } },
  a = n({
    name: `visualblocks`,
    toolbar: `visualblocks`,
    setup(t) {
      let { title: n } = e(t, `visualblocks`, i),
        a = t.options.pluginOptions?.visualblocks ?? {},
        o = () => t.root.classList.contains(`nova-visualblocks`),
        s = () => {
          (t.root.classList.toggle(`nova-visualblocks`), t.updateUI(), t.focus());
        };
      return (
        a.default && t.root.classList.add(`nova-visualblocks`),
        t.ui.registry.addToggleButton(`visualblocks`, {
          icon: r,
          tooltip: n,
          isActive: o,
          onAction: s,
        }),
        t.ui.registry.addToggleMenuItem(`visualblocks`, {
          text: n,
          icon: r,
          isActive: o,
          onAction: s,
        }),
        () => t.root.classList.remove(`nova-visualblocks`)
      );
    },
  });
export { i as LABELS, a as default };
