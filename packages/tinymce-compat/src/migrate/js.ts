/**
 * Just enough of JavaScript to read a configuration object without running it: where a bracket
 * closes (past strings, template literals, comments and regular expressions), the top-level
 * entries of an object literal, and the value of a literal (a string, an array of strings).
 */

const OPEN = '([{';
const CLOSE = ')]}';

/** After one of these (or at the start), a slash begins a regular expression, not a division. */
const BEFORE_REGEX = /[(,=:[!&|?{};+\-*%<>~^]/;

const isComment = (src: string, i: number) =>
  src[i] === '/' && (src[i + 1] === '/' || src[i + 1] === '*');

/**
 * The index just past the string, template literal, comment or regular expression that starts at
 * `i`, or `i` when none starts there. `prev` is the last significant character before `i`.
 */
function skip(src: string, i: number, prev: string): number {
  const c = src[i];
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  if (c === '`') {
    let j = i + 1;
    while (j < src.length && src[j] !== '`') {
      if (src[j] === '\\') j += 2;
      else if (src[j] === '$' && src[j + 1] === '{') {
        const end = closing(src, j + 1);
        if (end < 0) return src.length;
        j = end + 1;
      } else j++;
    }
    return j + 1;
  }
  if (c === '/' && src[i + 1] === '/') {
    const end = src.indexOf('\n', i);
    return end < 0 ? src.length : end;
  }
  if (c === '/' && src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2);
    return end < 0 ? src.length : end + 2;
  }
  if (c === '/' && (prev === '' || BEFORE_REGEX.test(prev))) {
    let j = i + 1;
    let inClass = false;
    while (j < src.length && src[j] !== '\n') {
      if (src[j] === '\\') j++;
      else if (src[j] === '[') inClass = true;
      else if (src[j] === ']') inClass = false;
      else if (src[j] === '/' && !inClass) break;
      j++;
    }
    return j + 1;
  }
  return i;
}

/**
 * Walks `src` from `from` to `to`, past literals and comments, calling `visit` with each other
 * character and the bracket depth before it (relative to `from`). `visit` returning true stops.
 */
function walk(
  src: string,
  from: number,
  to: number,
  visit: (c: string, i: number, depth: number) => boolean | void,
): void {
  let depth = 0;
  let prev = '';
  for (let i = from; i < to;) {
    const after = skip(src, i, prev);
    if (after !== i) {
      // After a literal a slash divides; a comment changes nothing.
      if (!isComment(src, i)) prev = '"';
      i = after;
      continue;
    }
    const c = src[i]!;
    if (visit(c, i, depth)) return;
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
}

/** The index of the bracket that closes the one at `open`, or -1 when it doesn't close. */
export function closing(src: string, open: number): number {
  const want: string[] = [];
  let found = -1;
  walk(src, open, src.length, (c, i) => {
    const opens = OPEN.indexOf(c);
    if (opens >= 0) want.push(CLOSE[opens]!);
    else if (CLOSE.includes(c)) {
      if (want.pop() !== c) return true;
      if (!want.length) {
        found = i;
        return true;
      }
    }
    return false;
  });
  return found;
}

/** The top-level parts of a bracketed list (an object's entries, an array's elements). */
function parts(src: string, open: number, close: number): Array<{ start: number; text: string }> {
  const out: Array<{ start: number; text: string }> = [];
  let start = open + 1;
  const push = (end: number) => {
    const raw = src.slice(start, end);
    const text = raw.trim();
    if (text) out.push({ start: start + raw.indexOf(text), text });
    start = end + 1;
  };
  walk(src, open + 1, close, (c, i, depth) => {
    if (c === ',' && depth === 0) push(i);
  });
  push(close);
  return out;
}

export interface Entry {
  /** The key (unquoted), or null for a spread or a computed key. */
  key: string | null;
  /** `...something`: options this reading can't see. */
  spread: boolean;
  /** The value's source (empty for a shorthand or a method). */
  value: string;
  /** Where the entry starts in the source. */
  start: number;
}

const KEY = /^(?:(?:async|get|set)\s+)?(?:([A-Za-z_$][\w$]*)|'([^']*)'|"([^"]*)")\s*(:|\(|$)/;

/** The top-level entries of the object literal whose braces are at `open` and `close`. */
export function entries(src: string, open: number, close: number): Entry[] {
  return parts(src, open, close).map(({ start, text }) => {
    if (text.startsWith('...')) return { key: null, spread: true, value: text.slice(3), start };
    const match = KEY.exec(text);
    const key = match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
    const value = match?.[4] === ':' ? text.slice(match[0].length).trim() : '';
    return { key, spread: false, value, start };
  });
}

function unquote(text: string): string | null {
  const quote = text[0];
  if (text.length < 2 || (quote !== '"' && quote !== "'" && quote !== '`')) return null;
  if (text[text.length - 1] !== quote) return null;
  const body = text.slice(1, -1);
  if (quote === '`' && body.includes('${')) return null;
  return body.replace(/\\(.)/g, (_m, ch: string) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : ch));
}

/** A string literal, or several joined with +; null for anything else. */
function joined(text: string): string | null {
  const pieces: string[] = [];
  let start = 0;
  walk(text, 0, text.length, (c, i, depth) => {
    if (c === '+' && depth === 0) {
      pieces.push(text.slice(start, i));
      start = i + 1;
    }
  });
  pieces.push(text.slice(start));
  let out = '';
  for (const piece of pieces) {
    const literal = unquote(piece.trim());
    if (literal === null) return null;
    out += literal;
  }
  return out;
}

/**
 * A value made of string literals: a string (or several joined with +), or an array of them.
 * Null when it is anything else (a variable, a call): the reading can't know it.
 */
export function strings(value: string): string[] | null {
  const text = value.trim();
  if (!text.startsWith('[')) {
    const one = joined(text);
    return one === null ? null : [one];
  }
  if (closing(text, 0) !== text.length - 1) return null;
  const items: string[] = [];
  for (const part of parts(text, 0, text.length - 1)) {
    const one = joined(part.text);
    if (one === null) return null;
    items.push(one);
  }
  return items;
}

/** The 1-based line of a position. */
export function lineAt(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}
