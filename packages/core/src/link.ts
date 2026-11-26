import type { Command, EditorState } from 'prosemirror-state';
import { attachFilePicker } from './ui/file-picker';
import { getLinkAt, markRange } from './commands';
import type { Editor } from './editor';
import { marksOf } from './commands';
import { checkboxField, textField } from './ui/dialog';
import { h } from './ui/dom';
import { isSafeLinkUrl } from './url';

/**
 * Turns user input into a URL: 'example.com' → 'https://example.com', 'a@b.com' → 'mailto:a@b.com'.
 * Relative paths and anchors are left alone.
 */
export function normalizeUrl(input: string): string {
  const url = input.trim();
  if (!url) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /^[/#?.]/.test(url)) return url;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url)) return `mailto:${url}`;
  if (/^(www\.)?[^\s/]+\.[a-z]{2,}([/:?#].*)?$/i.test(url)) return `https://${url}`;
  return url;
}

export interface LinkAttrs {
  href: string;
  text?: string;
  title?: string | null;
  target?: string | null;
}

/** The range a link applies to: the selection or the link under the cursor. */
function linkTarget(state: EditorState): { from: number; to: number } {
  const { from, to, empty, $from } = state.selection;
  if (empty) return markRange(state, marksOf(state).link, $from.pos) ?? { from, to };
  return { from, to };
}

/**
 * Create or update a link. If `text` is given and differs from the current text, the text is
 * replaced and other marks (bold and so on) are kept.
 */
export function applyLink(attrs: LinkAttrs): Command {
  return (state, dispatch) => {
    const href = normalizeUrl(attrs.href);
    if (!href || !isSafeLinkUrl(href)) return false;
    if (!dispatch) return true;

    const { from, to } = linkTarget(state);
    const linkMark = marksOf(state).link.create({
      href,
      title: attrs.title || null,
      target: attrs.target || null,
    });
    const currentText = state.doc.textBetween(from, to);
    const text = attrs.text?.trim() ? attrs.text : null;
    const tr = state.tr;

    if (from === to || (text !== null && text !== currentText)) {
      const baseMarks = marksOf(state).link.removeFromSet(state.doc.resolve(from).marks());
      const node = state.schema.text(text ?? (currentText || href), linkMark.addToSet(baseMarks));
      tr.replaceWith(from, to, node);
    } else {
      tr.removeMark(from, to, marksOf(state).link).addMark(from, to, linkMark);
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}

export function removeLink(): Command {
  return (state, dispatch) => {
    const { from, to } = linkTarget(state);
    if (from === to || !state.doc.rangeHasMark(from, to, marksOf(state).link)) return false;
    dispatch?.(state.tr.removeMark(from, to, marksOf(state).link));
    return true;
  };
}

/** The insert/edit link dialog. */
export function openLinkDialog(editor: Editor): void {
  const { t } = editor.ui;
  const state = editor.view.state;
  const existing = getLinkAt(state);
  const range = linkTarget(state);
  const selectedText = state.doc.textBetween(range.from, range.to);
  // The link text is editable only if the selection doesn't span several blocks/nodes.
  const canEditText =
    !selectedText.includes('\n') && state.selection.$from.sameParent(state.doc.resolve(range.to));

  const url = textField({
    label: t('link.url'),
    type: 'url',
    value: existing?.href ?? '',
    placeholder: 'https://',
    required: true,
  });
  const text = textField({ label: t('link.text'), value: selectedText });
  const title = textField({ label: t('link.tooltip'), value: existing?.title ?? '' });
  const newTab = checkboxField(t('link.newTab'), existing?.target === '_blank');
  attachFilePicker(editor, url, 'file', (picked) => {
    if (picked.text && !text.input.value.trim()) text.input.value = picked.text;
    if (picked.title) title.input.value = picked.title;
  });

  const body = h(
    'div',
    { className: 'nova-form' },
    url.el,
    canEditText ? text.el : null,
    title.el,
    newTab.el,
  );

  editor.ui.openDialog({
    title: existing ? t('link.editTitle') : t('link.title'),
    body,
    submitLabel: existing ? t('dialog.save') : t('dialog.insert'),
    initialFocus: url.input,
    onSubmit: () => {
      const href = normalizeUrl(url.input.value);
      if (!href || !isSafeLinkUrl(href)) {
        url.input.setAttribute('aria-invalid', 'true');
        url.input.focus();
        return t('link.invalid');
      }
      editor.exec(
        applyLink({
          href,
          ...(canEditText ? { text: text.input.value } : {}),
          title: title.input.value.trim() || null,
          target: newTab.input.checked ? '_blank' : null,
        }),
      );
      return true;
    },
  });
}
