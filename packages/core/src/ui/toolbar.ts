import type { Editor } from '../editor';
import { h, icon } from './dom';
import { icons } from './icons';
import { createMenu, focusMenu } from './menu';
import { Popover } from './popover';
import type { ControlSpec, SplitButtonSpec } from './registry';

/**
 * Конфиг тулбара: строка в привычном формате ('undo redo | bold italic') или массив имён,
 * где '|' разделяет группы.
 */
export type ToolbarConfig = string | string[];

/** Режим при нехватке ширины: перенос на новую строку или «⋯» с остальными группами. */
export type ToolbarMode = 'wrap' | 'sliding';

// Порядок = приоритет: при нехватке места в «⋯» уходят группы с конца,
// поэтому частые действия (стиль, B/I/U, цвет, ссылки) стоят первыми.
export const defaultToolbar =
  'undo redo | blocks | bold italic underline strikethrough moreformats | forecolor backcolor | link image table | ' +
  'bullist numlist | align lineheight outdent indent | fontfamily fontsize | blockquote codeblock hr | removeformat | searchreplace preview code fullscreen help';

export function parseToolbar(config: ToolbarConfig): string[][] {
  const tokens = Array.isArray(config) ? config : config.split(/\s+/);
  const groups: string[][] = [[]];
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    if (token === '|') groups.push([]);
    else groups[groups.length - 1]!.push(token);
  }
  return groups.filter((g) => g.length > 0);
}

export interface RenderedControl {
  el: HTMLElement;
  update(): void;
}

export interface ToolbarHandle {
  update(): void;
  focus(): void;
  destroy(): void;
}

