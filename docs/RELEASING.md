# Releases and publishing to npm

All packages are versioned together (one version per release). What gets published are the checked archives
from `.release/` (`pnpm release:pack`), not "whatever is in the folder right now": what was checked is what goes
to npm.

## Release checklist

1. The version in `packages/*/package.json` (the same everywhere) and a section in `CHANGELOG.md`. A new minor
   also updates the examples: `@novaprose/*` in `examples/*/package.json` (`^X.Y.0`) and the CDN links (`@X.Y`)
   in `examples/cdn`, the web component README and `getting-started.md`.
2. `pnpm check` and `pnpm e2e` are green.
3. `pnpm release:pack` builds everything and puts the archives into `.release/`; it fails when the versions
   differ, a `workspace:` range is left or a package is marked `private`.
4. `pnpm verify:examples --strict`: the examples from `examples/` are installed from `.release/*.tgz` into clean
   folders: a Vite build with type checks (React 19, Vue + vue-tsc) and a run in Chromium, the web component CDN
   file in a form, server rendering in Node (ESM and CJS). `--strict` means the versions in the examples match
   the one being released. ESM/CJS types (`node16`, `bundler`) are checked by `pnpm check:packages`. The Angular
   AOT build (`ng build`) is still checked by hand.
5. Publish (see below), then tag `vX.Y.Z` in git.

## First publication (once, by hand)

Trusted publishing is configured in the settings of a package that **already exists**, so 0.1.0 was published
by the owner from their own machine:

```bash
npm login                       # opens the browser, confirm the sign-in (2FA)
pnpm release:pack
npm publish .release/novaprose-core-0.1.0.tgz --access public
npm publish .release/novaprose-react-0.1.0.tgz --access public
npm publish .release/novaprose-vue-0.1.0.tgz --access public
npm publish .release/novaprose-web-component-0.1.0.tgz --access public
npm publish .release/novaprose-angular-0.1.0.tgz --access public
```

npm may ask for a 2FA confirmation on every publish. The order matters: the core goes first.

## After that: automatically from GitHub Actions (set up on 25.11.2026, first release this way: 0.5.1)

A regular release: versions and CHANGELOG → commit → `git tag vX.Y.Z && git push origin vX.Y.Z`. The workflow runs
`pnpm check`, builds the archives and publishes every package (already published ones are skipped). A new
package is published by hand the first time, then a Trusted Publisher is set up for it (see below).

Setup (done for 7 packages):

1. For **each** package on npmjs.com: Package → Settings → **Trusted Publisher** → GitHub Actions:
   organization `novaprose`, repository `novaprose`, workflow `release.yml`, environment `npm`, and under
   "Allowed actions" tick **Allow npm publish** (without it only `npm stage publish` is allowed, and versions
   hang as "staged").
2. In GitHub: Settings → Environments → `npm`, "Deployment branches and tags" → only `v*` tags. "Required
   reviewers" is not available for a private repository on the free plan.
3. In npm, for each package: Settings → Publishing access → "Require two-factor authentication and disallow
   tokens". After that, publishing works only through trusted publishing or by hand with 2FA.
4. Release: update the versions and CHANGELOG, commit, `git tag vX.Y.Z && git push origin vX.Y.Z`.

npm adds provenance (a signed statement of where the package was built) automatically when the repository is
public; a private repository gets none.

## When something goes wrong

- **404 on `npm publish` in GitHub Actions** ("could not be found or you do not have permission"): npm didn't
  accept the run as trusted. A Trusted Publisher is bound to a specific GitHub repository, not just its name:
  after the repository is moved or recreated, the link has to be created again for **every** package (Add
  trusted publisher, the same values). Check the environment (`npm`, no typos) and the "Allow npm publish" box.
  Packages that are already published are skipped on a rerun, so rerunning is safe.

- **409 "Cannot publish over previously staged version" / 403 "cannot publish over the previously published
  versions"** (happened in 0.2.0): the version is already uploaded. npm first keeps it as "staged" (a service
  `0.0.0-stage` in the version list), then publishes it. Don't publish again: check
  `npm view @novaprose/<pkg>@X.Y.Z version` (signed in, you see it right away). Anonymously, a new version, and
  even more so a new package, may return 404 for a few more minutes: registry replicas don't update at once.

- A published version can't be overwritten. Fix mistakes with the next patch version.
- `npm unpublish` works only within the first 72 hours and only if nobody has installed the package as a
  dependency; prefer `npm deprecate @novaprose/<pkg>@X.Y.Z "reason"`.

## Website

Cloudflare Workers Builds builds and publishes the novaprose.com website on every push to `main` (the config is
`wrangler.jsonc` in the repository root, static files from `apps/site/dist`).

| Field in Cloudflare | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| Build command       | `pnpm install --frozen-lockfile && pnpm --filter "@novaprose/site..." build` |
| Deploy command      | `npx wrangler deploy`                                                        |
| Build variable      | `NODE_VERSION` = `24`                                                        |
