import { NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { activeElement, h, listenDocument, logicalKey } from './dom';
import { positionFloating } from './popover';
import type { ContextToolbarSpec } from './registry';
import { parseToolbar, renderControl, type RenderedControl } from './toolbar';

interface Rendered {
  el: HTMLElement;
  controls: RenderedControl[];
}

/**
 * Плагин контекстных тулбаров (editor.ui.registry.addContextToolbar).
 * Один плавающий контейнер; содержимое — первый тулбар, чей predicate сейчас истинен.
 */
export function contextToolbarPlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('nova-context-toolbar'),
    view(view) {
      const container = h('div', {
        className: 'nova-bubble nova-context-toolbar',
        role: 'toolbar',
        hidden: true,
      });
      editor.ui.overlayHost.append(container);
      const cache = new Map<string, Rendered>();
      let current: string | null = null;

      const render = (name: string, spec: ContextToolbarSpec): Rendered => {
        let rendered = cache.get(name);
        if (rendered) return rendered;
        const el = h('div', { className: 'nova-context-items' });
        const controls: RenderedControl[] = [];
        parseToolbar(spec.items).forEach((group, index) => {
          if (index > 0) el.append(h('span', { className: 'nova-bubble-sep', role: 'separator' }));
          for (const item of group) {
            if (!editor.isAllowed(item)) continue;
            const control = editor.ui.registry.get(item);
            if (!control) continue;
            const r = renderControl(editor, item, control);
            controls.push(r);
            el.append(r.el);
          }
        });
        rendered = { el, controls };
        cache.set(name, rendered);
        return rendered;
      };

      const hide = () => {
        container.hidden = true;
        current = null;
      };

      const anchorRect = (spec: ContextToolbarSpec): DOMRect | null => {
        const { selection } = view.state;
        if ((spec.position ?? 'node') === 'node' && selection instanceof NodeSelection) {
          const dom = view.nodeDOM(selection.from) as HTMLElement | null;
          return dom?.getBoundingClientRect() ?? null;
        }
        const start = view.coordsAtPos(selection.from);
        const end = view.coordsAtPos(selection.to);
        return new DOMRect(
          start.left,
          start.top,
          Math.max(1, end.right - start.left),
          end.bottom - start.top,
        );
      };

      // Пока мышь тянет выделение, панель не показываем (иначе мерцает) — покажем после отпускания.
      let dragging = false;
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' && event.button === 0) dragging = true;
      };
      const onPointerUp = () => {
        if (!dragging) return;
        dragging = false;
        // После mouseup браузер ещё дообновляет выделение — даём ProseMirror его прочитать.
        setTimeout(() => update(view), 0);
      };
      view.dom.addEventListener('pointerdown', onPointerDown);
      const stopPointerUp = listenDocument(container, 'pointerup', onPointerUp);

      const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

      const update = (v: EditorView) => {
        const focused = v.hasFocus() || container.contains(activeElement(container));
        if (!focused || !editor.isEditable() || editor.ui.activeDialog || dragging) return hide();
        const match = editor.ui.registry
          .getContextToolbars()
          .find(([, spec]) => spec.predicate(editor));
        if (!match) return hide();
        const [name, spec] = match;
        const rendered = render(name, spec);
        if (current !== name) {
          container.replaceChildren(rendered.el);
          container.setAttribute('aria-label', spec.label);
          current = name;
        }
        for (const control of rendered.controls) control.update();
        const rect = spec.anchor ? spec.anchor(editor) : anchorRect(spec);
        if (!rect) return hide();
        container.hidden = false;
        let placement =
          (typeof spec.placement === 'function' ? spec.placement(editor) : spec.placement) ??
          (spec.position === 'selection' ? 'bottom-start' : 'top-start');
        // На тач-устройствах над выделением — системное меню «Копировать/Вставить»: уходим вниз.
        if (coarse && spec.position === 'selection') placement = 'bottom-start';
        positionFloating(container, rect, placement);
      };

      // Кнопки не забирают фокус — иначе пропадёт выделение узла.
      container.addEventListener('mousedown', (event) => {
        if ((event.target as HTMLElement).closest('button')) event.preventDefault();
      });
      container.addEventListener('keydown', (event) => {
        const buttons = [...container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(activeElement(container) as HTMLButtonElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          editor.focus();
        } else if (index >= 0 && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
          event.preventDefault();
          const step = logicalKey(event, container) === 'ArrowRight' ? 1 : -1;
          buttons[(index + step + buttons.length) % buttons.length]!.focus();
        }
      });

      const onBlur = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (!container.contains(next) && !editor.ui.overlayHost.contains(next)) hide();
      };
      view.dom.addEventListener('blur', onBlur);
      container.addEventListener('focusout', (event) => {
        const next = event.relatedTarget as Node | null;
        if (!container.contains(next) && !view.hasFocus() && !editor.ui.overlayHost.contains(next))
          hide();
      });
      // Позиция зависит от раскладки — обновляем при прокрутке и ресайзе окна.
      const reposition = () => {
        if (!container.hidden) update(view);
      };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);

      return {
        update,
        destroy() {
          view.dom.removeEventListener('blur', onBlur);
          view.dom.removeEventListener('pointerdown', onPointerDown);
          stopPointerUp();
          window.removeEventListener('scroll', reposition, true);
          window.removeEventListener('resize', reposition);
          container.remove();
        },
      };
    },
  });
}

/** Фокус на контекстный тулбар (Ctrl+F9 — общепринятое сочетание). */
export function focusContextToolbar(editor: Editor): boolean {
  const button = editor.ui.overlayHost.querySelector<HTMLButtonElement>(
    '.nova-context-toolbar:not([hidden]) button:not(:disabled)',
  );
  button?.focus();
  return !!button;
}
