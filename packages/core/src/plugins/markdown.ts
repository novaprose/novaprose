import type { ResolvedPos, Slice } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { markdownToHTML } from '../markdown';
import { parserFor } from '../parser';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * The markdown plugin (named as in TinyMCE): Markdown pasted as plain text — from a text editor, a
 * terminal, a chat, VS Code — becomes formatting: headings, lists and checklists, quotes, code,
 * tables, links, bold, italic, strikethrough. A notification offers "Paste as text" to undo it.
 * Text that doesn't look like Markdown, Ctrl/Cmd+Shift+V, "paste as text" mode and pasting into a
 * code block stay plain text. The converter (markdown-it) loads with the plugin.
 * `pluginOptions.markdown.paste: false` turns the conversion off.
 */

export const LABELS = {
  en: {
    pasted: 'Markdown pasted as formatting',
    asText: 'Paste as text',
  },
};

export interface MarkdownPluginOptions {
  /** Convert pasted Markdown (true by default). */
  paste?: boolean;
}

/** Block-level Markdown: one is enough. */
const BLOCK_SIGNS = [
  /^#{1,6}[ \t]+\S/m, // a heading
  /^[ \t]{0,3}[-*+][ \t]+\S.*\n[ \t]*[-*+][ \t]+\S/m, // two bullet items
  /^[ \t]{0,3}\d{1,9}[.)][ \t]+\S.*\n[ \t]*\d{1,9}[.)][ \t]+\S/m, // two numbered items
  /^[ \t]{0,3}[-*+][ \t]+\[[ xX]\][ \t]/m, // a checklist item
  /^[ \t]{0,3}>[ \t]?\S/m, // a quote
  /^[ \t]{0,3}(`{3,}|~{3,})/m, // a code fence
  /^\|?.+\|.+\n\|?[ \t]*:?-{3,}:?[ \t]*\|/m, // a table header and its separator
];
/** Inline Markdown that plain text hardly ever has by chance. */
const INLINE_SIGNS = [
  /\*\*[^*\s][^*\n]*\*\*/, // **bold**
  /__[^_\s][^_\n]*__/, // __bold__
  /~~[^~\s][^~\n]*~~/, // ~~strikethrough~~
  /!?\[[^\]\n]+\]\((?:https?:\/\/|mailto:|\/|#)[^)\s]*\)/, // [a link](https://…), ![an image](…)
  /`[^`\n]+`/, // `code`
];

/** Whether pasted text looks like Markdown rather than ordinary text. */
export function looksLikeMarkdown(text: string): boolean {
  return (
    BLOCK_SIGNS.some((sign) => sign.test(text)) || INLINE_SIGNS.some((sign) => sign.test(text))
  );
}

/** Markdown → a slice of this editor's document, through the same parser as any paste. */
export function markdownSlice(view: EditorView, text: string, $context: ResolvedPos): Slice {
  // A <template> is inert: nothing in it runs or loads while it is parsed.
  const template = document.createElement('template');
  template.innerHTML = markdownToHTML(text);
  // Line breaks between blocks would become an empty paragraph when parsed inside one.
  for (const node of [...template.content.childNodes]) {
    if (node.nodeType === 3 && !node.textContent?.trim()) node.remove();
  }
  return parserFor(view.state.schema).parseSlice(template.content, {
    context: $context,
  });
}

/** After a conversion: say so and offer the plain text instead. */
function offerPlainText(editor: Editor, text: string): void {
  const labels = pickLabels(editor, 'markdown', LABELS);
  setTimeout(() => {
    if (editor.view.isDestroyed) return;
    editor.ui.notify({
      text: labels.pasted,
      actions: [
        {
          label: labels.asText,
          onAction: () => {
            editor.exec('undo');
            editor.view.pasteText(text);
          },
        },
      ],
    });
  }, 0);
}

/** ProseMirror types the parser as always returning a slice, yet falls back when it returns none. */
const NOT_MARKDOWN = null as unknown as Slice;

const enabled = (editor: Editor) =>
  ((editor.options.pluginOptions?.markdown ?? {}) as MarkdownPluginOptions).paste !== false &&
  !editor.isPasteAsText();

export default definePlugin({
  name: 'markdown',
  prosemirrorPlugins: (editor) => [
    new Plugin({
      props: {
        // Plain text pastes (no HTML on the clipboard). `plain`: Ctrl/Cmd+Shift+V.
        clipboardTextParser(text, $context, plain, view) {
          // Nothing returned: ProseMirror pastes the text as plain paragraphs, as without the plugin.
          if (plain || !enabled(editor) || $context.parent.type.spec.code) return NOT_MARKDOWN;
          if (!looksLikeMarkdown(text)) return NOT_MARKDOWN;
          offerPlainText(editor, text);
          return markdownSlice(view, text, $context);
        },
        // Markdown copied in VS Code comes with its colored HTML; the core leaves it to this plugin.
        handlePaste(view, event) {
          const data = event.clipboardData;
          const meta = data?.getData('vscode-editor-data');
          const text = data?.getData('text/plain')?.replace(/\r\n?/g, '\n');
          if (!meta || !text || !enabled(editor)) return false;
          if (view.state.selection.$from.parent.type.spec.code) return false;
          let mode: unknown;
          try {
            mode = (JSON.parse(meta) as { mode?: unknown }).mode;
          } catch {
            return false;
          }
          if (mode !== 'markdown') return false;
          if (!looksLikeMarkdown(text)) {
            view.pasteText(text);
            return true;
          }
          const slice = markdownSlice(view, text, view.state.selection.$from);
          view.dispatch(
            view.state.tr.replaceSelection(slice).scrollIntoView().setMeta('uiEvent', 'paste'),
          );
          offerPlainText(editor, text);
          return true;
        },
      },
    }),
  ],
});
