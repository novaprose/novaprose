import { keymap } from 'prosemirror-keymap';
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
} from 'prosemirror-state';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { detailsAround, isOpen, LABELS, setOpen, summaryEnd, type Found } from './accordion';
import { pickLabels } from './shared';

/**
 * Ленивая часть плагина accordion: кнопка `accordion`, команды, клавиши и курсор в свёрнутом.
 * Enter в заголовке — новый абзац в начале содержимого; Backspace в начале заголовка — убрать
 * рамку (текст остаётся); Ctrl/Cmd+Enter в заголовке — свернуть или раскрыть.
 */

/** Свернуть или раскрыть блок под курсором; курсор из скрытого содержимого — в заголовок. */
export const toggleAccordion: Command = (state, dispatch) => {
  const details = detailsAround(state.selection.$from);
  if (!details) return false;
  if (dispatch) {
    const open = isOpen(details.node);
    const tr = setOpen(state.tr, details, !open);
    if (open && state.selection.from > summaryEnd(details)) {
      tr.setSelection(TextSelection.create(tr.doc, summaryEnd(details)));
    }
    dispatch(tr);
  }
  return true;
};

/** Раскрыть (true), свернуть (false) или переключить (undefined) все блоки документа. */
export function toggleAllAccordions(open?: boolean): Command {
  return (state, dispatch) => {
    const all: Found[] = [];
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'details') all.push({ node, pos });
      return !node.isTextblock;
    });
    if (!all.length) return false;
    if (dispatch) {
      const target = open ?? !all.every((d) => isOpen(d.node));
      const tr = state.tr;
      for (const details of all) setOpen(tr, details, target);
      // Свернули — курсор не должен остаться в скрытом.
      const around = detailsAround(tr.selection.$from);
      if (!target && around && tr.selection.from > summaryEnd(around)) {
        tr.setSelection(TextSelection.create(tr.doc, summaryEnd(around)));
      }
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Вставить раскрывающийся блок: выделенные блоки (или блок под курсором) становятся его
 * содержимым, курсор — в пустой заголовок.
 */
export const insertAccordion: Command = (state, dispatch) => {
  const { details, details_summary: summary } = state.schema.nodes;
  if (!details || !summary) return false;
  const { $from, $to } = state.selection;
  const range = $from.blockRange($to, (parent) => !!parent.type.contentMatch.matchType(details));
  if (!range) return false;
  const blocks: PMNode[] = [];
  for (let i = range.startIndex; i < range.endIndex; i++) blocks.push(range.parent.child(i));
  const content = Fragment.from([summary.create(), ...blocks]);
  if (!details.validContent(content)) return false;
  if (!range.parent.canReplaceWith(range.startIndex, range.endIndex, details)) return false;
  if (dispatch) {
    const tr = state.tr.replaceWith(
      range.start,
      range.end,
      details.create({ open: true }, content),
    );
    tr.setSelection(TextSelection.create(tr.doc, range.start + 2));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Убрать рамку: заголовок — обычным абзацем, содержимое остаётся на месте. */
export const removeAccordion: Command = (state, dispatch) => {
  const details = detailsAround(state.selection.$from);
  if (!details) return false;
  if (dispatch) {
    const { node, pos } = details;
    const summary = node.firstChild!;
    const blocks: PMNode[] = [];
    if (summary.content.size)
      blocks.push(state.schema.nodes.paragraph!.create(null, summary.content));
    node.forEach((child, _offset, index) => {
      if (index > 0) blocks.push(child);
    });
    // Позиции внутри сдвигаются на открывающий тег блока (и на пустой заголовок, если его нет).
    const shift = summary.content.size ? -1 : -1 - summary.nodeSize;
    const tr = state.tr.replaceWith(pos, pos + node.nodeSize, blocks);
    const head = Math.min(Math.max(state.selection.head + shift, pos), tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(head)));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Enter в заголовке: текст после курсора — новым абзацем в начале содержимого (блок раскрыт). */
const enterInSummary: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  if ($from.parent.type.name !== 'details_summary' || !$from.sameParent($to)) return false;
  const details = detailsAround($from);
  if (!details) return false;
  if (dispatch) {
    const tr = state.tr.deleteSelection();
    const $cursor = tr.selection.$from;
    const rest = $cursor.parent.content.cut($cursor.parentOffset);
    const bodyStart = tr.mapping.map(summaryEnd(details)) + 1;
    const first = tr.doc.nodeAt(bodyStart);
    if (!rest.size && first?.type.name === 'paragraph' && first.content.size === 0) {
      // Пустой первый абзац уже есть — просто перейти в него.
      tr.setSelection(TextSelection.create(tr.doc, bodyStart + 1));
    } else {
      tr.delete($cursor.pos, $cursor.end());
      const at = tr.mapping.map(bodyStart);
      tr.insert(at, state.schema.nodes.paragraph!.create(null, rest));
      tr.setSelection(TextSelection.create(tr.doc, at + 1));
    }
    if (!isOpen(details.node)) tr.setNodeAttribute(details.pos, 'open', true);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Backspace в начале заголовка — убрать рамку (как у списков: выйти из структуры). */
const backspaceInSummary: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== 'details_summary' || $from.parentOffset > 0) {
    return false;
  }
  return removeAccordion(state, dispatch);
};

/** Ctrl/Cmd+Enter в заголовке — свернуть или раскрыть. */
const toggleInSummary: Command = (state, dispatch) =>
  state.selection.$from.parent.type.name === 'details_summary' && toggleAccordion(state, dispatch);

function cursorPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('nova-accordion-cursor'),
    /**
     * Курсор в свёрнутом содержимом невидим, и набор ушёл бы в скрытое. Курсор туда перевели
     * (поиск, отмена, стрелки) — блок раскрывается; оказался там из-за смены содержимого
     * (setContent, правки соавтора) — переходит в заголовок, блок остаётся свёрнутым.
     */
    appendTransaction(transactions, _old, state: EditorState) {
      if (!transactions.some((tr) => tr.selectionSet || tr.docChanged)) return null;
      const { $from } = state.selection;
      const hidden: Found[] = [];
      for (let depth = 1; depth <= $from.depth; depth++) {
        const node = $from.node(depth);
        // В заголовке (первый ребёнок) курсор виден и у свёрнутого блока.
        if (node.type.name === 'details' && !isOpen(node) && $from.index(depth) > 0) {
          hidden.push({ node, pos: $from.before(depth) });
        }
      }
      if (!hidden.length) return null;
      const tr = state.tr;
      if (transactions.some((t) => t.selectionSet)) {
        for (const details of hidden) setOpen(tr, details, true);
      } else {
        tr.setSelection(TextSelection.create(state.doc, summaryEnd(hidden[0]!)));
      }
      return tr;
    },
  });
}

export default definePlugin({
  name: 'accordion-ui',
  requires: ['accordion'],
  toolbar: 'accordion',
  prosemirrorPlugins: () => [
    cursorPlugin(),
    keymap({
      Enter: enterInSummary,
      Backspace: backspaceInSummary,
      'Mod-Enter': toggleInSummary,
    }),
  ],
  setup(editor) {
    const labels = pickLabels(editor, 'accordion', LABELS);
    const isEnabled = (e: Editor) => e.isEditable() && e.isAllowed('accordion');
    editor.ui.registry.addToggleButton('accordion', {
      icon: icons.accordion,
      tooltip: labels.accordion,
      isEnabled: (e) => isEnabled(e) && (e.can(insertAccordion) || e.can(removeAccordion)),
      isActive: (e) => !!detailsAround(e.view.state.selection.$from),
      // Как у списков: в блоке — убрать рамку, иначе — сделать блоком.
      onAction: (e) =>
        e.exec(detailsAround(e.view.state.selection.$from) ? removeAccordion : insertAccordion),
    });
    editor.ui.registry.addMenuItem('accordion', {
      text: labels.accordion,
      icon: icons.accordion,
      onAction: (e) => e.exec(insertAccordion),
    });
  },
});
