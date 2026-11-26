import { activeElement, FOCUSABLE, h, icon, listenDocument, uniqueId } from './dom';
import { icons } from './icons';

export interface DialogOptions {
  host: HTMLElement;
  title: string;
  body: HTMLElement;
  /** Without submitLabel the dialog is informational: the footer has only the cancelLabel button ("Close"). */
  submitLabel?: string;
  cancelLabel: string;
  closeLabel: string;
  /** Return false (or an error message) to keep the dialog open. */
  onSubmit?: () => boolean | string | void | Promise<boolean | string | void>;
  /** large — for the preview and the HTML source. */
  size?: 'normal' | 'large';
  onClose?: () => void;
  /** Where focus returns after closing. */
  returnFocus?: () => void;
  /** The element that gets focus on opening (the first field by default). */
  initialFocus?: HTMLElement;
}

export interface DialogHandle {
  el: HTMLElement;
  close(): void;
  setError(message: string | null): void;
  setBusy(busy: boolean): void;
}

/**
 * Модальный диалог: focus trap, Escape, возврат фокуса, Enter = отправка формы.
 * На узких экранах CSS превращает его в нижний лист (sheet).
 */
export function openDialog(options: DialogOptions): DialogHandle {
  const titleId = uniqueId('nova-dialog-title');
  const error = h('p', { className: 'nova-dialog-error', role: 'alert', hidden: true });
  const submit = h(
    'button',
    { type: 'submit', className: 'nova-button nova-button-primary', hidden: !options.submitLabel },
    options.submitLabel ?? '',
  );
  const cancel = h('button', { type: 'button', className: 'nova-button' }, options.cancelLabel);
  const closeButton = h(
    'button',
    { type: 'button', className: 'nova-btn nova-dialog-close', 'aria-label': options.closeLabel },
    icon(icons.close),
  );

  const form = h(
    'form',
    {
      className: options.size === 'large' ? 'nova-dialog nova-dialog-large' : 'nova-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      novalidate: true,
    },
    h(
      'header',
      { className: 'nova-dialog-header' },
      h('h2', { id: titleId }, options.title),
      closeButton,
    ),
    h('div', { className: 'nova-dialog-body' }, options.body, error),
    h('footer', { className: 'nova-dialog-footer' }, cancel, submit),
  );
  const backdrop = h('div', { className: 'nova-dialog-backdrop' }, form);
  options.host.append(backdrop);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    stopKeepFocus();
    options.onClose?.();
    options.returnFocus?.();
  };

  const setError = (message: string | null) => {
    error.hidden = !message;
    error.textContent = message ?? '';
  };

  const setBusy = (busy: boolean) => {
    submit.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = options.onSubmit ? await options.onSubmit() : true;
      if (typeof result === 'string') setError(result);
      else if (result !== false) close();
    } finally {
      if (!closed) setBusy(false);
    }
  });
  cancel.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });

  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      const focusable = [...form.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hidden,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && activeElement(form) === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement(form) === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // Если фокус всё же ушёл наружу (клик мимо, программный фокус) — возвращаем в диалог.
  // Цель — настоящая и в теневом корне (у слушателя на document она подменена хостом).
  const stopKeepFocus = listenDocument(form, 'focusin', (_event, target) => {
    if (!form.contains(target)) {
      (form.querySelector<HTMLElement>(FOCUSABLE) ?? form).focus();
    }
  });

  const first =
    options.initialFocus ??
    form.querySelector<HTMLElement>('.nova-dialog-body input, .nova-dialog-body textarea');
  // Без полей ввода — на видимую кнопку (submit может быть скрыт у информационных диалогов).
  (first ?? (options.submitLabel ? submit : cancel)).focus();

  return { el: form, close, setError, setBusy };
}

// ---------- поля форм ----------

export interface TextFieldOptions {
  label: string;
  value?: string;
  type?: 'text' | 'url';
  placeholder?: string;
  hint?: string;
  required?: boolean;
  autocomplete?: string;
}

export function textField(options: TextFieldOptions): { el: HTMLElement; input: HTMLInputElement } {
  const id = uniqueId('nova-field');
  const hintId = options.hint ? `${id}-hint` : undefined;
  const input = h('input', {
    id,
    type: options.type ?? 'text',
    className: 'nova-input',
    value: options.value ?? '',
    placeholder: options.placeholder,
    required: options.required ?? false,
    autocomplete: options.autocomplete ?? 'off',
    spellcheck: 'false',
    'aria-describedby': hintId,
  });
  input.value = options.value ?? '';
  const el = h(
    'div',
    { className: 'nova-field' },
    h('label', { for: id, className: 'nova-label' }, options.label),
    input,
    options.hint ? h('p', { id: hintId, className: 'nova-hint' }, options.hint) : null,
  );
  return { el, input };
}

export function checkboxField(
  label: string,
  checked = false,
): { el: HTMLElement; input: HTMLInputElement } {
  const id = uniqueId('nova-check');
  const input = h('input', { id, type: 'checkbox', className: 'nova-checkbox' });
  input.checked = checked;
  const el = h(
    'div',
    { className: 'nova-field nova-field-inline' },
    input,
    h('label', { for: id }, label),
  );
  return { el, input };
}

export interface SelectFieldOptions {
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

/** Выпадающий список с подписью — для диалогов свойств. */
export function selectField(options: SelectFieldOptions): {
  el: HTMLElement;
  select: HTMLSelectElement;
} {
  const id = uniqueId('nova-field');
  const select = h(
    'select',
    { id, className: 'nova-input nova-select' },
    ...options.options.map((o) => h('option', { value: o.value }, o.label)),
  );
  select.value = options.value;
  const el = h(
    'div',
    { className: 'nova-field' },
    h('label', { for: id, className: 'nova-label' }, options.label),
    select,
  );
  return { el, select };
}
