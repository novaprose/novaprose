import { defineConfig } from 'tsup';
// @ts-expect-error: a repository script in JS without types
import { rawCss } from '../../scripts/esbuild-raw-css.mjs';

/**
 * npm: ESM/CJS, the core is an external dependency. The CDN drop-in for tinymce.min.js (dist/tinymce.global.js +
 * lazy parts in dist/tinymce-chunks/, styles in dist/novaprose.css) is built by scripts/build-cdn.mjs.
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
