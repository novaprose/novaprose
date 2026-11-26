/**
 * Маленький разбор XML для .docx (без DOM — работает и на сервере). Документы Word — правильный
 * XML: здесь только то, что в них встречается: элементы с префиксами (w:p), атрибуты, текст,
 * CDATA, комментарии, объявления и сущности.
 */

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlElement | string;

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Символ, который XML 1.0 запрещает (управляющие, кроме табуляции и переводов строк). */
function forbidden(code: number): boolean {
  return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code > 0xfffd;
}

/** Текст для XML: & < > и кавычки; запрещённые в XML 1.0 символы — прочь. */
export function escapeXml(text: string): string {
  let clean = '';
  // По кодовым единицам UTF-16: половинки суррогатных пар (эмодзи) проходят, 0xFFFE/0xFFFF — нет.
  for (let i = 0; i < text.length; i++) if (!forbidden(text.charCodeAt(i))) clean += text[i];
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ATTR_RE = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Корень (#document) с деревом элементов. Незакрытые элементы закрываются в конце. */
export function parseXml(source: string): XmlElement {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const root: XmlElement = { name: '#document', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    const top = stack[stack.length - 1]!;
    if (lt < 0) {
      if (i < text.length) top.children.push(decodeEntities(text.slice(i)));
      break;
    }
    if (lt > i) top.children.push(decodeEntities(text.slice(i, lt)));
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      i = end < 0 ? text.length : end + 3;
    } else if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      top.children.push(text.slice(lt + 9, end < 0 ? text.length : end));
      i = end < 0 ? text.length : end + 3;
    } else if (text.startsWith('<?', lt) || text.startsWith('<!', lt)) {
      const end = text.indexOf('>', lt);
      i = end < 0 ? text.length : end + 1;
    } else if (text[lt + 1] === '/') {
      const end = text.indexOf('>', lt);
      const name = text.slice(lt + 2, end < 0 ? text.length : end).trim();
      // Закрываем до своего элемента (лишний закрывающий тег — пропускаем).
      const index = stack.map((el) => el.name).lastIndexOf(name);
      if (index > 0) stack.length = index;
      i = end < 0 ? text.length : end + 1;
    } else {
      // Конец тега — первая > вне кавычек.
      let end = lt + 1;
      let quote = '';
      for (; end < text.length; end++) {
        const ch = text[end]!;
        if (quote) {
          if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '>') break;
      }
      let inner = text.slice(lt + 1, end);
      const selfClosing = inner.endsWith('/');
      if (selfClosing) inner = inner.slice(0, -1);
      const space = inner.search(/[\s]/);
      const name = space < 0 ? inner : inner.slice(0, space);
      const attrs: Record<string, string> = {};
      if (space >= 0) {
        for (const match of inner.slice(space).matchAll(ATTR_RE))
          attrs[match[1]!] = decodeEntities(match[2] ?? match[3] ?? '');
      }
      const element: XmlElement = { name, attrs, children: [] };
      top.children.push(element);
      if (!selfClosing) stack.push(element);
      i = end + 1;
    }
  }
  return root;
}

/** Дочерние элементы с именем (или все). */
export function elements(parent: XmlElement | undefined, name?: string): XmlElement[] {
  if (!parent) return [];
  return parent.children.filter(
    (child): child is XmlElement => typeof child !== 'string' && (!name || child.name === name),
  );
}

export function element(parent: XmlElement | undefined, name: string): XmlElement | undefined {
  return parent?.children.find(
    (child): child is XmlElement => typeof child !== 'string' && child.name === name,
  );
}

/** Элемент по пути имён: path(doc, 'w:document', 'w:body'). */
export function path(parent: XmlElement | undefined, ...names: string[]): XmlElement | undefined {
  let current = parent;
  for (const name of names) current = element(current, name);
  return current;
}

/** Весь текст элемента и потомков. */
export function textContent(node: XmlNode): string {
  return typeof node === 'string' ? node : node.children.map(textContent).join('');
}
