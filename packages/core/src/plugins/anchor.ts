import { ELEMENT_ID_RE } from '../element-id';
import { definePlugin } from '../plugins';

/**
 * The anchor plugin: an anchor `<a id="…"></a>` for links like `#section`. `plugins: ['anchor']`.
 * Here is the node (the schema is created together with the editor); the dialog and the button are in anchor-ui.ts.
 */

/** A safe identifier: no spaces or quotes (the same check as for heading ids). */
const ID_RE = ELEMENT_ID_RE;

export default definePlugin({
  name: 'anchor',
  toolbar: 'anchor',
  nodes: {
    anchor: {
      group: 'inline',
      inline: true,
      atom: true,
      selectable: true,
      attrs: { id: {} },
      parseDOM: [
        {
          tag: 'a[id]:not([href])',
          getAttrs: (dom) => {
            const id = (dom as HTMLElement).getAttribute('id') ?? '';
            return ID_RE.test(id) ? { id } : false;
          },
        },
        {
          tag: 'a[name]:not([href])',
          getAttrs: (dom) => {
            const id = (dom as HTMLElement).getAttribute('name') ?? '';
            return ID_RE.test(id) ? { id } : false;
          },
        },
      ],
      // The document may come from JSON: the identifier is checked on output too.
      toDOM: (node) => ['a', { id: ID_RE.test(node.attrs.id as string) ? node.attrs.id : null }],
    },
  },
  load: () => import('./anchor-ui'),
});
