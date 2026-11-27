import fc from 'fast-check';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createEditor,
  listSuggestions,
  resolveSuggestions,
  setSuggesting,
  type Editor,
} from '../src';
import { insertTable, tableCommands } from '../src/table';

/**
 * Suggesting mode on random documents and random edits (typing, deleting, Enter, Backspace, lists,
 * Tab, quotes, headings, tables, rows, columns, lines, images): rejecting every suggestion gives back
 * exactly the document before the edits, and accepting the suggestions of one edit gives exactly
 * what the same edit gives outside suggesting mode. An edit that can't be a suggestion changes
 * nothing. `pnpm test:deep` runs it on many more documents.
 */

// About 18 ms a run (an editor edit and its decision): the nightly deep run gets at most 5000.
const RUNS = Math.min(Number(process.env.FC_RUNS) || 120, 5000);
// Each run is a few milliseconds; deep runs (thousands) need far more than the default 5 s.
const TIMEOUT = Math.max(5000, RUNS * 40);

let editor: Editor;
beforeAll(async () => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({
    element,
    plugins: ['suggestions'],
    pluginOptions: { suggestions: { author: { id: 'ann', name: 'Ann' }, enabled: true } },
  });
  await editor.ready;
});
afterAll(() => editor.destroy());

const words = fc.constantFrom('a', 'b c', 'de', 'f g h', 'xy');
const block = fc.oneof(
  words.map((t) => `<p>${t}</p>`),
  words.map((t) => `<h2>${t}</h2>`),
  fc
    .array(words, { minLength: 1, maxLength: 3 })
    .map((items) => `<ul>${items.map((t) => `<li><p>${t}</p></li>`).join('')}</ul>`),
  fc
    .tuple(words, words)
    .map(([a, b]) => `<ol><li><p>${a}</p><ul><li><p>${b}</p></li></ul></li></ol>`),
  fc
    .tuple(words, words, words, words)
    .map(
      ([a, b, c, d]) =>
        `<table><tbody><tr><td><p>${a}</p></td><td><p>${b}</p></td></tr><tr><td><p>${c}</p></td><td><p>${d}</p></td></tr></tbody></table>`,
    ),
  fc.constant('<hr>'),
  words.map((t) => `<blockquote><p>${t}</p></blockquote>`),
  words.map(
    (t) =>
      `<figure><img src="https://example.com/x.png" alt="x"><figcaption>${t}</figcaption></figure>`,
  ),
);
const documents = fc.array(block, { minLength: 1, maxLength: 4 }).map((b) => b.join(''));

const COMMANDS = [
  'bulletList',
  'orderedList',
  'blockquote',
  'h2',
  'paragraph',
  'alignCenter',
  'indent',
  'outdent',
  'horizontalRule',
] as const;
const TABLE = [
  'addRowAfter',
  'addColumnAfter',
  'deleteRow',
  'deleteColumn',
  'toggleHeaderRow',
  'deleteTable',
] as const;

type Action =
  | { kind: 'type'; block: number; at: number; text: string }
  | { kind: 'delete'; block: number; at: number; length: number }
  | { kind: 'across'; from: number; to: number }
  | { kind: 'command'; block: number; name: (typeof COMMANDS)[number] }
  | { kind: 'table'; block: number; name: (typeof TABLE)[number] }
  | { kind: 'insertTable'; block: number; at: number }
  | { kind: 'key'; block: number; at: number; key: 'Enter' | 'Backspace' }
  | { kind: 'deleteNode'; index: number };

const ratio = fc.double({ min: 0, max: 1, noNaN: true });
const index = fc.nat(20);
const action: fc.Arbitrary<Action> = fc.oneof(
  fc.record({ kind: fc.constant('type' as const), block: index, at: ratio, text: words }),
  fc.record({ kind: fc.constant('delete' as const), block: index, at: ratio, length: ratio }),
  fc.record({ kind: fc.constant('across' as const), from: ratio, to: ratio }),
  fc.record({
    kind: fc.constant('command' as const),
    block: index,
    name: fc.constantFrom(...COMMANDS),
  }),
  fc.record({ kind: fc.constant('table' as const), block: index, name: fc.constantFrom(...TABLE) }),
  fc.record({ kind: fc.constant('insertTable' as const), block: index, at: ratio }),
  fc.record({
    kind: fc.constant('key' as const),
    block: index,
    at: ratio,
    key: fc.constantFrom('Enter' as const, 'Backspace' as const),
  }),
  fc.record({ kind: fc.constant('deleteNode' as const), index }),
);

