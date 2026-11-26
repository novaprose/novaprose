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
 * Загрузчик изображений (аналог images_upload_handler): получает файл, возвращает URL.
 * progress(0..100) — необязательный индикатор.
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

/** Найти позицию картинки с данным src (нужно, т.к. документ мог измениться за время загрузки). */
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
 * Вставить и загрузить файлы изображений. Пока файл грузится, показываем его локальную копию
 * (blob:) полупрозрачной; после загрузки подменяем src, при ошибке — убираем и сообщаем.
 * Без uploadImage картинка встраивается как data:URL (как делает TinyMCE без обработчика).
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
    // Загружаемая картинка подсвечивается CSS-правилом img[src^="blob:"].
    view.dispatch(tr.scrollIntoView());
    startUpload(editor, file, blobUrl, 0);
  }
}

/** Паузы перед автоматическими повторами: большинство сбоев сети временные. */
export const UPLOAD_RETRY_DELAYS = [1000, 3000];

/** Сервер вернул небезопасный адрес — повтор не поможет. */
class UnsafeUploadUrl extends Error {}

/**
 * Загрузка одной картинки с повторами. Картинка (локальная blob:-копия) остаётся в документе, пока
 * её судьба не решена: успех — подмена src; сбой — два автоповтора, затем уведомление с кнопками
 * «Повторить» и «Убрать картинку». Закрыли уведомление — картинка убирается: blob:-адрес не должен
 * попасть в сохранённый документ.
 */
function startUpload(editor: Editor, file: File, blobUrl: string, attempt: number): void {
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
        // Подмена src не должна быть отдельным шагом undo.
        view.dispatch(
          view.state.tr
            .setNodeMarkup(at, undefined, { ...current.attrs, src: url })
            .setMeta('addToHistory', false),
        );
      }
      release();
    })
    .catch((error: unknown) => {
      // Редактор закрыт или картинку уже удалили — повторять нечего.
      if (view.isDestroyed || findImage(view, blobUrl) === null) return release();
      const delay = UPLOAD_RETRY_DELAYS[attempt];
      if (handler && delay !== undefined && !(error instanceof UnsafeUploadUrl)) {
        const waiting = editor.ui.notify({ text: t('image.retrying'), timeout: 0 });
        setTimeout(() => {
          waiting.close();
          if (view.isDestroyed) return release();
          startUpload(editor, file, blobUrl, attempt + 1);
        }, delay);
        return;
      }
      console.error('[nova] image upload failed', error);
      editor.ui.notify({
        text: t('image.uploadFailed'),
        type: 'error',
        actions: [
          { label: t('image.retry'), onAction: () => startUpload(editor, file, blobUrl, 0) },
          { label: t('image.delete'), onAction: remove },
        ],
        onClose: remove,
      });
    })
    .finally(() => notice?.close());
}

// ---------- автозагрузка встроенных (data:) картинок ----------

const DATA_IMAGE = /^data:(image\/(?:png|jpe?g|gif|webp|avif|bmp));base64,(.+)$/i;

/** data:-URL → File без fetch (fetch data: может запрещать CSP connect-src). */
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

/** Заменить src у всех картинок с данным src (без шага в истории). */
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
 * Загрузить встроенную картинку через uploadImage и подменить data:-URL на адрес с сервера.
 * При ошибке картинка остаётся встроенной: содержимое не теряется, пользователь видит уведомление.
 */
export async function uploadEmbeddedImage(editor: Editor, src: string): Promise<void> {
  const handler = editor.options.uploadImage;
  const file = handler ? dataUrlToFile(src) : null;
  if (!handler || !file) return;
  const notice = editor.ui.notify({ text: editor.ui.t('image.uploading'), timeout: 0 });
  try {
    const url = await handler(file, (percent) =>
      notice.setText(`${editor.ui.t('image.uploading')} ${Math.round(percent)}%`),
    );
    if (!isSafeImageUrl(url)) throw new Error(`Unsafe image URL returned: ${url}`);
    replaceImageSrc(editor.view, src, url);
  } catch (error) {
    console.error('[nova] embedded image upload failed', error);
    // Картинка остаётся встроенной (ничего не потеряно) — можно догрузить на сервер позже.
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
 * Встроенные картинки, появившиеся при вставке или перетаскивании (Word, другие приложения), сразу
 * загружаются через uploadImage. Без uploadImage остаются встроенными, как и раньше.
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
      // Загрузку запускаем после применения транзакции: изменять документ здесь нельзя.
      if (added.length)
        queueMicrotask(() => added.forEach((src) => void uploadEmbeddedImage(editor, src)));
      return null;
    },
  });
}

