import type { Node as PMNode } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import type { Editor } from '../editor';
import { elementId } from '../element-id';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { LABELS, tocEntries, tocSettings, type TocEntry } from './tableofcontents';
import css from './tableofcontents.css?raw';
import { pickLabels } from './shared';

/**
 * Ленивая часть плагина tableofcontents: оглавление следит за заголовками (новый, переименованный,
 * удалённый — пункты обновляются в той же правке, отмена откатывает и их), выдаёт заголовкам
 * устойчивые id и ведёт по ссылкам внутри редактора, не меняя адрес страницы.
 */

/** Новый id заголовка: короткий и случайный — у двух соавторов не совпадёт. */
function newId(used: Set<string>): string {
  let id: string;
  do id = `toc-${Math.random().toString(36).slice(2, 8)}`;
  while (used.has(id));
  return id;
}

function sameEntries(value: unknown, entries: TocEntry[]): boolean {
  const current = tocEntries(value);
  return (
    Array.isArray(value) &&
    current.length === value.length &&
    current.length === entries.length &&
    current.every(
      (e, i) =>
        e.level === entries[i]!.level && e.id === entries[i]!.id && e.text === entries[i]!.text,
    )
  );
}

/**
 * Привести оглавления к заголовкам документа: id тем, у кого его нет или он повторяется, и пункты.
 * null — менять нечего (оглавлений нет или они уже верны).
 */
export function syncTableOfContents(state: EditorState, depth: number): Transaction | null {
  const tocs: { node: PMNode; pos: number }[] = [];
  const headings: { node: PMNode; pos: number }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'toc') tocs.push({ node, pos });
    else if (node.type.name === 'heading') headings.push({ node, pos });
    return !node.isTextblock && !node.isAtom;
  });
  if (!tocs.length) return null;
  const tr = state.tr;
  const used = new Set<string>();
  const entries: TocEntry[] = [];
  for (const { node, pos } of headings) {
    const level = Number(node.attrs.level);
    const text = node.textContent.trim();
    let id = elementId(node.attrs.id);
    const listed = level >= 1 && level <= depth && !!text;
    if (listed && (!id || used.has(id))) {
      id = newId(used);
      tr.setNodeAttribute(pos, 'id', id);
    }
    if (id) used.add(id);
    if (listed) entries.push({ level, id: id!, text: text.slice(0, 300) });
  }
  for (const toc of tocs) {
    if (!sameEntries(toc.node.attrs.entries, entries))
      tr.setNodeAttribute(toc.pos, 'entries', entries);
  }
  return tr.docChanged ? tr : null;
}

function tocPlugin(editor: Editor, depth: number): Plugin {
  return new Plugin({
    key: new PluginKey('nova-tableofcontents'),
    // В той же правке, что и заголовок: отмена откатывает и оглавление.
    appendTransaction(transactions, _old, state) {
      return transactions.some((tr) => tr.docChanged) ? syncTableOfContents(state, depth) : null;
    },
    props: {
      handleDOMEvents: {
        // Ссылка оглавления в редакторе — к заголовку, без перехода по адресу страницы.
        click(view, event) {
          const target = event.target instanceof Element ? event.target : null;
          const link = target?.closest('a[href^="#"]');
          if (!link || !link.closest('nav[data-toc]') || !view.dom.contains(link)) return false;
          event.preventDefault();
          const id = link.getAttribute('href')!.slice(1);
          let found = -1;
          view.state.doc.descendants((node, pos) => {
            if (found >= 0) return false;
            if (node.type.name === 'heading' && node.attrs.id === id) found = pos;
            return !node.isTextblock;
          });
          if (found < 0) return true;
          const heading = view.state.doc.nodeAt(found)!;
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.create(view.state.doc, found + 1 + heading.content.size))
              .scrollIntoView(),
          );
          view.focus();
          return true;
        },
      },
    },
    view(view) {
      // Документ загружен со старым оглавлением (или из JSON без пунктов) — привести сразу.
      const tr = syncTableOfContents(view.state, depth);
      if (tr && editor.isEditable()) view.dispatch(tr.setMeta('addToHistory', false));
      return {};
    },
  });
}

/** Вставить оглавление на место курсора (пустой абзац заменяется). */
function insertToc(title: string | null): Command {
  return (state, dispatch) => {
    const type = state.schema.nodes.toc;
    if (!type) return false;
    const { $from } = state.selection;
    const index = $from.index(-1);
    const emptyBlock =
      $from.depth > 0 && $from.parent.isTextblock && $from.parent.content.size === 0;
    if (dispatch) {
      const node = type.create({ title, entries: [] });
      const tr =
        emptyBlock && $from.node(-1).canReplaceWith(index, index + 1, type)
          ? state.tr.replaceWith($from.before(), $from.after(), node)
          : state.tr.replaceSelectionWith(node);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export default definePlugin({
  name: 'tableofcontents-ui',
  requires: ['tableofcontents'],
  toolbar: 'tableofcontents',
  prosemirrorPlugins: (editor) => [tocPlugin(editor, tocSettings(editor).depth)],
  setup(editor) {
    editor.ui.addStyles('nova-tableofcontents', css);
    const labels = pickLabels(editor, 'tableofcontents', LABELS);
    const settings = tocSettings(editor);
    const title = settings.title ?? labels.title;
    // Пустое оглавление — подсказка на языке интерфейса (в HTML документа её нет).
    editor.root.style.setProperty('--nova-toc-empty', JSON.stringify(labels.empty));
    const insert = insertToc(title || null);
    const enabled = (e: Editor) => e.isEditable() && e.isAllowed('tableofcontents');
    editor.ui.registry.addButton('tableofcontents', {
      icon: icons.tableOfContents,
      tooltip: labels.insert,
      isEnabled: enabled,
      onAction: (e) => e.exec(insert),
    });
    // Обновляется само; кнопка — для конфигов TinyMCE (tableofcontentsupdate).
    editor.ui.registry.addButton('tableofcontentsupdate', {
      icon: icons.history,
      tooltip: labels.update,
      isEnabled: enabled,
      onAction: (e) => {
        const tr = syncTableOfContents(e.view.state, settings.depth);
        if (tr) e.view.dispatch(tr);
      },
    });
    editor.ui.registry.addMenuItem('tableofcontents', {
      text: labels.insert,
      icon: icons.tableOfContents,
      onAction: (e) => e.exec(insert),
    });
  },
});
