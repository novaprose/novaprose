import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEditor } from '../src';

/**
 * Очистка вставки из Office — ленивый чанк (не входит в первую загрузку ядра).
 * Отдельный файл = свежий модуль: чанк здесь ещё не загружен. Проверяем, что Ctrl+V в первые
 * миллисекунды после создания редактора не теряет ни вставку, ни очистку.
 */
const FIXTURES = join(__dirname, 'fixtures', 'paste');
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

function pasteEvent(target: HTMLElement, data: Record<string, string>): ClipboardEvent {
  const clipboardData = {
    getData: (type: string) => data[type] ?? '',
    types: Object.keys(data),
    files: [] as File[],
    items: [],
  };
  const event = new ClipboardEvent('paste', {
    clipboardData: clipboardData as unknown as DataTransfer,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe('вставка до загрузки очистки Office', () => {
  it('Ctrl+V сразу после создания: вставка ждёт чанк и выходит очищенной', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({ element, content: '' });

    const event = pasteEvent(editor.view.dom, {
      'text/html': read('word-desktop-lists.html'),
      'text/plain': 'x',
    });
    // Браузерную вставку мы перехватили, пока чанк грузится.
    expect(event.defaultPrevented).toBe(true);

    await editor.ready;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editor.getHTML()).toBe(read('word-desktop-lists.expected.html').trim());
    editor.destroy();
  });

  it('после загрузки вставка идёт обычным путём, без перехвата', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({ element, content: '' });
    await editor.ready;
    const event = pasteEvent(editor.view.dom, { 'text/html': '<p>a</p>', 'text/plain': 'a' });
    // Обработал сам ProseMirror (его handler тоже вызывает preventDefault) — результат сразу.
    expect(editor.getHTML()).toBe('<p>a</p>');
    expect(event.defaultPrevented).toBe(true);
    editor.destroy();
  });
});
