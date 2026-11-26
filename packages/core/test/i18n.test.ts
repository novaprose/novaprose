import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditor,
  en,
  hasLanguage,
  loadLanguage,
  registerLanguage,
  type Editor,
  type LanguagePack,
} from '../src';
import { getPluginMessages } from '../src/i18n';
import ruPack from '../src/i18n/packs/ru';

// Русский — пакет (не встроен в ядро): подключаем, как это делает клиент.
registerLanguage('ru', ruPack);

/**
 * Единая система переводов: строки ядра и плагинов переводятся одинаково — через registerLanguage
 * и опцию `translations`. Плюс проверка полноты: ни в одном встроенном языке не пропущена строка.
 */

// Все модули плагинов с подписями: проверка полноты не зависит от того, какие плагины загружены.
type Labels = Record<string, Record<string, unknown>>;
const PLUGIN_DIR = join(__dirname, '../src/plugins');
const PLUGIN_MODULES: [string, { LABELS?: Labels }][] = await Promise.all(
  readdirSync(PLUGIN_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map(
      async (f) =>
        [f, (await import(join(PLUGIN_DIR, f))) as { LABELS?: Labels }] as [
          string,
          { LABELS?: Labels },
        ],
    ),
);

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

async function mount(options: Partial<Parameters<typeof createEditor>[0]> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, plugins: ['anchor', 'charmap'], ...options });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const tooltip = (e: Editor, control: string) =>
  e.root.querySelector(`[data-control="${control}"]`)?.getAttribute('aria-label');

describe('переводы плагинов через общую систему', () => {
  it('русский пакет переводит и ядро, и плагины', async () => {
    const e = await mount({ language: 'ru', toolbar: 'bold anchor charmap' });
    expect(tooltip(e, 'bold')).toBe('Жирный');
    expect(tooltip(e, 'anchor')).toBe('Якорь');
    expect(e.ui.t('charmap.groups.0')).not.toBe('charmap.groups.0');
  });

  it('свой язык (registerLanguage) переводит и строки плагинов', async () => {
    registerLanguage('de', { bold: 'Fett', 'anchor.title': 'Anker', 'charmap.groups.0': 'Häufig' });
    const e = await mount({ language: 'de-AT', toolbar: 'bold anchor charmap' });
    expect(tooltip(e, 'bold')).toBe('Fett');
    expect(tooltip(e, 'anchor')).toBe('Anker');
    expect(e.ui.t('charmap.groups.0')).toBe('Häufig');
    // Чего нет в пакете — по-английски, а не ключ.
    expect(tooltip(e, 'charmap')).toBe('Special character');
  });

  it('опция translations точечно меняет строку плагина', async () => {
    const e = await mount({
      language: 'ru',
      toolbar: 'anchor',
      translations: { 'anchor.title': 'Закладка' },
    });
    expect(tooltip(e, 'anchor')).toBe('Закладка');
  });

  it('неизвестный ключ возвращается как есть (видно, что перевода нет)', async () => {
    const e = await mount();
    expect(e.ui.t('nosuch.key')).toBe('nosuch.key');
  });
});

describe('полнота встроенных переводов', () => {
  const plugins = PLUGIN_MODULES.filter(([, mod]) => mod.LABELS).map(
    ([file, mod]) => [file.replace('.ts', ''), mod.LABELS!] as const,
  );

  it('все плагины с подписями найдены', () => {
    expect(plugins.length).toBeGreaterThanOrEqual(16);
  });

  it.each(plugins)('плагин %s: в каждом языке те же ключи, что в en', (_name, labels) => {
    const shape = (pack: Record<string, unknown>) =>
      Object.entries(pack)
        .map(([k, v]) => (Array.isArray(v) ? `${k}[${v.length}]` : k))
        .sort();
    for (const [lang, pack] of Object.entries(labels)) {
      expect(shape(pack), `язык ${lang}`).toEqual(shape(labels.en!));
    }
  });

  it('у плагинов нет встроенных переводов — только en (остальное в пакетах)', () => {
    for (const [name, labels] of plugins) expect(Object.keys(labels), name).toEqual(['en']);
  });

  it('зарегистрированные плагины видны для шаблона переводчиков', async () => {
    await mount({ toolbar: 'anchor charmap' });
    const messages = getPluginMessages();
    expect(messages.anchor?.en?.title).toBe('Anchor');
    expect(messages.charmap?.en?.['groups.0']).toBeTruthy();
  });
});

