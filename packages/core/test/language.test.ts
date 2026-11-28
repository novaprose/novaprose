import { afterEach, describe, expect, it } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import {
  createEditor,
  getTextLanguage,
  setTextLanguage,
  type Editor,
  type EditorOptions,
} from '../src';
import { contentLanguages, languageName, languageTag } from '../src/language';
import { withoutTextLanguage } from '../src/paste';
import { cleanPastedHTML } from '../src/paste-office';
import { exportDocx } from '../src/docx';
import { unzip } from '../src/docx/zip';

/** Passages in another language (WCAG 3.1.2): <span lang>, the button, paste and Word. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function make(content = '', options: Partial<EditorOptions> = {}): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

function select(editor: Editor, from: number, to: number) {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

describe('language tags', () => {
  it('a valid tag in its canonical form; anything else is no tag', () => {
    expect(languageTag('fr')).toBe('fr');
    expect(languageTag('EN-us')).toBe('en-US');
    expect(languageTag(' zh-hant-tw ')).toBe('zh-Hant-TW');
    for (const bad of [
      null,
      42,
      {},
      '',
      ' ',
      'x',
      'en_US',
      'bad tag',
      'en"><script>',
      'a'.repeat(40),
    ])
      expect(languageTag(bad), JSON.stringify(bad)).toBeNull();
  });

  it("a language's name in the interface language", () => {
    expect(languageName('fr')).toBe('French');
    expect(languageName('fr', 'de')).toBe('Französisch');
    expect(languageName('la')).toBe('Latin');
  });

  it('the menu: configured languages in their order, the default ones by name', () => {
    expect(
      contentLanguages([
        { code: 'de', title: 'Deutsch' },
        { code: 'FR' },
        { code: 'fr' },
        { code: '!' },
      ]),
    ).toEqual([
      { code: 'de', title: 'Deutsch' },
      { code: 'fr', title: 'French' },
    ]);
    const defaults = contentLanguages(undefined).map((l) => l.title);
    expect(defaults).toHaveLength(20);
    expect(defaults).toEqual([...defaults].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('the <span lang> mark', () => {
  it('a passage survives a round trip; any element passes its language to its text', () => {
    const html = '<p>She said <span lang="fr">bonjour</span>.</p>';
    expect(make(html).getHTML()).toBe(html);
    expect(
      make(
        '<p><em lang="DE">gut</em> <a href="https://example.com" lang="it">ciao</a></p>',
      ).getHTML(),
    ).toBe(
      '<p><span lang="de"><em>gut</em></span> <span lang="it"><a href="https://example.com">ciao</a></span></p>',
    );
    // A block in another language stays a block, its text is marked as one passage.
    const block = make('<p lang="es">Hola <strong>amigo</strong></p>');
    expect(block.getHTML()).toBe('<p><span lang="es">Hola <strong>amigo</strong></span></p>');
    block.setContent(block.getHTML());
    expect(block.getHTML()).toBe('<p><span lang="es">Hola <strong>amigo</strong></span></p>');
  });

  it('an empty or broken lang is dropped', () => {
    expect(make('<p><span lang="">a</span> <span lang="x y">b</span></p>').getHTML()).toBe(
      '<p>a b</p>',
    );
  });

  it('a language from JSON is checked again on output', () => {
    const editor = make();
    editor.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'language', attrs: { lang: 'fr"><b>' } }] },
          ],
        },
      ],
    });
    expect(editor.getHTML()).toBe('<p><span>a</span></p>');
  });

  it('content rules without span take the language off', () => {
    const editor = make('<p><span lang="fr">bonjour</span></p>', { validElements: 'p,strong' });
    expect(editor.getHTML()).toBe('<p>bonjour</p>');
    expect(editor.isAllowed('language')).toBe(false);
  });
});

describe('marking a passage', () => {
  it('sets, replaces and removes the language of the selected words', () => {
    const editor = make('<p>She said bonjour to me.</p>');
    select(editor, 10, 17);
    expect(editor.exec(setTextLanguage('fr'))).toBe(true);
    expect(editor.getHTML()).toBe('<p>She said <span lang="fr">bonjour</span> to me.</p>');
    expect(getTextLanguage(editor.view.state)).toBe('fr');
    editor.exec(setTextLanguage('fr-CA'));
    expect(editor.getHTML()).toBe('<p>She said <span lang="fr-CA">bonjour</span> to me.</p>');
    editor.exec(setTextLanguage(null));
    expect(editor.getHTML()).toBe('<p>She said bonjour to me.</p>');
    expect(getTextLanguage(editor.view.state)).toBeNull();
    expect(editor.can(setTextLanguage('not a tag'))).toBe(false);
  });

  it('with nothing selected, the next words are typed in the language', () => {
    const editor = make('<p>Hello</p>');
    select(editor, 6, 6);
    editor.exec(setTextLanguage('de'));
    editor.view.dispatch(editor.view.state.tr.insertText(' Welt'));
    expect(editor.getHTML()).toBe('<p>Hello<span lang="de"> Welt</span></p>');
  });

  it('a code block takes no language', () => {
    const editor = make('<pre><code>let x</code></pre>');
    select(editor, 2, 4);
    expect(editor.can(setTextLanguage('fr'))).toBe(false);
  });
});

describe('the language button and the menu item', () => {
  it('exist with the default languages, and not with an empty list', () => {
    expect(make().ui.registry.get('language')?.type).toBe('menu');
    expect(make().ui.registry.getMenuItem('language')?.text).toBe('Language…');
    const none = make('', { contentLangs: [] });
    expect(none.ui.registry.get('language')).toBeUndefined();
    expect(none.ui.registry.getMenuItem('language')).toBeUndefined();
  });
});

describe('options', () => {
  it("contentLanguage is the text's language; a broken one is ignored", () => {
    expect(make('', { contentLanguage: 'fr-ca' }).view.dom.getAttribute('lang')).toBe('fr-CA');
    expect(make('', { contentLanguage: 'x"y' }).view.dom.hasAttribute('lang')).toBe(false);
    // The interface's language stays on the bars, not on the text.
    const ui = make('', { language: 'de' });
    expect(ui.view.dom.hasAttribute('lang')).toBe(false);
  });

  it('toolbarStickyOffset sets where the header sticks', () => {
    const editor = make('', { toolbarStickyOffset: 64 });
    expect(editor.root.style.getPropertyValue('--nova-sticky-offset')).toBe('64px');
    expect(
      make('', { toolbarStickyOffset: -5 }).root.style.getPropertyValue('--nova-sticky-offset'),
    ).toBe('');
  });
});

describe('paste', () => {
  it("a lang in the text's own language is dropped, others stay", () => {
    const html =
      '<p lang="en-GB">Colour <span lang="fr">couleur</span> <span lang="EN">color</span></p>';
    expect(withoutTextLanguage(html, 'en-US')).toBe(
      '<p>Colour <span lang="fr">couleur</span> <span>color</span></p>',
    );
    expect(withoutTextLanguage(html, null)).toBe(html);
    expect(withoutTextLanguage('<p>no lang</p>', 'en')).toBe('<p>no lang</p>');
  });

  it("Word's own document language is dropped, a phrase in another language stays", () => {
    const word =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"><body>' +
      '<p class=MsoNormal><span lang=EN-US>The French say </span><span lang=FR>joie de vivre</span>' +
      '<span lang=EN-US> about it, and the English say it too.</span></p></body></html>';
    const editor = make();
    editor.setContent(cleanPastedHTML(word));
    expect(editor.getHTML()).toBe(
      '<p>The French say <span lang="fr">joie de vivre</span> about it, and the English say it too.</p>',
    );
  });
});

describe('Word export', () => {
  it('a passage is a run in its language', async () => {
    const editor = make('<p>Hi <span lang="fr">bonjour</span></p>');
    const files = await unzip(await exportDocx(editor));
    const document = new TextDecoder().decode(files.get('word/document.xml'));
    expect(document).toContain(
      '<w:rPr><w:lang w:val="fr"/></w:rPr><w:t xml:space="preserve">bonjour</w:t>',
    );
  });
});
