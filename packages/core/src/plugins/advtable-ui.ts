import type { Node as PMNode, Schema } from 'prosemirror-model';
import { Plugin, PluginKey, type Command, type Transaction } from 'prosemirror-state';
import { CellSelection, isInTable, selectedRect, TableMap } from 'prosemirror-tables';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { sortProblem, sortTableBy, type SortOptions } from '../table';
import { icons } from '../ui/icons';
import type { MenuEntry } from '../ui/menu';
import { seriesName } from './advtable';
import { pickLabels } from './shared';

/**
 * The lazy part of advanced tables: the numbers column (its button and menu, numbering again after
 * every change) and the "Sort" dialog.
 */

export const LABELS = {
  en: {
    rowNumbers: 'Row numbers',
    numeric: 'Numbers',
    alpha: 'Letters',
    none: 'No row numbers',
    sort: 'Sort…',
    sortTitle: 'Sort the table',
    what: 'Sort',
    rows: 'Rows, by a column',
    columns: 'Columns, by a row',
    column: 'Column',
    row: 'Row',
    columnN: 'Column {n}',
    rowN: 'Row {n}',
    order: 'Order',
    asc: 'Ascending (A to Z, 1 to 9)',
    desc: 'Descending (Z to A, 9 to 1)',
    scope: 'Cells',
    table: 'The whole table',
    selection: 'The selected cells',
    merged: 'A table with merged cells can’t be sorted.',
    few: 'There is nothing to sort: it takes at least two rows (or columns).',
    apply: 'Sort',
  },
};

/** A series of values for the numbers column. */
export interface TableSeries {
  /** The name in the menu. */
  title: string;
  /** The value of a numbered row (index counts the rows under the header rows, from 0). */
  value(index: number): string | undefined;
}

export interface AdvTableOptions {
  /** Your own series, besides `numeric` (1, 2, 3) and `alpha` (A, B, C). */
  series?: Record<string, TableSeries>;
}

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M3 9.33h18"/><path d="M3 14.67h18"/><path d="M6 6.4v.6"/><path d="M6 11.7v.6"/><path d="M6 17v.6"/></svg>';

/** A, B, …, Z, AA, AB, … */
function letters(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    n--;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

/** Whether every cell that starts in a row is a header cell (such rows get no number). */
function isHeaderRow(table: PMNode, row: number): boolean {
  const node = table.maybeChild(row);
  if (!node || !node.childCount) return false;
  let all = true;
  node.forEach((cell) => {
    if (cell.type.spec.tableRole !== 'header_cell') all = false;
  });
  return all;
}

/** The numbers column of a table: the series' name and the column (found by its cells). */
export function tableSeries(table: PMNode): { name: string; column: number } | null {
  const map = TableMap.get(table);
  for (let i = 0; i < map.map.length; i++) {
    const name = seriesName(table.nodeAt(map.map[i]!)?.attrs.series);
    if (name) return { name, column: i % map.width };
  }
  return null;
}

/**
 * Numbers the rows of every table with a numbers column: header rows get none, the others the series'
 * values in order. A cell is written only when it is the column's (or empty): your text stays.
 */
function renumber(tr: Transaction, series: (name: string) => TableSeries | null): boolean {
  const schema = tr.doc.type.schema as Schema;
  const changes: CellChange[] = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.spec.tableRole === 'table') {
      const found = tableSeries(node);
      const def = found && series(found.name);
      if (found && def) changes.push(...tableChanges(node, pos, found, def));
      return false;
    }
    return !node.isTextblock;
  });
  // From the end, so the positions before each change stay valid. Only the text and the mark change,
  // not the cell itself: a cursor in it stays a cursor in it.
  for (const { pos, name, text } of changes.reverse()) {
    const cell = tr.doc.nodeAt(pos);
    if (!cell) continue;
    if (cell.textContent !== text) {
      const only = cell.childCount === 1 && cell.firstChild!.isTextblock ? cell.firstChild! : null;
      if (only) {
        // The paragraph's text: from after its opening to before its closing.
        tr.replaceWith(pos + 2, pos + 2 + only.content.size, text ? schema.text(text) : []);
      } else {
        const paragraph = schema.nodes.paragraph!.create(
          null,
          text ? schema.text(text) : undefined,
        );
        tr.replaceWith(pos + 1, pos + cell.nodeSize - 1, paragraph);
      }
    }
    const updated = tr.doc.nodeAt(pos);
    if (updated && updated.attrs.series !== name)
      tr.setNodeMarkup(pos, undefined, { ...updated.attrs, series: name });
  }
  return changes.length > 0;
}

interface CellChange {
  pos: number;
  name: string;
  text: string;
}

