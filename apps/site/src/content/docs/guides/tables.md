---
title: Tables
description: Rows, columns, headers, merged cells and properties, sorting by any column or row, and row numbers that stay in order.
---

Tables are built in. The **Table** button inserts one (pick the size on the grid), and with the
cursor in a table its toolbar appears: rows and columns before and after, deleting them, merging
and splitting cells, header rows and columns, the cell color, sorting, and the table and cell
properties. The **Table** menu has the row, column and cell commands too.

- <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> move to the next and previous cell; <kbd>Tab</kbd>
  in the last cell adds a row.
- Drag across cells, or hold <kbd>Shift</kbd> with the arrows, to select several (to merge them, or
  to give them a color).
- **Table properties** set the width (`100%`, `600px`) and alignment; **Cell properties** set the
  vertical alignment, header or data cell and the column width, which also works on touch screens.
- Wide tables scroll inside the editor on narrow screens.

## Sorting

**Sort** (`advtablesort`) sorts the rows by the column with the cursor, A to Z or Z to A. Numbers are
compared as numbers when every cell of the column holds one (`1,200`, `$45.00`, `-3.5 %`), text in
the order of the editor's language, empty cells go last, and header rows stay on top. A table with
merged cells isn't sorted: moving its rows would break the merged cells apart.

## Advanced tables

The `advtable` plugin adds a **Sort…** dialog and a column of row numbers:

```ts
createEditor({ element, plugins: ['advtable'] });
```

**Sort…** (in the sort button's menu and in the **Table** menu) sorts the rows by any column, or the
columns by any row (to put them in the order of their headings, say), the whole table or only the
selected cells. Header rows and header columns stay where they are.

**Row numbers** (`advtablerownumbering`) adds a narrow first column numbered 1, 2, 3; its menu
switches to letters (A, B, C) or takes the column away. The numbers stay in order whatever happens
to the rows: a row added with <kbd>Tab</kbd> gets its number, a deleted one takes its number along,
and after sorting the rows are numbered from the top again. Header rows get no number.

The column is found by its cells, which carry `data-series` in the HTML, not by its place: a column
added before it doesn't get numbers, and a number is never written over text you typed.

```html
<table>
  <tbody>
    <tr>
      <th data-colwidth="48" style="width: 48px;" data-series="numeric"><p></p></th>
      <th><p>Fruit</p></th>
    </tr>
    <tr>
      <td data-colwidth="48" style="width: 48px;" data-series="numeric"><p>1</p></td>
      <td><p>Pear</p></td>
    </tr>
  </tbody>
</table>
```

Series of your own go in the menu next to numbers and letters:

```ts
pluginOptions: {
  advtable: {
    series: {
      roman: { title: 'Roman', value: (index) => ['i', 'ii', 'iii', 'iv', 'v'][index] },
    },
  },
}
```

`value` gets the row's place among the numbered rows (from 0) and returns its text; returning
`undefined` leaves the cell as it is.

In a shared document the numbers are written by the editor of the person who changed the rows, never
by everyone at once. When two people add rows at the same moment, the next change puts the numbers
in order.

## Coming from TinyMCE

`plugins: 'table advtable'` with `tinymce.init()` works. `mceTableToggleSeries` (`{ name }`),
`mceSortTableAdvanced` (`sortby`, `roworcol`, `sort`, `order`), `mceSortTableByColumnAsc` and
`…Desc`, `mceSortTableByRowAsc` and `…Desc` and `mceAdvancedTableSort` run as described there, and
the generators of `advtable_value_series` give the values of the numbered rows. Header rows get no
number here.
