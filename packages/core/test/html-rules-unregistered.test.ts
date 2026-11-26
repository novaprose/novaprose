import { expect, it, vi } from 'vitest';
import { createEditor } from '../src';

/**
 * Правила элементов и атрибутов — отдельный импорт (@novaprose/core/html-rules). Без регистрации
 * редактор работает как раньше (атрибуты в [...] не применяются, новых элементов нет) и один раз
 * подсказывает в консоли, что подключить. Отдельный файл: регистрация глобальна для страницы.
 */
it('без registerHtmlRules — прежнее поведение и подсказка в консоли', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({
    element,
    extendedValidElements: 'h2[id],div[class]',
    content: '<h2 id="a">T</h2><div class="x">y</div>',
  });
  expect(editor.getHTML()).toBe('<h2>T</h2><p>y</p>');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("'@novaprose/core/html-rules'"));
  editor.destroy();
});

it('опции без атрибутов и новых элементов модуль не требуют', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, validElements: 'p,strong', content: '<h1>T</h1>' });
  expect(editor.getHTML()).toBe('<p>T</p>');
  expect(warn).not.toHaveBeenCalled();
  editor.destroy();
});
