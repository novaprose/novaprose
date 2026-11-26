# NovaProse — правила проекта

Встраиваемый WYSIWYG-редактор на ProseMirror с облачной платформой. Независимый открытый проект.

**Позиционирование:** продаём свои сильные стороны (MIT, совместная работа из коробки, качество), а не «замену
TinyMCE». TinyMCE — ориентир для паритета функций (внутренние документы) и источник миграций; в публичных текстах
он упоминается только в описании совместимости и переноса, без сравнений цен и тарифов.
Внутренние документы (PRD, дорожная карта, решения, трекер паритета, тексты запуска) — в **приватном** репозитории,
локально в соседней папке `../nova-internal/docs/` (PRD.md, ROADMAP.md, DECISIONS.md, PARITY.md, launch/). Сюда, в
публичный репозиторий, их не копировать; паритет пересчитывается там: `node scripts/parity.mjs`.

Язык общения, комментариев в коде и документации — русский. Идентификаторы, имена API и коммиты — английский.

## Clean-room — обязательно

- **Не читать, не открывать и не копировать исходный код TinyMCE** (GPL2+), его иконки, скины, тексты документации.
  Это касается и агентов: не искать код TinyMCE на GitHub, не подсматривать реализацию плагинов.
- Совместимость (имена плагинов, опции `tinymce.init()`, события) делаем **только по публичной документации API**
  на tiny.cloud/docs — описание поведения, а не код.
- Бренд, иконки, названия продуктов — свои. Слова «Tiny», «TinyMCE» допустимы только при описании совместимости.
- Код ProseMirror (MIT) читать и использовать можно.

## Структура

```
packages/core/src
  editor.ts         класс Editor — единственный публичный API
  schema.ts         схема документа + валидация CSS-значений (cssValue)
  serializer.ts     строковый HTML-сериализатор (getHTML): детерминированный, без DOM
  commands.ts       именованные команды (CommandName)
  styles.ts, link.ts, image.ts — команды стилей, ссылок, картинок (+ их диалоги)
  i18n/             строки UI: en (эталон ключей), ru
  ui/               UI-слой: manager (editor.ui), registry, toolbar, menu, popover, dialog, tooltip,
                    notification, statusbar, link-bubble, color-panel, builtins (встроенные кнопки)
  style.css         скин и дизайн-токены --nova-*
packages/react      @novaprose/react — компонент <NovaProseEditor> + хуки useEditor/useEditorState/useCommand
packages/vue        @novaprose/vue — компонент с v-model + композаблы (те же имена)
packages/web-component  <novaprose-editor>: form-associated элемент + CDN-сборка (dist/novaprose.global.js)
packages/angular    @novaprose/angular — standalone-компонент + ControlValueAccessor; сборка ng-packagr,
                    свой TypeScript 6 (Angular 22 его требует), тесты — JIT в vitest
packages/tinymce-compat  @novaprose/tinymce-compat — tinymce.init() поверх Editor (+ CDN-замена tinymce.min.js)
packages/collab     @novaprose/collab — совместное редактирование (Yjs, y-prosemirror, Hocuspocus-клиент)
apps/sync-server    сервер синхронизации: Hocuspocus + node:sqlite + JWT вашего бэкенда, Dockerfile
apps/playground     Vite-песочница (по исходникам). ?lang=en|ru, ?upload=slow|fail — имитация загрузки;
                    react.html, vue.html, element.html, angular.html — песочницы обёрток, collab.html —
                    два редактора в одной комнате (их гоняют e2e/*.spec.ts; sync-сервер Playwright поднимает сам)
apps/site           сайт novaprose.com (Astro + Starlight, английский). Страницы фреймворков и changelog
                    генерируются из README/CHANGELOG: правьте источник и запускайте sync-docs
e2e/                Playwright: Chromium, Firefox, WebKit, мобильный Chrome
docs/               RELEASING.md — как выпускать релизы (публичное)
test/setup.ts       заглушки jsdom для юнит-тестов
```

