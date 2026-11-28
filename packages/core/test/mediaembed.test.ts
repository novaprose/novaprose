import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, createRenderer, type Editor, type MediaEmbedOptions } from '../src';
import { exportDocx } from '../src/docx';
import { unzip } from '../src/docx/zip';
import { toMarkdown } from '../src/markdown';

/** Link cards (mediaembed): a page's title, description, picture and site, from your service. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function mount(
  content: string,
  mediaembed: MediaEmbedOptions = {},
  plugins = ['media', 'mediaembed'],
) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, plugins, pluginOptions: { mediaembed } });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const CARD =
  '<a class="nova-card" href="https://example.com/post" rel="noopener noreferrer" style="display: flex; flex-wrap: wrap; gap: 12px; max-width: 650px; margin: 0.5em 0; padding: 12px; border: 1px solid rgb(127 127 127 / 0.35); border-radius: 8px; color: inherit; text-decoration: none; overflow: hidden">' +
  '<img class="nova-card-thumbnail" src="https://example.com/cover.jpg" alt="" loading="lazy" style="flex: none; width: 120px; height: 90px; object-fit: cover; border-radius: 4px">' +
  '<span style="display: block; flex: 1 1 180px; min-width: 0">' +
  '<span class="nova-card-title" style="display: block; font-weight: 600">A post</span>' +
  '<span class="nova-card-description" style="display: block; opacity: 0.75; font-size: 0.875em">What it is about</span>' +
  '<span class="nova-card-website" style="display: block; opacity: 0.75; font-size: 0.875em">Example</span>' +
  '<span class="nova-card-author" style="display: block; opacity: 0.75; font-size: 0.875em">Ann</span>' +
  '</span></a>';

/** Puts the cursor at the end of the first paragraph and presses Enter. */
function enterAtEnd(e: Editor) {
  const end = e.view.state.doc.firstChild!.nodeSize - 1;
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, end)));
  e.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
}

describe('mediaembed: the card', () => {
  it('HTML round trip without changes; the server renders the same', async () => {
    const e = await mount(CARD);
    expect(e.getHTML()).toBe(CARD);
    const renderer = createRenderer({ plugins: ['media', 'mediaembed'] });
    expect(renderer.html(e.getJSON())).toBe(CARD);
  });

  it("another editor's summary card is read; unsafe addresses never get through", async () => {
    const e = await mount(
      '<div class="ephox-summary-card"><a href="https://example.com/a"><img class="ephox-summary-card-thumbnail" src="javascript:alert(1)">' +
        '<span class="ephox-summary-card-title">Title</span><span class="ephox-summary-card-website">site.io</span></a></div>' +
        '<a class="nova-card" href="javascript:alert(1)"><span class="nova-card-title">Bad</span></a>',
    );
    const card = e.view.state.doc.firstChild!;
    expect(card.type.name).toBe('link_card');
    expect(card.attrs).toMatchObject({
      href: 'https://example.com/a',
      title: 'Title',
      site: 'site.io',
      image: '',
    });
    expect(e.getHTML()).not.toContain('javascript:');
    expect(e.getHTML()).toContain('<p>Bad</p>');
  });

  it('from JSON: garbage attributes, an unsafe address: no crash, no link out', async () => {
    const e = await mount('<p></p>');
    for (const href of ['javascript:alert(1)', 42, null, '/relative']) {
      e.setContent({
        type: 'doc',
        content: [{ type: 'link_card', attrs: { href, title: 7, image: 'data:text/html,x' } }],
      });
      expect(e.getHTML()).toMatch(/^<div class="nova-card">[^<]*<\/div>$/);
    }
  });

  it('settings: classes only, your class; Markdown and the editor view', async () => {
    const e = await mount(CARD, { inlineStyles: false, className: 'card' });
    expect(e.getHTML()).toBe(
      '<a class="card" href="https://example.com/post" rel="noopener noreferrer"><img class="card-thumbnail" src="https://example.com/cover.jpg" alt="" loading="lazy">' +
        '<span><span class="card-title">A post</span><span class="card-description">What it is about</span><span class="card-website">Example</span><span class="card-author">Ann</span></span></a>',
    );
    expect(toMarkdown(e.view.state.doc)).toBe('[A post](https://example.com/post)');
    // In the editor: no working link (a click selects the card).
    const view = e.view.dom.querySelector('.nova-card-view')!;
    expect(view.querySelector('a')).toBeNull();
    expect(view.textContent).toContain('A post');
  });

  it('in Word: a link to the page with its title', async () => {
    const e = await mount(CARD);
    const files = await unzip(await exportDocx(e));
    const text = (name: string) => new TextDecoder().decode(files.get(name));
    expect(text('word/document.xml')).toMatch(
      /<w:hyperlink r:id="rId\d+">.*A post.*<\/w:hyperlink>/,
    );
    expect(text('word/_rels/document.xml.rels')).toContain(
      'Target="https://example.com/post" TargetMode="External"',
    );
  });
});

