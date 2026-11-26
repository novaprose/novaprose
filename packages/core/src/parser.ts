import {
  DOMParser,
  type ParseOptions,
  type Node as PMNode,
  type Schema,
  type Slice,
} from 'prosemirror-model';
import { OWN_STYLE } from './html-rules-api';
import { schema } from './schema';

/** The attribute that takes a cell's background before parsing (see preprocessDOM). */
export const CELL_BG_ATTR = 'data-nova-cell-bg';

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

/**
 * The schema doesn't support MathML and SVG. Inside them there are elements with HTML tag names
 * (`<math><td>`), but without `style` and the rest of the HTML API, and the parse rules crashed on them.
 * A formula (MathML, including from Word) is replaced with its text so the text isn't lost; SVG is removed.
 * Found by a property-based test (packages/core/test/security.property.test.ts).
 */
function replaceForeignElements(root: ParentNode): void {
  const foreign = [...root.querySelectorAll('*')].filter(
    // Only the outermost ones: the parent is an HTML element or the fragment itself (parentElement = null).
    (el) => el.namespaceURI !== HTML_NS && (el.parentElement?.namespaceURI ?? HTML_NS) === HTML_NS,
  );
  for (const el of foreign) {
    const text = el.namespaceURI === MATHML_NS ? (el.textContent ?? '') : '';
    el.replaceWith(el.ownerDocument.createTextNode(text));
  }
}

/**
 * DOM preprocessing before the schema parses it, shared by setContent and paste.
 *
 * Cell background: ProseMirror's style rules apply to any element, so
 * `<td style="background-color">` would otherwise also become a "highlight" mark on all the cell text.
 * The value moves into a service attribute and is removed from style.
 */
export function preprocessDOM(root: ParentNode): void {
  replaceForeignElements(root);
  root.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
    // Inside <math>/<svg> a "td" is an element of a foreign namespace and may have no style.
    if (!cell.style) return;
    const bg = cell.style.backgroundColor;
    if (!bg) return;
    cell.setAttribute(CELL_BG_ATTR, bg);
    cell.style.removeProperty('background-color');
    if (!cell.getAttribute('style')) cell.removeAttribute('style');
  });
}

/**
 * The DOMParser of the NovaProse schema with preprocessing: used both for content and the clipboard.
 *
 * Nodes with `ignoreStyles: true` in their spec (a template variable, a non-editable "chip") must not
 * get marks from their own style: ProseMirror reads an element's styles before it learns
 * that it is a whole node. So such elements lose their style before parsing.
 */
class NovaDOMParser extends DOMParser {
  private atomSelector: string | undefined;
  private ownStyleSelector: string | undefined;

  private prepare(dom: globalThis.Node): void {
    preprocessDOM(dom as ParentNode);
    // Elements from extendedValidElements (div, abbr…) keep style themselves. Otherwise ProseMirror would turn
    // it into formatting marks on the content as well, and the style would double on every save.
    this.ownStyleSelector ??= Object.values(this.schema.nodes)
      .flatMap((type) => (type.spec as { ownStyleTags?: string[] }).ownStyleTags ?? [])
      .join(', ');
    if (this.ownStyleSelector && 'querySelectorAll' in dom) {
      (dom as ParentNode).querySelectorAll(this.ownStyleSelector).forEach((el) => {
        const style = el.getAttribute('style');
        if (style === null) return;
        el.setAttribute(OWN_STYLE, style);
        el.removeAttribute('style');
      });
    }
    this.atomSelector ??= Object.values(this.schema.nodes)
      .filter((type) => (type.spec as { ignoreStyles?: boolean }).ignoreStyles)
      .flatMap((type) => (type.spec.parseDOM ?? []).map((rule) => rule.tag))
      .filter((tag): tag is string => !!tag)
      .join(', ');
    if (!this.atomSelector || !('querySelectorAll' in dom)) return;
    (dom as ParentNode).querySelectorAll(this.atomSelector).forEach((el) => {
      el.removeAttribute('style');
    });
  }

  override parse(dom: globalThis.Node, options?: ParseOptions): PMNode {
    this.prepare(dom);
    return super.parse(dom, options);
  }

  override parseSlice(dom: globalThis.Node, options?: ParseOptions): Slice {
    this.prepare(dom);
    return super.parseSlice(dom, options);
  }
}

const parsers = new WeakMap<Schema, NovaDOMParser>();

/** A parser for a specific editor's schema (created once per schema). */
export function parserFor(target: Schema): DOMParser {
  let parser = parsers.get(target);
  if (!parser) {
    parser = new NovaDOMParser(target, DOMParser.fromSchema(target).rules);
    parsers.set(target, parser);
  }
  return parser;
}

/** The parser of the base schema. */
export const novaParser = parserFor(schema);
