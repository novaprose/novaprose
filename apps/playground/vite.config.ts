import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // Playground работает напрямую с исходниками ядра — правки видны сразу, без сборки.
    alias: {
      '@novaprose/core/style.css': fileURLToPath(
        new URL('../../packages/core/src/style.css', import.meta.url),
      ),
      '@novaprose/web-component/define': fileURLToPath(
        new URL('../../packages/web-component/src/define.ts', import.meta.url),
      ),
      '@novaprose/web-component': fileURLToPath(
        new URL('../../packages/web-component/src/index.ts', import.meta.url),
      ),
      '@novaprose/angular': fileURLToPath(
        new URL('../../packages/angular/src/public-api.ts', import.meta.url),
      ),
      '@novaprose/vue': fileURLToPath(new URL('../../packages/vue/src/index.ts', import.meta.url)),
      '@novaprose/react': fileURLToPath(
        new URL('../../packages/react/src/index.ts', import.meta.url),
      ),
      '@novaprose/tinymce-compat': fileURLToPath(
        new URL('../../packages/tinymce-compat/src/index.ts', import.meta.url),
      ),
      '@novaprose/collab/style.css': fileURLToPath(
        new URL('../../packages/collab/src/style.css', import.meta.url),
      ),
      '@novaprose/collab': fileURLToPath(
        new URL('../../packages/collab/src/index.ts', import.meta.url),
      ),
      // Языковые пакеты — до общего псевдонима ядра (иначе он перехватит путь).
      '@novaprose/core/i18n': fileURLToPath(
        new URL('../../packages/core/src/i18n/packs', import.meta.url),
      ),
      '@novaprose/core/html-rules': fileURLToPath(
        new URL('../../packages/core/src/html-rules.ts', import.meta.url),
      ),
      '@novaprose/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
  server: { port: 5173, open: true },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        react: fileURLToPath(new URL('./react.html', import.meta.url)),
        vue: fileURLToPath(new URL('./vue.html', import.meta.url)),
        element: fileURLToPath(new URL('./element.html', import.meta.url)),
        angular: fileURLToPath(new URL('./angular.html', import.meta.url)),
        collab: fileURLToPath(new URL('./collab.html', import.meta.url)),
        tinymce: fileURLToPath(new URL('./tinymce.html', import.meta.url)),
      },
    },
  },
});
