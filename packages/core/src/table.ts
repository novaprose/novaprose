import { keymap } from 'prosemirror-keymap';
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import { type Command, type EditorState, type Plugin } from 'prosemirror-state';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  findTable,
  goToNextCell,
  isInTable,
  mergeCells,
  selectedRect,
  setCellAttr,
  splitCell,
  tableEditing,
  TableView,
  toggleHeader,
} from 'prosemirror-tables';
import { createTable, createTableGridPanel, insertTable, MAX_GRID, tableRect } from './tables';

export { createTable, createTableGridPanel, insertTable, MAX_GRID, tableRect };
import { classAttr, cssValue, type CellVAlign, type NovaSchema, type TableAlign } from './schema';

/** Tab moves to the next cell; in the last cell it adds a new row (as in Word and TinyMCE). */
const nextCellOrNewRow: Command = (state, dispatch, view) => {
  if (!isInTable(state)) return false;
  if (goToNextCell(1)(state, dispatch, view)) return true;
  if (!dispatch) return true;
  let next: EditorState = state;
  addRowAfter(state, (tr) => {
    next = state.apply(tr);
    dispatch(tr);
  });
  return goToNextCell(1)(next, dispatch, view);
};

export function tablePlugins(): Plugin[] {
  return [
    // defaultCellMinWidth is the minimum for columns without a set width (100px by default:
    // a table of 5+ columns ran off the edge of a narrow editor too early).
    columnResizing({ cellMinWidth: 48, defaultCellMinWidth: 48, View: NovaTableView }),
    tableEditing(),
    keymap({
      Tab: nextCellOrNewRow,
      'Shift-Tab': goToNextCell(-1),
    }),
  ];
}

export const tableCommands = {
  addRowBefore,
  addRowAfter,
  deleteRow,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  mergeCells,
  splitCell,
  // Without the outdated logic (it looks at the corner cell and confuses the header row and column).
  toggleHeaderRow: toggleHeader('row'),
  toggleHeaderColumn: toggleHeader('column'),
  deleteTable,
} satisfies Record<string, Command>;

export { isInTable };

/** Background of the selected cells (null removes it). */
export function setCellBackground(color: string | null): Command {
  return setCellAttr('background', color);
}

/** Whether the current table has a header row (the first row made of th). */
export function hasHeaderRow(state: EditorState): boolean {
  if (!isInTable(state)) return false;
  const firstRow = findTable(state.selection.$from)?.node.firstChild;
  if (!firstRow || firstRow.childCount === 0) return false;
  let all = true;
  firstRow.forEach((cell) => {
    if (cell.type !== (state.schema as NovaSchema).nodes.table_header) all = false;
  });
  return all;
}

/** Whether there is a header column (the first cell of every row is th). */
export function hasHeaderColumn(state: EditorState): boolean {
  if (!isInTable(state)) return false;
  const table = findTable(state.selection.$from)?.node;
  if (!table) return false;
  let all = true;
  table.forEach((row) => {
    if (row.firstChild?.type !== (state.schema as NovaSchema).nodes.table_header) all = false;
  });
  return all;
}

/** Whether several cells are selected (for "merge"). */
export function isCellSelection(state: EditorState): boolean {
  return state.selection instanceof CellSelection;
}

export { selectedRect };

// ---------- sorting by column ----------

export type SortDirection = 'asc' | 'desc';

