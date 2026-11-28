import { definePlugin } from '../plugins';
import { cleanPage, type HeadElement, type PageData } from './fullpagehtml';
import { pickLabels } from './shared';

/** The lazy part of fullpagehtml: the Document properties dialog, its button and menu item. */

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>';

export const LABELS = {
  en: {
    title: 'Document properties',
    tabAbout: 'About the page',
    tabSearch: 'Language and search',
    pageTitle: 'Title',
    pageTitleHint: 'Shown on the browser tab and in search results.',
    description: 'Description',
    descriptionHint: 'Search engines may show it under the title.',
    keywords: 'Keywords',
    keywordsHint: 'Separated by commas.',
    author: 'Author',
    language: 'Language',
    languageHint: 'A language code, such as en or de-CH: screen readers use it.',
    languageInvalid: 'Enter a language code, such as en or pt-BR.',
    robots: 'Search engines',
    robotsAll: 'Show the page and follow its links',
    robotsNoFollow: 'Show the page, don’t follow its links',
    robotsNoIndex: 'Don’t show the page, follow its links',
    robotsNone: 'Don’t show the page or follow its links',
    encoding: 'Character encoding',
    encodingNone: 'Not declared',
  },
};

const LANG_RE = /^[a-z]{1,8}(?:-[a-z0-9]{1,8}){0,4}$/i;

type Head = HeadElement[];

const isMeta = (el: HeadElement, name: string) =>
  el.tag === 'meta' && el.attrs.name?.toLowerCase() === name;

/** The content of <meta name="…">. */
export function metaContent(page: PageData, name: string): string {
  const el = page.head?.find((item) => isMeta(item, name));
  return el && el.tag === 'meta' ? (el.attrs.content ?? '') : '';
}

/** The head with <meta name="…"> set to `content` (removed when empty), in its place or at the end. */
function withMeta(head: Head, name: string, content: string): Head {
  const at = head.findIndex((el) => isMeta(el, name));
  if (!content) return at < 0 ? head : head.filter((_, i) => i !== at);
  const el: HeadElement = { tag: 'meta', attrs: { name, content } };
  return at < 0 ? [...head, el] : head.map((old, i) => (i === at ? el : old));
}

const isCharset = (el: HeadElement) =>
  el.tag === 'meta' &&
  (!!el.attrs.charset || el.attrs['http-equiv']?.toLowerCase() === 'content-type');

export function charsetOf(page: PageData): string {
  const el = page.head?.find(isCharset);
  if (!el || el.tag !== 'meta') return '';
  return el.attrs.charset ?? /charset=([\w.:-]+)/i.exec(el.attrs.content ?? '')?.[1] ?? '';
}

function withCharset(head: Head, charset: string): Head {
  const rest = head.filter((el) => !isCharset(el));
  return charset ? [{ tag: 'meta', attrs: { charset } }, ...rest] : rest;
}

export function titleOf(page: PageData): string {
  const el = page.head?.find((item) => item.tag === 'title');
  return el?.tag === 'title' ? el.text : '';
}

/** The head with its title (removed when empty), in its place or after the character encoding. */
function withTitle(head: Head, text: string): Head {
  const at = head.findIndex((el) => el.tag === 'title');
  if (!text) return at < 0 ? head : head.filter((_, i) => i !== at);
  const el: HeadElement = { tag: 'title', text };
  if (at >= 0) return head.map((old, i) => (i === at ? el : old));
  const after = head.findIndex((item) => !isCharset(item));
  const index = after < 0 ? head.length : after;
  return [...head.slice(0, index), el, ...head.slice(index)];
}

/** noindex and nofollow from <meta name="robots">; its other words are kept. */
function robotsOf(page: PageData): { index: boolean; follow: boolean; other: string[] } {
  const words = metaContent(page, 'robots')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  const none = words.includes('none');
  return {
    index: !none && !words.includes('noindex'),
    follow: !none && !words.includes('nofollow'),
    other: words.filter(
      (w) => !['none', 'noindex', 'nofollow', 'index', 'follow', 'all'].includes(w),
    ),
  };
}

const ROBOTS = ['all', 'nofollow', 'noindex', 'none'] as const;

