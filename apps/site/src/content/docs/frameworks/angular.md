---
title: Angular
description: "Angular standalone component for NovaProse with ngModel and Reactive Forms."
---

<!-- Сгенерировано из packages/angular/README.md: правьте README, затем pnpm --filter @novaprose/site sync-docs -->

Angular bindings for the [NovaProse](/getting-started/) rich text
editor: a standalone component that works with `ngModel` and Reactive Forms, in zone.js and
zoneless apps, with SSR. Shipped in the Angular Package Format (AOT, partial compilation).

```bash
npm install @novaprose/angular @novaprose/core
```

Add the styles in `angular.json` → `styles`: `node_modules/@novaprose/core/src/style.css`.

## Reactive Forms

```ts
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NovaProseEditorComponent } from '@novaprose/angular';

@Component({
  selector: 'app-post',
  imports: [NovaProseEditorComponent, ReactiveFormsModule],
  template: `<novaprose-editor [formControl]="body" [init]="{ menubar: true }" />`,
})
export class PostComponent {
  body = new FormControl('<p>Hello</p>', Validators.required);
}
```

| Form action              | Effect in the editor                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| `setValue()` / `reset()` | replaces the content without an undo entry; the control does not become `dirty` |
| user input               | updates the control value and marks it `dirty`                                  |
| blur                     | marks the control `touched`                                                     |
| `disable()` / `enable()` | turns editing off / on                                                          |

With template-driven forms: `<novaprose-editor [(ngModel)]="html" />`.

## Inputs and outputs

| Input / output                                      | What it does                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `[init]`                                            | any core option (`toolbar`, `menubar`, `plugins`, `uploadImage`…) |
| `[toolbar]`, `[plugins]`, `placeholder`, `language` | common options as inputs (take precedence over `init`)            |
| `initialValue`                                      | initial HTML when not using forms                                 |
| `[readonly]`                                        | read-only mode, can change at any time                            |
| `(ready)`, `(editorFocus)`, `(editorBlur)`          | receive the `Editor` instance                                     |
| `(editorChange)`                                    | HTML after every user change                                      |

The editor instance is available as the component's `editor` property
(`@ViewChild(NovaProseEditorComponent)`). Inputs other than `readonly` are read on creation.

Editor events are handled outside the Angular zone, so typing does not trigger app-wide change
detection. In zoneless apps the component calls `markForCheck` itself.

Do not register the default `<novaprose-editor>` tag from `@novaprose/web-component` in the same
app: both use the same selector.
