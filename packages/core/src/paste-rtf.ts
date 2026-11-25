/**
 * Картинки из буфера обмена Word для компьютера.
 *
 * В HTML Word ссылается на картинки локальными путями (`<img src="file:///C:/…/clip_image001.png">`),
 * которые браузер не откроет. Сами картинки лежат в RTF-варианте того же буфера: группы `{\pict …}`
 * с шестнадцатеричными данными. Достаём PNG и JPEG и подставляем их по порядку вместо file:-ссылок.
 *
 * По публичной спецификации RTF (группы \pict, \pngblip, \jpegblip, \shppict/\nonshppict) — без чужого кода.
 */

export interface RtfImage {
  type: 'image/png' | 'image/jpeg';
  /** Данные в base64 (для data:-URL). */
  base64: string;
}

/** Найти конец группы, начинающейся с '{' в позиции start (учитывая вложенность и экранирование). */
function groupEnd(rtf: string, start: number): number {
  let depth = 0;
  for (let i = start; i < rtf.length; i++) {
    const ch = rtf[i];
    if (ch === '\\') {
      i++; // экранированный символ (\{, \}, \\) или начало управляющего слова — пропускаем следующий
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Содержимое группы без вложенных групп ({\*\picprop…}, {\*\blipuid…}). */
function withoutNestedGroups(body: string): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch === '\\') {
      if (depth === 0) out += ch + (body[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (depth === 0) out += ch;
  }
  return out;
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function hexToBase64(hex: string): string | null {
  if (hex.length % 2 !== 0 || hex.length / 2 > MAX_IMAGE_BYTES || !/^[0-9a-f]+$/i.test(hex))
    return null;
  let binary = '';
  for (let i = 0; i < hex.length; i += 2)
    binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(binary);
}

/** PNG и JPEG из RTF по порядку. Векторные WMF/EMF и резервные копии (\nonshppict) пропускаются. */
export function extractRtfImages(rtf: string): RtfImage[] {
  const images: RtfImage[] = [];
  let from = 0;
  for (;;) {
    const start = rtf.indexOf('{\\pict', from);
    if (start < 0) break;
    const end = groupEnd(rtf, start);
    if (end < 0) break;
    from = end + 1;
    // Резервная копия картинки для старых читателей RTF — дубль, пропускаем.
    if (/\\nonshppict\s*$/.test(rtf.slice(Math.max(0, start - 16), start))) continue;
    const body = withoutNestedGroups(rtf.slice(start + 1, end));
    const type = /\\pngblip(?![a-z])/.test(body)
      ? 'image/png'
      : /\\jpegblip(?![a-z])/.test(body)
        ? 'image/jpeg'
        : null;
    if (!type) continue;
    const hex = body.replace(/\\[a-z]+-?\d* ?/gi, '').replace(/\s+/g, '');
    const base64 = hexToBase64(hex);
    if (!base64) continue;
    // Проверка сигнатуры: не доверяем ключевому слову, если данные не совпадают с форматом.
    const head = atob(base64.slice(0, 12));
    const valid =
      type === 'image/png'
        ? head.startsWith(String.fromCharCode(0x89) + 'PNG')
        : head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8;
    if (valid) images.push({ type, base64 });
  }
  return images;
}

/** Есть ли в HTML картинки с локальными file:-ссылками (признак картинок Word). */
export function hasLocalFileImages(html: string): boolean {
  return /<img[^>]+src=["']?file:/i.test(html);
}

/**
 * Подставить картинки из RTF вместо file:-ссылок. Только при совпадении количества — иначе
 * сопоставление ненадёжно, и такие картинки просто не вставятся (как раньше).
 */
export function replaceLocalImages(html: string, images: RtfImage[]): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const targets = [...template.content.querySelectorAll('img')].filter((img) =>
    /^file:/i.test(img.getAttribute('src') ?? ''),
  );
  if (!targets.length || targets.length !== images.length) return html;
  targets.forEach((img, i) => {
    const image = images[i]!;
    img.setAttribute('src', `data:${image.type};base64,${image.base64}`);
  });
  return template.innerHTML;
}
