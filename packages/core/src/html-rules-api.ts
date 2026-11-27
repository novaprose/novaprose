import type { MarkSpec, NodeSpec, Schema } from 'prosemirror-model';

/**
 * The hook for element and attribute rules. The implementation is a separate import,
 * `@novaprose/core/html-rules` (~3 KB gzip): few need it, so it isn't part of the first load.
 *
 *   import { registerHtmlRules } from '@novaprose/core';
 *   import { htmlRules } from '@novaprose/core/html-rules';
 *   registerHtmlRules(htmlRules);
 */

export interface HtmlRulesOptions {
  /** Only these elements are allowed; attributes in [...] are the complete list for the element. */
  validElements?: string;
  /** More elements and attributes: 'div[class],h2[id],i[class],a[href|rel|data-*]'. */
  extendedValidElements?: string;
  /** Disallowed elements. */
  invalidElements?: string;
  /** Your own elements: 'my-widget,~my-chip' (~ — inline, like span; without ~ — a block, like div). */
  customElements?: string;
}

/** The node and mark specs the document schema is built from; HTML rules change them before that. */
export interface SchemaSpecs {
  nodes: Record<string, NodeSpec>;
  marks: Record<string, MarkSpec>;
}

/** The rules of one editor: they change the schema specs. */
export interface HtmlRulesInstance {
  /** Whether the rules allow class on a built-in element (then classes are kept). */
  readonly classOnBuiltIn: boolean;
  /** Specs with the rules applied; after the schema is created, store it in `ref.schema`. */
  apply(specs: SchemaSpecs, ref: { schema?: Schema }): SchemaSpecs;
}

export interface HtmlRulesModule {
  create(options: HtmlRulesOptions): HtmlRulesInstance | null;
}

/** A service attribute: the parser moves the own style of new elements (div, abbr…) here. */
export const OWN_STYLE = 'data-nova-own-style';

let registered: HtmlRulesModule | null = null;

/** Install the element and attribute rules (once per page). */
export function registerHtmlRules(module: HtmlRulesModule): void {
  registered = module;
}

let warned = false;

/** Rules for the editor's options, or null (the options need no rules / the module isn't attached). */
export function htmlRulesFor(options: HtmlRulesOptions): HtmlRulesInstance | null {
  const needed =
    !!options.extendedValidElements ||
    !!options.customElements ||
    /\[/.test(options.validElements ?? '');
  if (!needed) return null;
  if (!registered) {
    if (!warned) {
      warned = true;
      console.warn(
        "[nova] attribute lists, extendedValidElements and customElements need: import { htmlRules } from '@novaprose/core/html-rules'; registerHtmlRules(htmlRules);",
      );
    }
    return null;
  }
  return registered.create(options);
}
