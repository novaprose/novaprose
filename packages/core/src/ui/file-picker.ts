import type { Editor } from '../editor';
import { h, icon } from './dom';
import { icons } from './icons';

/** Что выбрал пользователь в вашем файловом менеджере. */
export interface FilePickResult {
  url: string;
  /** Текст ссылки (диалог ссылки, если текст ещё пуст). */
  text?: string;
  /** Подсказка (title) ссылки или название видео. */
  title?: string;
  /** Альтернативный текст картинки. */
  alt?: string;
}

/** Какое поле просит файл: ссылка на любой файл, картинка или видео. */
export type FilePickType = 'file' | 'image' | 'media';

/**
 * Ваш выбор файла (как file_picker_callback в TinyMCE): открыть свой менеджер файлов и вернуть адрес.
 * null/undefined — пользователь передумал.
 */
export type FilePicker = (request: {
  type: FilePickType;
  value: string;
}) => Promise<FilePickResult | null | undefined> | FilePickResult | null | undefined;

/**
 * Добавляет к полю адреса кнопку «Обзор», если задан options.filePicker.
 * onPick — заполнить остальные поля диалога (текст ссылки, alt…).
 */
export function attachFilePicker(
  editor: Editor,
  field: { el: HTMLElement; input: HTMLInputElement },
  type: FilePickType,
  onPick?: (result: FilePickResult) => void,
): void {
  const { filePicker: picker, filePickerTypes: types } = editor.options;
  if (!picker || (types && !types.includes(type))) return;
  const { input } = field;
  const button = h(
    'button',
    {
      type: 'button',
      className: 'nova-btn nova-input-action',
      'aria-label': editor.ui.t('dialog.browse'),
      title: editor.ui.t('dialog.browse'),
    },
    icon(icons.browse),
  );
  const group = h('div', { className: 'nova-input-group' });
  input.replaceWith(group);
  group.append(input, button);

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await picker({ type, value: input.value });
      if (!result?.url) return;
      input.value = result.url;
      input.removeAttribute('aria-invalid');
      onPick?.(result);
    } catch (error) {
      console.error('[nova] filePicker failed:', error);
    } finally {
      button.disabled = false;
      // Диалог мог закрыться, пока открыт ваш менеджер файлов.
      if (input.isConnected) input.focus();
    }
  });
}
