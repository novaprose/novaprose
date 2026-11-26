/**
 * Rules for HTML elements and attributes: validElements (with attributes), extendedValidElements and
 * customElements. The syntax is that of the TinyMCE options with the same names (from their public
 * documentation): `a[href|title],div[class|data-*],@[id],my-widget`.
 *
 * Two directions:
 *  1. Restricting. A list in [...] is the complete list of an element's attributes: `a[href|title]`
 *     drops target and class. Values: `name=v` — default, `name:v` — always, `name<a?b` — only from
 *     the list, `!name` — required (an element without it is not recognized). `@[...]` and `*[...]`
 *     apply to all elements.
 *  2. Extending. Attributes the built-in schema doesn't know (`h2[id]`, `a[rel|data-*]`) are kept in
 *     the node attribute `htmlAttrs`. New elements (`div`, `section`, `abbr`, `<i class>` for icons,
 *     your own `my-widget`) become generic nodes html_block / html_textblock / html_inline_atom and
 *     the mark html_inline with a `tag` attribute.
 *
 * Rules never switch security off: script, iframe, forms and the like are not allowed, on* handlers,
 * srcdoc and formaction are never kept, and addresses and CSS are checked when parsing and when
 * writing (a document can arrive as JSON, bypassing the parser).
 */
import type { DOMOutputSpec, MarkSpec, NodeSpec, ParseRule, Schema } from 'prosemirror-model';
import {
  OWN_STYLE,
  type HtmlRulesInstance,
  type HtmlRulesModule,
  type HtmlRulesOptions,
  type SchemaSpecs,
} from './html-rules-api';
import { safeAttr } from './safe-attr';

export type { HtmlRulesOptions };

interface AttrRule {
  name: string;
  required: boolean;
  def?: string;
  forced?: string;
  values?: string[];
}

/** Elements that no rule allows. */
const NEVER = new Set(
  (
    'script,style,iframe,frame,frameset,object,embed,applet,base,link,meta,title,head,html,body,' +
    'template,slot,noscript,form,input,button,select,option,optgroup,textarea,fieldset,legend,' +
    'datalist,output,progress,meter,svg,math,canvas,audio,video,source,track,picture,map,area,' +
    'portal,dialog,param,xmp,plaintext,listing,noembed,noframes,image'
  ).split(','),
);
/** Attributes that no rule keeps (including "*"). */
const NEVER_ATTR =
  /^(on|xmlns)|^(srcdoc|formaction|action|contenteditable|autofocus|is|slot|nonce)$/;
const ATTR_NAME = /^[a-z_:][a-z0-9_.:-]*$/;
const TAG_NAME = /^[a-z][a-z0-9._-]*$/;

