import { defineConfig } from 'tsup';
// @ts-expect-error: a repository script in JS without types
import { rawCss } from '../../scripts/esbuild-raw-css.mjs';

const external = ['@novaprose/core', 'prosemirror-state', 'prosemirror-model'];

/**
 * npm: ESM/CJS, the core is an external dependency. The CDN drop-in for tinymce.min.js (dist/tinymce.global.js +
 * lazy parts in dist/tinymce-chunks/, styles in dist/novaprose.css) is built by scripts/build-cdn.mjs.
 * dist/migrate.js is the `npx @novaprose/tinymce-compat migrate` command (Node).
 */
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    esbuildPlugins: [rawCss],
    external,
  },
  {
    entry: { migrate: 'src/migrate/cli.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node18',
    dts: false,
    clean: false,
    sourcemap: false,
    banner: { js: '#!/usr/bin/env node' },
    esbuildPlugins: [rawCss],
    external,
  },
]);
