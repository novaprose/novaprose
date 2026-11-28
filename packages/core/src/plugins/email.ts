import type { Editor } from '../editor';
import { editorContentCss, emailSettings, toEmailHTML } from '../email';
import { definePlugin } from '../plugins';
import { h, uniqueId } from '../ui/dom';
import css from './email.css?raw';
import { pickLabels } from './shared';

/**
 * The email plugin: **Email preview** (`emailpreview`) shows the content as an email client will —
 * styles inline, a centered column, on a desktop or a phone screen — with its size (Gmail cuts off
 * emails over 102 KB), and copies it: as an email to paste into a mail client, or as HTML code for
 * an email service. The HTML itself comes from `emailHTML(editor)` in @novaprose/core/email;
 * `pluginOptions.email` holds the options both use. TinyMCE's inlinecss plugin maps here.
 */

export const LABELS = {
  en: {
    preview: 'Email preview',
    view: 'Screen',
    desktop: 'Desktop',
    phone: 'Phone',
    frame: 'The email as it will look',
    loading: 'Preparing the email…',
    size: 'Size: {size} KB',
    clipped: 'Gmail cuts off emails over 102 KB: the end of this one will be hidden.',
    copy: 'Copy the email',
    copyHtml: 'Copy the HTML code',
    copied: 'Copied.',
    copyFailed: "Couldn't copy. Select the email in the preview and copy it.",
    failed: "Couldn't prepare the email.",
  },
};

type Labels = (typeof LABELS)['en'];

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';

/** Gmail cuts off an email whose HTML is larger than this. */
const GMAIL_LIMIT = 102 * 1024;

/** 4321 bytes → "4.2" (with the decimal mark of the UI language). */
function kilobytes(bytes: number, language = 'en'): string {
  const format = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  try {
    return new Intl.NumberFormat(language, format).format(bytes / 1024);
  } catch {
    return new Intl.NumberFormat('en', format).format(bytes / 1024);
  }
}

async function copyEmail(html: string, text: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function openPreview(editor: Editor, labels: Labels): void {
  let closed = false;
  const frame = h('iframe', {
    className: 'nova-email-frame',
    // No scripts, no forms, no access to the page: the email is only shown.
    sandbox: '',
    title: labels.frame,
  });
  const stage = h('div', { className: 'nova-email-stage' }, frame);
  const status = h('p', { className: 'nova-email-status', role: 'status' }, labels.loading);
  const group = uniqueId('nova-email-view');
  const radio = (value: 'desktop' | 'phone', text: string) => {
    const input = h('input', {
      type: 'radio',
      name: group,
      value,
      className: 'nova-email-view-input',
      checked: value === 'desktop',
    });
    input.addEventListener('change', () => {
      if (input.checked) stage.classList.toggle('is-phone', value === 'phone');
    });
    return h('label', { className: 'nova-email-view' }, input, h('span', {}, text));
  };
  const views = h(
    'fieldset',
    { className: 'nova-email-views' },
    h('legend', { className: 'nova-visually-hidden' }, labels.view),
    radio('desktop', labels.desktop),
    radio('phone', labels.phone),
  );
  const copy = h('button', { type: 'button', className: 'nova-button' }, labels.copy);
  const copyHtml = h('button', { type: 'button', className: 'nova-button' }, labels.copyHtml);
  copy.disabled = true;
  copyHtml.disabled = true;
  const body = h(
    'div',
    { className: 'nova-email-preview' },
    h('div', { className: 'nova-email-bar' }, views, status),
    stage,
    h('div', { className: 'nova-email-actions' }, copy, copyHtml),
  );
  const handle = editor.ui.openDialog({
    title: labels.preview,
    body,
    size: 'large',
    // Nothing to cancel here: the window only shows the email.
    cancelLabel: editor.ui.t('dialog.close'),
    onClose: () => {
      closed = true;
    },
  });

  void (async () => {
    try {
      const settings = emailSettings(editor);
      const contentCss = await editorContentCss(editor, settings.fileFilter);
      if (closed) return;
      // The content only (not a whole page, with fullpagehtml): the email builds its own page.
      const html = editor.getHTML({ fullPage: false });
      // The whole email for the preview and for email services; the content alone to paste into a mail client.
      const whole = toEmailHTML(html, {
        ...settings,
        contentCss,
        document: settings.document || true,
      });
      const content = toEmailHTML(html, { ...settings, contentCss, document: false });
      frame.srcdoc = whole;
      const size = new TextEncoder().encode(whole).length;
      status.textContent = labels.size.replace('{size}', kilobytes(size, editor.options.language));
      if (size > GMAIL_LIMIT) {
        status.textContent += ` ${labels.clipped}`;
        status.classList.add('is-warning');
      }
      const done = (ok: boolean) => editor.ui.announce(ok ? labels.copied : labels.copyFailed);
      copy.addEventListener('click', () => void copyEmail(content, editor.getText()).then(done));
      copyHtml.addEventListener('click', () => void copyText(whole).then(done));
      copy.disabled = false;
      copyHtml.disabled = false;
    } catch (error) {
      console.error('[nova] email preview:', error);
      if (!closed) handle.setError(labels.failed);
    }
  })();
}

export default definePlugin({
  name: 'email',
  toolbar: 'emailpreview',
  setup(editor) {
    editor.ui.addStyles('nova-email', css);
    const labels = pickLabels(editor, 'email', LABELS);
    editor.ui.registry.addButton('emailpreview', {
      icon: ICON,
      tooltip: labels.preview,
      onAction: () => openPreview(editor, labels),
    });
    editor.ui.registry.addMenuItem('emailpreview', {
      icon: ICON,
      text: labels.preview,
      onAction: () => openPreview(editor, labels),
    });
  },
});
