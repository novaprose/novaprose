import { NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { activeElement, h, listenDocument, logicalKey } from './dom';
import { positionFloating, visibleArea } from './popover';
import type { ContextToolbarSpec } from './registry';
import { parseToolbar, renderControl, type RenderedControl } from './toolbar';

interface Rendered {
  el: HTMLElement;
  controls: RenderedControl[];
}

/**
 * The context toolbars plugin (editor.ui.registry.addContextToolbar).
 * One floating container; its content is the first toolbar whose predicate is currently true.
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

      // While the mouse drags a selection the panel isn't shown (otherwise it flickers): it shows after release.
      let dragging = false;
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' && event.button === 0) dragging = true;
      };
      const onPointerUp = () => {
        if (!dragging) return;
        dragging = false;
        // After mouseup the browser still finishes updating the selection: let ProseMirror read it.
        setTimeout(() => update(view), 0);
      };
      view.dom.addEventListener('pointerdown', onPointerDown);
      const stopPointerUp = listenDocument(container, 'pointerup', onPointerUp);

      const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

      /**
       * Touch screens: the selection toolbar doesn't float next to the selection: the selection handles and
       * the system "Copy/Paste" menu are there, and it would cover them (or they would cover it). The panel
       * is pinned to the bottom of the visible part of the window, that is, above the keyboard, full width.
       */
      const dock = () => {
        const area = visibleArea();
        container.style.left = `${Math.round(area.left)}px`;
        container.style.width = `${Math.round(area.right - area.left)}px`;
        container.style.top = `${Math.round(area.bottom - container.offsetHeight)}px`;
        container.dataset.side = 'docked';
      };

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
        const docked = coarse && spec.position === 'selection';
        container.classList.toggle('nova-context-toolbar-docked', docked);
        if (docked) return dock();
        container.style.width = '';
        const placement =
          (typeof spec.placement === 'function' ? spec.placement(editor) : spec.placement) ??
          (spec.position === 'selection' ? 'bottom-start' : 'top-start');
        positionFloating(container, rect, placement);
      };

      // Buttons don't take focus, otherwise the node selection disappears.
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
      // The position depends on the layout: updated on scroll and window resize.
      const reposition = () => {
        if (!container.hidden) update(view);
      };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      // An image that finishes loading changes the layout (a new or edited image had no size yet).
      view.dom.addEventListener('load', reposition, true);
      // A phone keyboard changes the visible part of the window without touching the window.
      window.visualViewport?.addEventListener('resize', reposition);
      window.visualViewport?.addEventListener('scroll', reposition);

      return {
        update,
        destroy() {
          view.dom.removeEventListener('blur', onBlur);
          view.dom.removeEventListener('pointerdown', onPointerDown);
          stopPointerUp();
          window.removeEventListener('scroll', reposition, true);
          window.removeEventListener('resize', reposition);
          view.dom.removeEventListener('load', reposition, true);
          window.visualViewport?.removeEventListener('resize', reposition);
          window.visualViewport?.removeEventListener('scroll', reposition);
          container.remove();
        },
      };
    },
  });
}

/** Focus on the context toolbar (Ctrl+F9, the common shortcut). */
export function focusContextToolbar(editor: Editor): boolean {
  const button = editor.ui.overlayHost.querySelector<HTMLButtonElement>(
    '.nova-context-toolbar:not([hidden]) button:not(:disabled)',
  );
  button?.focus();
  return !!button;
}
