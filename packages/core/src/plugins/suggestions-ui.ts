import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import type { MenuEntry } from '../ui/menu';
import { openPreview } from '../ui/views';
import {
  isSuggesting,
  LABELS as BASE_LABELS,
  listSuggestions,
  resolveSuggestions,
  setSuggesting,
  suggestionsResult,
  type Suggestion,
  type SuggestionsOptions,
} from './suggestions';
import type { createSuggestionsPanel } from './suggestions-panel';
import { pickLabels } from './shared';

/**
 * The lazy part of the suggestions plugin: the suggesting mode button, the "Review" menu, accepting and
 * rejecting the suggestion under the cursor or in the selection, previews of the text with every
 * suggestion accepted or rejected, and the suggestions panel (suggestions-panel.ts, loaded when it
 * first opens). Tracking edits and highlighting them is in the plugin itself (it works from the first
 * letter).
 */

export const LABELS = {
  en: {
    panel: 'Suggestions',
    showPanel: 'Show all suggestions',
    author: 'Author',
    allAuthors: 'All authors ({count})',
    authorCount: '{name} ({count})',
    kindInsert: 'Inserted',
    kindDelete: 'Deleted',
    kindReplace: 'Replaced',
    kindFormat: 'Formatted',
    acceptShown: 'Accept shown',
    rejectShown: 'Reject shown',
    acceptSelection: 'Accept suggestions in selection',
    rejectSelection: 'Reject suggestions in selection',
    previewFinal: 'Preview: all accepted',
    previewOriginal: 'Preview: all rejected',
    acceptedCount: 'Suggestions accepted: {count}',
    rejectedCount: 'Suggestions rejected: {count}',
    noneFrom: 'No suggestions from {name}',
    nonText: 'not text (an image or other content)',
  },
};

/** The name of the panel (a sidebar, with a toggle button and a menu item of the same name). */
export const PANEL = 'suggestionspanel';

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

/** Ids of the suggestions the selection touches (none for a cursor). */
export function suggestionsInSelection(state: EditorState): string[] {
  const { from, to, empty } = state.selection;
  if (empty) return [];
  const ids = listSuggestions(state.doc)
    .filter((s) => s.from < to && s.to > from)
    .map((s) => s.id);
  return [...new Set(ids)];
}

