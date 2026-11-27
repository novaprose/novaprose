import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import type { MenuEntry } from '../src/ui/menu';
import {
  formatFromSelector,
  formatsFromCss,
  selectorsFromCss,
  type ImportCssOptions,
} from '../src/plugins/importcss';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.unstubAllGlobals();
});

async function ready(options: Partial<EditorOptions>): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({
    element,
    content: '<p>text</p>',
    plugins: ['importcss'],
    ...options,
  });
  editors.push(editor);
  await editor.ready;
  return editor;
}

/** The labels of the Styles menu, groups as headings. */
function stylesMenu(editor: Editor): string[] {
  const styles = editor.ui.registry.get('styles');
  if (styles?.type !== 'menu') throw new Error('no styles menu');
  return styles
    .items(editor)
    .flatMap((entry: MenuEntry) =>
      entry.type === 'separator'
        ? []
        : [entry.type === 'heading' ? `# ${entry.label}` : entry.label],
    );
}

describe('selectors → Styles items', () => {
  it.each([
    ['p.lead', { title: 'lead', block: 'p', classes: ['lead'] }],
    ['h2.fancy', { title: 'fancy', block: 'h2', classes: ['fancy'] }],
    ['.badge', { title: 'badge', inline: 'span', classes: ['badge'] }],
    ['span.tag.big', { title: 'tag big', inline: 'span', classes: ['tag', 'big'] }],
    ['strong.alert', { title: 'alert', inline: 'strong', classes: ['alert'] }],
    ['img.round', { title: 'round', selector: 'img', classes: ['round'] }],
  ])('%s', (selector, format) => expect(formatFromSelector(selector)).toEqual(format));

  it.each([
    'div.box',
    'table.grid',
    'p .note',
    'a:hover',
    '.x > .y',
    '#main',
    'p',
    '*',
    '[data-x]',
  ])('left out: %s', (selector) => expect(formatFromSelector(selector)).toBeNull());

  it('reads every rule, inside @media too, and splits selector lists', () => {
    expect(selectorsFromCss('.a, p.b { color: red } @media print { .c { color: blue } }')).toEqual([
      '.a',
      'p.b',
      '.c',
    ]);
  });

  it('each selector once; the same classes on another element get the element in the title', () => {
    const formats = formatsFromCss('p.note{} span.note{} p.note{} .x{}');
    expect(formats.map((f) => f.title)).toEqual(['note', 'note (span)', 'x']);
  });

  it('selectorFilter: a prefix, a regular expression or a function', () => {
    const css = '.brand-a{} .brand-b{} .other{}';
    const titles = (selectorFilter: ImportCssOptions['selectorFilter']) =>
      formatsFromCss(css, { selectorFilter }).map((f) => f.title);
    expect(titles('.brand-')).toEqual(['brand-a', 'brand-b']);
    expect(titles(/other/)).toEqual(['other']);
    expect(titles((s: string) => s.endsWith('-b'))).toEqual(['brand-b']);
  });

  it('groups: the first matching one, the one without a filter takes the rest', () => {
    const formats = formatsFromCss('p.intro{} .badge{} .note{}', {
      groups: [
        { title: 'Paragraphs', filter: /^p\./ },
        { title: 'Text', filter: (s) => s.startsWith('.') && s !== '.note' },
        { title: 'Other' },
      ],
    });
    expect(formats.map((g) => [g.title, g.items?.map((f) => f.title)])).toEqual([
      ['Paragraphs', ['intro']],
      ['Text', ['badge']],
      ['Other', ['note']],
    ]);
  });

  it('converter: your own item, or false to skip', () => {
    const formats = formatsFromCss('.skip{} .warn{}', {
      converter: (selector) =>
        selector === '.skip' ? false : { title: 'Warning', block: 'p', classes: ['warn'] },
    });
    expect(formats).toEqual([{ title: 'Warning', block: 'p', classes: ['warn'] }]);
  });
});

describe('the importcss plugin', () => {
  it('adds the classes of contentStyle to the Styles menu, after its own items', async () => {
    const editor = await ready({
      contentStyle: 'p.lead { font-size: 1.25em } .badge { color: #555 }',
    });
    await vi.waitFor(() => expect(stylesMenu(editor)).toContain('lead'));
    const menu = stylesMenu(editor);
    expect(menu.indexOf('lead')).toBeGreaterThan(menu.indexOf('# Headings'));
    expect(menu).toContain('badge');
  });

  it('reads contentCss files; append: false leaves only the imported items', async () => {
    const fetch = vi.fn(async () => new Response('.from-file { color: red }'));
    vi.stubGlobal('fetch', fetch);
    const editor = await ready({
      contentCss: '/content.css',
      pluginOptions: { importcss: { append: false } },
    });
    await vi.waitFor(() => expect(stylesMenu(editor)).toEqual(['from-file']));
    expect(fetch).toHaveBeenCalled();
  });

  it('applying an imported block style gives the paragraph its class', async () => {
    const editor = await ready({ contentStyle: 'p.lead { font-size: 1.25em }' });
    await vi.waitFor(() => expect(stylesMenu(editor)).toContain('lead'));
    const styles = editor.ui.registry.get('styles');
    if (styles?.type !== 'menu') throw new Error('no styles menu');
    const item = styles.items(editor).find((e) => e.type !== 'separator' && e.label === 'lead');
    (item as { onSelect(): void }).onSelect();
    expect(editor.getHTML()).toBe('<p class="lead">text</p>');
  });
});
