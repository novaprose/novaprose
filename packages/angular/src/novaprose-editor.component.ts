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

/** Опции редактора без тех, что задаются отдельными входами компонента. */
export type NovaProseInit = Omit<EditorOptions, 'element' | 'content' | 'onChange' | 'editable'>;

/**
 * Angular-компонент редактора NovaProse: standalone, работает с `ngModel` и Reactive Forms
 * (`formControlName`, `[formControl]`), включая `disable()`, `reset()` и `touched`.
 *
 * ```html
 * <novaprose-editor formControlName="body" [init]="{ menubar: true }" />
 * ```
 *
 * SSR-безопасен: на сервере ничего не создаёт. События редактора обрабатываются вне зоны Angular,
 * в зону входим только для изменений формы и выходов компонента.
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
  /** Любые опции ядра (`toolbar`, `menubar`, `plugins`, `uploadImage`…). Читаются при создании. */
  @Input() init: NovaProseInit | undefined;
  /** Начальный HTML, если компонент используется без форм. */
  @Input() initialValue: string | undefined;
  @Input() placeholder: string | undefined;
  @Input() toolbar: EditorOptions['toolbar'] | undefined;
  @Input() plugins: EditorOptions['plugins'] | undefined;
  @Input() language: string | undefined;
  /** Только чтение; меняется на лету. Блокировку через формы даёт `control.disable()`. */
  @Input() readonly = false;

  /** Экземпляр создан. */
  @Output() readonly ready = new EventEmitter<Editor>();
  /** HTML после каждого изменения пользователем (без форм). */
  @Output() readonly editorChange = new EventEmitter<string>();
  @Output() readonly editorFocus = new EventEmitter<Editor>();
  @Output() readonly editorBlur = new EventEmitter<Editor>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private instance: Editor | null = null;
  /** Значение, пришедшее из формы до создания редактора. */
  private pending: string | undefined;
  private disabled = false;
  /** Пока применяем значение из формы, onChange не зовём: иначе reset() пометил бы поле dirty. */
  private syncing = false;
  private onChange: (html: string) => void = () => {};
  private onTouched: () => void = () => {};

  /** Экземпляр `Editor`; `null` до `ngAfterViewInit` и на сервере. */
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
   * Сообщить Angular об изменении. С zone.js хватает zone.run, но в zoneless-приложениях
   * (по умолчанию с Angular 21) проверку изменений запускает только markForCheck: события
   * редактора приходят не через шаблонные обработчики Angular.
   */
  private notify(fn: () => void): void {
    this.zone.run(fn);
    this.cdr.markForCheck();
  }

  private isEditable(): boolean {
    return !this.disabled && !this.readonly;
  }
}
