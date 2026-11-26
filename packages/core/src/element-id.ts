/**
 * A safe element identifier (a heading id, an anchor): a Latin letter first, then letters,
 * digits, "_", "-", ".", up to 64 characters. No spaces or quotes, so the value can't escape the attribute.
 */
export const ELEMENT_ID_RE = /^[A-Za-z][\w.-]{0,63}$/;

/** A value from HTML or JSON → an identifier, or null. */
export function elementId(value: unknown): string | null {
  return typeof value === 'string' && ELEMENT_ID_RE.test(value) ? value : null;
}
