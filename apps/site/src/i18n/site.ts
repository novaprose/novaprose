/**
 * Тексты продуктовых страниц сайта (главная, цены, облако, политика) на английском и русском.
 * Документация — отдельно (Starlight, на английском).
 */

export type Lang = 'en' | 'ru';

export const LANGS: Lang[] = ['en', 'ru'];

/** Путь страницы на нужном языке: «/pricing/» → «/ru/pricing/». */
export function localePath(lang: Lang, path: string): string {
  return lang === 'en' ? path : `/ru${path}`;
}

const en = {
  meta: {
    title: 'NovaProse — rich text editor with collaboration built in',
    description:
      'Embed a fast, accessible WYSIWYG editor in any web app. Real-time co-editing, comments and version history included. Open source under MIT.',
  },
  nav: {
    features: 'Features',
    demo: 'Live demo',
    pricing: 'Pricing',
    docs: 'Docs',
    start: 'Get started',
    menu: 'Menu',
    language: 'Language',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeAuto: 'System',
    skip: 'Skip to content',
  },
  hero: {
    eyebrow: 'Open source · MIT licensed',
    title: 'The rich text editor with collaboration built in',
    lead: 'Add a fast, accessible WYSIWYG editor to your web app in minutes. Real-time co-editing, comments, version history and suggested edits come included — not as extra products.',
    primary: 'Get started free',
    secondary: 'See it live',
    note: 'No account or API key · React, Vue, Angular and plain HTML',
    editorLabel: 'Try it: this is the real editor',
  },
  audience: {
    title: 'Built for teams that ship software',
    items: [
      {
        title: 'SaaS and product teams',
        text: 'Give your users a familiar editor for notes, tickets, proposals or knowledge bases — with collaboration they expect from modern apps.',
      },
      {
        title: 'CMS and publishing',
        text: 'Clean, predictable HTML, paste from Word and Google Docs, tables and images — content that looks right everywhere it is published.',
      },
      {
        title: 'Internal tools',
        text: 'Drop it into an admin panel or a form with one tag. It works as a real form field and stays accessible for every employee.',
      },
    ],
  },
  features: {
    title: 'Everything a modern editor needs',
    lead: 'All features are part of the open-source editor. Nothing is locked behind a plan.',
    items: [
      {
        icon: 'users',
        title: 'Real-time collaboration',
        text: 'Edit together with live cursors and names. Undo affects only your own changes. Run the open-source sync server yourself.',
      },
      {
        icon: 'message',
        title: 'Comments and @mentions',
        text: 'Discuss any passage in threads, mention colleagues and resolve the conversation when it is done.',
      },
      {
        icon: 'history',
        title: 'Version history and suggested edits',
        text: 'See what changed between versions, restore any of them, or propose changes for others to accept or reject.',
      },
      {
        icon: 'paste',
        title: 'Paste from Word and Google Docs',
        text: 'Lists, tables, formatting and images survive the paste — without the hidden markup that usually comes with them.',
      },
      {
        icon: 'blocks',
        title: 'Works with your framework',
        text: 'Native packages for React, Vue and Angular, a Web Component for everything else, and a one-line CDN script.',
      },
      {
        icon: 'shield',
        title: 'Secure and accessible',
        text: 'Every link and image is checked, unsafe markup is dropped. Full keyboard support and screen-reader labels throughout.',
      },
    ],
  },
  collab: {
    title: 'Collaboration your users will notice',
    text: 'Open the live demo in two windows — or send the link to a colleague — and type at the same time. Leave a comment, mention someone, compare versions or switch to suggesting mode.',
    points: [
      'Live cursors with names and colors',
      'Comments and @mentions synced instantly',
      'Version history with word-by-word differences',
      'Suggested edits to accept or reject',
    ],
    cta: 'Open the live demo',
  },
  integrations: {
    title: 'Fits into the stack you already have',
    items: ['React', 'Vue', 'Angular', 'Web Component', 'Plain HTML'],
    note: 'Moving an existing editor setup over?',
    link: 'See the migration guides',
  },
  trust: {
    title: 'Built in the open',
    items: [
      {
        icon: 'github',
        title: 'Open source on GitHub',
        text: 'Read every line, open issues, contribute. MIT licensed — use it in commercial products.',
      },
      {
        icon: 'badge',
        title: 'Signed releases',
        text: 'npm packages are built by GitHub Actions with provenance, so you can verify where they came from.',
      },
      {
        icon: 'check',
        title: 'Tested in real browsers',
        text: 'Hundreds of automated tests run on every change in Chromium, Firefox, WebKit and mobile Chrome.',
      },
      {
        icon: 'lock',
        title: 'Security first',
        text: 'Safe by default, with a published security policy and a private channel for reports.',
      },
    ],
  },
  pricing: {
    title: 'Simple pricing',
    lead: 'The editor is free and open source. NovaProse Cloud will host the server side for teams that don’t want to run it.',
    pageTitle: 'Pricing',
    pageLead:
      'Use the whole editor for free, forever. Cloud is in early access for teams that want collaboration hosted for them.',
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
          'React, Vue, Angular, Web Component',
          'MIT license — commercial use allowed',
        ],
        cta: 'Get started',
        href: '/getting-started/',
      },
      {
        id: 'cloud',
        name: 'Cloud',
        price: 'Early access',
        period: 'pricing at launch',
        text: 'Collaboration and services hosted for you.',
        features: [
          'Hosted real-time sync server',
          'Document and version storage',
          'Image and file uploads',
          'Word import, PDF and Word export',
          'EU hosting, usage-based fair pricing',
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
        text: 'For organizations with special requirements.',
        features: [
          'Support with response times',
          'On-premise installation help',
          'Custom features and integrations',
          'Security review assistance',
        ],
        cta: 'Contact us',
        href: 'mailto:hello@novaprose.com?subject=NovaProse%20Enterprise',
      },
    ],
    compareTitle: 'What’s included',
    faqTitle: 'Questions',
    faq: [
      {
        q: 'Is the editor really free?',
        a: 'Yes. The editor, every plugin and the collaboration server are open source under the MIT license. You can use them in commercial products without paying or asking.',
      },
      {
        q: 'Why would I need Cloud then?',
        a: 'Collaboration needs a server. You can run ours yourself with Docker; Cloud is for teams that would rather not operate, scale and back it up.',
      },
      {
        q: 'How much will Cloud cost?',
        a: 'We will publish prices before Cloud opens. Waitlist members hear first, and founding members get a discount.',
      },
      {
        q: 'Do you need an API key or account to use the editor?',
        a: 'No. Install it from npm or load it from a public CDN — no sign-up, no keys, no usage limits.',
      },
      {
        q: 'Can I use NovaProse with my existing editor setup?',
        a: 'Often yes. There is a compatibility layer for tinymce.init() configurations, so an existing setup can run first and move to the native API later.',
      },
    ],
  },
  cloud: {
    title: 'NovaProse Cloud',
    lead: 'Everything the editor needs on the server side, hosted in the EU and run for you. Now in early access.',
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
        text: 'Documents, versions, images and files stored and backed up for you.',
      },
      { icon: 'file', title: 'Conversion', text: 'Import Word documents, export to PDF and Word.' },
      {
        icon: 'globe',
        title: 'Fast delivery',
        text: 'The editor from a CDN, with keys bound to your domains.',
      },
    ],
    todayTitle: 'You don’t have to wait',
    todayText:
      'Everything works today without Cloud: install the editor from npm and run the open-source sync server with Docker.',
    todayLink: 'Read how to self-host collaboration',
  },
  waitlist: {
    title: 'Join the early access waitlist',
    text: 'Be the first to try Cloud. Founding members get a discount when it launches.',
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
    errorEmail: 'Please enter a valid email address.',
    errorConsent: 'Please accept the privacy policy to join.',
    errorRate: 'Too many attempts. Please try again in an hour.',
    errorNetwork: 'Something went wrong. Please try again, or write to hello@novaprose.com.',
    required: 'required',
  },
  cta: {
    title: 'Start building in minutes',
    text: 'Install from npm, or add one script tag. No account needed.',
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
    security: 'Security',
    privacy: 'Privacy',
    contact: 'Contact',
    rights: 'NovaProse is an independent open-source project.',
  },
  privacy: {
    title: 'Privacy policy',
    updated: 'Last updated: 25 November 2026',
  },
  docsNote: 'Documentation is in English.',
};

