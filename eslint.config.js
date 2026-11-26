import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.astro/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Скрипты репозитория и пример отрисовки на сервере выполняются в Node.
    files: [
      'scripts/**/*.mjs',
      'packages/*/scripts/**/*.mjs',
      'apps/*/scripts/**/*.mjs',
      'examples/server-render/**/*.js',
    ],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    // Сервер синхронизации — программа для Node.
    files: ['apps/sync-server/src/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        TextEncoder: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    // Редактор может жить в теневом корне: там document.activeElement — хост, а у слушателей на
    // document цель события подменена. Только через activeElement() / listenDocument() из ui/dom.ts.
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/ui/dom.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='document'][property.name='activeElement']",
          message: 'Shadow DOM: use activeElement(node) from ui/dom.ts.',
        },
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name='addEventListener']",
          message: 'Shadow DOM: use listenDocument(node, type, handler) from ui/dom.ts.',
        },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
