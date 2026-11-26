import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEditor } from '../src';

/**
 * Office paste cleanup is a lazy chunk (not part of the core's first load).
 * A separate file means a fresh module: the chunk isn't loaded here yet. This checks that Ctrl+V in the first
 * milliseconds after the editor is created loses neither the paste nor the cleanup.
 */
const FIXTURES = join(__dirname, 'fixtures', 'paste');
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

function pasteEvent(target: HTMLElement, data: Record<string, string>): ClipboardEvent {
  const clipboardData = {
    getData: (type: string) => data[type] ?? '',
    types: Object.keys(data),
    files: [] as File[],
    items: [],
  };
  const event = new ClipboardEvent('paste', {
    clipboardData: clipboardData as unknown as DataTransfer,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe('pasting before the Office cleanup loads', () => {
  it('Ctrl+V right after creation: the paste waits for the chunk and comes out clean', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({ element, content: '' });

    const event = pasteEvent(editor.view.dom, {
      'text/html': read('word-desktop-lists.html'),
      'text/plain': 'x',
    });
    // We intercepted the browser paste while the chunk was loading.
    expect(event.defaultPrevented).toBe(true);

    await editor.ready;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editor.getHTML()).toBe(read('word-desktop-lists.expected.html').trim());
    editor.destroy();
  });

  it('after loading, a paste takes the regular path, without interception', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({ element, content: '' });
    await editor.ready;
    const event = pasteEvent(editor.view.dom, { 'text/html': '<p>a</p>', 'text/plain': 'a' });
    // ProseMirror itself handled it (its handler calls preventDefault too): the result is immediate.
    expect(editor.getHTML()).toBe('<p>a</p>');
    expect(event.defaultPrevented).toBe(true);
    editor.destroy();
  });
});
