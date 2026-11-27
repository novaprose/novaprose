import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkAccessibility } from '../src/a11y';
import { createEditor, type Editor } from '../src';
import { fixTransaction } from '../src/plugins/a11ychecker';

/** The a11ychecker plugin: the fixes and the Accessibility panel. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function mount(content: string, options: Record<string, unknown> = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['a11ychecker', 'anchor'],
    pluginOptions: { a11ychecker: options },
  });
  editors.push(editor);
  await editor.ready;
  return editor;
}

/** Fix the first issue of a rule and return the HTML. */
async function fixed(html: string, rule: string, value?: string | null) {
  const editor = await mount(html);
  const issue = checkAccessibility(editor.view.state.doc).find((i) => i.rule === rule)!;
  expect(issue, `no ${rule} in ${html}`).toBeTruthy();
  const tr = fixTransaction(editor.view.state, issue, value);
  editor.view.dispatch(tr!);
  return editor.getHTML();
}

const IMG = 'https://example.com/cat.png';

describe('fixes', () => {
  it('images: the alternative text, or decorative', async () => {
    expect(await fixed(`<p><img src="${IMG}"></p>`, 'I2', 'A grey cat')).toBe(
      `<p><img src="${IMG}" alt="A grey cat"></p>`,
    );
    expect(await fixed(`<p><img src="${IMG}"></p>`, 'I2', '')).toBe(
      `<p><img src="${IMG}" alt=""></p>`,
    );
  });

  it('headings: a bold paragraph becomes one, a level and an empty heading are fixed', async () => {
    expect(await fixed('<h2>A</h2><p><strong>Details</strong></p><p>x.</p>', 'D1')).toBe(
      '<h2>A</h2><h3>Details</h3><p>x.</p>',
    );
    expect(await fixed('<h2>A</h2><h4>B</h4>', 'D2')).toBe('<h2>A</h2><h3>B</h3>');
    expect(await fixed('<h2>A</h2><h3></h3><p>x</p>', 'N2')).toBe('<h2>A</h2><p>x</p>');
    expect(await fixed('<h2></h2>', 'N2')).toBe('<p></p>');
  });

  it('lists typed by hand become lists, without the markers', async () => {
    expect(await fixed('<p>• one</p><p>• two</p><p>after</p>', 'D4U')).toBe(
      '<ul><li><p>one</p></li><li><p>two</p></li></ul><p>after</p>',
    );
    expect(await fixed('<p>3. three</p><p>4. four</p>', 'D4O')).toBe(
      '<ol start="3"><li><p>three</p></li><li><p>four</p></li></ol>',
    );
  });

  it('links: joined, removed when empty', async () => {
    expect(
      await fixed(
        '<p><a href="https://a.example">Report</a> <a href="https://a.example">PDF</a></p>',
        'D3',
      ),
    ).toBe('<p><a href="https://a.example">Report PDF</a></p>');
    expect(
      await fixed(`<p><a href="https://a.example"><img src="${IMG}" alt=""></a></p>`, 'N3'),
    ).toBe(`<p><img src="${IMG}" alt=""></p>`);
  });

  it('contrast: the colors go; a duplicate id gets a new one; a table gets a header row', async () => {
    expect(await fixed('<p><span style="color: #aaaaaa">light</span> text</p>', 'D5B')).toBe(
      '<p>light text</p>',
    );
    expect(await fixed('<h2 id="a">One</h2><h2 id="a">Two</h2>', 'H93')).toBe(
      '<h2 id="a">One</h2><h2 id="a-2">Two</h2>',
    );
    expect(
      await fixed(
        '<table><tbody><tr><td><p>Name</p></td><td><p>Age</p></td></tr><tr><td><p>Ann</p></td><td><p>30</p></td></tr></tbody></table>',
        'T4B',
      ),
    ).toBe(
      '<table><tbody><tr><th><p>Name</p></th><th><p>Age</p></th></tr><tr><td><p>Ann</p></td><td><p>30</p></td></tr></tbody></table>',
    );
  });
});

async function openPanel(editor: Editor) {
  await editor.ui.sidebar.show('a11ychecker');
  return vi.waitFor(() => {
    const el = editor.root.querySelector<HTMLElement>('.nova-a11y-panel');
    if (!el) throw new Error('no panel');
    return el;
  });
}

const button = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text)!;

describe('the Accessibility panel', () => {
  it('a summary and a card per issue; a fix button fixes it, the list updates', async () => {
    const editor = await mount(
      '<h2>A</h2><h4>B</h4><p><img src="https://example.com/cat.png"></p>',
    );
    const announce = vi.spyOn(editor.ui, 'announce');
    const panel = await openPanel(editor);
    expect(panel.querySelector('[role="status"]')!.textContent).toBe('Errors: 2. Warnings: 0.');
    expect([...panel.querySelectorAll('.nova-a11y-desc')].map((p) => p.textContent)).toEqual([
      'A heading level is skipped: headings go down one level at a time.',
      'An image without alternative text: screen readers cannot say what it shows.',
    ]);
    button(panel, 'Change to Heading 3').click();
    expect(editor.getHTML()).toContain('<h3>B</h3>');
    expect(announce).toHaveBeenCalledWith('Fixed.');
    expect(panel.querySelectorAll('.nova-a11y-card')).toHaveLength(1);
  });

  it('an image: its alternative text is typed right in the card', async () => {
    const editor = await mount('<p><img src="https://example.com/cat.png"></p>');
    const panel = await openPanel(editor);
    const input = panel.querySelector<HTMLInputElement>('.nova-a11y-alt input')!;
    expect(panel.querySelector('.nova-a11y-alt label')!.textContent).toBe('Alternative text');
    input.value = 'A grey cat';
    panel.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(editor.getHTML()).toBe(
      '<p><img src="https://example.com/cat.png" alt="A grey cat"></p>',
    );
    expect(panel.querySelector('[role="status"]')!.textContent).toBe(
      'No accessibility problems found.',
    );
  });

  it('Ignore hides an issue for the session; filterIssue leaves issues out', async () => {
    const editor = await mount('<p><a href="https://a.example">click here</a></p><h2></h2>', {
      filterIssue: (issue: { rule: string }) => issue.rule !== 'N2',
    });
    const panel = await openPanel(editor);
    expect(panel.querySelectorAll('.nova-a11y-card')).toHaveLength(1);
    button(panel, 'Ignore').click();
    expect(panel.querySelector('[role="status"]')!.textContent).toBe(
      'No accessibility problems found.',
    );
  });

  it('checks again as the document changes', async () => {
    const editor = await mount('<p>Fine.</p>');
    const panel = await openPanel(editor);
    expect(panel.querySelectorAll('.nova-a11y-card')).toHaveLength(0);
    editor.setContent('<h2>A</h2><h5>B</h5>');
    await vi.waitFor(() => expect(panel.querySelectorAll('.nova-a11y-card')).toHaveLength(1), {
      timeout: 2000,
    });
  });

  it('the toolbar button opens and closes the panel', async () => {
    const editor = await mount('<p>x</p>');
    const toggle = editor.ui.registry.get('a11ycheck') as unknown as {
      onAction: (e: Editor) => void;
      isActive: (e: Editor) => boolean;
    };
    toggle.onAction(editor);
    await vi.waitFor(() => expect(toggle.isActive(editor)).toBe(true));
    toggle.onAction(editor);
    await vi.waitFor(() => expect(toggle.isActive(editor)).toBe(false));
  });
});
