import type { Translator } from '../i18n';
import type { DialogHandle, DialogOptions } from './dialog';
import { h, logicalKey, uniqueId } from './dom';
import css from './form-dialog.css?raw';
import type {
  DialogApi,
  DialogData,
  DialogField,
  DialogFieldValue,
  DialogSpec,
} from './form-dialog-types';

/**
 * Диалог по описанию полей: подписи, подсказки, проверка, ошибки у поля, доступность
 * (label, aria-invalid, aria-describedby, фокус на первом неверном поле), вкладки (WAI-ARIA tabs)
 * и поле файлов с зоной перетаскивания. Ленивый чанк ядра.
 */

/** Стили диалога (ошибки полей, вкладки, файлы) — подключаются вместе с его кодом. */
export const formDialogCss = css;

type NamedField = Extract<DialogField, { name: string }>;

interface Control {
  field: NamedField;
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  error: HTMLElement;
  hintId?: string;
  /** Номер вкладки, на которой поле (для перехода к ошибке). */
  tab: number;
  /** Поле файлов: выбранные файлы и перерисовка их списка. */
  files?: File[];
  renderFiles?: () => void;
}

type OpenDialog = (
  options: Omit<DialogOptions, 'host' | 'cancelLabel' | 'closeLabel' | 'returnFocus'> & {
    cancelLabel?: string;
  },
) => DialogHandle;

