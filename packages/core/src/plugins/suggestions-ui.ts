import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import type { MenuEntry } from '../ui/menu';
import {
  isSuggesting,
  LABELS,
  listSuggestions,
  resolveSuggestions,
  setSuggesting,
  type Suggestion,
  type SuggestionsOptions,
} from './suggestions';
import { pickLabels } from './shared';

/**
 * The lazy part of the suggestions plugin: the suggesting mode button, the "Review" menu, accepting and rejecting
 * the suggestion under the cursor. Tracking edits and highlighting them is in the plugin itself (it works from the first letter).
 */

const ICON_TOGGLE = icons.suggest;
const ICON_REVIEW = icons.review;
const ICON_ACCEPT = icons.check;
const ICON_REJECT = icons.close;

function suggestionAt(state: EditorState): Suggestion | null {
  const { from } = state.selection;
  return (
    listSuggestions(state.doc).find(
      (s) => from >= s.from && from <= s.to && (s.to > from || s.from < from),
    ) ?? null
  );
}

export default definePlugin({
  name: 'suggestions-ui',
  requires: ['suggestions'],
  setup(editor) {
    const options = (editor.options.pluginOptions?.suggestions ?? {}) as SuggestionsOptions;
    const labels = pickLabels(editor, 'suggestions', LABELS);
    const canReview = options.canReview !== false;
    const dispatch = (tr: Transaction) => editor.view.dispatch(tr);
    const current = () => suggestionAt(editor.view.state);
    const resolveCurrent = (action: 'accept' | 'reject') => {
      const s = current();
      if (s) dispatch(resolveSuggestions(editor.view.state, action, [s.id]));
      editor.focus();
    };
    const go = (direction: 1 | -1) => {
      const { state } = editor.view;
      const list = listSuggestions(state.doc);
      const pos = state.selection.from;
      const target =
        direction === 1
          ? (list.find((s) => s.from > pos) ?? list[0])
          : ([...list].reverse().find((s) => s.to < pos) ?? list[list.length - 1]);
      if (!target) {
        editor.ui.notify(labels.none);
        return;
      }
      dispatch(
        state.tr.setSelection(TextSelection.create(state.doc, target.from)).scrollIntoView(),
      );
      editor.focus();
    };
    const hasAny = () => listSuggestions(editor.view.state.doc).length > 0;

    editor.ui.registry.addToggleButton('suggestions', {
      icon: ICON_TOGGLE,
      tooltip: labels.toggle,
      shortcut: 'Mod-Alt-Shift-e',
      isActive: (e) => isSuggesting(e.view.state),
      isEnabled: () => !options.force,
      onAction: (e) => setSuggesting(e, !isSuggesting(e.view.state)),
    });
    editor.ui.registry.addMenuButton('reviewsuggestions', {
      icon: ICON_REVIEW,
      tooltip: labels.review,
      isEnabled: hasAny,
      items: (): MenuEntry[] => [
        { id: 'next', label: labels.next, onSelect: () => go(1) },
        { id: 'previous', label: labels.previous, onSelect: () => go(-1) },
        ...(canReview
          ? ([
              { type: 'separator' },
              {
                id: 'accept-all',
                label: labels.acceptAll,
                onSelect: () => dispatch(resolveSuggestions(editor.view.state, 'accept')),
              },
              {
                id: 'reject-all',
                label: labels.rejectAll,
                onSelect: () => dispatch(resolveSuggestions(editor.view.state, 'reject')),
              },
            ] satisfies MenuEntry[])
          : []),
      ],
    });
    if (canReview) {
      editor.ui.registry.addButton('acceptsuggestion', {
        icon: ICON_ACCEPT,
        text: labels.accept,
        tooltip: labels.accept,
        onAction: () => resolveCurrent('accept'),
      });
      editor.ui.registry.addButton('rejectsuggestion', {
        icon: ICON_REJECT,
        text: labels.reject,
        tooltip: labels.reject,
        onAction: () => resolveCurrent('reject'),
      });
      editor.ui.registry.addContextToolbar('suggestion', {
        label: labels.toolbar,
        predicate: (e) => suggestionAt(e.view.state) !== null,
        items: 'acceptsuggestion rejectsuggestion',
        position: 'selection',
        placement: 'bottom-start',
        priority: 20,
      });
    }
    editor.ui.registry.addMenuItem('suggestions', {
      text: labels.toggle,
      icon: ICON_TOGGLE,
      isActive: (e) => isSuggesting(e.view.state),
      isEnabled: () => !options.force,
      onAction: (e) => setSuggesting(e, !isSuggesting(e.view.state)),
    });
  },
});
