---
title: Localization
description: Change the UI language, override individual strings or add your own language.
---

The UI ships in English (default) and Russian; German, Spanish, French, Italian and Portuguese are
available as [language packs](#ready-made-language-packs).

```ts
createEditor({ element, language: 'ru' });
```

Language codes follow BCP 47 with fallback: `ru-RU` uses `ru`, and an unknown language falls back
to English.

## Override some strings

```ts
createEditor({
  element,
  translations: { bold: 'Strong', 'editor.label': 'Article body' },
});
```

## Ready-made language packs

Each pack covers the whole interface — core and every built-in plugin (289 strings) — and is a
separate import of about 4 KB gzip, so you only download the languages you use.

| Language            | Import                       | Status                       |
| ------------------- | ---------------------------- | ---------------------------- |
| English             | built in                     | reference                    |
| Russian             | built in (`language: 'ru'`)  | complete, used in production |
| German              | `@novaprose/core/i18n/de`    | draft, native review needed  |
| Spanish             | `@novaprose/core/i18n/es`    | draft, native review needed  |
| French              | `@novaprose/core/i18n/fr`    | draft, native review needed  |
| Italian             | `@novaprose/core/i18n/it`    | draft, native review needed  |
| Portuguese (Brazil) | `@novaprose/core/i18n/pt-BR` | draft, native review needed  |

```ts
import { createEditor, registerLanguage } from '@novaprose/core';
import de from '@novaprose/core/i18n/de';

registerLanguage('de', de);
createEditor({ element, language: 'de' });
```

Found a wording that a native speaker wouldn't use? Corrections are very welcome — every pack is a
single file in `packages/core/src/i18n/packs/`, and `node scripts/i18n.mjs check` verifies that no
string or `{placeholder}` is missing.

## Add a language

Register a language once, before creating editors. Missing keys fall back to English, so you can
translate gradually.

```ts
import { registerLanguage } from '@novaprose/core';

registerLanguage('de', {
  undo: 'Rückgängig',
  redo: 'Wiederholen',
  bold: 'Fett',
  italic: 'Kursiv',
  // …
});

createEditor({ element, language: 'de' });
```

## Plugin strings

Plugins (comments, merge tags, media, special characters…) use the same system. Their keys are
prefixed with the plugin name — `comments.reply`, `anchor.title` — and work both in
`registerLanguage` and in `translations`:

```ts
registerLanguage('de', {
  bold: 'Fett',
  'anchor.title': 'Anker',
  'comments.reply': 'Antworten',
  'charmap.groups.0': 'Häufig verwendet', // lists are numbered: groups.0, groups.1…
});
```

To see every key a plugin uses, load it and call `getPluginMessages()`: it returns the strings of
all loaded plugins by language, English included — a ready template for a translator.

Content is never translated; `language` only affects the editor interface.
