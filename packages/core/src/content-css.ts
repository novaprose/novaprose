// Content styles (contentStyle / contentCss): the customer's CSS applies only to the text of
// that particular editor. The editor doesn't live in an iframe, so every rule is scoped to its
// text area: `body`/`html`/`:root` are the area itself, other selectors apply inside it.

/** These at-rules don't depend on selectors and are left as they are. */
const GLOBAL_AT_RULES =
  /^@(font-face|(-webkit-)?keyframes|property|counter-style|page|font-feature-values|font-palette-values)\b/i;
/** Grouping at-rules: the regular rules inside them are scoped too. */
const GROUP_AT_RULES = /^@(media|supports|container|layer|document|scope)\b/i;

interface Item {
  /** The text before `{`, or the whole statement (`@import …;`). */
  prelude: string;
  /** The content of `{…}`; null for a statement without a block. */
  body: string | null;
}

/** Splits CSS into top-level items, minding strings, comments and nested brackets. */
export function splitTopLevel(css: string): Item[] {
  const items: Item[] = [];
  let i = 0;
  let start = 0;
  let depth = 0;
  let prelude = '';
  while (i < css.length) {
    const ch = css[i]!;
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      // A comment is cut out: inside a selector it only gets in the way.
      const cut = end === -1 ? css.length : end + 2;
      if (depth === 0) {
        css = css.slice(0, i) + css.slice(cut);
        continue;
      }
      i = cut;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i++;
      while (i < css.length && css[i] !== ch) i += css[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) {
        prelude = css.slice(start, i).trim();
        start = i + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        items.push({ prelude, body: css.slice(start, i) });
        start = i + 1;
      }
      if (depth < 0) depth = 0;
    } else if (ch === ';' && depth === 0) {
      const statement = css.slice(start, i).trim();
      if (statement) items.push({ prelude: statement, body: null });
      start = i + 1;
    }
    i++;
  }
  return items;
}

/** Splits a selector list at top-level commas (not inside :is(a, b) and [x="a,b"]). */
export function splitSelectors(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i]!;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(list.slice(start));
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** `body p` → `<scope> p`; `html body.dark` → `<scope>.dark`; `p` → `<scope> p`. */
export function scopeSelector(selector: string, scope: string): string {
  let rest = selector;
  let root = false;
  for (;;) {
    const m = rest.match(/^(html|body|:root)(?![\w-])\s*/i);
    if (!m) break;
    root = true;
    rest = rest.slice(m[0].length);
  }
  if (!root) return `${scope} ${selector}`;
  // body.dark / body[dir] / body:hover refine the area itself (no space).
  if (/^[.#[:]/.test(rest)) {
    const end = rest.search(/[\s>+~]/);
    return end === -1
      ? `${scope}${rest}`
      : `${scope}${rest.slice(0, end)} ${rest.slice(end).trim()}`;
  }
  return rest ? `${scope} ${rest}` : scope;
}

/** Scopes every CSS rule to the `scope` area. @imports must already be inlined. */
export function scopeCss(css: string, scope: string): string {
  const out: string[] = [];
  for (const { prelude, body } of splitTopLevel(css)) {
    if (body === null) {
      // @charset, @import (not inlined), @namespace, @layer a, b; @layer without a block is safe.
      if (/^@layer\b/i.test(prelude)) out.push(`${prelude};`);
      continue;
    }
    if (GLOBAL_AT_RULES.test(prelude)) out.push(`${prelude}{${body}}`);
    else if (GROUP_AT_RULES.test(prelude)) out.push(`${prelude}{${scopeCss(body, scope)}}`);
    else if (prelude.startsWith('@'))
      continue; // an unknown at-rule: no risks taken
    else {
      const selectors = splitSelectors(prelude).map((s) => scopeSelector(s, scope));
      if (selectors.length) out.push(`${selectors.join(', ')}{${body}}`);
    }
  }
  return out.join('\n');
}

/** Relative url(…) in a style file → absolute (otherwise they would resolve against the page). */
export function absolutizeUrls(css: string, base: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote: string, url: string) => {
    if (/^(data:|https?:|\/\/|#)/i.test(url)) return match;
    try {
      return `url(${quote}${new URL(url, base).href}${quote})`;
    } catch {
      return match;
    }
  });
}

const IMPORT = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?([^;]*);/gi;

/** Loads a style file and inlines its @imports (up to 3 levels). */
export async function loadCss(url: string, depth = 0): Promise<string> {
  const base = new URL(url, document.baseURI).href;
  const response = await fetch(base);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  let css = absolutizeUrls(await response.text(), base);
  if (depth >= 3) return css.replace(IMPORT, '');
  const imports = [...css.matchAll(IMPORT)];
  for (const m of imports) {
    const media = m[3]!.trim();
    let inner = '';
    try {
      inner = await loadCss(new URL(m[2]!, base).href, depth + 1);
    } catch (error) {
      console.warn(`[nova] contentCss: could not load ${m[2]}`, error);
    }
    css = css.replace(m[0], media ? `@media ${media}{${inner}}` : inner);
  }
  return css;
}

/**
 * Attaches CSS to the editor's document (or shadow root). Constructable style sheets don't need
 * 'unsafe-inline' in the CSP; where they are missing, a regular <style>. Returns a removal function.
 */
export function attachCss(host: HTMLElement, css: string): () => void {
  const root = host.getRootNode() as Document | ShadowRoot;
  const canAdopt =
    'adoptedStyleSheets' in root &&
    typeof CSSStyleSheet !== 'undefined' &&
    'replaceSync' in CSSStyleSheet.prototype;
  if (canAdopt) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return () => {
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== sheet);
      };
    } catch {
      // an old browser with partial support: fall through to <style>
    }
  }
  const style = document.createElement('style');
  style.setAttribute('data-nova-content-css', '');
  style.textContent = css;
  host.prepend(style);
  return () => style.remove();
}
