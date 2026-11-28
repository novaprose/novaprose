import type { Node as PMNode } from 'prosemirror-model';
import { attachFilePicker } from './ui/file-picker';
import {
  NodeSelection,
  TextSelection,
  Plugin,
  PluginKey,
  type Command,
  type EditorState,
} from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { insertImage } from './commands';
import type { Editor } from './editor';
import { nodesOf } from './commands';
import { textField } from './ui/dialog';
import { h, icon } from './ui/dom';
import { icons } from './ui/icons';
import { isSafeImageUrl } from './url';

/**
 * Image upload handler (like images_upload_handler): gets a file, returns its URL. progress(0..100)
 * is an optional progress indicator.
 */
export type UploadImageHandler = (
  file: File,
  progress: (percent: number) => void,
) => Promise<string>;

const IMAGE_TYPES = /^image\/(png|jpe?g|gif|webp|avif|bmp)$/;

export function isSupportedImage(file: File): boolean {
  return IMAGE_TYPES.test(file.type);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/** Finds the position of the image with the given src (the document may have changed during the upload). */
function findImage(view: EditorView, src: string): number | null {
  let found: number | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type === nodesOf(view.state).image && node.attrs.src === src) found = pos;
    return true;
  });
  return found;
}

/**
 * Insert and upload image files. While a file uploads, its local copy (blob:) is shown
 * semi-transparent; after the upload src is replaced, and on an error the image is removed with a
 * message. Without uploadImage the image is embedded as a data: URL (as TinyMCE does without a handler).
 */
export function uploadImages(editor: Editor, files: File[], pos?: number): void {
  const images = files.filter(isSupportedImage);
  const view = editor.view;
  for (const file of images) {
    const blobUrl = URL.createObjectURL(file);
    const node = nodesOf(view.state).image.create({ src: blobUrl, alt: null });
    const tr = view.state.tr;
    if (pos !== undefined) tr.insert(Math.min(pos, tr.doc.content.size), node);
    else tr.replaceSelectionWith(node);
    // An image being uploaded is highlighted by the img[src^="blob:"] CSS rule.
    view.dispatch(tr.scrollIntoView());
    startUpload(editor, file, blobUrl, 0);
  }
}

/**
 * The file as it will be uploaded or embedded (the imageOptimize option, on by default): a photo
 * larger than the limit is scaled down and its camera metadata (EXIF, the place it was taken) is
 * left out. A lazy part: it loads with the first image.
 */
export async function prepareImage(editor: Editor, file: File): Promise<File> {
  const option = editor.options.imageOptimize;
  if (option === false) return file;
  try {
    const { optimizeImage } = await import('./image-optimize');
    return await optimizeImage(file, typeof option === 'object' ? option : {});
  } catch {
    return file;
  }
}

/** Pauses before automatic retries: most network failures are temporary. */
export const UPLOAD_RETRY_DELAYS = [1000, 3000];

/** The server returned an unsafe address: retrying won't help. */
class UnsafeUploadUrl extends Error {}

/**
 * Uploads one image with retries. The image (a local blob: copy) stays in the document until
 * its fate is decided: on success src is replaced; on failure, two automatic retries, then a notification with
 * "Retry" and "Remove image" buttons. Closing the notification removes the image: a blob: address must not
 * end up in the saved document.
 */
