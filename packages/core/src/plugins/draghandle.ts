import { DOMSerializer, Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { dropPoint } from 'prosemirror-transform';
import type { EditorView } from 'prosemirror-view';
import { blockUnitAt, duplicateBlock, type BlockUnit } from '../blocks';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h, icon, isRtl } from '../ui/dom';
import { icons } from '../ui/icons';
import { createMenu, focusMenu, type MenuEntry } from '../ui/menu';
import css from './draghandle.css?raw';
import { pickLabels } from './shared';

/**
 * Плагин draghandle: ручка слева от блока под мышью. Потянуть — перенести блок (абзац, заголовок,
 * пункт списка, таблицу, картинку) в другое место документа; нажать — выделить блок и открыть
 * меню: выше, ниже, копия, удалить. С клавиатуры то же — Alt+Shift+↑/↓ (команды ядра).
 * Только для мыши и пера: на сенсорных экранах перетаскивания HTML нет.
 */

export const LABELS = {
  en: {
    handle: 'Drag to move, click for actions',
    menu: 'Block actions',
    duplicate: 'Duplicate',
    delete: 'Delete',
  },
};

const HANDLE_WIDTH = 20;
const HANDLE_HEIGHT = 24;
const GAP = 4;

/** Перетаскиваемый блок и список, из которого он взят (пункт списка уносит его вид с собой). */
interface DragSource {
  node: PMNode;
  pos: number;
  list: PMNode | null;
}

/** Удалить выделенный блок (после нажатия на ручку выделен он). */
const deleteBlock: Command = (state, dispatch) => {
  if (!(state.selection instanceof NodeSelection)) return false;
  dispatch?.(state.tr.deleteSelection().scrollIntoView());
  return true;
};

/** Колонка текста: края области редактора без внутренних полей. */
function textColumn(view: EditorView): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const area = view.dom.getBoundingClientRect();
  const style = getComputedStyle(view.dom);
  return {
    left: area.left + parseFloat(style.paddingLeft) + 2,
    right: area.right - parseFloat(style.paddingRight) - 2,
    top: area.top + 1,
    bottom: area.bottom - 1,
  };
}

/**
 * Единица под точкой. Над текстом — по горизонтали мыши (вложенный пункт списка), левее или
 * правее текста — у его края.
 */
function unitAtPoint(view: EditorView, x: number, y: number): BlockUnit | null {
  const column = textColumn(view);
  const found = view.posAtCoords({
    left: Math.min(Math.max(x, column.left), column.right),
    top: Math.min(Math.max(y, column.top), column.bottom),
  });
  if (!found) return null;
  return blockUnitAt(view.state.doc.resolve(found.inside >= 0 ? found.inside : found.pos));
}

/** Строка, по которой выравнивается ручка: первая строка текста блока или его верх. */
function firstLine(
  view: EditorView,
  unit: BlockUnit,
  dom: HTMLElement,
): { top: number; bottom: number } {
  let textPos = unit.node.isTextblock ? unit.pos + 1 : -1;
  if (textPos < 0) {
    unit.node.descendants((child, offset) => {
      if (textPos >= 0) return false;
      if (child.isTextblock) textPos = unit.pos + 1 + offset + 1;
      return textPos < 0;
    });
  }
  if (textPos >= 0) {
    try {
      const { top, bottom } = view.coordsAtPos(textPos);
      return { top, bottom };
    } catch {
      // позиция вне отрисованного — выравниваем по блоку
    }
  }
  const rect = dom.getBoundingClientRect();
  return { top: rect.top, bottom: Math.min(rect.bottom, rect.top + HANDLE_HEIGHT) };
}

interface DropTarget {
  pos: number;
  line: { left: number; right: number; y: number };
}

