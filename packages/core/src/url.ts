/**
 * Проверка URL против XSS (javascript:, vbscript:, data:text/html и т.п.).
 * Относительные адреса и якоря разрешены.
 */
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,/i;

function protocolOf(url: string): string | null {
  // Документ мог прийти из JSON: вместо строки — число или null.
  if (typeof url !== 'string') return null;
  // Убираем управляющие символы и пробелы, которыми маскируют "java\tscript:".
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