function startUpload(
  editor: Editor,
  file: File,
  blobUrl: string,
  attempt: number,
  prepared = false,
): void {
  // The file is prepared once (scaled down, without camera metadata); retries reuse it.
  if (!prepared) {
    void prepareImage(editor, file).then((ready) =>
      startUpload(editor, ready, blobUrl, attempt, true),
    );
    return;
  }
  const view = editor.view;
  const { t } = editor.ui;
  const handler = editor.options.uploadImage;
  const notice = handler ? editor.ui.notify({ text: t('image.uploading'), timeout: 0 }) : null;
  const upload = handler
    ? handler(file, (percent) => notice?.setText(`${t('image.uploading')} ${Math.round(percent)}%`))
    : readAsDataUrl(file);

  const release = () => URL.revokeObjectURL(blobUrl);
  const remove = () => {
    const at = view.isDestroyed ? null : findImage(view, blobUrl);
    if (at !== null) view.dispatch(view.state.tr.delete(at, at + 1).setMeta('addToHistory', false));
    release();
  };

  upload
    .then((url) => {
      if (!isSafeImageUrl(url)) throw new UnsafeUploadUrl(`Unsafe image URL returned: ${url}`);
      const at = view.isDestroyed ? null : findImage(view, blobUrl);
      if (at !== null) {
        const current = view.state.doc.nodeAt(at)!;
        // Replacing src must not be a separate undo step.
        view.dispatch(
          view.state.tr
            .setNodeMarkup(at, undefined, { ...current.attrs, src: url })
            .setMeta('addToHistory', false),
        );
      }
      release();
    })
    .catch((error: unknown) => {
      // The editor is closed or the image was already removed: nothing to retry.
      if (view.isDestroyed || findImage(view, blobUrl) === null) return release();
      const delay = UPLOAD_RETRY_DELAYS[attempt];
      if (handler && delay !== undefined && !(error instanceof UnsafeUploadUrl)) {
        const waiting = editor.ui.notify({ text: t('image.retrying'), timeout: 0 });
        setTimeout(() => {
          waiting.close();
          if (view.isDestroyed) return release();
          startUpload(editor, file, blobUrl, attempt + 1, true);
        }, delay);
        return;
      }
      console.error('[nova] image upload failed', error);
      editor.ui.notify({
        text: t('image.uploadFailed'),
        type: 'error',
        actions: [
          { label: t('image.retry'), onAction: () => startUpload(editor, file, blobUrl, 0, true) },
          { label: t('image.delete'), onAction: remove },
        ],
        onClose: remove,
      });
    })
    .finally(() => notice?.close());
}

// ---------- automatic upload of embedded (data:) images ----------

const DATA_IMAGE = /^data:(image\/(?:png|jpe?g|gif|webp|avif|bmp));base64,(.+)$/i;

/** data: URL → File without fetch (CSP connect-src may forbid fetching data:). */
export function dataUrlToFile(src: string, name = 'pasted-image'): File | null {
  const match = src.match(DATA_IMAGE);
  if (!match) return null;
  const type = match[1]!.toLowerCase();
  try {
    const binary = atob(match[2]!);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = type.split('/')[1]!.replace('jpeg', 'jpg');
    return new File([bytes], `${name}.${ext}`, { type });
  } catch {
    return null;
  }
}

/** Replaces src on every image with the given src (without a history step). */
function replaceImageSrc(view: EditorView, from: string, to: string): void {
  const tr = view.state.tr;
  view.state.doc.descendants((node, pos) => {
    if (node.type === nodesOf(view.state).image && node.attrs.src === from) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to });
    }
  });
  if (tr.docChanged) view.dispatch(tr.setMeta('addToHistory', false));
}

/**
 * Uploads an embedded image through uploadImage and replaces the data: URL with the server's address.
 * On error the image stays embedded: no content is lost, and the user sees a notification.
 */
export async function uploadEmbeddedImage(editor: Editor, src: string): Promise<void> {
  const handler = editor.options.uploadImage;
  const embedded = handler ? dataUrlToFile(src) : null;
  if (!handler || !embedded) return;
  const file = await prepareImage(editor, embedded);
  const notice = editor.ui.notify({ text: editor.ui.t('image.uploading'), timeout: 0 });
  try {
    const url = await handler(file, (percent) =>
      notice.setText(`${editor.ui.t('image.uploading')} ${Math.round(percent)}%`),
    );
    if (!isSafeImageUrl(url)) throw new Error(`Unsafe image URL returned: ${url}`);
    replaceImageSrc(editor.view, src, url);
  } catch (error) {
    console.error('[nova] embedded image upload failed', error);
    // The image stays embedded (nothing lost): it can be uploaded to the server later.
    editor.ui.notify({
      text: editor.ui.t('image.uploadFailed'),
      type: 'error',
      actions: [
        {
          label: editor.ui.t('image.retry'),
          onAction: () => void uploadEmbeddedImage(editor, src),
        },
      ],
    });
  } finally {
    notice.close();
  }
}

function dataImageSrcs(doc: PMNode, type: PMNode['type']): Set<string> {
  const srcs = new Set<string>();
  doc.descendants((node) => {
    if (node.type === type && DATA_IMAGE.test(node.attrs.src as string)) srcs.add(node.attrs.src);
  });
  return srcs;
}

/**
 * Embedded images that appear on paste or drop (Word, other applications) are uploaded right away
 * through uploadImage. Without uploadImage they stay embedded, as before.
 */
