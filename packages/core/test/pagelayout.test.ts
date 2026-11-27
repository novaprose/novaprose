import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, pageLayout, type Editor } from '../src';
import { resolvePageLayout } from '../src/plugins/pagelayout';
import { paginate, type Line } from '../src/plugins/pagelayout-ui';
import { buildPrintDocument, printCss } from '../src/ui/print';

/**
 * Page mode: sheet settings, laying lines out into pages (a pure function; the layout
 * in a browser is checked by e2e/pages.spec.ts, together with the PDF), the print document.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-test]').forEach((el) => el.remove());
});

function mount(options: Record<string, unknown> = {}, content = '<p>Hello</p>'): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, plugins: ['pagelayout'], ...options });
  return editor;
}

describe('the sheet', () => {
  it('sizes, orientation, margins; garbage gets the defaults', () => {
    expect(resolvePageLayout()).toEqual({
      size: 'A4',
      orientation: 'portrait',
      width: 210,
      height: 297,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      header: null,
      footer: null,
      differentFirstPage: false,
    });
    const a5 = resolvePageLayout({ size: 'A5', orientation: 'landscape', margins: { top: 10 } });
    expect([a5.width, a5.height, a5.orientation]).toEqual([210, 148, 'landscape']);
    expect(a5.margins).toEqual({ top: 10, right: 20, bottom: 20, left: 20 });
    // A custom size: the orientation as given, or from an explicit setting.
    expect(resolvePageLayout({ size: { width: 100, height: 50 } }).orientation).toBe('landscape');
    const portrait = resolvePageLayout({
      size: { width: 100, height: 50 },
      orientation: 'portrait',
    });
    expect([portrait.width, portrait.height]).toEqual([50, 100]);
    // Garbage: an unknown size becomes A4, margins at most a third of the sheet, not negative.
    const junk = resolvePageLayout({
      size: 'B9' as never,
      margins: { top: -5, left: 500, right: 'x' as never },
    });
    expect(junk.size).toBe('A4');
    expect(junk.margins).toEqual({ top: 0, right: 20, bottom: 20, left: 70 });
    expect(resolvePageLayout({ size: { width: null, height: 'x' } as never }).width).toBe(210);
  });

  it('the sheet in CSS variables; pageLayout(editor).set() changes it and reports it', () => {
    const e = mount({ pluginOptions: { pagelayout: { size: 'A5', margins: 15 } } });
    expect(e.root.classList).toContain('nova-pages');
    expect(e.root.style.getPropertyValue('--nova-page-width')).toBe('148mm');
    expect(e.root.style.getPropertyValue('--nova-page-margins')).toBe('15mm 15mm 15mm 15mm');
    const controller = pageLayout(e)!;
    const changed = vi.fn();
    const off = controller.onChange(changed);
    controller.set({ orientation: 'landscape' });
    expect(controller.layout).toMatchObject({ size: 'A5', width: 210, height: 148 });
    expect(e.root.style.getPropertyValue('--nova-page-height')).toBe('148mm');
    expect(changed).toHaveBeenCalledTimes(1);
    off();
    controller.set({ margins: 10 });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(controller.layout.margins.left).toBe(10);
  });

  it('without the plugin: undefined', () => {
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({ element });
    expect(pageLayout(editor)).toBeUndefined();
  });
});

describe('laying out pages', () => {
  const line = (top: number, bottom = top + 20): Line => ({ top, bottom });

  it("a line that doesn't fit on the page starts the next one; the border is between lines", () => {
    // A page of 100 px of text, lines of 20 px every 25.
    const lines = Array.from({ length: 10 }, (_, i) => line(i * 25));
    expect(paginate(lines, 0, 100)).toEqual([
      { at: 100, mark: 97.5 },
      { at: 200, mark: 197.5 },
    ]);
  });

  it('text and an image on one line are one line; a tall image is not split', () => {
    const lines = [line(0), line(30, 50), { top: 28, bottom: 90 }, line(95)];
    // 28..90 and 30..50 are one line (up to 90): it fits (90 ≤ 100); 95..115 doesn't.
    expect(paginate(lines, 0, 100).map((b) => b.at)).toEqual([95]);
    // A block taller than a page at the start of a page isn't moved on forever.
    expect(paginate([line(0, 250), line(260)], 0, 100).map((b) => b.at)).toEqual([260]);
  });

  it('a page break: the next block starts a new page, its top margin is kept', () => {
    const lines = [line(0), { top: 30, bottom: 30, forced: true, offset: 10 }, line(45)];
    expect(paginate(lines, 0, 100)).toEqual([{ at: 35, mark: 30 }]);
    // A break at the very start of a page doesn't add a new page.
    expect(paginate([{ top: 0, bottom: 0, forced: true }, line(0)], 0, 100)).toEqual([]);
  });
});

describe('the print document', () => {
  it("page styles, the sheet in @page, a root like the editor's, a copy of the text without editing traces", () => {
    const style = document.createElement('style');
    style.dataset.test = '';
    style.textContent = '.marker-rule { color: red; }';
    document.head.append(style);
    const e = mount(
      {
        contentStyle: 'p { color: navy; }',
        pluginOptions: { pagelayout: { size: 'A6', margins: { top: 8, bottom: 12 } } },
      },
      '<p>Text</p>',
    );
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const doc = iframe.contentDocument!;
    buildPrintDocument(e, doc);
    const css = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    expect(css).toContain('.marker-rule');
    expect(css).toContain('size: 105mm 148mm; margin: 8mm 20mm 12mm 20mm;');
    expect(doc.documentElement.dataset.theme).toBe('light');
    const root = doc.querySelector('.nova-print')!;
    // The classes of the content style scopes (contentStyle) are the same as the editor's.
    expect([...e.root.classList].every((name) => root.classList.contains(name))).toBe(true);
    const content = root.querySelector('.nova-content > .nova-prosemirror')!;
    expect(content.hasAttribute('contenteditable')).toBe(false);
    expect(content.textContent).toBe('Text');
  });

  it('without page mode: 20 mm margins, the sheet size as in the browser', () => {
    expect(printCss(undefined)).toContain('@page { margin: 20mm; }');
    expect(printCss(undefined)).toContain('orphans: 1; widows: 1;');
  });
});
