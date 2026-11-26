import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from '../src';

/**
 * A language without an attached pack: the interface is in English (entirely, without a mix with plugins) with one
 * clear warning in the console that hints how to attach the pack. A separate file means a clean
 * state: nobody called registerLanguage here.
 */
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('the language is not attached', () => {
  it('an English interface and a hint in the console (once)', async () => {
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
      // The plugin is in English too: no mix of languages.
      expect(element.querySelector('[data-control="anchor"]')?.getAttribute('aria-label')).toBe(
        'Anchor',
      );
      editor.destroy();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('@novaprose/core/i18n/ru');
  });

  it('English gives no warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const element = document.createElement('div');
    createEditor({ element, language: 'en-GB' }).destroy();
    expect(warn).not.toHaveBeenCalled();
  });
});
