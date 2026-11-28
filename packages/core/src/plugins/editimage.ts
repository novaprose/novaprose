import { closeHistory } from 'prosemirror-history';
import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection } from 'prosemirror-state';
import type { Editor } from '../editor';
import { nodesOf } from '../commands';
import { dataUrlToFile, getSelectedImage } from '../image';
import { definePlugin } from '../plugins';
import { h, icon } from '../ui/dom';
import { isSafeImageUrl } from '../url';
import css from './editimage.css?raw';
import {
  adjustPixels,
  clampRect,
  editedName,
  editGeometry,
  hasColorEdit,
  NO_EDIT,
  outputType,
  rectOfRatio,
  rotatedSize,
  turn,
  type ImageEdit,
  type Rect,
} from './editimage-pixels';
import { pickLabels } from './shared';

/**
 * The editimage plugin (image editing, named as in TinyMCE): the image's toolbar rotates and flips
 * it, and "Edit image" crops it, changes its size and its brightness, contrast and saturation. The
 * edited image is a new file: it goes through `uploadImage` like any image (or is embedded without
 * it), and one undo brings the original back. `plugins: ['editimage']`.
 *
 * The pixels are read with fetch, so an image on another site can be edited only when that site
 * allows it (CORS); `fetchImage` can get it through your server instead. SVG isn't edited: it can
 * hold scripts, and its pixels are drawing instructions.
 */

export const LABELS = {
  en: {
    rotateLeft: 'Rotate left',
    rotateRight: 'Rotate right',
    flipH: 'Flip horizontally',
    flipV: 'Flip vertically',
    edit: 'Edit image',
    reset: 'Start over',
    apply: 'Apply',
    preview: 'The image with the changes',
    crop: 'Crop',
    shape: 'Shape',
    free: 'Free',
    original: 'As the image',
    square: 'Square',
    left: 'Left, px',
    top: 'Top, px',
    width: 'Width, px',
    height: 'Height, px',
    size: 'Size',
    keepRatio: 'Keep the proportions',
    colors: 'Colors',
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
    working: 'Editing the image…',
    unreadable:
      'This image is on a site that doesn’t allow editing it here. Save it and insert it again to edit it.',
    unsupported: 'Only PNG, JPEG, WebP, GIF, AVIF and BMP images can be edited.',
    failed: 'The edited image couldn’t be saved.',
  },
};

type Labels = typeof LABELS.en;

export interface EditImageOptions {
  /** Your way to get an image's file, through your server for images on other sites. */
  fetchImage?: (src: string) => Promise<Blob>;
  /** Sites whose images are fetched with the reader's cookies (they must allow it with CORS). */
  credentialsHosts?: string[];
  /** The quality of a saved JPEG or WebP, 0 to 1 (0.92). */
  quality?: number;
  /** The buttons added to the image's toolbar ('rotateleft rotateright | flipv fliph | editimage'). */
  toolbar?: string;
}

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICONS = {
  rotateLeft: svg('<path d="M3 4v5h5"/><path d="M3.5 9A8.5 8.5 0 1 1 6 16.5"/>'),
  rotateRight: svg('<path d="M21 4v5h-5"/><path d="M20.5 9A8.5 8.5 0 1 0 18 16.5"/>'),
  flipH: svg('<path d="M12 3v18"/><path d="M9 7 4 12l5 5V7Z"/><path d="M15 7v10l5-5-5-5Z"/>'),
  flipV: svg('<path d="M3 12h18"/><path d="M7 9l5-5 5 5H7Z"/><path d="M7 15h10l-5 5-5-5Z"/>'),
  edit: svg(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/><path d="M14 3v4"/><path d="M12 5h4"/>',
  ),
};

const EDITABLE = /^image\/(png|jpe?g|gif|webp|avif|bmp)$/;

class UnreadableImage extends Error {}
class UnsupportedImage extends Error {}

const isBlob = (value: unknown): value is Blob =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as Blob).slice === 'function' &&
  typeof (value as Blob).type === 'string' &&
  typeof (value as Blob).size === 'number';

