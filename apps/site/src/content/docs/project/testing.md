---
title: How NovaProse is tested
description: The checks every change goes through — unit and browser tests, random documents, accessibility, size and speed limits, security scanning — and the speed numbers they hold.
---

Every change to NovaProse runs these checks in CI, and a release runs them again before anything is
published to npm.

| Check            | What it covers                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests       | about 860 tests: the document model, HTML and JSON round trips, commands, plugins, the framework wrappers and the compatibility layer                                                                |
| Browser tests    | about 600 runs in Chromium, Firefox, WebKit and an emulated Android phone: real typing, selection, paste, shortcuts, toolbar layout, two editors editing one document together                       |
| Random documents | generated and hostile documents: the output never contains a way to run a script, HTML survives a round trip, server rendering matches the editor — 300 per property on every change, 20,000 nightly |
| Accessibility    | axe-core (WCAG 2.1 A and AA) on the editor, menus, dialogs and panels, in light and dark themes; text contrast at least 4.5:1                                                                        |
| Size             | the core's first load, ProseMirror included, stays under 145 KB gzip; the CDN files stay under their own limits                                                                                      |
| Speed            | the measurements below, each with a limit                                                                                                                                                            |
| Security         | CodeQL static analysis, dependency updates, CI actions pinned to exact commits, npm packages published from CI with trusted publishing                                                               |

## Speed

Measured on the production CDN build in Chromium, with a 100-page document of about 50,000 words:
headings, formatted paragraphs, links, lists and tables. The numbers come from a developer laptop.
CI runs the same measurements on every change and fails when one goes over its limit, set at about
five times these values.

| Measurement                              |  Time |
| ---------------------------------------- | ----: |
| Open the editor with the document        | 90 ms |
| Typing in the middle — 95% of keystrokes |  5 ms |
| Enter or Backspace — 95% of keystrokes   | 10 ms |
| `getHTML()`                              |  5 ms |
| `setContent()` with the whole document   | 22 ms |
| Paste 300 paragraphs from Word           | 27 ms |
| Underline the whole document             | 95 ms |
| Typing with page layout on — 95%         |  6 ms |
| Typing in suggesting mode — 95%          |  5 ms |
| Typing in a 60-row table — 95%           |  2 ms |

While typing, in any of these documents, no task blocks the page for 50 ms or more. Creating and
destroying the editor 30 times leaves less than 1 MB of memory behind.

To run the measurements yourself: `pnpm build && pnpm perf` in the repository.
