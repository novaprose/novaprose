/**
 * Tables in the first load are only the light part: creating and inserting a table, the size grid,
 * the table's position on screen. The mechanics (cell selection, column widths, row and column
 * commands, sorting, properties) are the ./table module on prosemirror-tables: ~10 KB gzip, loaded
 * in the background right after the editor is created and part of `editor.ready`.
 *
 * The commands and helpers of the mechanics are available here as stand-ins with the same API:
 * until the module has loaded (the first milliseconds), a command is "unavailable" (false), like any command that doesn't apply.
 */
import { type Node as PMNode } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState, type Plugin } from 'prosemirror-state';
import type { Editor } from './editor';
import { schema as baseSchema, type NovaSchema } from './schema';
import type { CellProps, SortDirection, TableProps } from './table';
import { isInTable } from './table-nodes';
import { h } from './ui/dom';
import { replaceSelectionWithBlock } from './commands';

export { isInTable };

// ---------- lazy mechanics ----------

type TableCommandName =
  | 'addRowBefore'
  | 'addRowAfter'
  | 'deleteRow'
  | 'addColumnBefore'
  | 'addColumnAfter'
  | 'deleteColumn'
  | 'mergeCells'
  | 'splitCell'
  | 'toggleHeaderRow'
  | 'toggleHeaderColumn'
  | 'deleteTable';

/**
 * What the table mechanics (./table) give the light part. An explicit interface instead of `import type * as`:
 * easier to read, and the .d.ts build doesn't trip over mutual imports between modules.
 */
interface TableModule {
  tableCommands: Record<TableCommandName, Command>;
  tablePlugins(): Plugin[];
  setCellBackground(color: string | null): Command;
  hasHeaderRow(state: EditorState): boolean;
  hasHeaderColumn(state: EditorState): boolean;
  isCellSelection(state: EditorState): boolean;
  getTableProps(state: EditorState): TableProps | null;
  setTableProps(props: TableProps): Command;
  getCellProps(state: EditorState): Required<CellProps> | null;
  setCellProps(props: CellProps): Command;
  sortTable(direction: SortDirection, locale?: string): Command;
}

let tables: TableModule | null = null;
let loading: Promise<TableModule | null> | null = null;

/** Loads the table mechanics (once per page). On a network failure it retries on the next call. */
export function loadTables(): Promise<TableModule | null> {
  loading ??= import('./table').then(
    (module) => (tables = module),
    (error: unknown) => {
      console.warn('[nova] failed to load table editing', error);
      loading = null;
      return null;
    },
  );
  return loading;
}

/** The loaded table mechanics module, or null. */
export function loadedTables(): TableModule | null {
  return tables;
}

const lazy =
  (name: TableCommandName): Command =>
  (state, dispatch, view) =>
    tables ? tables.tableCommands[name](state, dispatch, view) : false;

/** Row, column and cell commands (public API; unavailable until the mechanics have loaded). */
export const tableCommands: Record<TableCommandName, Command> = {
  addRowBefore: lazy('addRowBefore'),
  addRowAfter: lazy('addRowAfter'),
  deleteRow: lazy('deleteRow'),
  addColumnBefore: lazy('addColumnBefore'),
  addColumnAfter: lazy('addColumnAfter'),
  deleteColumn: lazy('deleteColumn'),
  mergeCells: lazy('mergeCells'),
  splitCell: lazy('splitCell'),
  toggleHeaderRow: lazy('toggleHeaderRow'),
  toggleHeaderColumn: lazy('toggleHeaderColumn'),
  deleteTable: lazy('deleteTable'),
};

/** Background of the selected cells (null removes it). */
export function setCellBackground(color: string | null): Command {
  return (state, dispatch, view) =>
    tables ? tables.setCellBackground(color)(state, dispatch, view) : false;
}

export function hasHeaderRow(state: EditorState): boolean {
  return tables?.hasHeaderRow(state) ?? false;
}

export function hasHeaderColumn(state: EditorState): boolean {
  return tables?.hasHeaderColumn(state) ?? false;
}

/** Whether several cells are selected (for "merge"). */
export function isCellSelection(state: EditorState): boolean {
  return tables?.isCellSelection(state) ?? false;
}

export function getTableProps(state: EditorState): TableProps | null {
  return tables?.getTableProps(state) ?? null;
}

export function setTableProps(props: TableProps): Command {
  return (state, dispatch, view) =>
    tables ? tables.setTableProps(props)(state, dispatch, view) : false;
}

