import { copyFile, mkdir } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // npm: ESM/CJS, ядро — внешняя зависимость.
    entry: { index: 'src/index.ts', define: 'src/define.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    external: ['@novaprose/core'],
  },
  {
    // CDN: один файл со всем внутри, глобальный NovaProse; стили — рядом, novaprose.css.
    entry: { novaprose: 'src/cdn.ts' },
    format: ['iife'],
    globalName: 'NovaProse',
    platform: 'browser',
    minify: true,
    sourcemap: true,
    clean: false,
    noExternal: [/.*/],
    async onSuccess() {
      await mkdir('dist', { recursive: true });
      await copyFile('../core/src/style.css', 'dist/novaprose.css');
    },
  },
]);
