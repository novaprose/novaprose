import type { Node as PMNode } from 'prosemirror-model';
import type { Editor } from '../editor';
import { h, icon } from './dom';
import { icons } from './icons';

const TAGS: Record<string, (node: PMNode) => string> = {
  paragraph: () => 'p',
  heading: (n) => `h${n.attrs.level}`,
  blockquote: () => 'blockquote',
  code_block: () => 'pre',
  bullet_list: () => 'ul',
  ordered_list: () => 'ol',
  list_item: () => 'li',
  table: () => 'table',
  table_row: () => 'tr',
  table_cell: () => 'td',
  table_header: () => 'th',
};

const MARK_TAGS: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
  link: 'a',
  subscript: 'sub',
  superscript: 'sup',
};

/**
 * Считает слова так же, как пользователь: числа и слова с дефисом/апострофом — одно слово.
 * В китайском и японском слова не разделяются пробелами: каждый иероглиф, знак хираганы и катаканы
 * считается словом (как в текстовых процессорах). Корейский пишется с пробелами — как обычно.
 */
const CJK = String.raw`\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}`;
const LETTER = String.raw`(?:(?![${CJK}])[\p{L}\p{N}])`;
const WORD = new RegExp(`[${CJK}]|${LETTER}+(?:['’-]${LETTER}+)*`, 'gu');

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/** Статусбар: путь к элементу под курсором (p › strong) и счётчик слов. */
export function createStatusbar(editor: Editor, host: HTMLElement) {
  host.className = 'nova-statusbar';
  const path = h('div', { className: 'nova-path', 'aria-hidden': 'true' });
  const words = h('div', { className: 'nova-wordcount', 'aria-live': 'off' });
  host.append(path, words);
  const resize = editor.options.resize;
  const removeHandle = resize ? createResizeHandle(editor, host, resize === 'both') : null;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const updateWords = () => {
    const doc = editor.view.state.doc;
    words.textContent = editor.ui.t('status.words', {
      count: countWords(doc.textBetween(0, doc.content.size, ' ', ' ')),
    });
  };

  const update = (docChanged: boolean) => {
    const { $from } = editor.view.state.selection;
    const parts: string[] = [];
    for (let depth = 1; depth <= $from.depth; depth++) {
      const node = $from.node(depth);
      const tag = TAGS[node.type.name]?.(node);
      if (tag) parts.push(tag);
    }
    // Выделен узел целиком (картинка) — он тоже часть пути.
    const selected = (editor.view.state.selection as { node?: PMNode }).node;
    if (selected?.type.name === 'image') parts.push('img');
    for (const mark of $from.marks()) {
      const tag = MARK_TAGS[mark.type.name];
      if (tag) parts.push(tag);
    }
    path.textContent = parts.join(' › ');
    // Подсчёт слов на большом документе — не на каждое нажатие клавиши.
    if (docChanged) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(updateWords, 250);
    }
  };

  updateWords();
  update(false);

  return {
    update,
    destroy: () => {
      if (timer) clearTimeout(timer);
      removeHandle?.();
      host.replaceChildren();
    },
  };
}

const MIN_HEIGHT = 100;
const MIN_WIDTH = 200;
const KEY_STEP = 20;

/**
 * Ручка изменения размера в углу статусбара: тянуть мышью или пальцем, стрелки с клавиатуры.
 * Размер задаётся корню редактора (height, при 'both' — и width).
 */
function createResizeHandle(editor: Editor, host: HTMLElement, both: boolean): () => void {
  const root = editor.root;
  const handle = h('div', {
    className: 'nova-resize-handle',
    role: 'separator',
    tabIndex: 0,
    'aria-orientation': 'horizontal',
    'aria-label': editor.ui.t('status.resize'),
  });
  handle.append(icon(both ? icons.resizeHandleBoth : icons.resizeHandle));
  root.dataset.resize = both ? 'both' : 'vertical';
  host.append(handle);

  const setSize = (height: number, width?: number) => {
    // Размер считаем по рамке (offsetHeight), значит и задаём по рамке — без скачка на ширину border.
    root.style.boxSizing = 'border-box';
    root.style.height = `${Math.max(MIN_HEIGHT, Math.round(height))}px`;
    if (both && width !== undefined) {
      const max = root.parentElement?.clientWidth || Infinity;
      root.style.width = `${Math.min(max, Math.max(MIN_WIDTH, Math.round(width)))}px`;
    }
    handle.setAttribute('aria-valuenow', String(root.offsetHeight));
  };

  let start: { x: number; y: number; height: number; width: number } | null = null;
  const onDown = (event: PointerEvent) => {
    if (editor.isDisabled()) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    start = {
      x: event.clientX,
      y: event.clientY,
      height: root.offsetHeight,
      width: root.offsetWidth,
    };
  };
  const onMove = (event: PointerEvent) => {
    if (!start) return;
    setSize(start.height + event.clientY - start.y, start.width + event.clientX - start.x);
  };
  const onUp = (event: PointerEvent) => {
    if (!start) return;
    start = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };
  const onKey = (event: KeyboardEvent) => {
    const dy = event.key === 'ArrowDown' ? KEY_STEP : event.key === 'ArrowUp' ? -KEY_STEP : 0;
    const dx = both
      ? event.key === 'ArrowRight'
        ? KEY_STEP
        : event.key === 'ArrowLeft'
          ? -KEY_STEP
          : 0
      : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    setSize(root.offsetHeight + dy, root.offsetWidth + dx);
  };
  handle.addEventListener('pointerdown', onDown);
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
  handle.addEventListener('keydown', onKey);
  return () => {
    handle.remove();
    delete root.dataset.resize;
  };
}
