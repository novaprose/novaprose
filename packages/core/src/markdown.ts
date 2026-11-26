/**
 * Markdown на входе и выходе — отдельная точка входа `@novaprose/core/markdown` (~46 КБ gzip с парсером
 * не входит в ядро). Только данные и функции: ядро здесь импортируется лишь типами.
 *
 *   import { markdownToHTML, toMarkdown } from '@novaprose/core/markdown';
 *   editor.setContent(markdownToHTML('# Заголовок'));
 *   const md = toMarkdown(editor);
 *
 * Безопасность: Markdown превращается в HTML без сырого HTML (`html: false`), а дальше идёт через
 * схему редактора, как любой контент, — ссылки, картинки и CSS проверяются там же.
 */
import MarkdownIt from 'markdown-it';
import type { Mark, Node as PMNode } from 'prosemirror-model';
import {
  MarkdownSerializer,
  MarkdownSerializerState,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';
import type { Editor } from './editor';

export interface MarkdownToHTMLOptions {
  /** Превращать адреса вида https://… в ссылки (по умолчанию true). */
  linkify?: boolean;
  /** Одиночный перенос строки — <br> (как в чатах). По умолчанию false (как в CommonMark). */
  breaks?: boolean;
}

/**
 * Задачи GFM («- [ ] пункт», «- [x] сделано») → чек-лист NovaProse (data-type/data-checked, как у
 * Tiptap). Только в маркированных списках: нумерованных чек-листов в редакторе нет.
 */
function taskLists(md: InstanceType<typeof MarkdownIt>): void {
  md.core.ruler.after('inline', 'nova-task-lists', (state) => {
    const tokens = state.tokens;
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i]!;
      const item = tokens[i - 2]!;
      if (inline.type !== 'inline' || tokens[i - 1]!.type !== 'paragraph_open') continue;
      if (item.type !== 'list_item_open') continue;
      const match = /^\[([ xX])\](?:\s+|$)/.exec(inline.content);
      if (!match) continue;
      let list = -1;
      for (let j = i - 3; j >= 0; j--) {
        if (tokens[j]!.level === item.level - 1 && tokens[j]!.type.endsWith('_list_open')) {
          list = j;
          break;
        }
      }
      if (list < 0 || tokens[list]!.type !== 'bullet_list_open') continue;
      // Снять «[ ] » с начала текста пункта (он может быть разбит на несколько текстовых токенов).
      let rest = match[0].length;
      for (const child of inline.children ?? []) {
        if (rest <= 0 || child.type !== 'text') break;
        const cut = Math.min(rest, child.content.length);
        child.content = child.content.slice(cut);
        rest -= cut;
      }
      inline.content = inline.content.slice(match[0].length);
      item.attrSet('data-type', 'taskItem');
      item.attrSet('data-checked', String(match[1] !== ' '));
      tokens[list]!.attrSet('data-type', 'taskList');
    }
  });
}

/** Markdown (CommonMark + таблицы и ~~зачёркивание~~ GFM) → HTML для `setContent` / `insertContent`. */
export function markdownToHTML(markdown: string, options: MarkdownToHTMLOptions = {}): string {
  const md = new MarkdownIt('default', {
    html: false,
    linkify: options.linkify ?? true,
    breaks: options.breaks ?? false,
  });
  taskLists(md);
  // markdown-it заканчивает код в блоке служебным «\n» — в редакторе он был бы лишней пустой
  // строкой внизу блока (а в цитате ещё и размножался при сохранении). Содержимое экранировано,
  // так что «</code></pre>» в тексте кода встретиться не может.
  return md.render(markdown).replace(/\n<\/code><\/pre>/g, '</code></pre>');
}

const nodes = defaultMarkdownSerializer.nodes;

/** Тот же распознаватель адресов, что в markdownToHTML (linkify). */
const linkify = new MarkdownIt('default', { linkify: true }).linkify;

