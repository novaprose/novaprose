import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';

/** The dir and listStyle schema attributes + the directionality and advlist plugins. */

const editors: Editor[] = [];
async function mount(
  content: string,
  options: Partial<Parameters<typeof createEditor>[0]> = {},
): Promise<Editor> {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  await editor.ready;
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

describe('schema: dir and list style', () => {
  it.each([
    '<p dir="rtl">مرحبا</p><h2 dir="rtl" style="text-align: center;">عنوان</h2><p dir="ltr">left</p>',
    '<ul style="list-style-type: square;"><li><p>a</p></li></ul>',
    '<ol start="3" style="list-style-type: upper-roman;"><li><p>a</p></li></ol>',
    '<ol style="list-style-type: lower-greek;"><li><p>a</p></li></ol>',
  ])('HTML round trip: %s', async (html) => {
    expect((await mount(html)).getHTML()).toBe(html);
  });

  it('an old <ol type>, default styles and garbage are normalized', async () => {
    const editor = await mount(
      '<ol type="a"><li><p>a</p></li></ol><ul style="list-style-type: disc"><li><p>b</p></li></ul><ul style="list-style-type: url(x)"><li><p>c</p></li></ul><p dir="auto">d</p>',
    );
    expect(editor.getHTML()).toBe(
      '<ol style="list-style-type: lower-alpha;"><li><p>a</p></li></ol><ul><li><p>b</p></li></ul><ul><li><p>c</p></li></ul><p>d</p>',
    );
  });

  it('changing the block type keeps the direction', async () => {
    const editor = await mount('<p dir="rtl">x</p>');
    editor.exec('h2');
    expect(editor.getHTML()).toBe('<h2 dir="rtl">x</h2>');
  });

  it('validStyles without list-style-type removes the list style', async () => {
    const editor = await mount('<ol style="list-style-type: upper-alpha;"><li><p>a</p></li></ol>', {
      validStyles: 'color',
    });
    expect(editor.getHTML()).toBe('<ol><li><p>a</p></li></ol>');
  });
});

describe('directionality', () => {
  it('rtl, and pressing again removes the direction', async () => {
    const editor = await mount('<p>a</p><p>b</p>', {
      plugins: ['directionality'],
      toolbar: 'ltr rtl',
    });
    const rtl = editor.root.querySelector<HTMLButtonElement>('[data-control="rtl"]')!;
    const { state } = editor.view;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, 5)));
    rtl.click();
    expect(editor.getHTML()).toBe('<p dir="rtl">a</p><p dir="rtl">b</p>');
    expect(rtl.getAttribute('aria-pressed')).toBe('true');
    rtl.click();
    expect(editor.getHTML()).toBe('<p>a</p><p>b</p>');
  });
});

describe('advlist', () => {
  it('bullist becomes a split button: the action + a menu of styles', async () => {
    const editor = await mount('<p>item</p>', { plugins: ['advlist'], toolbar: 'bullist numlist' });
    const split = editor.root.querySelector('.nova-tb-split')!;
    expect(split.querySelector('[data-control="bullist"]')).not.toBeNull();
    expect(
      split.querySelector('[data-control="bullist-options"]')!.getAttribute('aria-haspopup'),
    ).toBe('menu');

    // The main part works as before: just a list.
    editor.root.querySelector<HTMLButtonElement>('[data-control="bullist"]')!.click();
    expect(editor.getHTML()).toBe('<ul><li><p>item</p></li></ul>');

    // The arrow picks a style.
    editor.root.querySelector<HTMLButtonElement>('[data-control="bullist-options"]')!.click();
    const square = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"], [role="menuitem"], [role="menuitemcheckbox"]',
      ),
    ].find((el) => el.textContent?.includes('Square'))!;
    square.click();
    expect(editor.getHTML()).toBe('<ul style="list-style-type: square;"><li><p>item</p></li></ul>');
  });

  it('a numbering style creates a list if there is none yet; "default" removes the style', async () => {
    const editor = await mount('<p>step</p>', { plugins: ['advlist'], toolbar: 'numlist' });
    const pick = (label: string) => {
      editor.root.querySelector<HTMLButtonElement>('[data-control="numlist-options"]')!.click();
      [...document.querySelectorAll<HTMLElement>('.nova-popover-menu [role^="menuitem"]')]
        .find((el) => el.textContent?.includes(label))!
        .click();
    };
    pick('Upper roman');
    expect(editor.getHTML()).toBe(
      '<ol style="list-style-type: upper-roman;"><li><p>step</p></li></ol>',
    );
    pick('Default');
    expect(editor.getHTML()).toBe('<ol><li><p>step</p></li></ol>');
  });
});
