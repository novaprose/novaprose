import type { Editor } from '../editor';
import { getCellProps, getTableProps, setCellProps, setTableProps } from '../tables';
import { selectField, textField } from './dialog';
import { h } from './dom';

/**
 * The "Table properties" and "Cell properties" dialogs: a lazy part (loaded on first open), the
 * table buttons themselves are in table-ui.ts.
 */

/** Picking a style from the list (tableClassList / tableCellClassList); without a list there is no field. */
function classSelect(
  editor: Editor,
  list: { title: string; value: string }[] | undefined,
  current: string | null,
) {
  if (!list?.length) return null;
  const { t } = editor.ui;
  const options = [{ value: '', label: t('table.styleDefault') }];
  for (const o of list) if (o.value) options.push({ value: o.value, label: o.title });
  // A class not from the list (it came with the HTML) is shown as is, so it isn't lost on save.
  if (current && !options.some((o) => o.value === current))
    options.push({ value: current, label: current });
  return selectField({ label: t('table.style'), value: current ?? '', options });
}

export function openTableProps(editor: Editor): void {
  const { t } = editor.ui;
  const current = getTableProps(editor.view.state);
  if (!current) return;
  const width = textField({
    label: t('table.width'),
    hint: t('table.widthHint'),
    value: current.width ?? '',
  });
  const align = selectField({
    label: t('table.align'),
    value: current.align ?? '',
    options: [
      { value: '', label: t('table.alignDefault') },
      { value: 'center', label: t('table.alignCenter') },
      { value: 'right', label: t('table.alignRight') },
    ],
  });
  const styles = classSelect(editor, editor.options.tableClassList, current.class ?? null);
  editor.ui.openDialog({
    title: t('table.props'),
    body: h('div', { className: 'nova-form' }, styles?.el ?? null, width.el, align.el),
    submitLabel: t('dialog.save'),
    onSubmit: () => {
      // "600" without units means pixels.
      const raw = width.input.value.trim().replace(/^(\d+(\.\d+)?)$/, '$1px');
      const props = {
        width: raw || null,
        align: (align.select.value || null) as 'center' | 'right' | null,
        ...(styles ? { class: styles.select.value || null } : {}),
      };
      return editor.exec(setTableProps(props)) || t('table.invalidWidth');
    },
  });
}

export function openCellProps(editor: Editor): void {
  const { t } = editor.ui;
  const current = getCellProps(editor.view.state);
  if (!current) return;
  const valign = selectField({
    label: t('table.valign'),
    value: current.valign ?? '',
    options: [
      { value: '', label: t('table.alignDefault') },
      { value: 'top', label: t('table.valignTop') },
      { value: 'middle', label: t('table.valignMiddle') },
      { value: 'bottom', label: t('table.valignBottom') },
    ],
  });
  const type = selectField({
    label: t('table.cellType'),
    value: current.header ? 'th' : 'td',
    options: [
      { value: 'td', label: t('table.cellData') },
      { value: 'th', label: t('table.cellHeader') },
    ],
  });
  const width = textField({
    label: t('table.colWidth'),
    hint: t('table.colWidthHint'),
    value: current.width ? String(current.width) : '',
  });
  const styles = classSelect(editor, editor.options.tableCellClassList, current.class ?? null);
  editor.ui.openDialog({
    title: t('table.cellProps'),
    body: h('div', { className: 'nova-form' }, styles?.el ?? null, valign.el, type.el, width.el),
    submitLabel: t('dialog.save'),
    onSubmit: () => {
      const rawWidth = width.input.value.trim();
      const px = rawWidth ? Number(rawWidth.replace(/px$/i, '')) : null;
      if (px !== null && !(Number.isInteger(px) && px >= 24 && px <= 4000))
        return t('table.invalidColWidth');
      editor.exec(
        setCellProps({
          valign: (valign.select.value || null) as 'top' | 'middle' | 'bottom' | null,
          header: type.select.value === 'th',
          width: px,
          ...(styles ? { class: styles.select.value || null } : {}),
        }),
      );
      return true;
    },
  });
}
