import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  Output,
  PLATFORM_ID,
  forwardRef,
  inject,
  type AfterViewInit,
  type OnChanges,
  type OnDestroy,
  type SimpleChanges,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { createEditor, type Editor, type EditorOptions } from '@novaprose/core';

/** Editor options except those set through separate component inputs. */
export type NovaProseInit = Omit<EditorOptions, 'element' | 'content' | 'onChange' | 'editable'>;

/**
 * The NovaProse editor component for Angular: standalone, works with `ngModel` and Reactive Forms
 * (`formControlName`, `[formControl]`), including `disable()`, `reset()` and `touched`.
 *
 * ```html
 * <novaprose-editor formControlName="body" [init]="{ menubar: true }" />
 * ```
 *
 * SSR-safe: creates nothing on the server. Editor events are handled outside the Angular zone; the
 * zone is entered only for form changes and the component's outputs.
 */
@Component({
  selector: 'novaprose-editor',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NovaProseEditorComponent),
      multi: true,
    },
  ],
})
export class NovaProseEditorComponent
  implements ControlValueAccessor, AfterViewInit, OnChanges, OnDestroy
{
  /** Any core options (`toolbar`, `menubar`, `plugins`, `uploadImage`…). Read when the editor is created. */
  @Input() init: NovaProseInit | undefined;
  /** Initial HTML, when the component is used without forms. */
  @Input() initialValue: string | undefined;
  @Input() placeholder: string | undefined;
  @Input() toolbar: EditorOptions['toolbar'] | undefined;
  @Input() plugins: EditorOptions['plugins'] | undefined;
  @Input() language: string | undefined;
  /** Read-only; can change at any time. Forms disable it with `control.disable()`. */
  @Input() readonly = false;

  /** The instance was created. */
  @Output() readonly ready = new EventEmitter<Editor>();
  /** The HTML after every change by the user (without forms). */
  @Output() readonly editorChange = new EventEmitter<string>();
  @Output() readonly editorFocus = new EventEmitter<Editor>();
  @Output() readonly editorBlur = new EventEmitter<Editor>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private instance: Editor | null = null;
  /** A value that came from the form before the editor was created. */
  private pending: string | undefined;
  private disabled = false;
  /** While a value from the form is applied, onChange isn't called — otherwise reset() would mark the field dirty. */
  private syncing = false;
  private onChange: (html: string) => void = () => {};
  private onTouched: () => void = () => {};

  /** The `Editor` instance; `null` before `ngAfterViewInit` and on the server. */
  get editor(): Editor | null {
    return this.instance;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const explicit = Object.fromEntries(
      Object.entries({
        placeholder: this.placeholder,
        toolbar: this.toolbar,
        plugins: this.plugins,
        language: this.language,
      }).filter(([, value]) => value !== undefined),
    );
    // Вне зоны: ProseMirror шлёт много событий (выделение, ввод), и каждое не должно
    // запускать проверку изменений во всём приложении.
    const editor = this.zone.runOutsideAngular(() =>
      createEditor({
        ...this.init,
        ...explicit,
        element: this.host.nativeElement,
        content: this.pending ?? this.initialValue ?? '',
        editable: this.isEditable(),
      }),
    );
    this.instance = editor;
    this.pending = undefined;

    editor.on('change', (e) => {
      if (this.syncing) return;
      const html = e.getHTML();
      this.notify(() => {
        this.onChange(html);
        this.editorChange.emit(html);
      });
    });
    editor.on('focus', (e) => this.notify(() => this.editorFocus.emit(e)));
    editor.on('blur', (e) =>
      this.notify(() => {
        this.onTouched();
        this.editorBlur.emit(e);
      }),
    );
    this.notify(() => this.ready.emit(editor));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['readonly']) this.instance?.setEditable(this.isEditable());
  }

  ngOnDestroy(): void {
    this.instance?.destroy();
    this.instance = null;
  }

  // ---------- ControlValueAccessor ----------

  writeValue(value: string | null | undefined): void {
    const html = value ?? '';
    const editor = this.instance;
    if (!editor) {
      this.pending = html;
      return;
    }
    if (editor.getHTML() === html) return;
    this.syncing = true;
    try {
      editor.setContent(html, { addToHistory: false });
    } finally {
      this.syncing = false;
    }
  }

  registerOnChange(fn: (html: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.instance?.setEditable(this.isEditable());
  }

  /**
   * Tell Angular about a change. With zone.js, zone.run is enough, but in zoneless applications (the
   * default since Angular 21) only markForCheck triggers change detection: editor events don't come
   * through Angular's template handlers.
   */
  private notify(fn: () => void): void {
    this.zone.run(fn);
    this.cdr.markForCheck();
  }

  private isEditable(): boolean {
    return !this.disabled && !this.readonly;
  }
}
