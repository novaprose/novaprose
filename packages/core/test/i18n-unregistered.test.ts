import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../src';

/**
 * Язык без подключённого пакета: интерфейс на английском (целиком, без смеси с плагинами) и одно
 * понятное предупреждение в консоли с подсказкой, как подключить пакет. Отдельный файл — чистое
 * состояние: здесь никто не вызывал registerLanguage.
 */
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('язык не подключён', () => {
  it('английский интерфейс и подсказка в консоли (один раз)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 2; i++) {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const editor = createEditor({
        element,
        language: 'ru',
        plugins: ['anchor'],
        toolbar: 'bold anchor',
      });
      await editor.ready;
      expect(element.querySelector('[data-control="bold"]')?.getAttribute('aria-label')).toBe(
        'Bold',
      );
      // Плагин тоже по-английски — без смеси языков.
      expect(element.querySelector('[data-control="anchor"]')?.getAttribute('aria-label')).toBe(
        'Anchor',
      );
      editor.destroy();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('@novaprose/core/i18n/ru');
  });

  it('английский — без предупреждения', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const element = document.createElement('div');
    createEditor({ element, language: 'en-GB' }).destroy();
    expect(warn).not.toHaveBeenCalled();
  });
});
