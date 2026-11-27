import { describe, expect, it } from 'vitest';
import { enhance, typographyLanguage } from '../src/plugins/typography-rules';

/**
 * Typography rules on plain text. Language rules are conventions, not alphabets: Russian quotes
 * and dashes are checked on Latin text.
 */

const NB = ' ';
const NNB = ' ';

describe('typography rules', () => {
  it('English: curly quotes, nested quotes, apostrophes, a closed em dash, an ellipsis', () => {
    expect(enhance(`"Hello," she said. "It's fine -- really..."`, 'en-US')).toBe(
      '“Hello,” she said. “It’s fine—really…”',
    );
    expect(enhance(`"She said 'hi' to me"`, 'en')).toBe('“She said ‘hi’ to me”');
    expect(enhance(`the dogs' bowls, rock'n'roll`, 'en')).toBe('the dogs’ bowls, rock’n’roll');
    // British English: single quotes first, a spaced en dash.
    expect(enhance(`"Yes" - he said`, 'en-GB')).toBe('‘Yes’ – he said');
  });

  it('other languages: German, French spacing, Russian quotes, dashes and short words', () => {
    expect(enhance('"Hallo" - sagte er', 'de')).toBe('„Hallo“ – sagte er');
    expect(enhance('"Bonjour" dit-il : oui!', 'fr')).toBe(
      `«${NB}Bonjour${NB}» dit-il${NB}: oui${NNB}!`,
    );
    expect(enhance('"Privet," - skazal on.', 'ru')).toBe(`«Privet,»${NB}— skazal on.`);
    expect(enhance('- Da, - otvetil on.', 'ru')).toBe(`—${NB}Da,${NB}— otvetil on.`);
    expect(enhance('v dome i na ulice', 'ru')).toBe(`v${NB}dome i${NB}na${NB}ulice`);
    // Not in English: a short word is just a word.
    expect(enhance('a cat in a hat', 'en')).toBe('a cat in a hat');
    // A region falls back to its language, an unknown language to English.
    expect(typographyLanguage('de_AT')).toBe(typographyLanguage('de'));
    expect(typographyLanguage('xx')).toBe(typographyLanguage('en'));
  });

  it('symbols, arrows, math signs, fractions, times', () => {
    expect(enhance('(c) 2026 Acme(tm), Nova (r)', 'en')).toBe('© 2026 Acme™, Nova®');
    // (c) in a list of items is not a copyright sign.
    expect(enhance('(a) one (b) two (c) three', 'en')).toBe('(a) one (b) two (c) three');
    expect(enhance('a -> b, c <= d, e != f, x => y, g <-> h', 'en')).toBe(
      'a → b, c ≤ d, e ≠ f, x ⇒ y, g ↔ h',
    );
    expect(enhance('10x20 and 3 x 4, not 0x1F; +-5', 'en')).toBe('10×20 and 3 × 4, not 0x1F; ±5');
    expect(enhance('1/2 cup, 3/4 inch, on 1/2/2026', 'en')).toBe('½ cup, ¾ inch, on 1/2/2026');
  });

  it('spaces: doubled ones, none before punctuation, doubled commas; units stay with numbers', () => {
    expect(enhance('Hello  world , ok .', 'en')).toBe('Hello world, ok.');
    expect(enhance('one,, two;; three', 'en')).toBe('one, two; three');
    expect(enhance('5 kg and 10 % of § 3', 'en')).toBe(`5${NB}kg and 10${NB}% of §${NB}3`);
  });

  it('leaves addresses, code in backticks and measurements alone', () => {
    expect(enhance('See https://example.com/a--b... and mail@x.com -> "x" in `a -> b`', 'en')).toBe(
      'See https://example.com/a--b... and mail@x.com → “x” in `a -> b`',
    );
    // 5" is five inches, not a closing quote.
    expect(enhance('a 5" screen', 'en')).toBe('a 5" screen');
  });

  it('is idempotent: enhancing twice changes nothing more', () => {
    for (const [text, lang] of [
      [`"Hello," she said. "It's fine -- really..."`, 'en'],
      ['"Bonjour" dit-il : oui!', 'fr'],
      ['- Da, - otvetil on v dome.', 'ru'],
    ] as const) {
      const once = enhance(text, lang);
      expect(enhance(once, lang), `${lang}: ${text}`).toBe(once);
    }
  });
});
