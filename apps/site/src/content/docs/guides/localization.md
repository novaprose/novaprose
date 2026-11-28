---
title: Localization
description: Change the UI language, override individual strings or add your own language.
---

The UI ships in English. Other languages are [language packs](#ready-made-language-packs) — a
separate import each, so an English-only site never downloads them:

```ts
import { createEditor, registerLanguage } from '@novaprose/core';
import ru from '@novaprose/core/i18n/ru';

registerLanguage('ru', ru);
createEditor({ element, language: 'ru' });
```

If `language` names a language that isn't registered, the editor uses English and logs a hint
with the import to add.

Language codes follow BCP 47 with fallback: `ru-RU` uses `ru`, and an unknown language falls back
to English.

## Load a language only when it's needed

Register a function that loads the pack instead of the pack itself, and load it before creating
the editor. Your bundler then puts each pack in its own file, downloaded only by the people who use
that language:

```ts
import { createEditor, loadLanguage, registerLanguage } from '@novaprose/core';

registerLanguage('de', () => import('@novaprose/core/i18n/de'));
registerLanguage('fr', () => import('@novaprose/core/i18n/fr'));

await loadLanguage(userLanguage); // false when there is no such pack: the editor uses English
createEditor({ element, language: userLanguage });
```

The strings are taken when the editor is created, so load first. `hasLanguage(code)` tells whether
a language is ready.

### In the CDN builds

The CDN builds (`novaprose.global.js`, `tinymce.global.js`) register every ready-made pack this
way, as separate files next to the script. `<novaprose-editor language="de">` and
`tinymce.init({ language: 'de' })` load the pack themselves before the editor appears; with
`NovaProse.createEditor`, load it first:

```js
await NovaProse.loadLanguage('de');
NovaProse.createEditor({ element, language: 'de' });
```

## Override some strings

```ts
createEditor({
  element,
  translations: { bold: 'Strong', 'editor.label': 'Article body' },
});
```

## Ready-made language packs

Each pack covers the whole interface — core and every built-in plugin (353 strings) — and is a
separate import of about 5 KB gzip, so you only download the languages you use.

| Language            | Import                       | Status                       |
| ------------------- | ---------------------------- | ---------------------------- |
| English             | built in                     | reference                    |
| Russian             | `@novaprose/core/i18n/ru`    | complete, used in production |
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

## Right-to-left languages

Arabic, Hebrew, Persian and Urdu switch the editor to right-to-left automatically. You can also set
the direction yourself:

```ts
createEditor({ element, language: 'he' }); // right-to-left
createEditor({ element, direction: 'rtl' }); // any language
```

Without either, the editor follows the page (`<html dir="rtl">`). In right-to-left mode the whole
interface is mirrored: the toolbar starts on the right, menus open aligned to the right edge of their
button, arrow keys move focus in the visible order, the resize handle is in the bottom-left corner,
and undo, redo, indent and list icons are flipped. Text, list bullets and quote bars are on the right,
and indentation is written as `margin-right`. A single paragraph can still be switched with the
`ltr` / `rtl` buttons of the `directionality` plugin. `editor.direction` tells you which one is
active.

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

## Languages in the text

The interface and the text can be in different languages. The interface says its own language to
screen readers, and the text keeps the page's. When the text is in another language than the page,
say so with `contentLanguage`: screen readers read the text with that language's voice and browsers
check its spelling in it.

```ts
createEditor({ element, language: 'de', contentLanguage: 'en' }); // German interface, English text
```

A phrase in another language can be marked as such, so screen readers switch voices for it
(WCAG 3.1.2, Language of Parts). The `language` button (and **Language…** in the **Format** menu)
marks the selected words; **Default language** takes the mark off. In the HTML it is a
`<span lang="…">`:

```html
<p>The French call it <span lang="fr">joie de vivre</span>.</p>
```

```ts
createEditor({
  element,
  toolbar: 'undo redo | bold italic | language | link',
  // Optional: the languages to offer. Without a title, the language's name is shown in the
  // interface language ("French", "Französisch"). The default list has 20 common languages.
  contentLangs: [{ code: 'en' }, { code: 'fr' }, { code: 'de', title: 'Deutsch' }],
});
```

Language codes are BCP 47 (`fr`, `pt-BR`, `zh-Hant`); a broken one is dropped, never written to the
HTML. `editor.exec(setTextLanguage('fr'))` does the same from code, and `getTextLanguage(state)`
tells the language at the cursor.

Content keeps its languages: `lang` on any element is read (`<p lang="es">` becomes a paragraph
whose text is marked Spanish). When you paste, the language the text is already in is left out, so
only real passages in another language stay marked; Word marks every run with a language, and its
document language is left out the same way. A Word export keeps a passage's language.
