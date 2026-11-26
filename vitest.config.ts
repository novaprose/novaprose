import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Windows: если тесты запущены из папки с «c:» в нижнем регистре (Git Bash и т.п.), Node грузит
// часть модулей как «c:\…», часть как «C:\…» — это разные URL, и React, Angular, ProseMirror
// оказываются в двух копиях (ложные падения: useRef of null, instanceof NodeType, ключи плагинов).
// Приводим корень и рабочую папку к настоящему регистру — тогда копия одна, как в браузере.
const root = realpathSync.native(fileURLToPath(new URL('.', import.meta.url)));
if (process.cwd() !== root && process.cwd().toLowerCase() === root.toLowerCase())
  process.chdir(root);

export default defineConfig({
  root,
  resolve: {
    // Тесты всегда идут по исходникам пакетов, без предварительной сборки.
    alias: {
      // Отдельные входы — до общего псевдонима ядра (иначе он перехватит путь).
      '@novaprose/core/html-rules': fileURLToPath(
        new URL('./packages/core/src/html-rules.ts', import.meta.url),
      ),
      '@novaprose/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/sync-server/src/**'],
      exclude: ['**/*.d.ts', 'packages/angular/**', 'packages/*/src/**/index.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      // «Храповик»: чуть ниже текущего уровня (ноябрь 2026: строки 90.6%, ветви 84.9%).
      // Покрытие может только расти — поднимайте пороги вслед за ним.
      thresholds: { lines: 89, statements: 89, branches: 83, functions: 80 },
    },
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.tsx',
      'apps/sync-server/test/**/*.test.ts',
    ],
  },
});
