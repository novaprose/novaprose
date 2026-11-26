// @vitest-environment node
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { describe, expect, it } from 'vitest';
import { NovaProseEditorComponent } from '../src/public-api';

@Component({
  selector: 'app-root',
  imports: [NovaProseEditorComponent],
  template: `<novaprose-editor initialValue="<p>a</p>" />`,
})
class App {}

// Angular Universal / SSR: on the server no editor is created, and rendering doesn't crash.
describe('SSR', () => {
  it('renderApplication renders an empty host without errors', async () => {
    const html = await renderApplication(
      (context: BootstrapContext) =>
        bootstrapApplication(
          App,
          { providers: [provideServerRendering(), provideZonelessChangeDetection()] },
          context,
        ),
      { document: '<html><body><app-root></app-root></body></html>', url: '/' },
    );
    expect(html).toContain('<novaprose-editor');
    expect(html).not.toContain('nova-editor');
  });
});
