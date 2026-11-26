import type { HLJSApi, LanguageFn } from 'highlight.js';
import {
  ALIASES,
  GRAMMAR_DEPENDENCIES,
  type CodeGrammar,
  type CodeGrammarLoader,
} from './code-languages';

/**
 * Code highlighting with highlight.js: the core and grammars load on demand (the first code block in a
 * language); the result is text ranges with `hljs-*` classes for decorations (Decoration.inline).
 */

/** A highlighted range: offsets in the block's text and classes (as in highlight.js: `hljs-keyword`). */
export interface HighlightSegment {
  from: number;
  to: number;
  className: string;
}

/** The highlighting result: ranges; null means nothing to highlight; 'loading' means the grammar is loading. */
export type HighlightResult = HighlightSegment[] | null | 'loading';

let core: Promise<HLJSApi> | null = null;

/** The highlight.js core: one module per page (a second call doesn't download it again). */
function loadCore(): Promise<HLJSApi> {
  core ??= import('highlight.js/lib/core').then(
    (module) => module.default,
    (error: unknown) => {
      core = null; // a network hiccup: the next code block tries again
      throw error;
    },
  );
  return core;
}

// highlight.js markup: <span class="…">, </span>, escaped characters and text.
const TOKEN = /<span class="([^"]*)">|<\/span>|&(?:amp|lt|gt|quot|#x27);|[^<&]+/g;

/**
 * highlight.js HTML → ranges without nesting: every piece of text gets the classes of all enclosing
 * scopes (`hljs-meta hljs-keyword`), adjacent pieces with the same classes are merged.
 * null if the text length doesn't match the code (unexpected markup): better no highlighting than
 * highlighting the wrong characters.
 */
export function toSegments(html: string, length: number): HighlightSegment[] | null {
  const segments: HighlightSegment[] = [];
  const stack: string[] = [];
  let pos = 0;
  for (const match of html.matchAll(TOKEN)) {
    const text = match[0];
    if (match[1] !== undefined) {
      // language-xml and the like wrap a nested language and aren't needed for decorations.
      stack.push(
        match[1]
          .split(' ')
          .filter((name) => name && !name.startsWith('language-'))
          .join(' '),
      );
    } else if (text === '</span>') {
      stack.pop();
    } else {
      const size = text.charCodeAt(0) === 38 /* & */ ? 1 : text.length;
      const className = stack.filter(Boolean).join(' ');
      if (className) {
        const last = segments[segments.length - 1];
        if (last && last.to === pos && last.className === className) last.to += size;
        else segments.push({ from: pos, to: pos + size, className });
      }
      pos += size;
    }
  }
  return pos === length ? segments : null;
}

/**
 * Highlighting for one editor: its own highlight.js instance (highlight.js settings on the site's page
 * don't affect us, and our grammars don't conflict with other editors).
 */
export class Highlighter {
  private hljs: HLJSApi | null = null;
  private readonly loading = new Map<string, Promise<void>>();
  private readonly failed = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly grammars: Record<string, CodeGrammarLoader>) {}

  /** The grammar for a block's language: by name or alias; null when the language is not set or unknown. */
  grammarFor(language: string | null): string | null {
    if (!language) return null;
    const key = language.toLowerCase();
    const name = Object.hasOwn(this.grammars, key) ? key : ALIASES[key];
    return name && Object.hasOwn(this.grammars, name) ? name : null;
  }

  highlight(code: string, language: string | null): HighlightResult {
    const name = this.grammarFor(language);
    if (!name || this.failed.has(name)) return null;
    const hljs = this.hljs;
    if (!hljs?.getLanguage(name)) {
      void this.load(name);
      return 'loading';
    }
    try {
      return toSegments(
        hljs.highlight(code, { language: name, ignoreIllegals: true }).value,
        code.length,
      );
    } catch {
      return null;
    }
  }

  /** Loads a grammar (and the ones it needs); onLoad listeners learn when it is ready. */
  load(name: string): Promise<void> {
    let promise = this.loading.get(name);
    if (promise) return promise;
    const names = [name, ...(GRAMMAR_DEPENDENCIES[name] ?? [])].filter((n) =>
      Object.hasOwn(this.grammars, n),
    );
    promise = Promise.all([loadCore(), ...names.map((n) => this.grammars[n]!())])
      .then(([module, ...grammars]) => {
        this.hljs ??= (module as HLJSApi).newInstance();
        grammars.forEach((grammar, i) => {
          const fn = (typeof grammar === 'function' ? grammar : grammar.default) as CodeGrammar;
          if (!this.hljs!.getLanguage(names[i]!)) {
            this.hljs!.registerLanguage(names[i]!, fn as unknown as LanguageFn);
          }
        });
        for (const listener of this.listeners) listener();
      })
      .catch((error: unknown) => {
        this.failed.add(name);
        console.warn(`[nova] codesample: could not load the "${name}" grammar`, error);
      });
    this.loading.set(name, promise);
    return promise;
  }

  /** Subscribes to grammar loads; returns the unsubscribe function. */
  onLoad(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Every started load has finished (for tests and printing). */
  async idle(): Promise<void> {
    let size = -1;
    while (size !== this.loading.size) {
      size = this.loading.size;
      await Promise.all(this.loading.values());
    }
  }
}
