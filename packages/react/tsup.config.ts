import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', '@novaprose/core'],
  // Next.js App Router: компонент и хуки работают только на клиенте. esbuild вырезает директивы
  // модулей при бандлинге, поэтому добавляем её баннером в каждый выходной файл.
  banner: { js: "'use client';" },
});
