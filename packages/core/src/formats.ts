// Форматы и стили (как formats / style_formats в TinyMCE): именованные наборы «тег + классы + стили»,
// которые применяются к выделению. Три вида:
//   block    — сменить тип блока (p, h1–h6, blockquote, pre) и задать классы/стили;
//   inline   — отметить текст (span с классами/стилями или strong, em, code…);
//   selector — добавить классы/стили уже существующим элементам (p,h1 / img / blockquote).
import type { Mark, MarkType, Node as PMNode } from 'prosemirror-model';
import { NodeSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { lift, wrapIn } from 'prosemirror-commands';
import type { Editor } from './editor';
import { marksOf, nodesOf } from './commands';
import { ALIGNMENTS, cssValue, type TextAlign } from './schema';

export type BlockTag = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote' | 'pre';
export type InlineTag =
  'span' | 'strong' | 'b' | 'em' | 'i' | 'u' | 's' | 'strike' | 'del' | 'code' | 'sub' | 'sup';

export interface FormatSpec {
  /** Сменить тип блока. */
  block?: BlockTag;
  /** Отметить выделенный текст. */
  inline?: InlineTag;
  /** Применить к существующим элементам: 'p,h1', 'img', 'blockquote'. */
  selector?: string;
  /** Классы: 'note' или ['note', 'warning']. */
  classes?: string | string[];
  /**
   * Стили. Для текста — color, background-color, font-family, font-size;
   * для блоков — text-align, line-height. Остальные не поддерживаются (предупреждение в консоли).
   */
  styles?: Record<string, string>;
}

/** Пункт меню «Стили»: свой формат, ссылка на именованный (format) или группа (items). */
export interface StyleFormat extends FormatSpec {
  title: string;
  format?: string;
  items?: StyleFormat[];
}

const INLINE_MARKS: Record<Exclude<InlineTag, 'span'>, string> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  s: 'strike',
  strike: 'strike',
  del: 'strike',
  code: 'code',
  sub: 'subscript',
  sup: 'superscript',
};
const INLINE_STYLES: Record<string, { mark: string; read: (v: unknown) => string | null }> = {
  color: { mark: 'color', read: cssValue.color },
  'background-color': { mark: 'background', read: cssValue.color },
  'font-family': { mark: 'font_family', read: cssValue.fontFamily },
  'font-size': { mark: 'font_size', read: cssValue.length },
};
const BLOCK_TAGS: Record<string, (node: PMNode) => boolean> = {
  p: (n) => n.type.name === 'paragraph',
  h1: (n) => n.type.name === 'heading' && n.attrs.level === 1,
  h2: (n) => n.type.name === 'heading' && n.attrs.level === 2,
  h3: (n) => n.type.name === 'heading' && n.attrs.level === 3,
  h4: (n) => n.type.name === 'heading' && n.attrs.level === 4,
  h5: (n) => n.type.name === 'heading' && n.attrs.level === 5,
  h6: (n) => n.type.name === 'heading' && n.attrs.level === 6,
  blockquote: (n) => n.type.name === 'blockquote',
  pre: (n) => n.type.name === 'code_block',
  img: (n) => n.type.name === 'image',
};

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[nova] formats: ${message}`);
}

export function classList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(classList);
  return typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [];
}

/** Все классы из форматов — их схема сохраняет при разборе HTML. */
export function formatClasses(specs: Iterable<FormatSpec | StyleFormat>): string[] {
  const out: string[] = [];
  for (const spec of specs) {
    out.push(...classList(spec.classes));
    if ('items' in spec && spec.items) out.push(...formatClasses(spec.items));
  }
  return out;
}

const hasClasses = (value: unknown, wanted: string[]) => {
  const have = classList(value);
  return wanted.every((c) => have.includes(c));
};
const withClasses = (value: unknown, add: string[]) => {
  const merged = [...new Set([...classList(value), ...add])];
  return merged.length ? merged.join(' ') : null;
};
const withoutClasses = (value: unknown, drop: string[]) => {
  const rest = classList(value).filter((c) => !drop.includes(c));
  return rest.length ? rest.join(' ') : null;
};

/** text-align / line-height из styles формата → атрибуты блока. */
function blockStyles(spec: FormatSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [prop, value] of Object.entries(spec.styles ?? {})) {
    if (prop === 'text-align' && (ALIGNMENTS as readonly string[]).includes(value))
      out.align = value as TextAlign;
    else if (prop === 'line-height' && cssValue.lineHeight(value))
      out.lineHeight = cssValue.lineHeight(value);
    else warnOnce(`style "${prop}" is not supported on blocks`);
  }
  return out;
}

/** Марки инлайн-формата: тег, классы (span_class) и поддерживаемые стили. */
function inlineMarks(state: EditorState, spec: FormatSpec): Mark[] {
  const marks = marksOf(state) as Record<string, MarkType | undefined>;
  const out: Mark[] = [];
  if (spec.inline && spec.inline !== 'span') {
    const type = marks[INLINE_MARKS[spec.inline]];
    if (type) out.push(type.create());
  }
  const classes = classList(spec.classes);
  if (classes.length && marks.span_class)
    out.push(marks.span_class.create({ class: classes.join(' ') }));
  for (const [prop, raw] of Object.entries(spec.styles ?? {})) {
    const style = INLINE_STYLES[prop];
    const value = style?.read(raw);
    const type = style ? marks[style.mark] : undefined;
    if (type && value) out.push(type.create({ value }));
    else warnOnce(`style "${prop}: ${raw}" is not supported on text`);
  }
  return out;
}

const selectorTags = (spec: FormatSpec) =>
  (spec.selector ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((tag) => {
      if (BLOCK_TAGS[tag]) return true;
      warnOnce(`selector "${tag}" is not supported`);
      return false;
    });

/** Узлы выделения, подходящие под selector (включая родителей и выделенную картинку). */
function selectedNodes(state: EditorState, tags: string[]): { node: PMNode; pos: number }[] {
  const out: { node: PMNode; pos: number }[] = [];
  const matches = (node: PMNode) => tags.some((tag) => BLOCK_TAGS[tag]!(node));
  const { selection } = state;
  if (selection instanceof NodeSelection && matches(selection.node)) {
    return [{ node: selection.node, pos: selection.from }];
  }
  const { $from, from, to } = selection;
  // Родители курсора (цитата вокруг абзаца) — nodesBetween при пустом выделении их не даёт.
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (matches(node)) out.push({ node, pos: $from.before(depth) });
  }
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (matches(node) && !out.some((o) => o.pos === pos)) out.push({ node, pos });
  });
  return out;
}

/** Текстовые блоки выделения (абзацы и заголовки) — для блочных форматов. */
function textBlocks(state: EditorState): { node: PMNode; pos: number }[] {
  const out: { node: PMNode; pos: number }[] = [];
  const { from, to } = state.selection;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      out.push({ node, pos });
      return false;
    }
    return true;
  });
  return out;
}

function blockquoteAt(state: EditorState): { node: PMNode; pos: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'blockquote') return { node, pos: $from.before(depth) };
  }
  return null;
}

function keepBlockStyle(attrs: Record<string, unknown>) {
  return {
    align: attrs.align ?? null,
    lineHeight: attrs.lineHeight ?? null,
    dir: attrs.dir ?? null,
  };
}

/**
 * Реестр форматов редактора и их применение к выделению (`editor.formatter`).
 * Классы из зарегистрированных форматов сохраняются при разборе HTML.
 */
export class Formatter {
  private readonly registry = new Map<string, FormatSpec[]>();

  constructor(
    private readonly editor: Editor,
    /** Пополняется классами новых форматов — схема сверяется с ним при разборе HTML. */
    private readonly allowedClasses: Set<string>,
  ) {}

  /** Зарегистрировать именованный формат (одно описание или несколько вариантов). */
  register(name: string, spec: FormatSpec | FormatSpec[]): void {
    const specs = Array.isArray(spec) ? spec : [spec];
    this.registry.set(name, specs);
    formatClasses(specs).forEach((c) => this.allowedClasses.add(c));
  }

  unregister(name: string): void {
    this.registry.delete(name);
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  get(name: string): FormatSpec[] | undefined {
    return this.registry.get(name);
  }

  private resolve(format: string | FormatSpec): FormatSpec[] {
    if (typeof format !== 'string') return [format];
    const specs = this.registry.get(format);
    if (!specs) warnOnce(`unknown format "${format}"`);
    return specs ?? [];
  }

  /** Можно ли применить формат к выделению (для selector — есть ли подходящие элементы). */
  canApply(format: string | FormatSpec): boolean {
    if (!this.editor.isEditable()) return false;
    const state = this.editor.view.state;
    return this.resolve(format).some((spec) => canApply(state, spec));
  }

  /** Подходит ли выделение под формат. */
  match(format: string | FormatSpec): boolean {
    const state = this.editor.view.state;
    return this.resolve(format).some((spec) => matchSpec(state, spec));
  }

  apply(format: string | FormatSpec): boolean {
    if (!this.editor.isEditable()) return false;
    const specs = this.resolve(format);
    if (!specs.length) return false;
    // Вариантов несколько (например, selector для блоков и inline для текста) — применяем подходящий.
    const spec = specs.find((s) => canApply(this.editor.view.state, s)) ?? specs[0]!;
    return this.run((state, tr) => applySpec(state, tr, spec));
  }

  remove(format: string | FormatSpec): boolean {
    if (!this.editor.isEditable()) return false;
    const specs = this.resolve(format);
    if (!specs.length) return false;
    return this.run((state, tr) => specs.forEach((spec) => removeSpec(state, tr, spec)));
  }

  toggle(format: string | FormatSpec): boolean {
    return this.match(format) ? this.remove(format) : this.apply(format);
  }

  private run(fn: (state: EditorState, tr: Transaction) => void | boolean): boolean {
    const { view } = this.editor;
    const tr = view.state.tr;
    const result = fn(view.state, tr);
    if (result === false) return false;
    if (tr.docChanged || tr.storedMarksSet) view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
  }
}

function canApply(state: EditorState, spec: FormatSpec): boolean {
  if (spec.selector) return selectedNodes(state, selectorTags(spec)).length > 0;
  return true;
}

/** Блок несёт стили формата (выравнивание, интервал). */
function hasBlockStyles(node: PMNode, spec: FormatSpec): boolean {
  if (node.type.name === 'image') return true;
  return Object.entries(blockStyles(spec)).every(([key, value]) => node.attrs[key] === value);
}

function matchSpec(state: EditorState, spec: FormatSpec): boolean {
  const classes = classList(spec.classes);
  if (spec.block) {
    if (spec.block === 'blockquote') {
      const quote = blockquoteAt(state);
      return !!quote && hasClasses(quote.node.attrs.class, classes);
    }
    const node = state.selection.$from.parent;
    return (
      BLOCK_TAGS[spec.block]!(node) &&
      hasClasses(node.attrs.class, classes) &&
      hasBlockStyles(node, spec)
    );
  }
  if (spec.selector) {
    const nodes = selectedNodes(state, selectorTags(spec));
    return (
      nodes.length > 0 &&
      nodes.some(({ node }) => hasClasses(node.attrs.class, classes) && hasBlockStyles(node, spec))
    );
  }
  if (spec.inline) {
    const wanted = inlineMarks(state, spec);
    if (!wanted.length) return false;
    const { $from, empty, from, to } = state.selection;
    if (empty) {
      const marks = state.storedMarks ?? $from.marks();
      return wanted.every((mark) => marks.some((m) => markCovers(m, mark)));
    }
    let found = false;
    let all = true;
    state.doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return;
      found = true;
      if (!wanted.every((mark) => node.marks.some((m) => markCovers(m, mark)))) all = false;
    });
    return found && all;
  }
  return false;
}

/** Марка m содержит формат mark: тот же тип и (для span_class) все классы. */
function markCovers(m: Mark, mark: Mark): boolean {
  if (m.type !== mark.type) return false;
  if (mark.type.name === 'span_class')
    return hasClasses(m.attrs.class, classList(mark.attrs.class));
  return mark.attrs.value === undefined || m.attrs.value === mark.attrs.value;
}

function applySpec(state: EditorState, tr: Transaction, spec: FormatSpec): boolean {
  const classes = classList(spec.classes);
  const nodes = nodesOf(state);

  if (spec.block === 'blockquote') {
    const quote = blockquoteAt(state);
    if (quote) {
      tr.setNodeMarkup(quote.pos, undefined, {
        ...quote.node.attrs,
        class: withClasses(quote.node.attrs.class, classes),
      });
      return true;
    }
    return wrapIn(nodes.blockquote, { class: withClasses(null, classes) })(state, (wrapped) =>
      wrapped.steps.forEach((step) => tr.step(step)),
    );
  }
  if (spec.block === 'pre') {
    for (const { node, pos } of textBlocks(state)) {
      if (node.type !== nodes.code_block)
        tr.setNodeMarkup(pos, nodes.code_block, { language: null });
    }
    return true;
  }
  if (spec.block) {
    const level = spec.block === 'p' ? 0 : Number(spec.block.slice(1));
    const type = level ? nodes.heading : nodes.paragraph;
    const styles = blockStyles(spec);
    for (const { node, pos } of textBlocks(state)) {
      if (node.type === nodes.code_block && node.textContent.includes('\n')) continue;
      const sameType = node.type === type && (!level || node.attrs.level === level);
      tr.setNodeMarkup(pos, type, {
        ...keepBlockStyle(node.attrs),
        ...(level ? { level } : {}),
        ...styles,
        class: withClasses(sameType ? node.attrs.class : null, classes),
      });
    }
    return true;
  }
  if (spec.selector) {
    const styles = blockStyles(spec);
    const targets = selectedNodes(state, selectorTags(spec));
    if (!targets.length) return false;
    for (const { node, pos } of targets) {
      const extra = node.type.name === 'image' ? {} : styles;
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...extra,
        class: withClasses(node.attrs.class, classes),
      });
    }
    // Картинка остаётся выделенной.
    if (state.selection instanceof NodeSelection)
      tr.setSelection(NodeSelection.create(tr.doc, state.selection.from));
    return true;
  }
  if (spec.inline) {
    const marks = inlineMarks(state, spec);
    if (!marks.length) return false;
    const { empty, ranges } = state.selection;
    if (empty) {
      let stored = state.storedMarks ?? state.selection.$from.marks();
      for (const mark of marks) stored = mark.addToSet(stored);
      tr.setStoredMarks(stored);
      return true;
    }
    for (const { $from, $to } of ranges) {
      for (const mark of marks) tr.addMark($from.pos, $to.pos, mark);
    }
    return true;
  }
  return false;
}

function removeSpec(state: EditorState, tr: Transaction, spec: FormatSpec): void {
  const classes = classList(spec.classes);
  const nodes = nodesOf(state);

  if (spec.block === 'blockquote') {
    const quote = blockquoteAt(state);
    if (!quote) return;
    const rest = withoutClasses(quote.node.attrs.class, classes);
    // Формат только из классов — снимаем классы; иначе убираем саму цитату.
    if (classes.length && rest !== null) {
      tr.setNodeMarkup(quote.pos, undefined, { ...quote.node.attrs, class: rest });
      return;
    }
    lift(state, (lifted) => lifted.steps.forEach((step) => tr.step(step)));
    return;
  }
  if (spec.block) {
    for (const { node, pos } of textBlocks(state)) {
      if (!BLOCK_TAGS[spec.block]!(node)) continue;
      tr.setNodeMarkup(pos, nodes.paragraph, {
        ...keepBlockStyle(node.attrs),
        class: spec.block === 'p' ? withoutClasses(node.attrs.class, classes) : null,
      });
    }
    return;
  }
  if (spec.selector) {
    const styles = blockStyles(spec);
    for (const { node, pos } of selectedNodes(state, selectorTags(spec))) {
      const reset: Record<string, unknown> = {};
      if (node.type.name !== 'image') {
        if ('align' in styles && node.attrs.align === styles.align) reset.align = null;
        if ('lineHeight' in styles && node.attrs.lineHeight === styles.lineHeight)
          reset.lineHeight = null;
      }
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...reset,
        class: withoutClasses(node.attrs.class, classes),
      });
    }
    if (state.selection instanceof NodeSelection)
      tr.setSelection(NodeSelection.create(tr.doc, state.selection.from));
    return;
  }
  if (spec.inline) {
    const marks = inlineMarks(state, spec);
    const { empty, from, to, $from } = state.selection;
    if (empty) {
      const stored = (state.storedMarks ?? $from.marks()).filter(
        (m) => !marks.some((mark) => markCovers(m, mark)),
      );
      tr.setStoredMarks(stored);
      return;
    }
    for (const mark of marks) {
      if (mark.type.name !== 'span_class') {
        tr.removeMark(from, to, mark.type);
        continue;
      }
      // Убираем только классы формата; остальные классы span остаются.
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isText) return;
        const current = node.marks.find((m) => m.type === mark.type);
        if (!current) return;
        const start = Math.max(pos, from);
        const end = Math.min(pos + node.nodeSize, to);
        tr.removeMark(start, end, mark.type);
        const rest = withoutClasses(current.attrs.class, classList(mark.attrs.class));
        if (rest) tr.addMark(start, end, mark.type.create({ class: rest }));
      });
    }
  }
}
