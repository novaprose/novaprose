import { Plugin, PluginKey } from 'prosemirror-state';
import { getLinkAt, markRange } from '../commands';
import type { Editor } from '../editor';
import { openLinkDialog, removeLink } from '../link';
import { marksOf } from '../commands';
import { isSafeLinkUrl } from '../url';
import { h, icon } from './dom';
import { icons } from './icons';
import { positionFloating } from './popover';

/**
 * Контекстная панель ссылки (как в Google Docs): появляется, когда курсор стоит в ссылке.
 * Показывает адрес и действия «изменить / скопировать / убрать».
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
          icon(svg),
        );
        b.addEventListener('click', onClick);
        editor.ui.tooltip.attach(b);
        return b;
      };
      const el = h(
        'div',
        { className: 'nova-bubble', role: 'toolbar', 'aria-label': t('link'), hidden: true },
        icon(icons.externalLink),
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
        const focused = view.hasFocus() || el.contains(document.activeElement);
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
