import { definePlugin } from '../plugins';
import type { NodeAttribute } from '../schema';

/**
 * The advtable plugin (advanced tables, named as in TinyMCE): a column of row numbers (or letters,
 * or your own series) that stays in order as rows are added, deleted and sorted, and sorting by any
 * column or row, of the whole table or the selected cells. `plugins: ['advtable']`.
 *
 * In the first load is only what the document holds: the cells of the numbers column carry
 * `data-series="numeric"` (the series' name), so the column is found by its cells, not by its place,
 * and a number is never written over your text. The rest is advtable-ui.ts.
 */

const SERIES_RE = /^[a-z][\w-]{0,39}$/i;

/** A series' name from the HTML or JSON, or null. */
export function seriesName(value: unknown): string | null {
  return typeof value === 'string' && SERIES_RE.test(value) ? value : null;
}

const seriesAttribute: NodeAttribute = {
  nodes: ['table_cell', 'table_header'],
  default: null,
  parse: (dom) => seriesName(dom.getAttribute('data-series')),
  render: (value): Record<string, string> => {
    const name = seriesName(value);
    return name ? { 'data-series': name } : {};
  },
};

export default definePlugin({
  name: 'advtable',
  nodeAttributes: { series: seriesAttribute },
  load: () => import('./advtable-ui'),
});
