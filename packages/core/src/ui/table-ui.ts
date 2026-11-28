import type { Command } from 'prosemirror-state';
import type { Editor } from '../editor';
import type { MessageKey } from '../i18n';
import {
  sortTable,
  createTableGridPanel,
  hasHeaderColumn,
  hasHeaderRow,
  insertTable,
  isInTable,
  setCellBackground,
  tableCommands,
  tableRect,
} from '../tables';
import { createColorPanel, defaultColors } from './color-panel';
import { icons } from './icons';

/**
 * Table buttons (names from the public TinyMCE documentation) and the table context toolbar.
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
        iconSource: e.ui.registry,
        onPick: (color) => {
          close();
          e.exec(setCellBackground(color));
        },
      }),
  });

  // Sorting rows by the column with the cursor (like "Sort" in TinyMCE's advanced tables).
  registry.addMenuButton('advtablesort', {
    icon: icons.sort,
    tooltip: t('table.sort'),
    isEnabled: (e) => e.can(sortTable('asc')),
    items: (e) => {
      const quick = (['asc', 'desc'] as const).map((direction) => ({
        id: direction,
        label: t(direction === 'asc' ? 'table.sortAsc' : 'table.sortDesc'),
        onSelect: () => e.exec(sortTable(direction, e.options.language)),
      }));
      // With advanced tables: their "Sort…" dialog (any column or row, the selected cells).
      const advanced = e.ui.registry.getMenuItem('advtablesort');
      return advanced
        ? [...quick, { id: 'advanced', label: advanced.text, onSelect: () => advanced.onAction(e) }]
        : quick;
    },
  });

  registry.addButton('tableprops', {
    icon: icons.tableProps,
    tooltip: t('table.props'),
    isEnabled: (e) => isInTable(e.view.state),
    // The dialogs are a lazy part: loaded on first open.
    onAction: (e) => void import('./table-dialogs').then((m) => m.openTableProps(e)),
  });
  registry.addButton('tablecellprops', {
    icon: icons.cellProps,
    tooltip: t('table.cellProps'),
    isEnabled: (e) => isInTable(e.view.state),
    onAction: (e) => void import('./table-dialogs').then((m) => m.openCellProps(e)),
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
      'advtablesort advtablerownumbering tablecellprops tableprops | tabledelete',
  });
}