## Граф знаний (graphify)

Локальный граф проекта: `graphify-out/` (в .gitignore). `GRAPH_REPORT.md` — центральные узлы, 157 сообществ
с русскими именами, мосты; `graph.html` — интерактивная карта. Прежде чем читать много файлов, спрашивать граф:
`python -m graphify query "<вопрос>"`, `python -m graphify explain "<узел>"`, `python -m graphify path "A" "B"`.
После крупных изменений — `/graphify . --update` (код — бесплатно по AST; документы — через подагентов).
Связи «calls»/«indirect_call» из AST бывают ложными (`import type` считается вызовом) — проверять по коду.
Имена сообществ — `graphify-out/labels.py`.

## Команды

```bash
pnpm install        # зависимости
pnpm dev            # playground на http://localhost:5173
pnpm test           # юнит-тесты (vitest + jsdom)
pnpm typecheck      # tsc по всем пакетам
pnpm lint           # eslint
pnpm format         # prettier
pnpm build          # сборка пакетов (tsup → dist/)
pnpm e2e            # браузерные тесты Playwright (playground поднимается сам)
pnpm check          # формат, линт, типы, юнит-тесты — перед коммитом (его же запускает git-хук pre-push)
pnpm test:coverage  # юнит-тесты + покрытие; пороги («храповик») в vitest.config.ts — поднимать вслед за ростом
pnpm test:deep [N]  # property-based тесты на N случайных документов (по умолчанию 5000; в CI ночью — 20 000)
pnpm size           # бюджет размера в gzip (нужна сборка); падает при превышении
pnpm check:packages # publint + типы ESM/CJS в архивах .release/ (нужен release:pack)
pnpm verify:release # сборка + архивы + size + check:packages — то же, что CI и релиз
```

CI (`.github/workflows`): ci.yml — check с покрытием, сборка/размер/пакеты, e2e во всех браузерах + a11y;
nightly.yml — глубокие property-тесты; codeql.yml — статический анализ безопасности; dependabot.yml —
обновления зависимостей. Действия закреплены по SHA коммита (версия в комментарии) — новые добавлять так же.
Git-хуки (simple-git-hooks, ставятся при `pnpm install`): pre-push — `pnpm check`, commit-msg — Conventional Commits.

## Архитектурные правила

- **Публичный API — только класс `Editor`** (`packages/core/src/editor.ts`). Обёртки фреймворков не трогают
  ProseMirror напрямую, только `Editor`: `getHTML/setContent/exec/can/on/destroy`.
- **Схема — источник правды для HTML.** Каждый новый узел/марка обязаны иметь `parseDOM` и `toDOM`, и тест
  «HTML туда-обратно без изменений» в `packages/core/test`.
- **Безопасность по умолчанию.** Любой URL из контента проходит `isSafeLinkUrl` / `isSafeImageUrl` и при разборе,
  и при выводе (документ может прийти через JSON). Никаких `innerHTML` с пользовательскими данными в UI.
- **Внешний JSON — любого типа.** Атрибуты из JSON могут быть null, числом, мусором: `toDOM`, `getFromDOM` и UI
  не должны падать (приводить типы, а не доверять). Новый узел/марку добавлять в генераторы
  `security.property.test.ts` и `json-robustness.test.ts`.
