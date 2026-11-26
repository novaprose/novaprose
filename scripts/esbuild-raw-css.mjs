/**
 * esbuild-плагин: `import css from './x.css?raw'` — текст CSS (минифицированный) строкой.
 * Так стили ленивых частей (панели, диалоги) едут вместе с их кодом, а не в style.css первой
 * загрузки; подключает их editor.ui.addStyles. Vite/Vitest понимают ?raw сами.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

export const rawCss = {
  name: 'nova-raw-css',
  setup(build) {
    build.onResolve({ filter: /\.css\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'nova-raw-css',
    }));
    build.onLoad({ filter: /.*/, namespace: 'nova-raw-css' }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const { code } = await transform(source, { loader: 'css', minify: true });
      return { contents: code.trim(), loader: 'text', watchFiles: [args.path] };
    });
  },
};
