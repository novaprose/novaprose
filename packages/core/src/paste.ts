import { Fragment, Slice } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { codeLanguage } from './code-language';
import type { Editor } from './editor';
import type * as PasteOffice from './paste-office';
import type { PasteStyles } from './paste-office';
import { extractRtfImages, hasLocalFileImages, replaceLocalImages } from './paste-rtf';

/**
 * Очистка вставки из Office/Google (~11 КБ) — отдельный чанк: нужна только в момент вставки.
 * Грузится сразу после создания редактора в фоне (и входит в `editor.ready`), так что к первому
 * Ctrl+V обычно уже готова. Если вставка случилась раньше — её ждёт handleDOMEvents.paste ниже.
 */
type PasteCleaner = typeof PasteOffice;
let cleaner: PasteCleaner | null = null;
let loading: Promise<PasteCleaner | null> | null = null;

export function loadPasteCleaner(): Promise<PasteCleaner | null> {
  loading ??= import('./paste-office').then(
    (module) => (cleaner = module),
    () => {
      // Сеть подвела — попробуем при следующей вставке, а пока вставка без очистки Office.
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

export function pastePlugin(editor: Editor): Plugin {
  // Флаг защиты от рекурсии: pasteText сам вызывает обработку вставки.
  let reentrant = false;
  return new Plugin({
    key,
    props: {
      /**
       * Вставка в пустой абзац заменяет его целиком: иначе первый вставленный абзац «сливается» с
       * пустым и теряет своё оформление (выравнивание, интервал, тип блока). В непустой абзац —
       * как обычно: первый абзац продолжает текущий, как в Word.
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
        // Очистка разметки Word, Google Docs, Excel и т.п. (своё копирование внутри редактора не трогаем).
        // Схема и санитайзер работают и без неё: безопасность от этого чанка не зависит.
        if (cleaner) result = cleaner.cleanPastedHTML(result, pasteStyles ?? 'clean');
        if (pastePostprocess) {
          // Разбор в <template> инертен: скрипты не выполняются, картинки не грузятся.
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
         * Вставка HTML раньше, чем догрузилась очистка (первые миллисекунды после создания или
         * медленная сеть): забираем данные буфера сейчас (после события они недоступны), ждём чанк
         * и вставляем как обычно — через transformPastedHTML уже с очисткой.
         */
        paste(view, event) {
          if (cleaner || reentrant || editor.isPasteAsText()) return false;
          const data = event.clipboardData;
          // Из редактора кода — свой путь (handlePaste), очистка Office там не нужна.
          if (data?.getData(VSCODE_DATA)) return false;
          const html = data?.getData('text/html');
          if (!html) return false;
          const rtf = hasLocalFileImages(html) ? (data?.getData('text/rtf') ?? '') : '';
          event.preventDefault();
          void loadPasteCleaner().then(() => {
            if (view.isDestroyed) return;
            const withImages =
              rtf && editor.isAllowed('image')
                ? replaceLocalImages(html, extractRtfImages(rtf))
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
        // Пустая строка (а не только null) — тоже «нет данных»: в Firefox clipboardData
        // синтетического события пустой, но существует.
        const html = event.clipboardData?.getData('text/html');

        if (!editor.isPasteAsText()) {
          // Картинки Word для компьютера: в HTML — недоступные file:-пути, данные — в RTF.
          const rtf =
            html && hasLocalFileImages(html) ? event.clipboardData?.getData('text/rtf') : '';
          if (!html || !rtf || !editor.isAllowed('image')) return false;
          const withImages = replaceLocalImages(html, extractRtfImages(rtf));
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

/** Метаданные, которые VS Code (и редакторы на его основе) кладёт в буфер обмена вместе с кодом. */
const VSCODE_DATA = 'vscode-editor-data';

/** Языки VS Code, чьи имена не совпадают с привычными в `language-…`. */
const VSCODE_LANGUAGES: Record<string, string> = {
  shellscript: 'bash',
  typescriptreact: 'tsx',
  javascriptreact: 'jsx',
  jsonc: 'json',
};

/**
 * Вставка из VS Code: в HTML буфера — вёрстка с цветами и шрифтом темы редактора, в документе они
 * не нужны. Несколько строк кода — блок кода с языком файла; одна строка, Markdown и простой
 * текст — обычный текст (без цветов темы).
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
  // В блоке кода ProseMirror и так вставит простой текст.
  if (view.state.selection.$from.parent.type.spec.code) return false;
  let mode: unknown;
  try {
    mode = (JSON.parse(meta) as { mode?: unknown }).mode;
  } catch {
    // Не JSON — язык неизвестен, вставим как код без языка.
  }
  // Скопированная строка целиком (Ctrl+C без выделения) заканчивается переводом строки — он лишний.
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