/** A number from the cell text ("1 200", "$45.00", "-3,5 %"), otherwise null and the text is compared instead. */
function numericValue(text: string): number | null {
  const cleaned = text
    .replace(/\s/g, '')
    .replace(/^[^\d+-]+|[^\d]+$/g, '') // currency and units at the edges
    .replace(/,(?=\d{3}(?:\D|$))/g, '') // the thousands separator in "1,200"
    .replace(',', '.'); // the decimal comma in "3,5"
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** How to sort a table (the "Sort" dialog of advanced tables). */
export interface SortOptions {
  /** 'column': the rows, by the values in a column; 'row': the columns, by the values in a row. */
  by: 'column' | 'row';
  /** The column (or row) whose values decide, from 0; the one with the cursor when left out. */
  index?: number;
  direction: SortDirection;
  /** Only the selected rows (or columns), or the whole table (the default). */
  scope?: 'table' | 'selection';
}

/** Why a table can't be sorted: merged cells, or fewer than two rows (columns) to sort. */
export type SortProblem = 'merged' | 'few';

interface Grid {
  pos: number;
  table: PMNode;
  rows: PMNode[][];
  width: number;
  /** Header rows at the top and header columns at the left: they stay where they are. */
  headerRows: number;
  headerColumns: number;
  rect: { left: number; right: number; top: number; bottom: number };
}

function isHeader(cell: PMNode | undefined, state: EditorState): boolean {
  return cell?.type === (state.schema as NovaSchema).nodes.table_header;
}

/** The current table as a grid of cells; null with a reason when it can't be sorted. */
function tableGrid(state: EditorState): Grid | SortProblem | null {
  if (!isInTable(state)) return null;
  const rect = selectedRect(state);
  const table = rect.table;
  // Merged cells break the reordering of rows and columns: such tables aren't sorted.
  let merged = false;
  table.descendants((node) => {
    if (node.attrs.colspan > 1 || node.attrs.rowspan > 1) merged = true;
    return (
      !merged && node.type.spec.tableRole !== 'cell' && node.type.spec.tableRole !== 'header_cell'
    );
  });
  if (merged) return 'merged';
  const rows: PMNode[][] = [];
  table.forEach((row) => {
    const cells: PMNode[] = [];
    row.forEach((cell) => cells.push(cell));
    rows.push(cells);
  });
  const width = Math.min(...rows.map((cells) => cells.length));
  let headerRows = 0;
  while (headerRows < rows.length && rows[headerRows]!.every((c) => isHeader(c, state)))
    headerRows++;
  // A header column, or a column of row numbers (advanced tables), stays at the left.
  let headerColumns = 0;
  while (
    headerColumns < width &&
    rows.every(
      (cells) => isHeader(cells[headerColumns], state) || !!cells[headerColumns]?.attrs.series,
    )
  )
    headerColumns++;
  return {
    pos: rect.tableStart - 1,
    table,
    rows,
    width,
    headerRows,
    headerColumns,
    rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
  };
}

/** The order of items by their texts: numbers as numbers when every one is, empty ones last. */
function sortOrder(texts: string[], direction: SortDirection, locale?: string): number[] {
  const numbers = texts.map(numericValue);
  // Numeric sorting only if every non-empty cell holds a number.
  const numeric = texts.every((t, i) => t === '' || numbers[i] !== null);
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return texts
    .map((_, i) => i)
    .sort((a, b) => {
      const ta = texts[a]!;
      const tb = texts[b]!;
      // Empty cells always go last.
      if (!ta || !tb) return ta ? -1 : tb ? 1 : a - b;
      const cmp = numeric ? numbers[a]! - numbers[b]! : collator.compare(ta, tb);
      return (direction === 'asc' ? cmp : -cmp) || a - b;
    });
}

/** Whether the current table can be sorted that way, and if not, why. */
export function sortProblem(state: EditorState, options: SortOptions): SortProblem | null {
  const grid = tableGrid(state);
  if (grid === null) return 'few';
  if (typeof grid === 'string') return grid;
  return sortRange(grid, options) ? null : 'few';
}

/** The rows (or columns) to sort: [from, to). */
function sortRange(grid: Grid, options: SortOptions): [number, number] | null {
  const byColumn = options.by === 'column';
  const first = byColumn ? grid.headerRows : grid.headerColumns;
  const count = byColumn ? grid.rows.length : grid.width;
  let [from, to] = [first, count];
  if (options.scope === 'selection') {
    from = Math.max(first, byColumn ? grid.rect.top : grid.rect.left);
    to = Math.min(count, byColumn ? grid.rect.bottom : grid.rect.right);
  }
  const key = options.index ?? (byColumn ? grid.rect.left : grid.rect.top);
  const keyCount = byColumn ? grid.width : grid.rows.length;
  if (!Number.isInteger(key) || key < 0 || key >= keyCount) return null;
  return to - from >= 2 ? [from, to] : null;
}

/**
 * Sorts the current table: its rows by a column, or its columns by a row; the whole table or the
 * selected part. Header rows and columns (and a column of row numbers) stay in place.
 */
export function sortTableBy(options: SortOptions, locale?: string): Command {
  return (state, dispatch) => {
    const grid = tableGrid(state);
    if (!grid || typeof grid === 'string') return false;
    const range = sortRange(grid, options);
    if (!range) return false;
    if (dispatch) {
      const [from, to] = range;
      const { rows, table, pos } = grid;
      const rowNodes: PMNode[] = [];
      table.forEach((row) => rowNodes.push(row));
      let next: PMNode[];
      if (options.by === 'column') {
        // Whole rows move (with their own attributes).
        const column = options.index ?? grid.rect.left;
        const order = sortOrder(
          rows.slice(from, to).map((cells) => cells[column]?.textContent.trim() ?? ''),
          options.direction,
          locale,
        );
        next = [
          ...rowNodes.slice(0, from),
          ...order.map((i) => rowNodes[from + i]!),
          ...rowNodes.slice(to),
        ];
      } else {
        // The cells of every row move to their column's new place.
        const keyRow = rows[options.index ?? grid.rect.top]!;
        const order = sortOrder(
          keyRow.slice(from, to).map((cell) => cell.textContent.trim()),
          options.direction,
          locale,
        );
        next = rowNodes.map((row, r) => {
          const cells = rows[r]!;
          return row.copy(
            Fragment.from([
              ...cells.slice(0, from),
              ...order.map((i) => cells[from + i]!),
              ...cells.slice(to),
            ]),
          );
        });
      }
      const sorted = table.copy(Fragment.from(next));
      dispatch(state.tr.replaceWith(pos, pos + table.nodeSize, sorted).scrollIntoView());
    }
    return true;
  };
}

/** Sorts the table rows by the column with the cursor. Header rows stay at the top. */
export function sortTable(direction: SortDirection, locale?: string): Command {
  return sortTableBy({ by: 'column', direction }, locale);
}

// ---------- table and cell properties ----------

/**
 * The table view in the editor: on top of the column width calculation (prosemirror-tables) it applies
 * the table's set width and alignment, so the editor shows what the site will show.
 */
class NovaTableView extends TableView {
  constructor(node: PMNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.apply(node);
  }

  override update(node: PMNode): boolean {
    if (!super.update(node)) return false;
    this.apply(node);
    return true;
  }

  private apply(node: PMNode): void {
    const width = cssValue.length(node.attrs.width);
    if (width) {
      this.table.style.width = width;
      this.table.style.minWidth = '';
    }
    const align = node.attrs.align as TableAlign | null;
    this.table.style.marginLeft = align ? 'auto' : '';
    this.table.style.marginRight = align === 'center' ? 'auto' : '';
    // The table style (a class), so the site's CSS (contentCss) shows the borders as in print.
    const cls = classAttr(node.attrs.class).class;
    if (cls) this.table.setAttribute('class', cls);
    else this.table.removeAttribute('class');
  }
}

export interface TableProps {
  width: string | null;
  align: TableAlign | null;
  /** The table style (a class from tableClassList); null means no style. Not set means unchanged. */
  class?: string | null;
}

export function getTableProps(state: EditorState): TableProps | null {
  const found = findTable(state.selection.$from);
  return found
    ? {
        width: found.node.attrs.width ?? null,
        align: found.node.attrs.align ?? null,
        class: found.node.attrs.class ?? null,
      }
    : null;
}

/** The table's width (px or %, null means by content) and alignment. */
export function setTableProps(props: TableProps): Command {
  return (state, dispatch) => {
    const found = findTable(state.selection.$from);
    if (!found) return false;
    if (props.width !== null && !cssValue.length(props.width)) return false;
    const attrs: Record<string, unknown> = {
      ...found.node.attrs,
      width: props.width,
      align: props.align,
    };
    if (props.class !== undefined) attrs.class = classAttr(props.class).class ?? null;
    dispatch?.(state.tr.setNodeMarkup(found.pos, undefined, attrs));
    return true;
  };
}

export interface CellProps {
  valign?: CellVAlign | null;
  /** true for a header cell (th), false for a regular one (td). */
  header?: boolean;
  /** Width of the selection's column(s) in px; null means by content. */
  width?: number | null;
  /** The cell style (a class from tableCellClassList); null means no style. */
  class?: string | null;
}

/** Positions of the selected cells (or of the cell with the cursor). */
function selectedCells(state: EditorState): { pos: number; node: PMNode }[] {
  const out: { pos: number; node: PMNode }[] = [];
  if (state.selection instanceof CellSelection) {
    state.selection.forEachCell((node, pos) => out.push({ node, pos }));
    return out;
  }
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const role = node.type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') {
      out.push({ node, pos: $from.before(depth) });
      break;
    }
  }
  return out;
}

