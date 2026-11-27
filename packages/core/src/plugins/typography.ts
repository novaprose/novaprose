import type { Node as PMNode } from 'prosemirror-model';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import type { MenuEntry } from '../ui/menu';
import {
  ruleEdits,
  TYPOGRAPHY_RULES,
  typographyLanguage,
  type TypographyRule,
} from './typography-rules';
import { pickLabels } from './shared';

/**
 * The typography plugin: on request (a button, a menu item, a command), the selection or the whole
 * document gets the typography of its language: “typographic quotes” as the language writes them
 * (« », „ “, ‘ ’ nested), dashes, an ellipsis, ©, ™, arrows, ≤ ≥ ≠ ±, ½ ¼ ¾, ×, no stray spaces,
 * non-breaking spaces where a line must not break. One change you undo with one Ctrl+Z; in
 * suggesting mode it is a suggestion. Code, addresses and text suggested for deletion are left
 * alone. Everything happens in the browser.
 */

export const LABELS = {
  en: {
    enhance: 'Enhance typography',
    language: 'Typography language',
    changed: 'Typography: {count} changes',
    none: 'The typography is already fine',
  },
};

export interface TypographyOptions {
  /**
   * The language whose typography applies ('en-US', 'de', 'fr'…). By default the autocorrect or
   * spell checker language, otherwise the `lang` attribute of the page. The person's choice from
   * the menu wins and is remembered.
   */
  language?: string;
  /** The languages in the button's menu (codes). */
  languages?: string[];
  /** Rules to turn off (all are on by default): `{ nbsp: false }`. */
  rules?: Partial<Record<TypographyRule, boolean>>;
  /** Formatting and blocks left alone, by name, besides code: `['link']`. */
  ignore?: string[];
  /** Remember the language chosen in the menu (in localStorage). true by default. */
  remember?: boolean;
}

const STORAGE = 'novaprose-typography';
const DEFAULT_LANGUAGES = [
  'en-US',
  'en-GB',
  'de',
  'fr',
  'es',
  'it',
  'pt-BR',
  'nl',
  'pl',
  'cs',
  'sv',
  'ru',
  'uk',
];
/** In a block's text: a line break is a space, any other object one character. */
const leafText = (node: PMNode) => (node.type.name === 'hard_break' ? '\n' : '￼');

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17c2.5-1 4-3 4-6V7H4v4h4"/><path d="M14 17c2.5-1 4-3 4-6V7h-4v4h4"/></svg>';

export default definePlugin({
  name: 'typography',
  toolbar: 'typography',
  setup(editor) {
    const options = (editor.options.pluginOptions?.typography ?? {}) as TypographyOptions;
    const labels = pickLabels(editor, 'typography', LABELS);
    const remember = options.remember !== false;
    let language = (remember ? saved() : null) ?? options.language ?? defaultLanguage(editor);
    const languages = options.languages?.length ? options.languages : DEFAULT_LANGUAGES;
    const rules = TYPOGRAPHY_RULES.filter((rule) => options.rules?.[rule] !== false);
    const ignore = new Set(options.ignore ?? []);
    const names = displayNames(editor.options.language ?? 'en');

    const run = () => {
      if (!editor.isEditable()) return;
      const count = enhanceTypography(editor, language, rules, ignore);
      editor.ui.notify(count ? labels.changed.replace('{count}', String(count)) : labels.none);
      editor.focus();
    };
    const choose = (code: string) => {
      language = code;
      if (remember) {
        try {
          globalThis.localStorage?.setItem(STORAGE, JSON.stringify({ language: code }));
        } catch {
          // Storage is off: the choice lasts until the page closes.
        }
      }
      run();
    };

    editor.ui.registry.addSplitButton('typography', {
      icon: ICON,
      tooltip: labels.enhance,
      isEnabled: () => editor.isEditable(),
      onAction: run,
      items: (): MenuEntry[] => [
        { id: 'enhance', label: labels.enhance, onSelect: run },
        { type: 'separator' },
        { type: 'heading', label: labels.language },
        ...(languages.includes(language) ? languages : [language, ...languages]).map(
          (code): MenuEntry => ({
            id: `language-${code}`,
            label: names(code),
            active: code === language,
            onSelect: () => choose(code),
          }),
        ),
      ],
    });
    editor.ui.registry.addMenuItem('typography', {
      text: labels.enhance,
      icon: ICON,
      isEnabled: () => editor.isEditable(),
      onAction: run,
    });
  },
});

