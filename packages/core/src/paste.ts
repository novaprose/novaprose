import { Fragment, Slice } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { codeLanguage } from './code-language';
import type { Editor } from './editor';
import { languageTag, primaryLanguage } from './language';
import type * as PasteOffice from './paste-office';
import type { PasteStyles } from './paste-office';

/**
 * Office/Google paste cleanup (~11 KB) is a separate chunk: it is needed only at the moment of pasting.
 * It loads in the background right after the editor is created (and is part of `editor.ready`), so by the first
 * Ctrl+V it is usually ready. If a paste happens earlier, handleDOMEvents.paste below waits for it.
 */
type PasteCleaner = typeof PasteOffice;

/** Whether the HTML has images with local file: links (a sign of Word images, the data is in the RTF). */
function hasLocalFileImages(html: string): boolean {
  return /<img[^>]+src=["']?file:/i.test(html);
}
let cleaner: PasteCleaner | null = null;
let loading: Promise<PasteCleaner | null> | null = null;

export function loadPasteCleaner(): Promise<PasteCleaner | null> {
  loading ??= import('./paste-office').then(
    (module) => (cleaner = module),
    () => {
      // The network failed: try again on the next paste, and paste without Office cleanup for now.
      loading = null;
      return null;
    },
  );
  return loading;
}

/**
 * Paste handling:
 * - "Paste as text" mode (the pastetext toggle): any content is pasted without formatting;
 * - Ctrl/Cmd+Shift+V pastes once without formatting (ProseMirror itself hands over text/plain when
 *   Shift is held; we only make sure the HTML branch doesn't take it);
 * - the pastePreprocess (HTML string before parsing) and pastePostprocess (DOM after the browser parsed it) hooks.
 */

export interface PasteOptions {
  /** Change the HTML before it is parsed: return a new string. */
  pastePreprocess?: (html: string, editor: Editor) => string;
  /** Change the DOM after it is parsed: nodes can be removed or changed in place. */
  pastePostprocess?: (fragment: HTMLElement, editor: Editor) => void;
  /** Start in "paste as text" mode. */
  pasteAsText?: boolean;
  /**
   * Formatting when pasting from Word, Google Docs, Excel and web pages. 'clean' (default) keeps
   * bold, italic, colors, lists, tables and links, but not the source document's font, size and
   * spacing; 'keep' brings those too.
   */
  pasteStyles?: PasteStyles;
}

const key = new PluginKey('nova-paste');

/** Turns HTML into plain text, keeping paragraphs (for "paste as text" mode). */
export function htmlToPlainText(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const blocks = /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|TR|SECTION|ARTICLE|HEADER|FOOTER)$/;
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? '').replace(/\s+/g, ' ');
      return;
    }
    if (!(node instanceof Element)) {
      node.childNodes.forEach(walk);
      return;
    }
    if (/^(SCRIPT|STYLE|META|TITLE|HEAD)$/.test(node.tagName)) return;
    if (node.tagName === 'BR') {
      out += '\n';
      return;
    }
    const block = blocks.test(node.tagName);
    if (block && out && !out.endsWith('\n')) out += '\n';
    node.childNodes.forEach(walk);
    if (block) out += '\n';
  };
  template.content.childNodes.forEach(walk);
  return out
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The language of the editor's text: the contentLanguage option, else the page's around the editor. */
function textLanguage(editor: Editor): string | null {
  return (
    languageTag(editor.options.contentLanguage) ??
    languageTag(editor.root.parentElement?.closest('[lang]')?.getAttribute('lang'))
  );
}

/** Drops lang attributes in the text's own language from pasted HTML (other languages stay). */
export function withoutTextLanguage(html: string, lang: string | null): string {
  if (!lang || !/\slang\s*=/i.test(html)) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  let changed = false;
  for (const el of template.content.querySelectorAll('[lang]')) {
    const tag = languageTag(el.getAttribute('lang'));
    if (tag && primaryLanguage(tag) === primaryLanguage(lang)) {
      el.removeAttribute('lang');
      changed = true;
    }
  }
  if (!changed) return html;
  const container = document.createElement('div');
  container.append(template.content);
  return container.innerHTML;
}

