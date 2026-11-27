/**
 * Typography rules over a block's text: typographic quotes of the language, dashes, an ellipsis,
 * symbols, arrows, math signs, fractions, spaces and non-breaking spaces. Each rule finds edits in
 * a text; nothing here knows the editor. Addresses, email addresses and `code` are left alone.
 */

export type TypographyRule =
  | 'quotes'
  | 'dashes'
  | 'ellipsis'
  | 'symbols'
  | 'arrows'
  | 'math'
  | 'fractions'
  | 'spaces'
  | 'nbsp';

/** In the order they run: quotes before spaces (a quote's side depends on the spaces around it). */
export const TYPOGRAPHY_RULES: readonly TypographyRule[] = [
  'quotes',
  'dashes',
  'ellipsis',
  'symbols',
  'arrows',
  'math',
  'fractions',
  'spaces',
  'nbsp',
];

/** A change of the text: `length` characters at `index` become `insert`. */
export interface Edit {
  index: number;
  length: number;
  insert: string;
}

interface Language {
  /** Primary opening, primary closing, nested opening, nested closing. */
  quotes: readonly [string, string, string, string];
  /** A dash between words: what " - " becomes. */
  dash: string;
  /** A dash that starts a line of dialogue: what "- " at the start becomes, or null. */
  dialogue: string | null;
  /** A non-breaking space after one- and two-letter words (prepositions), as Slavic typography asks. */
  shortWords: boolean;
  /** French spacing: a narrow non-breaking space before ; ! ? and a non-breaking one before :. */
  french: boolean;
}

const NBSP = '\u00a0';
const NNBSP = '\u202f';
const EN_QUOTES = ['“', '”', '‘', '’'] as const;
const GUILLEMETS_LOW = ['«', '»', '„', '“'] as const;
const LOW_HIGH = ['„', '“', '‚', '‘'] as const;
const SPACED_EN = ' – ';
const SPACED_EM = `${NBSP}— `;

const base: Language = {
  quotes: EN_QUOTES,
  dash: SPACED_EN,
  dialogue: null,
  shortWords: false,
  french: false,
};

/** Languages whose conventions are built in; others use their base language, or English. */
export const TYPOGRAPHY_LANGUAGES: Record<string, Language> = {
  en: { ...base, dash: '—' },
  'en-gb': { ...base, quotes: ['‘', '’', '“', '”'] },
  ru: { ...base, quotes: GUILLEMETS_LOW, dash: SPACED_EM, dialogue: `—${NBSP}`, shortWords: true },
  uk: { ...base, quotes: GUILLEMETS_LOW, dash: SPACED_EM, dialogue: `—${NBSP}`, shortWords: true },
  be: { ...base, quotes: GUILLEMETS_LOW, dash: SPACED_EM, dialogue: `—${NBSP}`, shortWords: true },
  de: { ...base, quotes: LOW_HIGH },
  cs: { ...base, quotes: LOW_HIGH, shortWords: true },
  sk: { ...base, quotes: LOW_HIGH, shortWords: true },
  pl: { ...base, quotes: ['„', '”', '«', '»'], shortWords: true },
  fr: { ...base, quotes: [`«${NBSP}`, `${NBSP}»`, '“', '”'], french: true },
  es: { ...base, quotes: ['«', '»', '“', '”'], dialogue: '—' },
  it: { ...base, quotes: ['«', '»', '“', '”'] },
  pt: { ...base, quotes: ['«', '»', '“', '”'] },
  'pt-br': { ...base, quotes: EN_QUOTES },
  ca: { ...base, quotes: ['«', '»', '“', '”'] },
  nl: { ...base, quotes: EN_QUOTES },
  sv: { ...base, quotes: ['”', '”', '’', '’'] },
  fi: { ...base, quotes: ['”', '”', '’', '’'] },
  da: { ...base, quotes: ['»', '«', '›', '‹'] },
  no: { ...base, quotes: ['«', '»', '‘', '’'] },
  hu: { ...base, quotes: ['„', '”', '»', '«'] },
  ro: { ...base, quotes: ['„', '”', '«', '»'] },
  tr: { ...base, quotes: EN_QUOTES },
  el: { ...base, quotes: ['«', '»', '“', '”'] },
};

/** The conventions of a language code ('en-US', 'de_AT', 'pt-BR'). */
export function typographyLanguage(code: string | null | undefined): Language {
  const key = String(code ?? '')
    .toLowerCase()
    .replace(/_/g, '-');
  return (
    TYPOGRAPHY_LANGUAGES[key] ??
    TYPOGRAPHY_LANGUAGES[key.split('-')[0]!] ??
    TYPOGRAPHY_LANGUAGES.en!
  );
}

