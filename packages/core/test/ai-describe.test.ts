import { NodeSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { openImageAltDialog } from '../src/image';
import { cleanAltText, imageForModel, type AiRequest } from '../src/plugins/ai';

/** AI for images: alternative text written by your model, put in the field for the author to review. */

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function mount(request?: (r: AiRequest) => Promise<string> | AsyncIterable<string>) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({
    element,
    content: `<p>Our team at the summit.</p><p><img src="${PNG}"></p><p>We reached it at noon.</p>`,
    plugins: ['suggestions', 'ai'],
    pluginOptions: request ? { ai: { request } } : {},
  });
  editors.push(editor);
  await editor.ready;
  let pos = -1;
  editor.view.state.doc.descendants((node, at) => {
    if (node.type.name === 'image') pos = at;
  });
  editor.view.dispatch(
    editor.view.state.tr.setSelection(NodeSelection.create(editor.view.state.doc, pos)),
  );
  return editor;
}

const flush = () => new Promise((done) => setTimeout(done, 0));

describe('describing an image', () => {
  it('the button asks your model with the image and the text around it, and fills the field', async () => {
    const request = vi.fn(async (_request: AiRequest) => '  "Three climbers on a snowy summit."  ');
    const editor = await mount(request);
    openImageAltDialog(editor);
    const dialog = document.querySelector<HTMLFormElement>('form[role="dialog"]')!;
    const button = dialog.querySelector<HTMLButtonElement>('.nova-alt-suggest')!;
    expect(button.textContent).toBe('Describe with AI');
    button.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector<HTMLInputElement>('input')!.value).toBe(
        'Three climbers on a snowy summit.',
      ),
    );
    const sent = request.mock.calls[0]![0];
    expect(sent.action).toBe('describe');
    expect(sent.image).toEqual({ mimeType: 'image/png', data: PNG.split(',')[1] });
    expect(sent.before).toContain('Our team at the summit.');
    expect(sent.after).toContain('We reached it at noon.');
    expect(sent.prompt).toContain('alternative text');
    expect(sent.rules.join(' ')).toContain('at most 150 characters');
    // The author decides: nothing is saved until Save.
    expect(editor.getHTML()).toContain(`<img src="${PNG}">`);
  });

  it('an empty answer says so in the dialog; without a model there is no button', async () => {
    const editor = await mount(async () => '');
    openImageAltDialog(editor);
    const dialog = document.querySelector<HTMLFormElement>('form[role="dialog"]')!;
    dialog.querySelector<HTMLButtonElement>('.nova-alt-suggest')!.click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('.nova-dialog-error')!.textContent).toMatch(/could not describe/),
    );
    editor.destroy();
    document.body.innerHTML = '';
    const plain = await mount();
    openImageAltDialog(plain);
    await flush();
    expect(document.querySelector('.nova-alt-suggest')).toBeNull();
  });
});

describe('imageForModel and cleanAltText', () => {
  it('an embedded image goes as data; an address the page can’t read goes as the address', async () => {
    expect(await imageForModel('data:image/jpeg;base64,AAAA')).toEqual({
      mimeType: 'image/jpeg',
      data: 'AAAA',
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('CORS'));
    expect(await imageForModel('https://example.com/a.png')).toEqual({
      src: 'https://example.com/a.png',
    });
    expect(await imageForModel('javascript:alert(1)')).toEqual({});
  });

  it('one line, no quotes around it, cut at a word near 250 characters', () => {
    expect(cleanAltText('«A cat\non a sofa»')).toBe('A cat on a sofa');
    const long = cleanAltText(`${'word '.repeat(80)}end`);
    expect(long.length).toBeLessThanOrEqual(251);
    expect(long.endsWith('…')).toBe(true);
  });
});
