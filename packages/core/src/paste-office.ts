/**
 * Очистка HTML, вставленного из Word, Word Online, Google Docs, Excel, Google Sheets, LibreOffice
 * и обычных веб-страниц. Работает до разбора схемой: превращает «офисную» разметку в чистый HTML,
 * который схема поймёт правильно (настоящие списки вместо абзацев с маркерами, стили из классов
 * в style, без служебных тегов и стилей).
 *
 * Реализовано по публичному описанию формата буфера обмена Office и по наблюдаемому поведению
 * приложений — без чужого кода (clean-room, см. CLAUDE.md).
 */

export type PasteSource =
  | 'nova'
  | 'word'
  | 'word-online'
  | 'google-docs'
  | 'excel'
  | 'google-sheets'
  | 'libreoffice'
  | 'web';

/** 'clean' (по умолчанию) — без шрифтов, кегля, интервалов и цветов «по умолчанию»; 'keep' — как есть. */
export type PasteStyles = 'clean' | 'keep';

/** Откуда скопирован HTML (по характерным признакам разметки). */
export function detectPasteSource(html: string): PasteSource {
  if (/data-pm-slice=/.test(html)) return 'nova';
  if (/<google-sheets-html-origin|data-sheets-(root|value)/i.test(html)) return 'google-sheets';
  if (/id="docs-internal-guid-/.test(html)) return 'google-docs';
  if (/urn:schemas-microsoft-com:office:excel|ProgId"?\s+content="?Excel\.Sheet/i.test(html))
    return 'excel';
  if (
    /urn:schemas-microsoft-com:office:word|class="?Mso|mso-list:|content="?Microsoft Word/i.test(
      html,
    )
  )
    return 'word';
  if (
    /class="[^"]*\b(TextRun|OutlineElement|EOP|SCXW\d+|BCX\d+)\b|data-ccp-props|paraid=/.test(html)
  )
    return 'word-online';
  if (/content="?LibreOffice|content="?OpenOffice/i.test(html)) return 'libreoffice';
  return 'web';
}

/** Очистить вставляемый HTML. Внутреннее копирование NovaProse не трогаем. */
export function cleanPastedHTML(html: string, styles: PasteStyles = 'clean'): string {
  const source = detectPasteSource(html);
  if (source === 'nova') return html;

  const template = document.createElement('template');
  template.innerHTML = html;
  const root = document.createElement('div');
  root.append(template.content);

  inlineClassStyles(root);
  removeJunk(root);
  if (source === 'word') convertWordLists(root);
  if (source === 'google-docs') unwrapGoogleDocsWrapper(root);
  normalizeLists(root);
  convertWordParagraphStyles(root);
  root.querySelectorAll<HTMLElement>('[style]').forEach((el) => cleanStyle(el, styles));
  if (styles === 'clean') stripLayoutAttributes(root);
  unwrapMeaningless(root);
  removeBreaksBetweenBlocks(root);
  normalizeEmptyParagraphs(root);
  wrapCellContent(root);
  // Классы из Office (MsoNormal, xl65, TextRun…) вне Office ничего не значат: их стили уже в style.
  if (source !== 'web')
    root.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));
  return root.innerHTML;
}

// ---------- стили из <style> (Word, Excel, LibreOffice хранят форматирование в классах) ----------

type Declarations = Map<string, string>;

function parseDeclarations(css: string): Declarations {
  const out: Declarations = new Map();
  for (const part of css.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const name = part.slice(0, colon).trim().toLowerCase();
    const value = part
      .slice(colon + 1)
      .trim()
      .replace(/\s*!important$/i, '');
    if (name && value) out.set(name, value);
  }
  return out;
}

function serializeDeclarations(decls: Declarations): string {
  return [...decls].map(([name, value]) => `${name}: ${value}`).join('; ');
}

