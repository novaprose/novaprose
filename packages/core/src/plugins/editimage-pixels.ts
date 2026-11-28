/**
 * The image editing of the editimage plugin, as pure functions: the geometry of rotation, flips and
 * cropping, and brightness, contrast and saturation on pixels. Without a DOM (testable anywhere);
 * drawing onto canvases is in editimage-ui.ts.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An edit of an image, applied in this order: rotation and flips, cropping, size, colors. */
export interface ImageEdit {
  /** Clockwise, in degrees. */
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  /** In the pixels of the rotated and flipped image; null: all of it. */
  crop: Rect | null;
  /** The size of the result in pixels; null: the cropped size. */
  width: number | null;
  height: number | null;
  /** -100…100, 0 leaves the image as it is. */
  brightness: number;
  contrast: number;
  saturation: number;
}

export const NO_EDIT: ImageEdit = {
  rotate: 0,
  flipH: false,
  flipV: false,
  crop: null,
  width: null,
  height: null,
  brightness: 0,
  contrast: 0,
  saturation: 0,
};

/** The size of the image after rotation (a quarter turn swaps the sides). */
export function rotatedSize(width: number, height: number, rotate: number): [number, number] {
  return rotate % 180 === 0 ? [width, height] : [height, width];
}

/** A quarter turn more (or less): 90 and -90. */
export function turn(rotate: ImageEdit['rotate'], by: 90 | -90): ImageEdit['rotate'] {
  return ((((rotate + by) % 360) + 360) % 360) as ImageEdit['rotate'];
}

/** A rectangle inside the image, whole pixels, at least one pixel. */
export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.min(Math.max(0, Math.round(rect.x)), width - 1);
  const y = Math.min(Math.max(0, Math.round(rect.y)), height - 1);
  return {
    x,
    y,
    width: Math.min(Math.max(1, Math.round(rect.width)), width - x),
    height: Math.min(Math.max(1, Math.round(rect.height)), height - y),
  };
}

/** The largest rectangle of a ratio (width / height) centered in the image; null ratio: the whole image. */
export function rectOfRatio(width: number, height: number, ratio: number | null): Rect {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return { x: 0, y: 0, width, height };
  let w = width;
  let h = Math.round(width / ratio);
  if (h > height) {
    h = height;
    w = Math.round(height * ratio);
  }
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), width: w, height: h };
}

/** What the edit gives: the crop in the rotated image and the size of the result. */
export function editGeometry(
  sourceWidth: number,
  sourceHeight: number,
  edit: ImageEdit,
): { crop: Rect; width: number; height: number } {
  const [w, h] = rotatedSize(sourceWidth, sourceHeight, edit.rotate);
  const crop = edit.crop ? clampRect(edit.crop, w, h) : { x: 0, y: 0, width: w, height: h };
  const size = (value: number | null, fallback: number) =>
    value && Number.isFinite(value) ? Math.min(10000, Math.max(1, Math.round(value))) : fallback;
  return { crop, width: size(edit.width, crop.width), height: size(edit.height, crop.height) };
}

/** Whether the edit changes the colors. */
export function hasColorEdit(edit: ImageEdit): boolean {
  return edit.brightness !== 0 || edit.contrast !== 0 || edit.saturation !== 0;
}

/**
 * Brightness, contrast and saturation on RGBA pixels, in place (the same result in every browser,
 * unlike a canvas filter). Alpha stays.
 */
export function adjustPixels(
  data: Uint8ClampedArray,
  { brightness, contrast, saturation }: Pick<ImageEdit, 'brightness' | 'contrast' | 'saturation'>,
): void {
  const b = 1 + clamp100(brightness) / 100;
  const c = 1 + clamp100(contrast) / 100;
  const s = 1 + clamp100(saturation) / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]! * b;
    let g = data[i + 1]! * b;
    let bl = data[i + 2]! * b;
    r = (r - 128) * c + 128;
    g = (g - 128) * c + 128;
    bl = (bl - 128) * c + 128;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    data[i] = gray + (r - gray) * s;
    data[i + 1] = gray + (g - gray) * s;
    data[i + 2] = gray + (bl - gray) * s;
  }
}

function clamp100(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(-100, value)) : 0;
}

/** The type the edited image is saved in: the same for PNG, JPEG and WebP, otherwise PNG. */
export function outputType(type: string): 'image/png' | 'image/jpeg' | 'image/webp' {
  return type === 'image/jpeg' || type === 'image/webp' ? type : 'image/png';
}

/** A file name for the edited image: the original's name with "-edited". */
export function editedName(src: string, type: string): string {
  const ext = type === 'image/jpeg' ? 'jpg' : (type.split('/')[1] ?? 'png');
  let base = 'image';
  try {
    const path = new URL(src, 'https://x.invalid/').pathname;
    const last = decodeURIComponent(path.split('/').pop() ?? '').replace(/\.[a-z0-9]{1,5}$/i, '');
    if (/^[\w.-]{1,80}$/.test(last) && !src.startsWith('data:') && !src.startsWith('blob:'))
      base = last;
  } catch {
    // A malformed address: the default name.
  }
  return `${base.replace(/-edited$/, '')}-edited.${ext}`;
}