export function createToolbar(
  editor: Editor,
  host: HTMLElement,
  config: ToolbarConfig,
  mode: ToolbarMode,
  { warnUnknown = true }: { warnUnknown?: boolean } = {},
): ToolbarHandle {
  const { ui } = editor;
  const t = ui.t;
  // Все слушатели на host снимаются разом при destroy (тулбар перестраивается после загрузки плагинов).
  const listeners = new AbortController();
  const { signal } = listeners;
  host.className = `nova-toolbar nova-toolbar-${mode}`;
  host.setAttribute('role', 'toolbar');
  host.setAttribute('aria-label', t('toolbar.label'));

  const controls: RenderedControl[] = [];
  const groups: HTMLElement[] = [];

  for (const names of parseToolbar(config)) {
    const group = h('div', { className: 'nova-tb-group', role: 'group' });
    for (const name of names) {
      // Запрещено ограничениями контента — кнопку не показываем.
      if (!editor.isAllowed(name)) continue;
      const spec = ui.registry.get(name);
      if (!spec) {
        if (warnUnknown) console.warn(`[nova] Unknown toolbar item "${name}"`);
        continue;
      }
      const control = renderControl(editor, name, spec);
      controls.push(control);
      group.append(control.el);
    }
    if (group.childElementCount) {
      groups.push(group);
      host.append(group);
    }
  }

  // ---------- переполнение (sliding) ----------
  const overflowBox = h('div', { className: 'nova-toolbar nova-tb-overflow', role: 'group' });
  const moreButton = h(
    'button',
    {
      type: 'button',
      className: 'nova-btn nova-tb-more',
      'aria-label': t('more'),
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      'data-tooltip': t('more'),
      hidden: true,
    },
    icon(icons.more),
  );
  ui.tooltip.attach(moreButton);
  let overflowPopover: Popover | null = null;

  const closeOverflow = () => {
    overflowPopover?.close();
    overflowPopover = null;
  };

  const offDialog = ui.onDialogOpen(closeOverflow);

  moreButton.addEventListener('click', (event) => {
    if (overflowPopover) return closeOverflow();
    moreButton.setAttribute('aria-expanded', 'true');
    const popover: Popover = new Popover({
      host: ui.overlayHost,
      anchor: moreButton,
      placement: 'bottom-end',
      content: overflowBox,
      className: 'nova-tb-overflow-popover',
      // Клики по вложенным меню (они тоже в overlayHost) не закрывают панель.
      ignore: [ui.overlayHost, moreButton],
      onClose: (reason) => {
        overflowPopover = null;
        moreButton.setAttribute('aria-expanded', 'false');
        if (reason === 'escape' && popover.focusWasInside) moreButton.focus();
      },
    });
    overflowPopover = popover;
    if (event.detail === 0)
      overflowBox.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  });

  if (mode === 'sliding') host.append(moreButton);

  const layout = () => {
    if (mode !== 'sliding') return;
    for (const group of groups) host.insertBefore(group, moreButton);
    moreButton.hidden = true;
    if (host.scrollWidth <= host.clientWidth + 1) {
      closeOverflow();
      return;
    }
    moreButton.hidden = false;
    let visible = groups.length;
    while (visible > 1 && host.scrollWidth > host.clientWidth + 1) {
      visible -= 1;
      overflowBox.prepend(groups[visible]!);
    }
    if (!overflowBox.childElementCount) moreButton.hidden = true;
    overflowPopover?.reposition();
    resetRoving();
  };

  // Перераскладка только при изменении ширины — перенос групп сам по себе не должен её вызывать.
  let lastWidth = -1;
  const resizeObserver =
    typeof ResizeObserver !== 'undefined' && mode === 'sliding'
      ? new ResizeObserver(() => {
          if (host.clientWidth === lastWidth) return;
          lastWidth = host.clientWidth;
          layout();
        })
      : null;
  resizeObserver?.observe(host);

  // ---------- клавиатура: roving tabindex по WAI-ARIA toolbar ----------
  const focusables = (): HTMLButtonElement[] =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.disabled && !b.hidden);

  let current: HTMLButtonElement | null = null;
  const resetRoving = () => {
    const list = focusables();
    if (!current || !list.includes(current)) current = list[0] ?? null;
    for (const b of host.querySelectorAll<HTMLButtonElement>('button'))
      b.tabIndex = b === current ? 0 : -1;
  };

  host.addEventListener(
    'focusin',
    (event) => {
      const target = event.target as HTMLElement;
      if (target instanceof HTMLButtonElement && host.contains(target)) {
        current = target;
        resetRoving();
      }
    },
    { signal },
  );

  host.addEventListener(
    'keydown',
    (event) => {
      const list = focusables();
      const index = list.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      let next: number | null = null;
      if (event.key === 'ArrowRight') next = index + 1;
      else if (event.key === 'ArrowLeft') next = index - 1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = list.length - 1;
      else if (event.key === 'Escape') {
        event.preventDefault();
        editor.focus();
        return;
      }
      if (next === null) return;
      event.preventDefault();
      list[(next + list.length) % list.length]!.focus();
    },
    { signal },
  );

  // Не даём кнопкам забирать фокус у редактора мышью — иначе теряется выделение.
  const keepFocus = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) event.preventDefault();
  };
  host.addEventListener('mousedown', keepFocus, { signal });
  overflowBox.addEventListener('mousedown', keepFocus);
  overflowBox.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') return; // обработает Popover
    const list = [...overflowBox.querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => !b.disabled,
    );
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      list[(index + 1) % list.length]!.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      list[(index - 1 + list.length) % list.length]!.focus();
    }
  });

  const update = () => {
    for (const control of controls) control.update();
    resetRoving();
  };
  update();
  layout();

  return {
    update,
    focus: () => {
      resetRoving();
      current?.focus();
    },
    destroy: () => {
      resizeObserver?.disconnect();
      offDialog();
      closeOverflow();
      listeners.abort();
      host.replaceChildren();
    },
  };
}

