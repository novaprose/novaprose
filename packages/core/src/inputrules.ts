import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
  ellipsis,
  emDash,
  type InputRule,
} from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import type { Command, Plugin } from 'prosemirror-state';
import { schema as baseSchema, type NovaSchema } from './schema';

/** Язык после забора блока кода — те же символы, что допускает класс `language-…`. */
const LANGUAGE = '([A-Za-z0-9_+#.-]{0,32})';

/**
 * Markdown-шорткаты при наборе (PRD §4.2, text patterns): #, -, 1., >, ```.
 * isAllowed — ограничения контента: запрещённый шорткат просто не срабатывает.
 */
export function buildInputRules(
  isAllowed: (name: string) => boolean = () => true,
  schema: NovaSchema = baseSchema,
): Plugin {
  const { nodes } = schema;
  const rules: InputRule[] = [ellipsis, emDash];
  if (isAllowed('blockquote')) rules.push(wrappingInputRule(/^\s*>\s$/, nodes.blockquote));
  if (isAllowed('numlist')) {
    rules.push(
      wrappingInputRule(
        /^(\d+)\.\s$/,
        nodes.ordered_list,
        (match) => ({ start: Number(match[1]) }),
        (match, node) => node.childCount + node.attrs.start === Number(match[1]),
      ),
    );
  }
  if (isAllowed('bullist')) rules.push(wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list));
  if (isAllowed('codeblock')) {
    // Забор, как в Markdown: «```» и пробел (или Enter — codeFenceKeymap), с языком — «```js ».
    rules.push(
      textblockTypeInputRule(new RegExp(`^\`\`\`${LANGUAGE}\\s$`), nodes.code_block, (match) => ({
        language: match[1] || null,
      })),
    );
  }
  // По правилу на каждый разрешённый уровень: «## » не должен давать запрещённый h2.
  for (let level = 1; level <= 6; level++) {
    if (!isAllowed(`h${level}`)) continue;
    rules.push(textblockTypeInputRule(new RegExp(`^(#{${level}})\\s$`), nodes.heading, { level }));
  }
  // Типографские кавычки зависят от языка («ёлочки» vs “лапки”) — это Advanced Typography, P2.
  return inputRules({ rules });
}

/**
 * Enter в конце абзаца «```» или «```js» — блок кода (с языком). Input rules срабатывают только
 * на ввод текста, а забор в Markdown обычно закрывают именно Enter.
 */
export function codeFenceKeymap(
  isAllowed: (name: string) => boolean = () => true,
  schema: NovaSchema = baseSchema,
): Plugin {
  const fence = new RegExp(`^\`\`\`${LANGUAGE}$`);
  const fenceToCodeBlock: Command = (state, dispatch) => {
    const { $from, empty } = state.selection;
    const block = $from.parent;
    if (!empty || block.type !== schema.nodes.paragraph || !isAllowed('codeblock')) return false;
    if ($from.parentOffset !== block.content.size || block.childCount !== 1) return false;
    const match = block.firstChild!.isText ? fence.exec(block.textContent) : null;
    if (!match) return false;
    const index = $from.index(-1);
    if (!$from.node(-1).canReplaceWith(index, index + 1, schema.nodes.code_block)) return false;
    if (dispatch) {
      const start = $from.start();
      const tr = state.tr
        .delete(start, $from.pos)
        .setBlockType(start, start, schema.nodes.code_block, { language: match[1] || null });
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
  return keymap({ Enter: fenceToCodeBlock });
}
