import { readdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

/**
 * Ядро + языковые пакеты отдельными точками входа: `@novaprose/core/i18n/de`.
 * Пакет — только данные (тип из ядра стирается), поэтому каждый клиент скачивает лишь свой язык,
 * а первая загрузка ядра от числа языков не растёт.
 */
const packs = Object.fromEntries(
  readdirSync('src/i18n/packs')
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [`i18n/${f.replace('.ts', '')}`, `src/i18n/packs/${f}`]),
);

export default defineConfig({
  entry: { index: 'src/index.ts', markdown: 'src/markdown.ts', ...packs },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