describe('mediaembed: making cards', () => {
  it('a link alone on its line, then Enter: the line becomes the card your service describes', async () => {
    const resolve = vi.fn(async (_url: string) => ({
      title: 'The page',
      description: 'About it',
      image: 'https://example.com/i.png',
      site: 'Example',
      ignored: '<script>alert(1)</script>',
    }));
    const e = await mount('<p>https://example.com/page</p>', { resolve });
    enterAtEnd(e);
    await vi.waitFor(() => expect(e.view.state.doc.firstChild!.type.name).toBe('link_card'));
    expect(resolve.mock.calls[0]![0]).toBe('https://example.com/page');
    expect(e.view.state.doc.firstChild!.attrs).toMatchObject({
      title: 'The page',
      site: 'Example',
    });
    expect(e.view.state.doc.childCount).toBe(2);
    expect(e.getHTML()).not.toContain('<script');
  });

  it('a video link becomes a player without a service; a photo from the service a picture', async () => {
    const e = await mount('<p>https://youtu.be/dQw4w9WgXcQ</p>');
    enterAtEnd(e);
    await vi.waitFor(() => expect(e.view.state.doc.firstChild!.type.name).toBe('media'));

    const photo = await mount('<p>https://example.com/photo-page</p>', {
      resolve: async () => ({ type: 'photo', image: 'https://example.com/p.jpg', title: 'Sunset' }),
    });
    enterAtEnd(photo);
    await vi.waitFor(() =>
      expect(photo.getHTML()).toContain('<img src="https://example.com/p.jpg" alt="Sunset">'),
    );
  });

  it('the card is its own undo step: Ctrl+Z gives the link back and keeps the new line', async () => {
    const e = await mount('<p>https://example.com/page</p>', {
      resolve: async () => ({ title: 'The page' }),
    });
    enterAtEnd(e);
    await vi.waitFor(() => expect(e.view.state.doc.firstChild!.type.name).toBe('link_card'));
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>https://example.com/page</p><p></p>');
    // Undo doesn't count as a new Enter: the card isn't made again.
    await new Promise((r) => setTimeout(r, 20));
    expect(e.getHTML()).toBe('<p>https://example.com/page</p><p></p>');
    e.exec('redo');
    await new Promise((r) => setTimeout(r, 20));
    expect(e.view.state.doc.childCount).toBe(2);
    e.exec('undo');
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>https://example.com/page</p>');
  });

  it('the service knows nothing (null, 204): no card; the dialog says so', async () => {
    const e = await mount('<p>https://example.com/page</p>', { resolve: async () => null });
    enterAtEnd(e);
    await new Promise((r) => setTimeout(r, 10));
    expect(e.getHTML()).toBe('<p>https://example.com/page</p><p></p>');

    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const served = await mount('<p></p>', { serviceUrl: '/embed' });
    const media = served.ui.registry.get('media');
    if (media?.type !== 'button') throw new Error('no media button');
    media.onAction(served);
    const dialog = served.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    dialog.querySelector<HTMLInputElement>('input')!.value = 'https://example.com/missing';
    dialog.requestSubmit();
    await vi.waitFor(() => expect(dialog.textContent).toContain('Couldn’t get a preview'));
    expect(fetch.mock.calls[0]![0]).toBe('/embed');
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({
      url: 'https://example.com/missing',
    });
    expect(served.getHTML()).toBe('<p></p>');
  });

  it('without a service the Video dialog stays a video dialog', async () => {
    const e = await mount('<p></p>');
    const media = e.ui.registry.get('media');
    if (media?.type !== 'button') throw new Error('no media button');
    media.onAction(e);
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    expect(dialog.textContent).not.toContain('any page');
    dialog.querySelector<HTMLInputElement>('input')!.value = 'https://example.com/docs';
    dialog.requestSubmit();
    await vi.waitFor(() => expect(dialog.textContent).toContain('not supported'));
  });

  it('text with the link, or no service and no video: Enter is only Enter', async () => {
    const resolve = vi.fn(async () => ({ title: 'x' }));
    const e = await mount('<p>see https://example.com/page</p>', { resolve });
    enterAtEnd(e);
    await new Promise((r) => setTimeout(r, 0));
    expect(resolve).not.toHaveBeenCalled();
    const plain = await mount('<p>https://example.com/page</p>');
    enterAtEnd(plain);
    await new Promise((r) => setTimeout(r, 0));
    expect(plain.view.state.doc.firstChild!.type.name).toBe('paragraph');
  });

  it('the Video dialog takes any page; the card toolbar opens, turns into a link and removes', async () => {
    const e = await mount('<p></p>', {
      resolve: async () => ({ title: 'Docs', site: 'Example' }),
    });
    await e.ready;
    const media = e.ui.registry.get('media');
    if (media?.type !== 'button') throw new Error('no media button');
    media.onAction(e);
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    expect(dialog.textContent).toContain('any page');
    dialog.querySelector<HTMLInputElement>('input')!.value = 'https://example.com/docs';
    dialog.requestSubmit();
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).toBeNull());
    let pos = -1;
    e.view.state.doc.forEach((node, offset) => {
      if (node.type.name === 'link_card') pos = offset;
    });
    expect(pos).toBeGreaterThanOrEqual(0);
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, pos)));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const run = (name: string) => {
      const button = e.ui.registry.get(name);
      if (button?.type !== 'button') throw new Error(`no button ${name}`);
      button.onAction(e);
    };
    run('linkcardopen');
    expect(open).toHaveBeenCalledWith('https://example.com/docs', '_blank', 'noopener,noreferrer');
    run('linkcardunwrap');
    expect(e.getHTML()).toContain(
      '<p><a href="https://example.com/docs">https://example.com/docs</a></p>',
    );
  });
});
