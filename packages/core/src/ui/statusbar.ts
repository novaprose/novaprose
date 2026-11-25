import type { Node as PMNode } from 'prosemirror-model';
import type { Editor } from '../editor';
import { h } from './dom';

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

/** Считает слова так же, как пользователь: числа и слова с дефисом/апострофом — одно слово. */
export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

/** Статусбар: путь к элементу под курсором (p › strong) и счётчик слов. */
export function createStatusbar(editor: Editor, host: HTMLElement) {
  host.className = 'nova-statusbar';
  const path = h('div', { className: 'nova-path', 'aria-hidden': 'true' });
  const words = h('div', { className: 'nova-wordcount', 'aria-live': 'off' });
  host.append(path, words);

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
      host.replaceChildren();
    },
  };
}
