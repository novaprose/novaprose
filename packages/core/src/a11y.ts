import type { Mark, Node as PMNode } from 'prosemirror-model';

/**
 * Accessibility checks of a document (WCAG 2.1), without a DOM: the a11ychecker plugin uses them in
 * the editor, and `@novaprose/core/a11y` on a server — check stored content before it is published.
 *
 *   import { checkAccessibility } from '@novaprose/core/a11y';
 *   const issues = checkAccessibility(createRenderer(options).doc(json), { level: 'aa' });
 *
 * Rule ids are TinyMCE's where the check is the same (I2, D2…), so lists of ignored rules carry over;
 * N1, N2, N3 are ours.
 */

export type A11yLevel = 'a' | 'aa' | 'aaa';

export interface A11yCheckOptions {
  /** The WCAG level to check against: a, aa (default) or aaa. */
  level?: A11yLevel;
  /** Rule ids not to check, for example ['D1', 'N1']. */
  ignoredRules?: readonly string[];
  /**
   * Whether an image may be decorative: an empty alternative text (alt="") tells screen readers to
   * skip it (yes by default, as WCAG allows; false flags such images too).
   */
  allowDecorativeImages?: boolean;
  /** Alternative text longer than this is a warning (150 characters by default). */
  altTextMaxLength?: number;
  /** The color behind the text where the content is shown, for contrast (white by default). */
  pageBackground?: string;
}

export interface A11yIssue {
  /** The rule: I1–I4 images, D1–D5 document, H93 ids, T4B tables, N1–N3 ours. */
  rule: string;
  severity: 'error' | 'warning';
  /** The WCAG level of the success criterion behind the rule. */
  level: 'A' | 'AA' | 'AAA';
  /** Where it is in the document. */
  from: number;
  to: number;
  /** A short piece of the content it is about. */
  text: string;
  /** What a fix needs: the heading level to change to, the contrast found and needed, the id… */
  data?: Record<string, unknown>;
}

const RULES: Record<string, { severity: 'error' | 'warning'; level: 'A' | 'AA' | 'AAA' }> = {
  I1: { severity: 'error', level: 'A' },
  I2: { severity: 'error', level: 'A' },
  I3: { severity: 'error', level: 'A' },
  I4: { severity: 'warning', level: 'A' },
  D1: { severity: 'warning', level: 'A' },
  D2: { severity: 'error', level: 'A' },
  D3: { severity: 'error', level: 'A' },
  D4O: { severity: 'error', level: 'A' },
  D4U: { severity: 'error', level: 'A' },
  D5A: { severity: 'error', level: 'AA' },
  D5B: { severity: 'error', level: 'AA' },
  D5C: { severity: 'error', level: 'AAA' },
  H93: { severity: 'error', level: 'A' },
  T4B: { severity: 'error', level: 'A' },
  N1: { severity: 'warning', level: 'A' },
  N2: { severity: 'error', level: 'AA' },
  N3: { severity: 'error', level: 'A' },
};

const RANK = { A: 1, AA: 2, AAA: 3, a: 1, aa: 2, aaa: 3 } as const;

/** Link texts that don't say where a link goes. */
const VAGUE_LINKS = new Set([
  'click here',
  'click',
  'here',
  'more',
  'read more',
  'learn more',
  'more info',
  'more information',
  'details',
  'link',
  'this link',
  'this',
  'go',
  'continue',
]);

const BULLET = /^\s*[•◦▪▫‣⁃●○■□–—*-]\s+\S/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+\S/;
/** An alternative text that is a file name, or the name a camera gives. */
const FILE_NAME =
  /^[\w\s().-]+\.(png|jpe?g|gif|webp|svg|bmp|tiff?|heic|avif)$|^(img|dsc|dcim|image|photo|screenshot)[\s_-]?\d+$/i;

/** A text snippet for the list: one line, at most 80 characters. */
function snippet(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}

// ---------- contrast ----------

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  purple: '#800080',
  fuchsia: '#ff00ff',
  lime: '#00ff00',
  olive: '#808000',
  navy: '#000080',
  teal: '#008080',
  aqua: '#00ffff',
};

/** A CSS color as [r, g, b] (0–255), or null for what can't be told here (transparent, unknown names). */
export function parseColor(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string') return null;
  const v = (NAMED[value.trim().toLowerCase()] ?? value).trim().toLowerCase();
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m) return [m[1]!, m[2]!, m[3]!].map((h) => parseInt(h + h, 16)) as [number, number, number];
  m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(ff)?$/.exec(v);
  if (m) return [m[1]!, m[2]!, m[3]!].map((h) => parseInt(h, 16)) as [number, number, number];
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(1|1\.0*)\s*)?\)$/.exec(v);
  if (m)
    return [m[1]!, m[2]!, m[3]!].map((n) => Math.min(255, Number(n))) as [number, number, number];
  return null;
}

/** WCAG relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio of two colors (1 to 21). */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** The browser's heading sizes in pixels, h1 to h6. */
const HEADING_PX = [32, 24, 18.72, 16, 13.28, 10.72];

