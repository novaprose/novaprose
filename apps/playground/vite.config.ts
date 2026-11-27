import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Code highlighting grammars load through import() from the codesample plugin. Without dependencies
 * prepared in advance, Vite discovers them at the first code block and reloads every open page,
 * and e2e tests running in parallel lost their page midway. The list comes from the plugin itself.
 */
const grammars = [
  ...readFileSync(
    new URL('../../packages/core/src/plugins/code-languages.ts', import.meta.url),
    'utf8',
  ).matchAll(/'(highlight\.js\/lib\/languages\/[\w-]+)'/g),
].map((match) => `@novaprose/core > ${match[1]}`);

export default defineConfig({
  optimizeDeps: {
    include: [
      '@novaprose/core > highlight.js/lib/core',
      '@novaprose/core > temml',
      '@novaprose/core > markdown-it',
      ...grammars,
    ],
  },
  resolve: {
    // The playground works directly with the core sources: changes show up at once, without a build.
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
      // Language packs go before the shared core alias (otherwise it takes over the path).
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
        shadow: fileURLToPath(new URL('./shadow.html', import.meta.url)),
        pages: fileURLToPath(new URL('./pages.html', import.meta.url)),
      },
    },
  },
});
