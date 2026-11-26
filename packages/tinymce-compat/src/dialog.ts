import type { Editor } from '@novaprose/core';
import css from './dialog.css?raw';

/**
 * editor.windowManager.open(spec) — диалог по описанию (как в документации TinyMCE): панель или
 * вкладки, поля, кнопки, initialData, onSubmit/onChange/onAction/onCancel/onClose и объект api.
 * Строится на диалоге NovaProse (фокус, Esc, мобильный «лист»); все подписи — textContent.
 */

type Data = Record<string, unknown>;

export interface DialogItem {
  type: string;
  name?: string;
  label?: string;
  text?: string;
  placeholder?: string;
  inputMode?: string;
  maximized?: boolean;
  items?: DialogItem[] | { text: string; value: string }[];
  columns?: number | 'auto';
  html?: string;
  level?: 'info' | 'warn' | 'error' | 'success';
  icon?: string;
  enabled?: boolean;
  disabled?: boolean;
  primary?: boolean;
  buttonType?: string;
  size?: string;
}

export interface DialogSpec {
  title: string;
  size?: 'normal' | 'medium' | 'large';
  body:
    | { type: 'panel'; items: DialogItem[] }
    | { type: 'tabpanel'; tabs: { name?: string; title: string; items: DialogItem[] }[] };
  buttons?: {
    type: 'submit' | 'cancel' | 'custom' | 'menu';
    text: string;
    name?: string;
    primary?: boolean;
    enabled?: boolean;
  }[];
  initialData?: Data;
  onSubmit?: (api: DialogApi) => void;
  onChange?: (api: DialogApi, details: { name: string }) => void;
  onAction?: (api: DialogApi, details: { name: string; value?: unknown }) => void;
  onCancel?: (api: DialogApi) => void;
  onClose?: () => void;
  onTabChange?: (api: DialogApi, details: { newTabName: string; oldTabName: string }) => void;
}

export interface DialogApi {
  getData(): Data;
  setData(data: Data): void;
  close(): void;
  block(message?: string): void;
  unblock(): void;
  focus(name: string): void;
  disable(name: string): void;
  enable(name: string): void;
  showTab(name: string): void;
  redial(spec: DialogSpec): void;
}

type Control = {
  get(): unknown;
  set(value: unknown): void;
  focus(): void;
  setEnabled(enabled: boolean): void;
};

let uid = 0;
const nextId = () => `nova-compat-field-${++uid}`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** htmlpanel: HTML от разработчика интеграции — без скриптов, обработчиков и javascript:-ссылок. */
function safeHtml(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content
    .querySelectorAll('script, style, iframe, object, embed, link, meta, base, form')
    .forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      const value = attr.value.trim().toLowerCase();
      if (attr.name.startsWith('on') || /^(javascript|vbscript|data):/.test(value)) {
        node.removeAttribute(attr.name);
      }
    }
  });
  return template.content;
}

