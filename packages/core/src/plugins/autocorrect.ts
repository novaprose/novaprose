import { closeHistory } from 'prosemirror-history';
import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import type { MenuEntry } from '../ui/menu';
import css from './autocorrect.css?raw';
import {
  findCorrection,
  wordKey,
  type CorrectionKind,
  type RuleSettings,
} from './autocorrect-rules';
import { pickLabels } from './shared';

/**
 * The autocorrect plugin: typos are corrected as you type ("teh " → "the "), "i" becomes "I", TWo
 * INitial CApitals lose the second capital, and, when turned on, sentences start with a capital
 * letter. A word is corrected when it ends (a space, a punctuation mark, Enter), in the case you
 * typed it ("Teh" → "The") and with its formatting. Backspace right after a correction puts back what
 * you typed, and that word is then left alone; Ctrl+Z undoes a correction as a step of its own.
 * Screen readers hear each correction. Everything happens in the browser, no server is asked.
 *
 * The built-in list is English (common typos only, words that are never right as typed); your own
 * corrections work in any language, and capitals in any language that has them.
 */

export const LABELS = {
  en: {
    title: 'Autocorrect',
    spelling: 'Correct typos as you type',
    capitalize: 'Capitalize the first letter of sentences',
    changed: '{word} changed to {replacement}',
    reverted: '{word} put back',
  },
};

export interface AutocorrectOptions {
  /**
   * Correct typos as you type: the built-in English list and your `replacements`, "i" → "I", TWo
   * INitial CApitals. true by default.
   */
  autocorrect?: boolean;
  /** Start sentences with a capital letter. false by default. */
  capitalize?: boolean;
  /**
   * Your own corrections in any language, a typo → the right word: `{ recieve: 'receive' }`. A typo
   * is found whatever its case, and the case it was typed in is kept. They add to the built-in list
   * and win over it.
   */
  replacements?: Record<string, string>;
  /** The built-in English list of common typos. true by default; it applies to English content. */
  builtInList?: boolean;
  /** Words never changed, such as names of products: `['VMware', 'npm']`. */
  ignore?: string[];
  /**
   * The language of the content ('en', 'de-DE'…): the built-in list and "i" → "I" are for English. By
   * default the spell checker's language, otherwise the `lang` attribute of the page.
   */
  language?: string;
  /** Remember the person's choice from the menu (in localStorage) the next time. true by default. */
  remember?: boolean;
  /** Called after each correction, and again with `reverted: true` when the person takes it back. */
  onCorrect?: (correction: AutocorrectCorrection) => void;
}

export interface AutocorrectCorrection {
  /** What was typed. */
  word: string;
  /** What it became. */
  replacement: string;
  /** A typo from a list, TWo INitial CApitals, or the first letter of a sentence. */
  kind: CorrectionKind;
  /** The person took the correction back (Backspace right after it). */
  reverted: boolean;
}

/** The last correction, while Backspace can still take it back. */
interface Last {
  from: number;
  to: number;
  word: string;
  replacement: string;
  kind: CorrectionKind;
  after?: string;
  /** Where the cursor was right after the correction. */
  cursor: number;
}

const key = new PluginKey<Last | null>('nova-autocorrect');
const STORAGE = 'novaprose-autocorrect';
/** A word in a block's text: an object (image, mention) is one character, a line break a newline. */
const leafText = (node: PMNode) => (node.type.name === 'hard_break' ? '\n' : '￼');
/** How much of the block before the cursor is looked at: enough for the sentence the word is in. */
const CONTEXT = 400;
/** What ends a word as it's typed. */
const ENDS_WORD = /[\s.,;:!?…)\]}"'”’»]$/u;

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 18 5-13 5 13"/><path d="M5 13h6"/><path d="m19 4-3 7h4l-3 7"/></svg>';

const editors = new WeakMap<Editor, ReturnType<typeof createAutocorrect>>();

export default definePlugin({
  name: 'autocorrect',
  // A button to switch it off, with the capitals option in its menu.
  toolbar: 'autocorrect',
  prosemirrorPlugins: (editor) => {
    const ac = editors.get(editor) ?? createAutocorrect(editor);
    editors.set(editor, ac);
    return [ac.plugin];
  },
  setup(editor) {
    const ac = editors.get(editor)!;
    const { labels } = ac;
    editor.ui.addStyles('nova-autocorrect', css);
    const toggles = (): MenuEntry[] => [
      {
        id: 'autocorrect',
        label: labels.spelling,
        checkbox: true,
        active: ac.settings.autocorrect,
        onSelect: () => ac.set('autocorrect', !ac.settings.autocorrect),
      },
      {
        id: 'capitalize',
        label: labels.capitalize,
        checkbox: true,
        active: ac.settings.capitalize,
        onSelect: () => ac.set('capitalize', !ac.settings.capitalize),
      },
    ];
    editor.ui.registry.addSplitButton('autocorrect', {
      icon: ICON,
      tooltip: labels.title,
      isActive: () => ac.settings.autocorrect,
      onAction: () => ac.set('autocorrect', !ac.settings.autocorrect),
      items: toggles,
    });
    // The menu items have TinyMCE's names: autocorrect and capitalization (in the Tools menu).
    editor.ui.registry.addMenuItem('autocorrect', {
      text: labels.spelling,
      icon: ICON,
      isActive: () => ac.settings.autocorrect,
      onAction: () => ac.set('autocorrect', !ac.settings.autocorrect),
    });
    editor.ui.registry.addMenuItem('capitalization', {
      text: labels.capitalize,
      isActive: () => ac.settings.capitalize,
      onAction: () => ac.set('capitalize', !ac.settings.capitalize),
    });
  },
});