export default definePlugin({
  name: 'suggestions-ui',
  requires: ['suggestions'],
  setup(editor) {
    const options = (editor.options.pluginOptions?.suggestions ?? {}) as SuggestionsOptions;
    const base = pickLabels(editor, 'suggestions', BASE_LABELS);
    const labels = pickLabels(editor, 'suggestions', LABELS);
    const canReview = options.canReview !== false;
    const dispatch = (tr: Transaction) => editor.view.dispatch(tr);
    const current = () => suggestionAt(editor.view.state);
    const resolveCurrent = (action: 'accept' | 'reject') => {
      const s = current();
      if (s) dispatch(resolveSuggestions(editor.view.state, action, [s.id]));
      editor.focus();
    };
    /** Accept or reject several (all, or the given ids), and say how many. */
    const resolveMany = (action: 'accept' | 'reject', ids?: string[]) => {
      const { state } = editor.view;
      const count = ids?.length ?? new Set(listSuggestions(state.doc).map((s) => s.id)).size;
      if (!count || !editor.isEditable()) return;
      dispatch(resolveSuggestions(state, action, ids));
      editor.ui.announce(
        (action === 'accept' ? labels.acceptedCount : labels.rejectedCount).replace(
          '{count}',
          String(count),
        ),
      );
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
        editor.ui.notify(base.none);
        return;
      }
      dispatch(
        state.tr.setSelection(TextSelection.create(state.doc, target.from)).scrollIntoView(),
      );
      editor.focus();
    };
    const hasAny = () => listSuggestions(editor.view.state.doc).length > 0;
    const preview = (action: 'accept' | 'reject') =>
      openPreview(editor, {
        doc: suggestionsResult(editor, action),
        title: action === 'accept' ? labels.previewFinal : labels.previewOriginal,
      });

    editor.ui.registry.addToggleButton('suggestions', {
      icon: ICON_TOGGLE,
      tooltip: base.toggle,
      shortcut: 'Mod-Alt-Shift-e',
      isActive: (e) => isSuggesting(e.view.state),
      isEnabled: () => !options.force,
      onAction: (e) => setSuggesting(e, !isSuggesting(e.view.state)),
    });
    editor.ui.registry.addMenuButton('reviewsuggestions', {
      icon: ICON_REVIEW,
      tooltip: base.review,
      isEnabled: hasAny,
      items: (): MenuEntry[] => {
        const inSelection = suggestionsInSelection(editor.view.state);
        const editable = editor.isEditable();
        return [
          {
            id: 'panel',
            label: labels.showPanel,
            onSelect: () => void editor.ui.sidebar.show(PANEL, { focus: true }),
          },
          { id: 'next', label: base.next, onSelect: () => go(1) },
          { id: 'previous', label: base.previous, onSelect: () => go(-1) },
          ...(canReview
            ? ([
                { type: 'separator' },
                {
                  id: 'accept-selection',
                  label: labels.acceptSelection,
                  disabled: !inSelection.length || !editable,
                  onSelect: () => resolveMany('accept', inSelection),
                },
                {
                  id: 'reject-selection',
                  label: labels.rejectSelection,
                  disabled: !inSelection.length || !editable,
                  onSelect: () => resolveMany('reject', inSelection),
                },
                {
                  id: 'accept-all',
                  label: base.acceptAll,
                  disabled: !editable,
                  onSelect: () => resolveMany('accept'),
                },
                {
                  id: 'reject-all',
                  label: base.rejectAll,
                  disabled: !editable,
                  onSelect: () => resolveMany('reject'),
                },
              ] satisfies MenuEntry[])
            : []),
          { type: 'separator' },
          { id: 'preview-final', label: labels.previewFinal, onSelect: () => preview('accept') },
          {
            id: 'preview-original',
            label: labels.previewOriginal,
            onSelect: () => preview('reject'),
          },
        ];
      },
    });
    if (canReview) {
      editor.ui.registry.addButton('acceptsuggestion', {
        icon: ICON_ACCEPT,
        text: base.accept,
        tooltip: base.accept,
        onAction: () => resolveCurrent('accept'),
      });
      editor.ui.registry.addButton('rejectsuggestion', {
        icon: ICON_REJECT,
        text: base.reject,
        tooltip: base.reject,
        onAction: () => resolveCurrent('reject'),
      });
      editor.ui.registry.addContextToolbar('suggestion', {
        label: base.toolbar,
        predicate: (e) => suggestionAt(e.view.state) !== null,
        items: 'acceptsuggestion rejectsuggestion',
        position: 'selection',
        placement: 'bottom-start',
        priority: 20,
      });
    }
    editor.ui.registry.addMenuItem('suggestions', {
      text: base.toggle,
      icon: ICON_TOGGLE,
      isActive: (e) => isSuggesting(e.view.state),
      isEnabled: () => !options.force,
      onAction: (e) => setSuggesting(e, !isSuggesting(e.view.state)),
    });

    // The panel: every suggestion with its author and time, a filter by author, accept and reject.
    let panel: ReturnType<typeof createSuggestionsPanel> | null = null;
    editor.ui.registry.addSidebar(PANEL, {
      title: labels.panel,
      render: async (container) => {
        const { createSuggestionsPanel } = await import('./suggestions-panel');
        panel = createSuggestionsPanel(
          editor,
          {
            ...labels,
            accept: base.accept,
            reject: base.reject,
            none: base.none,
            guest: base.guest,
          },
          canReview,
        );
        container.append(panel.el);
        panel.render();
        return () => panel?.destroy();
      },
      onShow: () => panel?.render(),
    });
  },
});
