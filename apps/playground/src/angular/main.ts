// JIT compilation in the browser: the playground needs no Angular CLI. The npm library is built AOT (ng-packagr).
import '@angular/compiler';
import '@novaprose/core/style.css';
import '../playground.css';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';
import { NovaProseEditorComponent } from '@novaprose/angular';

/**
 * The Angular playground: Reactive Forms (validation, reset, disable) and ngModel.
 * e2e/angular.spec.ts drives it.
 */
const INITIAL = '<p>Hello from <strong>Angular</strong>!</p>';

@Component({
  selector: 'app-root',
  imports: [NovaProseEditorComponent, ReactiveFormsModule, FormsModule],
  template: `
    <main class="pg-react">
      <h1>NovaProse <span class="pg-badge">Angular</span></h1>

      <section class="pg-react-block" aria-labelledby="form-title">
        <h2 id="form-title">Reactive Forms</h2>
        <form data-testid="form" [formGroup]="form" (ngSubmit)="submit()">
          <novaprose-editor
            formControlName="body"
            [init]="{ toolbar: 'undo redo | bold italic | bullist numlist', statusbar: false }"
          />
          <div class="pg-react-actions">
            <button type="submit" [disabled]="form.invalid">Submit</button>
            <button type="button" (click)="form.reset({ body: initial })">Reset</button>
            <button type="button" (click)="toggle()">
              {{ form.disabled ? 'Enable' : 'Disable' }}
            </button>
          </div>
        </form>
        <p>
          dirty: <output data-testid="dirty">{{ form.dirty }}</output> · touched:
          <output data-testid="touched">{{ form.touched }}</output> · valid:
          <output data-testid="valid">{{ form.valid }}</output>
        </p>
        <pre data-testid="value">{{ form.value.body }}</pre>
        @if (submitted !== null) {
          <pre data-testid="submitted">{{ submitted }}</pre>
        }
      </section>

      <section class="pg-react-block" aria-labelledby="ngmodel-title">
        <h2 id="ngmodel-title">ngModel</h2>
        <novaprose-editor data-testid="ngmodel" [(ngModel)]="html" [toolbar]="false" />
        <pre data-testid="ngmodel-value">{{ html }}</pre>
      </section>
    </main>
  `,
})
class App {
  readonly initial = INITIAL;
  readonly form = new FormGroup({
    // An empty editor gives <p></p>: that counts as an empty field.
    body: new FormControl(INITIAL, [
      Validators.required,
      Validators.pattern(/^(?!<p><\/p>$)[\s\S]*$/),
    ]),
  });
  html = '<p>Two-way binding through ngModel.</p>';
  submitted: string | null = null;

  submit(): void {
    this.submitted = this.form.value.body ?? '';
  }

  toggle(): void {
    if (this.form.disabled) this.form.enable();
    else this.form.disable();
  }
}

bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] }).catch((error) =>
  console.error(error),
);
