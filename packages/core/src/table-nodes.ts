/**
 * Table nodes for the schema, without depending on prosemirror-tables: the library itself (cell
 * selection, column widths, commands) loads lazily, but the schema is needed right away. The specs
 * are compatible with it (tableRole, the colspan/rowspan/colwidth attributes, the same HTML).
 *
 * Adapted from prosemirror-tables (MIT, © Marijn Haverbeke and others): tableNodes, getCellAttrs,
 * setCellAttrs.
 */
import type { NodeSpec } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';

type Attrs = Record<string, unknown>;

export interface CellAttribute {
  default: unknown;
  getFromDOM?: (dom: HTMLElement) => unknown;
  setDOMAttr?: (value: unknown, attrs: Attrs) => void;
}

function getCellAttrs(dom: HTMLElement | string, extra: Record<string, CellAttribute>): Attrs {
  if (typeof dom === 'string') return {};
  const widthAttr = dom.getAttribute('data-colwidth');
  const widths =
    widthAttr && /^\d+(,\d+)*$/.test(widthAttr) ? widthAttr.split(',').map((s) => Number(s)) : null;
  const colspan = Number(dom.getAttribute('colspan') || 1);
  const result: Attrs = {
    colspan,
    rowspan: Number(dom.getAttribute('rowspan') || 1),
    colwidth: widths && widths.length === colspan ? widths : null,
  };
  for (const [name, spec] of Object.entries(extra)) {
    const value = spec.getFromDOM?.(dom);
    if (value != null) result[name] = value;
  }
  return result;
}

function setCellAttrs(node: { attrs: Attrs }, extra: Record<string, CellAttribute>): Attrs {
  const attrs: Attrs = {};
  if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan;
  if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan;
  if (Array.isArray(node.attrs.colwidth)) attrs['data-colwidth'] = node.attrs.colwidth.join(',');
  for (const [name, spec] of Object.entries(extra)) spec.setDOMAttr?.(node.attrs[name], attrs);
  return attrs;
}

function validateColwidth(value: unknown): void {
  if (value === null) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'number')) {
    throw new TypeError('colwidth must be null or an array of numbers');
  }
}

export function tableNodes(options: {
  tableGroup: string;
  cellContent: string;
  cellAttributes: Record<string, CellAttribute>;
}): Record<'table' | 'table_row' | 'table_cell' | 'table_header', NodeSpec> {
  const extra = options.cellAttributes;
  const cellAttrs: Record<
    string,
    { default: unknown; validate?: string | ((v: unknown) => void) }
  > = {
    colspan: { default: 1, validate: 'number' },
    rowspan: { default: 1, validate: 'number' },
    colwidth: { default: null, validate: validateColwidth },
  };
  for (const [name, spec] of Object.entries(extra)) cellAttrs[name] = { default: spec.default };
  const cell = (tag: 'td' | 'th', role: 'cell' | 'header_cell'): NodeSpec => ({
    content: options.cellContent,
    attrs: cellAttrs,
    tableRole: role,
    isolating: true,
    parseDOM: [{ tag, getAttrs: (dom) => getCellAttrs(dom as HTMLElement, extra) }],
    toDOM: (node) => [tag, setCellAttrs(node, extra), 0],
  });
  return {
    table: {
      content: 'table_row+',
      tableRole: 'table',
      isolating: true,
      group: options.tableGroup,
      parseDOM: [{ tag: 'table' }],
      toDOM: () => ['table', ['tbody', 0]],
    },
    table_row: {
      content: '(table_cell | table_header)*',
      tableRole: 'row',
      parseDOM: [{ tag: 'tr' }],
      toDOM: () => ['tr', 0],
    },
    table_cell: cell('td', 'cell'),
    table_header: cell('th', 'header_cell'),
  };
}

/** The cursor is inside a table (like isInTable from prosemirror-tables). */
export function isInTable(state: EditorState): boolean {
  const { $head } = state.selection;
  for (let depth = $head.depth; depth > 0; depth--) {
    if ($head.node(depth).type.spec.tableRole === 'row') return true;
  }
  return false;
}
