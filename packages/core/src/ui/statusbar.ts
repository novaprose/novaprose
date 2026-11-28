import type { Node as PMNode } from 'prosemirror-model';
import type { Editor } from '../editor';
import { h, icon, isRtl, logicalKey } from './dom';
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
 * Counts words the way a person does: numbers and words with a hyphen/apostrophe are one word.
 * In Chinese and Japanese words aren't separated by spaces: every ideograph, hiragana and katakana character
 * counts as a word (as in word processors). Korean is written with spaces and counts as usual.
 */
const CJK = String.raw`\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}`;
const LETTER = String.raw`(?:(?![${CJK}])[\p{L}\p{N}])`;
const WORD = new RegExp(`[${CJK}]|${LETTER}+(?:['’-]${LETTER}+)*`, 'gu');

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/** The statusbar: the path to the element under the cursor (p › strong) and the word count. */
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
    // A whole node is selected (an image): it is part of the path too.
    const selected = (editor.view.state.selection as { node?: PMNode }).node;
    if (selected?.type.name === 'image') parts.push('img');
    for (const mark of $from.marks()) {
      const tag = MARK_TAGS[mark.type.name];
      if (tag) parts.push(tag);
    }
    // Each tag is a separate isolated fragment: right to left, the path runs right to left
    // (otherwise consecutive Latin names would merge into one left-to-right string); the browser mirrors "›".
    path.replaceChildren(
      ...parts.flatMap((tag, i) => [
        ...(i ? [' › '] : []),
        h('span', { className: 'nova-path-item' }, tag),
      ]),
    );
    // Counting the words of a large document doesn't happen on every keystroke.
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
/** The top of the handle's range for assistive technology (a focusable separator needs one). */
const MAX_HEIGHT = 4000;

/**
 * The resize handle in the statusbar corner: drag it with a mouse or a finger, arrows from the keyboard.
 * The size is set on the editor root (height, and width too for 'both').
 */
function createResizeHandle(editor: Editor, host: HTMLElement, both: boolean): () => void {
  const root = editor.root;
  const handle = h('div', {
    className: 'nova-resize-handle',
    role: 'separator',
    tabIndex: 0,
    'aria-orientation': 'horizontal',
    'aria-label': editor.ui.t('status.resize'),
    'aria-valuemin': String(MIN_HEIGHT),
  });
  handle.append(icon(both ? icons.resizeHandleBoth : icons.resizeHandle, editor.ui.registry));
  root.dataset.resize = both ? 'both' : 'vertical';
  host.append(handle);
  // A focusable separator says its value (WCAG 4.1.2): the editor's height in pixels.
  const sayHeight = () => {
    const height = Math.max(MIN_HEIGHT, root.offsetHeight);
    handle.setAttribute('aria-valuenow', String(height));
    handle.setAttribute('aria-valuemax', String(Math.max(MAX_HEIGHT, height)));
  };
  sayHeight();
  // The text may have grown the editor since: the value is fresh when the handle gets focus.
  handle.addEventListener('focus', sayHeight);

  const setSize = (height: number, width?: number) => {
    // The size is measured by the border box (offsetHeight), so it is set by the border box too, without a jump of the border width.
    root.style.boxSizing = 'border-box';
    root.style.height = `${Math.max(MIN_HEIGHT, Math.round(height))}px`;
    if (both && width !== undefined) {
      const max = root.parentElement?.clientWidth || Infinity;
      root.style.width = `${Math.min(max, Math.max(MIN_WIDTH, Math.round(width)))}px`;
    }
    sayHeight();
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
    // Right to left the handle is in the left corner: the width grows when moving left.
    const dx = (event.clientX - start.x) * (isRtl(root) ? -1 : 1);
    setSize(start.height + event.clientY - start.y, start.width + dx);
  };
  const onUp = (event: PointerEvent) => {
    if (!start) return;
    start = null;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };
  const onKey = (event: KeyboardEvent) => {
    const dy = event.key === 'ArrowDown' ? KEY_STEP : event.key === 'ArrowUp' ? -KEY_STEP : 0;
    const key = logicalKey(event, root);
    const dx = both ? (key === 'ArrowRight' ? KEY_STEP : key === 'ArrowLeft' ? -KEY_STEP : 0) : 0;
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
