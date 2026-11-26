import {
  createEditor,
  hasLanguage,
  loadLanguage,
  type Editor,
  type EditorOptions,
} from '@novaprose/core';

/** The default tag name. */
export const DEFAULT_TAG = 'novaprose-editor';

/** Options that can be passed with the `init` property before the element is connected to the DOM. */
export type NovaProseElementInit = Omit<EditorOptions, 'element' | 'content'>;

/** The public interface of the `<novaprose-editor>` element. */
export interface NovaProseEditorElement extends HTMLElement {
  /** The editor instance; `null` until the element is connected to the DOM. */
  readonly editor: Editor | null;
  /** The current HTML. Setting it skips undo and doesn't fire `input`, like a `<textarea>`. */
  value: string;
  /** Core options; read when the element connects. */
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
 * The element class. Created lazily: there is no `HTMLElement` on the server (SSR), and importing the package must not throw.
 */
export function getNovaProseEditorClass(): new () => NovaProseEditorElement {
  if (elementClass) return elementClass;

  class NovaProseEditor extends HTMLElement implements NovaProseEditorElement {
    /** Takes part in forms like a regular field: FormData, reset, disabled, required. */
    static formAssociated = true;
    static observedAttributes = [...OBSERVED];

    #internals: ElementInternals | null = null;
    #editor: Editor | null = null;
    #init: NovaProseElementInit = {};
    /** The value before connecting (the `value` property set in advance). */
    #pending: string | undefined;
    /** The initial value that a form reset returns to. */
    #default: string | null = null;
    #formDisabled = false;
    #syncing = false;
    #valueAtFocus = '';
    /** Loading the language before the editor is created: not started, running, finished (successfully or not). */
    #language: 'idle' | 'loading' | 'done' = 'idle';

    constructor() {
      super();
      this.#internals = typeof this.attachInternals === 'function' ? this.attachInternals() : null;
      // The element itself isn't focusable, and the browser can't move focus to the invalid field.
      // We do it ourselves, before the browser shows its hint: if focus moves into
      // contenteditable while the hint is already visible, WebKit loses input after the first letter.
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
      // The same HTML: do nothing. Two-way binding (Svelte, Angular) writes value back
      // on every keystroke, and setContent would reset the cursor.
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
      // Moving the element in the DOM (disconnect → connect) doesn't recreate the editor: the history is kept.
      if (this.#editor) return;
      // A script in <head>: the element connects before the parser reaches the markup inside it.
      // Wait until the document is parsed, otherwise the initial content is lost.
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.#mount(), { once: true });
        return;
      }
      this.#mount();
    }

    #mount(): void {
      if (this.#editor || !this.isConnected) return;

      // A language with a loader (every pack in the CDN build) loads before the editor is created: interface
      // strings are read then. A ready language means no delay; if it fails to load, English is used and the editor works.
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

      // Progressive enhancement: the markup inside the tag shows without JS and becomes the initial content.
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
      // Deferred: if the element is only being moved, it connects back within the same task.
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

    /** The first invalid field of the form: the one the browser would focus on submit. */
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
          // The anchor is the element itself, not the contenteditable inside: in WebKit the hint bubble
          // anchored to contenteditable swallows input after the first letter.
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
 * Registers `<novaprose-editor>` (or your own tag). Calling it again is safe. Does nothing on the
 * server.
 */
export function defineNovaProseEditor(tagName: string = DEFAULT_TAG): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;
  // A custom tag needs its own subclass: one constructor can't be registered twice.
  const base = getNovaProseEditorClass();
  customElements.define(tagName, tagName === DEFAULT_TAG ? base : class extends base {});
}

declare global {
  interface HTMLElementTagNameMap {
    'novaprose-editor': NovaProseEditorElement;
  }
}
