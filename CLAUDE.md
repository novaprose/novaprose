# NovaProse: project rules

An embeddable WYSIWYG editor on ProseMirror with a cloud platform. An independent open-source project.

**Positioning:** we sell our own strengths (MIT, collaboration out of the box, quality), not "a TinyMCE
replacement". TinyMCE is the reference for feature parity (internal documents) and a source of migrations; in
public texts it is mentioned only when describing compatibility and migration, with no price or plan comparisons.
Internal documents (PRD, roadmap, decisions, parity tracker, launch texts) live in a **private** repository,
locally in the sibling folder `../nova-internal/docs/` (PRD.md, ROADMAP.md, DECISIONS.md, PARITY.md, launch/).
Don't copy them into this public repository; parity is recomputed there: `node scripts/parity.mjs`.

**Language.** Talk to the project owner in Russian. Everything in this repository is English: code comments,
tests, documentation, scripts, commit messages, the website. The market is not Russia. The only Cyrillic allowed
is data: the Russian translation pack (`packages/core/src/i18n/packs/ru.ts`) and test inputs that check
non-Latin text. `node scripts/check-english.mjs` (part of `pnpm check`) fails on Cyrillic anywhere else; its
allowlist is at the top of the script. JSDoc of the public API (everything that reaches the packages' .d.ts) is
also checked by scripts/check-packages.mjs in verify:release.

## Clean room: mandatory

- **Don't read, open or copy TinyMCE source code** (GPL2+), its icons, skins or documentation texts. This applies
  to agents too: don't look for TinyMCE code on GitHub, don't peek at how its plugins are implemented.
- Compatibility (plugin names, `tinymce.init()` options, events) is built **only from the public API
  documentation** on tiny.cloud/docs: descriptions of behavior, not code.
- Brand, icons and product names are our own. The words "Tiny" and "TinyMCE" appear only when describing
  compatibility.
- ProseMirror code (MIT) may be read and used.

## Layout

```
packages/core/src
  editor.ts         the Editor class: the only public API
  schema.ts         document schema + CSS value validation (cssValue)
  serializer.ts     string HTML serializer (getHTML): deterministic, no DOM
  document.ts       shared schema assembly (schemaFromOptions) for the editor and the server; createRenderer/
                    renderHTML: HTML from JSON without a DOM (the same as getHTML; a property test checks equality)
  commands.ts       named commands (CommandName); chain.ts: editor.chain(), several steps in one change
  node-view.ts      defineNodeView: node views from your own renderer (React/Vue adapters live in their packages)
  docx/             Word without third-party libraries and without a DOM (entry @novaprose/core/docx): zip.ts
                    (CompressionStream), xml.ts, export.ts, import.ts; buttons are the exportword/importword
                    plugins. Export is verified in Microsoft Word; test/fixtures/docx/saved-by-word.docx is a file
                    saved by Word itself
  ui/print.ts       printing "as on screen" (lazy): a copy of the text + page styles; the sheet comes from
                    plugins/pagelayout
  plugins/ai.ts     AI assistant: the model belongs to the customer (pluginOptions.ai.request → their server),
                    the answer arrives as suggestions (the suggestions plugin); ai-edit.ts: word diff and
                    insertion at the cursor
  styles.ts, link.ts, image.ts: commands for styles, links, images (+ their dialogs)
  html-rules.ts     separate entry @novaprose/core/html-rules: attributes in validElements,
                    extendedValidElements, customElements; the core has only html-rules-api.ts
                    (registerHtmlRules); safe-attr.ts: the shared attribute check on output
  i18n/             UI strings: en (the reference set of keys), packs/ (ru, de, es, fr, it, pt-BR)
  ui/               UI layer: manager (editor.ui), registry, toolbar, menu, popover, dialog, tooltip,
                    notification, statusbar, link-bubble, color-panel, builtins (built-in buttons)
  style.css         skin and the --nova-* design tokens
packages/react      @novaprose/react: the <NovaProseEditor> component + useEditor/useEditorState/useCommand
                    hooks; reactNodeView: node views through portals (the app context is available)
packages/vue        @novaprose/vue: component with v-model + composables (same names); vueNodeView via Teleport
packages/web-component  <novaprose-editor>: a form-associated element + CDN build (dist/novaprose.global.js)
packages/angular    @novaprose/angular: standalone component + ControlValueAccessor; built with ng-packagr,
                    its own TypeScript 6 (Angular 22 requires it), tests run JIT in vitest
packages/tinymce-compat  @novaprose/tinymce-compat: tinymce.init() on top of Editor (+ a CDN drop-in for
                    tinymce.min.js)
packages/collab     @novaprose/collab: real-time collaboration (Yjs, y-prosemirror, Hocuspocus client)
apps/sync-server    sync server: Hocuspocus + node:sqlite + JWT from your backend, Dockerfile
apps/playground     Vite playground (from sources). ?lang=en|ru, ?upload=slow|fail simulates uploads;
                    react.html, vue.html, element.html, angular.html: wrapper playgrounds; collab.html: two
                    editors in one room (e2e/*.spec.ts drive them; Playwright starts the sync server itself)
apps/site           the novaprose.com website (Astro + Starlight, English). Framework pages and the changelog
                    are generated from README/CHANGELOG: edit the source and run sync-docs
e2e/                Playwright: Chromium, Firefox, WebKit, mobile Chrome
screen-reader/      NVDA reads the playground (guidepup, Windows runner): what is said after Ctrl+B, "- ",
                    Alt+0, Ctrl+K... Each test writes what NVDA said to spoken.txt; the workflow prints them
                    as notices on the run, readable without a screen reader
perf/               speed measurements (pnpm perf) on the CDN build in Chromium: 100 pages, typing, paste,
                    leaks; limits are ~5× a developer machine. Keystroke time is keydown→keyup: Chrome defers
                    timers while keys stream in (measuring with setTimeout gave "500 ms")
examples/           examples for StackBlitz (react, vue, cdn, server-render): outside the workspace, on the npm
                    version; they are also clean projects for checking the archives: pnpm verify:examples
                    (CI and release)
docs/               RELEASING.md: how releases are made (public)
test/setup.ts       jsdom stubs for unit tests
```

## Knowledge graph (graphify)

A local graph of the project: `graphify-out/` (in .gitignore). `GRAPH_REPORT.md`: central nodes, 157
communities, bridges; `graph.html`: an interactive map. Before reading many files, ask the graph:
`python -m graphify query "<question>"`, `python -m graphify explain "<node>"`, `python -m graphify path "A" "B"`.
After large changes: `/graphify . --update` (code is free via AST; documents go through subagents).
"calls"/"indirect_call" edges from the AST can be false (`import type` counts as a call): verify in the code.
Community names: `graphify-out/labels.py`.

## Commands

```bash
pnpm install        # dependencies
pnpm dev            # playground at http://localhost:5173
pnpm test           # unit tests (vitest + jsdom)
pnpm typecheck      # tsc across all packages
pnpm lint           # eslint
pnpm format         # prettier
pnpm build          # build the packages (tsup → dist/)
pnpm e2e            # Playwright browser tests (the playground starts by itself)
pnpm sr             # NVDA tests: Windows only, NVDA takes over the keyboard and speaks (CI: screen-reader.yml;
                    # locally first npx --ignore-scripts @guidepup/setup install nvda)
pnpm check          # format, lint, types, unit tests, English-only check: before a commit (the pre-push hook runs it)
pnpm test:coverage  # unit tests + coverage; thresholds (a ratchet) in vitest.config.ts: raise them as coverage grows
pnpm test:deep [N]  # property-based tests on N random documents (5000 by default; 20 000 nightly in CI)
pnpm size           # gzip size budget (needs a build); fails when exceeded
pnpm perf           # speed measurements with limits (needs a build); the table is in the output and the CI summary
pnpm check:packages # publint + ESM/CJS types in the .release/ archives (needs release:pack)
pnpm verify:release # build + archives + size + check:packages: the same as CI and the release
pnpm verify:examples # examples from the .release/ archives: Vite build, run in Chromium, Node (--strict on release)
```

CI (`.github/workflows`): ci.yml: check with coverage, build/size/packages/speed, e2e in all browsers + a11y;
nightly.yml: deep property tests; codeql.yml: static security analysis; dependabot.yml: dependency updates;
screen-reader.yml: NVDA on a Windows runner (main and `night/**` pushes).
Actions are pinned to a commit SHA (version in a comment): add new ones the same way.
Git hooks (simple-git-hooks, installed by `pnpm install`): pre-push runs `pnpm check`, commit-msg enforces
Conventional Commits.

## Architecture rules

- **The public API is only the `Editor` class** (`packages/core/src/editor.ts`). Framework wrappers never touch
  ProseMirror directly, only `Editor`: `getHTML/setContent/exec/can/on/destroy`.
- **The schema is the source of truth for HTML.** Every new node/mark must have `parseDOM` and `toDOM`, and an
  "HTML round trip without changes" test in `packages/core/test`.
- **Secure by default.** Every URL from content goes through `isSafeLinkUrl` / `isSafeImageUrl` both when parsing
  and on output (a document can arrive as JSON). No `innerHTML` with user data in the UI.
- **External JSON can be anything.** Attributes from JSON may be null, a number, garbage: `toDOM`, `getFromDOM`
  and the UI must not crash (coerce types instead of trusting them). Add every new node/mark to the generators in
  `security.property.test.ts` and `json-robustness.test.ts`.
- **Named commands** (`CommandName` in `commands.ts`) are part of the public API: renaming one is a breaking
  change.
- **Size budget:** the core is ≤ 145 KB gzip on first load, ProseMirror included (November 2026: 143.3 KB;
  style.css 9.6 of 12 KB; lazy chunks counted separately). `pnpm size` checks it in CI. The first load is counted
  as ONE compressed file, the way an app build serves it (verified with Vite: 135.2 KB); the sum of separately
  compressed esbuild chunks (142.5) is printed for reference: it grows with chunk splitting, not with code. A new
  heavy dependency only as a separate lazily loaded plugin. A plugin with nodes keeps in the first load its schema
  AND EVERYTHING THAT DRAWS the document (NodeViews and their styles: nodeViews appearing lazily redraw the whole
  document, the "raw" look flashes, video iframes reload); behavior and interface (buttons, dialogs, commands,
  keys, autocomplete) go to `load: () => import('./<name>-ui')` (examples: accordion, media, mergetags). Labels
  of that part live in `<name>-ui.ts` under `<name>.*` keys (scripts/i18n.mjs knows about the -ui suffix); its
  buttons appear after `editor.ready`. comments is not split: getComments(editor) is needed right away. Example of
  a lazy dependency: codesample, where highlight.js and each grammar load when code in that language appears in
  the document. A lazy `import()` of a package from node_modules must be added to `optimizeDeps.include` of the
  playground (apps/playground/vite.config.ts): otherwise Vite discovers it on first use and reloads every open
  page, and e2e tests fail midway. The CDN build writes third-party licenses into `dist/<name>.licenses.txt` by
  itself. Everything the main entry exports stays in the first load whatever uses it (the dist chunks are
  marked `sideEffects`), so moving an exported function to another module saves nothing: only internal parts
  that aren't needed at startup can go. Already lazy that way: the find and replace bar (ui/search-bar.ts,
  loaded with `editor.ready`, so Ctrl+F never races typing), the table and cell properties dialogs
  (ui/table-dialogs.ts, on first open), reading Word's RTF images on paste (in the paste cleanup chunk). Measure
  a candidate before moving it: build the first load from src with esbuild and stub the module (the three above:
  −1.7 KB measured from src and in the CDN main files, −0.8 KB in `pnpm size`, which counts every chunk the npm
  entry imports). Plugin icons only lazy parts use (~31 icons, 1.3 KB) can only leave the first load
  by leaving the public `icons` export: a breaking change, for a release. The windowManager.open dialogs of the
  compatibility layer are already lazy (dialog.ts, loaded in the background on creation). Table mechanics (prosemirror-tables) are already lazy: tables.ts holds
  command stand-ins, table.ts is the chunk; loading it calls `state.reconfigure`, and ProseMirror then recreates
  the views of ALL plugins. So rebuilding goes only through `reconfigurePlugins` (plugin-views.ts): views are
  kept, not recreated. A synchronous hook can't be made lazy directly; the pattern is paste.ts (background
  loading + `editor.ready` + intercepting the event while the chunk isn't ready).
