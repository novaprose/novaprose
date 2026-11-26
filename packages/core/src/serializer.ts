import type { DOMOutputSpec, Fragment, Mark, MarkType, Node as PMNode } from 'prosemirror-model';
import { safeAttr } from './safe-attr';

/**
 * Строковый HTML-сериализатор по toDOM-спекам схемы.
 *
 * Зачем свой, а не DOMSerializer: тот выставляет style через CSSOM (dom.style.cssText),
 * и браузер переписывает значения (#3b82f6 → rgb(59, 130, 246)) — HTML зависит от движка.
 * Строковый вывод детерминирован, работает в Node без DOM (SSR, серверная обработка) и быстрее.
 */

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** Неразрывный пробел выводим как &nbsp;, иначе он неотличим от обычного в разметке. */
const NBSP = new RegExp(String.fromCharCode(0xa0), 'g');

export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(NBSP, '&nbsp;');
}

const NBSP_CHAR = '\u00a0';

/**
 * Пробелы, которые браузер схлопнул бы при разборе HTML, заменяются на неразрывные.
 * В редакторе (white-space: pre-wrap) пользователь видит каждый пробел, а HTML-парсер выбрасывает
 * пробел в начале строки и после <br>, сжимает несколько подряд в один и теряет последний
 * в абзаце. Без этого отступы пробелами и двойные пробелы пропадали бы после сохранения.
 * Возвращает новый текст для текстовых узлов фрагмента (по индексу), если он изменился.
 */
function protectSpaces(fragment: Fragment): Map<number, string> | null {
  let result: Map<number, string> | null = null;
  // «Схлопываемая» позиция: начало строки или сразу после обычного пробела.
  let collapsible = true;
  const count = fragment.childCount;
  for (let i = 0; i < count; i++) {
    const node = fragment.child(i);
    if (!node.isText) {
      // Перенос строки (и блок) начинают новую строку, прочие инлайн-узлы — как обычный символ.
      collapsible = node.type.name === 'hard_break' || !node.isInline;
      continue;
    }
    const text = node.text ?? '';
    if (!text.includes(' ')) {
      collapsible = false;
      continue;
    }
    const lineEndsAfter = i === count - 1 || !fragment.child(i + 1).isInline;
    let out = '';
    for (let k = 0; k < text.length; k++) {
      const ch = text[k]!;
      if (ch !== ' ') {
        out += ch;
        collapsible = false;
      } else if (collapsible || (lineEndsAfter && k === text.length - 1)) {
        out += NBSP_CHAR;
        collapsible = false;
      } else {
        out += ' ';
        collapsible = true;
      }
    }
    if (out !== text) (result ??= new Map()).set(i, out);
  }
  return result;
}

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(NBSP, '&nbsp;');
}

const TAG_RE = /^[a-z][a-z0-9-]*$/i;

// ---------- защита вывода ----------
// Встроенные узлы сами проверяют URL и CSS в toDOM. Узлы и марки плагинов — чужой код, поэтому
// сериализатор проверяет любой вывод ещё раз: это последний рубеж перед HTML, который уйдёт на сервер.

/** Элементы, которые никогда не выводим (их содержимое сохраняется). */
const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'base',
  'link',
  'meta',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
  'template',
  'noscript',
]);
const reported = new Set<string>();
function reportForbidden(tag: string): void {
  if (reported.has(tag)) return;
  reported.add(tag);
  console.error(
    `[nova] toDOM produced <${tag}>, which is not allowed in output; the tag was dropped`,
  );
}
const ATTR_RE = /^[a-z_:][a-z0-9_.:-]*$/i;

interface Rendered {
  open: string;
  close: string;
  /** Есть ли «дыра» (0) для содержимого. */
  hole: boolean;
  /** Статический HTML, если спека без дыры. */
  html: string;
}

