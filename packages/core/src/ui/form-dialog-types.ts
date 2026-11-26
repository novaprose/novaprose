/**
 * A dialog described by its fields, for plugins (editor.ui.dialog). The implementation
 * (form-dialog.ts) loads when a dialog first opens; only these types are in the core's first load.
 *
 *   const data = await editor.ui.dialog({
 *     title: 'Insert video',
 *     submitLabel: 'Insert',
 *     fields: [
 *       { type: 'url', name: 'src', label: 'Video URL', required: true },
 *       { type: 'checkbox', name: 'autoplay', label: 'Autoplay' },
 *     ],
 *   }); // the data, or null if the dialog was closed
 */

/** A field's value; for a file field, an array of the chosen files (empty when none). */
export type DialogFieldValue = string | number | boolean | null | File[];
export type DialogData = Record<string, DialogFieldValue>;

interface FieldBase {
  name: string;
  label: string;
  /** A hint under the field (linked to it through aria-describedby). */
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** Your own check: return an error message or nothing. */
  validate?: (value: DialogFieldValue, data: DialogData) => string | null | undefined | void;
}

export type DialogField =
  | (FieldBase & { type: 'text' | 'url' | 'email' | 'tel'; placeholder?: string })
  | (FieldBase & { type: 'number'; min?: number; max?: number; step?: number })
  | (FieldBase & {
      type: 'textarea';
      rows?: number;
      placeholder?: string;
      /** A field for code: monospace, no spell check, no line wrapping. */
      code?: boolean;
    })
  | (FieldBase & { type: 'select'; options: { value: string; label: string }[] })
  | (FieldBase & { type: 'checkbox' | 'color' })
  | (FieldBase & {
      type: 'file';
      /** Accepted types, as in <input accept>: 'image/*,.pdf'. */
      accept?: string;
      multiple?: boolean;
      /** The largest size of one file, in bytes. */
      maxSize?: number;
    })
  | { type: 'message'; text: string; tone?: 'info' | 'warning' | 'error' }
  | { type: 'custom'; render: (api: DialogApi) => HTMLElement };

/** A dialog tab: a title and its own fields (the data of all tabs comes in one object). */
export interface DialogTab {
  title: string;
  fields: DialogField[];
}

interface DialogSpecBase {
  title: string;
  initialData?: DialogData;
  /** Label of the submit button ("Save" by default). */
  submitLabel?: string;
  cancelLabel?: string;
  size?: 'normal' | 'large';
  /**
   * Submit after the fields are checked. Return false or an error message to keep the dialog open.
   * May return a promise (the buttons are disabled until it settles).
   */
  onSubmit?: (
    data: DialogData,
    api: DialogApi,
  ) => void | boolean | string | Promise<void | boolean | string>;
  onChange?: (data: DialogData, details: { name: string }, api: DialogApi) => void;
  /** The dialog was closed without submitting (Esc, Cancel, the close button). */
  onCancel?: () => void;
  /** Close the dialog from outside (for example, when leaving the page), like Cancel. */
  signal?: AbortSignal;
}

/** Fields as a list or in tabs (`tabs`). */
export type DialogSpec = DialogSpecBase &
  ({ fields: DialogField[]; tabs?: undefined } | { tabs: DialogTab[]; fields?: undefined });

export interface DialogApi {
  getData(): DialogData;
  setData(data: DialogData): void;
  /** An error for the whole dialog (above the buttons). */
  setError(message: string | null): void;
  /** An error for a field (under it). */
  setFieldError(name: string, message: string | null): void;
  setBusy(busy: boolean): void;
  setEnabled(name: string, enabled: boolean): void;
  focus(name: string): void;
  /** Show a tab (by index, from zero). */
  showTab(index: number): void;
  close(): void;
}
