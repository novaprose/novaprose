import { isSafeImageUrl, isSafeLinkUrl } from './url';

/**
 * Checks an attribute value on output: the last line of defense before HTML goes to the server.
 * Shared by the serializer and the attribute rules (@novaprose/core/html-rules).
 */
const LINK_ATTRS = new Set(['href', 'xlink:href', 'action', 'formaction', 'cite']);
const RESOURCE_ATTRS = new Set(['src', 'poster', 'data', 'background']);
const UNSAFE_CSS = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding/i;

/** The attribute value if it is safe, otherwise null (the attribute isn't output). */
export function safeAttr(name: string, value: string): string | null {
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
