/**
 * Диалог по описанию полей — для плагинов (editor.ui.dialog). Реализация (form-dialog.ts)
 * загружается при первом открытии: в первой загрузке ядра только эти типы.
 *
 *   const data = await editor.ui.dialog({
 *     title: 'Insert video',
 *     submitLabel: 'Insert',
 *     fields: [
 *       { type: 'url', name: 'src', label: 'Video URL', required: true },
 *       { type: 'checkbox', name: 'autoplay', label: 'Autoplay' },
 *     ],
 *   }); // данные или null, если диалог закрыли
 */

/** Значение поля; у поля файлов — массив выбранных файлов (пустой, если ничего не выбрано). */
export type DialogFieldValue = string | number | boolean | null | File[];
export type DialogData = Record<string, DialogFieldValue>;

interface FieldBase {
  name: string;
  label: string;
  /** Подсказка под полем (связана с полем через aria-describedby). */
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** Своя проверка: вернуть текст ошибки или ничего. */
  validate?: (value: DialogFieldValue, data: DialogData) => string | null | undefined | void;
}

export type DialogField =
  | (FieldBase & { type: 'text' | 'url' | 'email' | 'tel'; placeholder?: string })
  | (FieldBase & { type: 'number'; min?: number; max?: number; step?: number })
  | (FieldBase & { type: 'textarea'; rows?: number; placeholder?: string })
  | (FieldBase & { type: 'select'; options: { value: string; label: string }[] })
  | (FieldBase & { type: 'checkbox' | 'color' })
  | (FieldBase & {
      type: 'file';
      /** Допустимые типы, как у <input accept>: 'image/*,.pdf'. */
      accept?: string;
      multiple?: boolean;
      /** Наибольший размер одного файла в байтах. */
      maxSize?: number;
    })
  | { type: 'message'; text: string; tone?: 'info' | 'warning' | 'error' }
  | { type: 'custom'; render: (api: DialogApi) => HTMLElement };

/** Вкладка диалога: подпись и свои поля (данные всех вкладок — в одном объекте). */
export interface DialogTab {
  title: string;
  fields: DialogField[];
}

interface DialogSpecBase {
  title: string;
  initialData?: DialogData;
  /** Подпись кнопки отправки (по умолчанию «Сохранить»). */
  submitLabel?: string;
  cancelLabel?: string;
  size?: 'normal' | 'large';
  /**
   * Отправка после проверки полей. Вернуть false или текст ошибки — диалог останется открытым.
   * Можно вернуть промис (кнопки блокируются до его завершения).
   */
  onSubmit?: (
    data: DialogData,
    api: DialogApi,
  ) => void | boolean | string | Promise<void | boolean | string>;
  onChange?: (data: DialogData, details: { name: string }, api: DialogApi) => void;
  /** Диалог закрыли без отправки (Esc, «Отмена», крестик). */
  onCancel?: () => void;
  /** Закрыть диалог снаружи (например, при уходе со страницы): как «Отмена». */
  signal?: AbortSignal;
}

/** Поля — списком или по вкладкам (`tabs`). */
export type DialogSpec = DialogSpecBase &
  ({ fields: DialogField[]; tabs?: undefined } | { tabs: DialogTab[]; fields?: undefined });

export interface DialogApi {
  getData(): DialogData;
  setData(data: DialogData): void;
  /** Ошибка всего диалога (над кнопками). */
  setError(message: string | null): void;
  /** Ошибка поля (под полем). */
  setFieldError(name: string, message: string | null): void;
  setBusy(busy: boolean): void;
  setEnabled(name: string, enabled: boolean): void;
  focus(name: string): void;
  /** Показать вкладку (по номеру, с нуля). */
  showTab(index: number): void;
  close(): void;
}