/** The type of an image from its first bytes, when the server didn't say (or said something generic). */
async function sniffType(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const at = (i: number, ...values: number[]) => values.every((v, k) => bytes[i + k] === v);
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  if (at(0, 0x42, 0x4d)) return 'image/bmp';
  if (at(4, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66)) return 'image/avif';
  return '';
}

/** The image's file: through `fetchImage`, from a data: address, or with fetch (CORS for other sites). */
async function loadImage(src: string, options: EditImageOptions): Promise<Blob> {
  let blob: Blob;
  if (typeof options.fetchImage === 'function') {
    blob = await options.fetchImage(src);
  } else if (/^data:/i.test(src)) {
    const file = dataUrlToFile(src);
    if (!file) throw new UnsupportedImage('not an editable data: image');
    blob = file;
  } else {
    let url: URL;
    try {
      url = new URL(src, document.baseURI);
    } catch {
      throw new UnsupportedImage('a malformed address');
    }
    if (!['http:', 'https:', 'blob:'].includes(url.protocol)) throw new UnsupportedImage(src);
    const own = url.origin === location.origin || url.protocol === 'blob:';
    const hosts = Array.isArray(options.credentialsHosts) ? options.credentialsHosts : [];
    const credentials: RequestCredentials = own
      ? 'same-origin'
      : hosts.includes(url.hostname)
        ? 'include'
        : 'omit';
    let response: Response;
    try {
      response = await fetch(url.href, { credentials });
    } catch (error) {
      throw new UnreadableImage(String(error));
    }
    if (!response.ok) throw new UnreadableImage(`${response.status}`);
    blob = await response.blob();
  }
  // By its shape, not instanceof: a file from another window (an iframe) is a Blob too.
  if (!isBlob(blob)) throw new UnreadableImage('no file');
  const declared = blob.type.toLowerCase();
  // An SVG is never edited, whatever its bytes; a generic type is checked by the bytes.
  if (declared.includes('svg')) throw new UnsupportedImage('svg');
  const type = EDITABLE.test(declared) ? declared : await sniffType(blob);
  if (!EDITABLE.test(type)) throw new UnsupportedImage(type || 'unknown');
  return type === declared ? blob : new Blob([blob], { type });
}

/** Draws the image rotated and flipped (as the edit shows it) on a canvas of its full size. */
function drawTurned(bitmap: ImageBitmap, edit: ImageEdit, scale = 1): HTMLCanvasElement {
  const [w, h] = rotatedSize(bitmap.width, bitmap.height, edit.rotate);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  // Flips after the turn: they mirror the image as it is seen.
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1);
  ctx.rotate((edit.rotate * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return canvas;
}

/** The edited image as a file of the given type. */
async function renderEdit(
  bitmap: ImageBitmap,
  edit: ImageEdit,
  type: string,
  quality: number,
): Promise<Blob> {
  const { crop, width, height } = editGeometry(bitmap.width, bitmap.height, edit);
  const turned = drawTurned(bitmap, edit);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(turned, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  if (hasColorEdit(edit)) {
    const pixels = ctx.getImageData(0, 0, width, height);
    adjustPixels(pixels.data, edit);
    ctx.putImageData(pixels, 0, 0);
  }
  return new Promise((resolve, reject) =>
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('the canvas gave no file'))),
      type,
      quality,
    ),
  );
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/** The image node with that address (an image in a line or in a figure); the remembered place first. */
function findImageNode(editor: Editor, src: string, near?: number): number | null {
  const { doc } = editor.view.state;
  const nodes = nodesOf(editor.view.state);
  const isImage = (node: PMNode | null | undefined) =>
    !!node &&
    (node.type === nodes.image || node.type === nodes.figure_image) &&
    node.attrs.src === src;
  if (near !== undefined && near >= 0 && near < doc.content.size && isImage(doc.nodeAt(near)))
    return near;
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (isImage(node)) found = pos;
    return true;
  });
  return found;
}

/** The selected image's own node: the image, or the image inside a figure. */
function selectedImageNode(editor: Editor): { pos: number; node: PMNode } | null {
  const selected = getSelectedImage(editor.view.state);
  if (!selected) return null;
  const nodes = nodesOf(editor.view.state);
  if (selected.node.type === nodes.figure) {
    const inner = selected.node.firstChild;
    return inner ? { pos: selected.pos + 1, node: inner } : null;
  }
  return { pos: selected.pos, node: selected.node };
}

