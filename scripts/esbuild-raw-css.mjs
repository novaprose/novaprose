/**
 * esbuild plugin: `import css from './x.css?raw'` gives the CSS text (minified) as a string.
 * This way the styles of lazy parts (panels, dialogs) travel with their code instead of the first-load
 * style.css; editor.ui.addStyles attaches them. Vite/Vitest understand ?raw by themselves.
 *
 * The module path keeps the ?raw suffix: otherwise the bundler's CSS handlers (tsup has its own, by
 * the .css extension in any namespace) take the module, and the code gets an empty object instead of
 * the style text (that is what happened in the npm build until November 2026). Checked by
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