/** Переносит правила вида `.xl65 {…}` и `p.MsoTitle {…}` в style элементов. Свой style элемента важнее. */
function inlineClassStyles(root: HTMLElement): void {
  const sheets = [...root.querySelectorAll('style')].map((s) => s.textContent ?? '');
  if (!sheets.length) return;
  const rules: { tag: string; cls: string; decls: Declarations }[] = [];
  const css = sheets
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--|-->/g, '');
  for (const match of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const decls = parseDeclarations(match[2]!);
    for (const selector of match[1]!.split(',')) {
      const m = selector.trim().match(/^([a-z][a-z0-9]*)?\.([\w-]+)$/i);
      if (m) rules.push({ tag: (m[1] ?? '').toLowerCase(), cls: m[2]!, decls });
    }
  }
  if (!rules.length) return;
  root.querySelectorAll<HTMLElement>('[class]').forEach((el) => {
    const classes = el.className.split(/\s+/).filter(Boolean);
    const merged: Declarations = new Map();
    for (const rule of rules) {
      if (!classes.includes(rule.cls)) continue;
      if (rule.tag && rule.tag !== el.tagName.toLowerCase()) continue;
      rule.decls.forEach((value, name) => merged.set(name, value));
    }
    if (!merged.size) return;
    parseDeclarations(el.getAttribute('style') ?? '').forEach((value, name) =>
      merged.set(name, value),
    );
    el.setAttribute('style', serializeDeclarations(merged));
  });
}

// ---------- служебные элементы ----------

const DROP_TAGS = /^(STYLE|SCRIPT|META|LINK|TITLE|XML|HEAD|NOSCRIPT|TEMPLATE)$/;

function removeJunk(root: HTMLElement): void {
  // Комментарии (в т.ч. условные <!--[if …]--> из Word).
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  for (const el of [...root.querySelectorAll('*')]) {
    if (!root.contains(el)) continue;
    const tag = el.tagName.toUpperCase();
    if (DROP_TAGS.test(tag)) {
      el.remove();
      continue;
    }
    if (tag.includes(':')) {
      // <o:p> — «конец абзаца» Word, <v:…> — векторная графика (VML): удаляем.
      // Остальные теги с пространством имён (умные теги <st1:…>, <w:sdt>) — разворачиваем.
      const prefix = tag.split(':')[0];
      if (prefix === 'O' || prefix === 'V') el.remove();
      else unwrap(el);
    }
  }

  // Word Online: маркер конца абзаца <span class="EOP">&nbsp;</span>.
  root.querySelectorAll<HTMLElement>('span.EOP').forEach((span) => {
    if (/^\s*$/.test(span.textContent ?? '')) span.remove();
  });

  root.querySelectorAll<HTMLElement>('a').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    // Google Docs оборачивает внешние ссылки в переадресацию google.com/url?q=… — возвращаем адрес.
    const redirect = href.match(/^https?:\/\/(www\.)?google\.[a-z.]+\/url\?(.*)$/i);
    if (redirect) {
      const target = new URLSearchParams(redirect[2]).get('q');
      if (target) a.setAttribute('href', target);
    }
    // Закладки и оглавление Word (<a name="_Toc…">), ссылки на сноски и комментарии.
    if (!href || /^#_(ftn|edn|msocom|Toc|Ref)/i.test(href)) unwrap(a);
  });

  // Разрывы страниц Word: <br clear=all style='page-break-before:always'>.
  root.querySelectorAll<HTMLElement>('br[style*="page-break"]').forEach((br) => br.remove());
  // Блоки сносок и комментариев Word в конце документа.
  root
    .querySelectorAll<HTMLElement>(
      '[style*="mso-element:footnote-list"], [style*="mso-element:comment-list"], [style*="mso-element:endnote-list"]',
    )
    .forEach((el) => el.remove());
}

// ---------- списки Word для компьютера: абзацы с mso-list → <ul>/<ol> ----------

interface WordListItem {
  el: HTMLElement;
  level: number;
  ordered: boolean;
  start: number;
  /** list-style-type, если отличается от стандартного (disc / decimal). */
  style?: string | null;
}

/**
 * Маркер нумерованного списка: «1.», «1.1.», «1», «a)», «iv.», «(2)». Буква без точки или скобки —
 * не номер: «o» — стандартный маркер второго уровня маркированного списка Word.
 */
const ORDERED_MARKER = /^[([]?(\d+(\.\d+)*[.)\]]?|[a-z]{1,4}[.)\]])$/i;

function readWordListItem(el: HTMLElement): WordListItem | null {
  const css = el.getAttribute('style') ?? '';
  const match = css.match(/mso-list:\s*(l\d+)\s+level(\d+)/i);
  if (!match) return null;
  // Маркер Word кладёт в <span style="mso-list:Ignore">1.<span>&nbsp;&nbsp;</span></span>.
  const markerEl = [...el.querySelectorAll<HTMLElement>('[style]')].find((s) =>
    /mso-list:\s*Ignore/i.test(s.getAttribute('style') ?? ''),
  );
  const marker = (markerEl?.textContent ?? '').replace(/\s+/g, '');
  markerEl?.remove();
  const ordered = ORDERED_MARKER.test(marker);
  const { style, start } = ordered ? numbering(marker) : { style: bulletStyle(marker), start: 1 };
  return {
    el,
    level: Math.max(1, Math.min(9, Number(match[2]))),
    ordered,
    start,
    style,
  };
}