/**
 * Текст без ссылки, похожий на адрес («example.com», «https://…»), при чтении Markdown стал бы
 * ссылкой — документ менялся бы от сохранения к сохранению. Экранируем всю пунктуацию адреса
 * (`example\.com`): читается как тот же текст, а распознаватель видит лишь куски без точек и «//».
 * Только для адресов, которые автор оставил без ссылки, — редкий случай.
 * Найдено property-based тестом (packages/core/test/markdown.test.ts).
 */
/** ![alt](src "title") — для картинки и для картинки с подписью (figure). */
function imageNode(state: MarkdownSerializerState, node: PMNode): void {
  const src = String(node.attrs.src ?? '');
  const alt = state.esc(String(node.attrs.alt ?? ''));
  const title = node.attrs.title ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"` : '';
  state.write(`![${alt}](${src.replace(/[()]/g, '\\$&')}${title})`);
}

/** Сколько узлов того же типа стоит подряд прямо перед этим (для чередования маркеров списков). */
function siblingsBefore(parent: PMNode, index: number, node: PMNode): number {
  let count = 0;
  for (let i = index - 1; i >= 0 && parent.child(i).type === node.type; i--) count++;
  return count;
}

/** Символы, которые сериализатор экранирует: читатель режет текст на куски по ним. */
const ESCAPED = /[`*\\~[\]_]/g;

/** Диапазоны [from, to) текста, которые читатель распознал бы как адрес. */
function linkLikeRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const add = (offset: number, chunk: string) => {
    for (const m of linkify.match(chunk) ?? [])
      ranges.push([offset + m.index, offset + m.lastIndex]);
  };
  add(0, text);
  // Адрес может «появиться» в куске между экранированными символами: «https://a.io_» → «…\_».
  let start = 0;
  for (const m of text.matchAll(ESCAPED)) {
    add(start, text.slice(start, m.index));
    start = m.index + 1;
  }
  add(start, text.slice(start));
  // markdown-it распознаёт «схема://» и внутри слова («$https://…») — отдельным правилом.
  for (const m of text.matchAll(/[a-z][a-z\d+.-]*:\/\/\S*/gi)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

function textNode(state: MarkdownSerializerState, node: PMNode): void {
  const text = node.text ?? '';
  const ranges = node.marks.some((m) => m.type.name === 'link') ? [] : linkLikeRanges(text);
  if (!ranges.length) {
    state.text(text);
    return;
  }
  let last = 0;
  for (const [from, to] of ranges) {
    if (to <= last) continue;
    const begin = Math.max(from, last);
    state.text(text.slice(last, begin));
    // Любой ASCII-знак препинания можно экранировать обратной косой чертой (CommonMark).
    state.write(text.slice(begin, to).replace(/[!-/:-@[-`{-~]/g, '\\$&'));
    last = to;
  }
  state.text(text.slice(last));
}
const marks = defaultMarkdownSerializer.marks;

/** Оформление, которого нет в Markdown: текст остаётся, разметка снимается. */
const plain = { open: '', close: '', mixable: true, expelEnclosingWhitespace: true };

/** Текст ячейки в одну строку: «|» и переносы экранируются, блоки склеиваются пробелом. */
function cellText(cell: PMNode): string {
  const parts: string[] = [];
  cell.forEach((block) => parts.push(serialize(block).replace(/\n+/g, ' ').trim()));
  return parts.join(' ').replace(/\|/g, '\\|');
}