/** Elements of the built-in schema (their attributes can be restricted and extended). */
export const BASE_TAGS = new Set(
  'p,h1,h2,h3,h4,h5,h6,blockquote,pre,hr,ul,ol,li,img,figure,figcaption,br,table,tr,td,th,strong,em,u,s,code,a,sub,sup'.split(
    ',',
  ),
);
/** Built-in synonyms: they become a separate element only when they have allowed attributes. */
const SPLIT = new Set(['span', 'i', 'b', 'del', 'strike', 'mark']);
const INLINE = new Set(
  'abbr,acronym,bdi,bdo,big,cite,data,dfn,ins,kbd,q,samp,small,time,tt,var,label,ruby,rt,rp,wbr'.split(
    ',',
  ),
);
const BLOCK = new Set(
  'div,section,article,aside,header,footer,nav,main,address,details,summary,dl,dt,dd,center,hgroup,search'.split(
    ',',
  ),
);
/** HTML block elements: by them the generic block chooses "container" or "text block". */
const BLOCK_LEVEL = new Set([
  ...BLOCK,
  ...'p,h1,h2,h3,h4,h5,h6,blockquote,pre,hr,ul,ol,li,table,figure'.split(','),
]);
/** A built-in element doesn't work without these attributes, so the list in [...] doesn't remove them. */
const ESSENTIAL: Record<string, string[]> = {
  a: ['href'],
  ul: ['data-type'],
  li: ['data-type', 'data-checked'],
  img: ['src'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '[') depth++;
    else if (ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && !depth) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseAttr(raw: string): AttrRule | null {
  let text = raw.trim();
  const required = text.startsWith('!');
  if (required) text = text.slice(1);
  const m = /^([^=:<]+)(?:([=:<])(.*))?$/s.exec(text);
  if (!m) return null;
  const name = m[1]!.trim().toLowerCase();
  if (!name) return null;
  const rule: AttrRule = { name, required };
  const value = m[3] ?? '';
  if (m[2] === '=') rule.def = value;
  else if (m[2] === ':') rule.forced = value;
  else if (m[2] === '<') rule.values = value.split('?');
  return rule;
}

function matches(pattern: string, name: string): boolean {
  if (pattern === '*') return true;
  return pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : pattern === name;
}

const warned = new Set<string>();
function warn(tag: string, reason: string): void {
  if (warned.has(tag)) return;
  warned.add(tag);
  console.warn(`[nova] <${tag}> in content rules is ignored: ${reason}`);
}

type Attrs = Record<string, unknown>;

export class HtmlRules implements HtmlRulesInstance {
  /** The element's attribute list (null — no list given, built-in attributes). */
  private readonly elements = new Map<string, AttrRule[] | null>();
  private readonly globals: AttrRule[] = [];
  /** Generic elements: tag in the input HTML → tag in the output (synonyms like `div/section`). */
  readonly blockTags = new Map<string, string>();
  readonly inlineTags = new Map<string, string>();

  constructor(options: HtmlRulesOptions) {
    const invalid = new Set(
      (options.invalidElements ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    const inlineCustom = new Set<string>();
    const custom = new Set<string>();
    for (const raw of (options.customElements ?? '').split(',')) {
      const name = raw.trim().toLowerCase();
      const tag = name.replace(/^~/, '');
      if (!TAG_NAME.test(tag)) continue;
      if (NEVER.has(tag) || BASE_TAGS.has(tag)) {
        warn(tag, 'it cannot be a custom element');
        continue;
      }
      custom.add(tag);
      if (name.startsWith('~')) inlineCustom.add(tag);
    }

    const declare = (names: string[], attrs: AttrRule[] | null): void => {
      const [main, ...aliases] = names;
      if (!main) return;
      if (main === '@' || main === '*') {
        this.globals.push(...(attrs ?? []));
        return;
      }
      for (const tag of names) {
        if (!TAG_NAME.test(tag) || invalid.has(tag)) continue;
        if (NEVER.has(tag)) {
          warn(tag, 'not allowed for security reasons (iframes and video: use the media plugin)');
          continue;
        }
        // An element's rule replaces the previous one entirely (extended replaces valid).
        this.elements.set(tag, attrs);
        const output = BASE_TAGS.has(tag) || SPLIT.has(tag) ? tag : main;
        if (BASE_TAGS.has(tag)) continue;
        if (SPLIT.has(tag)) {
          // `em/i` is a regular synonym; `i[class]` is a separate element (icons) when it has attributes.
          if (tag === main && attrs?.length) this.inlineTags.set(tag, tag);
          continue;
        }
        const isCustom = custom.has(tag) || custom.has(main) || tag.includes('-');
        if (INLINE.has(main) || inlineCustom.has(main)) this.inlineTags.set(tag, output);
        else if (BLOCK.has(main) || isCustom) this.blockTags.set(tag, output);
        else if (!aliases.includes(tag) || tag === main) warn(tag, 'unknown element');
      }
    };

    // validElements: only the attribute list (which elements are allowed is decided by ContentRules).
    for (const raw of splitTopLevel(options.validElements ?? '')) {
      const { names, attrs } = parseRule(raw);
      if (attrs) declare(names, attrs);
      else if (!names.every((n) => BASE_TAGS.has(n) || SPLIT.has(n))) declare(names, null);
    }
    for (const raw of splitTopLevel(options.extendedValidElements ?? '')) {
      const { names, attrs } = parseRule(raw);
      declare(names, attrs);
    }
    // Custom elements without a rule keep every safe attribute.
    for (const tag of custom) {
      if (invalid.has(tag)) continue;
      if (!this.elements.has(tag)) this.elements.set(tag, [{ name: '*', required: false }]);
      if (inlineCustom.has(tag)) this.inlineTags.set(tag, tag);
      else if (!this.inlineTags.has(tag)) this.blockTags.set(tag, tag);
    }
  }

  apply(specs: SchemaSpecs, ref: { schema?: Schema }): SchemaSpecs {
    return applyHtmlRules(specs.nodes, specs.marks, this, ref);
  }

  /** Whether there is anything to apply (otherwise the editor does without this module). */
  get active(): boolean {
    return this.elements.size > 0 || this.globals.length > 0;
  }

  /** Whether the rules concern the element: an attribute list, values or common attributes. */
  touches(tag: string): boolean {
    return this.globals.length > 0 || this.elements.has(tag);
  }

  private rulesFor(tag: string): AttrRule[] {
    return [...(this.elements.get(tag) ?? []), ...this.globals];
  }

  /** Whether the rule allows an attribute (not counting the element's built-in attributes). */
  allows(tag: string, name: string): boolean {
    if (NEVER_ATTR.test(name) || !ATTR_NAME.test(name)) return false;
    return this.rulesFor(tag).some((rule) => matches(rule.name, name));
  }

  /** Whether a built-in element may have attributes beyond its built-in ones (except class and style). */
  extends(tag: string): boolean {
    return this.rulesFor(tag).some((rule) => rule.name !== 'class' && rule.name !== 'style');
  }

  /** Whether the rules allow class on any built-in element (then classes are kept). */
  get classOnBuiltIn(): boolean {
    if (this.globals.some((r) => matches(r.name, 'class'))) return true;
    for (const [tag, attrs] of this.elements) {
      if (BASE_TAGS.has(tag) && attrs?.some((r) => matches(r.name, 'class'))) return true;
    }
    return false;
  }

  /** All required attributes are present. */
  hasRequired(tag: string, dom: HTMLElement): boolean {
    return this.rulesFor(tag).every((rule) => !rule.required || dom.hasAttribute(rule.name));
  }

  /**
   * The element's attributes allowed by the rule (values checked), or null. `skip` — attributes the
   * element itself doesn't keep: class and style of built-in elements (validClasses, validStyles,
   * formatting marks). The parser moves the own style of new elements to OWN_STYLE (see parser.ts).
   */
  readAttrs(tag: string, dom: HTMLElement, skip: readonly string[]): Record<string, string> | null {
    let out: Record<string, string> | null = null;
    for (const attr of Array.from(dom.attributes)) {
      let name = attr.name.toLowerCase();
      if (name === OWN_STYLE) name = 'style';
      if (skip.includes(name) || !this.allows(tag, name)) continue;
      const value = safeAttr(name, attr.value);
      if (value !== null) (out ??= {})[name] = value;
    }
    return out;
  }

  /**
   * Attributes for output: built-in ones plus kept ones (`extras`, which may have come from JSON as
   * anything), then the element's list and the value rules.
   */
  outputAttrs(tag: string, builtIn: Attrs, extras: unknown): Attrs {
    // Built-in first, then the kept ones: the order doesn't depend on where the value came from.
    const out: Attrs = { ...builtIn };
    if (extras && typeof extras === 'object' && !Array.isArray(extras)) {
      for (const [raw, value] of Object.entries(extras as Attrs)) {
        const name = raw.toLowerCase();
        if (out[name] != null || !this.allows(tag, name)) continue;
        if (!['string', 'number', 'boolean'].includes(typeof value)) continue;
        const safe = safeAttr(name, String(value));
        if (safe !== null) out[name] = safe;
      }
    }
    const list = this.elements.get(tag);
    if (list) {
      for (const name of Object.keys(out)) {
        if (this.allows(tag, name) || ESSENTIAL[tag]?.includes(name)) continue;
        if (name.startsWith('data-nova-')) continue;
        delete out[name];
      }
    }
    for (const rule of this.rulesFor(tag)) {
      if (rule.name.includes('*')) continue;
      if (rule.forced !== undefined) out[rule.name] = rule.forced;
      else if (rule.def !== undefined && out[rule.name] == null) out[rule.name] = rule.def;
      const value = out[rule.name];
      if (rule.values && value != null && !rule.values.includes(String(value))) {
        delete out[rule.name];
      }
    }
    // A link in a new tab gets no access to the source page (as with the built-in link).
    if (tag === 'a' && out.target != null && out.rel == null) out.rel = 'noopener noreferrer';
    return out;
  }

  /** Apply the rules to toDOM output: attributes of the spec's top element. */
  decorate(spec: DOMOutputSpec, extras: unknown): DOMOutputSpec {
    if (!Array.isArray(spec) || typeof spec[0] !== 'string') return spec;
    const raw = spec[0] as string;
    const tag = (raw.includes(' ') ? raw.split(' ')[1]! : raw).toLowerCase();
    if (!this.touches(tag)) return spec;
    const second = spec[1] as unknown;
    const hasAttrs =
      !!second &&
      typeof second === 'object' &&
      !Array.isArray(second) &&
      (second as { nodeType?: unknown }).nodeType === undefined;
    const attrs = this.outputAttrs(tag, hasAttrs ? (second as Attrs) : {}, extras);
    return [raw, attrs, ...(spec as unknown[]).slice(hasAttrs ? 2 : 1)] as unknown as DOMOutputSpec;
  }
}

function parseRule(raw: string): { names: string[]; attrs: AttrRule[] | null } {
  const m = /^([^[]*)(?:\[(.*)\])?$/s.exec(raw.trim());
  const names = (m?.[1] ?? '')
    .trim()
    .replace(/^[-#+!]+/, '')
    .split('/')
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  const list = m?.[2];
  const attrs =
    list === undefined
      ? null
      : list
          .split('|')
          .map(parseAttr)
          .filter((a): a is AttrRule => a !== null);
  return { names, attrs };
}

/** Rules from the options, or null when there is nothing to apply. */
export function createHtmlRules(options: HtmlRulesOptions): HtmlRules | null {
  if (!options.validElements && !options.extendedValidElements && !options.customElements) {
    return null;
  }
  const rules = new HtmlRules(options);
  return rules.active ? rules : null;
}

// ---------- schema ----------

type Spec = NodeSpec | MarkSpec;
interface SchemaRef {
  schema?: Schema;
}

const tagOf = (selector: string): string =>
  (/^[a-z][a-z0-9-]*/i.exec(selector)?.[0] ?? '').toLowerCase();

/** Attribute names that the built-in toDOM (the original one, without rules) outputs itself for these attrs. */
function producedNames(
  ref: SchemaRef,
  kind: 'node' | 'mark',
  name: string,
  attrs: Attrs,
  toDOM: (value: unknown, inline?: boolean) => DOMOutputSpec,
): string[] {
  try {
    const schema = ref.schema!;
    const spec =
      kind === 'node'
        ? toDOM(schema.nodes[name]!.create(attrs))
        : toDOM(schema.marks[name]!.create(attrs), true);
    const second = Array.isArray(spec) ? (spec[1] as unknown) : null;
    return second && typeof second === 'object' && !Array.isArray(second)
      ? Object.keys(second)
      : [];
  } catch {
    return [];
  }
}

/** A built-in node/mark with attribute rules. */
function wrapBase<T extends Spec>(
  name: string,
  spec: T,
  kind: 'node' | 'mark',
  rules: HtmlRules,
  ref: SchemaRef,
): T {
  const tags = (spec.parseDOM ?? [])
    .map((rule) => (rule.tag ? tagOf(rule.tag) : ''))
    .filter((tag) => BASE_TAGS.has(tag) && rules.touches(tag));
  if (!tags.length || !spec.toDOM) return spec;
  const withExtras = tags.some((tag) => rules.extends(tag));
  const toDOM = spec.toDOM as (value: unknown, inline?: boolean) => DOMOutputSpec;
  return {
    ...spec,
    ...(withExtras ? { attrs: { ...spec.attrs, htmlAttrs: { default: null } } } : {}),
    parseDOM: spec.parseDOM!.map((rule): ParseRule => {
      const tag = rule.tag ? tagOf(rule.tag) : '';
      if (!tags.includes(tag)) return rule;
      const getAttrs = rule.getAttrs as ((dom: HTMLElement) => Attrs | false | null) | undefined;
      return {
        ...rule,
        getAttrs: (dom: HTMLElement) => {
          const base = getAttrs ? getAttrs(dom) : (rule.attrs ?? null);
          if (base === false || !rules.hasRequired(tag, dom)) return false;
          if (!withExtras) return base;
          const extras = rules.readAttrs(tag, dom, ['class', 'style']);
          if (!extras) return base;
          // What the built-in node outputs itself isn't duplicated in extras, otherwise an outdated value
          // would come back after the user removes it.
          for (const produced of producedNames(ref, kind, name, { ...base }, toDOM)) {
            delete extras[produced];
          }
          return Object.keys(extras).length ? { ...base, htmlAttrs: extras } : base;
        },
      } as ParseRule;
    }) as T['parseDOM'],
    toDOM: ((value: { attrs: Attrs }, inline?: boolean) =>
      rules.decorate(toDOM(value, inline), value.attrs.htmlAttrs)) as T['toDOM'],
  };
}

function hasBlockChild(dom: HTMLElement, rules: HtmlRules): boolean {
  return Array.from(dom.children).some((child) => {
    const tag = child.localName;
    return BLOCK_LEVEL.has(tag) || rules.blockTags.has(tag);
  });
}

/** Nodes and marks for new elements. */
function genericSpecs(rules: HtmlRules): {
  nodes: Record<string, NodeSpec>;
  marks: Record<string, MarkSpec>;
} {
  const nodes: Record<string, NodeSpec> = {};
  const marks: Record<string, MarkSpec> = {};
  /**
   * For synonyms of built-in elements (span, i, mark…) the formatting marks parse style, so it isn't
   * duplicated; class on a non-empty span is the class mark. A synonym without its own attributes is the built-in one.
   */
  const read = (output: string, dom: HTMLElement, mark: boolean) => {
    if (!rules.hasRequired(output, dom)) return false;
    const split = SPLIT.has(output);
    const skip = !split ? [] : mark && output === 'span' ? ['class', 'style'] : ['style'];
    const htmlAttrs = rules.readAttrs(output, dom, skip);
    if (split && !htmlAttrs) return false;
    return { tag: output, htmlAttrs };
  };
  // Tags whose style stays on the element itself instead of turning into marks (see parser.ts).
  const ownStyle = (tags: Map<string, string>) =>
    [...tags].filter(([, output]) => !SPLIT.has(output)).map(([input]) => input);
  const out = (allowed: Set<string>, fallback: string, attrs: Attrs) => {
    const tag = typeof attrs.tag === 'string' && allowed.has(attrs.tag) ? attrs.tag : fallback;
    return { tag, attrs: rules.outputAttrs(tag, {}, attrs.htmlAttrs) };
  };

  const blocks = [...rules.blockTags];
  if (blocks.length) {
    const allowed = new Set(rules.blockTags.values());
    const fallback = allowed.has('div') ? 'div' : [...allowed][0]!;
    const attrs = { tag: { default: fallback }, htmlAttrs: { default: null } };
    nodes.html_block = {
      ownStyleTags: ownStyle(rules.blockTags),
      group: 'block',
      content: 'block+',
      defining: true,
      attrs,
      parseDOM: blocks.map(([input, output]) => ({
        tag: input,
        getAttrs: (dom: HTMLElement) =>
          hasBlockChild(dom, rules) ? read(output, dom, false) : false,
      })),
      toDOM: (node) => {
        const { tag, attrs: a } = out(allowed, fallback, node.attrs);
        return [tag, a, 0];
      },
    };
    nodes.html_textblock = {
      group: 'block',
      content: 'inline*',
      attrs,
      parseDOM: blocks.map(([input, output]) => ({
        tag: input,
        getAttrs: (dom: HTMLElement) =>
          hasBlockChild(dom, rules) ? false : read(output, dom, false),
      })),
      toDOM: (node) => {
        const { tag, attrs: a } = out(allowed, fallback, node.attrs);
        return [tag, a, 0];
      },
    };
  }

  const inline = [...rules.inlineTags];
  if (inline.length) {
    const allowed = new Set(rules.inlineTags.values());
    const fallback = allowed.has('span') ? 'span' : [...allowed][0]!;
    const attrs = { tag: { default: fallback }, htmlAttrs: { default: null } };
    // An empty element (an icon `<i class="fa fa-star"></i>`) is an atomic node: a mark would have nothing to wrap.
    nodes.html_inline_atom = {
      ownStyleTags: ownStyle(rules.inlineTags),
      group: 'inline',
      inline: true,
      atom: true,
      attrs,
      parseDOM: inline.map(([input, output]) => ({
        tag: input,
        // Before marks of the same tag (it has 60) and built-in marks (italic for <i>).
        priority: 65,
        getAttrs: (dom: HTMLElement) => (dom.firstChild ? false : read(output, dom, false)),
      })),
      toDOM: (node) => {
        const { tag, attrs: a } = out(allowed, fallback, node.attrs);
        return [tag, a];
      },
    };
    marks.html_inline = {
      attrs,
      // Different elements (abbr inside kbd) are instances of one mark and must not push each other out.
      excludes: '',
      parseDOM: inline.map(([input, output]) => ({
        tag: input,
        // span: after class marks and plugin nodes (they parse their own spans earlier).
        priority: output === 'span' ? 40 : 60,
        getAttrs: (dom: HTMLElement) => (dom.firstChild ? read(output, dom, true) : false),
      })),
      toDOM: (mark) => {
        const { tag, attrs: a } = out(allowed, fallback, mark.attrs);
        return [tag, a, 0];
      },
    };
  }
  return { nodes, marks };
}

/**
 * Apply the rules to the schema specs: built-in nodes and marks get attribute rules, new elements
 * get their own nodes and marks (at the end, so built-in parse rules keep priority). After the schema
 * is created, store it in `ref.schema`.
 */
export function applyHtmlRules(
  nodes: Record<string, NodeSpec>,
  marks: Record<string, MarkSpec>,
  rules: HtmlRules,
  ref: SchemaRef,
): { nodes: Record<string, NodeSpec>; marks: Record<string, MarkSpec> } {
  const wrap = <T extends Spec>(specs: Record<string, T>, kind: 'node' | 'mark') =>
    Object.fromEntries(
      Object.entries(specs).map(([name, spec]) => [name, wrapBase(name, spec, kind, rules, ref)]),
    );
  const generic = genericSpecs(rules);
  return {
    nodes: { ...wrap(nodes, 'node'), ...generic.nodes },
    marks: { ...wrap(marks, 'mark'), ...generic.marks },
  };
}

/**
 * The module to register in the core:
 *
 *   import { registerHtmlRules } from '@novaprose/core';
 *   import { htmlRules } from '@novaprose/core/html-rules';
 *   registerHtmlRules(htmlRules);
 */
export const htmlRules: HtmlRulesModule = { create: createHtmlRules };
