import {
  createEditor,
  hasLanguage,
  loadLanguage,
  type Editor,
  type EditorOptions,
} from '@novaprose/core';

/** Имя тега по умолчанию. */
export const DEFAULT_TAG = 'novaprose-editor';

/** Опции, которые можно передать свойством `init` до подключения элемента в DOM. */
export type NovaProseElementInit = Omit<EditorOptions, 'element' | 'content'>;

/** Публичный интерфейс элемента `<novaprose-editor>`. */
export interface NovaProseEditorElement extends HTMLElement {
  /** Экземпляр редактора; `null`, пока элемент не подключён к DOM. */
  readonly editor: Editor | null;
  /** Текущий HTML. Установка не попадает в undo и не вызывает `input` — как у `<textarea>`. */
  value: string;
  /** Опции ядра; читаются при подключении элемента. */
  init: NovaProseElementInit;
  readonly form: HTMLFormElement | null;
  readonly validity: ValidityState | undefined;
  readonly validationMessage: string;
  checkValidity(): boolean;
  reportValidity(): boolean;
}

const OBSERVED = ['readonly', 'disabled', 'required'] as const;

let elementClass: (new () => NovaProseEditorElement) | undefined;

/**
 * Класс элемента. Создаётся лениво: на сервере (SSR) нет `HTMLElement`, и импорт пакета не должен падать.
 */
