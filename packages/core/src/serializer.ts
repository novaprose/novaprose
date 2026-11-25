import type { DOMOutputSpec, Fragment, Mark, Node as PMNode } from 'prosemirror-model';
import { isSafeImageUrl, isSafeLinkUrl } from './url';

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
const LINK_ATTRS = new Set(['href', 'xlink:href', 'action', 'formaction', 'cite']);
const RESOURCE_ATTRS = new Set(['src', 'poster', 'data', 'background']);
const UNSAFE_CSS = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding/i;

/** Значение атрибута, если оно безопасно, иначе null (атрибут не выводится). */
function safeAttr(name: string, value: string): string | null {
  const lower = name.toLowerCase();
  if (lower.startsWith('on')) return null;
  if (LINK_ATTRS.has(lower)) return isSafeLinkUrl(value) ? value : null;
  if (RESOURCE_ATTRS.has(lower)) return isSafeImageUrl(value) ? value : null;
  if (lower === 'srcset') {
    const urls = value.split(',').map((part) => part.trim().split(/\s+/)[0] ?? '');
    return urls.every((url) => isSafeImageUrl(url)) ? value : null;
  }
  if (lower === 'style') return UNSAFE_CSS.test(value) ? null : value;
  return value;
}

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
  private readonly cache = new Map<string, Rendered>();

  serializeFragment(fragment: Fragment): string {
    let out = '';
    let active: Mark[] = [];
    let closers: string[] = [];

    const closeTo = (keep: number) => {
      while (active.length > keep) {
        out += closers.pop()!;
        active.pop();
      }
    };

    fragment.forEach((node) => {
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
      out += node.isText ? escapeText(node.text ?? '') : this.serializeNode(node);
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
    return r.open + this.serializeFragment(node.content) + r.close;
  }

  private renderMark(mark: Mark, inline: boolean): Rendered {
    const toDOM = mark.type.spec.toDOM;
    if (!toDOM) throw new Error(`[nova] mark "${mark.type.name}" has no toDOM`);
    const key = `${mark.type.name}:${JSON.stringify(mark.attrs)}`;
    let r = this.cache.get(key);
    if (!r) {
      r = renderSpec(toDOM(mark, inline));
      if (this.cache.size > 500) this.cache.clear();
      this.cache.set(key, r);
    }
    return r;
  }
}
