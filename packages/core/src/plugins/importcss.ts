import { loadCss } from '../content-css';
import type { Editor } from '../editor';
import type { BlockTag, InlineTag, StyleFormat } from '../formats';
import { definePlugin } from '../plugins';

/**
 * The importcss plugin (named as in TinyMCE): the classes of your content CSS (`contentCss` files and
 * `contentStyle`) become items of the Styles menu. `p.lead` turns a block into a paragraph with the
 * lead class, `h2.fancy` into such a heading, `span.badge` and a bare `.badge` mark text, `img.round`
 * applies to an image. Selectors with anything else (descendants, pseudo-classes, ids) and elements the
 * editor doesn't format (tables, lists, div) are left out.
 */

type Filter<T> = string | RegExp | ((value: T) => boolean);

export interface ImportCssGroup {
  title: string;
  /** Which selectors go into the group; a group without a filter takes the rest. */
  filter?: Filter<string>;
}

export interface ImportCssOptions {
  /** Keep the menu's own items and add the imported ones after them (true by default). */
  append?: boolean;
  /** Which CSS files to read (by URL). */
  fileFilter?: Filter<string>;
  /** Which selectors to import. */
  selectorFilter?: Filter<string>;
  /** Submenus of the Styles menu, in order. */
  groups?: ImportCssGroup[];
  /** A selector goes into the first matching group only (true by default). */
  exclusive?: boolean;
  /** Your own conversion: a Styles item, or false to skip the selector. */
  converter?: (selector: string, group?: ImportCssGroup) => StyleFormat | false | null | undefined;
}

const BLOCKS = new Set<string>(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre']);
const INLINES = new Set<string>([
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'code',
  'sub',
  'sup',
]);
/** An element (optional) and one or more classes, nothing else. */
const SIMPLE = /^([a-z][a-z0-9]*)?((?:\.-?[_a-zA-Z][\w-]*)+)$/;

const matches = <T>(filter: Filter<T> | undefined, value: T): boolean => {
  if (filter === undefined) return true;
  if (typeof filter === 'function') return filter(value);
  if (filter instanceof RegExp) return filter.test(String(value));
  return String(value).includes(filter);
};

/** A Styles item for a simple selector, or null when the editor can't apply it. */
export function formatFromSelector(selector: string): StyleFormat | null {
  const match = SIMPLE.exec(selector.trim());
  if (!match) return null;
  const tag = match[1]?.toLowerCase();
  const classes = match[2]!.split('.').filter(Boolean);
  const title = classes.join(' ');
  if (!tag) return { title, inline: 'span', classes };
  if (BLOCKS.has(tag)) return { title, block: tag as BlockTag, classes };
  if (INLINES.has(tag)) return { title, inline: tag as InlineTag, classes };
  if (tag === 'img') return { title, selector: 'img', classes };
  return null;
}

/** Every selector of a style sheet, in order (rules inside @media and @supports too). */
export function selectorsFromCss(css: string): string[] {
  if (typeof CSSStyleSheet !== 'function') return [];
  const sheet = new CSSStyleSheet();
  try {
    // @import isn't allowed in a constructed sheet: loadCss has already inlined the imported files.
    sheet.replaceSync(css.replace(/@import\s[^;]*;/gi, ''));
  } catch {
    return [];
  }
  const selectors: string[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if ('selectorText' in rule) {
        selectors.push(...(rule as CSSStyleRule).selectorText.split(',').map((s) => s.trim()));
      } else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
    }
  };
  walk(sheet.cssRules);
  return selectors;
}

/** Styles items from CSS text: filtered, converted, grouped, each selector once. */
export function formatsFromCss(css: string, options: ImportCssOptions = {}): StyleFormat[] {
  const seen = new Set<string>();
  const titles = new Map<string, number>();
  const groups = options.groups?.map((group) => ({ group, items: [] as StyleFormat[] }));
  const flat: StyleFormat[] = [];
  for (const selector of selectorsFromCss(css)) {
    if (seen.has(selector) || !matches(options.selectorFilter, selector)) continue;
    seen.add(selector);
    // Groups: the first one whose filter matches (every one with exclusive: false), else the
    // group without a filter; no group at all — the selector is left out.
    let targets: { group: ImportCssGroup; items: StyleFormat[] }[] | null = null;
    if (groups) {
      const fitting = groups.filter(
        ({ group }) => group.filter !== undefined && matches(group.filter, selector),
      );
      const rest = groups.filter(({ group }) => group.filter === undefined).slice(0, 1);
      targets = fitting.length
        ? options.exclusive === false
          ? fitting
          : fitting.slice(0, 1)
        : rest;
      if (!targets.length) continue;
    }
    for (const target of targets ?? [null]) {
      const custom = options.converter?.(selector, target?.group);
      if (custom === false) continue;
      const format = custom ?? formatFromSelector(selector);
      if (!format) continue;
      // The same classes on different elements: the element tells them apart.
      const count = titles.get(format.title) ?? 0;
      titles.set(format.title, count + 1);
      const tag = /^[a-z][a-z0-9]*/.exec(selector)?.[0];
      const item = count && tag ? { ...format, title: `${format.title} (${tag})` } : format;
      (target ? target.items : flat).push(item);
    }
  }
  if (!groups) return flat;
  return groups
    .filter(({ items }) => items.length)
    .map(({ group, items }) => ({ title: group.title, items }));
}

export default definePlugin({
  name: 'importcss',
  toolbar: 'styles',
  setup(editor: Editor) {
    const options = (editor.options.pluginOptions?.importcss ?? {}) as ImportCssOptions;
    const { contentCss, contentStyle } = editor.options;
    const files = (
      contentCss === undefined ? [] : Array.isArray(contentCss) ? contentCss : [contentCss]
    ).filter((url) => matches(options.fileFilter, url));
    let cancelled = false;
    void Promise.all(
      files.map((url) =>
        loadCss(url).catch((error: unknown) => {
          console.warn(`[nova] importcss: could not load ${url}`, error);
          return '';
        }),
      ),
    ).then((sheets) => {
      if (cancelled) return;
      const formats = formatsFromCss([...sheets, contentStyle ?? ''].join('\n'), options);
      if (!formats.length) return;
      editor.ui.registry.addStyleFormats(formats, { replace: options.append === false });
      editor.updateUI();
    });
    return () => {
      cancelled = true;
    };
  },
});
