import { defineConfig } from 'tsup';

/**
 * npm: ESM/CJS, ядро — внешняя зависимость. CDN-сборка (dist/novaprose.global.js + ленивые части
 * в dist/novaprose-chunks/) — scripts/build-cdn.mjs, шаг build после tsup.
 */
export default defineConfig({
  entry: { index: 'src/index.ts', define: 'src/define.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: false,
  sourcemap: true,
  external: ['@novaprose/core'],
});
