---
title: Localization
description: Change the UI language, override individual strings or add your own language.
---

The UI ships in English (default) and Russian.

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
