import { ELEMENT_ID_RE } from '../element-id';
import { definePlugin } from '../plugins';

/**
 * Плагин anchor: якорь `<a id="…"></a>` для ссылок вида `#раздел`. `plugins: ['anchor']`.
 * Здесь — узел (схема создаётся вместе с редактором); диалог и кнопка — в anchor-ui.ts.
 */

/** Безопасный идентификатор: без пробелов и кавычек (общая проверка с id заголовков). */
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
      // Документ мог прийти из JSON — идентификатор проверяем и на выходе.
      toDOM: (node) => ['a', { id: ID_RE.test(node.attrs.id as string) ? node.attrs.id : null }],
    },
  },
  load: () => import('./anchor-ui'),
});
