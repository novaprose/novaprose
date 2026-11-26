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

/** Tab — следующая ячейка; в последней ячейке — новая строка (как в Word и TinyMCE). */
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
    // defaultCellMinWidth — минимум для столбцов без заданной ширины (по умолчанию 100px:
    // таблица из 5+ столбцов раньше времени вылезала за край узкого редактора).
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
  // Без устаревшей логики (та смотрит на угловую ячейку и путает строку/столбец заголовков).
  toggleHeaderRow: toggleHeader('row'),
  toggleHeaderColumn: toggleHeader('column'),
  deleteTable,
} satisfies Record<string, Command>;

export { isInTable };

/** Background of the selected cells (null removes it). */
export function setCellBackground(color: string | null): Command {
  return setCellAttr('background', color);
}

/** Есть ли в текущей таблице строка-заголовок (первая строка из th). */
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

/** Есть ли столбец-заголовок (первая ячейка каждой строки — th). */
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

/** Выделено ли несколько ячеек (для «объединить»). */
export function isCellSelection(state: EditorState): boolean {
  return state.selection instanceof CellSelection;
}

export { selectedRect };

// ---------- сортировка по столбцу ----------

export type SortDirection = 'asc' | 'desc';

/** Число из текста ячейки («1 200», «$45.00», «-3,5 %»), иначе null — тогда сравниваем как текст. */
function numericValue(text: string): number | null {
  const cleaned = text
    .replace(/\s/g, '')
    .replace(/^[^\d+-]+|[^\d]+$/g, '') // валюта и единицы по краям
    .replace(/,(?=\d{3}(?:\D|$))/g, '') // разделитель тысяч «1,200»
    .replace(',', '.'); // десятичная запятая «3,5»
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

interface SortTarget {
  pos: number;
  table: PMNode;
  column: number;
  /** Число строк-заголовков сверху (их не сортируем). */
  headerRows: number;
}

function sortTarget(state: EditorState): SortTarget | null {
  if (!isInTable(state)) return null;
  const rect = selectedRect(state);
  const table = rect.table;
  // Объединённые ячейки ломают построчную перестановку — такие таблицы не сортируем.
  let merged = false;
  table.descendants((node) => {
    if (node.attrs.colspan > 1 || node.attrs.rowspan > 1) merged = true;
    return (
      !merged && node.type.spec.tableRole !== 'cell' && node.type.spec.tableRole !== 'header_cell'
    );
  });
  if (merged) return null;
  const nodes = (state.schema as NovaSchema).nodes;
  let headerRows = 0;
  for (let i = 0; i < table.childCount; i++) {
    let allHeaders = true;
    table.child(i).forEach((cell) => {
      if (cell.type !== nodes.table_header) allHeaders = false;
    });
    if (!allHeaders) break;
    headerRows++;
  }
  if (table.childCount - headerRows < 2) return null;
  return { pos: rect.tableStart - 1, table, column: rect.left, headerRows };
}

/** Отсортировать строки таблицы по столбцу с курсором. Строки-заголовки остаются сверху. */
export function sortTable(direction: SortDirection, locale?: string): Command {
  return (state, dispatch) => {
    const target = sortTarget(state);
    if (!target) return false;
    if (dispatch) {
      const { table, column, headerRows, pos } = target;
      const rows: PMNode[] = [];
      table.forEach((row) => rows.push(row));
      const head = rows.slice(0, headerRows);
      const body = rows.slice(headerRows);
      const texts = body.map((row) =>
        column < row.childCount ? row.child(column).textContent.trim() : '',
      );
      const numbers = texts.map(numericValue);
      // Числовая сортировка, только если числа во всех непустых ячейках столбца.
      const numeric = texts.every((t, i) => t === '' || numbers[i] !== null);
      const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
      const order = body
        .map((row, i) => ({ row, i }))
        .sort((a, b) => {
          const ta = texts[a.i]!;
          const tb = texts[b.i]!;
          // Пустые ячейки — всегда в конце.
          if (!ta || !tb) return ta ? -1 : tb ? 1 : a.i - b.i;
          const cmp = numeric ? numbers[a.i]! - numbers[b.i]! : collator.compare(ta, tb);
          return (direction === 'asc' ? cmp : -cmp) || a.i - b.i;
        })
        .map(({ row }) => row);
      const sorted = table.copy(Fragment.from([...head, ...order]));
      dispatch(state.tr.replaceWith(pos, pos + table.nodeSize, sorted).scrollIntoView());
    }
    return true;
  };
}

// ---------- свойства таблицы и ячеек ----------

/**
 * Представление таблицы в редакторе: поверх расчёта ширины столбцов (prosemirror-tables) применяет
 * заданную ширину и выравнивание таблицы, чтобы в редакторе было видно то же, что получится на сайте.
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
    // Стиль таблицы (класс) — чтобы CSS сайта (contentCss) показал рамки так же, как на печати.
    const cls = classAttr(node.attrs.class).class;
    if (cls) this.table.setAttribute('class', cls);
    else this.table.removeAttribute('class');
  }
}

export interface TableProps {
  width: string | null;
  align: TableAlign | null;
  /** Стиль таблицы (класс из tableClassList); null — без стиля. Не задан — не меняется. */
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

/** Ширина (px или %, null — по содержимому) и выравнивание таблицы. */
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
  /** true — ячейка-заголовок (th), false — обычная (td). */
  header?: boolean;
  /** Ширина столбца(ов) выделения в px; null — по содержимому. */
  width?: number | null;
  /** Стиль ячейки (класс из tableCellClassList); null — без стиля. */
  class?: string | null;
}

/** Позиции выделенных ячеек (или ячейки с курсором). */
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

/** Свойства выделенных ячеек: вертикальное выравнивание, тип (th/td), ширина столбца. */
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
      // Ширина — у всех ячеек затронутых столбцов (colwidth хранится в каждой ячейке).
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
