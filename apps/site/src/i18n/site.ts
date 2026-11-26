/**
 * Copy of the product pages (home, pricing, cloud, privacy). The documentation lives in
 * src/content/docs. Plain words, concrete facts: every claim here can be checked in the repository.
 */

export const t = {
  meta: {
    title: 'NovaProse — open-source rich text editor with collaboration built in',
    description:
      'An embeddable WYSIWYG editor built on ProseMirror. Real-time collaboration, comments, suggested edits, version history, Word import and export and an AI assistant, all under the MIT license.',
  },
  nav: {
    features: 'Features',
    demo: 'Live demo',
    pricing: 'Pricing',
    docs: 'Docs',
    start: 'Get started',
    menu: 'Menu',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    skip: 'Skip to content',
  },
  hero: {
    eyebrow: 'Open source · MIT license',
    title: 'The rich text editor with collaboration built in',
    lead: 'Embed a fast, accessible editor in your web app. Co-editing, comments, suggested edits, version history, Word files and an AI assistant are part of the open-source package, not separate products.',
    primary: 'Get started',
    secondary: 'Open the live demo',
    install: 'npm install @novaprose/core',
    copy: 'Copy',
    copied: 'Copied',
    note: 'No account and no API key. Works with React, Vue, Angular and plain HTML.',
    editorLabel: 'This is the real editor. Try it.',
  },
  included: {
    title: 'Paid add-ons elsewhere. Included here.',
    lead: 'Collaboration, review and document features that editors usually sell as premium plugins ship in the MIT package. Run them on your own servers, change them, use them in commercial products.',
    items: [
      {
        icon: 'users',
        title: 'Real-time collaboration',
        text: 'Several people edit one document with live cursors and names. Undo reverts only your own changes. Built on Yjs, with a sync server you run yourself in Docker.',
      },
      {
        icon: 'message',
        title: 'Comments and mentions',
        text: 'Threads anchored to the text, replies, @mentions backed by your own user search, resolve and reopen. Stored in your database or synced with the document.',
      },
      {
        icon: 'pencil',
        title: 'Suggested edits',
        text: 'Suggesting mode turns typing into proposals that the author accepts or rejects one by one or all at once. They open in Word as tracked changes.',
      },
      {
        icon: 'history',
        title: 'Version history',
        text: 'Compare any two versions word by word and restore one. Restoring is a normal edit, so Ctrl+Z brings the text back.',
      },
      {
        icon: 'file',
        title: 'Word import and export',
        text: 'Open and save .docx in the browser or on your server, without a conversion service. Lists, tables, images, links and page setup come through.',
      },
      {
        icon: 'printer',
        title: 'Pages and printing',
        text: 'A4, Letter and custom sheets with margins in millimetres. The page breaks you see in the editor are the ones on paper.',
      },
      {
        icon: 'sparkles',
        title: 'AI assistant',
        text: 'Improve, shorten, fix or continue text with your own model behind your own server. Changes arrive as suggested edits, never as silent rewrites.',
      },
      {
        icon: 'paste',
        title: 'Paste from Office',
        text: 'Content from Word, Google Docs and Excel keeps its lists, tables and formatting and loses the hidden markup that comes with it.',
      },
      {
        icon: 'accessibility',
        title: 'Accessibility',
        text: 'Every control works from the keyboard and has a screen reader label. WCAG 2.1 AA checks run on every change, in light and dark themes.',
      },
    ],
  },
  developers: {
    title: 'Fits the code you already have',
    lead: 'One class, Editor, is the whole public API. The React, Vue and Angular packages and the web component are thin layers on top of it.',
    points: [
      'TypeScript types for every option, command and event',
      'Headless mode: build your own toolbar with React hooks or Vue composables',
      'Node views: draw a node with your own React or Vue component',
      'Server rendering: the same HTML from saved JSON in Node, without a DOM',
      'A tinymce.init() compatibility layer to move an existing setup over',
    ],
    cta: 'Read the quick start',
    codeLabel: 'Creating an editor',
  },
  collab: {
    title: 'See collaboration live',
    text: 'Open the demo in two windows, or send the link to a colleague, and type at the same time.',
    points: [
      'Cursors with names and colors',
      'Comments and @mentions in real time',
      'Version history with word-level differences',
      'Suggested edits to accept or reject',
    ],
    cta: 'Open the live demo',
  },
  quality: {
    title: 'Measured, not promised',
    lead: 'Measured on a developer laptop and checked in CI on every change. If one gets worse, the build fails.',
    items: [
      { value: '5 ms', label: 'per keystroke in a 100-page document' },
      { value: '139 KB', label: 'gzip first load, ProseMirror included' },
      { value: '860+', label: 'unit tests, plus ~600 browser test runs' },
      { value: 'WCAG 2.1 AA', label: 'automated checks in light and dark themes' },
    ],
    link: 'How NovaProse is tested',
  },
  integrations: {
    title: 'Works with your stack',
    items: ['React', 'Vue', 'Angular', 'Web Component', 'Plain HTML', 'CDN script'],
    note: 'Moving from another editor?',
    link: 'Read the migration guides',
  },
  pricing: {
    title: 'Pricing',
    lead: 'The editor is free and open source. Cloud will run the server side for teams that would rather not.',
    pageTitle: 'Pricing',
    pageLead:
      'The whole editor is free, forever. Cloud is in early access for teams that want collaboration hosted for them.',
    plans: [
      {
        id: 'oss',
        name: 'Open Source',
        price: 'Free',
        period: 'forever',
        text: 'The complete editor and every plugin, self-hosted.',
        features: [
          'All editing features and plugins',
          'Collaboration, comments, history, suggested edits',
          'Open-source sync server (Docker)',
          'React, Vue, Angular, web component',
          'MIT license: commercial use allowed',
        ],
        cta: 'Get started',
        href: '/getting-started/',
      },
      {
        id: 'cloud',
        name: 'Cloud',
        price: 'Early access',
        period: 'prices published before launch',
        text: 'The server side, hosted for you.',
        features: [
          'Hosted real-time sync server',
          'Document and version storage',
          'Image and file uploads',
          'PDF export as a service',
          'Hosting in the EU',
        ],
        cta: 'Join the waitlist',
        href: '/cloud/#waitlist',
        badge: 'Founding members get a discount',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Custom',
        period: 'contact us',
        text: 'For organizations with specific requirements.',
        features: [
          'Support with response times',
          'Help with on-premise installation',
          'Custom features and integrations',
          'Help with security reviews',
        ],
        cta: 'Contact us',
        href: 'mailto:hello@novaprose.com?subject=NovaProse%20Enterprise',
      },
    ],
    faqTitle: 'Questions',
    faqMore: 'Something not covered here? Write to',
    faq: [
      {
        q: 'Is the editor really free?',
        a: 'Yes. The editor, every plugin and the collaboration server are open source under the MIT license. Use them in commercial products without paying or asking.',
      },
      {
        q: 'Then why would I need Cloud?',
        a: 'Collaboration needs a server. You can run ours with Docker; Cloud is for teams that would rather not operate, scale and back it up.',
      },
      {
        q: 'How much will Cloud cost?',
        a: 'Prices will be published before Cloud opens. People on the waitlist hear first, and founding members get a discount.',
      },
      {
        q: 'Do I need an API key or an account?',
        a: 'No. Install the editor from npm or load it from a public CDN. There is no sign-up, no key and no usage limit.',
      },
      {
        q: 'Can I move my existing editor setup over?',
        a: 'Often, yes. A compatibility layer runs existing tinymce.init() configurations, so you can switch first and move to the native API later.',
      },
    ],
  },
  cloud: {
    title: 'NovaProse Cloud',
    eyebrow: 'Early access',
    lead: 'The server side of the editor, hosted in the EU and run for you.',
    whatTitle: 'What Cloud will include',
    items: [
      {
        icon: 'users',
        title: 'Hosted collaboration',
        text: 'Real-time sync, presence, comments and version history without running a server.',
      },
      {
        icon: 'database',
        title: 'Storage',
        text: 'Documents, versions, images and files, stored and backed up.',
      },
      {
        icon: 'file',
        title: 'Conversion',
        text: 'PDF export as a service, next to the Word import and export the editor already has.',
      },
      {
        icon: 'globe',
        title: 'Delivery',
        text: 'The editor from a CDN, with keys bound to your domains.',
      },
    ],
    todayText:
      'You don’t have to wait for Cloud: install the editor from npm and run the open-source sync server with Docker.',
    todayLink: 'Self-host collaboration',
  },
  waitlist: {
    title: 'Join the waitlist',
    text: 'Be among the first to try Cloud. Founding members get a discount at launch.',
    email: 'Work email',
    role: 'Your role',
    roles: {
      developer: 'Developer',
      product: 'Product or design',
      founder: 'Founder or CTO',
      other: 'Other',
    },
    team: 'Team size',
    consent: 'I agree to receive emails about NovaProse Cloud and accept the',
    privacy: 'privacy policy',
    submit: 'Join the waitlist',
    sending: 'Sending…',
    success: 'You’re on the list. We’ll email you when early access opens.',
    errorEmail: 'Enter a valid email address.',
    errorConsent: 'Accept the privacy policy to join.',
    errorRate: 'Too many attempts. Try again in an hour.',
    errorNetwork: 'Something went wrong. Try again, or write to hello@novaprose.com.',
    required: 'required',
  },
  cta: {
    title: 'Add an editor to your app today',
    text: 'Install from npm or add one script tag. No account needed.',
    primary: 'Read the quick start',
    secondary: 'Star on GitHub',
  },
  footer: {
    tagline: 'Open-source rich text editor with collaboration built in.',
    product: 'Product',
    resources: 'Resources',
    project: 'Project',
    changelog: 'Changelog',
    migrate: 'Migration guides',
    testing: 'How it’s tested',
    security: 'Security',
    privacy: 'Privacy',
    contact: 'Contact',
    rights: 'An independent open-source project.',
  },
  privacy: {
    title: 'Privacy policy',
    updated: 'Last updated: 26 November 2026',
  },
};

export type Copy = typeof t;
