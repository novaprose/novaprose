import type { Node as PMNode } from 'prosemirror-model';
import { parserFor } from './parser';
import type { PageHandler } from './plugins';
import type { NovaSchema } from './schema';

/**
 * HTML into a document, the way the editor reads it (setContent, the content option): the schema's
 * parse rules, nothing else. `dom` is the DOM that parses the HTML: the page's in a browser; on a
 * server, one you bring (jsdom), so the same rules work where there is no browser.
 *
 * The HTML is parsed in a <template>: its scripts don't run, its images don't load, its handlers
 * never fire. `whole` tells whether it was a whole page (fullpagehtml): the document's attributes
 * then come from that page.
 */
export function parseHTMLDocument(
  schema: NovaSchema,
  html: string,
  page: PageHandler | null | undefined,
  dom: Document,
): { doc: PMNode; whole: boolean } {
  // A whole page: its head goes into the document's attributes, its body is the content.
  const parts = page ? page.read(html, dom) : null;
  const container = dom.createElement('div');
  const template = dom.createElement('template');
  template.innerHTML = parts ? parts.content : html;
  container.appendChild(template.content);
  const doc = parserFor(schema).parse(container);
  if (!parts) return { doc, whole: false };
  return { doc: doc.type.create(parts.attrs, doc.content), whole: true };
}