export function embeddedImageUploadPlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('nova-embedded-image-upload'),
    appendTransaction(transactions, oldState, newState) {
      if (!editor.options.uploadImage) return null;
      const fromUser = transactions.some((tr) =>
        ['paste', 'drop'].includes(tr.getMeta('uiEvent') as string),
      );
      if (!fromUser || !transactions.some((tr) => tr.docChanged)) return null;
      const type = nodesOf(newState).image;
      const before = dataImageSrcs(oldState.doc, type);
      const added = [...dataImageSrcs(newState.doc, type)].filter((src) => !before.has(src));
      // The upload starts after the transaction is applied: the document can't be changed here.
      if (added.length)
        queueMicrotask(() => added.forEach((src) => void uploadEmbeddedImage(editor, src)));
      return null;
    },
  });
}

/** Plugin: images from the clipboard and dropped files. */
export function imageDropPastePlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('nova-image-drop-paste'),
    props: {
      handlePaste(_view, event) {
        if (!editor.isAllowed('image')) return false;
        const data = event.clipboardData;
        if (!data) return false;
        // When copying from Word, the clipboard has both HTML and a screenshot image: take the HTML.
        if (data.getData('text/html')) return false;
        const files = [...data.files].filter(isSupportedImage);
        if (!files.length) return false;
        uploadImages(editor, files);
        return true;
      },
      handleDrop(view, event) {
        if (!editor.isAllowed('image')) return false;
        const files = [...(event.dataTransfer?.files ?? [])].filter(isSupportedImage);
        if (!files.length) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        uploadImages(editor, files, coords?.pos);
        return true;
      },
    },
  });
}

/** The insert image dialog: upload a file or enter a URL, plus the alt text that should always be there. */
export function openImageDialog(editor: Editor): void {
  const { t } = editor.ui;
  const fileInput = h('input', {
    type: 'file',
    accept: 'image/png,image/jpeg,image/gif,image/webp,image/avif',
    className: 'nova-visually-hidden',
    tabindex: '-1',
    // Choosing a file goes through the visible area below; the field itself is hidden, but it must have a label.
    'aria-label': t('image.drop'),
    'aria-hidden': 'true',
  });
  const dropzone = h(
    'button',
    { type: 'button', className: 'nova-dropzone' },
    icon(icons.upload),
    h('span', {}, t('image.drop')),
  );
  const url = textField({ label: t('image.url'), type: 'url', placeholder: 'https://' });
  const alt = textField({ label: t('image.alt'), hint: t('image.altHint') });
  attachFilePicker(editor, url, 'image', (picked) => {
    if (picked.alt) alt.input.value = picked.alt;
  });

  const body = h(
    'div',
    { className: 'nova-form' },
    dropzone,
    fileInput,
    h('div', { className: 'nova-divider' }, h('span', {}, t('image.or'))),
    url.el,
    alt.el,
  );

  const dialog = editor.ui.openDialog({
    title: t('image.title'),
    body,
    submitLabel: t('dialog.insert'),
    initialFocus: url.input,
    onSubmit: () => {
      const src = url.input.value.trim();
      if (!src || !isSafeImageUrl(src)) {
        url.input.setAttribute('aria-invalid', 'true');
        url.input.focus();
        return t('image.invalid');
      }
      editor.exec(insertImage(src, alt.input.value.trim() || undefined));
      return true;
    },
  });

  const takeFiles = (files: File[]) => {
    const images = files.filter(isSupportedImage);
    if (!images.length) return;
    dialog.close();
    uploadImages(editor, images);
  };

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => takeFiles([...(fileInput.files ?? [])]));
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    takeFiles([...(event.dataTransfer?.files ?? [])]);
  });
}

// ---------- the selected image: size, alignment, alt ----------

/** The selected image: the node (image or figure), its position and the image's attributes. */
export interface SelectedImage {
  node: PMNode;
  pos: number;
  /** src, alt, title, width, height, align — for figure, collected from figure and figure_image. */
  attrs: Record<string, unknown>;
}

/**
 * The selected image: an image in a line, an image with a caption (figure), or the caption the
 * cursor is in. The image toolbar actions (alignment, size, alt) work for both.
 */
