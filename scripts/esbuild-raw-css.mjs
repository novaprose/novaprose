/**
 * esbuild-плагин: `import css from './x.css?raw'` — текст CSS (минифицированный) строкой.
 * Так стили ленивых частей (панели, диалоги) едут вместе с их кодом, а не в style.css первой
 * загрузки; подключает их editor.ui.addStyles. Vite/Vitest понимают ?raw сами.
 *
 * Путь модуля сохраняет суффикс ?raw: иначе обработчики CSS сборщика (у tsup — свой, по
 * расширению .css в любом пространстве имён) забирают модуль себе — и вместо текста стилей в коде
 * оказывается пустой объект (так и было в npm-сборке до ноября 2026). Проверяет
 * scripts/check-packages.mjs.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

export const rawCss = {
  name: 'nova-raw-css',
  setup(build) {
    build.onResolve({ filter: /\.css\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path),
      namespace: 'nova-raw-css',
    }));
    build.onLoad({ filter: /.*/, namespace: 'nova-raw-css' }, async (args) => {
      const file = args.path.replace(/\?raw$/, '');
      const source = await readFile(file, 'utf8');
      const { code } = await transform(source, { loader: 'css', minify: true });
      return { contents: code.trim(), loader: 'text', watchFiles: [file] };
    });
  },
};