- **Package subpaths** (`@novaprose/core/i18n/*`, `/html-rules`, `/markdown`, `/docx`, `/a11y`): CI checks types BEFORE the build,
  without `dist`, so every package that imports them needs a path in the `paths` of its tsconfig (pointing to the
  source). Locally `dist` exists and the error is invisible: check with `pnpm -r --no-bail typecheck` without the
  dist folders. After a push, watch CI.
- **SSR:** no access to `window`/`document` at module level.
- **Shadow DOM:** focus only through `activeElement(node)`, document events only through
  `listenDocument(node, …)` from `ui/dom.ts` (inside a shadow root document.activeElement is the host and the
  event target is retargeted). ESLint watches this; e2e/shadow.spec.ts checks it (the shadow.html playground,
  `?mode=closed`).
- **UI strings only through `editor.ui.t(key)`.** A new key goes into `i18n/en.ts` (only English is built in),
  translations into `i18n/packs/*.ts`. In a plugin: `export const LABELS = { en: {...} }` (en only!) +
  `pickLabels(editor, '<plugin name>', LABELS)`: the strings go through the same system (keys
  `<plugin>.<key>`); `test/i18n.test.ts` checks that languages are complete. A new string → add it to ALL packs in
  `src/i18n/packs/*.ts` (otherwise `node scripts/i18n.mjs check` in `pnpm check` fails). Russian (`packs/ru.ts`) is
  complete; de/es/fr/it/pt-BR are drafts (translated by Claude), with the status "draft" until a native speaker
  reviews them. The CDN builds embed no language: cdn.ts registers ALL packs as loaders
  (`registerLanguage(code, () => import(…))`; a new pack goes there too, a test checks it); the element and
  tinymce.init wait for `loadLanguage` themselves; before `NovaProse.createEditor`, `await loadLanguage`. CDN
  builds are a main file + lazy parts next to it (scripts/build-cdn.mjs): web component 146.6 KB of 150,
  compatibility 157.7 KB of 160 (November 2026).
