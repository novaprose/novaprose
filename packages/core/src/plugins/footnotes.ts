import type { DOMOutputSpec, Node as PMNode, NodeSpec } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { NodeView } from 'prosemirror-view';
import { definePlugin } from '../plugins';
import css from './footnotes.css?raw';

/**
 * The footnotes plugin (named as in TinyMCE): a numbered reference in the text, the notes in one
 * section at the end of the document. The HTML uses TinyMCE's classes, so footnotes written there load
 * as they are:
 *
 *   <sup class="mce-footnote"><a href="#footnote-ID" id="footnote-ref-ID" role="doc-noteref">1</a></sup>
 *   <div class="mce-footnotes" role="doc-endnotes"><hr><ol>
 *     <li id="footnote-ID"><a class="mce-footnotes-backlink" href="#footnote-ref-ID"
 *       role="doc-backlink">^</a><span class="mce-footnote-text">The note</span></li>
 *   </ol></div>
 *
 * This part is the schema and how the document is drawn (first load). Inserting, numbering and keeping
 * references and notes in step are in footnotes-ui.ts.
 */

/** A footnote id: letters, digits, `-` and `_`. Anything else from HTML or JSON becomes empty. */
export function footnoteId(value: unknown): string {
  const id = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return /^[\w-]{1,64}$/.test(id) ? id : '';
}

/** A footnote number: a whole number from 1. */
export function footnoteNumber(value: unknown): number {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 1;
}

/** The id at the end of `#footnote-ID` or `footnote-ref-ID`. */
const idAfter = (value: string | null | undefined, prefix: string) =>
  value?.startsWith(prefix) ? footnoteId(value.slice(prefix.length)) : '';

export const footnoteNodes: Record<string, NodeSpec> = {
  footnote_ref: {
    inline: true,
    group: 'inline',
    atom: true,
    selectable: true,
    draggable: true,
    attrs: { id: { default: '' }, number: { default: 1 } },
    parseDOM: [
      {
        tag: 'sup.mce-footnote',
        priority: 60,
        getAttrs: (dom) => {
          const link = (dom as HTMLElement).querySelector('a');
          const id =
            idAfter(link?.getAttribute('href'), '#footnote-') ||
            idAfter(link?.getAttribute('id'), 'footnote-ref-');
          return { id, number: footnoteNumber((link ?? dom).textContent) };
        },
      },
    ],
    toDOM: (node): DOMOutputSpec => {
      const id = footnoteId(node.attrs.id);
      return [
        'sup',
        { class: 'mce-footnote' },
        [
          'a',
          { href: `#footnote-${id}`, id: `footnote-ref-${id}`, role: 'doc-noteref' },
          String(footnoteNumber(node.attrs.number)),
        ],
      ];
    },
    leafText: (node) => `[${footnoteNumber(node.attrs.number)}]`,
  },
  footnotes: {
    group: 'block',
    content: 'footnote+',
    isolating: true,
    // Delete at the end of the text before it must not select (and then delete) every note at once.
    selectable: false,
    parseDOM: [
      {
        tag: 'div.mce-footnotes',
        priority: 60,
        contentElement: (dom) =>
          (dom as HTMLElement).querySelector('ol, ul') ?? (dom as HTMLElement),
      },
    ],
    toDOM: (): DOMOutputSpec => [
      'div',
      { class: 'mce-footnotes', role: 'doc-endnotes' },
      ['hr'],
      ['ol', 0],
    ],
  },
  footnote: {
    content: 'inline*',
    defining: true,
    attrs: { id: { default: '' } },
    parseDOM: [
      // The back link is drawn from the note's id, not read as text.
      { tag: 'a.mce-footnotes-backlink', priority: 60, ignore: true },
      {
        tag: 'li',
        context: 'footnotes/',
        priority: 60,
        getAttrs: (dom) => ({ id: idAfter((dom as HTMLElement).getAttribute('id'), 'footnote-') }),
      },
    ],
    toDOM: (node): DOMOutputSpec => {
      const id = footnoteId(node.attrs.id);
      return [
        'li',
        { id: `footnote-${id}` },
        [
          'a',
          { class: 'mce-footnotes-backlink', href: `#footnote-ref-${id}`, role: 'doc-backlink' },
          '^',
        ],
        ['span', { class: 'mce-footnote-text' }, 0],
      ];
    },
  },
};

/** In the editor the back link and the divider are not text you can type into. */
class FootnotesView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  constructor() {
    this.dom = document.createElement('div');
    this.dom.className = 'mce-footnotes';
    this.dom.setAttribute('role', 'doc-endnotes');
    const hr = document.createElement('hr');
    hr.contentEditable = 'false';
    this.contentDOM = document.createElement('ol');
    this.dom.append(hr, this.contentDOM);
  }
}

class FootnoteView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  constructor(node: PMNode) {
    const id = footnoteId(node.attrs.id);
    this.dom = document.createElement('li');
    this.dom.id = `footnote-${id}`;
    const back = document.createElement('a');
    back.className = 'mce-footnotes-backlink';
    back.href = `#footnote-ref-${id}`;
    back.setAttribute('role', 'doc-backlink');
    back.contentEditable = 'false';
    back.textContent = '^';
    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'mce-footnote-text';
    this.dom.append(back, this.contentDOM);
  }
}

export default definePlugin({
  name: 'footnotes',
  nodes: footnoteNodes,
  prosemirrorPlugins: () => [
    new Plugin({
      key: new PluginKey('nova-footnotes-view'),
      props: {
        nodeViews: {
          footnotes: () => new FootnotesView(),
          footnote: (node) => new FootnoteView(node),
        },
      },
    }),
  ],
  setup(editor) {
    editor.ui.addStyles('nova-footnotes', css);
  },
  load: () => import('./footnotes-ui'),
});