function setAttrs(
  editor: Editor,
  pos: number,
  attrs: Record<string, unknown>,
  history: boolean,
  select: boolean,
): void {
  const { state } = editor.view;
  const node = state.doc.nodeAt(pos);
  if (!node) return;
  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
  if (select && node.type === nodesOf(state).image)
    tr.setSelection(NodeSelection.create(tr.doc, pos));
  // Every edit is its own undo step, however quickly the next one follows.
  if (history) closeHistory(tr);
  else tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
}

/**
 * Puts the edited file in place of the image: as one undo step, shown at once (a local copy while
 * it uploads). If the upload fails, the image goes back to the original: nothing is lost.
 */
async function replaceImage(
  editor: Editor,
  labels: Labels,
  at: { pos: number; node: PMNode },
  file: File,
  size: { width: number | null; height: number | null },
): Promise<void> {
  const original = {
    src: at.node.attrs.src,
    width: at.node.attrs.width,
    height: at.node.attrs.height,
  };
  const handler = editor.options.uploadImage;
  // Read before finding the image: the document may change while the file is read.
  const embedded = handler ? null : await readAsDataUrl(file);
  const pos = findImageNode(editor, String(original.src), at.pos);
  if (pos === null) return;
  if (!handler) {
    setAttrs(editor, pos, { src: embedded, ...size }, true, true);
    // The image stays selected, with its toolbar: the next edit is one click away.
    editor.focus();
    return;
  }
  const local = URL.createObjectURL(file);
  setAttrs(editor, pos, { src: local, ...size }, true, true);
  editor.focus();
  try {
    const url = await handler(file, () => {});
    if (!isSafeImageUrl(url)) throw new Error(`Unsafe image URL returned: ${url}`);
    const now = findImageNode(editor, local);
    if (now !== null) setAttrs(editor, now, { src: url }, false, false);
  } catch (error) {
    console.error('[nova] editimage: the upload failed', error);
    const now = findImageNode(editor, local);
    if (now !== null) setAttrs(editor, now, original, false, false);
    editor.ui.notify({ text: labels.failed, type: 'error' });
  } finally {
    URL.revokeObjectURL(local);
  }
}

/** The display size after the edit: the same scale as before; null when it had none or was resized. */
function displaySize(
  node: PMNode,
  bitmap: ImageBitmap,
  edit: ImageEdit,
): { width: number | null; height: number | null } {
  const { width, height } = editGeometry(bitmap.width, bitmap.height, edit);
  const shown = Number(node.attrs.width);
  if (!shown || edit.width !== null || edit.height !== null) return { width: null, height: null };
  const scale = shown / bitmap.width;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: node.attrs.height ? Math.max(1, Math.round(height * scale)) : null,
  };
}

function problem(error: unknown, labels: Labels): string {
  if (error instanceof UnsupportedImage) return labels.unsupported;
  if (error instanceof UnreadableImage) return labels.unreadable;
  return labels.failed;
}

