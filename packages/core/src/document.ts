import { Node as PMNode, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { ContentRules, type ContentRulesOptions } from './content-rules';
import type { EditorOptions } from './editor';
import { formatClasses } from './formats';
import { htmlRulesFor } from './html-rules-api';
import { orderPlugins, resolveEntries, type NovaPlugin } from './plugins';
import { createSchema, type ClassFilter, type NovaSchema } from './schema';
import { HTMLSerializer } from './serializer';

/**
 * A document without an editor: the same schema the editor builds (plugins, classes, markup rules,
 * writing direction) and the same HTML as getHTML(). No DOM, so it works on the server: e-mails,
 * previews, rendering pages from saved JSON.
 */

/** The options the schema and the HTML depend on (a subset of the editor's options). */
export type DocumentOptions = Pick<
  EditorOptions,
  | 'plugins'
  | 'pluginOptions'
  | 'formats'
  | 'styleFormats'
  | 'validClasses'
  | 'tableClassList'
  | 'tableCellClassList'
  | 'direction'
  | 'language'
> &
  ContentRulesOptions;

/** The shared serializer: it keeps its own mark output cache per mark type (schema). */
export const htmlSerializer = new HTMLSerializer();

/** Languages written right to left (by the main part of the code: ar-EG → ar). */
const RTL_LANGUAGES = new Set(['ar', 'he', 'iw', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']);
export function isRtlLanguage(language: string | undefined): boolean {
  return !!language && RTL_LANGUAGES.has(language.toLowerCase().split(/[-_]/)[0]!);
}

function report(message: string, error?: unknown): void {
  console.error(`[nova] ${message}`, ...(error === undefined ? [] : [error]));
}

/**
 * The document schema: the base one + nodes and marks of synchronous plugins, classes from formats and lists,
 * markup rules. `context` is what plugin nodes receive (`nodes(editor)`): when the schema is created,
 * only the editor's settings are ready.
 */
export function schemaFromOptions(
  options: DocumentOptions,
  plugins: readonly NovaPlugin[],
  direction: 'ltr' | 'rtl',
  context: { options: DocumentOptions },
): { schema: NovaSchema; allowedClasses: Set<string> } {
  // Classes the schema keeps when parsing: from formats, styles and validClasses.
  // The set is live: formatter.register() in the editor adds to it too.
  const allowedClasses = new Set([
    ...formatClasses(Object.values(options.formats ?? {}).flat()),
    ...formatClasses(options.styleFormats ?? []),
    ...(Array.isArray(options.validClasses) ? options.validClasses : []),
    ...[...(options.tableClassList ?? []), ...(options.tableCellClassList ?? [])].flatMap((o) =>
      o.value.split(/\s+/).filter(Boolean),
    ),
  ]);
  const htmlRules = htmlRulesFor(options);
  // `p[class]` in the rules without validClasses: classes are kept (as TinyMCE does by default).
  const allClasses =
    options.validClasses === true ||
    (options.validClasses === undefined && !!htmlRules?.classOnBuiltIn);
  const classFilter: ClassFilter = allClasses ? () => true : (name) => allowedClasses.has(name);

  const nodes: Record<string, NodeSpec> = {};
  const marks: Record<string, MarkSpec> = {};
  for (const plugin of plugins) {
    // Nodes may depend on plugin settings (for example, the variable's attribute name). If one
    // plugin fails, it goes without its nodes, but the editor (and server rendering) keeps working.
    let pluginNodes: Record<string, NodeSpec> | undefined;
    try {
      pluginNodes =
        typeof plugin.nodes === 'function'
          ? plugin.nodes(context as Parameters<typeof plugin.nodes>[0])
          : plugin.nodes;
    } catch (error) {
      report(`Plugin "${plugin.name}" failed to define its nodes`, error);
    }
    for (const [name, spec] of Object.entries(pluginNodes ?? {})) {
      if (name in nodes) report(`Node "${name}" is defined by several plugins`);
      else nodes[name] = spec;
    }
    for (const [name, spec] of Object.entries(plugin.marks ?? {})) {
      if (name in marks) report(`Mark "${name}" is defined by several plugins`);
      else marks[name] = spec;
    }
  }
  try {
    return {
      schema: createSchema({ nodes, marks }, classFilter, htmlRules, direction),
      allowedClasses,
    };
  } catch (error) {
    report('Failed to build the document schema from plugins', error);
    return { schema: createSchema({}, classFilter, htmlRules, direction), allowedClasses };
  }
}

type AttrSpecs = Record<string, { validate?: string | ((value: unknown) => void) }>;

/** Whether a value passes the `validate` check of a schema attribute ("number", "string|null", a function). */
function attrValid(spec: AttrSpecs[string] | undefined, value: unknown): boolean {
  const validate = spec?.validate;
  if (!validate) return true;
  if (typeof validate === 'function') {
    try {
      validate(value);
      return true;
    } catch {
      return false;
    }
  }
  const type = value === null ? 'null' : typeof value;
  return validate.split('|').includes(type);
}

function sanitizeAttrs(specs: AttrSpecs | undefined, attrs: unknown): unknown {
  if (!attrs || typeof attrs !== 'object' || !specs) return attrs;
  // A value of the wrong type is replaced with the default (just removed: the schema fills it in).
  return Object.fromEntries(
    Object.entries(attrs).filter(([name, value]) => attrValid(specs[name], value)),
  );
}

/**
 * A document from JSON (a database, an API, old versions) may have been saved with attributes of the wrong type:
 * `colspan: null` and the like. ProseMirror then rejects the WHOLE document, and the user couldn't
 * open it because of one cell. Here wrong attribute values are replaced with defaults.
 */
export function sanitizeJSON(
  schema: NovaSchema,
  json: Record<string, unknown>,
): Record<string, unknown> {
  const type = schema.nodes[json.type as string];
  const out: Record<string, unknown> = { ...json };
  if (type) out.attrs = sanitizeAttrs(type.spec.attrs as AttrSpecs, json.attrs);
  if (Array.isArray(json.marks)) {
    out.marks = json.marks.map((mark: Record<string, unknown>) => {
      const markType = mark && schema.marks[mark.type as string];
      return markType
        ? { ...mark, attrs: sanitizeAttrs(markType.spec.attrs as AttrSpecs, mark.attrs) }
        : mark;
    });
  }
  if (Array.isArray(json.content)) {
    out.content = json.content.map((child: unknown) =>
      child && typeof child === 'object'
        ? sanitizeJSON(schema, child as Record<string, unknown>)
        : child,
    );
  }
  return out;
}

export interface DocumentRenderer {
  /** The schema (for your own operations on the ProseMirror document). */
  readonly schema: NovaSchema;
  /** A ProseMirror document from JSON, with attributes checked and content rules applied. */
  doc(json: Record<string, unknown>): PMNode;
  /** The document's HTML — the same as getHTML() of an editor with these options. */
  html(json: Record<string, unknown>): string;
  /** The document's text: blocks separated by a blank line, like getText(). */
  text(json: Record<string, unknown>): string;
}

/**
 * A document renderer for one set of options: the schema is built once, handy for many documents
 * (a mailing, a list of pages). Plugins by name from the catalog or as objects; lazy plugins
 * (without nodes of their own) don't affect the HTML and are skipped.
 *
 *   const renderer = createRenderer({ plugins: ['mentions', 'math'] });
 *   const html = renderer.html(savedJson);
 */
export function createRenderer(options: DocumentOptions = {}): DocumentRenderer {
  const resolved = resolveEntries(options.plugins ?? []);
  resolved.errors.forEach((message) => report(message));
  const { ordered, errors } = orderPlugins(resolved.plugins);
  errors.forEach((message) => report(message));
  const direction = options.direction ?? (isRtlLanguage(options.language) ? 'rtl' : 'ltr');
  const { schema } = schemaFromOptions(options, ordered, direction, { options });
  const hasRules =
    options.validElements !== undefined ||
    options.invalidElements !== undefined ||
    options.validStyles !== undefined;
  const rules = hasRules ? new ContentRules(options) : null;
  const doc = (json: Record<string, unknown>) => {
    const node = PMNode.fromJSON(schema, sanitizeJSON(schema, json));
    return rules ? rules.normalizeDoc(node) : node;
  };
  return {
    schema,
    doc,
    html: (json) => htmlSerializer.serializeFragment(doc(json).content),
    text: (json) => {
      const node = doc(json);
      return node.textBetween(0, node.content.size, '\n\n');
    },
  };
}

/** A document's HTML from JSON without an editor or a DOM (server, e-mails), the same as getHTML(). */
export function renderHTML(json: Record<string, unknown>, options: DocumentOptions = {}): string {
  return createRenderer(options).html(json);
}
