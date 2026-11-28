/**
 * HTML laid out for reading: every block on its own line, nested ones indented. Only the space
 * between blocks changes, never text: a tag holds its blocks on separate lines only when a block
 * follows it at once, inline content stays on its line, and <pre> stays as it is. Reading the result
 * back gives the same document.
 */

const BLOCKS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'caption',
  'col',
  'colgroup',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

const TOKEN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+|</g;

interface Tag {
  name: string;
  closing: boolean;
}

function tagOf(token: string): Tag | null {
  const match = /^<(\/?)([a-zA-Z][\w-]*)/.exec(token);
  return match ? { name: match[2]!.toLowerCase(), closing: match[1] === '/' } : null;
}

export function prettyHTML(html: string, indent = '  '): string {
  const tokens = html.match(TOKEN) ?? [];
  let out = '';
  let depth = 0;
  // The blocks whose children went on lines of their own: their closing tag does too.
  const open: { name: string; spread: boolean }[] = [];
  const line = () => (out ? '\n' : '') + indent.repeat(depth);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const tag = tagOf(token);
    // <pre> keeps its text exactly: copied as it is up to its end.
    if (tag && !tag.closing && tag.name === 'pre') {
      let end = i;
      let nested = 0;
      for (; end < tokens.length; end++) {
        const t = tagOf(tokens[end]!);
        if (t?.name === 'pre') nested += t.closing ? -1 : 1;
        if (nested === 0) break;
      }
      out += line() + tokens.slice(i, end + 1).join('');
      i = end;
      continue;
    }
    if (!tag || !BLOCKS.has(tag.name)) {
      out += token;
      continue;
    }
    if (tag.closing) {
      const block = open.pop();
      if (block?.spread) {
        depth = Math.max(0, depth - 1);
        out += line();
      }
      out += token;
      continue;
    }
    // A block starts a line, unless it is inside text (an inline place keeps it there).
    const parent = open[open.length - 1];
    if (!parent || parent.spread) out += line();
    out += token;
    if (VOID.has(tag.name) || token.endsWith('/>')) continue;
    // Its children on lines of their own only when they are blocks.
    const next = tagOf(tokens[i + 1] ?? '');
    const spread = !!next && !next.closing && BLOCKS.has(next.name);
    open.push({ name: tag.name, spread });
    if (spread) depth++;
  }
  return out;
}