/** Файл подходит под accept ('image/*,.pdf,application/zip'). */
function accepts(accept: string | undefined, file: File): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) =>
      token.startsWith('.')
        ? name.endsWith(token)
        : token.endsWith('/*')
          ? type.startsWith(token.slice(0, -1))
          : type === token,
    );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function openFormDialog(
  spec: DialogSpec,
  t: Translator,
  open: OpenDialog,
): Promise<DialogData | null> {
  const controls = new Map<string, Control>();
  let handle: DialogHandle | null = null;
  let resolve!: (data: DialogData | null) => void;
  const result = new Promise<DialogData | null>((r) => (resolve = r));
  let submitted = false;
  let showTab: (index: number, focus?: boolean) => void = () => {};

  const read = (control: Control): DialogFieldValue => {
    const { field, input } = control;
    if (field.type === 'file') return [...(control.files ?? [])];
    if (field.type === 'checkbox') return (input as HTMLInputElement).checked;
    if (field.type === 'number') {
      const n = (input as HTMLInputElement).valueAsNumber;
      return Number.isFinite(n) ? n : null;
    }
    return input.value;
  };

  const write = (control: Control, value: DialogFieldValue) => {
    const { field, input } = control;
    if (field.type === 'file') {
      control.files = Array.isArray(value) ? value.filter((f) => f instanceof File) : [];
      control.renderFiles?.();
    } else if (field.type === 'checkbox') (input as HTMLInputElement).checked = Boolean(value);
    else input.value = value === null || value === undefined ? '' : String(value);
  };

  const setFieldError = (name: string, message: string | null) => {
    const control = controls.get(name);
    if (!control) return;
    control.error.textContent = message ?? '';
    control.error.hidden = !message;
    control.input.setAttribute('aria-invalid', String(!!message));
    const describedBy = [control.hintId, message ? control.error.id : null].filter(Boolean);
    if (describedBy.length) control.input.setAttribute('aria-describedby', describedBy.join(' '));
    else control.input.removeAttribute('aria-describedby');
  };

  const changed = (name: string) => spec.onChange?.(api.getData(), { name }, api);

  const api: DialogApi = {
    getData() {
      const data: DialogData = {};
      controls.forEach((control, name) => (data[name] = read(control)));
      return data;
    },
    setData(data) {
      for (const [name, value] of Object.entries(data)) {
        const control = controls.get(name);
        if (control) write(control, value);
      }
    },
    setError: (message) => handle?.setError(message),
    setFieldError,
    setBusy: (busy) => handle?.setBusy(busy),
    setEnabled(name, enabled) {
      const control = controls.get(name);
      if (control) control.input.disabled = !enabled;
    },
    focus(name) {
      const control = controls.get(name);
      if (!control) return;
      showTab(control.tab);
      control.input.focus();
    },
    showTab: (index) => showTab(index),
    close: () => handle?.close(),
  };

  /** Проверка всех полей: ошибки у полей; фокус на первом неверном (с переходом на его вкладку). */
  const validate = (data: DialogData): boolean => {
    let first: Control | null = null;
    controls.forEach((control, name) => {
      const { field, input } = control;
      const value = data[name] ?? null;
      const empty =
        value === null ||
        value === '' ||
        value === false ||
        (Array.isArray(value) && !value.length);
      let message: string | null = null;
      if (field.required && empty) message = t('dialog.required');
      else if (
        !empty &&
        field.type !== 'file' &&
        'validity' in input &&
        input.validity.typeMismatch
      ) {
        message = t('dialog.invalid');
      } else if (!empty && field.type === 'number') {
        const { min, max } = field;
        if (
          (min !== undefined && Number(value) < min) ||
          (max !== undefined && Number(value) > max)
        )
          message = t('dialog.invalid');
      }
      message ??= field.validate?.(value, data) || null;
      setFieldError(name, message);
      if (message && !first) first = control;
    });
    const invalid = first as Control | null;
    if (invalid) {
      showTab(invalid.tab);
      invalid.input.focus();
    }
    return !invalid;
  };

  /**
   * Поле файлов: скрытый <input type=file> (он и получает фокус) + зона перетаскивания,
   * под ней подсказка (про допустимые файлы), затем список выбранных.
   */
  const fileField = (
    field: Extract<DialogField, { type: 'file' }>,
    id: string,
    control: Control,
    hint: HTMLElement | null,
  ): HTMLElement => {
    const input = control.input as HTMLInputElement;
    const list = h('ul', { className: 'nova-file-list' });
    const add = (incoming: File[]) => {
      let message: string | null = null;
      const fitting = incoming.filter((file) => {
        if (!accepts(field.accept, file)) {
          message = t('dialog.fileType');
          return false;
        }
        if (field.maxSize !== undefined && file.size > field.maxSize) {
          message = t('dialog.fileTooLarge');
          return false;
        }
        return true;
      });
      if (fitting.length) {
        control.files = field.multiple ? [...(control.files ?? []), ...fitting] : [fitting.at(-1)!];
        control.renderFiles!();
      }
      setFieldError(field.name, message);
      if (fitting.length) changed(field.name);
    };
    control.renderFiles = () => {
      list.replaceChildren(
        ...(control.files ?? []).map((file, index) =>
          h(
            'li',
            { className: 'nova-file' },
            h('span', { className: 'nova-file-name' }, file.name),
            h('span', { className: 'nova-file-size' }, formatSize(file.size)),
            h(
              'button',
              {
                type: 'button',
                className: 'nova-button nova-file-remove',
                'aria-label': `${t('dialog.removeFile')}: ${file.name}`,
                onClick: () => {
                  control.files = control.files!.filter((_, i) => i !== index);
                  control.renderFiles!();
                  changed(field.name);
                  input.focus();
                },
              },
              t('dialog.removeFile'),
            ),
          ),
        ),
      );
    };
    input.addEventListener('change', () => {
      add([...(input.files ?? [])]);
      input.value = '';
    });
    const zone = h(
      'label',
      { for: id, className: 'nova-dropzone' },
      h('span', {}, t('dialog.dropFiles')),
      h('span', { className: 'nova-button', 'aria-hidden': 'true' }, t('dialog.browse')),
      input,
    );
    zone.addEventListener('dragover', (event) => {
      if (input.disabled) return;
      event.preventDefault();
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
    zone.addEventListener('drop', (event) => {
      zone.classList.remove('is-dragover');
      if (input.disabled) return;
      event.preventDefault();
      add([...((event as DragEvent).dataTransfer?.files ?? [])]);
    });
    return h('div', { className: 'nova-file-field' }, zone, hint, list);
  };

  const render = (field: DialogField, tab: number): HTMLElement => {
    if (field.type === 'message') {
      return h(
        'p',
        {
          className: `nova-form-message is-${field.tone ?? 'info'}`,
          role: field.tone === 'error' ? 'alert' : null,
        },
        field.text,
      );
    }
    if (field.type === 'custom') return field.render(api);
    const id = uniqueId('nova-field');
    const hintId = field.hint ? `${id}-hint` : undefined;
    const error = h('p', { id: `${id}-error`, className: 'nova-field-error', hidden: true });
    let input: Control['input'];
    if (field.type === 'textarea') {
      input = h('textarea', {
        id,
        className: field.code
          ? 'nova-input nova-textarea nova-input-code'
          : 'nova-input nova-textarea',
        rows: String(field.rows ?? 4),
        placeholder: field.placeholder,
      });
      if (field.code) {
        // Код: без проверки орфографии, автозамены и заглавных букв на телефоне, строки не переносятся.
        input.spellcheck = false;
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('wrap', 'off');
      }
    } else if (field.type === 'select') {
      input = h(
        'select',
        { id, className: 'nova-input nova-select' },
        ...field.options.map((o) => h('option', { value: o.value }, o.label)),
      );
    } else if (field.type === 'file') {
      input = h('input', {
        id,
        type: 'file',
        className: 'nova-visually-hidden',
        accept: field.accept,
        multiple: !!field.multiple,
      });
    } else {
      input = h('input', {
        id,
        type: field.type,
        className: field.type === 'checkbox' ? 'nova-checkbox' : 'nova-input',
        placeholder: 'placeholder' in field ? field.placeholder : undefined,
        autocomplete: 'off',
        ...(field.type === 'number'
          ? { min: field.min, max: field.max, step: field.step ?? 'any' }
          : {}),
      });
    }
    input.name = field.name;
    input.disabled = !!field.disabled;
    if (field.required) input.setAttribute('aria-required', 'true');
    if (hintId) input.setAttribute('aria-describedby', hintId);
    const control: Control = { field, input, error, hintId, tab };
    controls.set(field.name, control);
    if (field.type !== 'file') {
      input.addEventListener(
        field.type === 'checkbox' || field.type === 'select' ? 'change' : 'input',
        () => {
          if (!error.hidden) setFieldError(field.name, null);
          changed(field.name);
        },
      );
    }
    // Обязательное поле отмечено звёздочкой; дикторам её не читаем — им сообщает aria-required.
    const label = h(
      field.type === 'file' ? 'span' : 'label',
      {
        ...(field.type === 'file' ? { id: `${id}-label` } : { for: id }),
        className: field.type === 'checkbox' ? null : 'nova-label',
      },
      field.label,
      field.required
        ? h('span', { className: 'nova-required', 'aria-hidden': 'true' }, ' *')
        : null,
    );
    const hint = hintId ? h('p', { id: hintId, className: 'nova-hint' }, field.hint!) : null;
    if (field.type === 'file') {
      // Имя поля для дикторов — его подпись (зона — тоже label, но с текстом «перетащите…»).
      input.setAttribute('aria-labelledby', `${id}-label`);
      return h(
        'div',
        { className: 'nova-field' },
        label,
        fileField(field, id, control, hint),
        error,
      );
    }
    return field.type === 'checkbox'
      ? h(
          'div',
          { className: 'nova-field' },
          h('div', { className: 'nova-field nova-field-inline' }, input, label),
          hint,
          error,
        )
      : h('div', { className: 'nova-field' }, label, input, hint, error);
  };

  /** Вкладки по WAI-ARIA: tablist, стрелки (в RTL — зеркально), Home/End, панели tabpanel. */
  const renderTabs = (tabs: NonNullable<DialogSpec['tabs']>): HTMLElement => {
    const baseId = uniqueId('nova-tab');
    const buttons: HTMLButtonElement[] = [];
    const panels: HTMLElement[] = [];
    tabs.forEach((tab, index) => {
      buttons.push(
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            id: `${baseId}-${index}`,
            className: 'nova-tab',
            'aria-controls': `${baseId}-panel-${index}`,
            onClick: () => showTab(index, true),
          },
          tab.title,
        ),
      );
      panels.push(
        h(
          'div',
          {
            role: 'tabpanel',
            id: `${baseId}-panel-${index}`,
            className: 'nova-form nova-tabpanel',
            'aria-labelledby': `${baseId}-${index}`,
          },
          ...tab.fields.map((field) => render(field, index)),
        ),
      );
    });
    const list = h(
      'div',
      { role: 'tablist', className: 'nova-tabs', 'aria-label': spec.title },
      ...buttons,
    );
    list.addEventListener('keydown', (event) => {
      const current = buttons.indexOf(event.target as HTMLButtonElement);
      if (current < 0) return;
      const key = logicalKey(event, list);
      const next =
        key === 'ArrowRight'
          ? (current + 1) % buttons.length
          : key === 'ArrowLeft'
            ? (current - 1 + buttons.length) % buttons.length
            : key === 'Home'
              ? 0
              : key === 'End'
                ? buttons.length - 1
                : -1;
      if (next < 0) return;
      event.preventDefault();
      showTab(next, true);
    });
    showTab = (index, focus = false) => {
      if (!buttons[index]) return;
      buttons.forEach((button, i) => {
        const selected = i === index;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        panels[i]!.hidden = !selected;
      });
      if (focus) buttons[index]!.focus();
    };
    showTab(0);
    return h('div', { className: 'nova-tabbed' }, list, ...panels);
  };

  const body = spec.tabs
    ? renderTabs(spec.tabs)
    : h('div', { className: 'nova-form' }, ...spec.fields.map((field) => render(field, 0)));
  if (spec.initialData) api.setData(spec.initialData);

  handle = open({
    title: spec.title,
    body,
    submitLabel: spec.submitLabel ?? t('dialog.save'),
    ...(spec.cancelLabel ? { cancelLabel: spec.cancelLabel } : {}),
    ...(spec.size ? { size: spec.size } : {}),
    onSubmit: async () => {
      const data = api.getData();
      if (!validate(data)) return false;
      const outcome = await spec.onSubmit?.(data, api);
      if (outcome === false || typeof outcome === 'string') return outcome;
      submitted = true;
      resolve(data);
      return true;
    },
    onClose: () => {
      if (submitted) return;
      spec.onCancel?.();
      resolve(null);
    },
  });
  if (spec.signal) {
    if (spec.signal.aborted) handle.close();
    else spec.signal.addEventListener('abort', () => handle?.close(), { once: true });
  }
  return result;
}
