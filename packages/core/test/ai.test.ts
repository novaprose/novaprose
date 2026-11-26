import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { INSTRUCTIONS, type AiRequest } from '../src/plugins/ai';
import { listSuggestions, suggestionsResult } from '../src/plugins/suggestions';

/** Помощник ИИ: окно, быстрые действия, свой запрос, поток ответа, отмена, правки предложениями. */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function mount(
  content: string,
  request?: (r: AiRequest) => Promise<string> | AsyncIterable<string>,
): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({
    element,
    content,
    plugins: ['suggestions', 'ai'],
    pluginOptions: request ? { ai: { request } } : {},
  });
  await editor.ready;
  return editor;
}

function selectAll(e: Editor): void {
  const { doc } = e.view.state;
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
}

function openDialog(e: Editor): HTMLElement {
  const button = e.ui.registry.get('aidialog');
  if (button?.type !== 'button') throw new Error('нет кнопки aidialog');
  button.onAction(e);
  return e.root.querySelector<HTMLElement>('.nova-dialog')!;
}

const action = (dialog: HTMLElement, label: string) =>
  [...dialog.querySelectorAll<HTMLButtonElement>('.nova-ai-action')].find(
    (b) => b.textContent === label,
  )!;

const accepted = (e: Editor) => {
  const doc = suggestionsResult(e, 'accept');
  return doc.textBetween(0, doc.content.size, '\n\n');
};

describe('помощник ИИ', () => {
  it('без подключённой модели — сообщение в окне, текст не меняется', async () => {
    const e = await mount('<p>Some text</p>');
    selectAll(e);
    const dialog = openDialog(e);
    action(dialog, 'Improve writing').click();
    await vi.waitFor(() =>
      expect(dialog.querySelector('.nova-dialog-error')!.textContent).toBe(
        'AI is not connected to this editor.',
      ),
    );
    expect(e.getHTML()).toBe('<p>Some text</p>');
  });

  it('быстрое действие: запрос с выделенным текстом, правки — предложениями от «AI»', async () => {
    const request = vi.fn(async (r: AiRequest) => {
      expect(r).toMatchObject({
        action: 'shorter',
        instruction: INSTRUCTIONS.shorter,
        text: 'The quick brown fox jumps',
        before: '',
        after: '',
        language: 'en',
      });
      return 'The quick fox jumps';
    });
    const e = await mount('<p>The quick brown fox jumps</p>', request);
    selectAll(e);
    const dialog = openDialog(e);
    action(dialog, 'Make shorter').click();
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).toBeNull());
    expect(request).toHaveBeenCalledOnce();
    expect(listSuggestions(e.view.state.doc).map((c) => [c.kind, c.text, c.author.name])).toEqual([
      ['delete', 'brown ', 'AI'],
    ]);
    expect(accepted(e)).toBe('The quick fox jumps');
    expect(e.root.querySelector('.nova-notification')?.textContent).toContain(
      'AI suggested changes',
    );
  });

  it('свой запрос и ответ потоком: текст виден по мере написания', async () => {
    let seen = '';
    const e = await mount('<p>Hello world</p>', async function* (r) {
      expect(r).toMatchObject({ action: 'custom', instruction: 'Translate into German' });
      yield 'Hallo';
      seen = document.querySelector('.nova-ai-preview')?.textContent ?? '';
      yield ' Welt';
    });
    selectAll(e);
    const dialog = openDialog(e);
    const input = dialog.querySelector<HTMLInputElement>('input')!;
    input.value = 'Translate into German';
    const form = dialog.querySelector<HTMLFormElement>('form') ?? (dialog as HTMLFormElement);
    form.requestSubmit();
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).toBeNull());
    expect(seen).toBe('Hallo');
    expect(accepted(e)).toBe('Hallo Welt');
  });

  it('без выделения — только «Продолжить»: текст у курсора предложением', async () => {
    const e = await mount('<p>Start.</p>', async () => 'Next sentence.');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    const dialog = openDialog(e);
    expect(action(dialog, 'Improve writing').disabled).toBe(true);
    expect(action(dialog, 'Summarize').disabled).toBe(true);
    action(dialog, 'Continue writing').click();
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).toBeNull());
    expect(accepted(e)).toBe('Start. Next sentence.');
    expect(listSuggestions(e.view.state.doc).every((c) => c.kind === 'insert')).toBe(true);
  });

  it('пересказ — новым абзацем после выделенного', async () => {
    const e = await mount('<p>Long text here.</p><p>Tail.</p>', async () => 'Short.');
    const { doc } = e.view.state;
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(doc, 1, 16)));
    const dialog = openDialog(e);
    action(dialog, 'Summarize').click();
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).toBeNull());
    expect(accepted(e)).toBe('Long text here.\n\nShort.\n\nTail.');
  });

  it('закрыть окно — отмена запроса, текст не меняется', async () => {
    let signal: AbortSignal | undefined;
    let finish: (text: string) => void = () => {};
    const e = await mount(
      '<p>Keep me</p>',
      (r) =>
        new Promise<string>((resolve) => {
          signal = r.signal;
          finish = resolve;
        }),
    );
    selectAll(e);
    const dialog = openDialog(e);
    action(dialog, 'Improve writing').click();
    await vi.waitFor(() => expect(signal).toBeDefined());
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).toBeNull());
    expect(signal!.aborted).toBe(true);
    finish('Changed text');
    await new Promise((r) => setTimeout(r, 0));
    expect(e.getHTML()).toBe('<p>Keep me</p>');
  });
});