export default definePlugin({
  name: 'editimage',
  setup(editor) {
    const labels = pickLabels(editor, 'editimage', LABELS);
    const options = (editor.options.pluginOptions?.editimage ?? {}) as EditImageOptions;
    const quality = Number.isFinite(options.quality)
      ? Math.min(1, Math.max(0.1, options.quality!))
      : 0.92;
    editor.ui.addStyles('nova-editimage', css);

    /** Applies an edit to the selected image (the file already read when the dialog had it). */
    const apply = async (
      edit: ImageEdit,
      read?: { blob: Blob; bitmap: ImageBitmap; at: { pos: number; node: PMNode } },
    ) => {
      const at = read?.at ?? selectedImageNode(editor);
      if (!at) return;
      const notice = editor.ui.notify({ text: labels.working, timeout: 0 });
      try {
        const blob = read?.blob ?? (await loadImage(String(at.node.attrs.src), options));
        const bitmap = read?.bitmap ?? (await createImageBitmap(blob));
        const type = outputType(blob.type);
        const result = await renderEdit(bitmap, edit, type, quality);
        const file = new File([result], editedName(String(at.node.attrs.src), type), { type });
        await replaceImage(editor, labels, at, file, displaySize(at.node, bitmap, edit));
      } catch (error) {
        console.warn('[nova] editimage:', error);
        editor.ui.notify({ text: problem(error, labels), type: 'error' });
      } finally {
        notice.close();
      }
    };

    const quick = (name: string, label: string, svgIcon: string, edit: Partial<ImageEdit>) => {
      editor.ui.registry.addButton(name, {
        icon: svgIcon,
        tooltip: label,
        isEnabled: (e) => e.isEditable() && !!selectedImageNode(e),
        onAction: () => void apply({ ...NO_EDIT, ...edit }),
      });
    };
    quick('rotateleft', labels.rotateLeft, ICONS.rotateLeft, { rotate: 270 });
    quick('rotateright', labels.rotateRight, ICONS.rotateRight, { rotate: 90 });
    quick('fliph', labels.flipH, ICONS.flipH, { flipH: true });
    quick('flipv', labels.flipV, ICONS.flipV, { flipV: true });

    const openEditor = async () => {
      const at = selectedImageNode(editor);
      if (!at) return;
      let blob: Blob;
      let bitmap: ImageBitmap;
      try {
        blob = await loadImage(String(at.node.attrs.src), options);
        bitmap = await createImageBitmap(blob);
      } catch (error) {
        console.warn('[nova] editimage:', error);
        editor.ui.notify({ text: problem(error, labels), type: 'error' });
        return;
      }
      openEditDialog(editor, labels, bitmap, (edit) => void apply(edit, { blob, bitmap, at }));
    };
    editor.ui.registry.addButton('editimage', {
      icon: ICONS.edit,
      tooltip: labels.edit,
      isEnabled: (e) => e.isEditable() && !!selectedImageNode(e),
      onAction: () => void openEditor(),
    });

    // The buttons join the image's toolbar.
    const toolbar =
      typeof options.toolbar === 'string'
        ? options.toolbar
        : 'rotateleft rotateright | flipv fliph | editimage';
    const image = editor.ui.registry.getContextToolbars().find(([name]) => name === 'image')?.[1];
    if (image && toolbar.trim())
      editor.ui.registry.addContextToolbar('image', {
        ...image,
        items: `${image.items} | ${toolbar}`,
      });
  },
});

