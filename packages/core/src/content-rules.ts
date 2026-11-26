import { Fragment, type Mark, type Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { NovaSchema } from './schema';

/**
 * Ограничение контента (аналог valid_elements / invalid_elements / valid_styles).
 *
 * Схема NovaProse одна на процесс, поэтому ограничения — не другая схема, а нормализатор:
 * всё запрещённое деградирует (жирный → текст, h1 → абзац, список → абзацы, таблица → содержимое)
 * при любом изменении документа — вставке, перетаскивании, setContent, горячих клавишах.
 */
export interface ContentRulesOptions {
  /**
   * Разрешены ТОЛЬКО эти элементы: 'p,strong/b,em/i,a[href|title],ul,ol'. Список атрибутов в [...] —
   * полный список для элемента; элемент без [...] сохраняет встроенные атрибуты.
   */
  validElements?: string;
  /**
   * Дополнительные элементы и атрибуты (синтаксис validElements): 'div[class],h2[id],i[class]'.
   * Правило для элемента заменяет его список атрибутов; `@[id|title]` — атрибуты всех элементов.
   */
  extendedValidElements?: string;
  /** Свои элементы: 'my-widget,~my-chip' (~ — строчный, как span; без ~ — блочный, как div). */
  customElements?: string;
  /** Запрещённые элементы: 'img,table,h1'. */
  invalidElements?: string;
  /** Разрешённые CSS-свойства: 'color,text-align' или { '*': 'color', img: 'float' }. */
  validStyles?: string | Record<string, string>;
}

/** Синонимы → канонический тег NovaProse. */
const ALIASES: Record<string, string> = {
  b: 'strong',
  i: 'em',
  strike: 's',
  del: 's',
  tbody: 'table',
  thead: 'table',
  tfoot: 'table',
  caption: 'table',
  colgroup: 'table',
  col: 'table',
  figcaption: 'figure',
};

/** Все теги, которыми оперирует NovaProse. p и текст разрешены всегда. */
export const KNOWN_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'hr',
  'ul',
  'ol',
  'li',
  'img',
  'figure',
  'br',
  'table',
  'tr',
  'td',
  'th',
  'strong',
  'em',
  'u',
  's',
  'code',
  'a',
  'sub',
  'sup',
  'span',
] as const;

/** Стили NovaProse и какой CSS-свойство каждый пишет. */
export const KNOWN_STYLES = [
  'color',
  'background-color',
  'font-family',
  'font-size',
  'text-align',
  'line-height',
  'float',
  'width',
] as const;

/**
 * Что нужно контролу/команде/пункту меню, чтобы быть доступным.
 * Ключи — имена кнопок тулбара, пунктов меню и слэш-команд.
 */
const REQUIREMENTS: Record<string, string[]> = {
  bold: ['strong'],
  italic: ['em'],
  underline: ['u'],
  strikethrough: ['s'],
  strike: ['s'],
  inlinecode: ['code'],
  code: ['code'],
  subscript: ['sub'],
  superscript: ['sup'],
  link: ['a'],
  unlink: ['a'],
  quicklink: ['a'],
  image: ['img'],
  quickimage: ['img'],
  table: ['table'],
  quicktable: ['table'],
  inserttable: ['table'],
  tableinsertrowbefore: ['table'],
  tableinsertrowafter: ['table'],
  tabledeleterow: ['table'],
  tableinsertcolbefore: ['table'],
  tableinsertcolafter: ['table'],
  tabledeletecol: ['table'],
  tablemergecells: ['table'],
  tablesplitcells: ['table'],
  tabledelete: ['table'],
  tablerowheader: ['th'],
  tablecolheader: ['th'],
  tablecellbackground: ['style:background-color'],
  bullist: ['ul'],
  bulletlist: ['ul'],
  numlist: ['ol'],
  orderedlist: ['ol'],
  blockquote: ['blockquote'],
  codeblock: ['pre'],
  hr: ['hr'],
  horizontalrule: ['hr'],
  h1: ['h1'],
  h2: ['h2'],
  h3: ['h3'],
  h4: ['h4'],
  h5: ['h5'],
  h6: ['h6'],
  forecolor: ['span', 'style:color'],
  backcolor: ['span', 'style:background-color'],
  fontfamily: ['span', 'style:font-family'],
  fontsize: ['span', 'style:font-size'],
  lineheight: ['style:line-height'],
  align: ['style:text-align'],
  alignleft: ['style:text-align'],
  aligncenter: ['style:text-align'],
  alignright: ['style:text-align'],
  alignjustify: ['style:text-align'],
  imagealignleft: ['style:float'],
  imagealigncenter: ['style:float'],
  imagealignright: ['style:float'],
};

