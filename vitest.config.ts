import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Windows: when tests start from a folder with a lowercase "c:" (Git Bash and the like), Node loads
// some modules as "c:\…" and some as "C:\…". Those are different URLs, so React, Angular and ProseMirror
// end up in two copies (false failures: useRef of null, instanceof NodeType, plugin keys).
// The root and the working folder are normalized to the real case, so there is one copy, as in a browser.
const root = realpathSync.native(fileURLToPath(new URL('.', import.meta.url)));
if (process.cwd() !== root && process.cwd().toLowerCase() === root.toLowerCase())
  process.chdir(root);

export default defineConfig({
  root,
  resolve: {
    // Tests always run on the package sources, without building first.
    alias: {
      // Separate entries go before the shared core alias (otherwise it takes over the path).
      '@novaprose/core/html-rules': fileURLToPath(
        new URL('./packages/core/src/html-rules.ts', import.meta.url),
      ),
      '@novaprose/core/email': fileURLToPath(
        new URL('./packages/core/src/email.ts', import.meta.url),
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
      // index.ts and cdn.ts are entries of the packages and the CDN builds: they only re-export and
      // register, and the e2e and speed tests run them in a browser.
      exclude: [
        '**/*.d.ts',
        'packages/angular/**',
        'packages/*/src/**/index.ts',
        'packages/*/src/cdn.ts',
      ],
      reporter: ['text-summary', 'html', 'json-summary'],
      // A ratchet: slightly below the current level. Coverage can only grow: raise the thresholds
      // after it. Vitest 5 maps V8 coverage onto the syntax tree and counts every branch of ??, ||,
      // && and default values, so the same tests give lower statements and branches than Vitest 2
      // did (November 2026, the same code: Vitest 2 lines 91.5%, branches 85.6%, functions 83.4%;
      // Vitest 5 lines 88.9%, statements 85.9%, branches 76.8%, functions 83.5%).
      thresholds: { lines: 89.5, statements: 86.5, branches: 77.5, functions: 84.5 },
    },
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.tsx',
      'apps/sync-server/test/**/*.test.ts',
      'apps/site/test/**/*.test.ts',
    ],
  },
});
