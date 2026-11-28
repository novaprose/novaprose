/**
 * Images are prepared in the browser before they are uploaded or embedded: a photo larger than the
 * limit is scaled down, and what a camera writes into the file besides the picture (EXIF: the place
 * where it was taken, the camera, the date) is left out. The picture keeps its orientation. A file
 * that needs neither goes as it is; GIF, SVG and animated WebP never change.
 */

export interface ImageOptimizeOptions {
  /** The largest width in pixels. Default 2560. */
  maxWidth?: number;
  /** The largest height in pixels. Default 2560. */
  maxHeight?: number;
  /** JPEG and WebP quality, 0…1. Default 0.85. */
  quality?: number;
  /** Keep EXIF and other metadata (the place of a photo too). Default false. */
  keepMetadata?: boolean;
}

const DEFAULTS = { maxWidth: 2560, maxHeight: 2560, quality: 0.85, keepMetadata: false };

/** The size that fits within the limits, keeping the proportions (never larger than the original). */
export function fitWithin(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Whether the file carries metadata besides the picture: EXIF or XMP in JPEG (APP1), IPTC (APP13),
 * eXIf or text chunks in PNG, EXIF or XMP in WebP.
 */
export function hasMetadata(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/jpeg') {
    // Segments follow the start marker FFD8 until the image data (FFDA).
    for (let i = 2; i + 4 <= bytes.length;) {
      if (bytes[i] !== 0xff) return false;
      // Fill bytes (FF FF …) may come before a marker.
      while (bytes[i + 1] === 0xff && i + 4 < bytes.length) i++;
      const marker = bytes[i + 1]!;
      if (marker === 0xda || marker === 0xd9) return false;
      if (marker === 0xe1 || marker === 0xed) return true;
      i += 2 + ((bytes[i + 2]! << 8) | bytes[i + 3]!);
    }
    return false;
  }
  if (type === 'image/png') {
    for (let i = 8; i + 8 <= bytes.length;) {
      const length =
        (bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!;
      const name = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
      if (/^(eXIf|tEXt|iTXt|zTXt)$/.test(name)) return true;
      if (name === 'IDAT' || name === 'IEND' || length < 0) return false;
      i += 12 + length;
    }
    return false;
  }
  if (type === 'image/webp') return chunks(bytes).some((c) => c === 'EXIF' || c === 'XMP ');
  return false;
}

/** The chunk names of a WebP file (RIFF). */
function chunks(bytes: Uint8Array): string[] {
  const names: string[] = [];
  for (let i = 12; i + 8 <= bytes.length && names.length < 64;) {
    names.push(String.fromCharCode(...bytes.subarray(i, i + 4)));
    const size =
      bytes[i + 4]! | (bytes[i + 5]! << 8) | (bytes[i + 6]! << 16) | (bytes[i + 7]! << 24);
    i += 8 + size + (size & 1);
  }
  return names;
}

const isBlob = (value: unknown): value is Blob =>
  !!value &&
  typeof (value as Blob).arrayBuffer === 'function' &&
  typeof (value as Blob).size === 'number';

/** The prepared file, or the original when nothing needs to change (or the browser can't decode it). */
export async function optimizeImage(file: File, options: ImageOptimizeOptions = {}): Promise<File> {
  const settings = { ...DEFAULTS, ...options };
  const type = file.type.toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/bmp'].includes(type)) return file;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return file;
  }
  // An animated WebP would lose its frames on a canvas.
  if (type === 'image/webp' && chunks(bytes).includes('ANIM')) return file;

  let bitmap: ImageBitmap;
  try {
    // from-image: the camera's orientation is applied, so the pixels stand the right way up.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const size = fitWithin(bitmap.width, bitmap.height, settings.maxWidth, settings.maxHeight);
  const resize = size.width !== bitmap.width || size.height !== bitmap.height;
  const strip = !settings.keepMetadata && hasMetadata(bytes, type);
  if (!resize && !strip && type !== 'image/bmp') {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  // BMP becomes PNG (lossless); JPEG and WebP keep their type.
  const want = type === 'image/bmp' ? 'image/png' : type;
  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, want, want === 'image/png' ? undefined : settings.quality),
  );
  // A browser that can't write the type (WebP in some Safari versions) gives PNG instead: a photo
  // in PNG would be larger, so the original stays unless it had to shrink.
  if (!isBlob(blob) || (blob.type !== want && !resize)) return file;
  if (!resize && !strip && blob.size >= file.size) return file;
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[blob.type] ?? 'png';
  const name = file.name.replace(/\.[a-z0-9]+$/i, '') || 'image';
  return new File([blob], `${name}.${ext}`, { type: blob.type, lastModified: file.lastModified });
}
