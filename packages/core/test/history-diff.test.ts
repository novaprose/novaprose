import { describe, expect, it } from 'vitest';
import { createSchema, parserFor } from '../src';
import { diffDocs } from '../src/plugins/history-diff';

/** Comparing a version with the current document (for viewing the version history). */

const schema = createSchema();
const parse = (html: string) => {
  const element = document.createElement('div');
  element.innerHTML = html;
  return parserFor(schema).parse(element);
};

/** The version's text with marks: [added] and {removed}. */
function render(revisionHtml: string, currentHtml: string): string {
  const revision = parse(revisionHtml);
  const { added, removed } = diffDocs(revision, parse(currentHtml));
  const marks: { pos: number; text: string; order: number }[] = [];
  for (const range of added) {
    marks.push({ pos: range.from, text: '[', order: 1 }, { pos: range.to, text: ']', order: 0 });
  }
  for (const r of removed) marks.push({ pos: r.pos, text: `{${r.text}}`, order: 2 });
  let out = '';
  revision.descendants((node, pos) => {
    if (node.isTextblock) {
      if (out) out += ' | ';
      const at = (p: number) =>
        marks
          .filter((x) => x.pos === p)
          .sort((x, y) => x.order - y.order)
          .map((m) => m.text)
          .join('');
      // The position before a block (insertions of whole blocks), then the content: marks before each character.
      out += at(pos);
      const end = pos + node.nodeSize - 1;
      for (let p = pos + 1; p <= end; p += 1) {
        out += at(p);
        if (p < end) out += revision.textBetween(p, p + 1);
      }
      return false;
    }
    return true;
  });
  return out;
}

describe('diffDocs', () => {
  it('identical documents have no marks', () => {
    expect(render('<p>Same text</p><p>Two</p>', '<p>Same text</p><p>Two</p>')).toBe(
      'Same text | Two',
    );
  });

  it('a changed word: the old one is added (in the version), the new one removed (in the current document)', () => {
    expect(render('<p>The quick fox</p>', '<p>The slow fox</p>')).toBe('The [quick]{slow} fox');
  });

  it("a paragraph that isn't in the current document is marked as a whole", () => {
    expect(render('<p>Keep</p><p>Old idea</p>', '<p>Keep</p>')).toBe('Keep | [Old idea]');
  });

  it('a paragraph added later is shown as an insertion before the next one', () => {
    expect(render('<p>A</p><p>C</p>', '<p>A</p><p>B new</p><p>C</p>')).toBe('A | {B new}C');
  });

  it('a removed paragraph before a list goes before the list, not inside an item', () => {
    const revision = parse('<p>Intro</p><ul><li><p>Item</p></li></ul>');
    const { removed } = diffDocs(
      revision,
      parse('<p>Intro</p><p>Gone</p><ul><li><p>Item</p></li></ul>'),
    );
    expect(removed).toEqual([{ pos: 7, text: 'Gone', block: true }]);
    expect(revision.resolve(7).depth).toBe(0);
  });

  it('changing the block type (paragraph → heading) is a change', () => {
    const { added, removed } = diffDocs(parse('<p>Title</p>'), parse('<h2>Title</h2>'));
    expect(added.length + removed.length).toBeGreaterThan(0);
  });
});
