import type { Command, EditorState } from 'prosemirror-state';

/**
 * Languages of passages (WCAG 3.1.2 Language of Parts): a phrase in another language is a
 * `<span lang="…">`, so screen readers read it with that language's voice and browsers check its
 * spelling in that language.
 */

/** A language the `language` button offers: a BCP 47 tag and, if you like, the name to show. */
export interface ContentLanguage {
  /** The BCP 47 tag written to the lang attribute: 'fr', 'pt-BR', 'zh-Hant'. */
  code: string;
  /** The name in the menu. Default: the language's name in the interface language. */
  title?: string;
}

/** The languages offered when `contentLangs` isn't set. */
export const DEFAULT_CONTENT_LANGS = [
  'ar',
  'de',
  'el',
  'en',
  'es',
  'fr',
  'he',
  'hi',
  'it',
  'ja',
  'ko',
  'la',
  'nl',
  'pl',
  'pt',
  'ru',
  'sv',
  'tr',
  'uk',
  'zh',
];

const TAG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/**
 * A valid language tag in its canonical form ('EN-us' → 'en-US'), or null for anything else: an
 * attribute from a pasted page or a JSON document can hold anything.
 */
export function languageTag(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const tag = value.trim();
  if (tag.length > 35 || !TAG.test(tag)) return null;
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? null;
  } catch {
    return null;
  }
}

/** The language without its region or script: 'en' for 'en-GB'. */
export const primaryLanguage = (tag: string): string => tag.split('-')[0]!.toLowerCase();

/** A language's name in the interface language: 'French' in English, 'Französisch' in German. */
export function languageName(code: string, uiLanguage = 'en'): string {
  try {
    return new Intl.DisplayNames([uiLanguage, 'en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The menu's languages: the configured ones in their order, the default ones by name. */
export function contentLanguages(
  configured: readonly ContentLanguage[] | undefined,
  uiLanguage = 'en',
): { code: string; title: string }[] {
  const list: readonly ContentLanguage[] =
    configured ?? DEFAULT_CONTENT_LANGS.map((code) => ({ code }));
  const out: { code: string; title: string }[] = [];
  for (const entry of list) {
    const code = languageTag(entry?.code);
    if (!code || out.some((o) => o.code === code)) continue;
    const title =
      typeof entry.title === 'string' && entry.title.trim()
        ? entry.title.trim()
        : languageName(code, uiLanguage);
    out.push({ code, title });
  }
  if (!configured) out.sort((a, b) => a.title.localeCompare(b.title, uiLanguage));
  return out;
}

/** The language of the text at the start of the selection (null: none marked). */
export function getTextLanguage(state: EditorState): string | null {
  const type = state.schema.marks.language;
  if (!type) return null;
  const { $from, empty } = state.selection;
  const marks = empty
    ? (state.storedMarks ?? $from.marks())
    : ($from.nodeAfter?.marks ?? $from.marks());
  return languageTag(type.isInSet(marks)?.attrs.lang);
}

/**
 * Marks the selected text as written in `lang`, or removes its language (null). With nothing
 * selected, what is typed next gets it.
 */
export function setTextLanguage(lang: string | null): Command {
  return (state, dispatch) => {
    const type = state.schema.marks.language;
    const tag = lang === null ? null : languageTag(lang);
    if (!type || (lang !== null && !tag)) return false;
    const { selection } = state;
    // Code blocks and other places without marks can't take a language.
    let applies = false;
    if (selection.empty) applies = selection.$from.parent.type.allowsMarkType(type);
    else
      for (const { $from, $to } of selection.ranges)
        state.doc.nodesBetween($from.pos, $to.pos, (node, _pos, parent) => {
          if (applies) return false;
          if (node.isInline && parent?.type.allowsMarkType(type)) applies = true;
          return true;
        });
    if (!applies) return false;
    if (!dispatch) return true;
    const tr = state.tr;
    if (selection.empty) {
      tr.removeStoredMark(type);
      if (tag) tr.addStoredMark(type.create({ lang: tag }));
    } else {
      for (const { $from, $to } of selection.ranges) {
        tr.removeMark($from.pos, $to.pos, type);
        if (tag) tr.addMark($from.pos, $to.pos, type.create({ lang: tag }));
      }
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}