export type Dict = typeof en;

const ru: Dict = {
  meta: {
    title: 'NovaProse — редактор текста со встроенной совместной работой',
    description:
      'Встройте быстрый и доступный WYSIWYG-редактор в любое веб-приложение. Совместное редактирование, комментарии и история версий уже внутри. Открытый код, лицензия MIT.',
  },
  nav: {
    features: 'Возможности',
    demo: 'Демо',
    pricing: 'Цены',
    docs: 'Документация',
    start: 'Начать',
    menu: 'Меню',
    language: 'Язык',
    theme: 'Тема',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    themeAuto: 'Как в системе',
    skip: 'Перейти к содержимому',
  },
  hero: {
    eyebrow: 'Открытый код · лицензия MIT',
    title: 'Редактор текста со встроенной совместной работой',
    lead: 'Добавьте быстрый и доступный WYSIWYG-редактор в своё веб-приложение за несколько минут. Совместное редактирование, комментарии, история версий и режим правок уже включены — не отдельными продуктами.',
    primary: 'Начать бесплатно',
    secondary: 'Посмотреть вживую',
    note: 'Без аккаунта и ключей · React, Vue, Angular и обычный HTML',
    editorLabel: 'Попробуйте: это настоящий редактор',
  },
  audience: {
    title: 'Для команд, которые делают продукты',
    items: [
      {
        title: 'SaaS и продуктовые команды',
        text: 'Привычный редактор для заметок, задач, коммерческих предложений и баз знаний — с совместной работой, которую пользователи ждут от современных сервисов.',
      },
      {
        title: 'CMS и издательства',
        text: 'Чистый предсказуемый HTML, вставка из Word и Google Docs, таблицы и картинки — текст выглядит правильно везде, где публикуется.',
      },
      {
        title: 'Внутренние системы',
        text: 'Добавьте в админку или форму одним тегом. Работает как обычное поле формы и доступен каждому сотруднику.',
      },
    ],
  },
  features: {
    title: 'Всё, что нужно современному редактору',
    lead: 'Все возможности входят в открытый редактор. Ничего не спрятано за тарифом.',
    items: [
      {
        icon: 'users',
        title: 'Совместное редактирование',
        text: 'Работайте вместе: видно курсоры и имена. «Отменить» отменяет только ваши правки. Сервер синхронизации открыт — запустите его у себя.',
      },
      {
        icon: 'message',
        title: 'Комментарии и @упоминания',
        text: 'Обсуждайте любой фрагмент в ветке, упоминайте коллег и закрывайте обсуждение, когда вопрос решён.',
      },
      {
        icon: 'history',
        title: 'История версий и режим правок',
        text: 'Смотрите, что изменилось между версиями, восстанавливайте любую или предлагайте правки, которые другие примут или отклонят.',
      },
      {
        icon: 'paste',
        title: 'Вставка из Word и Google Docs',
        text: 'Списки, таблицы, форматирование и картинки переносятся без лишней скрытой разметки.',
      },
      {
        icon: 'blocks',
        title: 'Работает с вашим фреймворком',
        text: 'Нативные пакеты для React, Vue и Angular, веб-компонент для всего остального и подключение одной строкой с CDN.',
      },
      {
        icon: 'shield',
        title: 'Безопасный и доступный',
        text: 'Каждая ссылка и картинка проверяется, опасная разметка удаляется. Полная поддержка клавиатуры и экранных дикторов.',
      },
    ],
  },
  collab: {
    title: 'Совместная работа, которую заметят пользователи',
    text: 'Откройте демо в двух окнах — или отправьте ссылку коллеге — и печатайте одновременно. Оставьте комментарий, упомяните кого-нибудь, сравните версии или включите режим правок.',
    points: [
      'Курсоры участников с именами и цветами',
      'Комментарии и @упоминания синхронизируются мгновенно',
      'История версий с отличиями по словам',
      'Предложенные правки: принять или отклонить',
    ],
    cta: 'Открыть живое демо',
  },
  integrations: {
    title: 'Встраивается в ваш стек',
    items: ['React', 'Vue', 'Angular', 'Web Component', 'Обычный HTML'],
    note: 'Переносите готовую интеграцию другого редактора?',
    link: 'Руководства по переносу',
  },
  trust: {
    title: 'Делаем открыто',
    items: [
      {
        icon: 'github',
        title: 'Открытый код на GitHub',
        text: 'Читайте каждую строку, заводите задачи, присылайте правки. Лицензия MIT — можно использовать в коммерческих продуктах.',
      },
      {
        icon: 'badge',
        title: 'Подписанные релизы',
        text: 'Пакеты npm собирает GitHub Actions с подписью происхождения — можно проверить, откуда они взялись.',
      },
      {
        icon: 'check',
        title: 'Проверено в настоящих браузерах',
        text: 'Сотни автоматических тестов на каждое изменение в Chromium, Firefox, WebKit и мобильном Chrome.',
      },
      {
        icon: 'lock',
        title: 'Безопасность прежде всего',
        text: 'Безопасные настройки по умолчанию, опубликованная политика безопасности и закрытый канал для сообщений об уязвимостях.',
      },
    ],
  },
  pricing: {
    title: 'Простые цены',
    lead: 'Редактор бесплатный и открытый. NovaProse Cloud будет размещать серверную часть для команд, которые не хотят её обслуживать.',
    pageTitle: 'Цены',
    pageLead:
      'Весь редактор — бесплатно и навсегда. Облако — в раннем доступе для команд, которым нужна совместная работа без своего сервера.',
    plans: [
      {
        id: 'oss',
        name: 'Open Source',
        price: 'Бесплатно',
        period: 'навсегда',
        text: 'Весь редактор и все плагины на вашем сервере.',
        features: [
          'Все возможности редактирования и плагины',
          'Совместная работа, комментарии, история, режим правок',
          'Открытый сервер синхронизации (Docker)',
          'React, Vue, Angular, веб-компонент',
          'Лицензия MIT — коммерческое использование разрешено',
        ],
        cta: 'Начать',
        href: '/getting-started/',
      },
      {
        id: 'cloud',
        name: 'Cloud',
        price: 'Ранний доступ',
        period: 'цены — к запуску',
        text: 'Совместная работа и сервисы на нашей стороне.',
        features: [
          'Сервер синхронизации в облаке',
          'Хранение документов и версий',
          'Загрузка картинок и файлов',
          'Импорт Word, экспорт в PDF и Word',
          'Серверы в ЕС, честная оплата по использованию',
        ],
        cta: 'Встать в лист ожидания',
        href: '/ru/cloud/#waitlist',
        badge: 'Первым участникам — скидка',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Индивидуально',
        period: 'напишите нам',
        text: 'Для организаций с особыми требованиями.',
        features: [
          'Поддержка со сроками ответа',
          'Помощь с установкой на ваших серверах',
          'Доработки и интеграции под вас',
          'Помощь с проверкой безопасности',
        ],
        cta: 'Написать нам',
        href: 'mailto:hello@novaprose.com?subject=NovaProse%20Enterprise',
      },
    ],
    compareTitle: 'Что входит',
    faqTitle: 'Вопросы',
    faq: [
      {
        q: 'Редактор правда бесплатный?',
        a: 'Да. Редактор, все плагины и сервер совместной работы открыты под лицензией MIT. Их можно использовать в коммерческих продуктах без оплаты и разрешений.',
      },
      {
        q: 'Зачем тогда облако?',
        a: 'Для совместной работы нужен сервер. Наш можно запустить у себя через Docker, а облако — для команд, которые не хотят его обслуживать, масштабировать и бэкапить.',
      },
      {
        q: 'Сколько будет стоить облако?',
        a: 'Мы опубликуем цены до открытия. Участники листа ожидания узнают первыми, а первые клиенты получат скидку.',
      },
      {
        q: 'Нужен ли ключ или аккаунт, чтобы пользоваться редактором?',
        a: 'Нет. Установите из npm или подключите с публичного CDN — без регистрации, ключей и ограничений.',
      },
      {
        q: 'Можно ли перенести готовую интеграцию другого редактора?',
        a: 'Часто да. Есть слой совместимости для настроек tinymce.init(): готовая интеграция сначала заработает как есть, а на нативный API можно перейти позже.',
      },
    ],
  },
  cloud: {
    title: 'NovaProse Cloud',
    lead: 'Всё, что редактору нужно на сервере, — в ЕС и под нашим управлением. Сейчас в раннем доступе.',
    whatTitle: 'Что будет в облаке',
    items: [
      {
        icon: 'users',
        title: 'Совместная работа',
        text: 'Синхронизация, присутствие, комментарии и история версий без своего сервера.',
      },
      {
        icon: 'database',
        title: 'Хранение',
        text: 'Документы, версии, картинки и файлы — с резервными копиями.',
      },
      { icon: 'file', title: 'Конвертация', text: 'Импорт документов Word, экспорт в PDF и Word.' },
      {
        icon: 'globe',
        title: 'Быстрая доставка',
        text: 'Редактор с CDN, ключи привязаны к вашим доменам.',
      },
    ],
    todayTitle: 'Можно не ждать',
    todayText:
      'Всё работает уже сейчас без облака: установите редактор из npm и запустите открытый сервер синхронизации через Docker.',
    todayLink: 'Как развернуть совместную работу у себя',
  },
  waitlist: {
    title: 'Лист ожидания раннего доступа',
    text: 'Попробуйте облако первыми. Первые участники получат скидку при запуске.',
    email: 'Рабочая почта',
    role: 'Ваша роль',
    roles: {
      developer: 'Разработчик',
      product: 'Продукт или дизайн',
      founder: 'Основатель или CTO',
      other: 'Другое',
    },
    team: 'Размер команды',
    consent: 'Я согласен получать письма о NovaProse Cloud и принимаю',
    privacy: 'политику конфиденциальности',
    submit: 'Встать в лист ожидания',
    sending: 'Отправляем…',
    success: 'Вы в списке. Мы напишем, когда откроется ранний доступ.',
    errorEmail: 'Проверьте адрес почты.',
    errorConsent: 'Чтобы встать в лист, примите политику конфиденциальности.',
    errorRate: 'Слишком много попыток. Попробуйте через час.',
    errorNetwork: 'Что-то пошло не так. Попробуйте ещё раз или напишите на hello@novaprose.com.',
    required: 'обязательно',
  },
  cta: {
    title: 'Начните за несколько минут',
    text: 'Установите из npm или добавьте один тег script. Аккаунт не нужен.',
    primary: 'Быстрый старт',
    secondary: 'Звезда на GitHub',
  },
  footer: {
    tagline: 'Открытый редактор текста со встроенной совместной работой.',
    product: 'Продукт',
    resources: 'Ресурсы',
    project: 'Проект',
    changelog: 'Что нового',
    migrate: 'Перенос с другого редактора',
    security: 'Безопасность',
    privacy: 'Конфиденциальность',
    contact: 'Контакты',
    rights: 'NovaProse — независимый проект с открытым кодом.',
  },
  privacy: {
    title: 'Политика конфиденциальности',
    updated: 'Обновлено: 25 ноября 2026',
  },
  docsNote: 'Документация на английском.',
};

export const dict: Record<Lang, Dict> = { en, ru };