const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i;
const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10 };

function romanToNumber(roman: string): number {
  let total = 0;
  const chars = roman.toLowerCase();
  for (let i = 0; i < chars.length; i++) {
    const value = ROMAN_VALUES[chars[i]!]!;
    const next = ROMAN_VALUES[chars[i + 1] ?? ''] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

/** Стиль и начало нумерации по маркеру: «3.» → decimal с 3, «c)» → lower-alpha с 3, «iv.» → lower-roman с 4. */
function numbering(marker: string): { style: string | null; start: number } {
  const digits = marker.match(/\d+/);
  if (digits) return { style: null, start: Number(digits[0]) };
  const letters = marker.replace(/[^a-z]/gi, '');
  if (ROMAN.test(letters)) {
    return {
      style: letters === letters.toLowerCase() ? 'lower-roman' : 'upper-roman',
      start: romanToNumber(letters),
    };
  }
  const lower = letters === letters.toLowerCase();
  return {
    style: lower ? 'lower-alpha' : 'upper-alpha',
    start: letters.toLowerCase().charCodeAt(0) - 96,
  };
}

/** Маркер Word второго уровня «o» — кружок, «§» и «▪» (Wingdings) — квадрат, остальное — точка. */
function bulletStyle(marker: string): string | null {
  if (marker === 'o') return 'circle';
  if (/^[§▪■]$/.test(marker)) return 'square';
  return null;
}

function convertWordLists(root: HTMLElement): void {
  const candidates = [
    ...root.querySelectorAll<HTMLElement>('p, div, h1, h2, h3, h4, h5, h6'),
  ].filter((el) => /mso-list:\s*l\d+\s+level\d+/i.test(el.getAttribute('style') ?? ''));
  // Нумерованные заголовки («1. Введение») — не список: маркер оставляем текстом.
  for (const heading of candidates.filter((el) => /^H[1-6]$/.test(el.tagName))) {
    heading.querySelectorAll<HTMLElement>('[style]').forEach((s) => {
      if (!/mso-list:\s*Ignore/i.test(s.getAttribute('style') ?? '')) return;
      // Маркер «1.» + отступ из неразрывных пробелов → «1. ».
      const marker = (s.textContent ?? '').replace(/\s+/g, '');
      s.replaceWith(s.ownerDocument.createTextNode(`${marker} `));
    });
  }
  const paragraphs = candidates.filter((el) => !/^H[1-6]$/.test(el.tagName));
  const done = new Set<HTMLElement>();
  for (const first of paragraphs) {
    if (done.has(first)) continue;
    // Серия: подряд идущие соседи-пункты.
    const run: WordListItem[] = [];
    let node: Element | null = first;
    while (node instanceof HTMLElement && paragraphs.includes(node)) {
      const item = readWordListItem(node);
      if (!item) break;
      run.push(item);
      done.add(node);
      node = nextElement(node);
    }
    if (run.length) buildNestedList(run);
  }
}

function nextElement(el: Element): Element | null {
  let next = el.nextSibling;
  // Пропускаем пустой текст между абзацами.
  while (next && next.nodeType === Node.TEXT_NODE && !next.textContent?.trim())
    next = next.nextSibling;
  return next instanceof Element ? next : null;
}

/** Строит вложенные списки из плоской серии пунктов с уровнями и ставит их на место первого пункта. */
function buildNestedList(run: WordListItem[]): void {
  const doc = run[0]!.el.ownerDocument;
  const anchor = run[0]!.el;
  const stack: { list: HTMLElement; level: number }[] = [];
  let top: HTMLElement | null = null;
  for (const item of run) {
    while (stack.length && stack[stack.length - 1]!.level > item.level) stack.pop();
    let current = stack[stack.length - 1];
    if (!current || current.level < item.level) {
      const list = doc.createElement(item.ordered ? 'ol' : 'ul');
      if (item.ordered && item.start !== 1) list.setAttribute('start', String(item.start));
      if (item.style) list.style.listStyleType = item.style;
      if (current) {
        // Вложенный список — внутрь последнего пункта родителя.
        const parentItem =
          current.list.lastElementChild ?? current.list.appendChild(doc.createElement('li'));
        parentItem.appendChild(list);
      } else top = list;
      current = { list, level: item.level };
      stack.push(current);
    }
    const li = doc.createElement('li');
    const p = doc.createElement('p');
    while (item.el.firstChild) p.appendChild(item.el.firstChild);
    li.appendChild(p);
    current.list.appendChild(li);
  }
  anchor.replaceWith(top!);
  run.slice(1).forEach((item) => item.el.remove());
}

// ---------- списки Google Docs и Word Online: aria-level, разрезанные <ul> ----------

function levelOf(li: Element): number | null {
  const raw = li.getAttribute('aria-level') ?? li.getAttribute('data-aria-level');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(9, n) : null;
}

function normalizeLists(root: HTMLElement): void {
  // Word Online оборачивает каждый пункт в <div class="ListContainerWrapper"><ul>…</ul></div>.
  root.querySelectorAll<HTMLElement>('div').forEach((div) => {
    const only = div.children.length === 1 ? div.firstElementChild : null;
    if (
      only &&
      /^(UL|OL)$/.test(only.tagName) &&
      !div.textContent?.replace(only.textContent ?? '', '').trim()
    )
      unwrap(div);
  });

  // Список прямо внутри списка (<ul><li/><ul>…</ul></ul>, бывает в Google Docs) — во вложенный пункт.
  root.querySelectorAll<HTMLElement>('ul > ul, ul > ol, ol > ul, ol > ol').forEach((list) => {
    const prev = list.previousElementSibling;
    if (prev?.tagName === 'LI') prev.appendChild(list);
  });

  // Серии соседних списков с aria-level — собираем заново с правильной вложенностью.
  const lists = [...root.querySelectorAll<HTMLElement>('ul, ol')].filter(
    (l) =>
      !l.parentElement?.closest('ul, ol') && l.querySelector('li[aria-level], li[data-aria-level]'),
  );
  const done = new Set<Element>();
  for (const first of lists) {
    if (done.has(first) || !root.contains(first)) continue;
    const run: WordListItem[] = [];
    let node: Element | null = first;
    while (node && /^(UL|OL)$/.test(node.tagName)) {
      done.add(node);
      collectListItems(node, 1, run);
      const next = nextElement(node);
      if (node !== first) node.remove();
      node = next;
    }
    if (!run.length) continue;
    const placeholder = first.ownerDocument.createElement('div');
    first.replaceWith(placeholder);
    buildNestedListFromBlocks(run, placeholder);
  }
}

/** Пункты списка в порядке документа: вложенные списки выносятся с уровнем на 1 больше (если нет aria-level). */
function collectListItems(list: Element, depth: number, run: WordListItem[]): void {
  for (const li of [...list.children]) {
    if (li.tagName !== 'LI') continue;
    const level = levelOf(li) ?? depth;
    const nested = [...li.children].filter((c) => /^(UL|OL)$/.test(c.tagName));
    nested.forEach((n) => n.remove());
    const holder = li.ownerDocument.createElement('div');
    while (li.firstChild) holder.appendChild(li.firstChild);
    run.push({
      el: holder,
      level,
      ordered: list.tagName === 'OL',
      start: Number(list.getAttribute('start') ?? 1) || 1,
    });
    nested.forEach((n) => collectListItems(n, level + 1, run));
  }
}

/** Как buildNestedList, но содержимое пункта уже может быть блоками (<p>). */
function buildNestedListFromBlocks(run: WordListItem[], placeholder: HTMLElement): void {
  const doc = placeholder.ownerDocument;
  const stack: { list: HTMLElement; level: number }[] = [];
  let top: HTMLElement | null = null;
  for (const item of run) {
    while (stack.length && stack[stack.length - 1]!.level > item.level) stack.pop();
    let current = stack[stack.length - 1];
    if (!current || current.level < item.level) {
      const list = doc.createElement(item.ordered ? 'ol' : 'ul');
      if (item.ordered && item.start !== 1 && !current)
        list.setAttribute('start', String(item.start));
      if (current) {
        const parentItem =
          current.list.lastElementChild ?? current.list.appendChild(doc.createElement('li'));
        parentItem.appendChild(list);
      } else top = list;
      current = { list, level: item.level };
      stack.push(current);
    }
    const li = doc.createElement('li');
    while (item.el.firstChild) li.appendChild(item.el.firstChild);
    current.list.appendChild(li);
  }
  placeholder.replaceWith(top!);
}

// ---------- Google Docs ----------

function unwrapGoogleDocsWrapper(root: HTMLElement): void {
  // Всё содержимое Google Docs обёрнуто в <b style="font-weight:normal" id="docs-internal-guid-…">.
  root.querySelectorAll<HTMLElement>('[id^="docs-internal-guid-"]').forEach(unwrap);
  // Пункты-чекбоксы — обычные пункты.
  root.querySelectorAll<HTMLElement>('li[role="checkbox"]').forEach((li) => {
    li.removeAttribute('role');
    li.removeAttribute('aria-checked');
  });
}

// ---------- абзацные стили Word ----------

function convertWordParagraphStyles(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('p.MsoTitle, p[class*="Title"]').forEach((p) => {
    if (!/\bMsoTitle\b|^Title$/.test(p.className)) return;
    renameElement(p, 'h1');
  });
  // Обёртки разделов Word.
  root
    .querySelectorAll<HTMLElement>('div.WordSection1, div[class^="WordSection"], div.Section1')
    .forEach(unwrap);
}

// ---------- стили ----------

const DEFAULT_TEXT_COLORS =
  /^(black|windowtext|auto|#000|#000000|rgb\(0,\s*0,\s*0\)|initial|inherit)$/i;
const DEFAULT_BACKGROUNDS =
  /^(transparent|white|window|auto|none|#fff|#ffffff|rgba?\(255,\s*255,\s*255(,\s*1)?\)|rgba\(\d+,\s*\d+,\s*\d+,\s*0\)|initial|inherit)$/i;
/** Свойства, которые описывают оформление документа-источника, а не смысл текста. */
const CLEAN_DROP =
  /^(font|font-family|font-size|line-height|margin|margin-.+|padding|padding-.+|text-indent|letter-spacing|word-spacing|white-space|height|width|min-height|border|border-.+|tab-stops|layout-grid-mode|page-break-.+|break-.+|orphans|widows|direction|unicode-bidi|font-variant.*|text-transform)$/i;

function cleanStyle(el: HTMLElement, mode: PasteStyles): void {
  const decls = parseDeclarations(el.getAttribute('style') ?? '');
  const out: Declarations = new Map();
  decls.forEach((value, name) => {
    if (name.startsWith('mso-')) {
      // Подсветка текста в Word: mso-highlight:yellow → цвет фона.
      if (
        name === 'mso-highlight' &&
        !DEFAULT_BACKGROUNDS.test(value) &&
        !decls.has('background-color')
      )
        out.set('background-color', value);
      return;
    }
    if (name.startsWith('-webkit-') || name.startsWith('-moz-')) return;
    if (name === 'background') {
      // Word и Excel пишут фон сокращённо: background:yellow. Берём только простой цвет.
      const color = value.split(/\s+/)[0]!;
      if (/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)$/i.test(color) && !out.has('background-color'))
        out.set('background-color', color);
      return;
    }
    if (name === 'text-decoration' || name === 'text-decoration-line') {
      // «underline line-through» и «underline» с лишними частями → то, что понимает схема.
      if (/underline/.test(value)) out.set('text-decoration', 'underline');
      else if (/line-through/.test(value)) out.set('text-decoration', 'line-through');
      return;
    }
    if (mode === 'clean' && CLEAN_DROP.test(name)) return;
    // Вертикальное выравнивание ячеек таблиц (у Sheets и Excel — «снизу» во всех ячейках) — вид источника.
    if (mode === 'clean' && name === 'vertical-align' && /^(TD|TH)$/.test(el.tagName)) return;
    out.set(name, value);
  });

  // Цвета «по умолчанию» (чёрный текст, белый/прозрачный фон) — не форматирование.
  const color = out.get('color');
  if (color && DEFAULT_TEXT_COLORS.test(color.trim()) && mode === 'clean') out.delete('color');
  const background = out.get('background-color');
  if (background && DEFAULT_BACKGROUNDS.test(background.trim())) out.delete('background-color');
  if (out.get('font-weight') === 'normal' && el.tagName !== 'B') out.delete('font-weight');
  if (out.get('font-style') === 'normal') out.delete('font-style');
  if (out.get('text-decoration') === 'none') out.delete('text-decoration');
  if (out.get('vertical-align') === 'baseline') out.delete('vertical-align');
  // Выравнивание по левому краю — значение по умолчанию, а не форматирование.
  if (/^(left|start)$/i.test(out.get('text-align') ?? '')) out.delete('text-align');

  // Синий цвет и подчёркивание ссылок — оформление источника; на сайте ссылки оформит его CSS.
  if (mode === 'clean' && el.closest('a')) {
    out.delete('color');
    if (out.get('text-decoration') === 'underline') out.delete('text-decoration');
  }

  if (out.size) el.setAttribute('style', serializeDeclarations(out));
  else el.removeAttribute('style');
}

/** Размеры таблиц и ячеек из атрибутов (width="256", height, valign) — раскладка документа-источника. */
function stripLayoutAttributes(root: HTMLElement): void {
  root.querySelectorAll('table, tr, td, th, col, colgroup').forEach((el) => {
    el.removeAttribute('width');
    el.removeAttribute('height');
    el.removeAttribute('valign');
  });
}

// ---------- развёртка пустых обёрток, пустые абзацы, лишние <br> ----------

function unwrapMeaningless(root: HTMLElement): void {
  for (const el of [...root.querySelectorAll<HTMLElement>('span, font')].reverse()) {
    if (!root.contains(el)) continue;
    const hasFormatting =
      el.hasAttribute('style') || (el.tagName === 'FONT' && el.hasAttribute('color'));
    if (!hasFormatting) unwrap(el);
  }
  root.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));
  root.querySelectorAll('[lang]').forEach((el) => el.removeAttribute('lang'));
  // dir="ltr" Google Docs ставит на каждый абзац — это значение по умолчанию; rtl сохраняем.
  root.querySelectorAll('[dir]').forEach((el) => {
    if (!/^rtl$/i.test(el.getAttribute('dir') ?? '')) el.removeAttribute('dir');
  });
}

const BLOCK = /^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE|HR)$/;

