# Contributing to NovaProse

Thanks for your interest! Bug reports, ideas and pull requests are welcome.

## Getting started

Requires Node.js 22.13+ and pnpm 9.

```bash
pnpm install
pnpm dev     # playground on http://localhost:5173
pnpm check   # format, lint, types, unit tests — run before every commit
pnpm e2e     # browser tests (Chromium, Firefox, WebKit, mobile Chrome)
```

The playground has pages for each package (`/react.html`, `/vue.html`, `/angular.html`,
`/element.html`, `/collab.html`, `/tinymce.html`).

## Pull requests

- A bug fix starts with a failing test; a new feature comes with tests.
- Selection, IME, paste, toolbar layout and mobile behaviour can't be tested in jsdom — add a
  Playwright test in `e2e/`.
- Visual changes: check the light and dark themes and a narrow screen.
- Keep `pnpm check` and `pnpm e2e` green.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) in English.

## Ground rules

- **Clean room.** Do not read, copy or adapt source code, icons, skins or documentation text from
  TinyMCE or other GPL-licensed editors. Compatibility (`@novaprose/tinymce-compat`) is implemented
  from public API documentation only — describe behaviour, don't port code.
- **Security by default.** Every URL from content is checked on input and output; never put user
  data into `innerHTML`.
- **Public API is the `Editor` class.** Framework packages use only `Editor`, never ProseMirror
  directly. Renaming a command is a breaking change.
- **Size budget.** The core stays under 150 KB gzip; heavy optional features ship as lazy plugins.

## Security issues

Please don't open public issues for vulnerabilities — see [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
