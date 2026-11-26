import { defineConfig } from 'tsup';
// @ts-expect-error — скрипт репозитория на JS без типов
import { rawCss } from '../../scripts/esbuild-raw-css.mjs';

/**
 * npm: ESM/CJS, ядро — внешняя зависимость. CDN-замена tinymce.min.js (dist/tinymce.global.js +
 * ленивые части в dist/tinymce-chunks/, стили — dist/novaprose.css) — scripts/build-cdn.mjs.
 */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: false,
  sourcemap: true,
  esbuildPlugins: [rawCss],
  external: ['@novaprose/core', 'prosemirror-state', 'prosemirror-model'],
});
