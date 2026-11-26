/**
 * URL checks against XSS (javascript:, vbscript:, data:text/html and the like).
 * Relative addresses and anchors are allowed.
 */
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,/i;

function protocolOf(url: string): string | null {
  // The document may come from JSON: a number or null instead of a string.
  if (typeof url !== 'string') return null;
  // Strip the control characters and spaces used to disguise "java\tscript:".
  // eslint-disable-next-line no-control-regex
  const cleaned = url.replace(/[\u0000- \u007f-\u009f]/g, '');
  const match = cleaned.match(/^([a-z][a-z0-9+.-]*):/i);
  return match ? `${match[1]!.toLowerCase()}:` : null;
}

export function isSafeLinkUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  const protocol = protocolOf(url);
  return protocol === null || SAFE_LINK_PROTOCOLS.has(protocol);
}

export function isSafeImageUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  if (SAFE_DATA_IMAGE.test(url.trim())) return true;
  const protocol = protocolOf(url);
  return protocol === null || SAFE_IMAGE_PROTOCOLS.has(protocol);
}
