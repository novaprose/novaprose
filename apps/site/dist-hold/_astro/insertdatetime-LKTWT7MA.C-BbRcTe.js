import { i as e, n as t } from './chunk-YZ7YYYBN.B2vxnPKW.js';
import { t as n } from './chunk-NPKAIW34.BN8oA196.js';
import { t as r } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import './chunk-HZRIBOPW.C3RYobae.js';
var i = n.dateTime,
  a = {
    en: {
      title: `Insert date/time`,
      date: `Date`,
      time: `Time`,
      dateTime: `Date and time`,
      long: `Long date`,
    },
    ru: {
      title: `Вставить дату/время`,
      date: `Дата`,
      time: `Время`,
      dateTime: `Дата и время`,
      long: `Дата прописью`,
    },
  },
  o = {
    date: { dateStyle: `short` },
    long: { dateStyle: `long` },
    time: { timeStyle: `short` },
    dateTime: { dateStyle: `short`, timeStyle: `short` },
  },
  s = r({
    name: `insertdatetime`,
    toolbar: `insertdatetime`,
    setup(n) {
      let r = n.options.language ?? `en`,
        s = e(n, `insertdatetime`, a),
        c = () => n.options.pluginOptions?.insertdatetime?.now?.() ?? new Date(),
        l = (e) => new Intl.DateTimeFormat(r, o[e]).format(c());
      (n.ui.registry.addMenuItem(`insertdatetime`, {
        text: s.title,
        icon: i,
        onAction: (e) => t(e, l(`dateTime`)),
      }),
        n.ui.registry.addMenuButton(`insertdatetime`, {
          icon: i,
          tooltip: s.title,
          items: (e) =>
            [`date`, `long`, `time`, `dateTime`].map((n) => {
              let r = l(n);
              return { id: n, label: `${s[n]}: ${r}`, onSelect: () => t(e, r) };
            }),
        }));
    },
  });
export { a as LABELS, s as default };
