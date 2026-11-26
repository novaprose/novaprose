import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { loadPasteCleaner } from '../src/paste';
import { cleanPastedHTML, detectPasteSource } from '../src/paste-office';

// Очистка Office — ленивый чанк; здесь проверяется её логика, а не момент загрузки
// (вставка до загрузки — в paste-lazy.test.ts).
beforeAll(() => loadPasteCleaner());

/**
 * Вставка из офисных приложений. Эталоны — test/fixtures/paste/*.html (буфер обмена приложения) и
 * *.expected.html (что должно получиться в getHTML). Новый пример из жизни: положить .html, запустить
 * тест, проверить вывод глазами и сохранить его как .expected.html.
 */

const FIXTURES = join(__dirname, 'fixtures', 'paste');
const editors: Editor[] = [];

function paste(html: string, options: Partial<Parameters<typeof createEditor>[0]> = {}): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content: '', ...options });
  editors.push(editor);
  editor.view.pasteHTML(html);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

describe('Эталоны вставки', () => {
  const fixtures = readdirSync(FIXTURES).filter(
    (f) => f.endsWith('.html') && !f.endsWith('.expected.html'),
  );

  it('набор эталонов не пуст и у каждого есть ожидаемый результат', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(7);
    for (const file of fixtures) {
      expect(readdirSync(FIXTURES)).toContain(file.replace('.html', '.expected.html'));
    }
  });

  it.each(fixtures)('%s', (file) => {
    const input = readFileSync(join(FIXTURES, file), 'utf8');
    const expected = readFileSync(join(FIXTURES, file.replace('.html', '.expected.html')), 'utf8');
    expect(paste(input).getHTML()).toBe(expected.trim());
  });
});

describe('Определение источника', () => {
  it.each([
    ['word-desktop-text.html', 'word'],
    ['word-desktop-lists.html', 'word'],
    ['word-online.html', 'word-online'],
    ['google-docs.html', 'google-docs'],
    ['excel.html', 'excel'],
    ['google-sheets.html', 'google-sheets'],
  ])('%s → %s', (file, source) => {
    expect(detectPasteSource(readFileSync(join(FIXTURES, file), 'utf8'))).toBe(source);
  });

  it('LibreOffice, веб-страница и копирование внутри редактора', () => {
    expect(detectPasteSource('<meta name="generator" content="LibreOffice 7.6"><p>a</p>')).toBe(
      'libreoffice',
    );
    expect(detectPasteSource('<p>plain</p>')).toBe('web');
    expect(detectPasteSource('<p data-pm-slice="1 1 []">a</p>')).toBe('nova');
  });
});

describe('Режимы и поведение', () => {
  it('копирование внутри редактора не чистится: шрифты и кегль сохраняются', () => {
    const html =
      '<p data-pm-slice="1 1 []"><span style="font-family: Georgia;">serif</span> <span style="font-size: 20px;">big</span></p>';
    expect(cleanPastedHTML(html)).toBe(html);
  });

  it("pasteStyles: 'clean' (по умолчанию) убирает шрифт и кегль веб-страницы, но не смысл", () => {
    const editor = paste(
      '<p style="font-family: Georgia; line-height: 2"><span style="font-size: 20px; color: #ff0000;">red</span> <b>bold</b></p>',
    );
    expect(editor.getHTML()).toBe(
      '<p><span style="color: #ff0000;">red</span> <strong>bold</strong></p>',
    );
  });

  it("pasteStyles: 'keep' переносит шрифт, кегль и интервал", () => {
    const editor = paste(
      '<p style="line-height: 2"><span style="font-family: Georgia; font-size: 20px;">serif</span></p>',
      { pasteStyles: 'keep' },
    );
    expect(editor.getHTML()).toBe(
      '<p style="line-height: 2;"><span style="font-family: Georgia;"><span style="font-size: 20px;">serif</span></span></p>',
    );
  });

  it('pastePreprocess видит исходный HTML, pastePostprocess — уже очищенный', () => {
    const seen: string[] = [];
    paste('<meta name=Generator content="Microsoft Word 15"><p class=MsoNormal>a<o:p></o:p></p>', {
      pastePreprocess: (html) => (seen.push(html.includes('o:p') ? 'raw' : 'clean'), html),
      pastePostprocess: (root) => void seen.push(root.innerHTML.includes('o:p') ? 'raw' : 'clean'),
    });
    expect(seen).toEqual(['raw', 'clean']);
  });

  it('вставка в пустой абзац сохраняет оформление первого абзаца, в непустой — продолжает его', () => {
    const html = '<p style="text-align: center">a</p><p>b</p>';
    expect(paste(html).getHTML()).toBe('<p style="text-align: center;">a</p><p>b</p>');

    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({ element, content: '<p>xy</p>' });
    editors.push(editor);
    editor.view.pasteHTML(html);
    // Курсор в начале «xy»: первый абзац сливается с текущим, как в Word.
    expect(editor.getHTML()).toBe('<p>a</p><p>bxy</p>');
  });

  it('опасное содержимое из Word по-прежнему отбрасывается', () => {
    const editor = paste(
      '<meta name=Generator content="Microsoft Word 15"><p class=MsoNormal onclick="alert(1)">a <a href="javascript:alert(1)">x</a><img src="file:///C:/Users/a/img.png"></p><script>alert(1)</script>',
    );
    expect(editor.getHTML()).toBe('<p>a x</p>');
  });
});
