import type { Editor } from '../editor';
import { h, icon } from './dom';
import { icons } from './icons';

/** What the user chose in your file manager. */
export interface FilePickResult {
  url: string;
  /** Link text (in the link dialog, when the text is still empty). */
  text?: string;
  /** The link's tooltip (title) or the video's name. */
  title?: string;
  /** The image's alternative text. */
  alt?: string;
}

/** Which field asks for a file: a link to any file, an image or a video. */
export type FilePickType = 'file' | 'image' | 'media';

/**
 * Your own file picker (like file_picker_callback in TinyMCE): open your file manager and return an
 * address. null/undefined — the user changed their mind.
 */
export type FilePicker = (request: {
  type: FilePickType;
  value: string;
}) => Promise<FilePickResult | null | undefined> | FilePickResult | null | undefined;

/**
 * Adds a "Browse" button to an address field when options.filePicker is set.
 * onPick fills in the dialog's other fields (link text, alt…).
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
    icon(icons.browse, editor.ui.registry),
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
      // The dialog may have closed while your file manager was open.
      if (input.isConnected) input.focus();
    }
  });
}
