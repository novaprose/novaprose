import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, pageLayout, type Editor } from '../src';
import { resolvePageLayout } from '../src/plugins/pagelayout';
import { paginate, type Line } from '../src/plugins/pagelayout-ui';
import { buildPrintDocument, printCss } from '../src/ui/print';

/**
 * Режим страниц: настройки листа, раскладка строк по страницам (чистая функция — раскладку
 * в браузере проверяет e2e/pages.spec.ts, вместе с PDF), документ печати.
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

describe('лист', () => {
  it('размеры, ориентация, поля; мусор — умолчания', () => {
    expect(resolvePageLayout()).toEqual({
      size: 'A4',
      orientation: 'portrait',
      width: 210,
      height: 297,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
    });
    const a5 = resolvePageLayout({ size: 'A5', orientation: 'landscape', margins: { top: 10 } });
    expect([a5.width, a5.height, a5.orientation]).toEqual([210, 148, 'landscape']);
    expect(a5.margins).toEqual({ top: 10, right: 20, bottom: 20, left: 20 });
    // Свой размер: ориентация — как задан, или по явной настройке.
    expect(resolvePageLayout({ size: { width: 100, height: 50 } }).orientation).toBe('landscape');
    const portrait = resolvePageLayout({
      size: { width: 100, height: 50 },
      orientation: 'portrait',
    });
    expect([portrait.width, portrait.height]).toEqual([50, 100]);
    // Мусор: неизвестный размер — A4, поля не больше трети листа, не отрицательные.
    const junk = resolvePageLayout({
      size: 'B9' as never,
      margins: { top: -5, left: 500, right: 'x' as never },
    });
    expect(junk.size).toBe('A4');
    expect(junk.margins).toEqual({ top: 0, right: 20, bottom: 20, left: 70 });
    expect(resolvePageLayout({ size: { width: null, height: 'x' } as never }).width).toBe(210);
  });

  it('лист в CSS-переменных; pageLayout(editor).set() меняет его и сообщает', () => {
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

  it('без плагина — undefined', () => {
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({ element });
    expect(pageLayout(editor)).toBeUndefined();
  });
});

describe('раскладка по страницам', () => {
  const line = (top: number, bottom = top + 20): Line => ({ top, bottom });

  it('строка, не влезающая в страницу, начинает следующую; граница — между строками', () => {
    // Страница 100 px текста, строки по 20 px с шагом 25.
    const lines = Array.from({ length: 10 }, (_, i) => line(i * 25));
    expect(paginate(lines, 0, 100)).toEqual([
      { at: 100, mark: 97.5 },
      { at: 200, mark: 197.5 },
    ]);
  });

  it('текст и картинка в одной строке — одна строка; высокая картинка не делится', () => {
    const lines = [line(0), line(30, 50), { top: 28, bottom: 90 }, line(95)];
    // 28..90 и 30..50 — одна строка (до 90): влезает (90 ≤ 100); 95..115 — уже нет.
    expect(paginate(lines, 0, 100).map((b) => b.at)).toEqual([95]);
    // Блок выше страницы в начале страницы — не переносится бесконечно.
    expect(paginate([line(0, 250), line(260)], 0, 100).map((b) => b.at)).toEqual([260]);
  });

  it('разрыв страницы: следующий блок — с новой страницы, его верхнее поле сохраняется', () => {
    const lines = [line(0), { top: 30, bottom: 30, forced: true, offset: 10 }, line(45)];
    expect(paginate(lines, 0, 100)).toEqual([{ at: 35, mark: 30 }]);
    // Разрыв в самом начале страницы новой страницы не добавляет.
    expect(paginate([{ top: 0, bottom: 0, forced: true }, line(0)], 0, 100)).toEqual([]);
  });
});

describe('документ печати', () => {
  it('стили страницы, лист в @page, корень как у редактора, копия текста без следов правки', () => {
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
    // Классы областей стилей содержимого (contentStyle) — те же, что у редактора.
    expect([...e.root.classList].every((name) => root.classList.contains(name))).toBe(true);
    const content = root.querySelector('.nova-content > .nova-prosemirror')!;
    expect(content.hasAttribute('contenteditable')).toBe(false);
    expect(content.textContent).toBe('Text');
  });

  it('без режима страниц — поля 20 мм, размер листа — как в браузере', () => {
    expect(printCss(undefined)).toContain('@page { margin: 20mm; }');
    expect(printCss(undefined)).toContain('orphans: 1; widows: 1;');
  });
});
