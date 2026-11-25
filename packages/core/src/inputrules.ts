import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
  ellipsis,
  emDash,
  type InputRule,
} from 'prosemirror-inputrules';
import type { Plugin } from 'prosemirror-state';
import { schema as baseSchema, type NovaSchema } from './schema';

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
  if (isAllowed('codeblock')) rules.push(textblockTypeInputRule(/^```$/, nodes.code_block));
  // По правилу на каждый разрешённый уровень: «## » не должен давать запрещённый h2.
  for (let level = 1; level <= 6; level++) {
    if (!isAllowed(`h${level}`)) continue;
    rules.push(textblockTypeInputRule(new RegExp(`^(#{${level}})\\s$`), nodes.heading, { level }));
  }
  // Типографские кавычки зависят от языка («ёлочки» vs “лапки”) — это Advanced Typography, P2.
  return inputRules({ rules });
}
