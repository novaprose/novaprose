# Релизы и публикация в npm

Все пакеты версионируются вместе (одна версия на релиз). Публикуются проверенные архивы из
`.release/` (`pnpm release:pack`), а не «то, что сейчас в папке»: что проверили — то и ушло в npm.

## Чек-лист релиза

1. Версия в `packages/*/package.json` (одинаковая у всех) и раздел в `CHANGELOG.md`. Новый минор —
   ещё и примеры: `@novaprose/*` в `examples/*/package.json` (`^X.Y.0`) и ссылки CDN (`@X.Y`) в
   `examples/cdn`, README веб-компонента и `getting-started.md`.
2. `pnpm check` и `pnpm e2e` зелёные.
3. `pnpm release:pack` — собирает всё и кладёт архивы в `.release/`; падает, если версии
   разошлись, остался `workspace:` или пакет помечен `private`.
4. `pnpm verify:examples --strict` — примеры из `examples/` ставятся из `.release/*.tgz` в чистые
   папки: сборка Vite с проверкой типов (React 19, Vue + vue-tsc) и запуск в Chromium, CDN-файл
   веб-компонента в форме, отрисовка на сервере в Node (ESM и CJS). `--strict` — версии в примерах
   совпадают с выпускаемой. Типы ESM/CJS (`node16`, `bundler`) проверяет `pnpm check:packages`.
   Вручную пока остаётся AOT-сборка Angular (`ng build`).
5. Публикация (см. ниже), затем тег `vX.Y.Z` в git.

## Первая публикация (один раз, вручную)

Trusted publishing настраивается в настройках **уже существующего** пакета, поэтому 0.1.0
публикует владелец со своей машины:

```bash
npm login                       # откроется браузер, подтвердить вход (2FA)
pnpm release:pack
npm publish .release/novaprose-core-0.1.0.tgz --access public
npm publish .release/novaprose-react-0.1.0.tgz --access public
npm publish .release/novaprose-vue-0.1.0.tgz --access public
npm publish .release/novaprose-web-component-0.1.0.tgz --access public
npm publish .release/novaprose-angular-0.1.0.tgz --access public
```

На каждую публикацию npm может спросить подтверждение 2FA. Порядок важен: ядро первым.

## Дальше — автоматически из GitHub Actions (настроено 25.11.2026, первый релиз так — 0.5.1)

Обычный релиз: версии и CHANGELOG → коммит → `git tag vX.Y.Z && git push origin vX.Y.Z`. Workflow прогоняет
`pnpm check`, собирает архивы и публикует все пакеты (уже опубликованные пропускает). Новый пакет
первый раз публикуется вручную, затем ему настраивается Trusted Publisher (см. ниже).

Настройка (сделана для 7 пакетов):

1. Для **каждого** из 5 пакетов на npmjs.com: Package → Settings → **Trusted Publisher** →
   GitHub Actions: организация `novaprose`, репозиторий `novaprose`, workflow `release.yml`,
   environment `npm`, в «Allowed actions» — галочка **Allow npm publish** (без неё разрешена только
   `npm stage publish`, и версии повисают «staged»).
2. В GitHub: Settings → Environments → `npm`, «Deployment branches and tags» → только теги `v*`.
   «Required reviewers» для приватного репозитория на бесплатном тарифе недоступны.
3. В npm для каждого пакета: Settings → Publishing access →
   «Require two-factor authentication and disallow tokens» — после этого публиковать можно только
   через trusted publishing или вручную с 2FA.
4. Релиз: обновить версии и CHANGELOG, закоммитить, `git tag vX.Y.Z && git push origin vX.Y.Z`.

Provenance (подпись происхождения пакета) npm добавляет автоматически, когда репозиторий
публичный; для приватного репозитория её не будет.

## Если что-то пошло не так

- **404 на `npm publish` в GitHub Actions** («could not be found or you do not have permission»): npm не
  принял запуск как доверенный. Trusted Publisher привязан к конкретному репозиторию GitHub, а не только к его
  имени: после переноса или пересоздания репозитория связь у **каждого** пакета нужно создать заново (Add trusted
  publisher, те же значения). Проверить окружение (`npm`, без опечаток) и галочку «Allow npm publish». Уже
  опубликованные пакеты при перезапуске пропускаются — перезапуск безопасен.

- **409 «Cannot publish over previously staged version» / 403 «cannot publish over the previously
  published versions»** (было в 0.2.0): версия уже загружена — npm сначала держит её как «staged»
  (служебная `0.0.0-stage` в списке версий), потом публикует. Повторно не публиковать: проверить
  `npm view @novaprose/<pkg>@X.Y.Z version` (под своим входом видно сразу). Анонимно новая версия, а
  тем более новый пакет, может отдавать 404 ещё несколько минут — копии реестра обновляются не сразу.

- Опубликованную версию нельзя перезаписать. Ошибку исправляем следующей патч-версией.
- `npm unpublish` возможен только в первые 72 часа и только если пакет никто не скачал как
  зависимость; вместо этого лучше `npm deprecate @novaprose/<pkg>@X.Y.Z "причина"`.

## Сайт novaprose.com

Cloudflare Workers Builds собирает и публикует сайт при каждом push в `main` (конфиг — `wrangler.jsonc`
в корне, статические файлы из `apps/site/dist`).

| Поле в Cloudflare | Значение                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| Build command     | `pnpm install --frozen-lockfile && pnpm --filter "@novaprose/site..." build` |
| Deploy command    | `npx wrangler deploy`                                                        |
| Build variable    | `NODE_VERSION` = `24`                                                        |