export function getSelectedImage(state: EditorState): SelectedImage | null {
  const { selection } = state;
  const nodes = nodesOf(state);
  const result = (node: PMNode, pos: number): SelectedImage =>
    node.type === nodes.figure
      ? { node, pos, attrs: { ...node.firstChild?.attrs, align: node.attrs.align } }
      : { node, pos, attrs: node.attrs };
  if (
    selection instanceof NodeSelection &&
    (selection.node.type === nodes.image || selection.node.type === nodes.figure)
  ) {
    return result(selection.node, selection.from);
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === nodes.figure)
      return result($from.node(depth), $from.before(depth));
  }
  return null;
}

/** Whether the selected image has a caption. */
export function hasImageCaption(state: EditorState): boolean {
  return getSelectedImage(state)?.node.type === nodesOf(state).figure;
}

const IMAGE_ATTRS = ['src', 'alt', 'title', 'width', 'height'] as const;
const pick = (attrs: Record<string, unknown>) =>
  Object.fromEntries(IMAGE_ATTRS.map((name) => [name, attrs[name] ?? null]));

/**
 * Turns the caption of the selected image on or off.
 * On: the image becomes a separate <figure> block, the cursor goes into the caption.
 * Off: the image returns into a paragraph; the caption text isn't lost, it becomes a paragraph below.
 */
export const toggleImageCaption: Command = (state, dispatch) => {
  const image = getSelectedImage(state);
  if (!image) return false;
  const nodes = nodesOf(state);
  const { pos, node, attrs } = image;
  if (!dispatch) return true;
  const tr = state.tr;

  if (node.type === nodes.figure) {
    const inline = nodes.image.create({ ...pick(attrs), align: attrs.align ?? null });
    const blocks = [nodes.paragraph.create(null, inline)];
    const caption = node.child(1);
    if (caption.content.size) blocks.push(nodes.paragraph.create(null, caption.content));
    tr.replaceWith(pos, pos + node.nodeSize, blocks);
    tr.setSelection(NodeSelection.create(tr.doc, pos + 1));
    dispatch(tr.scrollIntoView());
    return true;
  }

  // An image inside a line: move it out as a block after its paragraph (the paragraph without it stays if not empty).
  const $pos = state.doc.resolve(pos);
  const blockStart = $pos.before($pos.depth);
  const blockEnd = $pos.after($pos.depth);
  const figure = nodes.figure.create({ align: attrs.align ?? null }, [
    nodes.figure_image.create(pick(attrs)),
    nodes.figcaption.create(),
  ]);
  // Cursor in the caption: into the figure (+1), the image (+1), into the caption (+1).
  const CAPTION = 3;
  if ($pos.parent.childCount === 1) {
    tr.replaceWith(blockStart, blockEnd, figure);
    tr.setSelection(TextSelection.create(tr.doc, blockStart + CAPTION));
  } else {
    tr.insert(blockEnd, figure);
    tr.delete(pos, pos + node.nodeSize);
    // -1: the position before the figure just inserted (not after it).
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(blockEnd, -1) + CAPTION));
  }
  dispatch(tr.scrollIntoView());
  return true;
};