/** Куда упадёт блок: верхняя половина блока под мышью — перед ним, нижняя — после. */
function dropTarget(view: EditorView, x: number, y: number): DropTarget | null {
  const unit = unitAtPoint(view, x, y);
  const dom = unit && view.nodeDOM(unit.pos);
  if (!unit || !(dom instanceof HTMLElement)) return null;
  const box = dom.getBoundingClientRect();
  const before = y < box.top + box.height / 2;
  // У пункта списка линия начинается от маркера.
  const edge = (
    (unit.node.type.name === 'list_item' && dom.parentElement) ||
    dom
  ).getBoundingClientRect();
  return {
    pos: before ? unit.pos : unit.pos + unit.node.nodeSize,
    line: {
      left: Math.min(edge.left, box.left),
      right: Math.max(edge.right, box.right),
      y: before ? box.top : box.bottom,
    },
  };
}

/**
 * Вставить блок в позицию между блоками. Пункт списка вне списка — в такой же список, что был
 * (чек-лист остаётся чек-листом), а рядом с таким же списком — в него. Абзац между пунктами —
 * новым пунктом. Возвращает позицию вставленного узла или null, если поставить некуда.
 */
function insertBlock(
  tr: Transaction,
  pos: number,
  node: PMNode,
  list: PMNode | null,
): number | null {
  const $pos = tr.doc.resolve(pos);
  const parent = $pos.parent;
  const index = $pos.index();
  if (parent.canReplaceWith(index, index, node.type)) {
    tr.insert(pos, node);
    return pos;
  }
  if (node.type.name === 'list_item' && list) {
    const { nodeBefore, nodeAfter } = $pos;
    if (nodeBefore?.hasMarkup(list.type, list.attrs)) {
      tr.insert(pos - 1, node);
      return pos - 1;
    }
    if (nodeAfter?.hasMarkup(list.type, list.attrs)) {
      tr.insert(pos + 1, node);
      return pos + 1;
    }
    if (parent.canReplaceWith(index, index, list.type)) {
      tr.insert(pos, list.type.create(list.attrs, node));
      return pos + 1;
    }
  }
  const wrapping = parent.contentMatchAt(index).findWrapping(node.type);
  if (wrapping) {
    let wrapped = node;
    for (let i = wrapping.length - 1; i >= 0; i--) wrapped = wrapping[i]!.create(null, wrapped);
    tr.insert(pos, wrapped);
    return pos + wrapping.length;
  }
  return null;
}

/** Перенос (или копия) блока в позицию target. null — ничего не изменилось. */
export function moveBlockTo(
  state: EditorState,
  source: DragSource,
  target: number,
  copy = false,
): Transaction | null {
  const { node } = source;
  const end = source.pos + node.nodeSize;
  // Брошен на своё же место (или внутрь себя) — без изменений.
  if (!copy && target >= source.pos && target <= end) return null;
  const tr = state.tr;
  if (!copy) tr.deleteRange(source.pos, end);
  let pos = tr.mapping.map(target);
  let inserted = insertBlock(tr, pos, node, source.list);
  if (inserted === null) {
    // Сюда такой блок не встаёт — ближайшее подходящее место (как у ProseMirror).
    const point = dropPoint(tr.doc, pos, new Slice(Fragment.from(node), 0, 0));
    if (point === null || point === pos) return null;
    pos = point;
    inserted = insertBlock(tr, pos, node, source.list);
    if (inserted === null) return null;
  }
  tr.setSelection(NodeSelection.create(tr.doc, inserted));
  return tr.setMeta('uiEvent', 'drop').scrollIntoView();
}