/**
 * Gives the selection (or the whole document, when nothing is selected) the typography of a
 * language, as one change. Returns how many changes were made.
 */
export function enhanceTypography(
  editor: Editor,
  language: string,
  rules: readonly TypographyRule[] = TYPOGRAPHY_RULES,
  ignore: ReadonlySet<string> = new Set(),
): number {
  const { state } = editor.view;
  const lang = typographyLanguage(language);
  const { from, to, empty } = state.selection;
  const range = empty ? { from: 0, to: state.doc.content.size } : { from, to };
  const blocks: number[] = [];
  state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!node.isTextblock) return !ignore.has(node.type.name);
    if (!node.type.spec.code && !ignore.has(node.type.name)) blocks.push(pos);
    return false;
  });
  const tr = state.tr;
  let count = 0;
  // From the end: changes inside a block never move the blocks before it.
  for (const pos of blocks.reverse()) {
    for (const rule of rules) {
      const block = tr.doc.nodeAt(pos)!;
      const text = block.textBetween(0, block.content.size, undefined, leafText);
      // Inline nodes with content of their own: positions don't follow characters, leave the block.
      if (text.length !== block.content.size) break;
      const start = pos + 1;
      const blocked = leftAlone(block, ignore);
      if (!empty) {
        const selFrom = tr.mapping.map(range.from) - start;
        const selTo = tr.mapping.map(range.to, -1) - start;
        if (selFrom > 0) blocked.push([0, selFrom]);
        if (selTo < text.length) blocked.push([Math.max(0, selTo), text.length]);
      }
      const edits = ruleEdits(rule, text, lang, blocked);
      for (const edit of edits.reverse()) {
        tr.insertText(edit.insert, start + edit.index, start + edit.index + edit.length);
      }
      count += edits.length;
    }
  }
  if (count) editor.view.dispatch(tr);
  return count;
}

/** The parts of a block's text left as they are: objects, code, ignored formatting, deleted text. */
function leftAlone(block: PMNode, ignore: ReadonlySet<string>): [number, number][] {
  const ranges: [number, number][] = [];
  block.forEach((child, offset) => {
    const skip =
      !child.isText ||
      child.marks.some(
        (mark) =>
          mark.type.spec.code ||
          ignore.has(mark.type.name) ||
          mark.type.name === 'suggestion_delete',
      );
    if (skip) ranges.push([offset, offset + child.nodeSize]);
  });
  return ranges;
}

function saved(): string | null {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE) ?? 'null');
    const language = (value as { language?: unknown } | null)?.language;
    return typeof language === 'string' && /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/.test(language)
      ? language
      : null;
  } catch {
    return null;
  }
}

/** The content's language: the autocorrect or spell checker one, else the page's, else English. */
function defaultLanguage(editor: Editor): string {
  const plugin = (name: string) =>
    (editor.options.pluginOptions?.[name] as { language?: unknown } | undefined)?.language;
  for (const value of [plugin('autocorrect'), plugin('spellchecker')]) {
    if (typeof value === 'string' && value && value !== 'auto') return value;
  }
  const dom = editor.view.dom as HTMLElement;
  return (
    dom.closest('[lang]')?.getAttribute('lang') || dom.ownerDocument.documentElement.lang || 'en-US'
  );
}

/** Names of languages in the interface's language ("Deutsch" or "German"), or the code. */
function displayNames(ui: string): (code: string) => string {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([ui, 'en'], { type: 'language' });
  } catch {
    names = null;
  }
  return (code) => {
    try {
      return names?.of(code.replace(/_/g, '-')) ?? code;
    } catch {
      return code;
    }
  };
}