export function openSpecDialog(
  editor: Editor,
  spec: DialogSpec,
  reopen: (spec: DialogSpec) => DialogApi,
): DialogApi {
  editor.ui.addStyles('nova-compat-dialog', css);
  const controls = new Map<string, Control>();
  const tabs = new Map<string, { button: HTMLButtonElement; panel: HTMLElement }>();
  let currentTab = '';
  let closedByApi = false;
  let handle: ReturnType<Editor['ui']['openDialog']> | null = null;

  const notifyChange = (name: string) => spec.onChange?.(api, { name });

  function field(item: DialogItem, input: HTMLElement): HTMLElement {
    const id = nextId();
    input.id = id;
    const wrap = el('div', 'nova-field');
    if (item.label) {
      const label = el('label', 'nova-label', item.label);
      label.htmlFor = id;
      wrap.append(label);
    }
    wrap.append(input);
    return wrap;
  }

  function render(item: DialogItem): HTMLElement | null {
    const name = item.name ?? '';
    const enabled = item.enabled !== false && item.disabled !== true;
    switch (item.type) {
      case 'input':
      case 'urlinput':
      case 'colorinput': {
        const input = el('input', 'nova-input');
        input.type =
          item.type === 'colorinput' ? 'color' : item.type === 'urlinput' ? 'url' : 'text';
        if (item.inputMode) input.inputMode = item.inputMode;
        if (item.placeholder) input.placeholder = item.placeholder;
        input.disabled = !enabled;
        input.addEventListener('input', () => notifyChange(name));
        if (name) {
          controls.set(name, {
            // urlinput хранит { value }, остальные — строку.
            get: () => (item.type === 'urlinput' ? { value: input.value } : input.value),
            set: (value) => {
              input.value = String(
                item.type === 'urlinput' && value && typeof value === 'object'
                  ? ((value as { value?: unknown }).value ?? '')
                  : (value ?? ''),
              );
            },
            focus: () => input.focus(),
            setEnabled: (on) => (input.disabled = !on),
          });
        }
        return field(item, input);
      }
      case 'textarea': {
        const input = el('textarea', 'nova-input');
        input.rows = item.maximized ? 10 : 4;
        if (item.placeholder) input.placeholder = item.placeholder;
        input.disabled = !enabled;
        input.addEventListener('input', () => notifyChange(name));
        if (name) {
          controls.set(name, {
            get: () => input.value,
            set: (value) => (input.value = String(value ?? '')),
            focus: () => input.focus(),
            setEnabled: (on) => (input.disabled = !on),
          });
        }
        return field(item, input);
      }
      case 'checkbox': {
        const input = el('input', 'nova-checkbox');
        input.type = 'checkbox';
        input.id = nextId();
        input.disabled = !enabled;
        input.addEventListener('change', () => notifyChange(name));
        const label = el('label', undefined, item.label ?? '');
        label.htmlFor = input.id;
        if (name) {
          controls.set(name, {
            get: () => input.checked,
            set: (value) => (input.checked = Boolean(value)),
            focus: () => input.focus(),
            setEnabled: (on) => (input.disabled = !on),
          });
        }
        const wrap = el('div', 'nova-field nova-field-inline');
        wrap.append(input, label);
        return wrap;
      }
      case 'selectbox':
      case 'listbox': {
        const select = el('select', 'nova-input nova-select');
        for (const option of (item.items ?? []) as { text: string; value: string }[]) {
          const node = el('option', undefined, option.text);
          node.value = option.value;
          select.append(node);
        }
        select.disabled = !enabled;
        select.addEventListener('change', () => notifyChange(name));
        if (name) {
          controls.set(name, {
            get: () => select.value,
            set: (value) => (select.value = String(value ?? '')),
            focus: () => select.focus(),
            setEnabled: (on) => (select.disabled = !on),
          });
        }
        return field(item, select);
      }
      case 'button': {
        const button = el(
          'button',
          item.primary || item.buttonType === 'primary'
            ? 'nova-button nova-button-primary'
            : 'nova-button',
          item.text ?? '',
        );
        button.type = 'button';
        button.disabled = !enabled;
        button.addEventListener('click', () => spec.onAction?.(api, { name }));
        if (name) {
          controls.set(name, {
            get: () => undefined,
            set: () => {},
            focus: () => button.focus(),
            setEnabled: (on) => (button.disabled = !on),
          });
        }
        return button;
      }
      case 'htmlpanel': {
        const panel = el('div', 'nova-compat-html');
        panel.append(safeHtml(item.html ?? ''));
        return panel;
      }
      case 'alertbanner': {
        const banner = el('p', `nova-compat-alert is-${item.level ?? 'info'}`, item.text ?? '');
        banner.setAttribute('role', item.level === 'error' ? 'alert' : 'status');
        return banner;
      }
      case 'label': {
        const group = el('div', 'nova-compat-group');
        group.append(el('p', 'nova-label', item.label ?? ''));
        for (const child of (item.items ?? []) as DialogItem[]) {
          const node = render(child);
          if (node) group.append(node);
        }
        return group;
      }
      case 'grid':
      case 'bar': {
        const grid = el('div', 'nova-compat-grid');
        const columns =
          item.type === 'bar'
            ? (item.items?.length ?? 1)
            : item.columns === 'auto'
              ? 2
              : (item.columns ?? 2);
        grid.style.gridTemplateColumns = `repeat(${Number(columns) || 2}, minmax(0, 1fr))`;
        for (const child of (item.items ?? []) as DialogItem[]) {
          const node = render(child);
          if (node) grid.append(node);
        }
        return grid;
      }
      default:
        console.warn(`[nova] tinymce-compat: dialog component "${item.type}" is not supported yet`);
        return null;
    }
  }

  const body = el('div', 'nova-compat-dialog nova-form');
  if (spec.body.type === 'tabpanel') {
    const tabList = el('div', 'nova-compat-tabs');
    tabList.setAttribute('role', 'tablist');
    body.append(tabList);
    spec.body.tabs.forEach((tab, index) => {
      const name = tab.name ?? tab.title;
      const button = el('button', 'nova-compat-tab', tab.title);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      const panel = el('div', 'nova-compat-tabpanel');
      panel.setAttribute('role', 'tabpanel');
      for (const item of tab.items) {
        const node = render(item);
        if (node) panel.append(node);
      }
      button.addEventListener('click', () => api.showTab(name));
      tabs.set(name, { button, panel });
      tabList.append(button);
      body.append(panel);
      if (index === 0) currentTab = name;
    });
  } else {
    for (const item of spec.body.items) {
      const node = render(item);
      if (node) body.append(node);
    }
  }

  // Кнопки: submit — кнопка диалога, custom — ряд в конце, cancel — стандартная «Отмена».
  const buttons = spec.buttons ?? [];
  const submit = buttons.find((b) => b.type === 'submit');
  const custom = buttons.filter((b) => b.type === 'custom');
  if (custom.length) {
    const row = el('div', 'nova-compat-actions');
    for (const b of custom) {
      const button = el(
        'button',
        b.primary ? 'nova-button nova-button-primary' : 'nova-button',
        b.text,
      );
      button.type = 'button';
      button.disabled = b.enabled === false;
      button.addEventListener('click', () => spec.onAction?.(api, { name: b.name ?? b.text }));
      if (b.name) {
        controls.set(b.name, {
          get: () => undefined,
          set: () => {},
          focus: () => button.focus(),
          setEnabled: (on) => (button.disabled = !on),
        });
      }
      row.append(button);
    }
    body.append(row);
  }

  const api: DialogApi = {
    getData: () => {
      const data: Data = {};
      controls.forEach((control, name) => {
        const value = control.get();
        if (value !== undefined) data[name] = value;
      });
      return data;
    },
    setData: (data) => {
      for (const [name, value] of Object.entries(data)) controls.get(name)?.set(value);
    },
    close: () => {
      closedByApi = true;
      handle?.close();
    },
    block: () => handle?.setBusy(true),
    unblock: () => handle?.setBusy(false),
    focus: (name) => controls.get(name)?.focus(),
    disable: (name) => controls.get(name)?.setEnabled(false),
    enable: (name) => controls.get(name)?.setEnabled(true),
    showTab: (name) => {
      if (!tabs.has(name)) return;
      const old = currentTab;
      currentTab = name;
      tabs.forEach(({ button, panel }, key) => {
        const on = key === name;
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
        panel.hidden = !on;
      });
      if (old && old !== name) spec.onTabChange?.(api, { newTabName: name, oldTabName: old });
    },
    redial: (next) => {
      api.close();
      Object.assign(api, reopen(next));
    },
  };

  if (spec.initialData) api.setData(spec.initialData);
  if (currentTab) api.showTab(currentTab);

  handle = editor.ui.openDialog({
    title: spec.title,
    body,
    ...(submit ? { submitLabel: submit.text } : {}),
    ...(spec.size === 'large' ? { size: 'large' as const } : {}),
    onSubmit: () => {
      // Как в TinyMCE: диалог закрывает сам обработчик (api.close()).
      spec.onSubmit?.(api);
      return closedByApi;
    },
    onClose: () => {
      if (!closedByApi) spec.onCancel?.(api);
      spec.onClose?.();
    },
  });
  return api;
}
