import { readdirSync } from 'node:fs';
import { defineConfig } from 'tsup';
// @ts-expect-error: a repository script in JS without types
import { rawCss } from '../../scripts/esbuild-raw-css.mjs';

/**
 * The core + language packs as separate entry points: `@novaprose/core/i18n/de`.
 * A pack is only data (the type from the core is erased), so each customer downloads only their language,
 * and the first load of the core doesn't grow with the number of languages.
 */
const packs = Object.fromEntries(
  readdirSync('src/i18n/packs')
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [`i18n/${f.replace('.ts', '')}`, `src/i18n/packs/${f}`]),
);

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    markdown: 'src/markdown.ts',
    // Word (.docx): export and import without third-party libraries, works on the server too.
    docx: 'src/docx/index.ts',
    // Element and attribute rules (extendedValidElements…): ~3 KB, needed by few.
    'html-rules': 'src/html-rules.ts',
    // Accessibility checks of a document (the a11ychecker plugin's rules): on a server too.
    a11y: 'src/a11y.ts',
    // Email HTML: content styles put inline, markup email clients understand (a browser or jsdom).
    email: 'src/email.ts',
    // Upload adapters for cloud storage (S3, Google Cloud Storage, Azure, Cloudinary, Uploadcare).
    upload: 'src/upload.ts',
    ...packs,
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  esbuildPlugins: [rawCss],
});