/** Enter in a caption makes a new paragraph after the image (a caption is one line, as in Word). */
export const exitImageCaption: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.parent.type !== nodesOf(state).figcaption) return false;
  if (dispatch) {
    const after = $from.after($from.depth - 1);
    const tr = state.tr.insert(after, nodesOf(state).paragraph.create());
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * Change the attributes of the selected image. For figure, alignment goes on figure and the rest
 * on the image inside. Selection: an image in a line stays selected as a node; for figure the
 * cursor isn't touched (you can keep typing the caption).
 */
export function setImageAttrs(
  attrs: Partial<Record<'alt' | 'title' | 'width' | 'height' | 'align', unknown>>,
): Command {
  return (state, dispatch) => {
    const image = getSelectedImage(state);
    if (!image) return false;
    if (dispatch) {
      const tr = state.tr;
      if (image.node.type === nodesOf(state).figure) {
        const { align, ...rest } = attrs;
        if (align !== undefined) {
          tr.setNodeMarkup(image.pos, undefined, { ...image.node.attrs, align });
        }
        if (Object.keys(rest).length) {
          const inner = image.node.firstChild!;
          tr.setNodeMarkup(image.pos + 1, undefined, { ...inner.attrs, ...rest });
        }
      } else {
        tr.setNodeMarkup(image.pos, undefined, { ...image.node.attrs, ...attrs });
        tr.setSelection(NodeSelection.create(tr.doc, image.pos));
      }
      dispatch(tr);
    }
    return true;
  };
}

/** Image width as a fraction of the text area width (aspect ratio kept); null — the original size. */
export function setImageWidthFraction(editor: Editor, fraction: number | null): boolean {
  const image = getSelectedImage(editor.view.state);
  if (!image) return false;
  if (fraction === null) return editor.exec(setImageAttrs({ width: null, height: null }));
  const dom = editor.view.nodeDOM(image.pos) as HTMLElement | null;
  const img = dom?.querySelector('img') ?? null;
  const style = getComputedStyle(editor.view.dom);
  const contentWidth =
    editor.view.dom.clientWidth -
    parseFloat(style.paddingLeft || '0') -
    parseFloat(style.paddingRight || '0');
  const width = Math.max(24, Math.round(contentWidth * fraction));
  const ratio = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : null;
  return editor.exec(setImageAttrs({ width, height: ratio ? Math.round(width * ratio) : null }));
}

/** An image to describe and the text around it in the document. */
export interface DescribedImage {
  src: string;
  before: string;
  after: string;
}

/** Something that writes alternative text for an image (the ai plugin registers one). */
export interface AltTextSuggester {
  /** The button's label and what it says while it works. */
  label: string;
  busy: string;
  /** Said when nothing came back. */
  failed: string;
  run: (image: DescribedImage, signal: AbortSignal) => Promise<string>;
}

const altSuggesters = new WeakMap<Editor, AltTextSuggester>();

/** Puts a "describe" button next to the alternative text field of the image dialogs. */
export function setAltTextSuggester(editor: Editor, suggester: AltTextSuggester | null): void {
  if (suggester) altSuggesters.set(editor, suggester);
  else altSuggesters.delete(editor);
}

/** The suggester's button for an alt field: fills the field, the author reviews it. */
function suggestAltButton(
  editor: Editor,
  image: SelectedImage,
  field: HTMLInputElement,
  setError: (message: string | null) => void,
): HTMLElement | null {
  const suggester = altSuggesters.get(editor);
  if (!suggester) return null;
  const doc = editor.view.state.doc;
  const button = h(
    'button',
    { type: 'button', className: 'nova-button nova-alt-suggest' },
    suggester.label,
  );
  let running: AbortController | null = null;
  button.addEventListener('click', async () => {
    if (running) return;
    running = new AbortController();
    button.disabled = true;
    button.textContent = suggester.busy;
    setError(null);
    try {
      const text = await suggester.run(
        {
          src: String(image.attrs.src ?? ''),
          before: doc.textBetween(Math.max(0, image.pos - 600), image.pos, '\n\n', ' '),
          after: doc.textBetween(
            image.pos + image.node.nodeSize,
            Math.min(doc.content.size, image.pos + image.node.nodeSize + 600),
            '\n\n',
            ' ',
          ),
        },
        running.signal,
      );
      if (!button.isConnected) return;
      if (text) {
        field.value = text;
        field.focus();
        field.select();
        editor.ui.announce(text);
      } else setError(suggester.failed);
    } catch {
      if (button.isConnected) setError(suggester.failed);
    } finally {
      running = null;
      button.disabled = false;
      button.textContent = suggester.label;
    }
  });
  return button;
}

/** The alternative text dialog — the most important accessibility setting of an image. */
export function openImageAltDialog(editor: Editor): void {
  const image = getSelectedImage(editor.view.state);
  if (!image) return;
  const { t } = editor.ui;
  const alt = textField({
    label: t('image.alt'),
    value: String(image.attrs.alt ?? ''),
    hint: t('image.altHint'),
  });
  const title = textField({ label: t('link.tooltip'), value: String(image.attrs.title ?? '') });
  let handle: { setError(message: string | null): void } | null = null;
  const describe = suggestAltButton(editor, image, alt.input, (message) =>
    handle?.setError(message),
  );
  if (describe) alt.el.append(describe);
  handle = editor.ui.openDialog({
    title: t('image.editAlt'),
    body: h('div', { className: 'nova-form' }, alt.el, title.el),
    submitLabel: t('dialog.save'),
    initialFocus: alt.input,
    onSubmit: () => {
      editor.exec(
        setImageAttrs({
          alt: alt.input.value.trim() || null,
          title: title.input.value.trim() || null,
        }),
      );
      return true;
    },
  });
}