export function getNovaProseEditorClass(): new () => NovaProseEditorElement {
  if (elementClass) return elementClass;

  class NovaProseEditor extends HTMLElement implements NovaProseEditorElement {
    /** Участвует в формах как обычное поле: FormData, reset, disabled, required. */
    static formAssociated = true;
    static observedAttributes = [...OBSERVED];

    #internals: ElementInternals | null = null;
    #editor: Editor | null = null;
    #init: NovaProseElementInit = {};
    /** Значение до подключения (свойство `value`, выставленное заранее). */
    #pending: string | undefined;
    /** Исходное значение — к нему возвращает reset формы. */
    #default: string | null = null;
    #formDisabled = false;
    #syncing = false;
    #valueAtFocus = '';
    /** Загрузка языка перед созданием редактора: ещё не начата, идёт, закончилась (успешно или нет). */
    #language: 'idle' | 'loading' | 'done' = 'idle';

    constructor() {
      super();
      this.#internals = typeof this.attachInternals === 'function' ? this.attachInternals() : null;
      // Сам элемент не фокусируемый, и браузер не может перевести фокус на поле с ошибкой.
      // Делаем это сами — до того, как браузер покажет подсказку: если ставить фокус в
      // contenteditable при уже видимой подсказке, WebKit теряет ввод после первой буквы.
      this.addEventListener('invalid', () => {
        if (this.#isFirstInvalid()) this.#editor?.focus();
      });
    }

    get editor(): Editor | null {
      return this.#editor;
    }

    get init(): NovaProseElementInit {
      return this.#init;
    }

    set init(value: NovaProseElementInit) {
      this.#init = value ?? {};
    }

    get value(): string {
      if (this.#editor) return this.#editor.getHTML();
      return this.#pending ?? this.getAttribute('value') ?? '';
    }

    set value(html: string) {
      const editor = this.#editor;
      if (!editor) {
        this.#pending = html;
        return;
      }
      // Тот же HTML — ничего не делаем: двусторонняя привязка (Svelte, Angular) пишет value обратно
      // на каждый ввод, и setContent сбрасывал бы курсор.
      if (html === editor.getHTML()) return;
      this.#syncing = true;
      try {
        editor.setContent(html ?? '', { addToHistory: false });
      } finally {
        this.#syncing = false;
      }
      this.#syncForm();
    }

    get form(): HTMLFormElement | null {
      return this.#internals?.form ?? null;
    }

    get validity(): ValidityState | undefined {
      return this.#internals?.validity;
    }

    get validationMessage(): string {
      return this.#internals?.validationMessage ?? '';
    }

    checkValidity(): boolean {
      return this.#internals?.checkValidity() ?? true;
    }

    reportValidity(): boolean {
      return this.#internals?.reportValidity() ?? true;
    }

    override focus(options?: FocusOptions): void {
      if (this.#editor) this.#editor.focus();
      else super.focus(options);
    }

    connectedCallback(): void {
      // Перенос элемента в DOM (disconnect → connect) не пересоздаёт редактор: история сохраняется.
      if (this.#editor) return;
      // Скрипт в <head>: элемент подключается до того, как парсер дошёл до вложенной разметки.
      // Ждём конца разбора документа, иначе начальное содержимое потеряется.
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.#mount(), { once: true });
        return;
      }
      this.#mount();
    }

    #mount(): void {
      if (this.#editor || !this.isConnected) return;

      // Язык с загрузчиком (в CDN-сборке — все пакеты) грузим до создания редактора: строки интерфейса
      // берутся при нём. Готовый язык — без задержки; не загрузился — английский, редактор работает.
      const wanted = this.getAttribute('language') ?? this.#init.language;
      if (wanted && this.#language !== 'done' && !hasLanguage(wanted)) {
        if (this.#language === 'idle') {
          this.#language = 'loading';
          void loadLanguage(wanted)
            .catch((error: unknown) => console.warn('[nova] language pack failed to load', error))
            .finally(() => {
              this.#language = 'done';
              this.#mount();
            });
        }
        return;
      }

      // Прогрессивное улучшение: разметка внутри тега видна без JS и становится начальным содержимым.
      const content = this.#pending ?? this.getAttribute('value') ?? this.innerHTML.trim();
      this.#pending = undefined;
      this.#default ??= content;
      this.replaceChildren();

      const attr = (name: string) => this.getAttribute(name);
      const fromAttributes: Partial<EditorOptions> = {};
      const placeholder = attr('placeholder');
      if (placeholder !== null) fromAttributes.placeholder = placeholder;
      const toolbar = attr('toolbar');
      if (toolbar !== null) fromAttributes.toolbar = toolbar === 'false' ? false : toolbar;
      if (this.hasAttribute('menubar')) fromAttributes.menubar = attr('menubar') !== 'false';
      if (attr('statusbar') === 'false') fromAttributes.statusbar = false;
      const language = attr('language');
      if (language !== null) fromAttributes.language = language;
      const mode = attr('mode');
      if (mode !== null) fromAttributes.mode = mode as EditorOptions['mode'];

      const editor = createEditor({
        ...this.#init,
        ...fromAttributes,
        element: this,
        content,
        editable: this.#isEditable(),
      });
      this.#editor = editor;

      editor.on('change', () => {
        this.#syncForm();
        if (!this.#syncing)
          this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      });
      editor.on('focus', () => {
        this.#valueAtFocus = editor.getHTML();
      });
      editor.on('blur', () => {
        if (editor.getHTML() !== this.#valueAtFocus) {
          this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        }
      });
      this.#syncForm();
      this.dispatchEvent(
        new CustomEvent('novaprose-ready', { detail: { editor }, bubbles: true, composed: true }),
      );
    }

    disconnectedCallback(): void {
      // Откладываем: если элемент просто переносят, он подключится обратно в этой же задаче.
      queueMicrotask(() => {
        if (this.isConnected || !this.#editor) return;
        this.#pending = this.#editor.getHTML();
        this.#editor.destroy();
        this.#editor = null;
      });
    }

    attributeChangedCallback(name: (typeof OBSERVED)[number]): void {
      if (!this.#editor) return;
      if (name === 'required') this.#syncForm();
      else this.#editor.setEditable(this.#isEditable());
    }

    // ---------- form-associated callbacks ----------

    formResetCallback(): void {
      this.value = this.#default ?? '';
    }

    formDisabledCallback(disabled: boolean): void {
      this.#formDisabled = disabled;
      this.#editor?.setEditable(this.#isEditable());
    }

    formStateRestoreCallback(state: string | File | FormData | null): void {
      if (typeof state === 'string') this.value = state;
    }

    /** Первое невалидное поле формы — его браузер выбрал бы для фокуса при отправке. */
    #isFirstInvalid(): boolean {
      const form = this.form;
      if (!form) return true;
      for (const control of Array.from(form.elements) as Array<
        Element & { validity?: ValidityState }
      >) {
        if (control.validity && !control.validity.valid) return control === this;
      }
      return false;
    }

    #isEditable(): boolean {
      return (
        !this.hasAttribute('readonly') && !this.hasAttribute('disabled') && !this.#formDisabled
      );
    }

    #syncForm(): void {
      const internals = this.#internals;
      const editor = this.#editor;
      if (!internals || !editor || typeof internals.setFormValue !== 'function') return;
      const html = editor.getHTML();
      internals.setFormValue(html);
      if (this.hasAttribute('required') && editor.isEmpty()) {
        internals.setValidity(
          { valueMissing: true },
          editor.ui.t('editor.required'),
          // Якорь — сам элемент, а не contenteditable внутри: в WebKit пузырь подсказки,
          // привязанный к contenteditable, съедает ввод после первой буквы.
          this,
        );
      } else {
        internals.setValidity({});
      }
    }
  }

  elementClass = NovaProseEditor;
  return elementClass;
}

/**
 * Регистрирует `<novaprose-editor>` (или свой тег). Повторный вызов безопасен.
 * На сервере ничего не делает.
 */
export function defineNovaProseEditor(tagName: string = DEFAULT_TAG): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;
  // Свой тег требует своего подкласса: один конструктор нельзя регистрировать дважды.
  const base = getNovaProseEditorClass();
  customElements.define(tagName, tagName === DEFAULT_TAG ? base : class extends base {});
}

declare global {
  interface HTMLElementTagNameMap {
    'novaprose-editor': NovaProseEditorElement;
  }
}
