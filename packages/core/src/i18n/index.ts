import { en, type MessageKey, type Messages } from './en';
import { ru } from './ru';

export type { MessageKey, Messages };
export { en, ru };

const builtin: Record<string, Messages> = { en, ru };

/** Зарегистрировать языковой пакет (BCP-47 код: 'de', 'pt-BR'). Недостающие ключи берутся из английского. */
export function registerLanguage(code: string, messages: Partial<Messages>): void {
  builtin[code.toLowerCase()] = { ...en, ...messages };
}

export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Переводчик для экземпляра редактора. Ищет точный код ('pt-br'), затем базовый язык ('pt'),
 * затем английский. overrides — точечная замена строк из конфига.
 */
export function createTranslator(language = 'en', overrides: Partial<Messages> = {}): Translator {
  const code = language.toLowerCase();
  const pack = builtin[code] ?? builtin[code.split('-')[0]!] ?? en;
  const messages: Messages = { ...en, ...pack, ...overrides };
  return (key, params) => {
    const template = messages[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
  };
}
