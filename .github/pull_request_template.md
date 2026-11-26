## What and why

<!-- What does this change, and what problem does it solve? Link the issue: Fixes #123 -->

## Checklist

- [ ] Bug fix: starts with a test that fails without the fix
- [ ] New behaviour is covered by unit tests (`packages/*/test`) or e2e (`e2e/`)
- [ ] Selection / paste / IME / layout / mobile changes have a Playwright test
- [ ] UI changes checked in light and dark theme and on a narrow screen
- [ ] New UI strings go through `editor.ui.t()` (keys in `i18n/en.ts` and `i18n/ru.ts`)
- [ ] Public API change is noted in `CHANGELOG.md`
- [ ] `pnpm check` and `pnpm e2e` pass locally
