import { InputRule, inputRules } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import type { Node as PMNode } from 'prosemirror-model';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import { Plugin, PluginKey, type Command, type EditorState } from 'prosemirror-state';
import { findWrapping } from 'prosemirror-transform';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { convertList, findParentList, nodesOf } from '../commands';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import css from './checklist.css?raw';
import { pickLabels } from './shared';

/**
 * Плагин checklist: списки задач с галочками. `plugins: ['checklist']`, кнопка `checklist`
 * (как у TinyMCE). Сам чек-лист — маркированный список с флагом (схема ядра), поэтому Enter, Tab,
 * отступы, вставка и Markdown работают как у обычных списков; плагин добавляет галочки,
 * Ctrl/Cmd+Enter, ввод `[ ]` / `[x]` в начале строки и стили.
 */

export const LABELS = { en: { checklist: 'Checklist', done: 'Done' } };

const SHORTCUT = 'Mod-Enter';

/** Пункт чек-листа под курсором. */
function checklistItemAt(state: EditorState): { node: PMNode; pos: number } | null {
  const { $from } = state.selection;
  const nodes = nodesOf(state);
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type === nodes.list_item && typeof node.attrs.checked === 'boolean') {
      return { node, pos: $from.before(depth) };
    }
  }
  return null;
}

/** Курсор в чек-листе (для подсветки кнопки). */
export function isChecklistActive(state: EditorState): boolean {
  return findParentList(state)?.node.attrs.checklist === true;
}

/**
 * Кнопка «Чек-лист»: в чек-листе — снять список; в другом списке — сделать его чек-листом;
 * в тексте — обернуть в новый чек-лист.
 */
export const toggleChecklist: Command = (state, dispatch) => {
  const nodes = nodesOf(state);
  const list = findParentList(state);
  if (list?.node.attrs.checklist === true) return liftListItem(nodes.list_item)(state, dispatch);
  if (list) {
    if (dispatch) dispatch(convertList(state.tr, list, nodes.bullet_list, true).scrollIntoView());
    return true;
  }
  return wrapInList(nodes.bullet_list, { checklist: true })(
    state,
    dispatch &&
      ((tr) => {
        // Новые пункты получают checked: false (по умолчанию у пункта списка null).
        const $pos = tr.doc.resolve(tr.mapping.map(state.selection.from));
        for (let depth = $pos.depth; depth > 0; depth--) {
          const node = $pos.node(depth);
          if (node.type === nodes.bullet_list && node.attrs.checklist === true) {
            convertList(tr, { node, pos: $pos.before(depth) }, nodes.bullet_list, true);
            break;
          }
        }
        dispatch(tr.scrollIntoView());
      }),
  );
};

/** Отметить или снять отметку пункта под курсором (Ctrl/Cmd+Enter). */
export const toggleChecklistItem: Command = (state, dispatch) => {
  const item = checklistItemAt(state);
  if (!item) return false;
  dispatch?.(
    state.tr.setNodeMarkup(item.pos, undefined, {
      ...item.node.attrs,
      checked: !item.node.attrs.checked,
    }),
  );
  return true;
};

/** `[ ] ` или `[x] ` в начале строки — пункт чек-листа (в обычном списке — весь список им станет). */
function checklistInputRule(): InputRule {
  return new InputRule(/^\s*\[([ xX]?)\]\s$/, (state, match, start, end) => {
    const nodes = nodesOf(state);
    const checked = match[1]!.toLowerCase() === 'x';
    const tr = state.tr.delete(start, end);
    const $start = tr.doc.resolve(start);
    const itemDepth = $start.depth - 1;
    if (itemDepth > 0 && $start.node(itemDepth).type === nodes.list_item) {
      // Только в первой строке пункта; список и пункт — уже в документе после удаления «[ ] ».
      if ($start.index(itemDepth) !== 0) return null;
      const list = { node: $start.node(itemDepth - 1), pos: $start.before(itemDepth - 1) };
      if (list.node.type !== nodes.bullet_list && list.node.type !== nodes.ordered_list)
        return null;
      convertList(tr, list, nodes.bullet_list, true);
      const itemPos = $start.before(itemDepth);
      tr.setNodeMarkup(itemPos, undefined, { ...tr.doc.nodeAt(itemPos)!.attrs, checked });
      return tr;
    }
    const range = $start.blockRange();
    const wrapping =
      range && findWrapping(range, nodes.bullet_list, { checklist: true }, undefined);
    if (!range || !wrapping) return null;
    wrapping[1] = { type: nodes.list_item, attrs: { checked } };
    tr.wrap(range, wrapping);
    // Сразу после другого чек-листа — продолжить его, а не начинать новый.
    const listPos = range.start;
    const before = tr.doc.resolve(listPos).nodeBefore;
    if (before?.type === nodes.bullet_list && before.attrs.checklist === true) tr.join(listPos);
    return tr;
  });
}

/** Галочки у пунктов чек-листа: виджет в начале пункта, отметка — по нажатию. */
function checkboxes(editor: Editor, label: string): Plugin {
  const key = new PluginKey<DecorationSet>('nova-checklist');
  const build = (doc: PMNode): DecorationSet => {
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (node.isTextblock) return false;
      if (node.type.name === 'list_item' && typeof node.attrs.checked === 'boolean') {
        const checked = node.attrs.checked;
        decorations.push(
          Decoration.widget(pos + 1, (view, getPos) => checkbox(view, getPos, checked), {
            side: -1,
            key: `nova-check-${checked}`,
            ignoreSelection: true,
            stopEvent: () => true,
          }),
        );
      }
      return true;
    });
    return DecorationSet.create(doc, decorations);
  };
  const checkbox = (view: EditorView, getPos: () => number | undefined, checked: boolean) => {
    const box = document.createElement('span');
    box.className = 'nova-check';
    box.contentEditable = 'false';
    box.setAttribute('role', 'checkbox');
    box.setAttribute('aria-checked', String(checked));
    box.setAttribute('aria-label', label);
    // По click, без preventDefault на mousedown: отмена нажатия сбивала WebKit — следующий щелчок
    // в текст ставил курсор в начало документа (найдено e2e).
    box.addEventListener('click', () => {
      if (!editor.isEditable()) return;
      const at = getPos();
      if (at === undefined) return;
      const itemPos = at - 1;
      const node = view.state.doc.nodeAt(itemPos);
      if (node?.type.name !== 'list_item' || typeof node.attrs.checked !== 'boolean') return;
      view.dispatch(
        view.state.tr.setNodeMarkup(itemPos, undefined, { ...node.attrs, checked: !checked }),
      );
    });
    return box;
  };
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_, state) => build(state.doc),
      apply: (tr, set) => (tr.docChanged ? build(tr.doc) : set),
    },
    props: { decorations: (state) => key.getState(state) },
  });
}

export default definePlugin({
  name: 'checklist',
  toolbar: 'checklist',
  prosemirrorPlugins: (editor) => [
    checkboxes(editor, pickLabels(editor, 'checklist', LABELS).done),
    keymap({ [SHORTCUT]: toggleChecklistItem }),
    inputRules({ rules: [checklistInputRule()] }),
  ],
  setup(editor) {
    editor.ui.addStyles('nova-checklist', css);
    const labels = pickLabels(editor, 'checklist', LABELS);
    editor.ui.registry.addToggleButton('checklist', {
      icon: icons.checklist,
      tooltip: labels.checklist,
      isEnabled: (e) => e.isEditable() && e.isAllowed('checklist'),
      isActive: (e) => isChecklistActive(e.view.state),
      onAction: (e) => e.exec(toggleChecklist),
    });
  },
});