/** Edits from every match of a pattern (the replacement may be a function of the match). */
function replaceAll(
  text: string,
  pattern: RegExp,
  insert: string | ((match: RegExpExecArray) => string | null),
): Edit[] {
  const edits: Edit[] = [];
  for (const match of text.matchAll(pattern)) {
    const value = typeof insert === 'string' ? insert : insert(match as RegExpExecArray);
    if (value !== null && value !== match[0])
      edits.push({ index: match.index!, length: match[0].length, insert: value });
  }
  return edits;
}

const OPENS_BEFORE = /[\s([{«„“‘‚—–\-\u00a0\u202f]/u;

function quotes(text: string, lang: Language): Edit[] {
  const [open1, close1, open2, close2] = lang.quotes;
  const edits: Edit[] = [];
  let doubles = 0;
  let singles = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '"' && ch !== "'") continue;
    const prev = text[i - 1] ?? '';
    const next = text[i + 1] ?? '';
    const opening = (!prev || OPENS_BEFORE.test(prev)) && !!next && !/\s/u.test(next);
    if (ch === '"') {
      if (opening) {
        doubles++;
        edits.push({ index: i, length: 1, insert: doubles % 2 ? open1 : open2 });
      } else if (doubles > 0) {
        edits.push({ index: i, length: 1, insert: doubles % 2 ? close1 : close2 });
        doubles--;
      } else if (!/\d/u.test(prev)) {
        // A closing quote without an opening one, but not inches or seconds after a number (5").
        edits.push({ index: i, length: 1, insert: close1 });
      }
      continue;
    }
    // A single quote: an apostrophe inside a word (don't, l'heure), otherwise a nested quote.
    if (/\p{L}/u.test(prev) && /\p{L}/u.test(next)) {
      edits.push({ index: i, length: 1, insert: '’' });
    } else if (opening) {
      singles++;
      edits.push({ index: i, length: 1, insert: open2 });
    } else if (singles > 0) {
      singles--;
      edits.push({ index: i, length: 1, insert: close2 });
    } else if (prev && !/\d/u.test(prev)) {
      // The end of a word (dogs'): an apostrophe.
      edits.push({ index: i, length: 1, insert: '’' });
    }
  }
  return edits;
}

function dashes(text: string, lang: Language): Edit[] {
  const edits = replaceAll(
    text,
    /(?<=[\p{L}\p{N}.,;:!?»”“’)"'])[ \u00a0]+-{1,2}[ \u00a0]+(?=\S)/gu,
    lang.dash,
  );
  // Two hyphens between words, without spaces.
  edits.push(...replaceAll(text, /(?<=\p{L})--(?=\p{L})/gu, lang.dash === '—' ? '—' : lang.dash));
  // A line of dialogue.
  if (lang.dialogue) edits.push(...replaceAll(text, /^-[ \u00a0]+(?=\S)/gu, lang.dialogue));
  return edits;
}

const ellipsis = (text: string) => replaceAll(text, /(?<!\.)\.{3}(?!\.)/g, '…');

function symbols(text: string): Edit[] {
  return [
    // (c) before a year: not the third item of a list "(a) (b) (c)".
    ...replaceAll(text, /\([cC]\)(?=\s?\d)/g, '©'),
    ...replaceAll(text, /(?<=\p{L})\s?\((?:r|R)\)/gu, '®'),
    ...replaceAll(text, /(?<=\p{L})\s?\((?:tm|TM)\)/gu, '™'),
  ];
}

function arrows(text: string): Edit[] {
  const edits: Edit[] = [];
  const pattern = /<=>|<->|->|<-(?!\d)|=>/g;
  const signs: Record<string, string> = { '<=>': '⇔', '<->': '↔', '->': '→', '<-': '←', '=>': '⇒' };
  for (const match of text.matchAll(pattern))
    edits.push({ index: match.index!, length: match[0].length, insert: signs[match[0]]! });
  return edits;
}

function math(text: string): Edit[] {
  return [
    ...replaceAll(text, /(?<![<=!>-])(<=|>=|!=)(?![=>])/g, (m) =>
      m[0] === '<=' ? '≤' : m[0] === '>=' ? '≥' : '≠',
    ),
    ...replaceAll(text, /\+-(?=\s?\d)/g, '±'),
    // 10x20, 10 x 20 (not 0x1F, a hexadecimal number).
    ...replaceAll(
      text,
      /(?<=(?<![\w.])[1-9]\d*|\d\s)(\s?)[x\u0445](\s?)(?=\d)/gu,
      (m) => `${m[1]}×${m[2]}`,
    ),
  ];
}

const FRACTIONS: Record<string, string> = {
  '1/2': '½',
  '1/4': '¼',
  '3/4': '¾',
  '1/3': '⅓',
  '2/3': '⅔',
};
const fractions = (text: string) =>
  replaceAll(text, /(?<![\d/.])(?:1\/2|1\/4|3\/4|1\/3|2\/3)(?![\d/])/g, (m) => FRACTIONS[m[0]]!);

function spaces(text: string, lang: Language): Edit[] {
  const edits = [
    // Two or more spaces between words: one.
    ...replaceAll(text, /(?<=\S) {2,}(?=\S)/gu, ' '),
    // No space before a comma, a period, a closing bracket (and, but in French, ; : ! ?).
    ...replaceAll(
      text,
      lang.french ? /(?<=\p{L}) +(?=[,.)\]](?!\.))/gu : /(?<=\p{L}) +(?=[,.;:!?)\]](?!\.))/gu,
      '',
    ),
    // A doubled comma, semicolon or colon.
    ...replaceAll(text, /([,;:])\1+/g, (m) => m[1]!),
  ];
  if (lang.french) {
    // A narrow non-breaking space before ; ! ? and a non-breaking one before : (French).
    edits.push(
      ...replaceAll(text, /(?<=\p{L})[ \u00a0]?([;!?])(?=\s|$)/gu, (m) => `${NNBSP}${m[1]}`),
    );
    edits.push(...replaceAll(text, /(?<=\p{L})[ \u00a0]?:(?=\s|$)/gu, `${NBSP}:`));
  }
  return edits;
}

