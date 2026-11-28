import { Plugin, PluginKey } from 'prosemirror-state';
import { getLinkAt, markRange } from '../commands';
import type { Editor } from '../editor';
import { openLinkDialog, removeLink } from '../link';
import { marksOf } from '../commands';
import { isSafeLinkUrl } from '../url';
import { activeElement, h, icon } from './dom';
import { icons } from './icons';
import { positionFloating } from './popover';

/** A note a plugin adds to a link's bubble (the link checker: "This link seems broken"). */
export interface LinkNote {
  text: string;
  /** One action next to it ("Ignore"). */
  action?: { label: string; run(): void };
}

const noteProviders = new WeakMap<Editor, Set<(href: string) => LinkNote | null>>();

/** A note on links in the bubble, from a plugin: the first one that has something to say is shown. */
export function addLinkNote(
  editor: Editor,
  provider: (href: string) => LinkNote | null,
): () => void {
  const set = noteProviders.get(editor) ?? new Set();
  noteProviders.set(editor, set);
  set.add(provider);
  return () => set.delete(provider);
}

/**
 * The link context bubble (as in Google Docs): appears when the cursor is in a link.
 * Shows the address and the "edit / copy / remove" actions, and a plugin's note about the link.
 */
export function linkBubblePlugin(editor: Editor): Plugin {
  return new Plugin({
    key: new PluginKey('nova-link-bubble'),
    view(view) {
      const { t } = editor.ui;
      const anchor = h('a', {
        className: 'nova-bubble-link',
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      const button = (svg: string, label: string, onClick: () => void) => {
        const b = h(
          'button',
          { type: 'button', className: 'nova-btn', 'aria-label': label, 'data-tooltip': label },
          icon(svg, editor.ui.registry),
        );
        b.addEventListener('click', onClick);
        editor.ui.tooltip.attach(b);
        return b;
      };
      const row = h(
        'div',
        { className: 'nova-bubble-row' },
        icon(icons.externalLink, editor.ui.registry),
        anchor,
        h('span', { className: 'nova-bubble-sep' }),
        button(icons.edit, t('link.edit'), () => openLinkDialog(editor)),
        button(icons.copy, t('link.copy'), () => {
          void navigator.clipboard
            ?.writeText(anchor.href)
            .then(() =>
              editor.ui.notify({ text: t('link.copied'), type: 'success', timeout: 2000 }),
            );
        }),
        button(icons.unlink, t('unlink'), () => editor.exec(removeLink())),
      );
      // A plugin's note about the link: a line under the address, with its action.
      const noteText = h('span', { className: 'nova-bubble-note-text' });
      const noteAction = h('button', {
        type: 'button',
        className: 'nova-button nova-bubble-note-action',
      });
      const note = h('div', { className: 'nova-bubble-note', hidden: true }, noteText, noteAction);
      const el = h(
        'div',
        {
          className: 'nova-bubble nova-link-bubble',
          role: 'toolbar',
          'aria-label': t('link'),
          hidden: true,
        },
        row,
        note,
      );
      let noteRun: (() => void) | null = null;
      noteAction.addEventListener('click', () => noteRun?.());
      el.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      });
      editor.ui.overlayHost.append(el);

      const hide = () => {
        el.hidden = true;
      };

      const update = () => {
        const state = view.state;
        const link = getLinkAt(state);
        const focused = view.hasFocus() || el.contains(activeElement(el));
        if (
          !link ||
          !focused ||
          !editor.isEditable() ||
          editor.ui.activeDialog ||
          !state.selection.empty
        ) {
          hide();
          return;
        }
        const range = markRange(state, marksOf(state).link, state.selection.from);
        if (!range) return hide();
        anchor.textContent = link.href;
        anchor.title = link.href;
        let found: LinkNote | null = null;
        for (const provider of noteProviders.get(editor) ?? []) {
          found = provider(link.href);
          if (found) break;
        }
        note.hidden = !found;
        noteText.textContent = found?.text ?? '';
        noteAction.hidden = !found?.action;
        noteAction.textContent = found?.action?.label ?? '';
        noteRun = found?.action?.run ?? null;
        if (isSafeLinkUrl(link.href)) anchor.setAttribute('href', link.href);
        else anchor.removeAttribute('href');
        el.hidden = false;
        const start = view.coordsAtPos(range.from);
        const end = view.coordsAtPos(range.to);
        const rect = new DOMRect(
          start.left,
          start.top,
          Math.max(1, end.right - start.left),
          end.bottom - start.top,
        );
        positionFloating(el, rect, 'bottom-start');
      };

      const onBlur = (event: FocusEvent) => {
        if (!el.contains(event.relatedTarget as Node)) hide();
      };
      view.dom.addEventListener('blur', onBlur);
      el.addEventListener('focusout', (event) => {
        if (!el.contains(event.relatedTarget as Node) && !view.hasFocus()) hide();
      });

      return {
        update,
        destroy() {
          view.dom.removeEventListener('blur', onBlur);
          el.remove();
        },
      };
    },
  });
}
