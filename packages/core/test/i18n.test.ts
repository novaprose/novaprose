import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, en, registerLanguage, type Editor, type LanguagePack } from '../src';
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