- **Именованные команды** (`CommandName` в `commands.ts`) — часть публичного API: переименование = breaking change.
- **Бюджет размера:** ядро ≤ 150 КБ gzip при первой загрузке, вместе с ProseMirror (ноябрь 2026: 149.9 КБ —
  147.6 КБ: подписи к картинкам, отступы, события; CSS 11.1 КБ, ленивые чанки 20.8 КБ отдельно). Проверяет `pnpm size` в CI. Новая тяжёлая
  зависимость — только отдельным лениво загружаемым плагином. Кандидаты на вынос из первой загрузки:
  UI комментариев и правок (по 8.5 КБ). Механика таблиц (prosemirror-tables) уже ленивая: tables.ts —
  заместители команд, table.ts — чанк; догрузка делает `state.reconfigure`, а ProseMirror при этом
  пересоздаёт представления ВСЕХ плагинов. Поэтому перестройка — только через `reconfigurePlugins`
  (plugin-views.ts): представления сохраняются, а не пересоздаются.
  Синхронный хук нельзя сделать ленивым напрямую — образец: paste.ts (фоновая загрузка + `editor.ready` +
  перехват события, если чанк ещё не готов).
- **SSR:** никакого обращения к `window`/`document` на уровне модуля.
- **UI-строки только через `editor.ui.t(key)`.** Новый ключ — в `i18n/en.ts` (встроен только английский), переводы — в `i18n/packs/*.ts`.
  В плагине: `export const LABELS = { en: {...} }` (только en!) + `pickLabels(editor, '<имя плагина>', LABELS)` —
  строки идут через ту же систему (ключи `<плагин>.<ключ>`); полноту языков проверяет `test/i18n.test.ts`.
  Новая строка → добавить её во ВСЕ пакеты `src/i18n/packs/*.ts` (иначе `node scripts/i18n.mjs check` в `pnpm check`
  упадёт). Русский (`packs/ru.ts`) — полный, в CDN-сборках встроен; de/es/fr/it/pt-BR — черновые (перевод Claude), до вычитки
  носителем статус «draft». Размер ядра: 133.7 КБ (ноябрь 2026, после выноса русского в пакет и механики таблиц).
- **Необязательная функциональность — плагином** в `src/plugins/` (`definePlugin`, ленивая регистрация
  в `src/plugins/index.ts`). В ядро — только то, без чего редактор не редактор.
- **Новые кнопки — через `editor.ui.registry`** (как плагин); имена — как в публичной документации TinyMCE.
- **UI строим через `h()` из `ui/dom.ts`**, без innerHTML (исключение — собственные SVG-иконки).
- **Доступность обязательна:** роли ARIA, клавиатура (стрелки, Esc, Tab), видимый фокус, aria-label у иконок.
  Контраст текста ≥ 4.5:1 на всех поверхностях (в т.ч. hover/pressed): для текста — `--nova-muted`, не `--nova-subtle`;
  заливка с белым текстом — `--nova-accent-strong`. Новый диалог/меню — добавить состояние в `e2e/a11y.spec.ts` (axe).
- Все цвета UI — через CSS-переменные `--nova-*` в `style.css`; светлая и тёмная тема обязаны работать.

## Приоритеты

P0 — к MVP, P1 — к GA, P2 — после GA (см. PRD в ../nova-internal). Не браться за P1/P2, пока не закрыт P0 этапа.
Перед крупной фичей — свериться с ROADMAP.md (../nova-internal), чтобы не распыляться.

## Качество

- Новая функциональность = тесты. Баг = сначала падающий тест, потом фикс.
- `pnpm check` должен быть зелёным перед коммитом.
- jsdom не считает вёрстку: выделение, IME, вставка, раскладка тулбара, мобильные — покрывать e2e в `e2e/`.
  e2e не должны зависеть от раскладки: контролы нажимать через хелпер `clickControl` (учитывает «⋯»).
- Визуальные изменения UI — проверять скриншотами в светлой и тёмной теме и на узком экране.
- `pnpm check` и `pnpm e2e` зелёные перед коммитом.
- Property-based тесты (fast-check) нашли 6 реальных дефектов — при падении берите минимальный пример из вывода
  и делайте из него обычный тест-регрессию, потом фикс.
- Windows: vitest приводит регистр диска в vitest.config.ts — иначе из Git Bash React/ProseMirror грузятся дважды.
- Открытый вопрос: Shift+Enter в эмуляции Android (Pixel 7) даёт пробелы вместо переноса — проверить на устройстве.
