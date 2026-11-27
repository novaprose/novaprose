import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { h } from '../ui/dom';
import { around, askModel, COMPLETE_INSTRUCTION, failureKind } from './ai-core';

/**
 * AI autocomplete: when the author pauses at the end of a paragraph, the model suggests how the text
 * goes on, shown in grey after the cursor. Tab (or a tap on it) accepts it, Esc dismisses it, and
 * typing the same letters keeps the rest. A suggestion is only shown, never written into the
 * document until accepted, so it is invisible to collaborators and to getHTML().
 */

interface Ghost {
  pos: number;
  text: string;
}

export const ghostKey = new PluginKey<Ghost | null>('nova-ai-ghost');

/** Text the paragraph must have before the cursor for a suggestion to be asked for. */
const MIN_TEXT = 4;
/** The longest suggestion shown (a sentence or so). */
const MAX_LENGTH = 200;

export interface AutocompleteSettings {
  delay: number;
  /** On or off (the aiautocomplete toggle). */
  enabled: () => boolean;
  /** What screen readers hear when a suggestion appears. */
  announcement: (text: string) => string;
  /** The tooltip of the suggestion. */
  hint: () => string;
}

/** The model's answer → the suggestion: its first line, without spaces the text already has. */
export function completionText(answer: string, before: string): string {
  let text = answer.replace(/\r\n?/g, '\n').replace(/^\n+/, '').split('\n')[0] ?? '';
  text = text.replace(/\s+$/, '');
  // A continuation wrapped in quotes.
  const quoted = /^\s*["“«](.*)["”»]$/.exec(text);
  if (quoted) text = (/^\s/.test(text) ? ' ' : '') + quoted[1]!;
  if (!before || /\s$/.test(before)) text = text.replace(/^\s+/, '');
  if (text.length > MAX_LENGTH) {
    const cut = text.slice(0, MAX_LENGTH);
    text = cut.slice(0, Math.max(cut.lastIndexOf(' '), 1));
  }
  return text.trim() ? text : '';
}

/** A suggestion is asked for at the end of a paragraph with some text, not in code. */
function canSuggest(state: EditorState): boolean {
  const { selection } = state;
  if (!selection.empty) return false;
  const { $head } = selection;
  const block = $head.parent;
  if (!block.isTextblock || block.type.spec.code) return false;
  if (block.textBetween($head.parentOffset, block.content.size, '\n', '\0').trim()) return false;
  return block.textBetween(0, $head.parentOffset, '\n', ' ').trim().length >= MIN_TEXT;
}

function hide(view: EditorView): void {
  if (ghostKey.getState(view.state))
    view.dispatch(view.state.tr.setMeta(ghostKey, null).setMeta('addToHistory', false));
}

function accept(view: EditorView): boolean {
  const ghost = ghostKey.getState(view.state);
  if (!ghost) return false;
  view.dispatch(
    view.state.tr.insertText(ghost.text, ghost.pos).setMeta(ghostKey, null).scrollIntoView(),
  );
  return true;
}

export function autocompletePlugin(editor: Editor, settings: AutocompleteSettings): Plugin {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  let warned = false;

  const cancel = () => {
    clearTimeout(timer);
    controller?.abort();
    controller = null;
  };

  const suggest = (view: EditorView) => {
    const state = view.state;
    if (!settings.enabled() || !editor.isEditable() || view.composing || !view.hasFocus()) return;
    if (ghostKey.getState(state) || !canSuggest(state)) return;
    const current = new AbortController();
    controller = current;
    const at = state.selection.head;
    const { before, after } = around(state.doc, at, at, 300);
    askModel(
      editor,
      { action: 'complete', instruction: COMPLETE_INSTRUCTION, before, after },
      current.signal,
    )
      .then((answer) => {
        if (current.signal.aborted || controller !== current) return;
        controller = null;
        const now = view.state;
        // The author typed on or moved: the suggestion is for text that isn't there any more.
        if (
          now.doc !== state.doc ||
          !now.selection.eq(state.selection) ||
          !view.hasFocus() ||
          !settings.enabled()
        )
          return;
        const text = completionText(answer, before);
        if (!text) return;
        view.dispatch(now.tr.setMeta(ghostKey, { pos: at, text }).setMeta('addToHistory', false));
        editor.ui.announce(settings.announcement(text.trim()));
      })
      .catch((error: unknown) => {
        if (current.signal.aborted || warned) return;
        warned = true;
        if (failureKind(error) === 'failed') console.warn('[nova] ai autocomplete:', error);
      });
  };

  return new Plugin<Ghost | null>({
    key: ghostKey,
    state: {
      init: () => null,
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(ghostKey) as Ghost | null | undefined;
        if (meta !== undefined) return meta;
        if (!value || (!tr.docChanged && !tr.selectionSet)) return value;
        // Typing the suggestion's own letters keeps the rest of it; anything else hides it.
        const start = tr.mapping.map(value.pos, -1);
        const { selection } = state;
        if (!selection.empty || selection.head < start) return null;
        const typed = state.doc.textBetween(start, selection.head, '\n', '\0');
        if (!value.text.startsWith(typed)) return null;
        const rest = value.text.slice(typed.length);
        return rest.trim() ? { pos: selection.head, text: rest } : null;
      },
    },
    props: {
      decorations(state) {
        const ghost = ghostKey.getState(state);
        if (!ghost) return null;
        return DecorationSet.create(state.doc, [
          Decoration.widget(
            ghost.pos,
            (view) => {
              // The key hint stays on the line of the suggestion's last word.
              const [, head = '', tail = ''] = /^([\s\S]*?)(\S*\s*)$/.exec(ghost.text) ?? [];
              const span = h(
                'span',
                {
                  className: 'nova-ai-ghost',
                  contenteditable: 'false',
                  'aria-hidden': 'true',
                  title: settings.hint(),
                },
                head,
                h(
                  'span',
                  { className: 'nova-ai-ghost-end' },
                  tail,
                  h('kbd', { className: 'nova-ai-ghost-key' }, 'Tab'),
                ),
              );
              // A tap or a click on the suggestion accepts it (phones have no Tab).
              span.addEventListener('mousedown', (event) => {
                event.preventDefault();
                accept(view);
                view.focus();
              });
              return span;
            },
            { side: 1, key: `ghost:${ghost.text}`, stopEvent: () => true, ignoreSelection: true },
          ),
        ]);
      },
      handleDOMEvents: {
        // Before the keymaps: Tab in a list item would indent it.
        keydown(view, event) {
          if (!ghostKey.getState(view.state)) return false;
          if (
            event.key === 'Tab' &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey
          ) {
            event.preventDefault();
            return accept(view);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            hide(view);
            return true;
          }
          return false;
        },
        blur(view) {
          cancel();
          hide(view);
          return false;
        },
        compositionstart(view) {
          cancel();
          hide(view);
          return false;
        },
      },
    },
    view(view) {
      const offInput = editor.on('input', () => {
        cancel();
        if (settings.enabled()) timer = setTimeout(() => suggest(view), settings.delay);
      });
      // Moving the cursor cancels a suggestion on its way.
      const offSelection = editor.on('selectionChange', (_e, { transaction }) => {
        if (!transaction.docChanged) cancel();
      });
      return {
        destroy() {
          cancel();
          offInput();
          offSelection();
        },
      };
    },
  });
}

/** Turns autocomplete off: the suggestion on its way and the one shown go. */
export function stopAutocomplete(view: EditorView): void {
  hide(view);
}
