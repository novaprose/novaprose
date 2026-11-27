import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import {
  formatDate,
  insertTemplate,
  processTemplate,
  replaceValues,
} from '../src/plugins/template';
import type { DialogSpec } from '../src/ui/form-dialog-types';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function ready(content: string, options: Partial<EditorOptions> = {}): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, plugins: ['template'], ...options });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const DATE = new Date(2026, 10, 27, 14, 5, 9);

describe('template content', () => {
  it('dates in the TinyMCE format', () => {
    expect(formatDate('%Y-%m-%d', DATE)).toBe('2026-11-27');
    expect(formatDate('%D %r', DATE)).toBe('11/27/26 02:05:09 PM');
    expect(formatDate('%d %B %Y, %A', DATE, 'en')).toBe('27 November 2026, Friday');
    expect(formatDate('100%% at %H:%M', DATE)).toBe('100% at 14:05');
  });

  it('{$name} becomes the value as text; unknown names stay', () => {
    expect(replaceValues('<p>{$name} and {$other}</p>', { name: '<b>Ann</b>' })).toBe(
      '<p>&lt;b&gt;Ann&lt;/b&gt; and {$other}</p>',
    );
  });

  it('only what is inside div.mceTmpl is inserted; the preview shows everything', () => {
    const html = '<h1>About this template</h1><div class="mceTmpl"><p>Body</p></div>';
    expect(processTemplate(html, {})).toBe('<p>Body</p>');
    expect(processTemplate(html, { preview: true })).toBe(html);
  });

  it('cdate and mdate get the date, selcontent the selection; previewValues in the preview', () => {
    const html =
      '<p>Made <span class="cdate">x</span>, changed <span class="stamp">x</span></p>' +
      '<p class="selcontent">old</p><p>{$who}</p>';
    expect(
      processTemplate(html, {
        date: DATE,
        modifiedDateClasses: 'stamp',
        modifiedDateFormat: '%d.%m.%Y',
        selection: '<strong>chosen</strong>',
        values: { who: 'Ann' },
      }),
    ).toBe(
      '<p>Made <span class="cdate">2026-11-27</span>, changed <span class="stamp">27.11.2026</span></p>' +
        '<p class="selcontent"><strong>chosen</strong></p><p>Ann</p>',
    );
    expect(
      processTemplate('<p>{$who}</p>', {
        values: { who: 'Ann' },
        previewValues: { who: 'Name' },
        preview: true,
      }),
    ).toBe('<p>Name</p>');
  });
});

describe('the template plugin', () => {
  const TEMPLATES = [
    { title: 'Letter', description: 'A short letter', content: '<p>Dear {$name},</p>' },
    { title: 'Report', url: '/templates/report.html' },
  ];

  it('the dialog lists the templates and inserts the chosen one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<h2>Report</h2><p class="selcontent">x</p>')),
    );
    const editor = await ready('<p>pick me</p>', {
      pluginOptions: { template: { templates: TEMPLATES, values: { name: 'Ann' } } },
    });
    let spec: DialogSpec | undefined;
    vi.spyOn(editor.ui, 'dialog').mockImplementation(async (s) => {
      spec = s;
      return null;
    });
    editor.ui.registry.getMenuItem('template')!.onAction(editor);
    await vi.waitFor(() => expect(spec).toBeDefined());
    const select = spec!.fields!.find((f) => f.type === 'select');
    expect(select && 'options' in select ? select.options.map((o) => o.label) : []).toEqual([
      'Letter',
      'Report',
    ]);
    const api = { setError: vi.fn() } as never;
    await spec!.onSubmit!({ template: '0' }, api);
    expect(editor.getHTML()).toBe('<p>Dear Ann,</p><p>pick me</p>');
    // The selection goes into the selcontent element.
    const { state } = editor.view;
    const end = state.doc.content.size;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, end - 8, end - 1)));
    await spec!.onSubmit!({ template: '1' }, api);
    expect(editor.getHTML()).toBe('<p>Dear Ann,</p><h2>Report</h2><p>pick me</p>');
  });

  it('templates from a function or a URL of a JSON list', async () => {
    const fromFunction = await ready('<p></p>', {
      pluginOptions: { template: { templates: async () => [TEMPLATES[0]!] } },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json([{ title: 'From JSON', content: '<p>j</p>' }])),
    );
    const fromUrl = await ready('<p></p>', {
      pluginOptions: { template: { templates: '/templates.json' } },
    });
    for (const [editor, title] of [
      [fromFunction, 'Letter'],
      [fromUrl, 'From JSON'],
    ] as const) {
      let spec: DialogSpec | undefined;
      vi.spyOn(editor.ui, 'dialog').mockImplementation(async (s) => ((spec = s), null));
      editor.ui.registry.getMenuItem('template')!.onAction(editor);
      await vi.waitFor(() => expect(spec).toBeDefined());
      const select = spec!.fields!.find((f) => f.type === 'select');
      expect(select && 'options' in select ? select.options[0]!.label : '').toBe(title);
    }
  });

  it('insertTemplate goes through the schema: no scripts, no unsafe links', async () => {
    const editor = await ready('<p></p>');
    insertTemplate(editor, '<p><a href="javascript:alert(1)">x</a><script>alert(2)</script></p>');
    expect(editor.getHTML()).toBe('<p>x</p>');
  });
});