const serializer: MarkdownSerializer = new MarkdownSerializer(
  {
    ...nodes,
    text: textNode,
    heading(state, node) {
      state.write(`${'#'.repeat(Number(node.attrs.level) || 1)} `);
      state.renderInline(node);
      // «# Тег #» — по CommonMark завершающие «#» после пробела необязательное закрытие заголовка,
      // их выбрасывают: текст терялся бы при каждом сохранении. Экранируем последний «#».
      const s = state as unknown as { out: string };
      if (
        /(^|[ \t])#+$/.test(
          s.out.slice(s.out.lastIndexOf('\n') + 1).slice(Number(node.attrs.level) + 1),
        )
      ) {
        s.out = `${s.out.slice(0, -1)}\\#`;
      }
      state.closeBlock(node);
    },
    code_block(state, node) {
      const language = (node.attrs.language as string | null) ?? '';
      // Забор длиннее любой серии обратных кавычек внутри кода.
      const longest = Math.max(2, ...(node.textContent.match(/`+/g) ?? []).map((s) => s.length));
      const fence = '`'.repeat(longest + 1);
      state.write(`${fence}${language}\n`);
      // Пустой блок — без пустой строки внутри: иначе при чтении она станет содержимым и блок
      // рос бы с каждым сохранением (найдено property-based тестом).
      // Ровно один «\n» после содержимого — его читатель и отбросит (см. markdownToHTML).
      if (node.textContent) state.text(`${node.textContent}\n`, false);
      state.write(fence);
      state.closeBlock(node);
    },
    // Соседние списки одного типа чередуют маркер (* / -, 1. / 1)): иначе при чтении Markdown
    // они слились бы в один список (найдено property-based тестом).
    bullet_list(state, node, parent, index) {
      const marker = siblingsBefore(parent, index, node) % 2 ? '-' : '*';
      // Чек-лист — задачи GFM: «- [ ] пункт», «- [x] сделано».
      const box = (i: number) =>
        node.attrs.checklist === true ? `[${node.child(i).attrs.checked ? 'x' : ' '}] ` : '';
      state.renderList(node, '  ', (i) => `${marker} ${box(i)}`);
    },
    ordered_list(state, node, parent, index) {
      const start = (node.attrs.start as number | null) ?? 1;
      const delimiter = siblingsBefore(parent, index, node) % 2 ? ')' : '.';
      const maxW = String(start + node.childCount - 1).length;
      const space = ' '.repeat(maxW + 2);
      state.renderList(node, space, (i) => {
        const n = String(start + i);
        return `${' '.repeat(maxW - n.length)}${n}${delimiter} `;
      });
    },
    image: imageNode,
    // В Markdown нет подписей: картинка, затем подпись отдельным абзацем — текст сохраняется.
    figure(state, node) {
      if (node.firstChild) imageNode(state, node.firstChild);
      state.closeBlock(node);
      const caption = node.childCount > 1 ? node.child(1) : null;
      if (caption?.content.size) {
        state.renderInline(caption);
        state.closeBlock(caption);
      }
    },
    figcaption() {},
    figure_image() {},
    table(state, node) {
      const rows: string[][] = [];
      node.forEach((row) => {
        const cells: string[] = [];
        row.forEach((cell) => cells.push(cellText(cell)));
        rows.push(cells);
      });
      const width = Math.max(...rows.map((r) => r.length));
      const line = (cells: string[]) =>
        `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
      // В GFM у таблицы всегда есть строка заголовка: берём первую.
      state.write(line(rows[0] ?? []));
      state.ensureNewLine();
      state.write(`| ${Array.from({ length: width }, () => '---').join(' | ')} |`);
      for (const row of rows.slice(1)) {
        state.ensureNewLine();
        state.write(line(row));
      }
      state.closeBlock(node);
    },
    // Ячейки и строки сериализует table.
    table_row() {},
    table_cell() {},
    table_header() {},
    // Узлы плагинов.
    mergetag(state, node) {
      state.write(`{{${String(node.attrs.key ?? '')}}}`);
    },
    mention(state, node) {
      state.text(`@${String(node.attrs.name ?? '')}`);
    },
    media(state, node) {
      const src = String(node.attrs.src ?? '');
      state.write(`[${state.esc(String(node.attrs.title || src))}](${src})`);
      state.closeBlock(node);
    },
    anchor() {},
    // Элементы из extendedValidElements / customElements: в Markdown остаётся их текст.
    html_block(state, node) {
      state.renderContent(node);
    },
    html_textblock(state, node) {
      state.renderInline(node);
      state.closeBlock(node);
    },
    html_inline_atom() {},
    pagebreak(state, node) {
      state.closeBlock(node);
    },
  },
  {
    ...marks,
    bold: marks.strong!,
    italic: marks.em!,
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    link: {
      // Курсив/жирный могут охватывать ссылку целиком: «*текст [ссылка](url)*». Иначе оформление
      // закрывается перед ссылкой — и закрытие после пробела Markdown не засчитывает.
      mixable: true,
      open: '[',
      close: (_state: MarkdownSerializerState, mark: Mark) => {
        const href = String(mark.attrs.href ?? '').replace(/[()]/g, '\\$&');
        const title = mark.attrs.title ? ` "${String(mark.attrs.title).replace(/"/g, '\\"')}"` : '';
        return `](${href}${title})`;
      },
    },
    underline: plain,
    subscript: plain,
    superscript: plain,
    color: plain,
    background: plain,
    font_family: plain,
    font_size: plain,
    span_class: plain,
    html_inline: plain,
    comment: plain,
    suggestion_insert: plain,
    suggestion_delete: plain,
  },
  { strict: false },
);

