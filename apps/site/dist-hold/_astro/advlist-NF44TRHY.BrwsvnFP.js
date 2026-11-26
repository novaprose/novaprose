import { n as e, r as t } from './chunk-N3URGMQ5.BakyJphD.js';
import { f as n } from './chunk-MTSFB6UL.BsO1pwz8.js';
import { i as r } from './chunk-YZ7YYYBN.B2vxnPKW.js';
import { t as i } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import './chunk-HZRIBOPW.C3RYobae.js';
var a = {
  en: {
    disc: `Default`,
    circle: `Circle`,
    square: `Square`,
    decimal: `Default (1, 2, 3)`,
    'lower-alpha': `Lower alpha (a, b, c)`,
    'upper-alpha': `Upper alpha (A, B, C)`,
    'lower-roman': `Lower roman (i, ii, iii)`,
    'upper-roman': `Upper roman (I, II, III)`,
    'lower-greek': `Lower greek (α, β, γ)`,
  },
  ru: {
    disc: `По умолчанию`,
    circle: `Кружок`,
    square: `Квадрат`,
    decimal: `По умолчанию (1, 2, 3)`,
    'lower-alpha': `Строчные буквы (a, b, c)`,
    'upper-alpha': `Прописные буквы (A, B, C)`,
    'lower-roman': `Римские строчные (i, ii, iii)`,
    'upper-roman': `Римские прописные (I, II, III)`,
    'lower-greek': `Греческие (α, β, γ)`,
  },
};
function o(e, t) {
  let { $from: n } = e.selection;
  for (let e = n.depth; e > 0; e--) {
    let r = n.node(e);
    if (r.type === t) return { pos: n.before(e), attrs: r.attrs };
  }
  return null;
}
function s(e, t, r, i) {
  let a = () => n(e.view.state)[t];
  o(e.view.state, a()) || e.exec(t === `bullet_list` ? `bulletList` : `orderedList`);
  let s = o(e.view.state, a());
  if (!s) return;
  let { state: c, dispatch: l } = e.view;
  (l(c.tr.setNodeMarkup(s.pos, void 0, { ...s.attrs, listStyle: r === i ? null : r })), e.focus());
}
var c = i({
  name: `advlist`,
  setup(i) {
    let c = r(i, `advlist`, a),
      l = i.options.pluginOptions?.advlist ?? {},
      u = [
        { control: `bullist`, kind: `bullet_list`, styles: l.bullets ?? [...e], fallback: `disc` },
        {
          control: `numlist`,
          kind: `ordered_list`,
          styles: l.numbers ?? [...t],
          fallback: `decimal`,
        },
      ];
    for (let { control: e, kind: t, styles: r, fallback: a } of u) {
      let l = i.ui.registry.get(e);
      if (!l || l.type !== `button`) continue;
      let { type: u, ...d } = l;
      i.ui.registry.addSplitButton(e, {
        ...d,
        items: (e) => {
          let i = o(e.view.state, n(e.view.state)[t]),
            l = i?.attrs.listStyle ?? (i ? a : null);
          return r.map((n) => ({
            id: n,
            label: c[n],
            active: l === n,
            onSelect: () => s(e, t, n, a),
          }));
        },
      });
    }
  },
});
export { a as LABELS, c as default };
