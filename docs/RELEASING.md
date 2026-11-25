# Релизы и публикация в npm

Все пакеты версионируются вместе (одна версия на релиз). Публикуются проверенные архивы из
`.release/` (`pnpm release:pack`), а не «то, что сейчас в папке»: что проверили — то и ушло в npm.

## Чек-лист релиза

1. Версия в `packages/*/package.json` (одинаковая у всех) и раздел в `CHANGELOG.md`.
2. `pnpm check` и `pnpm e2e` зелёные.
3. `pnpm release:pack` — собирает всё и кладёт архивы в `.release/`; падает, если версии
   разошлись, остался `workspace:` или пакет помечен `private`.
4. Проверка архивов в чистом проекте (как в 0.1.0): установка из `.release/*.tgz`, импорт ESM/CJS в
   Node, `tsc` с `moduleResolution: bundler` и `node16`, сборка Vite (React, Vue, веб-компонент) и
   AOT-сборка Angular (`ng build`) с запуском в браузере.
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
