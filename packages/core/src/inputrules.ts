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

/** The language after a code block fence: the same characters the `language-…` class allows. */
const LANGUAGE = '([A-Za-z0-9_+#.-]{0,32})';

/**
 * Markdown shortcuts while typing (text patterns): #, -, 1., >, ```.
 * isAllowed applies the content restrictions: a forbidden shortcut simply doesn't fire.
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
    // A fence as in Markdown: "```" and a space (or Enter, codeFenceKeymap), with a language "```js ".
    rules.push(
      textblockTypeInputRule(new RegExp(`^\`\`\`${LANGUAGE}\\s$`), nodes.code_block, (match) => ({
        language: match[1] || null,
      })),
    );
  }
  // One rule per allowed level: "## " must not produce a forbidden h2.
  for (let level = 1; level <= 6; level++) {
    if (!isAllowed(`h${level}`)) continue;
    rules.push(textblockTypeInputRule(new RegExp(`^(#{${level}})\\s$`), nodes.heading, { level }));
  }
  // Typographic quotes depend on the language (« guillemets » vs “curly quotes”), so they are left out for now.
  return inputRules({ rules });
}

/**
 * Enter at the end of a "```" or "```js" paragraph makes a code block (with the language). Input rules fire only
 * on typed text, and a Markdown fence is usually closed with Enter.
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
