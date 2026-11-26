import { en, type MessageKey, type Messages } from './en';

export type { MessageKey, Messages };
export { en };

/**
 * Plugin strings: `<plugin>.<key>` ('comments.reply', 'anchor.title'). Plugins load lazily, so their
 * strings live in the plugin and are registered when it loads (registerPluginMessages), but they are
 * translated by the same system as the core: registerLanguage and the `translations` option see them.
 */
export type PluginMessageKey = `${string}.${string}`;

/**
 * A language pack or individual overrides: core strings (with type hints) and plugin strings.
 * Missing keys fall back to English.
 */
export type LanguagePack = Partial<Messages> & { [key: PluginMessageKey]: string };

/** Packs passed through registerLanguage: only what the user gave (without en mixed in). */
const userPacks: Record<string, LanguagePack> = {};
/**
 * Only English is built in (the reference). Other languages are the @novaprose/core/i18n/<code> packs,
 * attached through registerLanguage: each customer downloads only their language.
 */
const builtin: Record<string, Messages> = { en };
const warned = new Set<string>();

/** A plugin's strings in one language: a string or a list of strings (group names and the like). */
export type PluginLabels = Record<string, string | readonly string[]>;
/** A plugin's dictionary by language; en is the reference and the fallback. */
export type PluginDict = { en: PluginLabels } & Record<string, PluginLabels | undefined>;

/** Built-in plugin strings in flat form: namespace → language → 'key' | 'key.0' → string. */
const pluginPacks: Record<string, Record<string, Record<string, string>>> = {};

function flatten(labels: PluginLabels): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (typeof value === 'string') out[key] = value;
    else value.forEach((item, i) => (out[`${key}.${i}`] = item));
  }
  return out;
}

/** A pack loader: `() => import('@novaprose/core/i18n/de')` — the language downloads only when needed. */
export type LanguageLoader = () => Promise<LanguagePack | { default: LanguagePack }>;

const loaders: Record<string, LanguageLoader> = {};
const loading: Record<string, Promise<boolean> | undefined> = {};

/** A pack's strings go into the language's shared dictionary: over the existing ones or under them (a loaded pack doesn't overwrite customizations). */
function install(lang: string, messages: LanguagePack, below = false): void {
  userPacks[lang] = below
    ? { ...messages, ...userPacks[lang] }
    : { ...userPacks[lang], ...messages };
  builtin[lang] = { ...en, ...(userPacks[lang] as Partial<Messages>) };
}

/**
 * Register a language pack (BCP 47 code: 'de', 'pt-BR') or a function that loads it — then call
 * `await loadLanguage(code)` before creating the editor. Missing keys fall back to English.
 */
export function registerLanguage(code: string, messages: LanguagePack | LanguageLoader): void {
  const lang = code.toLowerCase();
  if (typeof messages === 'function') loaders[lang] = messages;
  else install(lang, messages);
}

/** Whether a language is ready for a new editor: its pack is registered (or it is English). */
export function hasLanguage(code: string): boolean {
  const lang = code.toLowerCase();
  return lang in builtin || lang.split('-')[0]! in builtin;
}

/**
 * Load a language registered with a loader (the CDN builds register every pack this way). true —
 * the language is ready, false — there is neither a pack nor a loader. Strings are taken when an
 * editor is created, so load first. A failed load can be retried: the failure isn't remembered.
 */
export function loadLanguage(code: string): Promise<boolean> {
  const lang = code.toLowerCase();
  const base = lang.split('-')[0]!;
  const key = lang in loaders ? lang : base in loaders ? base : null;
  if (!key) return Promise.resolve(hasLanguage(lang));
  return (loading[key] ??= loaders[key]!().then(
    (module) => {
      // A pack module (import()) or the pack itself.
      install(
        key,
        (module as { default?: LanguagePack }).default ?? (module as LanguagePack),
        true,
      );
      return true;
    },
    (error: unknown) => {
      loading[key] = undefined;
      throw error;
    },
  ));
}

/** A plugin's strings by language (en is the reference). The plugin calls it when its module loads. */
export function registerPluginMessages(namespace: string, dict: PluginDict): void {
  const flat: Record<string, Record<string, string>> = {};
  for (const [lang, labels] of Object.entries(dict)) if (labels) flat[lang] = flatten(labels);
  pluginPacks[namespace] = flat;
}

/**
 * All registered plugin strings, flattened: namespace → language → key → string (to check that
 * translations are complete, and as a template for translators).
 */
export function getPluginMessages(): Readonly<
  Record<string, Readonly<Record<string, Record<string, string>>>>
> {
  return pluginPacks;
}

export type Translator = (
  key: MessageKey | PluginMessageKey,
  params?: Record<string, string | number>,
) => string;

const interpolate = (template: string, params?: Record<string, string | number>) =>
  params
    ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
    : template;

/**
 * The translator for an editor instance. Looks for the exact code ('pt-br'), then the base language ('pt'),
 * then English. overrides are targeted replacements of strings from the config (core and plugins alike).
 * Plugin strings are looked up at call time: lazy plugins register after the editor is created.
 */
export function createTranslator(language = 'en', overrides: LanguagePack = {}): Translator {
  const code = language.toLowerCase();
  const base = code.split('-')[0]!;
  const pack = builtin[code] ?? builtin[base] ?? en;
  if (pack === en && base !== 'en' && !warned.has(base)) {
    warned.add(base);
    console.warn(
      code in loaders || base in loaders
        ? `[nova] language "${language}" is not loaded yet, using English. ` +
            `Load it before creating the editor: await loadLanguage('${language}');`
        : `[nova] language "${language}" is not registered, using English. ` +
            `import pack from '@novaprose/core/i18n/${base}'; registerLanguage('${base}', pack);`,
    );
  }
  const messages: Record<string, string> = { ...en, ...pack, ...overrides };
  const user = { ...userPacks[base], ...userPacks[code] } as Record<string, string | undefined>;
  const own = overrides as Record<string, string | undefined>;

  return (key, params) => {
    const core = messages[key];
    if (core !== undefined) return interpolate(core, params);
    // A plugin string: config → registerLanguage → the plugin's built-in translation → English.
    const dot = key.indexOf('.');
    const dict = dot > 0 ? pluginPacks[key.slice(0, dot)] : undefined;
    const name = key.slice(dot + 1);
    const template =
      own[key] ??
      user[key] ??
      dict?.[code]?.[name] ??
      dict?.[base]?.[name] ??
      dict?.en?.[name] ??
      key;
    return interpolate(template, params);
  };
}
