import { keymap } from 'prosemirror-keymap';
import type { Node as PMNode } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { activeElement, h } from '../ui/dom';
import type { MenuEntry } from '../ui/menu';
import { Popover } from '../ui/popover';
import css from './spellchecker.css?raw';
import { pickLabels } from './shared';

/**
 * The spellchecker plugin: spelling and grammar checked as you type, by your service. Problems are
 * underlined (spelling red, grammar blue) and marked for screen readers (aria-invalid). A click on
 * one, or Alt+F7 for the next one, opens a bubble with corrections, Ignore, Ignore all and Add to
 * dictionary. A correction is a normal edit: in suggesting mode it becomes a suggestion.
 *
 * The service is yours, like the AI model: `pluginOptions.spellchecker.check` asks your server, or
 * `languageTool: { url }` asks a LanguageTool server (open source; it can run on your own machines).
 * Text goes there paragraph by paragraph, in batches, and a paragraph is checked again only when its
 * text changes. Code is not checked, nor text suggested for deletion. The browser's own spell check
 * is off while this one is on, so words are not underlined twice.
 */

export const LABELS = {
  en: {
    toggle: 'Spell check',
    language: 'Spell check language',
    auto: 'Detect the language',
    spelling: 'Spelling',
    grammar: 'Grammar',
    ignore: 'Ignore',
    ignoreAll: 'Ignore all',
    addToDictionary: 'Add to dictionary',
    noSuggestions: 'No suggestions',
    next: 'Next spelling or grammar problem',
    none: 'No spelling or grammar problems',
    failed: 'The spell check service is not available.',
  },
};

export interface SpellCheckRequest {
  /** The text to check: one or more paragraphs, separated by a blank line. */
  text: string;
  /** The language: en-US, de-DE…, or auto (the service detects it). */
  language: string;
  /** Cancelled when the editor closes. */
  signal: AbortSignal;
}

export interface SpellCheckMatch {
  /** Where the problem starts in `text` (in UTF-16 code units, as in JavaScript strings). */
  offset: number;
  /** How long it is. */
  length: number;
  /** spelling (a misspelled word, the default) or grammar (grammar and style). */
  kind?: 'spelling' | 'grammar';
  /** What is wrong, for the person: shown in the bubble. */
  message?: string;
  /** Corrections, best first: up to five are shown. */
  replacements?: string[];
}

export interface SpellCheckerOptions {
  /** Your checking service, through your server: the problems found in the text. */
  check?: (request: SpellCheckRequest) => Promise<SpellCheckMatch[]>;
  /**
   * A LanguageTool server, yours or a hosted one, when `check` isn't given: its address
   * (https://lt.example.com, the API is at /v2/check), headers for it, and `picky` for more style hints.
   */
  languageTool?: { url: string; headers?: Record<string, string>; level?: 'default' | 'picky' };
  /** The language to check in (auto by default: the service detects it). */
  language?: string;
  /** Languages in the button's menu: [{ code: 'en-US', name: 'English (US)' }, …]. */
  languages?: { code: string; name: string }[];
  /** Start with checking on (yes by default). */
  active?: boolean;
  /** Words never marked: names, product terms. */
  ignore?: string[];
  /** Save a word in your dictionary ("Add to dictionary" shows when this is given). */
  addToDictionary?: (word: string, language: string) => void | Promise<void>;
}

/** A problem on the page: the match and the text it covers. */
interface Problem extends SpellCheckMatch {
  kind: 'spelling' | 'grammar';
  word: string;
}

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/><path d="m16 20 2 2 4-4"/></svg>';

/** How much text one request carries, at most. */
const BATCH_CHARS = 6000;

const spellKey = new PluginKey<DecorationSet>('nova-spellchecker');

/** One checker per editor: the plugin's ProseMirror part and its setup share it. */
const checkers = new WeakMap<Editor, ReturnType<typeof createChecker>>();

type Found = Problem & { from: number; to: number; text: string };

