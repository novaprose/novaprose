import { AllSelection } from 'prosemirror-state';
import type { Editor } from '../editor';
import { insertTable } from '../tables';
import { textField } from './dialog';
import { h } from './dom';
import { icons } from './icons';

/**
 * Печать как на экране (с видами узлов и стилями страницы; в режиме страниц — тот же лист).
 * Модуль печати ленивый: грузится при первой печати.
 */
export function printContent(editor: Editor): void {
  void import('./print').then(
    (module) => module.print(editor),
    (error: unknown) => console.error('[nova] print: could not load the print module', error),
  );
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