/** Плагин: картинки из буфера обмена и перетаскивание файлов. */
export function imageDropPastePlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('nova-image-drop-paste'),
    props: {
      handlePaste(_view, event) {
        if (!editor.isAllowed('image')) return false;
        const data = event.clipboardData;
        if (!data) return false;
        // При копировании из Word в буфере есть и HTML, и картинка-скриншот — берём HTML.
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

/** Диалог вставки изображения: загрузка файла или URL + обязательный по смыслу alt. */
export function openImageDialog(editor: Editor): void {
  const { t } = editor.ui;
  const fileInput = h('input', {
    type: 'file',
    accept: 'image/png,image/jpeg,image/gif,image/webp,image/avif',
    className: 'nova-visually-hidden',
    tabindex: '-1',
    // Выбор файла — через видимую зону ниже; само поле скрыто, но подпись у него обязана быть.
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

// ---------- выделенная картинка: размер, выравнивание, alt ----------

/** Выделенная картинка: узел (image или figure), его позиция и атрибуты картинки. */
export interface SelectedImage {
  node: PMNode;
  pos: number;
  /** src, alt, title, width, height, align — для figure собраны из figure и figure_image. */
  attrs: Record<string, unknown>;
}

/**
 * Выделенная картинка: картинка в строке, картинка с подписью (figure) или подпись, в которой стоит
 * курсор. Действия тулбара картинки (выравнивание, размер, alt) работают для обеих.
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

/** Есть ли у выделенной картинки подпись. */
export function hasImageCaption(state: EditorState): boolean {
  return getSelectedImage(state)?.node.type === nodesOf(state).figure;
}

const IMAGE_ATTRS = ['src', 'alt', 'title', 'width', 'height'] as const;
const pick = (attrs: Record<string, unknown>) =>
  Object.fromEntries(IMAGE_ATTRS.map((name) => [name, attrs[name] ?? null]));

/**
 * Включить или убрать подпись у выделенной картинки.
 * Включить: картинка становится отдельным блоком <figure>, курсор — в подписи.
 * Убрать: картинка возвращается в абзац; текст подписи не теряется — он становится абзацем ниже.
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

  // Картинка в строке: вынести её блоком после своего абзаца (абзац без неё остаётся, если не пуст).
  const $pos = state.doc.resolve(pos);
  const blockStart = $pos.before($pos.depth);
  const blockEnd = $pos.after($pos.depth);
  const figure = nodes.figure.create({ align: attrs.align ?? null }, [
    nodes.figure_image.create(pick(attrs)),
    nodes.figcaption.create(),
  ]);
  // Курсор в подписи: вход в figure (+1), картинка (+1), вход в подпись (+1).
  const CAPTION = 3;
  if ($pos.parent.childCount === 1) {
    tr.replaceWith(blockStart, blockEnd, figure);
    tr.setSelection(TextSelection.create(tr.doc, blockStart + CAPTION));
  } else {
    tr.insert(blockEnd, figure);
    tr.delete(pos, pos + node.nodeSize);
    // -1: позиция перед только что вставленной figure (а не после неё).
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(blockEnd, -1) + CAPTION));
  }
  dispatch(tr.scrollIntoView());
  return true;
};

/** Enter в подписи — новый абзац после картинки (подпись — одна строка, как в Word). */
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
 * Изменить атрибуты выделенной картинки. У figure выравнивание — на figure, остальное — на картинке
 * внутри. Выделение: картинка в строке остаётся выделенной узлом; у figure курсор не трогаем
 * (можно продолжать писать подпись).
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

/** Ширина картинки как доля ширины области текста (с сохранением пропорций); null — исходный размер. */
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

/** Диалог альтернативного текста — главный пункт доступности картинки. */
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
  editor.ui.openDialog({
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
