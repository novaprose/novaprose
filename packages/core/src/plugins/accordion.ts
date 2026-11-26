import type { DOMOutputSpec, NodeSpec } from 'prosemirror-model';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';

/**
 * Плагин accordion: раскрывающиеся блоки — заголовок и содержимое, которое сворачивается
 * (`<details><summary>`), как у TinyMCE (`accordion`) и Tiptap (Details). `plugins: ['accordion']`.
 *
 * Здесь — только узлы документа (схема создаётся вместе с редактором); кнопка, команды,
 * сворачивание и клавиши — ленивой частью accordion-ui.ts.
 */

/** Подписи (ленивая часть берёт их отсюда: ключи переводов — accordion.*). */
export const LABELS = {
  en: {
    accordion: 'Accordion',
    summary: 'Summary',
    expand: 'Expand',
    collapse: 'Collapse',
  },
};

export type AccordionState = 'inherited' | 'collapsed' | 'expanded';

export interface AccordionOptions {
  /**
   * Состояние при загрузке HTML: как в разметке (`inherited`, по умолчанию), все свёрнуты
   * (`collapsed`) или все раскрыты (`expanded`). Как `details_initial_state` у TinyMCE.
   */
  initialState?: AccordionState;
  /**
   * Атрибут `open` в getHTML: как в редакторе (`inherited`, по умолчанию), всегда свёрнуто или
   * всегда раскрыто. Как `details_serialized_state` у TinyMCE.
   */
  serializedState?: AccordionState;
}

function accordionNodes(editor: Editor): Record<string, NodeSpec> {
  const options = (editor.options.pluginOptions?.accordion ?? {}) as AccordionOptions;
  const initial = options.initialState ?? 'inherited';
  const serialized = options.serializedState ?? 'inherited';
  return {
    details: {
      group: 'block',
      content: 'details_summary block+',
      defining: true,
      // Из JSON может прийти что угодно: свёрнут только явный false.
      attrs: { open: { default: true } },
      parseDOM: [
        {
          tag: 'details',
          getAttrs: (dom) => ({
            open:
              initial === 'inherited'
                ? (dom as HTMLElement).hasAttribute('open')
                : initial === 'expanded',
          }),
        },
      ],
      toDOM: (node): DOMOutputSpec => {
        const open =
          serialized === 'inherited' ? node.attrs.open !== false : serialized === 'expanded';
        return ['details', open ? { open: '' } : {}, 0];
      },
    },
    details_summary: {
      content: 'inline*',
      defining: true,
      isolating: true,
      // Только как заголовок раскрывающегося блока; <summary> где-то ещё — просто текст.
      parseDOM: [{ tag: 'summary', context: 'details/' }],
      toDOM: (): DOMOutputSpec => ['summary', 0],
    },
  };
}

export default definePlugin({
  name: 'accordion',
  nodes: accordionNodes,
  load: () => import('./accordion-ui'),
});