function createAutocorrect(editor: Editor) {
  const options = (editor.options.pluginOptions?.autocorrect ?? {}) as AutocorrectOptions;
  const labels = pickLabels(editor, 'autocorrect', LABELS);
  const remember = options.remember !== false;
  const saved = remember ? readSaved() : {};
  const settings = {
    autocorrect: saved.autocorrect ?? options.autocorrect !== false,
    capitalize: saved.capitalize ?? options.capitalize === true,
  };
  const replacements = new Map<string, string>();
  if (options.replacements && typeof options.replacements === 'object') {
    for (const [typo, right] of Object.entries(options.replacements)) {
      if (typeof right === 'string' && right && typo.trim()) replacements.set(wordKey(typo), right);
    }
  }
  const spellIgnore = (
    editor.options.pluginOptions?.spellchecker as { ignore?: unknown } | undefined
  )?.ignore;
  /** Words left alone: from the options, the spell checker's list, and the ones taken back. */
  const ignore = new Set(
    [options.ignore, spellIgnore]
      .flatMap((list) => (Array.isArray(list) ? list : []))
      .filter((word): word is string => typeof word === 'string')
      .map(wordKey),
  );
  /** Abbreviations learned when a capital after one was taken back ("approx. the"). */
  const abbreviations = new Set<string>();
  /** What was typed to end a word: the correction waits until it's in the document. */
  let pending: string | null = null;

  const english = () => {
    const spell = (editor.options.pluginOptions?.spellchecker as { language?: unknown } | undefined)
      ?.language;
    let language = options.language ?? (typeof spell === 'string' && spell !== 'auto' ? spell : '');
    if (!language) {
      const dom = editor.view?.dom as HTMLElement | undefined;
      language =
        dom?.closest('[lang]')?.getAttribute('lang') ??
        dom?.ownerDocument.documentElement.lang ??
        '';
    }
    return !language || /^en\b/i.test(language);
  };

  const rules = (): RuleSettings => ({
    autocorrect: settings.autocorrect,
    capitalize: settings.capitalize,
    replacements,
    english: options.builtInList !== false && english(),
    ignore,
    abbreviations,
  });

  /** Corrects the word before the cursor; `trailer`: what ended the word was just typed after it. */
  const correct = (view: EditorView, trailer: boolean) => {
    if (view.isDestroyed || !editor.isEditable()) return;
    const { state } = view;
    const { selection } = state;
    if (!selection.empty) return;
    const $head = selection.$head;
    const block = $head.parent;
    if (!block.isTextblock || block.type.spec.code) return;
    const offset = $head.parentOffset;
    const start = Math.max(0, offset - CONTEXT);
    const text = block.textBetween(start, offset, undefined, leafText);
    const found = findCorrection(text, rules(), { blockStart: start === 0, trailer });
    if (!found) return;
    const from = $head.pos - (text.length - found.start);
    const to = from + found.word.length;
    // Positions follow characters only for text and objects: anything else and the word is left alone.
    if (from < $head.start() || state.doc.textBetween(from, to) !== found.word) return;
    let code = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isInline && node.marks.some((mark) => mark.type.spec.code)) code = true;
    });
    if (code) return;
    const tr = replaceChanged(state.tr, from, found.word, found.replacement);
    // A step of its own in the undo history: Ctrl+Z right after it puts back what was typed.
    closeHistory(tr);
    const last: Last = {
      from,
      to: from + found.replacement.length,
      word: found.word,
      replacement: found.replacement,
      kind: found.kind,
      ...(found.after ? { after: found.after } : {}),
      cursor: tr.selection.head,
    };
    view.dispatch(tr.setMeta(key, last));
    // And what comes next (Enter's new paragraph) is a step of its own too.
    view.dispatch(closeHistory(view.state.tr));
    editor.ui.announce(
      labels.changed.replace('{word}', found.word).replace('{replacement}', found.replacement),
    );
    notify(last, false);
  };

  /** Backspace right after a correction: what was typed comes back, and the word is left alone. */
  const revert = (view: EditorView): boolean => {
    const last = key.getState(view.state);
    const { selection, doc } = view.state;
    if (!last || !selection.empty || selection.head !== last.cursor) return false;
    if (doc.textBetween(last.from, last.to) !== last.replacement) return false;
    view.dispatch(
      replaceChanged(view.state.tr, last.from, last.replacement, last.word)
        .setMeta(key, null)
        .scrollIntoView(),
    );
    if (last.kind === 'sentence' && last.after) abbreviations.add(last.after.toLowerCase());
    else ignore.add(wordKey(last.word));
    editor.ui.announce(labels.reverted.replace('{word}', last.word));
    notify(last, true);
    return true;
  };

  const notify = (last: Last, reverted: boolean) => {
    if (typeof options.onCorrect !== 'function') return;
    try {
      options.onCorrect({
        word: last.word,
        replacement: last.replacement,
        kind: last.kind,
        reverted,
      });
    } catch (error) {
      console.error('[novaprose] autocorrect onCorrect failed', error);
    }
  };

  const plugin = new Plugin<Last | null>({
    key,
    state: {
      init: () => null,
      apply(tr, last) {
        const meta = tr.getMeta(key) as Last | null | undefined;
        if (meta !== undefined) return meta;
        // Anything else (more typing, a move) and Backspace is just Backspace again.
        return tr.docChanged || tr.selectionSet ? null : last;
      },
    },
    props: {
      handleTextInput(view, _from, _to, text) {
        // The text goes in as usual (other plugins may turn it into a link or a list first); the
        // word is corrected right after, once it's in the document.
        if (!view.composing && ENDS_WORD.test(text)) pending = text;
        return false;
      },
      handleDOMEvents: {
        keydown(view, event) {
          if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
          if (event.key === 'Backspace' && !event.shiftKey) {
            if (!revert(view)) return false;
            event.preventDefault();
            return true;
          }
          // Enter ends a word too, unless a list of suggestions (mentions, commands) takes it.
          if (event.key === 'Enter' && !view.dom.hasAttribute('aria-activedescendant'))
            correct(view, false);
          return false;
        },
        compositionend(view) {
          // Keyboards that type whole words (Android): the word may end with what the composition put in.
          setTimeout(() => {
            if (!view.isDestroyed && ENDS_WORD.test(textBeforeCursor(view))) correct(view, true);
          });
          return false;
        },
      },
      decorations(state) {
        const last = key.getState(state);
        if (!last) return null;
        return DecorationSet.create(state.doc, [
          Decoration.inline(last.from, last.to, { class: 'nova-autocorrected' }),
        ]);
      },
    },
    view: () => ({
      update(view, previous) {
        if (pending === null) return;
        const typed = pending;
        pending = null;
        // The typed text is in the document now (a plugin that turned it into something else, a
        // link or a list, leaves nothing to correct).
        if (view.state.doc === previous.doc || !textBeforeCursor(view).endsWith(typed.slice(-1)))
          return;
        // After this update is over: a correction dispatched from inside one would nest updates.
        queueMicrotask(() => correct(view, true));
      },
    }),
  });

  const set = (feature: 'autocorrect' | 'capitalize', on: boolean) => {
    settings[feature] = on;
    if (remember) save(settings);
    editor.ui.announce(
      editor.ui
        .t(on ? 'announce.on' : 'announce.off')
        .replace('{name}', feature === 'autocorrect' ? labels.spelling : labels.capitalize),
    );
    editor.root.dispatchEvent(
      new CustomEvent('nova-autocorrect-toggle', { detail: { feature, on } }),
    );
    editor.updateUI();
  };

  return { plugin, labels, settings, set };
}