function handlePlugin(editor: Editor, labels: (typeof LABELS)['en']): Plugin {
  let source: DragSource | null = null;

  return new Plugin({
    key: new PluginKey('nova-draghandle'),
    props: {
      handleDrop(view, event, _slice, moved) {
        if (!source) return false;
        const target = dropTarget(view, event.clientX, event.clientY);
        const tr = target && moveBlockTo(view.state, source, target.pos, !moved);
        if (tr) {
          view.dispatch(tr);
          view.focus();
        }
        return true;
      },
    },
    view(view) {
      const host = view.dom.parentElement!;
      const handle = h('div', {
        className: 'nova-drag-handle',
        draggable: 'true',
        // Только для мыши: с клавиатуры те же действия — Alt+Shift+↑/↓ и Delete.
        'aria-hidden': 'true',
        title: labels.handle,
        hidden: true,
      });
      handle.append(icon(icons.dragHandle));
      const line = h('div', { className: 'nova-drop-line', hidden: true });
      host.append(handle, line);

      let unit: BlockUnit | null = null;
      let frame = 0;
      let pointer: { x: number; y: number } | null = null;

      const toHost = (x: number, y: number) => {
        const box = host.getBoundingClientRect();
        return { x: x - box.left + host.scrollLeft, y: y - box.top + host.scrollTop };
      };

      const hide = () => {
        handle.hidden = true;
        unit = null;
      };

      const place = (next: BlockUnit) => {
        const dom = view.nodeDOM(next.pos);
        if (!(dom instanceof HTMLElement)) return hide();
        unit = next;
        // У пункта списка ручка — левее маркера: по краю самого списка.
        const edge = (
          (next.node.type.name === 'list_item' && dom.parentElement) ||
          dom
        ).getBoundingClientRect();
        const row = firstLine(view, next, dom);
        const at = toHost(
          isRtl(view.dom) ? edge.right + GAP : edge.left - GAP - HANDLE_WIDTH,
          (row.top + row.bottom) / 2 - HANDLE_HEIGHT / 2,
        );
        handle.style.left = `${Math.round(at.x)}px`;
        handle.style.top = `${Math.round(at.y)}px`;
        handle.hidden = false;
      };

      const update = () => {
        frame = 0;
        if (!pointer || source) return;
        if (!editor.isEditable() || view.composing) return hide();
        const { x, y } = pointer;
        // Мышь между ручкой и текстом своего блока — оставить ручку на месте.
        if (unit && !handle.hidden) {
          const dom = view.nodeDOM(unit.pos);
          if (dom instanceof HTMLElement) {
            const box = dom.getBoundingClientRect();
            const outside = isRtl(view.dom) ? x > box.right : x < box.left;
            if (outside && y >= box.top && y <= box.bottom) return;
          }
        }
        const next = unitAtPoint(view, x, y);
        if (!next) return hide();
        if (handle.hidden || !unit || next.pos !== unit.pos || next.node !== unit.node) place(next);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return;
        if (event.target instanceof Node && handle.contains(event.target)) return;
        pointer = { x: event.clientX, y: event.clientY };
        frame ||= requestAnimationFrame(update);
      };
      const onPointerLeave = () => {
        pointer = null;
        if (!source) hide();
      };
      // Набор текста — ручка не мешает, до следующего движения мыши (в том числе отложенного
      // до кадра: иначе он показал бы её снова).
      const forgetPointer = () => {
        pointer = null;
        cancelAnimationFrame(frame);
        frame = 0;
        hide();
      };
      const onKeyDown = forgetPointer;

      const showLine = (target: DropTarget | null) => {
        if (!target) {
          line.hidden = true;
          return;
        }
        const at = toHost(target.line.left, target.line.y);
        line.style.left = `${Math.round(at.x)}px`;
        line.style.top = `${Math.round(at.y) - 1}px`;
        line.style.width = `${Math.round(target.line.right - target.line.left)}px`;
        line.hidden = false;
      };
      const onDragOver = (event: DragEvent) => {
        if (source) showLine(dropTarget(view, event.clientX, event.clientY));
      };
      const onDragLeave = (event: DragEvent) => {
        if (!(event.relatedTarget instanceof Node) || !view.dom.contains(event.relatedTarget)) {
          line.hidden = true;
        }
      };

      const onDragStart = (event: DragEvent) => {
        if (!unit || !event.dataTransfer) return;
        const $pos = view.state.doc.resolve(unit.pos);
        source = {
          node: unit.node,
          pos: unit.pos,
          list: unit.node.type.name === 'list_item' ? $pos.parent : null,
        };
        const selection = NodeSelection.create(view.state.doc, unit.pos);
        view.dispatch(view.state.tr.setSelection(selection));
        const slice = selection.content();
        // Для сброса в другой редактор или приложение — HTML и текст блока.
        const box = document.createElement('div');
        box.append(DOMSerializer.fromSchema(view.state.schema).serializeFragment(slice.content));
        event.dataTransfer.clearData();
        event.dataTransfer.setData('text/html', box.innerHTML);
        event.dataTransfer.setData(
          'text/plain',
          slice.content.textBetween(0, slice.content.size, '\n\n'),
        );
        event.dataTransfer.effectAllowed = 'copyMove';
        const dom = view.nodeDOM(unit.pos);
        if (dom instanceof HTMLElement) event.dataTransfer.setDragImage(dom, 0, 0);
        // Как у перетаскивания самого ProseMirror: срез нужен, чтобы сброс узнал «своё»
        // (с Ctrl, на Mac — с ⌥, — копия); место сброса считает handleDrop выше.
        view.dragging = { slice, move: true, node: selection } as EditorView['dragging'];
        handle.classList.add('nova-drag-handle-active');
        editor.root.classList.add('nova-block-dragging');
      };
      const onDragEnd = () => {
        source = null;
        line.hidden = true;
        handle.classList.remove('nova-drag-handle-active');
        editor.root.classList.remove('nova-block-dragging');
        const current = view.dragging;
        setTimeout(() => {
          if (view.dragging === current) view.dragging = null;
        }, 50);
        hide();
      };

      const openMenu = () => {
        if (!unit) return;
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, unit.pos)));
        view.focus();
        const run = (command: Command | 'moveBlockUp' | 'moveBlockDown') => () => {
          editor.exec(command);
          hide();
        };
        const entries: MenuEntry[] = [
          {
            id: 'up',
            label: editor.ui.t('moveBlockUp'),
            icon: icons.chevronUp,
            shortcut: 'Alt-Shift-ArrowUp',
            disabled: !editor.can('moveBlockUp'),
            onSelect: run('moveBlockUp'),
          },
          {
            id: 'down',
            label: editor.ui.t('moveBlockDown'),
            icon: icons.chevronDown,
            shortcut: 'Alt-Shift-ArrowDown',
            disabled: !editor.can('moveBlockDown'),
            onSelect: run('moveBlockDown'),
          },
          { type: 'separator' },
          {
            id: 'duplicate',
            label: labels.duplicate,
            icon: icons.duplicate,
            disabled: !editor.can(duplicateBlock),
            onSelect: run(duplicateBlock),
          },
          { id: 'delete', label: labels.delete, icon: icons.trash, onSelect: run(deleteBlock) },
        ];
        const menu = createMenu(entries, () => editor.ui.closePopover(), labels.menu);
        editor.ui.openPopover({
          anchor: handle,
          content: menu,
          ignore: [handle],
          className: 'nova-popover-menu',
          onClose: (reason) => {
            if (reason === 'escape') editor.focus();
          },
        });
        focusMenu(menu);
      };

      host.addEventListener('pointermove', onPointerMove);
      host.addEventListener('pointerleave', onPointerLeave);
      view.dom.addEventListener('keydown', onKeyDown);
      view.dom.addEventListener('dragover', onDragOver);
      view.dom.addEventListener('dragleave', onDragLeave);
      handle.addEventListener('dragstart', onDragStart);
      handle.addEventListener('dragend', onDragEnd);
      handle.addEventListener('click', openMenu);

      return {
        update(_view, previous) {
          // Документ изменился (набор, перенос, отмена) — блоки сдвинулись, ручка устарела.
          if (!source && previous.doc !== view.state.doc) forgetPointer();
        },
        destroy() {
          cancelAnimationFrame(frame);
          host.removeEventListener('pointermove', onPointerMove);
          host.removeEventListener('pointerleave', onPointerLeave);
          view.dom.removeEventListener('keydown', onKeyDown);
          view.dom.removeEventListener('dragover', onDragOver);
          view.dom.removeEventListener('dragleave', onDragLeave);
          editor.root.classList.remove('nova-block-dragging');
          handle.remove();
          line.remove();
        },
      };
    },
  });
}

export default definePlugin({
  name: 'draghandle',
  prosemirrorPlugins: (editor) => [handlePlugin(editor, pickLabels(editor, 'draghandle', LABELS))],
  setup(editor) {
    editor.ui.addStyles('nova-draghandle', css);
    // Место под ручку слева от текста (см. draghandle.css).
    editor.root.classList.add('nova-has-draghandle');
    return () => editor.root.classList.remove('nova-has-draghandle');
  },
});
