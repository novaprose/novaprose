import type { HLJSApi, LanguageFn } from 'highlight.js';
import {
  ALIASES,
  GRAMMAR_DEPENDENCIES,
  type CodeGrammar,
  type CodeGrammarLoader,
} from './code-languages';

/**
 * Подсветка кода на highlight.js: ядро и грамматики грузятся по требованию (первый блок кода на
 * языке), результат — отрезки текста с классами `hljs-*` для оформления (Decoration.inline).
 */

/** Отрезок подсветки: смещения в тексте блока и классы (как у highlight.js: `hljs-keyword`). */
export interface HighlightSegment {
  from: number;
  to: number;
  className: string;
}

/** Результат подсветки: отрезки; null — подсвечивать нечего; 'loading' — грамматика грузится. */
export type HighlightResult = HighlightSegment[] | null | 'loading';

let core: Promise<HLJSApi> | null = null;

/** Ядро highlight.js — один модуль на страницу (второй вызов не скачивает его заново). */
function loadCore(): Promise<HLJSApi> {
  core ??= import('highlight.js/lib/core').then(
    (module) => module.default,
    (error: unknown) => {
      core = null; // сеть моргнула — следующий блок кода попробует снова
      throw error;
    },
  );
  return core;
}

// Разметка highlight.js: <span class="…">, </span>, экранированные символы и текст.
const TOKEN = /<span class="([^"]*)">|<\/span>|&(?:amp|lt|gt|quot|#x27);|[^<&]+/g;

/**
 * HTML highlight.js → отрезки без вложенности: у каждого куска текста — классы всех объемлющих
 * областей (`hljs-meta hljs-keyword`), соседние куски с одинаковыми классами склеены.
 * null, если длина текста не сошлась с кодом (неожиданная разметка): лучше без подсветки, чем
 * подсветка не тех символов.
 */
export function toSegments(html: string, length: number): HighlightSegment[] | null {
  const segments: HighlightSegment[] = [];
  const stack: string[] = [];
  let pos = 0;
  for (const match of html.matchAll(TOKEN)) {
    const text = match[0];
    if (match[1] !== undefined) {
      // language-xml и т. п. — обёртка вложенного языка, для оформления не нужна.
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
 * Подсветка для одного редактора: свой экземпляр highlight.js (настройки highlight.js на странице
 * сайта нам не мешают, свои грамматики не конфликтуют с чужими редакторами).
 */
export class Highlighter {
  private hljs: HLJSApi | null = null;
  private readonly loading = new Map<string, Promise<void>>();
  private readonly failed = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly grammars: Record<string, CodeGrammarLoader>) {}

  /** Грамматика для языка блока: по имени или синониму; null — язык не задан или неизвестен. */
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

  /** Загрузить грамматику (и нужные ей) — слушатели onLoad узнают о готовности. */
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

  /** Подписка на загрузку грамматик; возвращает отписку. */
  onLoad(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Все начатые загрузки завершены (для тестов и печати). */
  async idle(): Promise<void> {
    let size = -1;
    while (size !== this.loading.size) {
      size = this.loading.size;
      await Promise.all(this.loading.values());
    }
  }
}