/** <br> между блоками на верхнем уровне (Google Docs ставит их между абзацами) — лишние пустые строки. */
function removeBreaksBetweenBlocks(root: HTMLElement): void {
  root.querySelectorAll('br').forEach((br) => {
    const parent = br.parentElement;
    if (
      !parent ||
      !(
        parent === root ||
        parent.tagName === 'DIV' ||
        parent.tagName === 'TD' ||
        parent.tagName === 'LI'
      )
    )
      return;
    const prev = siblingElement(br, -1);
    const next = siblingElement(br, 1);
    if (
      (prev && BLOCK.test(prev.tagName)) ||
      (next && BLOCK.test(next.tagName)) ||
      (!prev && !next && parent === root)
    )
      br.remove();
  });
}

function siblingElement(node: Node, dir: -1 | 1): Element | null {
  let s = dir < 0 ? node.previousSibling : node.nextSibling;
  while (s && s.nodeType === Node.TEXT_NODE && !s.textContent?.trim())
    s = dir < 0 ? s.previousSibling : s.nextSibling;
  return s instanceof Element ? s : null;
}

/** Абзац из одного неразрывного пробела (так Word пишет пустую строку) — пустой абзац. */
function normalizeEmptyParagraphs(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('p').forEach((p) => {
    if (p.children.length === 0 && /^\s*$/.test(p.textContent ?? '')) p.textContent = '';
  });
}

/**
 * Ячейки Excel и Google Sheets содержат текст без абзаца, а выравнивание задано на самой ячейке.
 * Оборачиваем инлайн-содержимое в абзац и переносим на него text-align, иначе выравнивание потеряется.
 */
function wrapCellContent(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
    const align = cell.style.textAlign;
    const hasBlock = [...cell.children].some((c) => BLOCK.test(c.tagName));
    if (!align || hasBlock || !cell.textContent?.trim()) return;
    const p = cell.ownerDocument.createElement('p');
    p.style.textAlign = align;
    while (cell.firstChild) p.appendChild(cell.firstChild);
    cell.appendChild(p);
    cell.style.removeProperty('text-align');
    if (!cell.getAttribute('style')) cell.removeAttribute('style');
  });
}

// ---------- утилиты ----------

function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function renameElement(el: HTMLElement, tag: string): HTMLElement {
  const next = el.ownerDocument.createElement(tag);
  for (const attr of [...el.attributes]) next.setAttribute(attr.name, attr.value);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
}
