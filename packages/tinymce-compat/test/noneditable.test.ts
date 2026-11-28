import { afterEach, describe, expect, it } from 'vitest';
import { createTinymce } from '../src';

/** Locked content as the TinyMCE documentation describes it: on by default, its classes are options. */

let tinymce = createTinymce();
afterEach(() => {
  tinymce.remove();
  tinymce = createTinymce();
  document.body.innerHTML = '';
});

describe('noneditable', () => {
  it('mceNonEditable content is kept and locked, with no plugin to enable', async () => {
    document.body.innerHTML =
      '<textarea id="t"><p class="mceNonEditable">Terms</p><p>Your text</p></textarea>';
    const [editor] = await tinymce.init({ selector: '#t' });
    expect(editor!.getContent()).toBe('<p class="mceNonEditable">Terms</p><p>Your text</p>');
    editor!.selection.setCursorLocation(editor!.getBody().querySelector('p')!.firstChild!, 2);
    editor!.insertContent('X');
    expect(editor!.getContent()).toBe('<p class="mceNonEditable">Terms</p><p>Your text</p>');
  });

  it('noneditable_class and editable_class name the classes', async () => {
    document.body.innerHTML =
      '<textarea id="t"><div class="locked"><p>frame</p><p class="open">field</p></div></textarea>';
    const [editor] = await tinymce.init({
      selector: '#t',
      noneditable_class: 'locked',
      editable_class: 'open',
    });
    expect(editor!.getContent()).toBe(
      '<div class="locked"><p>frame</p><p class="open">field</p></div>',
    );
  });
});