describe('языковые пакеты @novaprose/core/i18n/*', () => {
  const PACK_DIR = join(__dirname, '../src/i18n/packs');
  const codes = readdirSync(PACK_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace('.ts', ''));

  it('пакеты есть', () => {
    expect(codes.length).toBeGreaterThanOrEqual(5);
  });

  it.each(codes)('%s: подключается и переводит ядро и плагины', async (code) => {
    const pack = ((await import(join(PACK_DIR, `${code}.ts`))) as { default: LanguagePack })
      .default;
    registerLanguage(code, pack);
    const e = await mount({ language: code, toolbar: 'bold anchor charmap' });
    expect(tooltip(e, 'bold')).toBe(pack.bold);
    expect(tooltip(e, 'anchor')).toBe(pack['anchor.title']);
    expect(tooltip(e, 'charmap')).toBe(pack['charmap.title']);
    // Перевод отличается от английского — пакет не пустышка.
    expect(pack.bold).not.toBe(en.bold);
  });
});

describe('языки по требованию: registerLanguage(code, загрузчик) + loadLanguage', () => {
  it('загрузчик вызывается один раз; после загрузки язык готов для редактора', async () => {
    const loader = vi.fn(async () => ({ default: { bold: 'Fett (qa)' } as LanguagePack }));
    registerLanguage('qa', loader);
    expect(hasLanguage('qa')).toBe(false);
    const [a, b] = await Promise.all([loadLanguage('qa'), loadLanguage('QA')]);
    expect([a, b]).toEqual([true, true]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(hasLanguage('qa')).toBe(true);
    expect(await loadLanguage('qa-BE')).toBe(true); // базовый язык
    const e = await mount({ language: 'qa', toolbar: 'bold' });
    expect(tooltip(e, 'bold')).toBe('Fett (qa)');
  });

  it('пакет можно вернуть и без default; неизвестный язык — false; английский готов всегда', async () => {
    registerLanguage('qb', async () => ({ italic: 'Kursiv (qb)' }));
    expect(await loadLanguage('qb')).toBe(true);
    expect(await loadLanguage('zz-unknown')).toBe(false);
    expect(await loadLanguage('en-US')).toBe(true);
    expect(hasLanguage('en')).toBe(true);
  });

  it('ошибка загрузки не запоминается: следующий вызов пробует снова', async () => {
    let attempt = 0;
    registerLanguage('qc', async () => {
      attempt++;
      if (attempt === 1) throw new Error('network');
      return { bold: 'B (qc)' };
    });
    await expect(loadLanguage('qc')).rejects.toThrow('network');
    expect(await loadLanguage('qc')).toBe(true);
    expect(attempt).toBe(2);
  });

  it('загруженный пакет не затирает строки, зарегистрированные раньше', async () => {
    registerLanguage('qd', { bold: 'Своя (qd)' });
    registerLanguage('qd', async () => ({ bold: 'Из пакета (qd)', italic: 'Курсив (qd)' }));
    expect(await loadLanguage('qd')).toBe(true);
    const e = await mount({ language: 'qd', toolbar: 'bold italic' });
    expect(tooltip(e, 'bold')).toBe('Своя (qd)');
    expect(tooltip(e, 'italic')).toBe('Курсив (qd)');
  });

  it('редактор до загрузки — английский и подсказка: await loadLanguage', async () => {
    registerLanguage('qe', async () => ({ bold: 'B (qe)' }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = await mount({ language: 'qe', toolbar: 'bold' });
    expect(tooltip(e, 'bold')).toBe(en.bold);
    expect(warn.mock.calls.flat().join(' ')).toContain("await loadLanguage('qe')");
    warn.mockRestore();
  });

  it('CDN-сборки подключают загрузчиком каждый пакет из i18n/packs', () => {
    const codes = readdirSync(join(__dirname, '../src/i18n/packs')).map((f) =>
      f.replace('.ts', ''),
    );
    for (const entry of ['../../web-component/src/cdn.ts', '../../tinymce-compat/src/cdn.ts']) {
      const source = readFileSync(join(__dirname, entry), 'utf8');
      for (const code of codes)
        expect(source).toContain(
          `registerLanguage('${code}', () => import('@novaprose/core/i18n/${code}'));`,
        );
    }
  });
});
