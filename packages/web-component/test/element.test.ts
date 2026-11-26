import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { registerLanguage } from '@novaprose/core';
import { defineNovaProseEditor, type NovaProseEditorElement } from '../src';

beforeAll(() => defineNovaProseEditor());
afterEach(() => {
  document.body.innerHTML = '';
});

function create(html: string): NovaProseEditorElement {
  document.body.innerHTML = html;
  return document.querySelector('novaprose-editor, my-editor') as NovaProseEditorElement;
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('<novaprose-editor>', () => {
  it('the markup inside the tag becomes the initial content', () => {
    const el = create('<novaprose-editor><p>Hello, <strong>world</strong></p></novaprose-editor>');
    expect(el.editor).not.toBeNull();
    expect(el.value).toBe('<p>Hello, <strong>world</strong></p>');
    expect(el.querySelector('.nova-editor')).not.toBeNull();
  });

  it('the value attribute beats the markup; dangerous content is cleaned out', () => {
    const el = create(
      '<novaprose-editor value="<p>from the attribute</p>"><p>from the markup</p></novaprose-editor>',
    );
    expect(el.value).toBe('<p>from the attribute</p>');
    el.value = '<p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p>';
    expect(el.value).not.toContain('javascript:');
    expect(el.value).not.toContain('onerror');
  });

  it('attributes configure the editor, init takes any option', () => {
    const el = document.createElement('novaprose-editor');
    el.init = { statusbar: false };
    el.setAttribute('toolbar', 'bold italic');
    el.setAttribute('menubar', '');
    el.setAttribute('placeholder', 'Write…');
    document.body.append(el);
    expect(el.querySelector('.nova-menubar')).not.toBeNull();
    expect(el.querySelector('.nova-statusbar')).toBeNull();
    expect(el.innerHTML).toContain('Write…');
  });

  it('a value set before connecting is applied on connect', () => {
    const el = document.createElement('novaprose-editor');
    el.value = '<p>in advance</p>';
    expect(el.value).toBe('<p>in advance</p>');
    document.body.append(el);
    expect(el.editor!.getHTML()).toBe('<p>in advance</p>');
  });

  it("typing fires the input event; setting value doesn't, and adds no history", () => {
    const el = create('<novaprose-editor><p>a</p></novaprose-editor>');
    const onInput = vi.fn();
    el.addEventListener('input', onInput);
    el.value = '<p>b</p>';
    expect(onInput).not.toHaveBeenCalled();
    expect(el.editor!.can('undo')).toBe(false);
    el.editor!.setContent('<p>c</p>');
    expect(onInput).toHaveBeenCalledOnce();
  });

  it("writing the same value doesn't touch the document or the selection (two-way binding)", () => {
    const el = create('<novaprose-editor><p>abc</p></novaprose-editor>');
    const editor = el.editor!;
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 3)),
    );
    const before = editor.view.state;
    const same = el.value;
    el.value = same;
    expect(editor.view.state).toBe(before);
  });

  it('readonly and disabled turn editing off on the fly', () => {
    const el = create('<novaprose-editor><p>a</p></novaprose-editor>');
    el.setAttribute('readonly', '');
    expect(el.editor!.isEditable()).toBe(false);
    el.removeAttribute('readonly');
    el.setAttribute('disabled', '');
    expect(el.editor!.isEditable()).toBe(false);
    el.removeAttribute('disabled');
    expect(el.editor!.isEditable()).toBe(true);
  });

  it('a language with a loader: the editor comes after the pack loads, translated right away', async () => {
    let release!: () => void;
    registerLanguage(
      'qw',
      () => new Promise((resolve) => (release = () => resolve({ bold: 'B (qw)' }))),
    );
    const ready = vi.fn();
    document.addEventListener('novaprose-ready', ready);
    const el = create('<novaprose-editor language="qw" toolbar="bold"><p>x</p></novaprose-editor>');
    // While the language loads the original markup shows; there is no editor yet.
    expect(el.editor).toBeNull();
    expect(el.innerHTML).toBe('<p>x</p>');
    release();
    await vi.waitFor(() => expect(el.editor).not.toBeNull());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-control="bold"]')?.getAttribute('aria-label')).toBe('B (qw)');
    expect(el.value).toBe('<p>x</p>');
    document.removeEventListener('novaprose-ready', ready);
  });

  it('the language failed to load: the editor is still created, in English', async () => {
    registerLanguage('qx', async () => {
      throw new Error('offline');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = create('<novaprose-editor language="qx" toolbar="bold"></novaprose-editor>');
    await vi.waitFor(() => expect(el.editor).not.toBeNull());
    expect(el.querySelector('[data-control="bold"]')?.getAttribute('aria-label')).toMatch(/^Bold/);
    warn.mockRestore();
  });

  it('the novaprose-ready event carries the instance', () => {
    const onReady = vi.fn();
    document.addEventListener('novaprose-ready', onReady, { once: true });
    const el = create('<novaprose-editor></novaprose-editor>');
    expect(onReady).toHaveBeenCalledOnce();
    expect((onReady.mock.calls[0]![0] as CustomEvent).detail.editor).toBe(el.editor);
  });

  it('moving in the DOM keeps the instance, removing destroys it', async () => {
    const el = create(
      '<div id="a"><novaprose-editor><p>a</p></novaprose-editor></div><div id="b"></div>',
    );
    const editor = el.editor!;
    document.getElementById('b')!.append(el);
    await flush();
    expect(el.editor).toBe(editor);
    el.remove();
    await flush();
    expect(el.editor).toBeNull();
    // The content isn't lost: on reconnect the editor is created again with it.
    document.body.append(el);
    expect(el.value).toBe('<p>a</p>');
  });

  it('a custom tag through defineNovaProseEditor(name)', () => {
    defineNovaProseEditor('my-editor');
    defineNovaProseEditor('my-editor'); // again, without an error
    const el = create('<my-editor><p>custom</p></my-editor>');
    expect(el.editor!.getHTML()).toBe('<p>custom</p>');
  });

  it('focus() puts the focus into the text', () => {
    const el = create('<novaprose-editor><p>a</p></novaprose-editor>');
    el.focus();
    expect(document.activeElement).toBe(el.editor!.view.dom);
  });

  it("a script in <head>: it waits for the document to parse so the markup inside isn't lost", () => {
    // A regression: with document.readyState === 'loading' the element connects before its children.
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    try {
      const el = document.createElement('novaprose-editor');
      document.body.append(el);
      expect(el.editor).toBeNull();
      el.innerHTML = '<p>parsed</p>';
      Object.defineProperty(document, 'readyState', { value: 'interactive', configurable: true });
      document.dispatchEvent(new Event('DOMContentLoaded'));
      expect(el.value).toBe('<p>parsed</p>');
    } finally {
      delete (document as unknown as Record<string, unknown>).readyState;
    }
  });
});