export default definePlugin({
  name: 'fullpagehtml-ui',
  requires: ['fullpagehtml'],
  setup(editor) {
    const labels = pickLabels(editor, 'fullpagehtml', LABELS);

    const open = async () => {
      const page = cleanPage(editor.view.state.doc.attrs.page);
      const robots = robotsOf(page);
      const charset = charsetOf(page);
      const data = await editor.ui.dialog({
        title: labels.title,
        initialData: {
          title: titleOf(page),
          description: metaContent(page, 'description'),
          keywords: metaContent(page, 'keywords'),
          author: metaContent(page, 'author'),
          lang: page.html?.lang ?? '',
          robots: robots.index
            ? robots.follow
              ? 'all'
              : 'nofollow'
            : robots.follow
              ? 'noindex'
              : 'none',
          encoding: charset,
        },
        // Two short tabs rather than one long form: the dialog fits a laptop's screen.
        tabs: [
          {
            title: labels.tabAbout,
            fields: [
              {
                type: 'text',
                name: 'title',
                label: labels.pageTitle,
                hint: labels.pageTitleHint,
              },
              {
                type: 'textarea',
                name: 'description',
                label: labels.description,
                hint: labels.descriptionHint,
                rows: 3,
              },
              {
                type: 'text',
                name: 'keywords',
                label: labels.keywords,
                hint: labels.keywordsHint,
              },
              { type: 'text', name: 'author', label: labels.author },
            ],
          },
          {
            title: labels.tabSearch,
            fields: [
              {
                type: 'text',
                name: 'lang',
                label: labels.language,
                hint: labels.languageHint,
                validate: (value) =>
                  typeof value === 'string' && value.trim() && !LANG_RE.test(value.trim())
                    ? labels.languageInvalid
                    : null,
              },
              {
                type: 'select',
                name: 'robots',
                label: labels.robots,
                options: [
                  { value: 'all', label: labels.robotsAll },
                  { value: 'nofollow', label: labels.robotsNoFollow },
                  { value: 'noindex', label: labels.robotsNoIndex },
                  { value: 'none', label: labels.robotsNone },
                ],
              },
              {
                type: 'select',
                name: 'encoding',
                label: labels.encoding,
                // The page's own encoding as it is written, and UTF-8.
                options: [
                  { value: '', label: labels.encodingNone },
                  ...(charset ? [{ value: charset, label: charset }] : []),
                  ...(charset.toUpperCase() !== 'UTF-8'
                    ? [{ value: 'UTF-8', label: 'UTF-8' }]
                    : []),
                ],
              },
            ],
          },
        ],
      });
      if (!data) return;
      const value = (name: string) =>
        typeof data[name] === 'string' ? (data[name] as string).replace(/\s+/g, ' ').trim() : '';
      let head: Head = page.head ?? [];
      // Unchanged, the page's own way of saying it stays.
      if (value('encoding') !== charset) head = withCharset(head, value('encoding'));
      head = withTitle(head, value('title'));
      head = withMeta(head, 'description', value('description'));
      head = withMeta(head, 'keywords', value('keywords'));
      head = withMeta(head, 'author', value('author'));
      const choice = ROBOTS.includes(data.robots as (typeof ROBOTS)[number])
        ? (data.robots as (typeof ROBOTS)[number])
        : 'all';
      const words = [
        ...(choice === 'noindex' || choice === 'none' ? ['noindex'] : []),
        ...(choice === 'nofollow' || choice === 'none' ? ['nofollow'] : []),
        ...robots.other,
      ];
      head = withMeta(head, 'robots', words.join(', '));
      const lang = value('lang');
      const html = { ...page.html };
      if (lang) html.lang = lang;
      else delete html.lang;
      const next = cleanPage({ ...page, html, head });
      if (JSON.stringify(next) !== JSON.stringify(cleanPage(editor.view.state.doc.attrs.page))) {
        editor.view.dispatch(editor.view.state.tr.setDocAttribute('page', next));
      }
      editor.focus();
    };

    editor.ui.registry.addButton('fullpagehtml', {
      icon: ICON,
      tooltip: labels.title,
      isEnabled: (e) => e.isEditable(),
      onAction: () => void open(),
    });
    editor.ui.registry.addMenuItem('fullpagehtml', {
      text: labels.title,
      icon: ICON,
      isEnabled: (e) => e.isEditable(),
      onAction: () => void open(),
    });
  },
});
