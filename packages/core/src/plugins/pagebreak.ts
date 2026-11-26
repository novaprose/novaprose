import { definePlugin } from '../plugins';

/**
 * Плагин pagebreak: разрыв страницы для печати и PDF —
 * `<div class="nova-pagebreak" style="break-after: page;"></div>`. `plugins: ['pagebreak']`.
 * Здесь — узел (схема создаётся вместе с редактором); кнопка — в pagebreak-ui.ts.
 */

export default definePlugin({
  name: 'pagebreak',
  toolbar: 'pagebreak',
  nodes: {
    pagebreak: {
      group: 'block',
      atom: true,
      selectable: true,
      parseDOM: [
        { tag: 'div.nova-pagebreak' },
        // Разрыв из других редакторов и Word: пустой блок с page-break-after / break-after.
        {
          tag: 'div',
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            const breaks = el.style.breakAfter === 'page' || el.style.pageBreakAfter === 'always';
            return breaks && !el.textContent?.trim() ? null : false;
          },
        },
      ],
      toDOM: () => ['div', { class: 'nova-pagebreak', style: 'break-after: page;' }],
    },
  },
  load: () => import('./pagebreak-ui'),
});
