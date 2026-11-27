import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { printDocumentHtml } from '../src/ui/print';

/**
 * Bold, italic, strikethrough, inline code, subscript and superscript stay part of the line's text for
 * screen readers: in the editing view their elements carry role="none". Chromium otherwise gives each its
 * own accessibility object, and NVDA said "text unselected. Bold on" after Ctrl+B on a selected word
 * (screen-reader/nvda.spec.ts). The output HTML keeps the plain elements.
 */

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function mount(content: string): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content });
  editors.push(editor);
  return editor;
}

const CONTENT =
  '<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> <sub>1</sub> <sup>2</sup> ' +
  '<a href="https://example.com">link</a></p>';

describe('marks in the editing view', () => {
  it('bold, italic, strike, code, sub and sup get role="none"; underline and links do not', () => {
    const editor = mount(CONTENT);
    const dom = editor.view.dom;
    for (const tag of ['strong', 'em', 's', 'code', 'sub', 'sup']) {
      expect(dom.querySelector(tag)?.getAttribute('role'), tag).toBe('none');
    }
    expect(dom.querySelector('u')?.hasAttribute('role')).toBe(false);
    expect(dom.querySelector('a')?.hasAttribute('role')).toBe(false);
  });

  it('a mark added by a command is rendered the same way', () => {
    const editor = mount('<p>source text</p>');
    const { state } = editor.view;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, 7)));
    editor.exec('bold');
    expect(editor.view.dom.querySelector('strong')?.getAttribute('role')).toBe('none');
    expect(editor.getHTML()).toBe('<p><strong>source</strong> text</p>');
  });

  it('getHTML() and printing keep the plain elements', () => {
    const editor = mount(CONTENT);
    expect(editor.getHTML()).not.toContain('role=');
    expect(printDocumentHtml(editor)).not.toContain('role="none"');
  });
});