function tableChanges(
  table: PMNode,
  tablePos: number,
  { name, column }: { name: string; column: number },
  def: TableSeries,
): CellChange[] {
  const map = TableMap.get(table);
  const seen = new Set<number>();
  const changes: CellChange[] = [];
  let index = 0;
  for (let row = 0; row < map.height; row++) {
    const offset = map.map[row * map.width + column]!;
    // A cell spanning several rows is numbered once.
    if (seen.has(offset)) continue;
    seen.add(offset);
    const cell = table.nodeAt(offset);
    if (!cell) continue;
    let value: string | undefined = '';
    if (!isHeaderRow(table, row)) {
      try {
        value = def.value(index++);
      } catch (error) {
        console.warn('[nova] advtable: a series failed', error);
        value = undefined;
      }
    }
    const marked = seriesName(cell.attrs.series);
    // Someone's text in the column's place: left alone.
    if (!marked && cell.textContent !== '') continue;
    const text = typeof value === 'string' ? value : cell.textContent;
    if (marked === name && cell.textContent === text) continue;
    changes.push({ pos: tablePos + 1 + offset, name, text });
  }
  return changes;
}

const renumberKey = new PluginKey('nova-advtable-series');

export default definePlugin({
  name: 'advtable-ui',
  requires: ['advtable'],
  prosemirrorPlugins: (editor) => [
    new Plugin({
      key: renumberKey,
      appendTransaction(transactions, _old, state) {
        if (!transactions.some((tr) => tr.docChanged)) return null;
        // A collaborator's change was numbered on their side.
        const remote = transactions.every(
          (tr) =>
            (tr.getMeta('y-sync$') as { isChangeOrigin?: boolean } | undefined)?.isChangeOrigin,
        );
        if (remote) return null;
        const tr = state.tr;
        return renumber(tr, seriesOf(editor)) ? tr : null;
      },
    }),
  ],
  setup(editor) {
    const labels = pickLabels(editor, 'advtable', LABELS);
    const series = seriesOf(editor, labels);
    const all = () => allSeries(editor, labels);

    /** The numbers column of the table with the cursor, or null. */
    const current = (): string | null => {
      const { state } = editor.view;
      return isInTable(state) ? (tableSeries(selectedRect(state).table)?.name ?? null) : null;
    };

    /** Adds the column (or switches its series), or removes it when the table has that series. */
    const toggle =
      (name: string): Command =>
      (state, dispatch) => {
        if (!isInTable(state) || !series(name)) return false;
        if (!dispatch) return true;
        const rect = selectedRect(state);
        const { table, tableStart, map } = rect;
        const found = tableSeries(table);
        const tr = state.tr;
        if (found?.name === name) {
          // Off: the column's cells go (from the end, so the positions stay valid).
          const cells: number[] = [];
          table.forEach((row, rowOffset) => {
            row.forEach((cell, cellOffset) => {
              if (seriesName(cell.attrs.series))
                cells.push(tableStart + rowOffset + 1 + cellOffset);
            });
          });
          for (const pos of cells.reverse()) {
            const cell = tr.doc.nodeAt(pos);
            if (cell) tr.delete(pos, pos + cell.nodeSize);
          }
        } else if (found) {
          // Another series: the same cells, new values.
          table.forEach((row, rowOffset) => {
            row.forEach((cell, cellOffset) => {
              if (seriesName(cell.attrs.series))
                tr.setNodeMarkup(tableStart + rowOffset + 1 + cellOffset, undefined, {
                  ...cell.attrs,
                  series: name,
                });
            });
          });
          renumber(tr, series);
        } else {
          // On: a narrow first column (it can be widened like any other), header cells in header rows.
          const nodes = state.schema.nodes;
          for (let row = 0; row < map.height; row++) {
            const type = isHeaderRow(table, row) ? nodes.table_header! : nodes.table_cell!;
            const pos = tr.mapping.map(tableStart + map.positionAt(row, 0, table));
            tr.insert(
              pos,
              type.create({ series: name, colwidth: [48] }, nodes.paragraph!.create()),
            );
          }
          renumber(tr, series);
        }
        dispatch(tr.scrollIntoView());
        editor.focus();
        return true;
      };

    const sortDialog = async () => {
      const { state } = editor.view;
      if (!isInTable(state)) return;
      const rect = selectedRect(state);
      const { map, table } = rect;
      const cellText = (row: number, col: number) =>
        table
          .nodeAt(map.map[row * map.width + col]!)
          ?.textContent.trim()
          .slice(0, 40) ?? '';
      const named = (template: string, n: number, text: string) =>
        template.replace('{n}', String(n)) + (text ? `: ${text}` : '');
      // The numbers column isn't a column to sort by, nor a name for the rows.
      const numbers = tableSeries(table)?.column ?? -1;
      const labelColumn = numbers === 0 && map.width > 1 ? 1 : 0;
      const columns = Array.from({ length: map.width }, (_, col) => ({
        value: String(col),
        label: named(labels.columnN, col + 1, isHeaderRow(table, 0) ? cellText(0, col) : ''),
      })).filter((_, col) => col !== numbers);
      const rows = Array.from({ length: map.height }, (_, row) => ({
        value: String(row),
        label: named(labels.rowN, row + 1, cellText(row, labelColumn)),
      }));
      const several = state.selection instanceof CellSelection;
      await editor.ui.dialog({
        title: labels.sortTitle,
        submitLabel: labels.apply,
        initialData: {
          by: 'column',
          column: rect.left === numbers ? (columns[0]?.value ?? '0') : String(rect.left),
          row: String(rect.top),
          direction: 'asc',
          scope: several ? 'selection' : 'table',
        },
        fields: [
          {
            type: 'select',
            name: 'by',
            label: labels.what,
            options: [
              { value: 'column', label: labels.rows },
              { value: 'row', label: labels.columns },
            ],
          },
          { type: 'select', name: 'column', label: labels.column, options: columns },
          { type: 'select', name: 'row', label: labels.row, options: rows, disabled: true },
          {
            type: 'select',
            name: 'direction',
            label: labels.order,
            options: [
              { value: 'asc', label: labels.asc },
              { value: 'desc', label: labels.desc },
            ],
          },
          {
            type: 'select',
            name: 'scope',
            label: labels.scope,
            disabled: !several,
            options: [
              { value: 'table', label: labels.table },
              { value: 'selection', label: labels.selection },
            ],
          },
        ],
        onChange: (data, { name }, api) => {
          if (name !== 'by') return;
          api.setEnabled('column', data.by === 'column');
          api.setEnabled('row', data.by === 'row');
        },
        onSubmit: (data) => {
          const options: SortOptions = {
            by: data.by === 'row' ? 'row' : 'column',
            index: Number(data.by === 'row' ? data.row : data.column),
            direction: data.direction === 'desc' ? 'desc' : 'asc',
            scope: data.scope === 'selection' ? 'selection' : 'table',
          };
          const problem = sortProblem(editor.view.state, options);
          if (problem) return problem === 'merged' ? labels.merged : labels.few;
          editor.exec(sortTableBy(options, editor.options.language));
          return true;
        },
      });
    };

    editor.ui.registry.addSplitButton('advtablerownumbering', {
      icon: ICON,
      tooltip: labels.rowNumbers,
      isEnabled: (e) => e.isEditable() && isInTable(e.view.state),
      isActive: () => current() !== null,
      onAction: (e) => void e.exec(toggle(current() ?? 'numeric')),
      items: (e): MenuEntry[] => [
        ...Object.entries(all()).map(([name, def]): MenuEntry => ({
          id: `series-${name}`,
          label: def.title,
          active: current() === name,
          onSelect: () => void e.exec(toggle(name)),
        })),
        { type: 'separator' },
        {
          id: 'series-none',
          label: labels.none,
          disabled: current() === null,
          onSelect: () => {
            const name = current();
            if (name) e.exec(toggle(name));
          },
        },
      ],
    });
    editor.ui.registry.addMenuItem('advtablerownumbering', {
      text: labels.rowNumbers,
      icon: ICON,
      isEnabled: (e) => isInTable(e.view.state),
      isActive: () => current() !== null,
      onAction: (e) => void e.exec(toggle(current() ?? 'numeric')),
    });
    editor.ui.registry.addMenuItem('advtablesort', {
      text: labels.sort,
      icon: icons.sort,
      isEnabled: (e) => isInTable(e.view.state),
      onAction: () => void sortDialog(),
    });

    // The commands of the tinymce.init() compatibility layer (mceTableToggleSeries and the sorts).
    const onCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ command?: string; value?: unknown }>).detail ?? {};
      if (detail.command === 'dialog') void sortDialog();
      else if (detail.command === 'series' && typeof detail.value === 'string')
        editor.exec(toggle(detail.value));
      else if (detail.command === 'sort' && detail.value && typeof detail.value === 'object')
        editor.exec(sortTableBy(detail.value as SortOptions, editor.options.language));
    };
    editor.root.addEventListener('nova-advtable', onCommand);
    return () => editor.root.removeEventListener('nova-advtable', onCommand);
  },
});

type Labels = typeof LABELS.en;

/** Every series: the built-in ones and yours (yours win on the same name). */
function allSeries(editor: Editor, labels?: Labels): Record<string, TableSeries> {
  const own = (editor.options.pluginOptions?.advtable as AdvTableOptions | undefined)?.series;
  const valid = Object.entries(own && typeof own === 'object' ? own : {}).filter(
    ([name, def]) =>
      !!seriesName(name) &&
      !!def &&
      typeof def.value === 'function' &&
      typeof def.title === 'string',
  );
  return {
    numeric: { title: labels?.numeric ?? 'Numbers', value: (i) => String(i + 1) },
    alpha: { title: labels?.alpha ?? 'Letters', value: letters },
    ...Object.fromEntries(valid),
  };
}

function seriesOf(editor: Editor, labels?: Labels): (name: string) => TableSeries | null {
  return (name) => allSeries(editor, labels)[name] ?? null;
}
