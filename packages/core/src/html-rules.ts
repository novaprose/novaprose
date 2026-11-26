/**
 * Правила HTML-элементов и атрибутов: validElements (с атрибутами), extendedValidElements и
 * customElements. Синтаксис — как у одноимённых опций TinyMCE (по их публичной документации):
 * `a[href|title],div[class|data-*],@[id],my-widget`.
 *
 * Два направления:
 *  1. Ограничение. Список в [...] — полный список атрибутов элемента: `a[href|title]` снимает
 *     target и class. Значения: `name=v` — по умолчанию, `name:v` — всегда, `name<a?b` — только из
 *     списка, `!name` — обязателен (без него элемент не распознаётся). `@[...]` и `*[...]` — для всех.
 *  2. Расширение. Атрибуты, которых встроенная схема не знает (`h2[id]`, `a[rel|data-*]`), хранятся в
 *     атрибуте узла `htmlAttrs`. Новые элементы (`div`, `section`, `abbr`, `<i class>` для иконок,
 *     свои `my-widget`) — универсальные узлы html_block / html_textblock / html_inline_atom и марка
 *     html_inline с атрибутом `tag`.
 *
 * Безопасность правилами не отключается: script, iframe, формы и т. п. не разрешаются, обработчики
 * on*, srcdoc и formaction не сохраняются, адреса и CSS проверяются при разборе и при выводе
 * (документ может прийти через JSON в обход разбора).
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

/** Элементы, которые не разрешаются никаким правилом. */
const NEVER = new Set(
  (
    'script,style,iframe,frame,frameset,object,embed,applet,base,link,meta,title,head,html,body,' +
    'template,slot,noscript,form,input,button,select,option,optgroup,textarea,fieldset,legend,' +
    'datalist,output,progress,meter,svg,math,canvas,audio,video,source,track,picture,map,area,' +
    'portal,dialog,param,xmp,plaintext,listing,noembed,noframes,image'
  ).split(','),
);
/** Атрибуты, которые не сохраняются никаким правилом (в т.ч. «*»). */
const NEVER_ATTR =
  /^(on|xmlns)|^(srcdoc|formaction|action|contenteditable|autofocus|is|slot|nonce)$/;
const ATTR_NAME = /^[a-z_:][a-z0-9_.:-]*$/;
const TAG_NAME = /^[a-z][a-z0-9._-]*$/;

/** Элементы встроенной схемы (их атрибуты можно ограничить и расширить). */
export const BASE_TAGS = new Set(
  'p,h1,h2,h3,h4,h5,h6,blockquote,pre,hr,ul,ol,li,img,figure,figcaption,br,table,tr,td,th,strong,em,u,s,code,a,sub,sup'.split(
    ',',
  ),
);
/** Встроенные синонимы: становятся отдельным элементом, только если у них есть разрешённые атрибуты. */
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
/** Блочные элементы HTML: по ним универсальный блок выбирает «контейнер» или «текстовый блок». */
const BLOCK_LEVEL = new Set([
  ...BLOCK,
  ...'p,h1,h2,h3,h4,h5,h6,blockquote,pre,hr,ul,ol,li,table,figure'.split(','),
]);
/** Без этих атрибутов встроенный элемент не работает — их список в [...] не снимает. */
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
  /** Список атрибутов элемента (null — список не задан, атрибуты встроенные). */
  private readonly elements = new Map<string, AttrRule[] | null>();
  private readonly globals: AttrRule[] = [];
  /** Универсальные элементы: тег во входном HTML → тег на выходе (синонимы `div/section`). */
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
        // Правило элемента целиком заменяет прежнее (extended заменяет valid).
        this.elements.set(tag, attrs);
        const output = BASE_TAGS.has(tag) || SPLIT.has(tag) ? tag : main;
        if (BASE_TAGS.has(tag)) continue;
        if (SPLIT.has(tag)) {
          // `em/i` — обычный синоним; `i[class]` — отдельный элемент (иконки), если есть атрибуты.
          if (tag === main && attrs?.length) this.inlineTags.set(tag, tag);
          continue;
        }
        const isCustom = custom.has(tag) || custom.has(main) || tag.includes('-');
        if (INLINE.has(main) || inlineCustom.has(main)) this.inlineTags.set(tag, output);
        else if (BLOCK.has(main) || isCustom) this.blockTags.set(tag, output);
        else if (!aliases.includes(tag) || tag === main) warn(tag, 'unknown element');
      }
    };

    // validElements: только список атрибутов (что разрешено из элементов — решает ContentRules).
    for (const raw of splitTopLevel(options.validElements ?? '')) {
      const { names, attrs } = parseRule(raw);
      if (attrs) declare(names, attrs);
      else if (!names.every((n) => BASE_TAGS.has(n) || SPLIT.has(n))) declare(names, null);
    }
    for (const raw of splitTopLevel(options.extendedValidElements ?? '')) {
      const { names, attrs } = parseRule(raw);
      declare(names, attrs);
    }
    // Свои элементы без правила сохраняют все безопасные атрибуты.
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

  /** Есть ли что применять (иначе редактор обходится без этого модуля). */
  get active(): boolean {
    return this.elements.size > 0 || this.globals.length > 0;
  }

  /** Правила касаются элемента: список атрибутов, значения или общие атрибуты. */
  touches(tag: string): boolean {
    return this.globals.length > 0 || this.elements.has(tag);
  }

  private rulesFor(tag: string): AttrRule[] {
    return [...(this.elements.get(tag) ?? []), ...this.globals];
  }

  /** Разрешает ли правило атрибут (без учёта встроенных атрибутов элемента). */
  allows(tag: string, name: string): boolean {
    if (NEVER_ATTR.test(name) || !ATTR_NAME.test(name)) return false;
    return this.rulesFor(tag).some((rule) => matches(rule.name, name));
  }

  /** Может ли у встроенного элемента быть атрибут сверх встроенных (кроме class и style). */
  extends(tag: string): boolean {
    return this.rulesFor(tag).some((rule) => rule.name !== 'class' && rule.name !== 'style');
  }

  /** Правила разрешают class у какого-либо встроенного элемента (тогда классы сохраняются). */
  get classOnBuiltIn(): boolean {
    if (this.globals.some((r) => matches(r.name, 'class'))) return true;
    for (const [tag, attrs] of this.elements) {
      if (BASE_TAGS.has(tag) && attrs?.some((r) => matches(r.name, 'class'))) return true;
    }
    return false;
  }

  /** Все обязательные атрибуты на месте. */
  hasRequired(tag: string, dom: HTMLElement): boolean {
    return this.rulesFor(tag).every((rule) => !rule.required || dom.hasAttribute(rule.name));
  }

  /**
   * Разрешённые правилом атрибуты элемента (значения проверены) или null. `skip` — атрибуты, которые
   * хранит не элемент: у встроенных class и style (validClasses, validStyles, марки оформления).
   * Собственный style новых элементов парсер заранее переносит в OWN_STYLE (см. parser.ts).
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
   * Атрибуты для вывода: встроенные + сохранённые (`extras`, могли прийти из JSON чем угодно),
   * затем список элемента и правила значений.
   */
  outputAttrs(tag: string, builtIn: Attrs, extras: unknown): Attrs {
    // Сначала встроенные, затем сохранённые — порядок не зависит от того, откуда пришло значение.
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
    // Ссылка в новой вкладке — без доступа к странице-источнику (как у встроенной ссылки).
    if (tag === 'a' && out.target != null && out.rel == null) out.rel = 'noopener noreferrer';
    return out;
  }

  /** Применить правила к выводу toDOM: атрибуты верхнего элемента спеки. */
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

