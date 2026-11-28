// The documentation site's own accessibility (Section 508 602.3, EN 301 549 12.1.2): every page of
// the built site (apps/site/dist) is checked with axe (WCAG 2.1 A and AA) in the light and dark
// themes, and the main pages also on a phone-sized screen. Run after `pnpm --filter @novaprose/site
// build`: node scripts/site-a11y.mjs. Exits with 1 on any violation.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const dist = join(import.meta.dirname, '..', 'apps', 'site', 'dist');
if (!existsSync(dist)) {
  console.error('No apps/site/dist: build the site first (pnpm --filter @novaprose/site build).');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
};

/** A static server for the built site: a directory answers with its index.html. */
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(dist, path);
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

function pagesIn(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...pagesIn(full));
    else if (name === 'index.html') {
      const rel = relative(dist, dir).split(sep).join('/');
      found.push(rel ? `/${rel}/` : '/');
    }
  }
  return found;
}

const pages = pagesIn(dist).sort();
// Pages people land on, checked on a phone as well.
const MAIN = [
  '/',
  '/getting-started/',
  '/pricing/',
  '/demo/collaboration/',
  '/project/accessibility/',
];

const browser = await chromium.launch();
let violations = 0;
async function audit(path, theme, width) {
  // axe needs a page of its own context.
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: 'load' });
  await page.evaluate((t) => {
    // The site's theme switch writes data-theme; the color scheme alone is the default.
    globalThis.document.documentElement.dataset.theme = t;
  }, theme);
  // Animations that fade content in are measured when they end.
  await page.waitForFunction(() =>
    globalThis.document
      .getAnimations()
      .every(
        (a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  for (const v of result.violations) {
    violations++;
    const where = v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(' '))
      .join(' | ');
    console.log(`✗ ${path} (${theme}, ${width}px): ${v.id} — ${v.help} — ${where}`);
  }
  await context.close();
}

for (const path of pages) for (const theme of ['light', 'dark']) await audit(path, theme, 1280);
for (const path of MAIN.filter((p) => pages.includes(p))) await audit(path, 'light', 390);

await browser.close();
server.close();
const runs = pages.length * 2 + MAIN.filter((p) => pages.includes(p)).length;
console.log(
  violations
    ? `${violations} violations in ${runs} checks of ${pages.length} pages`
    : `✓ ${pages.length} pages, ${runs} checks (light, dark, phone): no axe violations`,
);
process.exit(violations ? 1 : 0);
