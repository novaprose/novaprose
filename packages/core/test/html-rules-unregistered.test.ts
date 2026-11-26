import { expect, it, vi } from 'vitest';
import { createEditor } from '../src';

/**
 * Element and attribute rules are a separate import (@novaprose/core/html-rules). Without registering it
 * the editor works as before (attributes in [...] don't apply, there are no new elements) and hints once
 * in the console what to attach. A separate file: the registration is global to the page.
 */
it('without registerHtmlRules: the old behavior and a hint in the console', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({
    element,
    extendedValidElements: 'h2[title],div[class]',
    content: '<h2 title="a">T</h2><div class="x">y</div>',
  });
  expect(editor.getHTML()).toBe('<h2>T</h2><p>y</p>');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("'@novaprose/core/html-rules'"));
  editor.destroy();
});

it("options without attributes and new elements don't need the module", () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, validElements: 'p,strong', content: '<h1>T</h1>' });
  expect(editor.getHTML()).toBe('<p>T</p>');
  expect(warn).not.toHaveBeenCalled();
  editor.destroy();
});
