import type { Editor } from './editor';
import type { PageHandler } from './plugins';

/** Each editor's page handler (fullpagehtml): getHTML, setContent and the source code view use it. */
export const pages = new WeakMap<Editor, PageHandler>();

/**
 * The HTML the source code view shows: the whole page, or only the content when the page handler
 * says so (fullpagehtml's hideInSourceView).
 */
export function sourceHTML(editor: Editor): string {
  return editor.getHTML({ fullPage: pages.get(editor)?.inSource !== false });
}

/** Takes the source code view's HTML back, the same way it was shown. */
export function setSourceHTML(editor: Editor, html: string): void {
  editor.setContent(html, { fullPage: pages.get(editor)?.inSource !== false });
}
