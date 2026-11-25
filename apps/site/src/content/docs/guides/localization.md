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

Content is never translated; `language` only affects the editor interface.