/** Text blocks of the document: their content start and size. */
function textblocks(): { start: number; size: number; inTable: boolean }[] {
  const out: { start: number; size: number; inTable: boolean }[] = [];
  editor.view.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const $pos = editor.view.state.doc.resolve(pos);
    let inTable = false;
    for (let d = $pos.depth; d > 0; d--) if ($pos.node(d).type.name === 'table') inTable = true;
    out.push({ start: pos + 1, size: node.content.size, inTable });
    return false;
  });
  return out;
}

const place = (r: number, size: number) => Math.min(size, Math.floor(r * (size + 1)));

function cursor(pos: number) {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)));
}

function run(a: Action): void {
  const blocks = textblocks();
  const { state } = editor.view;
  // A document of lines only: nothing to type into.
  if (!blocks.length && a.kind !== 'deleteNode') return;
  switch (a.kind) {
    case 'type': {
      const b = blocks[a.block % blocks.length]!;
      editor.view.dispatch(state.tr.insertText(a.text, b.start + place(a.at, b.size)));
      return;
    }
    case 'delete': {
      const b = blocks[a.block % blocks.length]!;
      const from = b.start + place(a.at, b.size);
      const to = Math.min(b.start + b.size, from + Math.ceil(a.length * b.size));
      if (to > from) editor.view.dispatch(state.tr.delete(from, to));
      return;
    }
    case 'across': {
      const all = blocks.flatMap((b) =>
        Array.from({ length: b.size + 1 }, (_, i) => ({ pos: b.start + i, table: b.inTable })),
      );
      const x = all[Math.floor(a.from * (all.length - 1))]!;
      const y = all[Math.floor(a.to * (all.length - 1))]!;
      // Across table cells a deletion is a cell selection's business, not tested here.
      if (x.table || y.table || x.pos === y.pos) return;
      editor.view.dispatch(state.tr.delete(Math.min(x.pos, y.pos), Math.max(x.pos, y.pos)));
      return;
    }
    case 'command': {
      const b = blocks[a.block % blocks.length]!;
      cursor(b.start);
      editor.exec(a.name);
      return;
    }
    case 'table': {
      const cells = blocks.filter((b) => b.inTable);
      if (!cells.length) return;
      const b = cells[a.block % cells.length]!;
      cursor(b.start);
      editor.exec(tableCommands[a.name]);
      return;
    }
    case 'insertTable': {
      const b = blocks[a.block % blocks.length]!;
      if (b.inTable) return;
      cursor(b.start + place(a.at, b.size));
      editor.exec(insertTable(2, 2, false));
      return;
    }
    case 'key': {
      const b = blocks[a.block % blocks.length]!;
      cursor(a.key === 'Backspace' ? b.start : b.start + place(a.at, b.size));
      editor.view.someProp('handleKeyDown', (f) =>
        f(editor.view, new KeyboardEvent('keydown', { key: a.key })),
      );
      return;
    }
    case 'deleteNode': {
      const leaves: number[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'horizontal_rule' || node.type.name === 'figure') leaves.push(pos);
        return true;
      });
      if (!leaves.length) return;
      const pos = leaves[a.index % leaves.length]!;
      editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
      editor.view.dispatch(editor.view.state.tr.deleteSelection());
      return;
    }
  }
}

const decide = (action: 'accept' | 'reject') =>
  editor.view.dispatch(resolveSuggestions(editor.view.state, action));

describe('suggesting mode on random documents and edits', () => {
  it(
    'rejecting every suggestion gives back exactly the document before the edits',
    () => {
      fc.assert(
        fc.property(
          documents,
          fc.array(action, { minLength: 1, maxLength: 4 }),
          (html, actions) => {
            setSuggesting(editor, true);
            editor.setContent(html);
            const before = editor.view.state.doc;
            for (const a of actions) run(a);
            editor.view.state.doc.check();
            decide('reject');
            const after = editor.view.state.doc;
            after.check();
            expect(listSuggestions(after)).toEqual([]);
            expect(after.toJSON()).toEqual(before.toJSON());
          },
        ),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );

  it(
    'accepting the suggestions of one edit gives what the edit gives outside suggesting mode',
    () => {
      const exact = action.filter((a) => a.kind !== 'across' && a.kind !== 'key');
      fc.assert(
        fc.property(documents, exact, (html, a) => {
          setSuggesting(editor, false);
          editor.setContent(html);
          run(a);
          const direct = editor.view.state.doc.toJSON();
          setSuggesting(editor, true);
          editor.setContent(html);
          const before = editor.view.state.doc.toJSON();
          run(a);
          const suggested = editor.view.state.doc.toJSON();
          decide('accept');
          const accepted = editor.view.state.doc;
          accepted.check();
          // Not a suggestion at all (merging cells): nothing changed.
          if (JSON.stringify(suggested) === JSON.stringify(before)) return;
          expect(accepted.toJSON()).toEqual(direct);
        }),
        { numRuns: RUNS },
      );
    },
    TIMEOUT,
  );
});
