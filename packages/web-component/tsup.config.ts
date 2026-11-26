import { defineConfig } from 'tsup';

/**
 * npm: ESM/CJS, the core is an external dependency. The CDN build (dist/novaprose.global.js + lazy parts
 * in dist/novaprose-chunks/) is scripts/build-cdn.mjs, the build step after tsup.
 */
export default defineConfig({
  entry: { index: 'src/index.ts', define: 'src/define.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: false,
  sourcemap: true,
  external: ['@novaprose/core'],
});
