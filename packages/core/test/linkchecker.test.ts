import { EditorState, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type LinkCheckerOptions } from '../src';

/** Broken links found by your service: a wavy underline, a note in the link's bubble, Ignore. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function mount(content: string, options: LinkCheckerOptions = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['linkchecker'],
    pluginOptions: { linkchecker: { delay: 0, ...options } },
  });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const broken = (e: Editor) =>
  [...e.view.dom.querySelectorAll('.nova-link-broken')].map((el) => el.textContent);

/** A service that calls every address with "gone" in it broken. */
const service = () =>
  vi.fn(async (urls: string[]) =>
    Object.fromEntries(urls.map((url) => [url, url.includes('gone') ? 'invalid' : 'valid'])),
  ) as unknown as NonNullable<LinkCheckerOptions['check']> & ReturnType<typeof vi.fn>;

const LINKS =
  '<p><a href="https://example.com/ok">ok</a> <a href="https://example.com/gone">gone</a> ' +
  '<a href="mailto:ann@example.com">mail</a> <a href="#top">top</a></p>';

describe('linkchecker', () => {
  it('a broken link gets the mark; working ones and other addresses are left alone', async () => {
    const check = service();
    const e = await mount(LINKS, { check });
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone']));
    expect(check).toHaveBeenCalledTimes(1);
    expect(check.mock.calls[0]![0]).toEqual(['https://example.com/ok', 'https://example.com/gone']);
    expect(e.view.dom.querySelector('.nova-link-broken')!.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('an address is asked about once; a new link is checked after a change', async () => {
    const check = service();
    const e = await mount(LINKS, { check });
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone']));
    const end = e.view.state.doc.content.size - 1;
    const link = e.schema.marks.link!.create({ href: 'https://example.com/gone-too' });
    e.view.dispatch(e.view.state.tr.insertText(' new', end).addMark(end + 1, end + 4, link));
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone', 'new']));
    expect(check).toHaveBeenCalledTimes(2);
    expect(check.mock.calls[1]![0]).toEqual(['https://example.com/gone-too']);
  });

  it('a known broken address that comes back (undo, a second copy) is marked without asking', async () => {
    const check = service();
    const e = await mount(LINKS, { check });
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone']));
    const end = e.view.state.doc.content.size - 1;
    const link = e.schema.marks.link!.create({ href: 'https://example.com/gone' });
    e.view.dispatch(e.view.state.tr.insertText(' again', end).addMark(end + 1, end + 6, link));
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone', 'again']));
    // Deleted and brought back by undo.
    const text = e.view.state.doc.textContent;
    const from = text.indexOf('gone') + 1;
    e.view.dispatch(e.view.state.tr.delete(from, from + 4));
    expect(broken(e)).toEqual(['again']);
    e.exec('undo');
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone', 'again']));
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("the link's bubble says it seems broken; Ignore takes the mark away", async () => {
    const e = await mount(LINKS, { check: service() });
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone']));
    e.focus();
    const pos = e.view.state.doc.textContent.indexOf('gone') + 2;
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
    const note = document.querySelector<HTMLElement>('.nova-bubble-note')!;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toContain('This link seems broken');
    note.querySelector<HTMLButtonElement>('.nova-bubble-note-action')!.click();
    expect(broken(e)).toEqual([]);
    expect(note.hidden).toBe(true);
  });

  it('preprocess changes the address asked about, not the link', async () => {
    const check = service();
    const e = await mount('<p><a href="https://example.com/gone?token=secret">x</a></p>', {
      check,
      preprocess: (url) => url.replace(/\?.*$/, ''),
    });
    await vi.waitFor(() => expect(broken(e)).toEqual(['x']));
    expect(check.mock.calls[0]![0]).toEqual(['https://example.com/gone']);
    expect(e.getHTML()).toContain('token=secret');
  });

  it('two links that preprocess makes one address: asked about once, both marked', async () => {
    const check = service();
    const e = await mount(
      '<p><a href="https://example.com/gone?token=1">one</a> ' +
        '<a href="https://example.com/gone?token=2">two</a></p>',
      { check, preprocess: (url) => url.replace(/\?.*$/, '') },
    );
    await vi.waitFor(() => expect(broken(e)).toEqual(['one', 'two']));
    expect(check).toHaveBeenCalledTimes(1);
    expect(check.mock.calls[0]![0]).toEqual(['https://example.com/gone']);
  });

  it('checking goes on after the views are made again; destroy stops it for good', async () => {
    const check = service();
    const e = await mount(LINKS, { check });
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone']));
    // A host application making the state again: ProseMirror makes new plugin views.
    const { state } = e.view;
    e.view.updateState(EditorState.create({ doc: state.doc, plugins: state.plugins }));
    const end = e.view.state.doc.content.size - 1;
    const link = e.schema.marks.link!.create({ href: 'https://example.com/gone-later' });
    e.view.dispatch(e.view.state.tr.insertText(' later', end).addMark(end + 1, end + 6, link));
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone', 'later']));
    const calls = check.mock.calls.length;
    e.destroy();
    editors.splice(editors.indexOf(e), 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(check).toHaveBeenCalledTimes(calls);
  });

  it('serviceUrl: POST { urls }, the results; answers that make no sense mark nothing', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          results: {
            'https://example.com/ok': 42,
            'https://example.com/gone': 'invalid',
          },
        }),
      ),
    );
    const e = await mount(LINKS, { serviceUrl: '/api/links' });
    await vi.waitFor(() => expect(broken(e)).toEqual(['gone']));
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('/api/links');
    expect(init!.method).toBe('POST');
    expect(JSON.parse(String(init!.body))).toEqual({
      urls: ['https://example.com/ok', 'https://example.com/gone'],
    });
  });

  it('the service failing: one notice, nothing marked; turned off: no requests', async () => {
    const check = vi.fn(async () => {
      throw new Error('down');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = await mount(LINKS, { check, delay: 30 });
    const notify = vi.spyOn(e.ui, 'notify');
    await vi.waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    // A second failure (another change) doesn't repeat the notice.
    e.view.dispatch(e.view.state.tr.insertText('!', 1));
    await vi.waitFor(() => expect(check).toHaveBeenCalledTimes(2));
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({
      text: 'The link check service is not available.',
      type: 'warning',
    });
    expect(broken(e)).toEqual([]);
    const off = vi.fn(async () => ({}));
    await mount(LINKS, { check: off, active: false });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(off).not.toHaveBeenCalled();
  });
});
