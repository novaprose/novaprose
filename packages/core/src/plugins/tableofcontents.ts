import type { DOMOutputSpec, NodeSpec } from 'prosemirror-model';
import type { Editor } from '../editor';
import { elementId } from '../element-id';
import { definePlugin } from '../plugins';
import css from './tableofcontents.css?raw';
import { pickLabels } from './shared';

/**
 * The tableofcontents plugin: the document's table of contents, a block with links to the headings (as in TinyMCE).
 * It updates by itself when headings change; headings get stable ids (`toc-…`) while
 * the document has a table of contents. `plugins: ['tableofcontents']`.
 *
 * Here are the node, its HTML and styles (visible from the first render); buttons, updating and following
 * links are in the lazy part, tableofcontents-ui.ts.
 */

export const LABELS = {
  en: {
    title: 'Contents',
    insert: 'Table of contents',
    update: 'Update table of contents',
    empty: 'Add headings — they will appear here',
  },
};

export interface TableOfContentsOptions {
  /** Which heading levels go into the table of contents: 1…depth (3 by default). */
  depth?: number;
  /** The block's class in HTML (`nova-toc` by default; TinyMCE uses `mce-toc`). */
  className?: string;
  /** Tag of the table of contents title: `p` (default) or `h1`–`h6`. */
  titleTag?: string;
  /** The title; "Contents" in the UI language by default. An empty string — no title. */
  title?: string;
  /** A numbered list instead of a bulleted one. */
  orderedList?: boolean;
}

export interface TocEntry {
  level: number;
  id: string;
  text: string;
}

const CLASS_RE = /^[A-Za-z_][\w-]{0,63}$/;

/** Settings with validation: the config can bring anything. */
export function tocSettings(editor: Editor) {
  const options = (editor.options.pluginOptions?.tableofcontents ?? {}) as TableOfContentsOptions;
  const depth = Number(options.depth);
  return {
    depth: Number.isInteger(depth) && depth >= 1 && depth <= 6 ? depth : 3,
    className:
      typeof options.className === 'string' && CLASS_RE.test(options.className)
        ? options.className
        : 'nova-toc',
    titleTag:
      typeof options.titleTag === 'string' && /^(p|h[1-6])$/i.test(options.titleTag)
        ? options.titleTag.toLowerCase()
        : 'p',
    title: typeof options.title === 'string' ? options.title.slice(0, 200) : null,
    list: options.orderedList ? 'ol' : 'ul',
  };
}

/** Table of contents items from the attribute (JSON can bring anything). */
export function tocEntries(value: unknown): TocEntry[] {
  if (!Array.isArray(value)) return [];
  const out: TocEntry[] = [];
  for (const item of value.slice(0, 1000)) {
    if (!item || typeof item !== 'object') continue;
    const { level, id, text } = item as Record<string, unknown>;
    const lvl = Number(level);
    const safeId = elementId(id);
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 6 || !safeId || typeof text !== 'string')
      continue;
    out.push({ level: lvl, id: safeId, text: text.slice(0, 300) });
  }
  return out;
}

/** Nested lists by heading level. */
function nestedList(entries: TocEntry[], tag: string): DOMOutputSpec | null {
  if (!entries.length) return null;
  const root: unknown[] = [tag];
  const stack: { level: number; list: unknown[]; last: unknown[] | null }[] = [
    { level: entries[0]!.level, list: root, last: null },
  ];
  for (const entry of entries) {
    let top = stack[stack.length - 1]!;
    if (entry.level > top.level && top.last) {
      const sub: unknown[] = [tag];
      top.last.push(sub);
      stack.push({ level: entry.level, list: sub, last: null });
    } else {
      while (stack.length > 1 && entry.level < stack[stack.length - 1]!.level) stack.pop();
    }
    top = stack[stack.length - 1]!;
    const item: unknown[] = ['li', ['a', { href: `#${entry.id}` }, entry.text]];
    top.list.push(item);
    top.last = item;
  }
  return root as unknown as DOMOutputSpec;
}

/** Items from ready-made HTML (#id links and the nesting depth of lists), until the first update. */
function readEntries(nav: HTMLElement): TocEntry[] {
  const out: TocEntry[] = [];
  for (const link of nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    let level = 0;
    for (let el: Element | null = link; el && el !== nav; el = el.parentElement) {
      if (el.tagName === 'UL' || el.tagName === 'OL') level++;
    }
    out.push({
      level: Math.min(Math.max(level, 1), 6),
      id: link.getAttribute('href')!.slice(1),
      text: (link.textContent ?? '').trim(),
    });
  }
  return tocEntries(out);
}

function tocNodes(editor: Editor): Record<string, NodeSpec> {
  const settings = tocSettings(editor);
  return {
    toc: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { entries: { default: [] }, title: { default: null } },
      parseDOM: [
        // Our own format, TinyMCE's (div.mce-toc) and a custom class from the settings.
        ...['nav[data-toc]', 'div.mce-toc', `.${settings.className}`].map((tag) => ({
          tag,
          getAttrs: (dom: HTMLElement) => {
            const head = dom.querySelector(
              ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > p',
            );
            return { entries: readEntries(dom), title: head?.textContent?.trim() || null };
          },
        })),
      ],
      toDOM: (node): DOMOutputSpec => {
        const title = typeof node.attrs.title === 'string' ? node.attrs.title.slice(0, 200) : '';
        const list = nestedList(tocEntries(node.attrs.entries), settings.list);
        return [
          'nav',
          { class: settings.className, 'data-toc': '' },
          ...(title ? [[settings.titleTag, title]] : []),
          ...(list ? [list] : []),
        ] as unknown as DOMOutputSpec;
      },
    },
  };
}

export default definePlugin({
  name: 'tableofcontents',
  nodes: tocNodes,
  // The table of contents is visible from the first render: its styles and hint are needed right away, not with the lazy part.
  setup(editor) {
    editor.ui.addStyles('nova-tableofcontents', css);
    const { empty } = pickLabels(editor, 'tableofcontents', LABELS);
    editor.root.style.setProperty('--nova-toc-empty', JSON.stringify(empty));
  },
  load: () => import('./tableofcontents-ui'),
});