- **Optional functionality is a plugin** in `src/plugins/` (`definePlugin`, lazy registration in
  `src/plugins/index.ts`). The core holds only what an editor can't be an editor without.
- **New buttons go through `editor.ui.registry`** (like a plugin); names follow the public TinyMCE documentation.
- **Build UI with `h()` from `ui/dom.ts`**, without innerHTML (the exception is our own SVG icons).
- **Accessibility is mandatory:** ARIA roles, keyboard (arrows, Esc, Tab), visible focus, aria-label on icons.
  Text contrast ≥ 4.5:1 on every surface (hover/pressed included): text uses `--nova-muted`, not
  `--nova-subtle`; a fill with white text uses `--nova-accent-strong`. A new dialog/menu → add its state to
  `e2e/a11y.spec.ts` (axe). Screen readers: an inline mark whose element Chromium exposes as an object of
  its own (strong, em, s, code, sub, sup) gets `role="none"` in the editing view (`mark-views.ts`),
  otherwise NVDA reads the next word as "unselected" after its shortcut; a new shortcut or announcement →
  a check in `screen-reader/nvda.spec.ts` (runs on a Windows runner, see what NVDA said in the run's notices).
- Every UI color comes from the `--nova-*` CSS variables in `style.css`; the light and dark themes must both work.
- **Styles of lazy parts** (panels, dialogs, plugin views) don't go into `style.css` (12 KB budget) but into
  `<module>.css` next to the code: `import css from './x.css?raw'` + `editor.ui.addStyles('nova-x', css)` on first
  use. Types for `?raw`: `src/raw-css.d.ts` (included by every package); the build: scripts/esbuild-raw-css.mjs.
  Class names must not collide with the classes of `style.css` (otherwise the file attached later overrides them).

## Priorities

P0 is for the MVP, P1 for GA, P2 after GA (see the PRD in ../nova-internal). Don't take on P1/P2 while the P0 of
the current stage is open. Before a large feature, check ROADMAP.md (../nova-internal) to stay focused.

## Quality

- New functionality = tests. A bug = a failing test first, then the fix.
- `pnpm check` must be green before a commit.
- jsdom doesn't compute layout: selection, IME, paste, toolbar layout, mobile are covered by e2e in `e2e/`.
  e2e tests must not depend on the layout: press controls through the `clickControl` helper (it knows about "⋯").
- Visual UI changes: check with screenshots in the light and dark themes and on a narrow screen.
- `pnpm check` and `pnpm e2e` are green before a commit.
- Property-based tests (fast-check) found 6 real defects: when one fails, take the minimal example from the
  output, turn it into a regular regression test, then fix.
- Windows: vitest normalizes the drive letter case in vitest.config.ts, otherwise React/ProseMirror load twice
  from Git Bash.
- Open question: Shift+Enter in Android emulation (Pixel 7) gives spaces instead of a line break; check on a
  device.
- A first click into an unfocused editor away from the text (right of the last line, below it) used to become a
  cursor at the start of the document on focus in Chromium, WebKit and Firefox after setContent. Fixed by
  first-click.ts (the cursor follows ProseMirror's posAtCoords when the browser put it into another block); e2e in
  editor.spec.ts. The condition is subtle: a click to the right of a line that is NOT the last one never showed
  the bug.