export function renderControl(editor: Editor, name: string, spec: ControlSpec): RenderedControl {
  if (spec.type === 'split') return renderSplit(editor, name, spec);
  const { ui } = editor;
  const el = h('button', {
    type: 'button',
    className: `nova-btn nova-tb-${spec.type}`,
    'aria-label': spec.tooltip,
    'data-tooltip': spec.tooltip,
    'data-control': name,
    ...(spec.shortcut ? { 'data-shortcut': spec.shortcut } : {}),
  });
  ui.tooltip.attach(el);

  if (spec.icon) el.append(icon(spec.icon));
  const label =
    spec.type === 'menu' && (spec.label || spec.text)
      ? h('span', { className: 'nova-tb-label' })
      : null;
  if (label) {
    if (spec.type === 'menu' && spec.minChars) label.style.minWidth = `${spec.minChars}ch`;
    el.append(label);
    el.classList.add('nova-tb-has-label');
  } else if (!spec.icon && spec.text) {
    el.append(spec.text);
  }

  let colorBar: HTMLElement | null = null;
  if (spec.type === 'panel' && spec.indicator) {
    colorBar = h('span', { className: 'nova-color-bar' });
    el.append(colorBar);
  }
  if (spec.type !== 'button') {
    el.setAttribute('aria-haspopup', spec.type === 'menu' ? 'menu' : 'dialog');
    el.setAttribute('aria-expanded', 'false');
    el.append(icon(icons.chevronDown));
    el.lastElementChild?.classList.add('nova-chevron');
  }

  el.addEventListener('click', (event) => {
    if (spec.type === 'button') {
      spec.onAction(editor);
      return;
    }
    // Повторный клик по открытой кнопке закрывает её поповер.
    if (el.getAttribute('aria-expanded') === 'true') {
      ui.closePopover();
      return;
    }
    const fromKeyboard = event.detail === 0;
    const closeAndRefocus = () => ui.closePopover();
    const content =
      spec.type === 'menu'
        ? createMenu(spec.items(editor), closeAndRefocus, spec.tooltip)
        : spec.render(editor, closeAndRefocus);
    el.setAttribute('aria-expanded', 'true');
    const popover = ui.openPopover({
      anchor: el,
      content,
      ignore: [el],
      className: spec.type === 'menu' ? 'nova-popover-menu' : 'nova-popover-panel',
      onClose: (reason) => {
        el.setAttribute('aria-expanded', 'false');
        // Фокус был в панели — возвращаем на кнопку; был в тексте — там и остаётся.
        if (reason === 'escape' && popover.focusWasInside) el.focus();
      },
    });
    if (spec.type === 'menu') focusMenu(content);
    else if (fromKeyboard) content.querySelector<HTMLElement>('button, input')?.focus();
  });

  // Меню открывается и стрелкой вниз, как в нативных выпадающих списках.
  if (spec.type !== 'button') {
    el.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' && el.getAttribute('aria-expanded') !== 'true') {
        event.preventDefault();
        el.click();
      }
    });
  }

  const update = () => {
    const editable = editor.isEditable();
    el.disabled = !editable || (spec.isEnabled ? !spec.isEnabled(editor) : false);
    if (spec.isActive) {
      const active = spec.isActive(editor);
      el.classList.toggle('is-active', active);
      if (spec.type === 'button') el.setAttribute('aria-pressed', String(active));
    }
    if (label && spec.type === 'menu') label.textContent = spec.label?.(editor) ?? spec.text ?? '';
    if (colorBar && spec.type === 'panel' && spec.indicator) {
      const color = spec.indicator(editor);
      colorBar.style.background = color ?? '';
      colorBar.classList.toggle('is-empty', !color);
    }
  };

  return { el, update };
}

/**
 * Составная кнопка = обычная кнопка (data-control=name) + кнопка-стрелка с меню вариантов.
 * В навигации стрелками это две остановки, как у составных кнопок в настольных редакторах.
 */
function renderSplit(editor: Editor, name: string, spec: SplitButtonSpec): RenderedControl {
  const main = renderControl(editor, name, {
    type: 'button',
    tooltip: spec.tooltip,
    onAction: spec.onAction,
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(spec.text ? { text: spec.text } : {}),
    ...(spec.shortcut ? { shortcut: spec.shortcut } : {}),
    ...(spec.isActive ? { isActive: spec.isActive } : {}),
    ...(spec.isEnabled ? { isEnabled: spec.isEnabled } : {}),
  });
  const more = renderControl(editor, `${name}-options`, {
    type: 'menu',
    tooltip: `${spec.tooltip}: ${editor.ui.t('toolbar.options')}`,
    items: spec.items,
    ...(spec.isEnabled ? { isEnabled: spec.isEnabled } : {}),
  });
  more.el.classList.add('nova-tb-split-more');
  const el = h('span', { className: 'nova-tb-split' }, main.el, more.el);
  return {
    el,
    update: () => {
      main.update();
      more.update();
    },
  };
}
