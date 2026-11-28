// @vitest-environment jsdom
import { NodeSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditor,
  createRenderer,
  listSuggestions,
  resolveSuggestions,
  type Editor,
  type EditorOptions,
  type PageEmbedOptions,
} from '../src';
import { toEmailHTML } from '../src/email';
import { toMarkdown } from '../src/markdown';

/** Embedded pages (pageembed): a web page in a sandboxed frame, at full width or a fixed size. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(content: string, pageembed?: PageEmbedOptions, extra: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['pageembed'],
    ...(pageembed ? { pluginOptions: { pageembed } } : {}),
    ...extra,
  });
  editors.push(editor);
  return editor;
}

const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation';
const FRAME = (rest: string) =>
  `sandbox="${SANDBOX}" allow="fullscreen" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"${rest}`;

const RESPONSIVE =
  '<div class="nova-pageembed nova-pageembed--16by9" style="position: relative; width: 100%; padding-top: 56.25%; overflow: hidden">' +
  `<iframe src="https://maps.example.com/embed?q=1" title="Office map" ${FRAME(' frameborder="0" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0"')}></iframe></div>`;
const FIXED =
  '<div class="nova-pageembed">' +
  `<iframe src="https://forms.example.com/f/42" title="Sign-up form" ${FRAME(' frameborder="1" scrolling="no" width="480" height="600"')}></iframe></div>`;

describe('pageembed: the HTML', () => {
  it('round trip without changes: at full width with a ratio, and a fixed size', () => {
    const editor = mount(RESPONSIVE + FIXED);
    expect(editor.getHTML()).toBe(RESPONSIVE + FIXED);
    const [first, second] = [0, 1].map((i) => editor.view.state.doc.child(i).attrs);
    expect(first).toMatchObject({ size: 'nova-pageembed--16by9', title: 'Office map' });
    expect(second).toMatchObject({
      size: '',
      width: 480,
      height: 600,
      border: true,
      scrolling: false,
    });
  });

  it("another editor's sizes keep their ratio; an empty title becomes the site's name", () => {
    const editor = mount(
      '<div class="tiny-pageembed tiny-pageembed--4by3"><iframe src="https://example.com/page"></iframe></div>',
    );
    const html = editor.getHTML();
    expect(html).toContain('class="nova-pageembed nova-pageembed--4by3"');
    expect(html).toContain('padding-top: 75%');
    expect(html).toContain('title="example.com"');
  });

  it('a frame on its own, or an address that may not be shown, is not embedded', () => {
    const editor = mount(
      '<iframe src="https://ads.example.com/banner"></iframe>' +
        '<div class="nova-pageembed"><iframe src="javascript:alert(1)"></iframe></div>' +
        '<div class="nova-pageembed"><iframe src="data:text/html,<script>alert(1)</script>"></iframe></div>' +
        '<div class="nova-pageembed"><iframe src="/relative/page"></iframe></div>' +
        '<div class="nova-pageembed"><iframe src="//evil.example.com/"></iframe></div>' +
        '<div class="nova-pageembed"><iframe src="https://user:secret@example.com/"></iframe></div>' +
        '<div class="nova-pageembed"><iframe srcdoc="<script>alert(1)</script>"></iframe></div>' +
        '<p>ok</p>',
    );
    expect(editor.getHTML()).toBe('<p>ok</p>');
    expect(editor.view.dom.querySelector('iframe')).toBeNull();
  });

  it('a document from JSON with a bad address: no frame, in the HTML or in the editor', () => {
    const editor = mount('<p></p>');
    for (const src of ['javascript:alert(1)', 'data:text/html,x', 42, null, '"><script>']) {
      editor.setContent({ type: 'doc', content: [{ type: 'pageembed', attrs: { src } }] });
      expect(editor.getHTML()).toBe('<div class="nova-pageembed"></div>');
      expect(editor.view.dom.querySelector('iframe')).toBeNull();
    }
  });

  it('settings: classes only, the wrapper class, a sandbox of your own or none', () => {
    const plain = mount(RESPONSIVE, { inlineStyles: false, className: 'embed' });
    expect(plain.getHTML()).toBe(
      '<div class="embed nova-pageembed--16by9">' +
        `<iframe src="https://maps.example.com/embed?q=1" title="Office map" ${FRAME(' frameborder="0"')}></iframe></div>`,
    );
    const strict = mount(RESPONSIVE, { sandbox: 'allow-scripts onload="x" allow-forms' });
    expect(strict.getHTML()).toContain('sandbox="allow-scripts allow-forms"');
    const none = mount(RESPONSIVE, { sandbox: false });
    expect(none.getHTML()).not.toContain('sandbox');
  });

  it('allowUrl: only the sites you allow, when parsing and on output', () => {
    const allowUrl = (url: string) => new URL(url).hostname.endsWith('.example.com');
    const editor = mount(
      RESPONSIVE + '<div class="nova-pageembed"><iframe src="https://other.org/"></iframe></div>',
      {
        allowUrl,
      },
    );
    expect(editor.getHTML()).toBe(RESPONSIVE);
    editor.setContent({
      type: 'doc',
      content: [{ type: 'pageembed', attrs: { src: 'https://other.org/' } }],
    });
    expect(editor.getHTML()).toBe('<div class="nova-pageembed"></div>');
  });

  it('only fixed sizes when the list of sizes is empty', () => {
    const editor = mount(RESPONSIVE, { sizes: [] });
    expect(editor.getHTML()).toContain('width="350" height="260"');
    expect(editor.getHTML()).not.toContain('padding-top');
  });

  it('on the server, the same HTML as in the editor', () => {
    const editor = mount(RESPONSIVE + FIXED);
    const renderer = createRenderer({ plugins: ['pageembed'] });
    expect(renderer.html(editor.getJSON())).toBe(editor.getHTML());
  });

  it('Markdown and email: a link to the page', () => {
    const editor = mount(RESPONSIVE);
    expect(toMarkdown(editor.view.state.doc)).toBe(
      '[Office map](https://maps.example.com/embed?q=1)',
    );
    const email = toEmailHTML(editor.getHTML(), { baseStyles: false });
    expect(email).toContain('<a href="https://maps.example.com/embed?q=1"');
    expect(email).not.toContain('padding-top');
    expect(email).not.toContain('<iframe');
  });
});

describe('pageembed: in the editor', () => {
  it('the frame is sandboxed, under a layer, out of the Tab order; a new title keeps the page loaded', () => {
    const editor = mount(RESPONSIVE);
    const frame = editor.view.dom.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).toBe(SANDBOX);
    expect(frame.getAttribute('tabindex')).toBe('-1');
    expect(frame.nextElementSibling?.classList.contains('nova-media-overlay')).toBe(true);
    const { state } = editor.view;
    editor.view.dispatch(
      state.tr.setNodeMarkup(0, undefined, { ...state.doc.child(0).attrs, title: 'Map' }),
    );
    expect(editor.view.dom.querySelector('iframe')).toBe(frame);
    expect(frame.title).toBe('Map');
    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(0, undefined, {
        ...editor.view.state.doc.child(0).attrs,
        src: 'https://maps.example.com/embed?q=2',
      }),
    );
    expect(editor.view.dom.querySelector('iframe')).not.toBe(frame);
  });
});

describe('pageembed: suggested edits', () => {
  it('a page inserted while suggesting is a suggestion: rejected, the document is as it was', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({
      element,
      content: '<p>Before</p>',
      plugins: ['suggestions', 'pageembed'],
      pluginOptions: { suggestions: { author: { id: 'ann', name: 'Ann' }, enabled: true } },
    });
    editors.push(editor);
    await editor.ready;
    const before = editor.getHTML();
    const end = editor.view.state.doc.content.size;
    editor.view.dispatch(
      editor.view.state.tr.insert(
        end,
        editor.schema.nodes.pageembed!.create({
          src: 'https://example.com/map',
          size: 'nova-pageembed--16by9',
        }),
      ),
    );
    const [suggestion] = listSuggestions(editor.view.state.doc);
    expect(suggestion).toMatchObject({ kind: 'insert', node: 'pageembed' });
    expect(editor.getHTML()).toContain('data-change="insert"');
    // The HTML with the suggestion reads back the same.
    const html = editor.getHTML();
    editor.setContent(html);
    expect(editor.getHTML()).toBe(html);
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject'));
    expect(editor.getHTML()).toBe(before);
  });
});

describe('pageembed: the dialog', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const dialog = (e: Editor) => e.root.querySelector<HTMLFormElement>('.nova-dialog');
  const field = (e: Editor, name: string) =>
    dialog(e)!.querySelector<HTMLInputElement & HTMLSelectElement>(`[name="${name}"]`)!;

  async function openDialog(e: Editor) {
    await e.ready;
    e.root.querySelector<HTMLElement>('[data-control="pageembed"]')!.click();
    await vi.waitFor(() => expect(dialog(e)).not.toBeNull());
  }

  it('inserts a page at full width; a wrong address is an error next to the field', async () => {
    const e = mount('<p>Text</p>', undefined, { toolbar: 'pageembed' });
    await openDialog(e);
    expect(field(e, 'size').value).toBe('nova-pageembed--16by9');
    expect(field(e, 'width').disabled).toBe(true);
    field(e, 'src').value = 'ftp://example.com/calendar';
    dialog(e)!.requestSubmit();
    await flush();
    expect(dialog(e)!.textContent).toContain('Enter the full address, starting with https://');
    field(e, 'src').value = 'https://example.com/calendar';
    field(e, 'title').value = 'Team calendar';
    dialog(e)!.requestSubmit();
    await vi.waitFor(() => expect(dialog(e)).toBeNull());
    expect(e.getHTML()).toContain(
      '<div class="nova-pageembed nova-pageembed--16by9" style="position: relative; width: 100%; padding-top: 56.25%; overflow: hidden"><iframe src="https://example.com/calendar" title="Team calendar"',
    );
  });

  it('edits the selected page: a fixed size turns width and height on', async () => {
    const e = mount(RESPONSIVE, undefined, { toolbar: 'pageembed' });
    await e.ready;
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, 0)));
    await openDialog(e);
    expect(field(e, 'src').value).toBe('https://maps.example.com/embed?q=1');
    const size = field(e, 'size');
    size.value = '';
    size.dispatchEvent(new Event('change', { bubbles: true }));
    size.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(field(e, 'width').disabled).toBe(false));
    field(e, 'width').value = '640';
    field(e, 'height').value = '480';
    dialog(e)!.requestSubmit();
    await vi.waitFor(() => expect(dialog(e)).toBeNull());
    expect(e.view.state.doc.childCount).toBe(1);
    expect(e.getHTML()).toContain('width="640" height="480"');
    expect(e.getHTML()).not.toContain('padding-top');
  });

  it('allowUrl: a site that is not allowed is refused in the dialog', async () => {
    const e = mount(
      '<p></p>',
      { allowUrl: (url) => url.startsWith('https://ok.example/') },
      {
        toolbar: 'pageembed',
      },
    );
    await openDialog(e);
    field(e, 'src').value = 'https://elsewhere.example/';
    dialog(e)!.requestSubmit();
    await flush();
    expect(dialog(e)!.textContent).toContain('Pages from this site can’t be embedded here.');
  });
});
