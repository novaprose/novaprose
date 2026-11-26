import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions, type MergeTagsOptions } from '../src';

/** Template variables (mergetags): the node, the HTML round trip, inserting from the menu and with "{{". */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const LIST: MergeTagsOptions['list'] = [
  {
    title: 'Client',
    items: [
      { key: 'client', label: 'Client name' },
      { key: 'phone', label: 'Phone' },
    ],
  },
  { key: 'orderId', label: 'Order number' },
];

function mount(
  content: string,
  mergetags: MergeTagsOptions = { list: LIST },
  extra: Partial<EditorOptions> = {},
) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({
    element,
    content,
    plugins: ['mergetags'],
    pluginOptions: { mergetags },
    ...extra,
  });
  editor.focus();
  return editor;
}

function type(e: Editor, text: string) {
  const { state } = e.view;
  const end = state.doc.content.size - 1;
  e.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, end)).insertText(text));
}

const key = (e: Editor, k: string) =>
  e.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
  );
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('mergetags: HTML', () => {
  // Found by a property-based test: JSON comes from outside, and the label may turn out to be a number.
  it("getHTML doesn't crash when the label in the JSON isn't a string", () => {
    const e = mount('<p>a</p>');
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mergetag', attrs: { key: 'client', label: 1 } },
            { type: 'mergetag', attrs: { key: 'phone', label: null } },
          ],
        },
      ],
    });
    expect(e.getHTML()).toBe(
      '<p><span data-mergetag="client" contenteditable="false">1</span><span data-mergetag="phone" contenteditable="false">phone</span></p>',
    );
  });

  it('round trip without changes (the default attribute)', () => {
    const html =
      '<p>Client: <span data-mergetag="client" contenteditable="false">Client name</span>, order # <span data-mergetag="orderId" contenteditable="false">Order number</span></p>';
    const e = mount(html);
    expect(e.getHTML()).toBe(html);
    expect(e.root.querySelectorAll('.nova-mergetag')).toHaveLength(2);
  });

  it('a custom attribute (data-var): a "chip" from another editor with styles keeps its key and label', () => {
    const e = mount(
      '<p>from <span contenteditable="false" data-var="client" style="background:#dbeafe;color:#1d4ed8;font-weight:500">Client name</span></p>',
      { list: LIST, attribute: 'data-var' },
    );
    expect(e.getHTML()).toBe(
      '<p>from <span data-var="client" contenteditable="false">Client name</span></p>',
    );
  });

  it("the label comes from the list; an unknown key isn't lost but highlighted", () => {
    const e = mount(
      '<p><span data-mergetag="phone">Old label</span> <span data-mergetag="legacy_key">Something</span></p>',
    );
    const chips = [...e.root.querySelectorAll<HTMLElement>('.nova-mergetag')];
    expect(chips.map((c) => c.textContent)).toEqual(['Phone', 'Something']);
    expect(chips[1]!.classList.contains('is-unknown')).toBe(true);
    expect(e.getHTML()).toContain('data-mergetag="legacy_key"');
  });

  it("an invalid key and attribute don't reach the HTML", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount('<p><span data-mergetag="a b">x</span></p>');
    expect(e.getHTML()).toBe('<p>x</p>');
    e.destroy();
    mount('<p><span onclick="x">y</span></p>', { attribute: 'onclick' });
    expect(warn.mock.calls.join('\n')).toMatch(/data-name/);
    expect(editor!.getHTML()).toBe('<p>y</p>');
  });
});

describe('mergetags: inserting', () => {
  it('the menu: groups, inserting at the cursor', async () => {
    const e = mount('<p>Order #</p>', { list: LIST }, { toolbar: 'mergetags' });
    // The plugin's buttons are registered by its lazy part, after editor.ready.
    await e.ready;
    const button = e.root.querySelector<HTMLButtonElement>('[data-control="mergetags"]')!;
    expect(button.getAttribute('aria-label')).toBe('Insert variable');
    const { state } = e.view;
    e.view.dispatch(
      state.tr.setSelection(TextSelection.create(state.doc, state.doc.content.size - 1)),
    );
    button.click();
    const menu = e.root.querySelector<HTMLElement>('.nova-menu')!;
    expect(menu.querySelector('.nova-menu-heading')!.textContent).toBe('Client');
    [...menu.querySelectorAll<HTMLButtonElement>('.nova-menu-item')]
      .find((b) => b.textContent?.includes('Order number'))!
      .click();
    expect(e.getHTML()).toBe(
      '<p>Order #<span data-mergetag="orderId" contenteditable="false">Order number</span></p>',
    );
  });

  it('an empty list makes the button inactive', async () => {
    const e = mount('<p>x</p>', { list: [] }, { toolbar: 'mergetags' });
    await e.ready;
    expect(e.root.querySelector<HTMLButtonElement>('[data-control="mergetags"]')!.disabled).toBe(
      true,
    );
  });

  it('"{{" and search by label: Enter inserts the variable in place of what was typed', async () => {
    const e = mount('<p>Hello, </p>');
    await e.ready;
    type(e, ' {{pho');
    await flush();
    const list = e.root.querySelector<HTMLElement>('.nova-ac')!;
    expect(list.textContent).toContain('Phone');
    key(e, 'Enter');
    expect(e.getHTML()).toBe(
      '<p>Hello, <span data-mergetag="phone" contenteditable="false">Phone</span></p>',
    );
  });
});