/**
 * Документ → Markdown (CommonMark + таблицы и зачёркивание GFM). Оформление, которого нет в Markdown
 * (подчёркивание, цвет, шрифт, разрыв страницы), снимается — текст сохраняется. Переменные шаблона
 * становятся `{{key}}`, упоминания — `@Имя`.
 */
export function toMarkdown(source: Editor | PMNode): string {
  const doc = 'view' in source ? source.view.state.doc : source;
  return serialize(doc).trim();
}

/**
 * Экранирование начала строки в prosemirror-markdown неполное: «0)», «2025.» в конце строки, «+» и
 * строка из «=» (подчёркивание заголовка) при чтении меняли бы структуру — абзац становился списком
 * или заголовком, текст пропадал. Свой подкласс, а не правка прототипа: не задеваем другой код,
 * использующий ту же библиотеку. Найдено property-based тестом.
 */
// Конструктор и `out` в типах библиотеки помечены как внутренние; в рантайме они публичны
// (так их использует сам MarkdownSerializer.serialize).
type StateConstructor = new (
  nodes: MarkdownSerializer['nodes'],
  marks: MarkdownSerializer['marks'],
  options: { tightLists?: boolean },
) => MarkdownSerializerState & { out: string };
const BaseState = MarkdownSerializerState as unknown as StateConstructor;

class NovaMarkdownState extends BaseState {
  override esc(str: string, startOfLine = false): string {
    // Библиотека считает началом строки только начало блока; строка после переноса (Shift+Enter)
    // — тоже начало: иначе «#» там превращал продолжение абзаца в заголовок.
    const self = this as unknown as { out: string; delim: string };
    const lastLine = self.out.slice(self.out.lastIndexOf('\n') + 1);
    const lineStart =
      startOfLine || lastLine === self.delim || lastLine.trim() === self.delim.trim();
    let out = super.esc(str, lineStart);
    // Обычный пункт списка, который начинается с «[ ]» / «[x]», не должен стать задачей при чтении.
    if (/^\s*(?:[*+-]|\d{1,9}[.)])\s$/.test(lastLine)) out = out.replace(/^\[([ xX])\]/, '\\[$1]');
    if (lineStart) {
      out = out
        .replace(/^(\s*\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
        .replace(/^(\s*)\+(?=\s|$)/, '$1\\+')
        .replace(/^(\s*)(=+)(\s*)$/, '$1\\$2$3');
    }
    return out;
  }
}

function serialize(node: PMNode): string {
  const state = new NovaMarkdownState(serializer.nodes, serializer.marks, { tightLists: true });
  state.renderContent(
    node.type.name === 'doc' ? node : node.type.schema.topNodeType.create(null, node),
  );
  return state.out;
}
