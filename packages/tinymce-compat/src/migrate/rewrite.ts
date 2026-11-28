import type { FileFindings } from './scan';
import { scriptKind } from './scan';

/**
 * The changes the migration makes by itself: imports of the tinymce package become the
 * compatibility layer's (with the NovaProse stylesheet), its parts (theme, model, icons, skins,
 * plugins) go, script tags that load TinyMCE from Tiny Cloud or a public CDN load the drop-in
 * instead, and package.json depends on NovaProse. Everything else is only reported.
 */

export const COMPAT = '@novaprose/tinymce-compat';
const STYLE = '@novaprose/core/style.css';

/** The version range for the CDN address: `0.10` before 1.0, then the major (`1`). */
export function cdnRange(version: string): string {
  const [major = '0', minor = '0'] = version.split('.');
  return major === '0' ? `0.${minor}` : major;
}

export const dropInUrl = (version: string) =>
  `https://cdn.jsdelivr.net/npm/${COMPAT}@${cdnRange(version)}/dist/tinymce.global.js`;

interface Edit {
  start: number;
  end: number;
  text: string;
  change: string;
}

/** The start of the line `index` is on, and the index just past that line's end (its newline included). */
function lineBounds(src: string, index: number): [number, number] {
  const start = src.lastIndexOf('\n', index - 1) + 1;
  const newline = src.indexOf('\n', index);
  return [start, newline < 0 ? src.length : newline + 1];
}

/**
 * The file with the changes the migration can make, and a description of each (null when
 * nothing changes).
 */
export function rewriteSource(
  src: string,
  findings: FileFindings,
  version: string,
): { output: string; changes: string[] } | null {
  const edits: Edit[] = [];
  let styled = src.includes(STYLE);
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  for (const found of findings.imports) {
    if (found.replacement === null) continue;
    if (found.replacement === '') {
      const [start, end] = lineBounds(src, found.start);
      edits.push({ start, end, text: '', change: `line ${found.line}: removed ${found.text}` });
      continue;
    }
    let text = found.replacement;
    if (!styled) {
      // The compatibility layer's module doesn't bring the styles; a bundler takes them from here.
      const indent = src.slice(lineBounds(src, found.start)[0], found.start);
      const style = text.startsWith('import') ? `import '${STYLE}';` : `require('${STYLE}');`;
      text = `${style}${eol}${indent}${text}`;
      styled = true;
    }
    edits.push({
      start: found.start,
      end: found.end,
      text,
      change: `line ${found.line}: ${found.text} → ${text.replace(/\r?\n\s*/g, ' ')}`,
    });
  }
  // Script tags: Tiny Cloud and public CDN copies load the drop-in; a copy of your own is reported.
  const url = dropInUrl(version);
  for (const match of src.matchAll(
    /(<script\b[^>]*?\bsrc\s*=\s*)(["'])([^"']*?\btinymce(?:\.min)?\.js(?:[?#][^"']*)?)\2([^>]*>)/gi,
  )) {
    const old = match[3]!;
    if (scriptKind(old) === 'self-hosted') continue;
    // referrerpolicy="origin" is what Tiny Cloud asks for; the drop-in doesn't need it.
    const rest = match[4]!.replace(/\s+referrerpolicy\s*=\s*(["'])origin\1/i, '');
    const before = match[1]!.replace(/\s+referrerpolicy\s*=\s*(["'])origin\1/i, '');
    const line = src.slice(0, match.index).split('\n').length;
    edits.push({
      start: match.index,
      end: match.index + match[0].length,
      text: `${before}${match[2]}${url}${match[2]}${rest}`,
      change: `line ${line}: <script src="${old}"> → ${url}`,
    });
  }
  if (!edits.length) return null;
  edits.sort((a, b) => b.start - a.start);
  let output = src;
  for (const edit of edits)
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  return { output, changes: edits.reverse().map((edit) => edit.change) };
}

const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/**
 * package.json with NovaProse in place of the tinymce package: the compatibility layer and the core
 * (its stylesheet is imported directly) where tinymce was. `keep`: something still needs tinymce
 * (an import to change by hand, a framework component), so it stays for now. Null when there is
 * no tinymce dependency or NovaProse is already there.
 */
export function rewritePackage(
  text: string,
  version: string,
  keep: boolean,
): { output: string; changes: string[] } | null {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  const changes: string[] = [];
  const range = `^${version}`;
  const has = (name: string) =>
    SECTIONS.some((section) => !!(pkg[section] as Record<string, unknown> | undefined)?.[name]);
  for (const section of SECTIONS) {
    const deps = pkg[section] as Record<string, string> | undefined;
    if (!deps || typeof deps !== 'object' || !('tinymce' in deps)) continue;
    if (has(COMPAT)) continue;
    const next: Record<string, string> = {};
    for (const [name, value] of Object.entries(deps)) {
      if (name !== 'tinymce') {
        next[name] = value;
        continue;
      }
      if (keep) next[name] = value;
      next[COMPAT] = range;
      if (!has('@novaprose/core')) next['@novaprose/core'] = range;
    }
    pkg[section] = next;
    changes.push(
      keep
        ? `${section}: added ${COMPAT} and @novaprose/core ${range} (tinymce stays until nothing uses it)`
        : `${section}: tinymce → ${COMPAT} and @novaprose/core ${range}`,
    );
    break;
  }
  if (!changes.length) return null;
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? '  ';
  const output = JSON.stringify(pkg, null, indent) + (text.endsWith('\n') ? '\n' : '');
  return { output, changes };
}
