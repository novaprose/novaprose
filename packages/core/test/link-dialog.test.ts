import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { openLinkDialog } from '../src/link';

/** The link dialog's address field: required for screen readers, checked by the dialog itself. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function open(): { editor: Editor; form: HTMLFormElement; url: HTMLInputElement } {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content: '<p>text</p>' });
  editors.push(editor);
  openLinkDialog(editor);
  const form = document.querySelector<HTMLFormElement>('form[role="dialog"]')!;
  const url = form.querySelector<HTMLInputElement>('input[type="url"]')!;
  return { editor, form, url };
}

const flush = () => new Promise((done) => setTimeout(done, 0));

describe('the link dialog', () => {
  it('the address is aria-required, not a native required field (VoiceOver said "invalid data" on open)', () => {
    const { url } = open();
    expect(url.getAttribute('aria-required')).toBe('true');
    expect(url.hasAttribute('required')).toBe(false);
    expect(url.hasAttribute('aria-invalid')).toBe(false);
  });

  it('an empty address says it is required; an unsafe one says it is not allowed', async () => {
    const { form, url } = open();
    const error = form.querySelector<HTMLElement>('.nova-dialog-error')!;
    form.requestSubmit();
    await flush();
    expect(error.textContent).toBe('This field is required');
    expect(url.getAttribute('aria-invalid')).toBe('true');
    url.value = 'javascript:alert(1)';
    form.requestSubmit();
    await flush();
    expect(error.textContent).toBe('This URL is not allowed');
  });
});