function nbsp(text: string, lang: Language): Edit[] {
  const edits = [
    // A number and its unit stay together: 5 kg, 10 %, 20 °C.
    ...replaceAll(
      text,
      /(?<=\d) (?=(?:%|‰|°|kg|g|mg|km|m|cm|mm|ml|l|px|pt|€|£|\$|₽)(?![\p{L}\d]))/gu,
      NBSP,
    ),
    // After § and ¶.
    ...replaceAll(text, /(?<=[§¶]) /gu, NBSP),
  ];
  if (lang.shortWords) {
    // After a one- or two-letter word (in, on, at…): it doesn't stay alone at the end of a line.
    edits.push(...replaceAll(text, /(?<=(?:^|[\s(«„“])\p{L}{1,2}) (?=\p{L})/gu, NBSP));
  }
  return edits;
}

const RUNNERS: Record<TypographyRule, (text: string, lang: Language) => Edit[]> = {
  quotes,
  dashes,
  ellipsis,
  symbols,
  arrows,
  math,
  fractions,
  spaces,
  nbsp,
};

/** Where nothing is changed: web and email addresses, `code` in backticks. */
export function protectedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const match of text.matchAll(
    /(?:https?:\/\/|www\.)\S+|[^\s@"'«»<>()]+@[^\s@]+\.[^\s@"'«»<>()]+|`[^`]*`/gu,
  )) {
    ranges.push([match.index!, match.index! + match[0].length]);
  }
  return ranges;
}

/**
 * One rule's edits for a text, without overlapping ones and outside `blocked` ranges (and the
 * addresses and code of the text).
 */
export function ruleEdits(
  rule: TypographyRule,
  text: string,
  lang: Language,
  blocked: readonly [number, number][] = [],
): Edit[] {
  const keep = [...blocked, ...protectedRanges(text)];
  const out: Edit[] = [];
  let end = -1;
  for (const edit of RUNNERS[rule](text, lang).sort((a, b) => a.index - b.index)) {
    const to = edit.index + edit.length;
    if (edit.index < end) continue;
    if (keep.some(([from, until]) => edit.index < until && to > from)) continue;
    out.push(edit);
    end = to;
  }
  return out;
}

/** Applies edits to a text (for tests and previews). */
export function applyEdits(text: string, edits: readonly Edit[]): string {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.index - a.index))
    out = out.slice(0, edit.index) + edit.insert + out.slice(edit.index + edit.length);
  return out;
}

/** The whole enhancement of a text, rule by rule (for tests and previews). */
export function enhance(
  text: string,
  code: string,
  rules: readonly TypographyRule[] = TYPOGRAPHY_RULES,
): string {
  const lang = typographyLanguage(code);
  let out = text;
  for (const rule of rules) out = applyEdits(out, ruleEdits(rule, out, lang));
  return out;
}
