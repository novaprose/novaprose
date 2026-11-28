// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

// The novaprose.com website: product pages with a live demo plus the documentation (Starlight). Static, no server.
export default defineConfig({
  site: 'https://novaprose.com',
  integrations: [
    starlight({
      title: 'NovaProse',
      description:
        'Open-source rich text editor built on ProseMirror: MIT licensed, with real-time collaboration, comments and version history built in.',
      logo: {
        light: './src/assets/logo.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      // The social preview card (apps/site/public/og.png) for documentation links too.
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://novaprose.com/og.png' } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        // A theme switch fades the colors (np-theme-fade in site.css), as on the product pages. A
        // capture listener runs before the theme select's own, so the class is on before the switch.
        {
          tag: 'script',
          content: `document.addEventListener('change', (event) => {
  if (!event.target?.closest?.('starlight-theme-select')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.classList.add('np-theme-fade');
  clearTimeout(window.npThemeFade);
  window.npThemeFade = setTimeout(() => root.classList.remove('np-theme-fade'), 500);
}, true);`,
        },
        // Accessibility of the documentation (checked on every page by scripts/site-a11y.mjs): the
        // search button's name includes the shortcut it shows (WCAG 2.5.3), and code blocks, which
        // scroll sideways when lines are long, can be scrolled from the keyboard (WCAG 2.1.1).
        {
          tag: 'script',
          content: `addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => {
  const search = document.querySelector('button[data-open-modal]');
  if (search) {
    // Keys apart ("Ctrl K", not "CtrlK"), so the name can match what is shown.
    search.querySelectorAll('kbd').forEach((key) => {
      if (key.previousSibling && key.previousSibling.nodeType !== 3) key.before(' ');
    });
    const shown = [...search.querySelectorAll('span, kbd kbd')]
      .filter((el) => el.getClientRects().length)
      .map((el) => el.textContent.trim())
      .filter(Boolean);
    if (shown.length) search.setAttribute('aria-label', shown.join(' '));
  }
  for (const pre of document.querySelectorAll('pre:not([tabindex])'))
    if (!pre.closest('.nova-editor')) pre.tabIndex = 0;
}));`,
        },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/novaprose/novaprose' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/org/novaprose' },
        { icon: 'email', label: 'Contact', href: 'mailto:hello@novaprose.com' },
      ],
      customCss: ['@fontsource-variable/plus-jakarta-sans', './src/styles/site.css'],
      sidebar: [
        { label: 'Getting started', slug: 'getting-started' },
        { label: 'Live collaboration demo', slug: 'demo/collaboration' },
        { label: 'Migrate an existing editor', slug: 'migrate' },
        {
          label: 'Frameworks',
          items: [
            { slug: 'frameworks/react' },
            { slug: 'frameworks/vue' },
            { slug: 'frameworks/angular' },
            { slug: 'frameworks/web-component' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'guides/toolbar-and-menus' },
            { slug: 'guides/themes-and-icons' },
            { slug: 'guides/headless' },
            { slug: 'guides/images' },
            { slug: 'guides/embeds' },
            { slug: 'guides/tables' },
            { slug: 'guides/pasting-from-office' },
            { slug: 'guides/markdown' },
            { slug: 'guides/server-rendering' },
            { slug: 'guides/code-blocks' },
            { slug: 'guides/html-source' },
            { slug: 'guides/full-page' },
            { slug: 'guides/math' },
            { slug: 'guides/pages-and-printing' },
            { slug: 'guides/word' },
            { slug: 'guides/content-restrictions' },
            { slug: 'guides/collaboration' },
            { slug: 'guides/comments' },
            { slug: 'guides/mentions' },
            { slug: 'guides/merge-tags' },
            { slug: 'guides/version-history' },
            { slug: 'guides/suggested-edits' },
            { slug: 'guides/ai-assistant' },
            { slug: 'guides/spell-check' },
            { slug: 'guides/autocorrect' },
            { slug: 'guides/typography' },
            { slug: 'guides/accessibility-checker' },
            { slug: 'guides/link-checker' },
            { slug: 'guides/email' },
            { slug: 'guides/custom-buttons-and-plugins' },
            { slug: 'guides/node-views' },
            { slug: 'guides/shadow-dom' },
            { slug: 'guides/localization' },
            { slug: 'guides/security' },
            { slug: 'guides/migrating-from-tinymce' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { slug: 'reference/options' },
            { slug: 'reference/api' },
            { slug: 'reference/helpers' },
          ],
        },
        {
          label: 'Project',
          items: [
            { slug: 'project/versioning' },
            { slug: 'project/testing' },
            { slug: 'project/accessibility' },
            { slug: 'project/accessibility-report' },
          ],
        },
        { label: 'Pricing', link: '/pricing/' },
        { label: 'NovaProse Cloud', link: '/cloud/' },
        { label: 'Changelog', slug: 'changelog' },
      ],
    }),
  ],
});