/** Правила из опций или null, если применять нечего. */
export function createHtmlRules(options: HtmlRulesOptions): HtmlRules | null {
  if (!options.validElements && !options.extendedValidElements && !options.customElements) {
    return null;
  }
  const rules = new HtmlRules(options);
  return rules.active ? rules : null;
}

// ---------- схема ----------

type Spec = NodeSpec | MarkSpec;
interface SchemaRef {
  schema?: Schema;
}

const tagOf = (selector: string): string =>
  (/^[a-z][a-z0-9-]*/i.exec(selector)?.[0] ?? '').toLowerCase();

/** Имена атрибутов, которые встроенный toDOM (исходный, без правил) выводит сам для этих attrs. */
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

/** Встроенный узел/марка с правилами атрибутов. */
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
          // Что встроенный узел выводит сам, в extras не дублируем — иначе устаревшее значение
          // вернулось бы, когда пользователь его уберёт.
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

/** Узлы и марки для новых элементов. */
function genericSpecs(rules: HtmlRules): {
  nodes: Record<string, NodeSpec>;
  marks: Record<string, MarkSpec>;
} {
  const nodes: Record<string, NodeSpec> = {};
  const marks: Record<string, MarkSpec> = {};
  /**
   * У синонимов встроенных элементов (span, i, mark…) style разбирают марки оформления — его не
   * дублируем; class у непустого span — марка классов. Синоним без своих атрибутов — встроенный.
   */
  const read = (output: string, dom: HTMLElement, mark: boolean) => {
    if (!rules.hasRequired(output, dom)) return false;
    const split = SPLIT.has(output);
    const skip = !split ? [] : mark && output === 'span' ? ['class', 'style'] : ['style'];
    const htmlAttrs = rules.readAttrs(output, dom, skip);
    if (split && !htmlAttrs) return false;
    return { tag: output, htmlAttrs };
  };
  // Теги, чей style остаётся на самом элементе, а не превращается в марки (см. parser.ts).
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
    // Пустой элемент (иконка `<i class="fa fa-star"></i>`) — неделимый узел: марке нечего охватить.
    nodes.html_inline_atom = {
      ownStyleTags: ownStyle(rules.inlineTags),
      group: 'inline',
      inline: true,
      atom: true,
      attrs,
      parseDOM: inline.map(([input, output]) => ({
        tag: input,
        // Раньше марки того же тега (у неё 60) и встроенных марок (курсив для <i>).
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
      // Разные элементы (abbr внутри kbd) — экземпляры одной марки, они не должны вытеснять друг друга.
      excludes: '',
      parseDOM: inline.map(([input, output]) => ({
        tag: input,
        // span: после марок классов и узлов плагинов (они разбирают свои span раньше).
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
 * Применить правила к спекам схемы: встроенные узлы и марки получают правила атрибутов, новые
 * элементы — свои узлы и марки (в конце: встроенные правила разбора остаются в приоритете).
 * После создания схемы её нужно записать в `ref.schema`.
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
 * Модуль для регистрации в ядре:
 *
 *   import { registerHtmlRules } from '@novaprose/core';
 *   import { htmlRules } from '@novaprose/core/html-rules';
 *   registerHtmlRules(htmlRules);
 */
export const htmlRules: HtmlRulesModule = { create: createHtmlRules };
