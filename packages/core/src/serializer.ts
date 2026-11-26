import type { DOMOutputSpec, Fragment, Mark, MarkType, Node as PMNode } from 'prosemirror-model';
import { safeAttr } from './safe-attr';

/**
 * A string HTML serializer driven by the schema's toDOM specs.
 *
 * Why our own instead of DOMSerializer: that one sets style through the CSSOM (dom.style.cssText),
 * and the browser rewrites the values (#3b82f6 → rgb(59, 130, 246)), so the HTML depends on the engine.
 * String output is deterministic, works in Node without a DOM (SSR, server processing) and is faster.
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

/** A non-breaking space is output as &nbsp;, otherwise it is indistinguishable from a regular one in the markup. */
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
 * Spaces that a browser would collapse when parsing the HTML are replaced with non-breaking ones.
 * In the editor (white-space: pre-wrap) the user sees every space, but the HTML parser drops
 * a space at the start of a line and after <br>, squeezes several in a row into one and loses the last one
 * in a paragraph. Without this, indents made of spaces and double spaces would disappear after saving.
 * Returns the new text for the fragment's text nodes (by index) when it changed.
 */
function protectSpaces(fragment: Fragment): Map<number, string> | null {
  let result: Map<number, string> | null = null;
  // A "collapsible" position: the start of a line or right after a regular space.
  let collapsible = true;
  const count = fragment.childCount;
  for (let i = 0; i < count; i++) {
    const node = fragment.child(i);
    if (!node.isText) {
      // A line break (and a block) starts a new line; other inline nodes count as a regular character.
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

// ---------- output protection ----------
// Built-in nodes check URLs and CSS in toDOM themselves. Plugin nodes and marks are someone else's code, so
// the serializer checks all output once more: it is the last line of defense before HTML goes to the server.

/** Elements that are never output (their content is kept). */
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
  /** Whether there is a "hole" (0) for the content. */
  hole: boolean;
  /** Static HTML when the spec has no hole. */
  html: string;
}

/** Renders a DOMOutputSpec into a string. Leaf nodes don't use content. */
function renderSpec(spec: DOMOutputSpec): Rendered {
  if (typeof spec === 'string') return { open: '', close: '', hole: false, html: escapeText(spec) };
  // Attribute values from external JSON (a number, null) must not break saving the whole document.
  // Zero never gets here: in a spec it is the "hole" for the content.
  if (typeof spec === 'number' || typeof spec === 'boolean') {
    return { open: '', close: '', hole: false, html: escapeText(String(spec)) };
  }
  if (spec == null) return { open: '', close: '', hole: false, html: '' };
  if (!Array.isArray(spec)) {
    throw new Error('[nova] serializer supports only array/string toDOM specs');
  }
  const [rawTag, ...rest] = spec as unknown as [string, ...unknown[]];
  // 'ns tag' is a namespace (svg and the like); the tag name is enough in an HTML string.
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

  // Everything before the "hole" (0) goes into open, everything after into close.
  // The hole can be nested: ['pre', ['code', 0]] puts the content inside <code>.
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
    // Neither the tag nor its static content (script text, CSS) is output: only the document.
    return { open: '', close: '', hole, html: '' };
  }
  const close = `</${tag}>`;
  return { open: open + before, close: after + close, hole, html: open + before + after + close };
}

export class HTMLSerializer {
  /**
   * A cache of rendered marks, separate for each mark type: the serializer is shared by every editor
   * on the page, while a mark's output depends on the editor's schema (attribute rules, plugins).
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
      // The common prefix of already open marks is kept, the rest is closed and reopened,
      // so neighboring nodes with the same markup don't fragment (<strong>a<em>b</em></strong>).
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
    // Inside code (pre) the browser keeps spaces as they are: no need to protect them.
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