/** A font size in CSS pixels (px, pt, em, rem, %), or null. */
function pixels(value: unknown): number | null {
  const m = /^(\d+(?:\.\d+)?)(px|pt|em|rem|%)$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === 'px' ? n : m[2] === 'pt' ? (n * 4) / 3 : m[2] === '%' ? (n / 100) * 16 : n * 16;
}

// ---------- the check ----------

interface LinkRun {
  from: number;
  to: number;
  mark: Mark;
  text: string;
  hasImageText: boolean;
}

/** Problems found in the document, in document order. */
export function checkAccessibility(doc: PMNode, options: A11yCheckOptions = {}): A11yIssue[] {
  const maxLevel = RANK[options.level ?? 'aa'] ?? 2;
  const ignored = new Set(options.ignoredRules ?? []);
  const allowDecorative = options.allowDecorativeImages !== false;
  const maxAlt = options.altTextMaxLength ?? 150;
  const page = parseColor(options.pageBackground ?? '#ffffff') ?? [255, 255, 255];
  const issues: A11yIssue[] = [];
  const add = (
    rule: string,
    from: number,
    to: number,
    text: string,
    data?: Record<string, unknown>,
  ) => {
    const spec = RULES[rule]!;
    if (ignored.has(rule) || RANK[spec.level] > maxLevel) return;
    issues.push({ rule, ...spec, from, to, text: snippet(text), ...(data ? { data } : {}) });
  };

  let previousHeading = 0;
  const ids = new Set<string>();
  // Top-level paragraphs that look like list items, in a row.
  let run: {
    kind: 'bullet' | 'ordered';
    from: number;
    to: number;
    texts: string[];
    next: number;
  } | null = null;
  const flush = () => {
    // A numbered "run" of one paragraph ("1. Introduction") is not a list.
    if (run && (run.kind === 'bullet' || run.texts.length > 1)) {
      add(run.kind === 'bullet' ? 'D4U' : 'D4O', run.from, run.to, run.texts.join(' '), {
        kind: run.kind,
      });
    }
    run = null;
  };

  const checkId = (node: PMNode, pos: number) => {
    const id = node.attrs.id;
    if (typeof id !== 'string' || !id) return;
    if (ids.has(id)) add('H93', pos, pos + node.nodeSize, `#${id}`, { id });
    ids.add(id);
  };

  doc.descendants((node, pos, parent) => {
    const end = pos + node.nodeSize;
    const topLevel = parent === doc;
    const name = node.type.name;

    // Paragraphs typed as a list (• item, 1. item): a run of them is one problem.
    if (topLevel) {
      const text = name === 'paragraph' ? node.textContent : '';
      const bullet = BULLET.test(text);
      const number = NUMBERED.exec(text);
      if (bullet && (!run || run.kind === 'bullet')) {
        run ??= { kind: 'bullet', from: pos, to: end, texts: [], next: 0 };
        run.to = end;
        run.texts.push(text);
      } else if (number && (run?.kind === 'ordered' ? Number(number[1]) === run.next : true)) {
        if (run?.kind !== 'ordered') {
          flush();
          run = { kind: 'ordered', from: pos, to: end, texts: [], next: 0 };
        }
        run!.to = end;
        run!.texts.push(text);
        run!.next = Number(number[1]) + 1;
      } else {
        flush();
        if (bullet) run = { kind: 'bullet', from: pos, to: end, texts: [text], next: 0 };
      }
    }

    if (name === 'heading') {
      const level = Math.min(6, Math.max(1, Math.trunc(Number(node.attrs.level)) || 1));
      const text = node.textContent;
      // An image or a mention inside is content too; only line breaks are not.
      let content = false;
      node.forEach((child) => {
        if (!child.isText && child.type.name !== 'hard_break') content = true;
      });
      if (!text.trim() && !content) add('N2', pos, end, '', { level });
      else {
        if (previousHeading && level > previousHeading + 1) {
          add('D2', pos, end, text, { level, to: previousHeading + 1 });
        }
        previousHeading = level;
      }
      checkId(node, pos);
    } else if (name === 'anchor') {
      checkId(node, pos);
    } else if (name === 'image' || name === 'figure_image') {
      // null: no alternative text; "": decorative (alt=""); blank: as good as none.
      const raw = node.attrs.alt;
      const alt = raw === null || raw === undefined ? null : String(raw);
      const file =
        String(node.attrs.src ?? '')
          .split(/[/?#]/)
          .filter(Boolean)
          .pop() ?? '';
      if (alt === null || (alt !== '' && !alt.trim())) add('I2', pos, end, file);
      else if (alt === '') {
        if (!allowDecorative) add('I1', pos, end, file);
      } else if (FILE_NAME.test(alt.trim()) || alt.trim() === file) add('I3', pos, end, alt);
      else if (alt.length > maxAlt) add('I4', pos, end, alt, { length: alt.length, max: maxAlt });
    } else if (name === 'table') {
      let rows = 0;
      let headers = 0;
      node.descendants((child) => {
        if (child.type.name === 'table_row') rows++;
        if (child.type.name === 'table_header') headers++;
        return child.type.spec.tableRole !== 'cell';
      });
      if (rows > 1 && !headers) add('T4B', pos, end, node.textContent);
    }

    if (node.isTextblock) {
      checkTextblock(node, pos, name === 'heading' ? Number(node.attrs.level) || 1 : 0);
      if (topLevel && name === 'paragraph') checkLooksLikeHeading(node, pos);
      // On into the paragraph: images in the text are checked like any other.
    }
    return true;
  });
  flush();

  /** D1: a short, all-bold (or large) paragraph with no closing punctuation. */
  function checkLooksLikeHeading(node: PMNode, pos: number) {
    const text = node.textContent.trim();
    if (!text || text.length > 80 || /[.!?:;,…]$/.test(text) || BULLET.test(text)) return;
    if (NUMBERED.test(text)) return;
    let texts = 0;
    let bold = 0;
    let large = 0;
    node.forEach((child) => {
      if (!child.isText || !child.text!.trim()) return;
      texts++;
      if (child.marks.some((m) => m.type.name === 'bold')) bold++;
      const size = child.marks.find((m) => m.type.name === 'font_size');
      if (size && (pixels(size.attrs.value) ?? 0) >= 20) large++;
    });
    if (!texts || (bold < texts && large < texts)) return;
    add('D1', pos, pos + node.nodeSize, text, {
      level: Math.min(6, Math.max(2, previousHeading + 1)),
    });
  }

  /** Links (D3, N1, N3) and contrast (D5) inside one paragraph or heading. */
  function checkTextblock(node: PMNode, pos: number, headingLevel: number) {
    const start = pos + 1;
    const runs: LinkRun[] = [];
    let current: LinkRun | null = null;
    // Text with too little contrast: consecutive pieces with the same colors are one problem.
    let low: {
      from: number;
      to: number;
      text: string;
      data: Record<string, unknown>;
      key: string;
    } | null = null;
    const flushLow = () => {
      if (low) add(low.data.rule as string, low.from, low.to, low.text, low.data);
      low = null;
    };
    node.forEach((child, offset) => {
      const from = start + offset;
      const to = from + child.nodeSize;
      const link = child.marks.find((m) => m.type.name === 'link');
      if (link && current && current.mark.eq(link) && current.to === from) {
        current.to = to;
        current.text += child.text ?? '';
        current.hasImageText ||= !!(child.attrs.alt && String(child.attrs.alt).trim());
      } else if (link) {
        current = {
          from,
          to,
          mark: link,
          text: child.text ?? '',
          hasImageText: !!(child.attrs.alt && String(child.attrs.alt).trim()),
        };
        runs.push(current);
      } else {
        current = null;
      }

      // Contrast of text with a color of its own or on a highlight.
      if (!child.isText) return;
      const color = child.marks.find((m) => m.type.name === 'color');
      const background = child.marks.find((m) => m.type.name === 'background');
      if (!color && !background) return flushLow();
      // Text without a color of its own is black (the usual default where content is published).
      const fg = color ? parseColor(color.attrs.value) : ([0, 0, 0] as [number, number, number]);
      const bg = background ? parseColor(background.attrs.value) : page;
      if (!fg || !bg) return flushLow();
      // Large text (WCAG): 24px, or 18.66px bold; headings are bold, at the browser's sizes.
      const px =
        pixels(child.marks.find((m) => m.type.name === 'font_size')?.attrs.value) ??
        (headingLevel ? HEADING_PX[headingLevel - 1]! : 16);
      const bold = headingLevel > 0 || child.marks.some((m) => m.type.name === 'bold');
      const large = px >= 24 || (px >= 18.66 && bold);
      const ratio = contrastRatio(fg, bg);
      const rule = maxLevel >= 3 ? 'D5C' : large ? 'D5A' : 'D5B';
      const required = maxLevel >= 3 ? (large ? 4.5 : 7) : large ? 3 : 4.5;
      if (ratio >= required) return flushLow();
      const key = `${String(color?.attrs.value)}|${String(background?.attrs.value)}`;
      const rounded = Math.floor(ratio * 100) / 100;
      if (low && low.key === key && low.to === from) {
        low.to = to;
        low.text += child.text;
      } else {
        flushLow();
        low = { from, to, text: child.text!, key, data: { rule, ratio: rounded, required } };
      }
    });
    flushLow();

    runs.forEach((run, index) => {
      const text = run.text.trim();
      if (!text && !run.hasImageText)
        add('N3', run.from, run.to, String(run.mark.attrs.href ?? ''));
      else if (
        VAGUE_LINKS.has(
          text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, '')
            .trim(),
        )
      )
        add('N1', run.from, run.to, text);
      const next = runs[index + 1];
      if (next && next.mark.attrs.href === run.mark.attrs.href) {
        const between = node.textBetween(run.to - start, next.from - start);
        if (!between.trim()) add('D3', run.from, next.to, `${run.text} ${next.text}`);
      }
    });
  }

  return issues.sort((a, b) => a.from - b.from);
}
