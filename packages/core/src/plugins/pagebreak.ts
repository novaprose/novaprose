import { definePlugin } from '../plugins';

/**
 * The pagebreak plugin: a page break for printing and PDF:
 * `<div class="nova-pagebreak" style="break-after: page;"></div>`. `plugins: ['pagebreak']`.
 * Here is the node (the schema is created together with the editor); the button is in pagebreak-ui.ts.
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
        // A break from other editors and Word: an empty block with page-break-after / break-after.
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