/** The problem at a position (a click), or exactly at from..to (the bubble). */
function problemAt(state: EditorState, from: number, to = from): Found | null {
  const set = spellKey.getState(state);
  const found = set
    ?.find(from, to)
    .find((d) => (from === to ? d.from <= from && d.to >= from : d.from === from && d.to === to));
  return found
    ? { ...(found.spec.problem as Problem & { text: string }), from: found.from, to: found.to }
    : null;
}

/**
 * A paragraph's text, one character for every position in it: a line break is "\n", anything else
 * that isn't text (an image, a mention) a space. So an offset in the text is an offset in the document.
 */
export function blockText(node: PMNode): string {
  return node.textBetween(0, node.content.size, '\n', (leaf) =>
    leaf.type.name === 'hard_break' ? '\n' : ' ',
  );
}

/** LanguageTool's /v2/check as a `check` function. */
export function languageTool(options: NonNullable<SpellCheckerOptions['languageTool']>) {
  return async ({ text, language, signal }: SpellCheckRequest): Promise<SpellCheckMatch[]> => {
    const body = new URLSearchParams({ text, language: language || 'auto' });
    if (options.level === 'picky') body.set('level', 'picky');
    const response = await fetch(`${options.url.replace(/\/+$/, '')}/v2/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...options.headers },
      body,
      signal,
    });
    if (!response.ok) throw new Error(`LanguageTool answered ${response.status}`);
    const data = (await response.json()) as {
      matches?: {
        offset?: number;
        length?: number;
        message?: string;
        replacements?: { value?: string }[];
        rule?: { issueType?: string; category?: { id?: string } };
      }[];
    };
    return (data.matches ?? []).map((match) => ({
      offset: Number(match.offset),
      length: Number(match.length),
      message: match.message,
      replacements: (match.replacements ?? []).map((r) => String(r.value ?? '')).filter(Boolean),
      kind:
        match.rule?.issueType === 'misspelling' || match.rule?.category?.id === 'TYPOS'
          ? 'spelling'
          : 'grammar',
    }));
  };
}

/** A match from the service, checked: a whole range inside the text, strings where strings go. */
function cleanMatch(match: unknown, text: string): SpellCheckMatch | null {
  const m = match as Partial<SpellCheckMatch> | null;
  const offset = Math.trunc(Number(m?.offset));
  const length = Math.trunc(Number(m?.length));
  if (!Number.isFinite(offset) || !Number.isFinite(length)) return null;
  if (offset < 0 || length <= 0 || offset + length > text.length) return null;
  return {
    offset,
    length,
    kind: m?.kind === 'grammar' ? 'grammar' : 'spelling',
    message: typeof m?.message === 'string' ? m.message.slice(0, 500) : '',
    replacements: Array.isArray(m?.replacements)
      ? m.replacements
          .filter((r): r is string => typeof r === 'string' && r.length > 0)
          .map((r) => r.slice(0, 200))
          .slice(0, 5)
      : [],
  };
}

export default definePlugin({
  name: 'spellchecker',
  toolbar: 'spellchecker',
  prosemirrorPlugins: (editor) => {
    const checker = checkers.get(editor) ?? createChecker(editor);
    checkers.set(editor, checker);
    return [
      new Plugin<DecorationSet>({
        key: spellKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const fresh = tr.getMeta(spellKey) as DecorationSet | undefined;
            if (fresh) return fresh;
            if (!tr.docChanged) return set;
            const mapped = set.map(tr.mapping, tr.doc);
            // Underlines where the text changed are out of date until the next check.
            const stale: Decoration[] = [];
            tr.mapping.maps.forEach((map, index) => {
              const after = tr.mapping.slice(index + 1);
              map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                stale.push(...mapped.find(after.map(newStart, -1), after.map(newEnd, 1)));
              });
            });
            return stale.length ? mapped.remove(stale) : mapped;
          },
        },
        props: {
          decorations: (state) => spellKey.getState(state),
          // The browser's own check would underline the same words a second time.
          attributes: (): Record<string, string> => (checker.active ? { spellcheck: 'false' } : {}),
          handleClick(view, pos) {
            const problem = problemAt(view.state, pos);
            if (!problem) return false;
            // After ProseMirror puts the cursor where the click was.
            setTimeout(() => checker.openBubble(problem.from, problem.to, false));
            return false;
          },
        },
        view: () => ({
          update(view, previous) {
            if (view.state.doc === previous.doc) return;
            // The bubble's problem may have moved or gone: a correction must not land elsewhere.
            checker.closeBubble();
            checker.schedule();
          },
          destroy: () => checker.destroy(),
        }),
      }),
      keymap({ 'Alt-F7': () => checker.next() }),
    ];
  },
  setup(editor) {
    const checker = checkers.get(editor)!;
    const labels = checker.labels;
    editor.ui.addStyles('nova-spellchecker', css);
    const languages = checker.options.languages ?? [];
    editor.ui.registry.addSplitButton('spellchecker', {
      icon: ICON,
      tooltip: labels.toggle,
      isActive: () => checker.active,
      onAction: () => checker.setActive(!checker.active),
      items: (): MenuEntry[] => [
        {
          id: 'toggle',
          label: labels.toggle,
          active: checker.active,
          checkbox: true,
          onSelect: () => checker.setActive(!checker.active),
        },
        {
          id: 'next',
          label: labels.next,
          shortcut: 'Alt-F7',
          disabled: !checker.active,
          onSelect: () => void checker.next(),
        },
        { type: 'separator' },
        { type: 'heading', label: labels.language },
        ...[{ code: 'auto', name: labels.auto }, ...languages].map((language): MenuEntry => ({
          id: `language-${language.code}`,
          label: language.name,
          active: checker.language === language.code,
          onSelect: () => checker.setLanguage(language.code),
        })),
      ],
    });
    editor.ui.registry.addMenuItem('spellchecker', {
      text: labels.toggle,
      icon: ICON,
      isActive: () => checker.active,
      onAction: () => checker.setActive(!checker.active),
    });
    // Named as in TinyMCE, where it opens a dialog that steps through the problems: here the next
    // problem's bubble (Alt+F7).
    editor.ui.registry.addButton('spellcheckdialog', {
      icon: ICON,
      tooltip: labels.next,
      shortcut: 'Alt-F7',
      isEnabled: () => checker.active,
      onAction: () => void checker.next(),
    });
    checker.start();
    // A dialog opening (or editor.ui.closeOverlays) closes the bubble, like the editor's own panels.
    return editor.ui.onDialogOpen(() => checker.closeBubble());
  },
});

function createChecker(editor: Editor) {
  const options = (editor.options.pluginOptions?.spellchecker ?? {}) as SpellCheckerOptions;
  const labels = pickLabels(editor, 'spellchecker', LABELS);
  const check =
    options.check ?? (options.languageTool?.url ? languageTool(options.languageTool) : null);
  // What the service said, by language and paragraph text: a paragraph is asked about only once.
  const cache = new Map<string, SpellCheckMatch[]>();
  const asking = new Set<string>();
  const ignoredWords = new Set(options.ignore ?? []);
  const ignoredMatches = new Set<string>();
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let again = false;
  let warned = false;
  let bubble: Popover | null = null;
  const key = (language: string, text: string) => `${language}\u0000${text}`;

  const checker = {
    options,
    labels,
    active: options.active !== false && !!check,
    language: options.language || 'auto',

    start() {
      if (checker.active) checker.schedule(0);
    },

    schedule(delay = 700) {
      if (!checker.active || abort.signal.aborted) return;
      clearTimeout(timer);
      timer = setTimeout(() => void checker.run(), delay);
    },

    /** Ask about the paragraphs not asked about yet, in batches; underline as answers come. */
    async run() {
      if (running) {
        again = true;
        return;
      }
      if (!check || !checker.active) return;
      running = true;
      try {
        const language = checker.language;
        const texts: string[] = [];
        editor.view.state.doc.descendants((node) => {
          if (!node.isTextblock) return true;
          if (node.type.spec.code) return false;
          const text = blockText(node);
          const k = key(language, text);
          if (text.trim() && !cache.has(k) && !asking.has(k) && !texts.includes(text))
            texts.push(text);
          return false;
        });
        while (texts.length && !abort.signal.aborted && checker.language === language) {
          const batch: string[] = [];
          let size = 0;
          while (texts.length && (!batch.length || size + texts[0]!.length < BATCH_CHARS)) {
            const text = texts.shift()!;
            batch.push(text);
            size += text.length + 2;
          }
          batch.forEach((text) => asking.add(key(language, text)));
          const joined = batch.join('\n\n');
          let matches: unknown[] = [];
          try {
            const answer = await check({ text: joined, language, signal: abort.signal });
            matches = Array.isArray(answer) ? answer : [];
          } catch (error) {
            batch.forEach((text) => asking.delete(key(language, text)));
            if (abort.signal.aborted) return;
            if (!warned) {
              warned = true;
              console.warn('[nova] spellchecker:', error);
              editor.ui.notify({ text: labels.failed, type: 'warning' });
            }
            return;
          }
          // Answers for the joined text go back to their paragraphs.
          let start = 0;
          for (const text of batch) {
            const own: SpellCheckMatch[] = [];
            for (const raw of matches) {
              const offset = Number((raw as SpellCheckMatch | null)?.offset) - start;
              const match = cleanMatch({ ...(raw as object), offset }, text);
              if (match) own.push(match);
            }
            cache.set(key(language, text), own);
            asking.delete(key(language, text));
            start += text.length + 2;
          }
          checker.paint();
        }
      } finally {
        running = false;
        if (again) {
          again = false;
          checker.schedule(0);
        }
      }
    },

    /** Underlines from what is known; paragraphs still being checked keep the ones they had. */
    paint() {
      if (abort.signal.aborted) return;
      const { state } = editor.view;
      const current = spellKey.getState(state) ?? DecorationSet.empty;
      const types = state.schema.marks;
      const skip = [types.code, types.suggestion_delete].filter(Boolean);
      const decorations: Decoration[] = [];
      if (checker.active) {
        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;
          if (node.type.spec.code) return false;
          const text = blockText(node);
          const known = cache.get(key(checker.language, text));
          const start = pos + 1;
          if (!known) {
            decorations.push(...current.find(start, start + node.content.size));
            return false;
          }
          for (const match of known) {
            const from = start + match.offset;
            const to = from + match.length;
            const word = text.slice(match.offset, match.offset + match.length);
            const kind = match.kind === 'grammar' ? 'grammar' : 'spelling';
            if (kind === 'spelling' && ignoredWords.has(word)) continue;
            if (ignoredMatches.has(`${key(checker.language, text)}\u0000${match.offset}`)) continue;
            if (skip.some((type) => state.doc.rangeHasMark(from, to, type!))) continue;
            decorations.push(
              Decoration.inline(
                from,
                to,
                { class: `nova-spell nova-spell-${kind}`, 'aria-invalid': kind },
                { problem: { ...match, kind, word, text } },
              ),
            );
          }
          return false;
        });
      }
      editor.view.dispatch(
        state.tr
          .setMeta(spellKey, DecorationSet.create(state.doc, decorations))
          .setMeta('addToHistory', false),
      );
    },

    setActive(value: boolean) {
      if (!check) {
        editor.ui.notify({ text: labels.failed, type: 'warning' });
        return;
      }
      checker.active = value;
      checker.closeBubble();
      editor.view.setProps({});
      checker.paint();
      if (value) checker.schedule(0);
      editor.updateUI();
    },

    setLanguage(code: string) {
      checker.language = code;
      checker.closeBubble();
      checker.paint();
      checker.schedule(0);
      editor.updateUI();
    },

    /** The next problem after the cursor (from the top after the last one): its bubble, focused. */
    next(): boolean {
      if (!checker.active) return false;
      const { state } = editor.view;
      const set = spellKey.getState(state) ?? DecorationSet.empty;
      const all = set.find();
      const after = all
        .filter((d) => d.from > state.selection.from)
        .sort((a, b) => a.from - b.from);
      const target = after[0] ?? [...all].sort((a, b) => a.from - b.from)[0];
      if (!target) {
        editor.ui.announce(labels.none);
        return true;
      }
      editor.view.dispatch(
        state.tr
          .setSelection(TextSelection.create(state.doc, target.from, target.to))
          .scrollIntoView(),
      );
      checker.openBubble(target.from, target.to, true);
      return true;
    },

    /** The bubble of the problem at from..to: corrections and what else can be done. */
    openBubble(from: number, to: number, focus: boolean) {
      checker.closeBubble();
      const problem = problemAt(editor.view.state, from, to);
      if (!problem) return;
      const { view } = editor;
      const done = (tr?: Transaction) => {
        checker.closeBubble();
        if (tr) view.dispatch(tr);
        editor.focus();
      };
      const replace = (value: string) => {
        const { state } = view;
        const tr = state.tr.insertText(value, problem.from, problem.to);
        tr.setSelection(TextSelection.create(tr.doc, problem.from + value.length));
        done(tr.scrollIntoView());
      };
      const ignore = (all: boolean) => {
        if (all) ignoredWords.add(problem.word);
        else ignoredMatches.add(`${key(checker.language, problem.text)}\u0000${problem.offset}`);
        done();
        checker.paint();
      };
      const button = (label: string, onClick: () => void, className = '') =>
        h(
          'button',
          { type: 'button', className: `nova-button ${className}`.trim(), onClick },
          label,
        );
      const replacements = problem.replacements ?? [];
      const content = h(
        'div',
        {
          className: 'nova-spell-bubble',
          role: 'dialog',
          'aria-label': `${problem.kind === 'grammar' ? labels.grammar : labels.spelling}: ${problem.word}`,
        },
        problem.message ? h('p', { className: 'nova-spell-message' }, problem.message) : null,
        h(
          'div',
          { className: 'nova-spell-fixes' },
          replacements.length
            ? replacements.map((value) => button(value, () => replace(value), 'nova-spell-fix'))
            : h('span', { className: 'nova-spell-none' }, labels.noSuggestions),
        ),
        h(
          'div',
          { className: 'nova-spell-actions' },
          button(labels.ignore, () => ignore(false)),
          problem.kind === 'spelling' ? button(labels.ignoreAll, () => ignore(true)) : null,
          problem.kind === 'spelling' && options.addToDictionary
            ? button(labels.addToDictionary, () => {
                void Promise.resolve(
                  options.addToDictionary!(problem.word, checker.language),
                ).catch((error: unknown) => console.warn('[nova] spellchecker:', error));
                ignore(true);
              })
            : null,
        ),
      );
      content.addEventListener('keydown', (event) => {
        // Arrows move between the buttons, like in a toolbar.
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
        const buttons = [...content.querySelectorAll<HTMLButtonElement>('button')];
        const index = buttons.indexOf(activeElement(content) as HTMLButtonElement);
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
        event.preventDefault();
      });
      bubble = new Popover({
        host: editor.ui.overlayHost,
        anchor: () => {
          const start = view.coordsAtPos(problem.from);
          const end = view.coordsAtPos(problem.to);
          return new DOMRect(
            start.left,
            start.top,
            Math.max(1, end.right - start.left),
            end.bottom - start.top,
          );
        },
        content,
        placement: 'bottom-start',
        className: 'nova-spell-popover',
        onClose: (reason) => {
          bubble = null;
          if (reason === 'escape') editor.focus();
        },
      });
      if (focus) content.querySelector('button')?.focus();
    },

    closeBubble() {
      bubble?.close();
      bubble = null;
    },

    destroy() {
      clearTimeout(timer);
      abort.abort();
      checker.closeBubble();
    },
  };
  return checker;
}
