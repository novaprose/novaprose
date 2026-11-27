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
        text: 'See what changed since any saved version, word by word, and restore it. Restoring is a normal edit, so Ctrl+Z brings the text back.',
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
    lead: 'Measured on a developer laptop. CI measures again on every change and fails the build when a number crosses its limit.',
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
      'NovaProse is open source. The whole editor is free, with no limits on users, documents or editor loads. You run it on your own servers.',
    included: {
      label: 'All of this is in the free package',
      items: [
        'Real-time collaboration',
        'Comments and mentions',
        'Suggested edits',
        'Version history',
        'Word import and export',
        'Pages and printing',
        'AI assistant with your model',
        'Paste from Office',
      ],
      note: 'No add-ons, no per-user fees, no limit on editor loads.',
    },
    plans: {
      title: 'Plans',
      // The two roads: you run the server side, or (later) we do.
      self: {
        id: 'oss',
        where: 'You run it',
        name: 'Open Source',
        badge: 'Available now',
        price: '$0',
        period: 'forever',
        text: 'Install the editor from npm. For real-time collaboration, run the open-source sync server in Docker.',
        cta: 'Get started',
        href: '/getting-started/',
        boxTitle: 'What you need',
        box: ['Nothing extra for the editor itself', 'A server with Docker for collaboration'],
        list: [
          'Unlimited documents and users',
          'Your servers and your data',
          'MIT license, commercial use allowed',
          'Community support on GitHub',
        ],
      },
      cloud: {
        id: 'cloud',
        where: 'We run it',
        name: 'Cloud',
        badge: '',
        price: 'Planned',
        period: 'not available yet',
        text: 'The same editor, with the server side hosted, scaled and backed up by us in the EU.',
        cta: 'Join the waitlist',
        href: '/cloud/#waitlist',
        boxTitle: 'What we will run for you',
        box: [
          'The sync server, scaled and updated',
          'Storage, backups and file uploads',
          'PDF export',
        ],
        list: ['Hosting in the EU', 'Email support', 'A discount for founding members'],
      },
      enterprise: {
        name: 'Enterprise',
        text: 'Support with response times, help installing on your servers, custom features and help with security reviews.',
        cta: 'Contact us',
        href: 'mailto:hello@novaprose.com?subject=NovaProse%20Enterprise',
      },
    },
    compare: {
      title: 'Who does what',
      columns: ['Open Source', 'Cloud (planned)', 'Enterprise'],
      highlight: 0,
      groups: [
        {
          title: 'The editor',
          rows: [['Every feature and plugin', true, true, true]],
        },
        {
          title: 'The server side',
          rows: [
            [
              'Collaboration server',
              'You run it in Docker',
              'We run it',
              'You run it, with our help',
            ],
            [
              'Documents and backups',
              'On your servers',
              'Stored by us in the EU',
              'On your servers',
            ],
            ['Images and files', 'Your storage', 'Included', 'Your storage'],
            ['Updates and monitoring', 'You', 'Us', 'You, with our help'],
          ],
        },
        {
          title: 'Help',
          rows: [
            ['Support', 'Community, on GitHub', 'Email', 'Response times by agreement'],
            ['Available', 'Now', 'Planned', 'Now'],
            ['Price', '$0', 'Published before launch', 'By agreement'],
          ],
        },
      ],
    },
    faqTitle: 'Questions',
    faqMore: 'Something not covered here? Write to',
    faq: [
      {
        q: 'Is the editor really free?',
        a: 'Yes. The editor, every plugin and the collaboration server are open source under the MIT license. Use them in commercial products without paying or asking.',
      },
      {
        q: 'Can I use your sync server in my app?',
        a: 'No. The server behind the live demo serves only the demo rooms on novaprose.com: they are public, nothing in them is saved, and the number of rooms and people is limited. Run your own sync server with Docker; the collaboration guide shows how.',
      },
      {
        q: 'Then why would I need Cloud?',
        a: 'Cloud isn’t available yet. When it opens, it is for teams that would rather not run, update and back up the sync server themselves. Until then, the open-source server runs anywhere Docker does.',
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
