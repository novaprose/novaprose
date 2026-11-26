import { en, type MessageKey, type Messages } from './en';

export type { MessageKey, Messages };
export { en };

/**
 * Строки плагинов: `<плагин>.<ключ>` («comments.reply», «anchor.title»). Плагины грузятся лениво,
 * поэтому их строки живут в самом плагине и регистрируются при загрузке (registerPluginMessages),
 * но переводятся той же системой, что и ядро: registerLanguage и опция `translations` их видят.
 */
export type PluginMessageKey = `${string}.${string}`;

/**
 * Языковой пакет или точечные переопределения: строки ядра (с подсказками типов) и строки плагинов.
 * Недостающие ключи берутся из английского.
 */
export type LanguagePack = Partial<Messages> & { [key: PluginMessageKey]: string };

/** Пакеты, переданные через registerLanguage: только то, что дал пользователь (без подмешанного en). */
const userPacks: Record<string, LanguagePack> = {};
/**
 * Встроен только английский (эталон). Остальные языки — пакеты @novaprose/core/i18n/<код>,
 * подключаются через registerLanguage: каждый клиент скачивает только свой язык.
 */
const builtin: Record<string, Messages> = { en };
const warned = new Set<string>();

/** Строки плагина на одном языке: строка или список строк (названия групп и т.п.). */
export type PluginLabels = Record<string, string | readonly string[]>;
/** Словарь плагина по языкам; en — эталон и запасной вариант. */
export type PluginDict = { en: PluginLabels } & Record<string, PluginLabels | undefined>;

/** Встроенные строки плагинов в плоском виде: namespace → язык → 'key' | 'key.0' → строка. */
const pluginPacks: Record<string, Record<string, Record<string, string>>> = {};

function flatten(labels: PluginLabels): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (typeof value === 'string') out[key] = value;
    else value.forEach((item, i) => (out[`${key}.${i}`] = item));
  }
  return out;
}

/** Зарегистрировать языковой пакет (BCP-47 код: 'de', 'pt-BR'). Недостающие ключи берутся из английского. */
export function registerLanguage(code: string, messages: LanguagePack): void {
  const lang = code.toLowerCase();
  userPacks[lang] = { ...userPacks[lang], ...messages };
  builtin[lang] = { ...en, ...builtin[lang], ...(messages as Partial<Messages>) };
}

/** Строки плагина по языкам (en — эталон). Вызывается плагином при загрузке модуля. */
export function registerPluginMessages(namespace: string, dict: PluginDict): void {
  const flat: Record<string, Record<string, string>> = {};
  for (const [lang, labels] of Object.entries(dict)) if (labels) flat[lang] = flatten(labels);
  pluginPacks[namespace] = flat;
}

/**
 * Все зарегистрированные строки плагинов в плоском виде: namespace → язык → ключ → строка
 * (для проверки полноты переводов и шаблона для переводчиков).
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
 * Переводчик для экземпляра редактора. Ищет точный код ('pt-br'), затем базовый язык ('pt'),
 * затем английский. overrides — точечная замена строк из конфига (и ядра, и плагинов).
 * Строки плагинов ищутся в момент вызова: ленивые плагины регистрируются позже создания редактора.
 */
export function createTranslator(language = 'en', overrides: LanguagePack = {}): Translator {
  const code = language.toLowerCase();
  const base = code.split('-')[0]!;
  const pack = builtin[code] ?? builtin[base] ?? en;
  if (pack === en && base !== 'en' && !warned.has(base)) {
    warned.add(base);
    console.warn(
      `[nova] language "${language}" is not registered, using English. ` +
        `import pack from '@novaprose/core/i18n/${base}'; registerLanguage('${base}', pack);`,
    );
  }
  const messages: Record<string, string> = { ...en, ...pack, ...overrides };
  const user = { ...userPacks[base], ...userPacks[code] } as Record<string, string | undefined>;
  const own = overrides as Record<string, string | undefined>;

  return (key, params) => {
    const core = messages[key];
    if (core !== undefined) return interpolate(core, params);
    // Строка плагина: конфиг → registerLanguage → встроенный перевод плагина → английский.
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