function parseList(value: string | undefined): Set<string> | null {
  if (value === undefined) return null;
  const set = new Set<string>();
  for (const raw of value.split(',')) {
    // TinyMCE-модификаторы в начале (-p, #p, +p, !p) и атрибуты в [...] отбрасываем.
    const item = raw
      .trim()
      .replace(/^[-#+!]+/, '')
      .replace(/\[.*$/, '')
      .toLowerCase();
    for (const name of item.split('/')) {
      const tag = name.trim();
      if (tag) set.add(ALIASES[tag] ?? tag);
    }
  }
  return set;
}

function parseStyles(value: ContentRulesOptions['validStyles']): Set<string> | null {
  if (value === undefined) return null;
  const text = typeof value === 'string' ? value : Object.values(value).join(',');
  return new Set(
    text
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export class ContentRules {
  private readonly tags: Set<string>;
  private readonly styles: Set<string> | null;

  constructor(options: ContentRulesOptions) {
    const valid = parseList(options.validElements);
    const invalid = parseList(options.invalidElements) ?? new Set();
    const tags = new Set<string>(valid ?? KNOWN_TAGS);
    // extendedValidElements дополняет список validElements.
    if (valid) for (const tag of parseList(options.extendedValidElements) ?? []) tags.add(tag);
    // Неявные зависимости: список без li или таблица без tr/td бессмысленны.
    if (tags.has('ul') || tags.has('ol')) tags.add('li');
    if (tags.has('table')) {
      tags.add('tr');
      tags.add('td');
    }
    for (const tag of invalid) tags.delete(tag);
    tags.add('p');
    this.tags = tags;
    this.styles = parseStyles(options.validStyles);
  }

  isTagAllowed(tag: string): boolean {
    const t = tag.toLowerCase();
    return this.tags.has(ALIASES[t] ?? t);
  }

  isStyleAllowed(property: string): boolean {
    return !this.styles || this.styles.has(property.toLowerCase());
  }

  /** Доступен ли контрол / пункт меню / слэш-команда (по имени). Неизвестные имена — разрешены. */
  isAllowed(name: string): boolean {
    const req = REQUIREMENTS[name.toLowerCase()];
    if (!req) return true;
    return req.every((r) =>
      r.startsWith('style:') ? this.isStyleAllowed(r.slice(6)) : this.isTagAllowed(r),
    );
  }

  private markAllowed(mark: Mark): boolean {
    switch (mark.type.name) {
      case 'bold':
        return this.isTagAllowed('strong');
      case 'italic':
        return this.isTagAllowed('em');
      case 'underline':
        return this.isTagAllowed('u');
      case 'strike':
        return this.isTagAllowed('s');
      case 'code':
        return this.isTagAllowed('code');
      case 'link':
        return this.isTagAllowed('a');
      case 'subscript':
        return this.isTagAllowed('sub');
      case 'superscript':
        return this.isTagAllowed('sup');
      case 'color':
        return this.isTagAllowed('span') && this.isStyleAllowed('color');
      case 'background':
        return this.isTagAllowed('span') && this.isStyleAllowed('background-color');
      case 'font_family':
        return this.isTagAllowed('span') && this.isStyleAllowed('font-family');
      case 'font_size':
        return this.isTagAllowed('span') && this.isStyleAllowed('font-size');
      default:
        return true;
    }
  }

  /** Атрибуты блока без запрещённых стилей. */
  private blockAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
    return {
      ...attrs,
      ...(this.isStyleAllowed('text-align') ? {} : { align: null }),
      ...(this.isStyleAllowed('line-height') ? {} : { lineHeight: null }),
      ...(this.isStyleAllowed('margin-left') ? {} : { indent: 0 }),
    };
  }

  /** Привести узел к правилам. Возвращает 0…n узлов (запрещённый блок может «раствориться»). */
  normalize(node: PMNode): PMNode[] {
    // Схема узла, а не общая базовая: у редактора с плагинами она своя.
    const schema = node.type.schema as NovaSchema;
    const { nodes } = schema;
    if (node.isText) {
      const marks = node.marks.filter((m) => this.markAllowed(m));
      return [marks.length === node.marks.length ? node : node.mark(marks)];
    }
    const marks = node.marks.filter((m) => this.markAllowed(m));
    switch (node.type) {
      case nodes.image:
        if (!this.isTagAllowed('img')) return [];
        return [
          nodes.image.create(
            { ...node.attrs, ...(this.isStyleAllowed('float') ? {} : { align: null }) },
            null,
            marks,
          ),
        ];
      case nodes.figure: {
        // Картинки запрещены — от подписи остаётся текст; figure запрещён — картинка и подпись абзацами.
        const caption = node.childCount > 1 ? node.child(1).content : null;
        const captionBlocks = caption?.size
          ? [nodes.paragraph.create(null, this.normalizeChildren(caption))]
          : [];
        const image = node.firstChild;
        if (!this.isTagAllowed('img') || !image) return captionBlocks;
        const align = this.isStyleAllowed('float') ? node.attrs.align : null;
        if (!this.isTagAllowed('figure')) {
          const inline = nodes.image.create({ ...image.attrs, align });
          return [nodes.paragraph.create(null, inline), ...captionBlocks];
        }
        return [nodes.figure.create({ ...node.attrs, align }, node.content)];
      }
      case nodes.hard_break:
        return this.isTagAllowed('br') ? [node.mark(marks)] : [schema.text(' ', marks)];
      case nodes.horizontal_rule:
        return this.isTagAllowed('hr') ? [node] : [];
    }

    const children = this.normalizeChildren(node.content);
    const make = (
      type = node.type,
      attrs: Record<string, unknown> | null = node.attrs,
    ): PMNode[] => {
      try {
        return [type.createChecked(attrs, children, node.marks)];
      } catch {
        const filled = type.createAndFill(attrs, children, node.marks);
        return filled ? [filled] : children.content.length ? asBlocks(children) : [];
      }
    };

    switch (node.type) {
      case nodes.paragraph:
        return make(nodes.paragraph, this.blockAttrs(node.attrs));
      case nodes.heading:
        return this.isTagAllowed(`h${node.attrs.level}`)
          ? make(nodes.heading, this.blockAttrs(node.attrs))
          : make(
              nodes.paragraph,
              this.blockAttrs({ align: node.attrs.align, lineHeight: node.attrs.lineHeight }),
            );
      case nodes.blockquote:
        return this.isTagAllowed('blockquote') ? make() : asBlocks(children);
      case nodes.code_block:
        if (this.isTagAllowed('pre')) return make();
        // Блок кода → абзацы построчно.
        return node.textContent
          .split('\n')
          .map((line) => nodes.paragraph.create(null, line ? schema.text(line) : null));
      case nodes.bullet_list:
      case nodes.ordered_list:
        if (!this.isTagAllowed(node.type === nodes.bullet_list ? 'ul' : 'ol'))
          return flattenItems(children);
        return make(node.type, {
          ...node.attrs,
          ...(this.isStyleAllowed('list-style-type') ? {} : { listStyle: null }),
        });
      case nodes.table:
        return this.isTagAllowed('table') ? make() : flattenTable(children);
      case nodes.table_header:
        // th запрещён — ячейка остаётся обычной (td).
        return this.isTagAllowed('th') ? make() : make(nodes.table_cell, node.attrs);
      case nodes.table_cell:
        return make(nodes.table_cell, {
          ...node.attrs,
          ...(this.isStyleAllowed('background-color') ? {} : { background: null }),
        });
      default:
        return make();
    }
  }

  normalizeChildren(fragment: Fragment): Fragment {
    const out: PMNode[] = [];
    fragment.forEach((child) => out.push(...this.normalize(child)));
    return Fragment.from(out);
  }

  /** Нормализовать документ целиком (начальное содержимое). */
  normalizeDoc(doc: PMNode): PMNode {
    const content = this.normalizeChildren(doc.content);
    const schema = doc.type.schema as NovaSchema;
    return doc.type.createAndFill(null, content.size ? content : schema.nodes.paragraph.create())!;
  }
}

/** Инлайн-содержимое без блока-обёртки оборачиваем в абзац. */
function asBlocks(fragment: Fragment): PMNode[] {
  const out: PMNode[] = [];
  let inline: PMNode[] = [];
  const flush = () => {
    if (inline.length)
      out.push((inline[0]!.type.schema as NovaSchema).nodes.paragraph.create(null, inline));
    inline = [];
  };
  fragment.forEach((child) => {
    if (child.isInline) inline.push(child);
    else {
      flush();
      out.push(child);
    }
  });
  flush();
  return out;
}

/** Список запрещён — пункты превращаются в их содержимое (абзацы, вложенные блоки). */
function flattenItems(fragment: Fragment): PMNode[] {
  const out: PMNode[] = [];
  fragment.forEach((item) => {
    if (item.type === (item.type.schema as NovaSchema).nodes.list_item)
      item.content.forEach((block) => out.push(block));
    else out.push(...asBlocks(Fragment.from(item)));
  });
  return out;
}

/** Таблица запрещена — содержимое ячеек по порядку. */
function flattenTable(fragment: Fragment): PMNode[] {
  const out: PMNode[] = [];
  fragment.forEach((row) => row.forEach((cell) => cell.forEach((block) => out.push(block))));
  return out;
}

const key = new PluginKey('nova-content-rules');

/**
 * Нормализует только изменившуюся часть документа (findDiffStart/End) — дёшево даже на больших текстах.
 * Срабатывает на любой путь изменения: ввод, вставка, перетаскивание, setContent, команды.
 */
export function contentRulesPlugin(rules: ContentRules): Plugin {
  return new Plugin({
    key,
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const start = oldState.doc.content.findDiffStart(newState.doc.content);
      if (start === null) return null;
      const end =
        oldState.doc.content.findDiffEnd(newState.doc.content)?.b ?? newState.doc.content.size;
      const doc = newState.doc;
      const replacements: { from: number; to: number; nodes: PMNode[] }[] = [];
      doc.forEach((child, offset) => {
        const from = offset;
        const to = offset + child.nodeSize;
        if (to < start || from > Math.max(start, end)) return;
        const normalized = rules.normalize(child);
        if (normalized.length === 1 && normalized[0]!.eq(child)) return;
        replacements.push({ from, to, nodes: normalized });
      });
      if (!replacements.length) return null;
      const tr = newState.tr;
      // С конца — чтобы ранние позиции не съезжали.
      for (const { from, to, nodes } of replacements.reverse()) {
        if (nodes.length) tr.replaceWith(from, to, nodes);
        else if (tr.doc.childCount > 1) tr.delete(from, to);
        // Документ не может быть пустым — последний блок заменяем пустым абзацем.
        else tr.replaceWith(from, to, (newState.schema as NovaSchema).nodes.paragraph.create());
      }
      return tr.setMeta(
        'addToHistory',
        transactions.every((t) => t.getMeta('addToHistory') !== false),
      );
    },
  });
}
