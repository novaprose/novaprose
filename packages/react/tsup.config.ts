import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', '@novaprose/core'],
  // Next.js App Router: the component and hooks work only on the client. esbuild strips module
  // directives when bundling, so the directive is added as a banner to every output file.
  banner: { js: "'use client';" },
});
