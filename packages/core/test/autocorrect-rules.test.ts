import { describe, expect, it } from 'vitest';
import {
  ENGLISH,
  findCorrection,
  matchCase,
  type RuleSettings,
} from '../src/plugins/autocorrect-rules';

/** The rules of autocorrect on the text before the cursor, without an editor. */

const settings = (over: Partial<RuleSettings> = {}): RuleSettings => ({
  autocorrect: true,
  capitalize: false,
  replacements: new Map(),
  english: true,
  ignore: new Set(),
  abbreviations: new Set(),
  ...over,
});

/** The text with the correction applied (or as it was). */
function fix(text: string, over: Partial<RuleSettings> = {}, trailer = true): string {
  const found = findCorrection(text, settings(over), { trailer });
  return found ? text.slice(0, found.start) + found.replacement + text.slice(found.end) : text;
}

describe('autocorrect rules', () => {
  it('a typo from the list, when a space or punctuation ends it', () => {
    expect(fix('I saw teh ')).toBe('I saw the ');
    expect(fix('I saw teh,')).toBe('I saw the,');
    expect(fix('I saw teh.')).toBe('I saw the.');
    expect(fix('(teh)')).toBe('(the)');
    expect(fix('"teh" ')).toBe('"the" ');
    expect(fix('we recieve ')).toBe('we receive ');
    expect(fix('alot ')).toBe('a lot ');
    // Not yet ended: the word may still grow.
    expect(fix('I saw teh')).toBe('I saw teh');
    // Enter at the end of a word: nothing after it.
    expect(fix('I saw teh', {}, false)).toBe('I saw the');
  });

  it('keeps the case it was typed in; words in capitals only are abbreviations, left alone', () => {
    expect(fix('Teh ')).toBe('The ');
    expect(fix('Recieve ')).toBe('Receive ');
    expect(fix('TEH ')).toBe('TEH ');
    expect(fix('el ADN ')).toBe('el ADN ');
    expect(matchCase('teh', 'the')).toBe('the');
    expect(matchCase('Teh', 'the')).toBe('The');
    expect(matchCase('TEH', 'the')).toBe('THE');
    expect(matchCase('carribean', 'Caribbean')).toBe('Caribbean');
  });

  it('"i" and the days are English capitals; apostrophes in the style of the text', () => {
    expect(fix('then i ')).toBe('then I ');
    expect(fix("so i'm ")).toBe("so I'm ");
    expect(fix('so i’m ')).toBe('so I’m ');
    expect(fix('didnt ')).toBe("didn't ");
    expect(fix('it’s fine, didnt ')).toBe('it’s fine, didn’t ');
    expect(fix('see you monday.')).toBe('see you Monday.');
    // "may", "march" and "august" are words too.
    expect(fix('we may ')).toBe('we may ');
    expect(ENGLISH.has('may')).toBe(false);
    // Nor words of languages written next to English: German im, Frist, French dont, Spanish posible.
    for (const word of ['im', 'frist', 'wich', 'wehre', 'dont', 'posible', 'profesional']) {
      expect(ENGLISH.has(word), word).toBe(false);
    }
  });

  it('leaves words that are part of an address, a path, a handle, a tag or code', () => {
    for (const text of [
      'example.com/teh ',
      'www.teh.com ',
      'mail teh@example.com ',
      '@teh ',
      '#teh ',
      '{{teh}} ',
      'snake_teh ',
      '3teh ',
      'well-teh ',
    ]) {
      expect(fix(text), text).toBe(text);
    }
  });

  it('a word on the list must be exactly a word: nothing for names of object properties', () => {
    expect(fix('constructor ')).toBe('constructor ');
    expect(fix('toString ')).toBe('toString ');
    expect(fix('__proto__ ')).toBe('__proto__ ');
  });

  it('TWo INitial CApitals, but not plurals of abbreviations, units or names written that way', () => {
    expect(fix('THe ')).toBe('The ');
    expect(fix('a WEdnesday ')).toBe('a Wednesday ');
    for (const text of ['IDs ', 'PCs ', 'MHz ', 'OAuth ', 'VMware ', 'ID ', 'NASA ', 'iOS ']) {
      expect(fix(text), text).toBe(text);
    }
  });

  it('only English content gets the built-in list; your own corrections work in any language', () => {
    expect(fix('teh ', { english: false })).toBe('teh ');
    expect(fix('then i ', { english: false })).toBe('then i ');
    const replacements = new Map([['strasse', 'straße']]);
    expect(fix('die strasse ', { english: false, replacements })).toBe('die straße ');
    expect(fix('Strasse ', { english: false, replacements })).toBe('Straße ');
    // Yours win over the built-in list.
    expect(fix('teh ', { replacements: new Map([['teh', 'ten']]) })).toBe('ten ');
  });

  it('ignored words and the switches', () => {
    expect(fix('teh ', { ignore: new Set(['teh']) })).toBe('teh ');
    expect(fix('THe ', { ignore: new Set(['the']) })).toBe('THe ');
    expect(fix('teh ', { autocorrect: false })).toBe('teh ');
    expect(findCorrection('teh ', settings({ autocorrect: false, capitalize: false }))).toBeNull();
  });

  describe('the first letter of a sentence', () => {
    const cap = (text: string, over: Partial<RuleSettings> = {}, blockStart = true) => {
      const found = findCorrection(text, settings({ capitalize: true, ...over }), { blockStart });
      return found ? text.slice(0, found.start) + found.replacement + text.slice(found.end) : text;
    };

    it('at the start of a block and after . ! ?', () => {
      expect(cap('hello ')).toBe('Hello ');
      expect(cap('  "hello ')).toBe('  "Hello ');
      expect(cap('It works. then ')).toBe('It works. Then ');
      expect(cap('Really? yes ')).toBe('Really? Yes ');
      expect(cap('Stop! now ')).toBe('Stop! Now ');
      expect(cap('He said "go." then ')).toBe('He said "go." Then ');
      expect(cap('It ended in 2020. then ')).toBe('It ended in 2020. Then ');
      // A line break inside the block is a space.
      expect(cap('Done.\nthen ')).toBe('Done.\nThen ');
    });

    it('not inside a sentence, after an abbreviation, an initial, a pause or a colon', () => {
      for (const text of [
        'It works and then ',
        'See e.g. this ',
        'Ask Dr. smith ',
        'Ask J. smith ',
        'Wait... then ',
        'Note: this ',
        'I live in the U.S. now ',
        'Visit example.com. then ',
      ]) {
        expect(cap(text), text).toBe(text);
      }
    });

    it('words with a capital inside keep their case; the block start must really be one', () => {
      expect(cap('iPhone ')).toBe('iPhone ');
      expect(cap('eBay ')).toBe('eBay ');
      expect(cap('hello ', {}, false)).toBe('hello ');
    });

    it('a typo at the start of a sentence gets both fixes at once', () => {
      expect(cap('teh ')).toBe('The ');
      expect(cap('Fine. i ')).toBe('Fine. I ');
    });

    it('a learned abbreviation, and what the period was after', () => {
      expect(cap('It costs approx. ten ')).toBe('It costs approx. ten ');
      expect(cap('Read chap. ten ')).toBe('Read chap. Ten ');
      expect(cap('Read chap. ten ', { abbreviations: new Set(['chap']) })).toBe('Read chap. ten ');
      expect(findCorrection('Read chap. ten ', settings({ capitalize: true }))?.after).toBe('chap');
    });

    it('in other languages with capitals', () => {
      expect(cap('ähm ', { english: false })).toBe('Ähm ');
      expect(cap('Καλημέρα. γεια ', { english: false })).toBe('Καλημέρα. Γεια ');
      expect(cap('Fin. ¿qué ', { english: false })).toBe('Fin. ¿Qué ');
    });
  });
});
