import type { Command } from 'prosemirror-state';
import type { Editor } from '../editor';
import type { MessageKey } from '../i18n';
import {
  getCellProps,
  getTableProps,
  setCellProps,
  setTableProps,
  sortTable,
  createTableGridPanel,
  hasHeaderColumn,
  hasHeaderRow,
  insertTable,
  isInTable,
  setCellBackground,
  tableCommands,
  tableRect,
} from '../table';
import { createColorPanel, defaultColors } from './color-panel';
import { selectField, textField } from './dialog';
import { h } from './dom';
import { icons } from './icons';

/**
 * Кнопки таблиц (имена — как в публичной документации TinyMCE) и контекстный тулбар таблицы.
 */
export function registerTableUi(editor: Editor): void {
  const { registry, t } = editor.ui;
  const sizeLabel = (rows: number, cols: number) => t('table.size', { rows, cols });

  registry.addPanelButton('table', {
    icon: icons.table,
    tooltip: t('table.insert'),
    isEnabled: (e) => e.can(insertTable(1, 1)),
    render: (e, close) =>
      createTableGridPanel(
        (rows, cols) => {
          close();
          e.exec(insertTable(rows, cols));
        },
        sizeLabel,
        t('table.insert'),
      ),
  });

  const button = (
    name: string,
    label: MessageKey,
    svg: string,
    command: Command,
    isActive?: (e: Editor) => boolean,
  ) =>
    registry.addButton(name, {
      icon: svg,
      tooltip: t(label),
      onAction: (e) => e.exec(command),
      isEnabled: (e) => e.can(command),
      ...(isActive ? { isActive } : {}),
    });

  button('tableinsertrowbefore', 'table.rowBefore', icons.rowBefore, tableCommands.addRowBefore);
  button('tableinsertrowafter', 'table.rowAfter', icons.rowAfter, tableCommands.addRowAfter);
  button('tabledeleterow', 'table.rowDelete', icons.rowDelete, tableCommands.deleteRow);
  button('tableinsertcolbefore', 'table.colBefore', icons.colBefore, tableCommands.addColumnBefore);
  button('tableinsertcolafter', 'table.colAfter', icons.colAfter, tableCommands.addColumnAfter);
  button('tabledeletecol', 'table.colDelete', icons.colDelete, tableCommands.deleteColumn);
  button('tablemergecells', 'table.merge', icons.merge, tableCommands.mergeCells);
  button('tablesplitcells', 'table.split', icons.split, tableCommands.splitCell);
  button('tablerowheader', 'table.rowHeader', icons.rowHeader, tableCommands.toggleHeaderRow, (e) =>
    hasHeaderRow(e.view.state),
  );
  button(
    'tablecolheader',
    'table.colHeader',
    icons.colHeader,
    tableCommands.toggleHeaderColumn,
    (e) => hasHeaderColumn(e.view.state),
  );
  button('tabledelete', 'table.delete', icons.tableDelete, tableCommands.deleteTable);

  registry.addPanelButton('tablecellbackground', {
    icon: icons.highlight,
    tooltip: t('table.cellBackground'),
    isEnabled: (e) => isInTable(e.view.state),
    render: (e, close) =>
      createColorPanel({
        colors: e.options.colors ?? defaultColors,
        current: null,
        label: t('table.cellBackground'),
        removeLabel: t('removeColor'),
        customLabel: t('customColor'),
        onPick: (color) => {
          close();
          e.exec(setCellBackground(color));
        },
      }),
  });

  // Сортировка строк по столбцу с курсором (как «Sort» в расширенных таблицах TinyMCE).
  registry.addMenuButton('advtablesort', {
    icon: icons.sort,
    tooltip: t('table.sort'),
    isEnabled: (e) => e.can(sortTable('asc')),
    items: (e) =>
      (['asc', 'desc'] as const).map((direction) => ({
        id: direction,
        label: t(direction === 'asc' ? 'table.sortAsc' : 'table.sortDesc'),
        onSelect: () => e.exec(sortTable(direction, e.options.language)),
      })),
  });

  registry.addButton('tableprops', {
    icon: icons.tableProps,
    tooltip: t('table.props'),
    isEnabled: (e) => isInTable(e.view.state),
    onAction: (e) => openTableProps(e),
  });
  registry.addButton('tablecellprops', {
    icon: icons.cellProps,
    tooltip: t('table.cellProps'),
    isEnabled: (e) => isInTable(e.view.state),
    onAction: (e) => openCellProps(e),
  });

  registry.addContextToolbar('table', {
    label: t('table.toolbar'),
    predicate: (e) => isInTable(e.view.state),
    anchor: (e) => tableRect(e),
    placement: 'bottom-start',
    items:
      'tableinsertrowbefore tableinsertrowafter tabledeleterow | ' +
      'tableinsertcolbefore tableinsertcolafter tabledeletecol | ' +
      'tablemergecells tablesplitcells | tablerowheader tablecolheader tablecellbackground | ' +
      'advtablesort tablecellprops tableprops | tabledelete',
  });
}

function openTableProps(editor: Editor): void {
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
  editor.ui.openDialog({
    title: t('table.props'),
    body: h('div', { className: 'nova-form' }, width.el, align.el),
    submitLabel: t('dialog.save'),
    onSubmit: () => {
      // «600» без единиц — пиксели.
      const raw = width.input.value.trim().replace(/^(\d+(\.\d+)?)$/, '$1px');
      const props = {
        width: raw || null,
        align: (align.select.value || null) as 'center' | 'right' | null,
      };
      return editor.exec(setTableProps(props)) || t('table.invalidWidth');
    },
  });
}

function openCellProps(editor: Editor): void {
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
  editor.ui.openDialog({
    title: t('table.cellProps'),
    body: h('div', { className: 'nova-form' }, valign.el, type.el, width.el),
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
        }),
      );
      return true;
    },
  });
}
