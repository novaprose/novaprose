import { icons } from '../ui/icons';
import { Node as PMNode } from 'prosemirror-model';
import { closeHistory } from 'prosemirror-history';
import { EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { parseContent, type Editor } from '../editor';
import { definePlugin } from '../plugins';
import { HTMLSerializer } from '../serializer';
import { h, uniqueId } from '../ui/dom';
import { diffDocs } from './history-diff';
import { pickLabels } from './shared';
import css from './revisionhistory.css?raw';

/**
 * The revisionhistory plugin (named as in TinyMCE): the document's version history. A list of
 * versions, viewing a version with the differences from the current text highlighted, and
 * restoring (an ordinary edit — Ctrl+Z undoes it). Your app decides where versions come from:
 * `pluginOptions.revisionhistory` ({@link RevisionHistoryOptions}); with collaboration, `sync.versions()` from @novaprose/collab.
 */

export interface Revision {
  id: string;
  /** Time of the version, ms since 1970. */
  createdAt: number;
  /** Who changed the document in this version. */
  authors?: string[];
  /** Name of the version ("Sent to legal") if it was saved by hand. */
  label?: string | null;
}

export interface RevisionHistoryOptions {
  /** The list of versions (order doesn't matter: newest are shown first). */
  list: () => Promise<Revision[]>;
  /** A version's content: HTML or a JSON document. */
  load: (revision: Revision, editor: Editor) => Promise<string | Record<string, unknown>>;
  /** "Save version" (the button appears when this is set). */
  save?: (label?: string) => Promise<void>;
  /** A version was restored (after the content was already replaced). */
  onRestore?: (revision: Revision) => void;
}

export const LABELS = {
  en: {
    button: 'Version history',
    title: 'Version history',
    current: 'Current version',
    restore: 'Restore this version',
    close: 'Close',
    save: 'Save version',
    saved: 'Version saved',
    highlight: 'Highlight changes',
    onlyHere: 'Only in this version',
    onlyNow: 'Only in the current text',
    loading: 'Loading…',
    failed: 'Could not load the version history.',
    retry: 'Try again',
    empty: 'No saved versions yet.',
    restored: 'Restored the version from {date}. Undo with Ctrl+Z.',
    versions: 'Versions',
  },
};

const ICON = icons.history;

const serializer = new HTMLSerializer();

/** A version's content → a document through HTML: the same checks of links, styles and markup as everywhere. */
function toDoc(editor: Editor, content: string | Record<string, unknown>): PMNode {
  const html =
    typeof content === 'string'
      ? content
      : serializer.serializeFragment(PMNode.fromJSON(editor.schema, content).content);
  return parseContent(editor.schema, html);
}

function openHistory(editor: Editor, options: RevisionHistoryOptions) {
  const labels = pickLabels(editor, 'revisionhistory', LABELS);
  const lang = editor.options.language ?? 'en';
  const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });
  const titleId = uniqueId('nova-history-title');

  let revisions: Revision[] = [];
  let selected: Revision | null = null;
  let selectedDoc: PMNode | null = null;
  let highlight = true;
  let preview: EditorView | null = null;
  let loadToken = 0;

  const list = h('ol', { className: 'nova-history-list', 'aria-label': labels.versions });
  const previewHost = h('div', { className: 'nova-history-preview' });
  const status = h('p', { className: 'nova-history-status', role: 'status' });
  const restoreBtn = h(
    'button',
    { type: 'button', className: 'nova-button nova-button-primary', disabled: true },
    labels.restore,
  );
  const highlightBox = h('input', { type: 'checkbox', checked: true });
  const legend = h(
    'div',
    { className: 'nova-history-legend' },
    h('label', { className: 'nova-history-toggle' }, highlightBox, labels.highlight),
    h('span', { className: 'nova-history-swatch is-added' }, labels.onlyHere),
    h('span', { className: 'nova-history-swatch is-removed' }, labels.onlyNow),
  );
  const saveBtn = options.save
    ? h('button', { type: 'button', className: 'nova-button' }, labels.save)
    : null;
  const closeBtn = h('button', { type: 'button', className: 'nova-button' }, labels.close);

  const view = h(
    'section',
    { className: 'nova-history', role: 'region', 'aria-labelledby': titleId },
    h(
      'header',
      { className: 'nova-history-head' },
      h('h2', { id: titleId, className: 'nova-history-title' }, labels.title),
      legend,
      h('span', { className: 'nova-history-spacer' }),
      saveBtn,
      restoreBtn,
      closeBtn,
    ),
    h(
      'div',
      { className: 'nova-history-body' },
      previewHost,
      h('aside', { className: 'nova-history-side' }, status, list),
    ),
  );

  const decorationsFor = (doc: PMNode) => {
    if (!highlight || !selected) return DecorationSet.empty;
    const { added, removed } = diffDocs(doc, editor.view.state.doc);
    const decorations = [
      ...added.map((r) => Decoration.inline(r.from, r.to, { class: 'nova-diff-added' })),
      ...removed.map((r) =>
        Decoration.widget(
          r.pos,
          () => h(r.block ? 'div' : 'span', { className: 'nova-diff-removed' }, r.text),
          { side: -1, ignoreSelection: true },
        ),
      ),
    ];
    return DecorationSet.create(doc, decorations);
  };

  const showDoc = (doc: PMNode) => {
    selectedDoc = doc;
    const state = EditorState.create({ doc });
    const decorations = decorationsFor(doc);
    if (preview) {
      preview.setProps({ state, decorations: () => decorations });
      return;
    }
    preview = new EditorView(previewHost, {
      state,
      editable: () => false,
      decorations: () => decorations,
      attributes: {
        class: 'nova-prosemirror nova-history-doc',
        'aria-label': labels.title,
        'aria-readonly': 'true',
      },
    });
  };

  const renderList = () => {
    const items: { revision: Revision | null; title: string; detail: string; label?: string }[] = [
      { revision: null, title: labels.current, detail: '' },
      ...[...revisions]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((revision) => ({
          revision,
          title: dateFormat.format(revision.createdAt),
          detail: (revision.authors ?? []).join(', '),
          ...(revision.label ? { label: revision.label } : {}),
        })),
    ];
    list.replaceChildren(
      ...items.map((item) => {
        const isSelected = item.revision?.id === selected?.id && !!item.revision === !!selected;
        const button = h(
          'button',
          {
            type: 'button',
            className: 'nova-history-item',
            'aria-current': isSelected ? 'true' : null,
            tabindex: isSelected ? '0' : '-1',
            'data-revision': item.revision?.id ?? 'current',
          },
          h('span', { className: 'nova-history-time' }, item.title),
          item.label ? h('span', { className: 'nova-history-label' }, item.label) : null,
          item.detail ? h('span', { className: 'nova-history-authors' }, item.detail) : null,
        );
        button.addEventListener('click', () => {
          void select(item.revision);
          // Safari doesn't focus a button on click: without this, Esc and the arrows would miss the history.
          focusSelected();
        });
        return h('li', {}, button);
      }),
    );
  };

  function focusSelected() {
    list.querySelector<HTMLButtonElement>('.nova-history-item[aria-current="true"]')?.focus();
  }

  async function select(revision: Revision | null) {
    selected = revision;
    renderList();
    restoreBtn.disabled = true;
    const token = ++loadToken;
    if (!revision) {
      showDoc(editor.view.state.doc);
      return;
    }
    status.textContent = labels.loading;
    try {
      const content = await options.load(revision, editor);
      if (token !== loadToken) return;
      showDoc(toDoc(editor, content));
      status.textContent = '';
      restoreBtn.disabled = !editor.isEditable();
    } catch {
      if (token === loadToken) status.textContent = labels.failed;
    }
  }

  async function loadList() {
    status.textContent = labels.loading;
    try {
      revisions = (await options.list()).filter((r) => r && typeof r.id === 'string');
      status.textContent = revisions.length ? '' : labels.empty;
      renderList();
    } catch {
      status.replaceChildren(
        labels.failed,
        ' ',
        h(
          'button',
          { type: 'button', className: 'nova-link-btn', onClick: () => void loadList() },
          labels.retry,
        ),
      );
    }
  }

  function close() {
    preview?.destroy();
    view.remove();
    editor.root.classList.remove('nova-history-open');
    editor.focus();
  }

  restoreBtn.addEventListener('click', () => {
    if (!selected || !selectedDoc) return;
    const revision = selected;
    const { state } = editor.view;
    // A separate undo step: it doesn't merge with an edit made a second before the restore.
    editor.view.dispatch(
      closeHistory(state.tr.replaceWith(0, state.doc.content.size, selectedDoc.content)),
    );
    options.onRestore?.(revision);
    editor.ui.notify({
      text: labels.restored.replace('{date}', dateFormat.format(revision.createdAt)),
      type: 'success',
    });
    close();
  });
  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      await options.save!();
      editor.ui.notify({ text: labels.saved, type: 'success' });
      await loadList();
      focusSelected();
    } finally {
      saveBtn.disabled = false;
    }
  });
  closeBtn.addEventListener('click', close);
  highlightBox.addEventListener('change', () => {
    highlight = highlightBox.checked;
    if (selectedDoc) showDoc(selectedDoc);
  });
  view.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    // Arrows across the version list (one element in the Tab order, a "roving tabindex").
    const target = event.target as HTMLElement;
    if (!target.classList.contains('nova-history-item')) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = [...list.querySelectorAll<HTMLButtonElement>('.nova-history-item')];
    const next =
      buttons[buttons.indexOf(target as HTMLButtonElement) + (event.key === 'ArrowDown' ? 1 : -1)];
    next?.click();
    list.querySelector<HTMLButtonElement>(`[data-revision="${next?.dataset.revision}"]`)?.focus();
  });

  editor.ui.closeOverlays();
  editor.root.classList.add('nova-history-open');
  editor.root.append(view);
  void select(null);
  void loadList().then(() => {
    list.querySelector<HTMLButtonElement>('.nova-history-item')?.focus();
  });
  return { close, element: view };
}

export default definePlugin({
  name: 'revisionhistory',
  toolbar: 'revisionhistory',
  setup(editor) {
    editor.ui.addStyles('nova-revisionhistory', css);
    const options = editor.options.pluginOptions?.revisionhistory as
      RevisionHistoryOptions | undefined;
    if (!options?.list || !options.load) {
      console.warn('[nova] revisionhistory: set pluginOptions.revisionhistory.list and .load');
      return;
    }
    const labels = pickLabels(editor, 'revisionhistory', LABELS);
    let current: ReturnType<typeof openHistory> | null = null;
    const open = () => {
      if (current?.element.isConnected) return;
      current = openHistory(editor, options);
    };
    editor.ui.registry.addButton('revisionhistory', {
      icon: ICON,
      tooltip: labels.button,
      onAction: open,
    });
    editor.ui.registry.addMenuItem('revisionhistory', {
      text: labels.button,
      icon: ICON,
      onAction: open,
    });
    return () => current?.close();
  },
});
