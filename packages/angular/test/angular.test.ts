import '@angular/compiler';
import { Component, provideZonelessChangeDetection, ViewChild, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NovaProseEditorComponent } from '../src/public-api';

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
    teardown: { destroyAfterEach: true },
  });
});
afterEach(() => TestBed.resetTestingModule());

async function render<T>(component: Type<T>) {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(component);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}

@Component({
  imports: [NovaProseEditorComponent, ReactiveFormsModule],
  template: `<novaprose-editor
    [formControl]="control"
    [init]="{ menubar: true, statusbar: false }"
  />`,
})
class ReactiveHost {
  control = new FormControl('<p>a</p>');
  @ViewChild(NovaProseEditorComponent) cmp!: NovaProseEditorComponent;
}

@Component({
  imports: [NovaProseEditorComponent, FormsModule],
  template: `<novaprose-editor [(ngModel)]="html" placeholder="Пишите…" />`,
})
class NgModelHost {
  html = '<p>начало</p>';
  @ViewChild(NovaProseEditorComponent) cmp!: NovaProseEditorComponent;
}

@Component({
  imports: [NovaProseEditorComponent],
  template: `<novaprose-editor
    initialValue="<p>x</p>"
    [readonly]="readonly"
    (ready)="readyCount = readyCount + 1"
    (editorChange)="last = $event"
  />`,
})
class PlainHost {
  readonly = false;
  readyCount = 0;
  last = '';
  @ViewChild(NovaProseEditorComponent) cmp!: NovaProseEditorComponent;
}

@Component({
  imports: [NovaProseEditorComponent, ReactiveFormsModule],
  template: `<novaprose-editor [formControl]="control" /><output>{{ control.value }}</output>`,
})
class ZonelessViewHost {
  control = new FormControl('<p>a</p>');
  @ViewChild(NovaProseEditorComponent) cmp!: NovaProseEditorComponent;
}

describe('NovaProseEditorComponent', () => {
  it('zoneless: каждое изменение в редакторе перерисовывает шаблон', async () => {
    // Регрессия: без markForCheck экран обновлялся только после первого изменения.
    const fixture = await render(ZonelessViewHost);
    const output = () => fixture.nativeElement.querySelector('output').textContent;
    const editor = fixture.componentInstance.cmp.editor!;
    for (const html of ['<p>b</p>', '<p>c</p>', '<p>d</p>']) {
      editor.setContent(html);
      await fixture.whenStable();
      expect(output()).toBe(html);
    }
  });

  it('Reactive Forms: значение контрола попадает в редактор, ввод — в контрол', async () => {
    const fixture = await render(ReactiveHost);
    const { control, cmp } = fixture.componentInstance;
    const editor = cmp.editor!;
    expect(editor.getHTML()).toBe('<p>a</p>');
    expect(fixture.nativeElement.querySelector('.nova-menubar')).not.toBeNull();

    editor.setContent('<p>b</p>');
    expect(control.value).toBe('<p>b</p>');
    expect(control.dirty).toBe(true);
  });

  it('Reactive Forms: setValue/reset без эха, без истории и без dirty', async () => {
    const fixture = await render(ReactiveHost);
    const { control, cmp } = fixture.componentInstance;
    control.setValue('<p>снаружи</p>');
    expect(cmp.editor!.getHTML()).toBe('<p>снаружи</p>');
    expect(cmp.editor!.can('undo')).toBe(false);
    control.reset();
    expect(cmp.editor!.getHTML()).toBe('<p></p>');
    expect(control.dirty).toBe(false);
  });

  it('Reactive Forms: disable()/enable() переключают редактирование, blur помечает touched', async () => {
    const fixture = await render(ReactiveHost);
    const { control, cmp } = fixture.componentInstance;
    control.disable();
    expect(cmp.editor!.isEditable()).toBe(false);
    control.enable();
    expect(cmp.editor!.isEditable()).toBe(true);
    cmp.editor!.view.dom.dispatchEvent(new FocusEvent('focus'));
    cmp.editor!.view.dom.dispatchEvent(new FocusEvent('blur'));
    expect(control.touched).toBe(true);
  });

  it('ngModel: двусторонняя привязка', async () => {
    const fixture = await render(NgModelHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    expect(host.cmp.editor!.getHTML()).toBe('<p>начало</p>');
    expect(fixture.nativeElement.innerHTML).toContain('Пишите…');

    host.cmp.editor!.setContent('<p>из редактора</p>');
    expect(host.html).toBe('<p>из редактора</p>');

    host.html = '<p>из модели</p>';
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    expect(host.cmp.editor!.getHTML()).toBe('<p>из модели</p>');
  });

  it('без форм: initialValue, ready, editorChange, readonly', async () => {
    const fixture = await render(PlainHost);
    const host = fixture.componentInstance;
    expect(host.cmp.editor!.getHTML()).toBe('<p>x</p>');
    expect(host.readyCount).toBe(1);
    host.cmp.editor!.setContent('<p>y</p>');
    expect(host.last).toBe('<p>y</p>');

    host.readonly = true;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    expect(host.cmp.editor!.isEditable()).toBe(false);
  });

  it('уничтожает редактор вместе с компонентом', async () => {
    const fixture = await render(PlainHost);
    const editor = fixture.componentInstance.cmp.editor!;
    let destroyed = false;
    editor.on('destroy', () => (destroyed = true));
    fixture.destroy();
    expect(destroyed).toBe(true);
  });
});