export function pastePlugin(editor: Editor): Plugin {
  // A recursion guard flag: pasteText itself triggers paste handling.
  let reentrant = false;
  return new Plugin({
    key,
    props: {
      /**
       * Pasting into an empty paragraph replaces it entirely: otherwise the first pasted paragraph "merges" with
       * the empty one and loses its formatting (alignment, spacing, block type). Into a non-empty paragraph
       * it works as usual: the first paragraph continues the current one, as in Word.
       */
      transformPasted(slice, view) {
        const { selection } = view.state;
        const parent = selection.$from.parent;
        if (
          slice.openStart > 0 &&
          selection.empty &&
          parent.isTextblock &&
          parent.content.size === 0 &&
          slice.content.firstChild?.isBlock
        ) {
          return new Slice(slice.content, 0, slice.openEnd);
        }
        return slice;
      },
      transformPastedHTML(html) {
        const { pastePreprocess, pastePostprocess, pasteStyles } = editor.options;
        let result = pastePreprocess ? pastePreprocess(html, editor) : html;
        // Cleans up Word, Google Docs, Excel and similar markup (copying inside the editor is left alone).
        // The schema and the sanitizer work without it too: security doesn't depend on this chunk.
        if (cleaner) result = cleaner.cleanPastedHTML(result, pasteStyles ?? 'clean');
        // Marked with the text's own language, a passage says nothing: other languages stay passages.
        result = withoutTextLanguage(result, textLanguage(editor));
        if (pastePostprocess) {
          // Parsing in a <template> is inert: scripts don't run, images don't load.
          const template = document.createElement('template');
          template.innerHTML = result;
          const container = document.createElement('div');
          container.append(template.content);
          pastePostprocess(container, editor);
          result = container.innerHTML;
        }
        return result;
      },
      handleDOMEvents: {
        /**
         * HTML pasted before the cleanup has loaded (the first milliseconds after creation or
         * a slow network): take the clipboard data now (after the event it is gone), wait for the chunk
         * and paste as usual, through transformPastedHTML, this time with the cleanup.
         */
        paste(view, event) {
          if (cleaner || reentrant || editor.isPasteAsText()) return false;
          const data = event.clipboardData;
          // From the code editor: its own path (handlePaste), no Office cleanup needed there.
          if (data?.getData(VSCODE_DATA)) return false;
          const html = data?.getData('text/html');
          if (!html) return false;
          const rtf = hasLocalFileImages(html) ? (data?.getData('text/rtf') ?? '') : '';
          event.preventDefault();
          void loadPasteCleaner().then(() => {
            if (view.isDestroyed) return;
            // RTF images are read by the cleanup chunk (it has just loaded, or failed to).
            const withImages =
              rtf && cleaner && editor.isAllowed('image')
                ? cleaner.replaceLocalImages(html, cleaner.extractRtfImages(rtf))
                : html;
            reentrant = true;
            try {
              view.pasteHTML(withImages);
            } finally {
              reentrant = false;
            }
          });
          return true;
        },
      },
      handlePaste(view, event, slice) {
        if (reentrant) return false;
        const pasteText = (text: string) => {
          reentrant = true;
          try {
            view.pasteText(text);
          } finally {
            reentrant = false;
          }
        };
        if (pasteFromCodeEditor(view, event, editor, pasteText)) return true;
        // An empty string (not only null) also means "no data": in Firefox the clipboardData
        // of a synthetic event is empty but exists.
        const html = event.clipboardData?.getData('text/html');

        if (!editor.isPasteAsText()) {
          // Images from desktop Word: the HTML has unreachable file: paths, the data is in the RTF.
          const rtf =
            html && hasLocalFileImages(html) ? event.clipboardData?.getData('text/rtf') : '';
          // The cleanup chunk is loaded here (before it is, the paste handler above takes the paste).
          if (!html || !rtf || !cleaner || !editor.isAllowed('image')) return false;
          const withImages = cleaner.replaceLocalImages(html, cleaner.extractRtfImages(rtf));
          if (withImages === html) return false;
          reentrant = true;
          try {
            view.pasteHTML(withImages, event);
          } finally {
            reentrant = false;
          }
          return true;
        }

        const text = html
          ? htmlToPlainText(html)
          : event.clipboardData?.getData('text/plain') ||
            slice.content.textBetween(0, slice.content.size, '\n\n');
        if (!text) return false;
        pasteText(text);
        return true;
      },
    },
  });
}

/** Metadata that VS Code (and editors based on it) puts on the clipboard along with code. */
const VSCODE_DATA = 'vscode-editor-data';

/** VS Code languages whose names differ from the usual ones in `language-…`. */
const VSCODE_LANGUAGES: Record<string, string> = {
  shellscript: 'bash',
  typescriptreact: 'tsx',
  javascriptreact: 'jsx',
  jsonc: 'json',
};

/**
 * Paste from VS Code: the clipboard HTML has markup with the colors and font of the editor theme, which the
 * document doesn't need. Several lines of code become a code block with the file's language; one line, Markdown and plain
 * text become regular text (without the theme colors).
 */
function pasteFromCodeEditor(
  view: EditorView,
  event: ClipboardEvent,
  editor: Editor,
  pasteText: (text: string) => void,
): boolean {
  const data = event.clipboardData;
  const meta = data?.getData(VSCODE_DATA);
  const raw = data?.getData('text/plain');
  if (!meta || !raw) return false;
  // Inside a code block ProseMirror pastes plain text anyway.
  if (view.state.selection.$from.parent.type.spec.code) return false;
  let mode: unknown;
  try {
    mode = (JSON.parse(meta) as { mode?: unknown }).mode;
  } catch {
    // Not JSON: the language is unknown, paste as code without a language.
  }
  // Markdown becomes formatting when the markdown plugin is on: its own handlePaste takes it.
  if (mode === 'markdown' && editor.hasPlugin('markdown') && !editor.isPasteAsText()) return false;
  // A whole copied line (Ctrl+C without a selection) ends with a line break, which is extra.
  const text = raw.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const codeBlock = view.state.schema.nodes.code_block;
  if (
    !text.includes('\n') ||
    mode === 'markdown' ||
    mode === 'plaintext' ||
    editor.isPasteAsText() ||
    !codeBlock ||
    !editor.isAllowed('codeblock')
  ) {
    pasteText(text);
    return true;
  }
  const language =
    typeof mode === 'string'
      ? Object.hasOwn(VSCODE_LANGUAGES, mode)
        ? VSCODE_LANGUAGES[mode]
        : codeLanguage(mode)
      : null;
  const block = codeBlock.create({ language }, view.state.schema.text(text));
  view.dispatch(
    view.state.tr
      .replaceSelection(new Slice(Fragment.from(block), 0, 0))
      .setMeta('uiEvent', 'paste')
      .scrollIntoView(),
  );
  return true;
}