export function getCellProps(state: EditorState): Required<CellProps> | null {
  const cell = selectedCells(state)[0];
  if (!cell) return null;
  const widths = cell.node.attrs.colwidth as number[] | null;
  return {
    valign: cell.node.attrs.valign ?? null,
    header: cell.node.type === (state.schema as NovaSchema).nodes.table_header,
    width: widths?.[0] ?? null,
    class: cell.node.attrs.class ?? null,
  };
}

/** Properties of the selected cells: vertical alignment, kind (th/td), column width. */
export function setCellProps(props: CellProps): Command {
  return (state, dispatch) => {
    const cells = selectedCells(state);
    if (!cells.length) return false;
    if (props.width != null && !(props.width >= 24 && props.width <= 4000)) return false;
    if (!dispatch) return true;
    const nodes = (state.schema as NovaSchema).nodes;
    const tr = state.tr;
    for (const { pos, node } of cells) {
      const type =
        props.header === undefined
          ? node.type
          : props.header
            ? nodes.table_header
            : nodes.table_cell;
      const attrs = {
        ...node.attrs,
        ...(props.valign !== undefined ? { valign: props.valign } : {}),
        ...(props.class !== undefined ? { class: classAttr(props.class).class ?? null } : {}),
      };
      tr.setNodeMarkup(pos, type, attrs);
    }
    if (props.width !== undefined) {
      // The width goes to every cell of the affected columns (colwidth is stored in each cell).
      const rect = selectedRect(state);
      const map = rect.map;
      const seen = new Set<number>();
      for (let col = rect.left; col < rect.right; col++) {
        for (let row = 0; row < map.height; row++) {
          const cellPos = map.map[row * map.width + col]!;
          const key = cellPos * 1000 + col;
          if (seen.has(key)) continue;
          seen.add(key);
          const absolute = rect.tableStart + cellPos;
          const cell = tr.doc.nodeAt(absolute);
          if (!cell) continue;
          const index = col - map.colCount(cellPos);
          const widths = [
            ...((cell.attrs.colwidth as number[] | null) ?? new Array(cell.attrs.colspan).fill(0)),
          ];
          widths[index] = props.width ?? 0;
          tr.setNodeMarkup(absolute, undefined, {
            ...cell.attrs,
            colwidth: widths.every((w) => !w) ? null : widths,
          });
        }
      }
    }
    dispatch(tr);
    return true;
  };
}
