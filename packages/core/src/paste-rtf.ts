/**
 * Images from the desktop Word clipboard.
 *
 * In HTML, Word refers to images by local paths (`<img src="file:///C:/…/clip_image001.png">`)
 * that a browser won't open. The images themselves are in the RTF flavor of the same clipboard: `{\pict …}` groups
 * with hexadecimal data. PNG and JPEG are extracted and put in place of the file: links, in order.
 *
 * Built from the public RTF specification (\pict, \pngblip, \jpegblip, \shppict/\nonshppict groups), without anyone else's code.
 */

export interface RtfImage {
  type: 'image/png' | 'image/jpeg';
  /** The data in base64 (for a data: URL). */
  base64: string;
}

/** Finds the end of a group starting with '{' at position start (minding nesting and escaping). */
function groupEnd(rtf: string, start: number): number {
  let depth = 0;
  for (let i = start; i < rtf.length; i++) {
    const ch = rtf[i];
    if (ch === '\\') {
      i++; // an escaped character (\{, \}, \\) or the start of a control word: skip the next one
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

/** The group's content without nested groups ({\*\picprop…}, {\*\blipuid…}). */
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

/** PNG and JPEG from the RTF, in order. Vector WMF/EMF and fallback copies (\nonshppict) are skipped. */
export function extractRtfImages(rtf: string): RtfImage[] {
  const images: RtfImage[] = [];
  let from = 0;
  for (;;) {
    const start = rtf.indexOf('{\\pict', from);
    if (start < 0) break;
    const end = groupEnd(rtf, start);
    if (end < 0) break;
    from = end + 1;
    // A fallback copy of the image for old RTF readers: a duplicate, skipped.
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
    // A signature check: the keyword isn't trusted if the data doesn't match the format.
    const head = atob(base64.slice(0, 12));
    const valid =
      type === 'image/png'
        ? head.startsWith(String.fromCharCode(0x89) + 'PNG')
        : head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8;
    if (valid) images.push({ type, base64 });
  }
  return images;
}

/**
 * Puts images from the RTF in place of file: links. Only when the counts match: otherwise
 * the matching is unreliable, and such images just aren't pasted (as before).
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
