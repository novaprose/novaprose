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
            { slug: 'guides/headless' },
            { slug: 'guides/images' },
            { slug: 'guides/pasting-from-office' },
            { slug: 'guides/markdown' },
            { slug: 'guides/server-rendering' },
            { slug: 'guides/code-blocks' },
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
          items: [{ slug: 'project/versioning' }, { slug: 'project/testing' }],
        },
        { label: 'Pricing', link: '/pricing/' },
        { label: 'NovaProse Cloud', link: '/cloud/' },
        { label: 'Changelog', slug: 'changelog' },
      ],
    }),
  ],
});
