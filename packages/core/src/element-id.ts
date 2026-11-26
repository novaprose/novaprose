/**
 * Безопасный идентификатор элемента (id заголовка, якорь): латинская буква в начале, дальше буквы,
 * цифры, «_», «-», «.», до 64 символов. Без пробелов и кавычек — значение не выйдет из атрибута.
 */
export const ELEMENT_ID_RE = /^[A-Za-z][\w.-]{0,63}$/;

/** Значение из HTML или JSON → идентификатор или null. */
export function elementId(value: unknown): string | null {
  return typeof value === 'string' && ELEMENT_ID_RE.test(value) ? value : null;
}
