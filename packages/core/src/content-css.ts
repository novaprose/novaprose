// Стили содержимого (contentStyle / contentCss): CSS клиента применяется только к тексту
// конкретного редактора. Редактор живёт не в iframe, поэтому каждое правило приписываем к его
// области текста: `body`/`html`/`:root` — это сама область, остальные селекторы — внутри неё.

/** Эти at-правила не зависят от селекторов — оставляем как есть. */
const GLOBAL_AT_RULES =
  /^@(font-face|(-webkit-)?keyframes|property|counter-style|page|font-feature-values|font-palette-values)\b/i;
/** Группирующие at-правила: внутри обычные правила — их тоже приписываем. */
const GROUP_AT_RULES = /^@(media|supports|container|layer|document|scope)\b/i;

interface Item {
  /** Текст до `{` или весь оператор (`@import …;`). */
  prelude: string;
  /** Содержимое `{…}`; null — оператор без блока. */
  body: string | null;
}

/** Делит CSS на элементы верхнего уровня, учитывая строки, комментарии и вложенные скобки. */
function splitTopLevel(css: string): Item[] {
  const items: Item[] = [];
  let i = 0;
  let start = 0;
  let depth = 0;
  let prelude = '';
  while (i < css.length) {
    const ch = css[i]!;
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      // Комментарий вырезаем: внутри селектора он только мешает.
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

/** Делит список селекторов по запятым верхнего уровня (не внутри :is(a, b) и [x="a,b"]). */
function splitSelectors(list: string): string[] {
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
function scopeSelector(selector: string, scope: string): string {
  let rest = selector;
  let root = false;
  for (;;) {
    const m = rest.match(/^(html|body|:root)(?![\w-])\s*/i);
    if (!m) break;
    root = true;
    rest = rest.slice(m[0].length);
  }
  if (!root) return `${scope} ${selector}`;
  // body.dark / body[dir] / body:hover — уточнение самой области (без пробела).
  if (/^[.#[:]/.test(rest)) {
    const end = rest.search(/[\s>+~]/);
    return end === -1
      ? `${scope}${rest}`
      : `${scope}${rest.slice(0, end)} ${rest.slice(end).trim()}`;
  }
  return rest ? `${scope} ${rest}` : scope;
}

/** Приписывает все правила CSS к области `scope`. @import должны быть уже встроены. */
export function scopeCss(css: string, scope: string): string {
  const out: string[] = [];
  for (const { prelude, body } of splitTopLevel(css)) {
    if (body === null) {
      // @charset, @import (не встроенный), @namespace, @layer a, b; — @layer без блока безопасен.
      if (/^@layer\b/i.test(prelude)) out.push(`${prelude};`);
      continue;
    }
    if (GLOBAL_AT_RULES.test(prelude)) out.push(`${prelude}{${body}}`);
    else if (GROUP_AT_RULES.test(prelude)) out.push(`${prelude}{${scopeCss(body, scope)}}`);
    else if (prelude.startsWith('@'))
      continue; // неизвестное at-правило — не рискуем
    else {
      const selectors = splitSelectors(prelude).map((s) => scopeSelector(s, scope));
      if (selectors.length) out.push(`${selectors.join(', ')}{${body}}`);
    }
  }
  return out.join('\n');
}

/** Относительные url(…) в файле стилей → абсолютные (иначе они считались бы от страницы). */
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

/** Загружает файл стилей и встраивает его @import (до 3 уровней). */
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
 * Подключает CSS к документу (или shadow root) редактора. Конструируемые таблицы стилей
 * не требуют 'unsafe-inline' в CSP; где их нет — обычный <style>. Возвращает функцию удаления.
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
      // старый браузер с частичной поддержкой — ниже <style>
    }
  }
  const style = document.createElement('style');
  style.setAttribute('data-nova-content-css', '');
  style.textContent = css;
  host.prepend(style);
  return () => style.remove();
}
