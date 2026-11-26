import { t as e } from './chunk-HPLT3XRZ.CB2AI2JC.js';
var t = e({
  name: `autoresize`,
  setup(e) {
    let { minHeight: t, maxHeight: n } = e.options.pluginOptions?.autoresize ?? {},
      r = e.root.querySelector(`.nova-content`);
    if (r)
      return (
        e.root.classList.add(`nova-autoresize`),
        t !== void 0 && e.root.style.setProperty(`--nova-min-height`, `${t}px`),
        n !== void 0 && (r.style.maxHeight = `${n}px`),
        () => {
          (e.root.classList.remove(`nova-autoresize`),
            e.root.style.removeProperty(`--nova-min-height`),
            r.style.removeProperty(`max-height`));
        }
      );
  },
});
export { t as default };
