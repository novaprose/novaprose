import { Slice } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { Editor } from './editor';
import { cleanPastedHTML, type PasteStyles } from './paste-office';
import { extractRtfImages, hasLocalFileImages, replaceLocalImages } from './paste-rtf';

/**
 * Обработка вставки:
 * - режим «Вставить как текст» (переключатель pastetext) — любое содержимое вставляется без форматирования;
 * - Ctrl/Cmd+Shift+V — разовая вставка без форматирования (ProseMirror сам отдаёт text/plain
 *   при зажатом Shift; мы лишь гарантируем, что HTML-ветка не перехватит её);
 * - хуки pastePreprocess (строка HTML до разбора) и pastePostprocess (DOM после разбора браузером).
 */

export interface PasteOptions {
  /** Изменить HTML до разбора: вернуть новую строку. */
  pastePreprocess?: (html: string, editor: Editor) => string;
  /** Изменить DOM после разбора: можно удалять/менять узлы на месте. */
  pastePostprocess?: (fragment: HTMLElement, editor: Editor) => void;
  /** Включить режим «вставить как текст» сразу. */
  pasteAsText?: boolean;
  /**
   * Оформление при вставке из Word, Google Docs, Excel и веб-страниц.
   * 'clean' (по умолчанию) — сохраняются жирный, курсив, цвета, списки, таблицы, ссылки, но не шрифт,
   * кегль и интервалы документа-источника; 'keep' — переносить и их.
   */
  pasteStyles?: PasteStyles;
}

const key = new PluginKey('nova-paste');

/** Превращает HTML в простой текст с сохранением абзацев (для режима «как текст»). */
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
        result = cleanPastedHTML(result, pasteStyles ?? 'clean');
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
      handlePaste(view, event, slice) {
        if (reentrant) return false;
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
        reentrant = true;
        try {
          view.pasteText(text);
        } finally {
          reentrant = false;
        }
        return true;
      },
    },
  });
}