/** The text of the block before the cursor. */
function textBeforeCursor(view: EditorView): string {
  const { $head } = view.state.selection;
  return $head.parent.textBetween(
    Math.max(0, $head.parentOffset - 8),
    $head.parentOffset,
    undefined,
    leafText,
  );
}

/**
 * Replaces `before` at `from` with `after`, changing only the letters that differ ("teh" → "the"
 * rewrites "eh"): the formatting stays, and a collaborator's cursor nearby isn't moved.
 */
function replaceChanged(tr: Transaction, from: number, before: string, after: string): Transaction {
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  )
    tail++;
  const start = from + head;
  const end = from + before.length - tail;
  const text = after.slice(head, after.length - tail);
  return text ? tr.insertText(text, start, end) : tr.delete(start, end);
}

function readSaved(): { autocorrect?: boolean; capitalize?: boolean } {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE) ?? '{}');
    if (!value || typeof value !== 'object') return {};
    const { autocorrect, capitalize } = value as Record<string, unknown>;
    return {
      ...(typeof autocorrect === 'boolean' ? { autocorrect } : {}),
      ...(typeof capitalize === 'boolean' ? { capitalize } : {}),
    };
  } catch {
    return {};
  }
}

function save(settings: { autocorrect: boolean; capitalize: boolean }): void {
  try {
    globalThis.localStorage?.setItem(STORAGE, JSON.stringify(settings));
  } catch {
    // Storage is off (private mode, a sandboxed frame): the choice lasts until the page closes.
  }
}
