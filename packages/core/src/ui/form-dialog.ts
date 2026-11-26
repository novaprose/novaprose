import type { Translator } from '../i18n';
import type { DialogHandle, DialogOptions } from './dialog';
import { h, uniqueId } from './dom';
import type {
  DialogApi,
  DialogData,
  DialogField,
  DialogFieldValue,
  DialogSpec,
} from './form-dialog-types';

/**
 * Диалог по описанию полей: подписи, подсказки, проверка, ошибки у поля, доступность
 * (label, aria-invalid, aria-describedby, фокус на первом неверном поле). Ленивый чанк ядра.
 */

interface Control {
  field: Extract<DialogField, { name: string }>;
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  error: HTMLElement;
  hintId?: string;
}

type OpenDialog = (
  options: Omit<DialogOptions, 'host' | 'cancelLabel' | 'closeLabel' | 'returnFocus'> & {
    cancelLabel?: string;
  },
) => DialogHandle;

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

  const read = (control: Control): DialogFieldValue => {
    const { field, input } = control;
    if (field.type === 'checkbox') return (input as HTMLInputElement).checked;
    if (field.type === 'number') {
      const n = (input as HTMLInputElement).valueAsNumber;
      return Number.isFinite(n) ? n : null;
    }
    return input.value;
  };

  const write = (control: Control, value: DialogFieldValue) => {
    const { field, input } = control;
    if (field.type === 'checkbox') (input as HTMLInputElement).checked = Boolean(value);
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
    focus: (name) => controls.get(name)?.input.focus(),
    close: () => handle?.close(),
  };

  /** Проверка всех полей: ошибки у полей, фокус на первом неверном. */
  const validate = (data: DialogData): boolean => {
    let first: Control | null = null;
    controls.forEach((control, name) => {
      const { field, input } = control;
      const value = data[name] ?? null;
      const empty = value === null || value === '' || value === false;
      let message: string | null = null;
      if (field.required && empty) message = t('dialog.required');
      else if (!empty && 'validity' in input && input.validity.typeMismatch) {
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
    (first as Control | null)?.input.focus();
    return !first;
  };

  const render = (field: DialogField): HTMLElement => {
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
        className: 'nova-input',
        rows: String(field.rows ?? 4),
        placeholder: field.placeholder,
      });
    } else if (field.type === 'select') {
      input = h(
        'select',
        { id, className: 'nova-input nova-select' },
        ...field.options.map((o) => h('option', { value: o.value }, o.label)),
      );
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
    const control: Control = { field, input, error, hintId };
    controls.set(field.name, control);
    input.addEventListener(
      field.type === 'checkbox' || field.type === 'select' ? 'change' : 'input',
      () => {
        if (!error.hidden) setFieldError(field.name, null);
        spec.onChange?.(api.getData(), { name: field.name }, api);
      },
    );
    // Обязательное поле отмечено звёздочкой; дикторам её не читаем — им сообщает aria-required.
    const label = h(
      'label',
      { for: id, className: field.type === 'checkbox' ? null : 'nova-label' },
      field.label,
      field.required
        ? h('span', { className: 'nova-required', 'aria-hidden': 'true' }, ' *')
        : null,
    );
    const hint = hintId ? h('p', { id: hintId, className: 'nova-hint' }, field.hint!) : null;
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

  const body = h('div', { className: 'nova-form' }, ...spec.fields.map(render));
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
