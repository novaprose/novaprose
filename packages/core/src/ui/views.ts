import { DOMSerializer } from 'prosemirror-model';
import type { Editor } from '../editor';
import type { MessageKey } from '../i18n';
import { formatShortcut, h } from './dom';

// ---------- полноэкранный режим ----------

export function isFullscreen(editor: Editor): boolean {
  return editor.root.classList.contains('nova-fullscreen');
}

/** The editor on the whole screen; the page under it doesn't scroll. */
export function toggleFullscreen(editor: Editor, value = !isFullscreen(editor)): void {
  editor.root.classList.toggle('nova-fullscreen', value);
  document.documentElement.classList.toggle('nova-fullscreen-lock', value);
  editor.ui.closePopover();
  editor.updateUI();
  editor.focus();
}

// ---------- предпросмотр ----------

/**
 * A preview of the result. The DOM is built by the schema's serializer (no HTML string parsing), in
 * a container with the same content styles, without editing.
 */
export function openPreview(editor: Editor): void {
  const { t } = editor.ui;
  const content = h('div', { className: 'nova-prosemirror nova-preview' });
  content.append(
    DOMSerializer.fromSchema(editor.schema).serializeFragment(editor.view.state.doc.content),
  );
  // Ссылки в предпросмотре открываем в новой вкладке, чтобы не уйти со страницы с несохранённым текстом.
  content.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  editor.ui.openDialog({
    title: t('preview'),
    body: content,
    size: 'large',
    cancelLabel: t('dialog.close'),
  });
}

// ---------- HTML-код ----------

/** Line breaks after block tags, so the HTML is easy to read and edit. */
export function formatHTML(html: string): string {
  return html
    .replace(/(<\/(p|h[1-6]|ul|ol|li|blockquote|pre|table|tbody|tr)>|<hr>)/g, '$1\n')
    .replace(/(<(ul|ol|table|tbody|tr|blockquote)( [^>]*)?>)/g, '$1\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** View and edit the HTML (the code plugin). Saving goes through the schema, with the same cleanup. */
export function openSourceCode(editor: Editor): void {
  const { t } = editor.ui;
  const original = formatHTML(editor.getHTML());
  const textarea = h('textarea', {
    className: 'nova-input nova-source',
    spellcheck: 'false',
    'aria-label': t('sourceCode'),
    autocomplete: 'off',
    rows: '18',
  });
  textarea.value = original;
  editor.ui.openDialog({
    title: t('sourceCode'),
    body: textarea,
    size: 'large',
    submitLabel: t('dialog.save'),
    initialFocus: textarea,
    onSubmit: () => {
      if (textarea.value !== original) editor.setContent(textarea.value);
      return true;
    },
  });
  // Enter в textarea — перенос строки, а не отправка формы (у textarea так по умолчанию).
}

// ---------- справка по горячим клавишам ----------

interface ShortcutRow {
  label: MessageKey;
  keys: string;
}

const SHORTCUTS: { group: MessageKey; rows: ShortcutRow[] }[] = [
  {
    group: 'help.formatting',
    rows: [
      { label: 'bold', keys: 'Mod-b' },
      { label: 'italic', keys: 'Mod-i' },
      { label: 'underline', keys: 'Mod-u' },
      { label: 'strike', keys: 'Mod-Shift-x' },
      { label: 'code', keys: 'Mod-e' },
      { label: 'superscript', keys: 'Mod-.' },
      { label: 'subscript', keys: 'Mod-,' },
      { label: 'link', keys: 'Mod-k' },
      { label: 'clearFormatting', keys: 'Mod-\\' },
    ],
  },
  {
    group: 'help.blocks',
    rows: [
      { label: 'paragraph', keys: 'Mod-Alt-0' },
      { label: 'h1', keys: 'Mod-Alt-1' },
      { label: 'h2', keys: 'Mod-Alt-2' },
      { label: 'h3', keys: 'Mod-Alt-3' },
      { label: 'bulletList', keys: 'Mod-Shift-8' },
      { label: 'orderedList', keys: 'Mod-Shift-7' },
      { label: 'alignCenter', keys: 'Mod-Shift-e' },
      { label: 'indent', keys: 'Mod-]' },
      { label: 'outdent', keys: 'Mod-[' },
    ],
  },
  {
    group: 'help.editing',
    rows: [
      { label: 'undo', keys: 'Mod-z' },
      { label: 'redo', keys: 'Mod-Shift-z' },
      { label: 'search.title', keys: 'Mod-f' },
      { label: 'pasteAsText', keys: 'Mod-Shift-v' },
      { label: 'fullscreen', keys: 'Mod-Shift-f' },
      { label: 'help.slash', keys: '/' },
      { label: 'moveBlockUp', keys: 'Alt-Shift-ArrowUp' },
      { label: 'moveBlockDown', keys: 'Alt-Shift-ArrowDown' },
    ],
  },
  {
    group: 'help.navigation',
    rows: [
      { label: 'help.toMenubar', keys: 'Alt-F9' },
      { label: 'help.toToolbar', keys: 'Alt-F10' },
      { label: 'help.toContextToolbar', keys: 'Ctrl-F9' },
      { label: 'help.toEditor', keys: 'Escape' },
      { label: 'help.nextCell', keys: 'Tab' },
      { label: 'help', keys: 'Alt-0' },
    ],
  },
];

export function openHelp(editor: Editor): void {
  const { t } = editor.ui;
  const body = h('div', { className: 'nova-help' });
  for (const { group, rows } of SHORTCUTS) {
    body.append(
      h(
        'section',
        {},
        h('h3', {}, t(group)),
        h(
          'table',
          { className: 'nova-help-table' },
          h(
            'tbody',
            {},
            rows.map(({ label, keys }) =>
              h(
                'tr',
                {},
                h('td', {}, t(label)),
                h('td', {}, h('kbd', {}, keys.length === 1 ? keys : formatShortcut(keys))),
              ),
            ),
          ),
        ),
      ),
    );
  }
  editor.ui.openDialog({ title: t('help'), body, size: 'large', cancelLabel: t('dialog.close') });
}
