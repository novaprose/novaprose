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
import frPack from '../src/i18n/packs/fr';

// A language pack (not built into the core): registered the way a customer does it.
registerLanguage('fr', frPack);

/**
 * One translation system: core and plugin strings are translated the same way, through registerLanguage
 * and the `translations` option. Plus a completeness check: no built-in language misses a string.
 */

// Every plugin module with labels: the completeness check doesn't depend on which plugins are loaded.
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

describe('plugin translations through the shared system', () => {
  it('a language pack translates both the core and the plugins', async () => {
    const e = await mount({ language: 'fr', toolbar: 'bold anchor charmap' });
    expect(tooltip(e, 'bold')).toBe('Gras');
    expect(tooltip(e, 'anchor')).toBe('Ancre');
    expect(e.ui.t('charmap.groups.0')).not.toBe('charmap.groups.0');
  });

  it('a custom language (registerLanguage) translates plugin strings too', async () => {
    registerLanguage('de', { bold: 'Fett', 'anchor.title': 'Anker', 'charmap.groups.0': 'Häufig' });
    const e = await mount({ language: 'de-AT', toolbar: 'bold anchor charmap' });
    expect(tooltip(e, 'bold')).toBe('Fett');
    expect(tooltip(e, 'anchor')).toBe('Anker');
    expect(e.ui.t('charmap.groups.0')).toBe('Häufig');
    // What the pack lacks is in English, not the key.
    expect(tooltip(e, 'charmap')).toBe('Special character');
  });

  it('the translations option replaces a plugin string', async () => {
    const e = await mount({
      language: 'fr',
      toolbar: 'anchor',
      translations: { 'anchor.title': 'Bookmark' },
    });
    expect(tooltip(e, 'anchor')).toBe('Bookmark');
  });

  it('an unknown key comes back as is (so a missing translation shows)', async () => {
    const e = await mount();
    expect(e.ui.t('nosuch.key')).toBe('nosuch.key');
  });
});

describe('completeness of the built-in translations', () => {
  const plugins = PLUGIN_MODULES.filter(([, mod]) => mod.LABELS).map(
    ([file, mod]) => [file.replace('.ts', ''), mod.LABELS!] as const,
  );

  it('every plugin with labels is found', () => {
    expect(plugins.length).toBeGreaterThanOrEqual(16);
  });

  it.each(plugins)('plugin %s: every language has the same keys as en', (_name, labels) => {
    const shape = (pack: Record<string, unknown>) =>
      Object.entries(pack)
        .map(([k, v]) => (Array.isArray(v) ? `${k}[${v.length}]` : k))
        .sort();
    for (const [lang, pack] of Object.entries(labels)) {
      expect(shape(pack), `language ${lang}`).toEqual(shape(labels.en!));
    }
  });

  it('plugins have no built-in translations, only en (the rest is in the packs)', () => {
    for (const [name, labels] of plugins) expect(Object.keys(labels), name).toEqual(['en']);
  });

  it('registered plugins are visible to the translators’ template', async () => {
    await mount({ toolbar: 'anchor charmap' });
    const messages = getPluginMessages();
    expect(messages.anchor?.en?.title).toBe('Anchor');
    expect(messages.charmap?.en?.['groups.0']).toBeTruthy();
  });
});

describe('language packs @novaprose/core/i18n/*', () => {
  const PACK_DIR = join(__dirname, '../src/i18n/packs');
  const codes = readdirSync(PACK_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace('.ts', ''));

  it('the packs exist', () => {
    expect(codes.length).toBeGreaterThanOrEqual(5);
  });

  it.each(codes)('%s: attaches and translates the core and plugins', async (code) => {
    const pack = ((await import(join(PACK_DIR, `${code}.ts`))) as { default: LanguagePack })
      .default;
    registerLanguage(code, pack);
    const e = await mount({ language: code, toolbar: 'bold anchor charmap' });
    expect(tooltip(e, 'bold')).toBe(pack.bold);
    expect(tooltip(e, 'anchor')).toBe(pack['anchor.title']);
    expect(tooltip(e, 'charmap')).toBe(pack['charmap.title']);
    // The translation differs from English: the pack isn't a dummy.
    expect(pack.bold).not.toBe(en.bold);
  });
});

describe('languages on demand: registerLanguage(code, loader) + loadLanguage', () => {
  it('the loader is called once; after loading the language is ready for an editor', async () => {
    const loader = vi.fn(async () => ({ default: { bold: 'Fett (qa)' } as LanguagePack }));
    registerLanguage('qa', loader);
    expect(hasLanguage('qa')).toBe(false);
    const [a, b] = await Promise.all([loadLanguage('qa'), loadLanguage('QA')]);
    expect([a, b]).toEqual([true, true]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(hasLanguage('qa')).toBe(true);
    expect(await loadLanguage('qa-BE')).toBe(true); // the base language
    const e = await mount({ language: 'qa', toolbar: 'bold' });
    expect(tooltip(e, 'bold')).toBe('Fett (qa)');
  });

  it('a pack can be returned without default; an unknown language gives false; English is always ready', async () => {
    registerLanguage('qb', async () => ({ italic: 'Kursiv (qb)' }));
    expect(await loadLanguage('qb')).toBe(true);
    expect(await loadLanguage('zz-unknown')).toBe(false);
    expect(await loadLanguage('en-US')).toBe(true);
    expect(hasLanguage('en')).toBe(true);
  });

  it("a load error isn't remembered: the next call tries again", async () => {
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

  it("a loaded pack doesn't overwrite strings registered earlier", async () => {
    registerLanguage('qd', { bold: 'Custom (qd)' });
    registerLanguage('qd', async () => ({ bold: 'From the pack (qd)', italic: 'Italic (qd)' }));
    expect(await loadLanguage('qd')).toBe(true);
    const e = await mount({ language: 'qd', toolbar: 'bold italic' });
    expect(tooltip(e, 'bold')).toBe('Custom (qd)');
    expect(tooltip(e, 'italic')).toBe('Italic (qd)');
  });

  it('an editor before loading: English and a hint, await loadLanguage', async () => {
    registerLanguage('qe', async () => ({ bold: 'B (qe)' }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = await mount({ language: 'qe', toolbar: 'bold' });
    expect(tooltip(e, 'bold')).toBe(en.bold);
    expect(warn.mock.calls.flat().join(' ')).toContain("await loadLanguage('qe')");
    warn.mockRestore();
  });

  it('the CDN builds register every pack in i18n/packs as a loader', () => {
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