/** The Edit image dialog: a preview with the crop on it, the crop and size fields and the colors. */
function openEditDialog(
  editor: Editor,
  labels: Labels,
  bitmap: ImageBitmap,
  onApply: (edit: ImageEdit) => void,
): void {
  let edit: ImageEdit = { ...NO_EDIT };
  let ratio: number | null = null;
  const MAX_W = 620;
  const MAX_H = 320;

  const canvas = h('canvas', { className: 'nova-editimage-canvas' });
  const cropBox = h('div', { className: 'nova-editimage-crop', 'aria-hidden': 'true' });
  const stage = h(
    'div',
    { className: 'nova-editimage-stage', role: 'img', 'aria-label': labels.preview },
    canvas,
    cropBox,
  );

  const num = (label: string, min = 0) => {
    const input = h('input', {
      type: 'number',
      className: 'nova-input',
      min: String(min),
      step: '1',
      inputmode: 'numeric',
    }) as HTMLInputElement;
    const field = h('label', { className: 'nova-editimage-field' }, h('span', {}, label), input);
    return { input, field };
  };
  const range = (label: string) => {
    const input = h('input', { type: 'range', min: '-100', max: '100', step: '1', value: '0' });
    const output = h('output', { className: 'nova-editimage-value' }, '0');
    const field = h(
      'label',
      { className: 'nova-editimage-field nova-editimage-range' },
      h('span', {}, label),
      input,
      output,
    );
    return { input: input as HTMLInputElement, output, field };
  };
  const shape = h(
    'select',
    { className: 'nova-input' },
    ...[
      ['', labels.free],
      ['original', labels.original],
      ['1', labels.square],
      [String(4 / 3), '4:3'],
      [String(3 / 2), '3:2'],
      [String(16 / 9), '16:9'],
    ].map(([value, text]) => h('option', { value: value! }, text!)),
  ) as HTMLSelectElement;
  const x = num(labels.left);
  const y = num(labels.top);
  const cw = num(labels.width, 1);
  const ch = num(labels.height, 1);
  const ow = num(labels.width, 1);
  const oh = num(labels.height, 1);
  const keep = h('input', {
    type: 'checkbox',
    className: 'nova-checkbox',
    checked: true,
  }) as HTMLInputElement;
  const brightness = range(labels.brightness);
  const contrast = range(labels.contrast);
  const saturation = range(labels.saturation);

  const tool = (svgIcon: string, label: string, run: () => void) => {
    const button = h(
      'button',
      { type: 'button', className: 'nova-btn', 'aria-label': label, 'data-tooltip': label },
      icon(svgIcon, editor.ui.registry),
    );
    button.addEventListener('click', run);
    editor.ui.tooltip.attach(button);
    return button;
  };
  const reset = h('button', { type: 'button', className: 'nova-button' }, labels.reset);

  /** The size of the turned image and the crop in it. */
  const turned = () => rotatedSize(bitmap.width, bitmap.height, edit.rotate);
  const currentCrop = (): Rect => {
    const [w, hgt] = turned();
    return edit.crop ? clampRect(edit.crop, w, hgt) : { x: 0, y: 0, width: w, height: hgt };
  };

  let scale = 1;
  let frame = 0;
  const draw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const [w, hgt] = turned();
      const room = Math.min(MAX_W, stage.parentElement?.clientWidth || MAX_W);
      scale = Math.min(1, room / w, MAX_H / hgt);
      const preview = drawTurned(bitmap, edit, scale);
      canvas.width = preview.width;
      canvas.height = preview.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(preview, 0, 0);
      if (hasColorEdit(edit)) {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        adjustPixels(pixels.data, edit);
        ctx.putImageData(pixels, 0, 0);
      }
      const crop = currentCrop();
      cropBox.hidden = !edit.crop;
      cropBox.style.left = `${crop.x * scale}px`;
      cropBox.style.top = `${crop.y * scale}px`;
      cropBox.style.width = `${crop.width * scale}px`;
      cropBox.style.height = `${crop.height * scale}px`;
    });
  };

  /** The fields from the edit. */
  const fill = () => {
    const crop = currentCrop();
    x.input.value = String(crop.x);
    y.input.value = String(crop.y);
    cw.input.value = String(crop.width);
    ch.input.value = String(crop.height);
    const { width, height } = editGeometry(bitmap.width, bitmap.height, edit);
    ow.input.value = String(width);
    oh.input.value = String(height);
    for (const [r, value] of [
      [brightness, edit.brightness],
      [contrast, edit.contrast],
      [saturation, edit.saturation],
    ] as const) {
      r.input.value = String(value);
      r.output.textContent = String(value);
    }
    draw();
  };

  const setCrop = (rect: Rect | null) => {
    const [w, hgt] = turned();
    const crop = rect ? clampRect(rect, w, hgt) : null;
    const whole = crop && crop.x === 0 && crop.y === 0 && crop.width === w && crop.height === hgt;
    // A new crop: the size follows it again.
    edit = { ...edit, crop: whole ? null : crop, width: null, height: null };
    fill();
  };

  const shapeRatio = (): number | null => {
    if (!shape.value) return null;
    if (shape.value === 'original') {
      const [w, hgt] = turned();
      return w / hgt;
    }
    return Number(shape.value) || null;
  };

  // Tools: turning and flipping reset the crop (it was in the old orientation).
  const tools = h(
    'div',
    { className: 'nova-editimage-tools', role: 'toolbar', 'aria-label': labels.edit },
    tool(ICONS.rotateLeft, labels.rotateLeft, () => {
      edit = { ...edit, rotate: turn(edit.rotate, -90), crop: null, width: null, height: null };
      fill();
    }),
    tool(ICONS.rotateRight, labels.rotateRight, () => {
      edit = { ...edit, rotate: turn(edit.rotate, 90), crop: null, width: null, height: null };
      fill();
    }),
    tool(ICONS.flipH, labels.flipH, () => {
      edit = { ...edit, flipH: !edit.flipH, crop: null, width: null, height: null };
      fill();
    }),
    tool(ICONS.flipV, labels.flipV, () => {
      edit = { ...edit, flipV: !edit.flipV, crop: null, width: null, height: null };
      fill();
    }),
    h('span', { className: 'nova-bubble-sep', role: 'separator' }),
    reset,
  );
  reset.addEventListener('click', () => {
    edit = { ...NO_EDIT };
    shape.value = '';
    ratio = null;
    fill();
  });

  shape.addEventListener('change', () => {
    ratio = shapeRatio();
    const [w, hgt] = turned();
    setCrop(ratio ? rectOfRatio(w, hgt, ratio) : null);
  });
  const fromCropFields = () => {
    const width = Number(cw.input.value) || 1;
    const height = ratio ? Math.round(width / ratio) : Number(ch.input.value) || 1;
    setCrop({ x: Number(x.input.value) || 0, y: Number(y.input.value) || 0, width, height });
  };
  for (const field of [x, y, cw, ch]) field.input.addEventListener('change', fromCropFields);
  ow.input.addEventListener('change', () => {
    const crop = currentCrop();
    const width = Math.max(1, Number(ow.input.value) || crop.width);
    const height = keep.checked
      ? Math.max(1, Math.round((width * crop.height) / crop.width))
      : Number(oh.input.value) || crop.height;
    edit = { ...edit, width, height };
    fill();
  });
  oh.input.addEventListener('change', () => {
    const crop = currentCrop();
    const height = Math.max(1, Number(oh.input.value) || crop.height);
    const width = keep.checked
      ? Math.max(1, Math.round((height * crop.width) / crop.height))
      : Number(ow.input.value) || crop.width;
    edit = { ...edit, width, height };
    fill();
  });
  for (const [r, key] of [
    [brightness, 'brightness'],
    [contrast, 'contrast'],
    [saturation, 'saturation'],
  ] as const) {
    r.input.addEventListener('input', () => {
      edit = { ...edit, [key]: Number(r.input.value) || 0 };
      r.output.textContent = r.input.value;
      draw();
    });
  }

  // Cropping with a pointer: drag a new area, or move the one there is.
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const box = canvas.getBoundingClientRect();
    const toImage = (e: PointerEvent) => ({
      x: Math.min(Math.max(0, (e.clientX - box.left) / scale), turned()[0]),
      y: Math.min(Math.max(0, (e.clientY - box.top) / scale), turned()[1]),
    });
    const start = toImage(event);
    const crop = currentCrop();
    const moving =
      !!edit.crop &&
      start.x >= crop.x &&
      start.x <= crop.x + crop.width &&
      start.y >= crop.y &&
      start.y <= crop.y + crop.height;
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
    const onMove = (e: PointerEvent) => {
      const p = toImage(e);
      if (moving) {
        setCrop({ ...crop, x: crop.x + p.x - start.x, y: crop.y + p.y - start.y });
        return;
      }
      const width = Math.abs(p.x - start.x);
      const height = ratio ? width / ratio : Math.abs(p.y - start.y);
      if (width < 4 || height < 4) return;
      setCrop({
        x: p.x < start.x ? start.x - width : start.x,
        y: p.y < start.y ? start.y - height : start.y,
        width,
        height,
      });
    };
    const onUp = () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
  });

  const group = (title: string, ...children: HTMLElement[]) =>
    h('fieldset', { className: 'nova-editimage-group' }, h('legend', {}, title), ...children);
  const body = h(
    'div',
    { className: 'nova-editimage' },
    tools,
    stage,
    group(
      labels.crop,
      h('label', { className: 'nova-editimage-field' }, h('span', {}, labels.shape), shape),
      x.field,
      y.field,
      cw.field,
      ch.field,
    ),
    group(
      labels.size,
      ow.field,
      oh.field,
      h('label', { className: 'nova-editimage-check' }, keep, h('span', {}, labels.keepRatio)),
    ),
    group(labels.colors, brightness.field, contrast.field, saturation.field),
  );

  editor.ui.openDialog({
    title: labels.edit,
    body,
    size: 'large',
    submitLabel: labels.apply,
    onSubmit: () => {
      onApply({ ...edit });
      return true;
    },
  });
  fill();
}