/** Рендер DOMOutputSpec в строку. Для узлов-листьев content не используется. */
function renderSpec(spec: DOMOutputSpec): Rendered {
  if (typeof spec === 'string') return { open: '', close: '', hole: false, html: escapeText(spec) };
  // Значения атрибутов из внешнего JSON (число, null) не должны ронять сохранение всего документа.
  // Ноль сюда не попадает: в спеке это «дыра» для содержимого.
  if (typeof spec === 'number' || typeof spec === 'boolean') {
    return { open: '', close: '', hole: false, html: escapeText(String(spec)) };
  }
  if (spec == null) return { open: '', close: '', hole: false, html: '' };
  if (!Array.isArray(spec)) {
    throw new Error('[nova] serializer supports only array/string toDOM specs');
  }
  const [rawTag, ...rest] = spec as unknown as [string, ...unknown[]];
  // 'ns tag' — пространство имён (svg и т.п.); в HTML-строке достаточно имени тега.
  const tag = rawTag.includes(' ') ? rawTag.split(' ')[1]! : rawTag;
  if (!TAG_RE.test(tag)) throw new Error(`[nova] invalid tag in toDOM: ${tag}`);
  const forbidden = FORBIDDEN_TAGS.has(tag.toLowerCase());
  if (forbidden) reportForbidden(tag.toLowerCase());

  let attrs = '';
  let children = rest;
  const first = rest[0];
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    for (const [name, value] of Object.entries(first as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      const attrName = name.includes(' ') ? name.split(' ')[1]! : name;
      if (!ATTR_RE.test(attrName)) continue;
      const safe = safeAttr(attrName, String(value));
      if (safe === null) continue;
      attrs += ` ${attrName}="${escapeAttr(safe)}"`;
    }
    children = rest.slice(1);
  }

  const open = forbidden ? '' : `<${tag}${attrs}>`;
  if (VOID_ELEMENTS.has(tag.toLowerCase())) return { open, close: '', hole: false, html: open };

  // Всё, что до «дыры» (0), идёт в open, после — в close.
  // Дыра может быть вложенной: ['pre', ['code', 0]] — тогда содержимое внутри <code>.
  let before = '';
  let after = '';
  let hole = false;
  for (const child of children) {
    if (child === 0) {
      if (hole) throw new Error('[nova] toDOM spec has more than one content hole');
      hole = true;
      continue;
    }
    const inner = renderSpec(child as DOMOutputSpec);
    if (hole) {
      if (inner.hole) throw new Error('[nova] toDOM spec has more than one content hole');
      after += inner.html;
    } else if (inner.hole) {
      before += inner.open;
      after += inner.close;
      hole = true;
    } else {
      before += inner.html;
    }
  }
  if (forbidden) {
    // Ни сам тег, ни его статическое содержимое (текст скрипта, CSS) не выводим — только документ.
    return { open: '', close: '', hole, html: '' };
  }
  const close = `</${tag}>`;
  return { open: open + before, close: after + close, hole, html: open + before + after + close };
}

export class HTMLSerializer {
  /**
   * Кэш отрисовки марок — свой у каждого типа марки: сериализатор общий для всех редакторов страницы,
   * а вывод одноимённой марки зависит от схемы редактора (правила атрибутов, плагины).
   */
  private readonly cache = new WeakMap<MarkType, Map<string, Rendered>>();

  serializeFragment(fragment: Fragment, { pre = false }: { pre?: boolean } = {}): string {
    const texts = pre ? null : protectSpaces(fragment);
    let out = '';
    let active: Mark[] = [];
    let closers: string[] = [];

    const closeTo = (keep: number) => {
      while (active.length > keep) {
        out += closers.pop()!;
        active.pop();
      }
    };

    fragment.forEach((node, _offset, index) => {
      if (!node.isInline) {
        closeTo(0);
        out += this.serializeNode(node);
        return;
      }
      // Общий префикс уже открытых марок сохраняем, остальное закрываем и открываем заново —
      // так соседние узлы с одинаковой разметкой не дробятся (<strong>a<em>b</em></strong>).
      let keep = 0;
      while (
        keep < active.length &&
        keep < node.marks.length &&
        active[keep]!.eq(node.marks[keep]!)
      )
        keep++;
      closeTo(keep);
      for (let i = keep; i < node.marks.length; i++) {
        const mark = node.marks[i]!;
        const r = this.renderMark(mark, node.isText);
        out += r.open;
        closers.push(r.close);
        active.push(mark);
      }
      out += node.isText
        ? escapeText(texts?.get(index) ?? node.text ?? '')
        : this.serializeNode(node);
    });
    closeTo(0);
    active = [];
    closers = [];
    return out;
  }

  serializeNode(node: PMNode): string {
    const toDOM = node.type.spec.toDOM;
    if (!toDOM) throw new Error(`[nova] node "${node.type.name}" has no toDOM`);
    const r = renderSpec(toDOM(node));
    if (!r.hole) return r.html;
    // В коде (pre) пробелы сохраняются браузером как есть — защищать их не нужно.
    const pre = !!node.type.spec.code || node.type.spec.whitespace === 'pre';
    return r.open + this.serializeFragment(node.content, { pre }) + r.close;
  }

  private renderMark(mark: Mark, inline: boolean): Rendered {
    const toDOM = mark.type.spec.toDOM;
    if (!toDOM) throw new Error(`[nova] mark "${mark.type.name}" has no toDOM`);
    let cache = this.cache.get(mark.type);
    if (!cache) this.cache.set(mark.type, (cache = new Map()));
    const key = JSON.stringify(mark.attrs);
    let r = cache.get(key);
    if (!r) {
      r = renderSpec(toDOM(mark, inline));
      if (cache.size > 500) cache.clear();
      cache.set(key, r);
    }
    return r;
  }
}