export function getCellProps(state: EditorState): Required<CellProps> | null {
  return tables?.getCellProps(state) ?? null;
}

export function setCellProps(props: CellProps): Command {
  return (state, dispatch, view) =>
    tables ? tables.setCellProps(props)(state, dispatch, view) : false;
}

export function sortTable(direction: SortDirection, locale?: string): Command {
  return (state, dispatch, view) =>
    tables ? tables.sortTable(direction, locale)(state, dispatch, view) : false;
}

// ---------- the light part ----------

export const MAX_GRID = 10;

/** The DOM rectangle of the current table (to position the context toolbar). */
export function tableRect(editor: Editor): DOMRect | null {
  const { $from } = editor.view.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.spec.tableRole === 'table') {
      const dom = editor.view.nodeDOM($from.before(depth)) as HTMLElement | null;
      return dom?.getBoundingClientRect() ?? null;
    }
  }
  return null;
}

/** Create a rows×cols table; the first row is headers when withHeader. */
export function createTable(
  rows: number,
  cols: number,
  withHeader = true,
  schema: NovaSchema = baseSchema,
): PMNode {
  const { table, table_row, table_cell, table_header, paragraph } = schema.nodes;
  const rowNodes: PMNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellType = withHeader && r === 0 ? table_header : table_cell;
    const cells: PMNode[] = [];
    for (let c = 0; c < cols; c++) cells.push(cellType.create(null, paragraph.create()));
    rowNodes.push(table_row.create(null, cells));
  }
  return table.create(null, rowNodes);
}

/** Insert a table in place of the selection and put the cursor in its first cell. */
export function insertTable(rows: number, cols: number, withHeader = true): Command {
  return (state, dispatch) => {
    if (rows < 1 || cols < 1 || rows > 100 || cols > 50) return false;
    // Tables inside tables aren't inserted, as in most editors.
    if (isInTable(state)) return false;
    if (dispatch) {
      const node = createTable(rows, cols, withHeader, state.schema as NovaSchema);
      const tr = replaceSelectionWithBlock(state.tr, node);
      // Nodes are immutable: the inserted table is found by object reference.
      let tablePos = -1;
      tr.doc.descendants((n, pos) => {
        if (n === node) tablePos = pos;
        return tablePos < 0;
      });
      // +3: table → row → cell → inside the first paragraph.
      if (tablePos >= 0) tr.setSelection(TextSelection.near(tr.doc.resolve(tablePos + 3)));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/**
 * The table size picker: a grid up to 10×10, highlighted on hover/arrows,
 * with a "3 × 4" label. Works from the keyboard (arrows + Enter).
 */
export function createTableGridPanel(
  onPick: (rows: number, cols: number) => void,
  label: (rows: number, cols: number) => string,
  gridLabel: string,
): HTMLElement {
  let rows = 1;
  let cols = 1;
  const cells: HTMLButtonElement[] = [];
  const caption = h('div', { className: 'nova-grid-caption', 'aria-live': 'polite' });
  const grid = h('div', { className: 'nova-grid', role: 'grid', 'aria-label': gridLabel });

  const paint = () => {
    for (const cell of cells) {
      const r = Number(cell.dataset.row);
      const c = Number(cell.dataset.col);
      cell.classList.toggle('is-on', r <= rows && c <= cols);
      cell.tabIndex = r === rows && c === cols ? 0 : -1;
    }
    caption.textContent = label(rows, cols);
  };

  for (let r = 1; r <= MAX_GRID; r++) {
    for (let c = 1; c <= MAX_GRID; c++) {
      const cell = h('button', {
        type: 'button',
        className: 'nova-grid-cell',
        role: 'gridcell',
        'aria-label': label(r, c),
        'data-row': String(r),
        'data-col': String(c),
      });
      cell.addEventListener('mouseenter', () => {
        rows = r;
        cols = c;
        paint();
      });
      cell.addEventListener('click', () => onPick(r, c));
      cells.push(cell);
      grid.append(cell);
    }
  }

  grid.addEventListener('keydown', (event) => {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    rows = Math.min(MAX_GRID, Math.max(1, rows + move[0]));
    cols = Math.min(MAX_GRID, Math.max(1, cols + move[1]));
    paint();
    cells[(rows - 1) * MAX_GRID + (cols - 1)]!.focus();
  });

  paint();
  return h('div', { className: 'nova-grid-panel' }, grid, caption);
}
