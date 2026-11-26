import { DOMSerializer } from 'prosemirror-model';
import { AllSelection } from 'prosemirror-state';
import type { Editor } from '../editor';
import { insertTable } from '../tables';
import { textField } from './dialog';
import { h } from './dom';
import { icons } from './icons';

/** Базовые стили для печати — печатается только содержимое редактора, а не вся страница. */
const PRINT_CSS = `
  body { font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #000; margin: 2cm; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
  pre { white-space: pre-wrap; background: #f5f5f5; padding: 8px; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #444; }
`;

/** Печать содержимого через скрытый iframe (HTML уже очищен схемой). */
export function printContent(editor: Editor): void {
  const iframe = h('iframe', { title: 'print', 'aria-hidden': 'true', tabindex: '-1' });
  iframe.style.cssText =
    'position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden';
  document.body.append(iframe);
  const doc = iframe.contentDocument;
  if (!doc) return iframe.remove();
  const style = doc.createElement('style');
  style.textContent = PRINT_CSS;
  doc.head.append(style);
  // DOM строим сериализатором схемы прямо в документе iframe — без разбора HTML-строки.
  doc.body.append(
    DOMSerializer.fromSchema(editor.schema).serializeFragment(editor.view.state.doc.content, {
      document: doc,
    }),
  );
  const win = iframe.contentWindow;
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  win?.addEventListener('afterprint', cleanup);
  win?.focus();
  win?.print();
  cleanup();
}

/** Диалог «Вставить таблицу» для меню (в тулбаре — сетка). */
export function openInsertTableDialog(editor: Editor): void {
  const { t } = editor.ui;
  const rows = textField({ label: t('table.rows'), value: '3' });
  const cols = textField({ label: t('table.cols'), value: '3' });
  for (const field of [rows, cols]) {
    field.input.type = 'number';
    field.input.min = '1';
    field.input.max = '50';
    field.input.inputMode = 'numeric';
  }
  editor.ui.openDialog({
    title: t('table.insert'),
    body: h('div', { className: 'nova-form nova-form-row' }, rows.el, cols.el),
    submitLabel: t('dialog.insert'),
    initialFocus: rows.input,
    onSubmit: () => {
      const r = Number(rows.input.value);
      const c = Number(cols.input.value);
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 1 || c < 1 || r > 50 || c > 50) {
        return t('table.invalidSize');
      }
      editor.exec(insertTable(r, c));
      return true;
    },
  });
}

export function registerMenuItems(editor: Editor): void {
  const { registry, t } = editor.ui;
  registry.addToggleMenuItem('paragraph', {
    text: t('paragraph'),
    icon: icons.paragraph,
    shortcut: 'Mod-Alt-0',
    isActive: (e) => e.view.state.selection.$from.parent.type.name === 'paragraph',
    onAction: (e) => e.exec('paragraph'),
  });
  registry.addMenuItem('selectall', {
    text: t('selectAll'),
    shortcut: 'Mod-a',
    onAction: (e) => {
      e.view.dispatch(e.view.state.tr.setSelection(new AllSelection(e.view.state.doc)));
      e.focus();
    },
  });
  registry.addMenuItem('print', {
    text: t('print'),
    icon: icons.print,
    shortcut: 'Mod-p',
    onAction: (e) => printContent(e),
  });
  registry.addMenuItem('inserttable', {
    text: t('table.insert'),
    icon: icons.table,
    isEnabled: (e) => e.can(insertTable(1, 1)),
    onAction: (e) => openInsertTableDialog(e),
  });
}
