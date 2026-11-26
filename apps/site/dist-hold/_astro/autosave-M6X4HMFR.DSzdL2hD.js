import { i as e } from './chunk-YZ7YYYBN.B2vxnPKW.js';
import { t } from './chunk-NPKAIW34.BN8oA196.js';
import { t as n } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import './chunk-HZRIBOPW.C3RYobae.js';
var r = t.save,
  i = {
    en: {
      restore: `Restore last draft`,
      found: `An unsaved draft was found. Use “Restore last draft” to bring it back.`,
      restored: `Draft restored`,
    },
    ru: {
      restore: `Восстановить черновик`,
      found: `Найден несохранённый черновик. Его можно вернуть кнопкой «Восстановить черновик».`,
      restored: `Черновик восстановлен`,
    },
  };
function a() {
  try {
    return typeof localStorage > `u` ? null : localStorage;
  } catch {
    return null;
  }
}
var o = n({
  name: `autosave`,
  toolbar: `restoredraft`,
  setup(t) {
    let n = t.options.pluginOptions?.autosave ?? {},
      o = e(t, `autosave`, i),
      s = a(),
      c =
        n.key ??
        `novaprose-draft:${typeof location > `u` ? `` : location.pathname}:${t.options.element.id || `editor`}`,
      l = n.delay ?? 1e3,
      u = (n.retention ?? 10080) * 6e4,
      d = () => {
        try {
          let e = JSON.parse(s?.getItem(c) ?? `null`);
          return !e || typeof e.html != `string` || Date.now() - e.time > u ? null : e;
        } catch {
          return null;
        }
      },
      f = d();
    (f && f.html === t.getHTML() && (f = null), f && t.ui.notify({ text: o.found, timeout: 8e3 }));
    let p,
      m = () => {
        p = void 0;
        try {
          t.isEmpty()
            ? s?.removeItem(c)
            : s?.setItem(c, JSON.stringify({ html: t.getHTML(), time: Date.now() }));
        } catch {}
      },
      h = t.on(`change`, () => {
        ((f = null), clearTimeout(p), (p = setTimeout(m, l)));
      }),
      g = () => {
        let e = f ?? d();
        e && (t.setContent(e.html), (f = null), t.ui.notify({ text: o.restored }), t.focus());
      },
      _ = {
        icon: r,
        tooltip: o.restore,
        isEnabled: () => t.isEditable() && f !== null,
        onAction: g,
      };
    return (
      t.ui.registry.addButton(`restoredraft`, _),
      t.ui.registry.addMenuItem(`restoredraft`, { text: o.restore, icon: r, onAction: g }),
      () => {
        (h(), p !== void 0 && (clearTimeout(p), m()));
      }
    );
  },
});
export { i as LABELS, o as default };
