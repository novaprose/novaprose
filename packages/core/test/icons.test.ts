import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, icons, type Editor, type EditorOptions } from '../src';
import phosphor from '../src/icons/phosphor';
import tabler from '../src/icons/tabler';
import { cleanIcon } from '../src/ui/registry';

/** Icons by name: the icons option (a pack), editor.ui.registry.addIcon, the built-in set. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function make(options: Partial<EditorOptions> = {}): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, ...options });
  editors.push(editor);
  return editor;
}

/** An icon whose only path is `d`, and the same icon as the editor draws it (cleaned markup). */
const svgWith = (d: string) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const drawn = (d: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"></path></svg>`;
const B = svgWith('M0 0');
/** The first path of an SVG string, and of the icon drawn inside an element of the editor. */
const pathOf = (svg: string | undefined) => /<path d="([^"]+)"/.exec(svg ?? '')?.[1];
const pathIn = (editor: Editor, selector: string) =>
  editor.root.querySelector(`${selector} svg path`)?.getAttribute('d');

describe('icons', () => {
  it('built-in buttons show the built-in icons by default', () => {
    const editor = make();
    expect(editor.ui.registry.get('bold')?.icon).toBe(icons.bold);
    expect(pathIn(editor, '[data-control="bold"]')).toBe(pathOf(icons.bold));
  });

  it('a pack replaces built-in icons by name, the toolbar included; what it lacks stays built in', () => {
    const editor = make({ icons: { bold: B, italic: 'not an svg' } });
    expect(editor.ui.registry.get('bold')?.icon).toBe(drawn('M0 0'));
    expect(pathIn(editor, '[data-control="bold"]')).toBe('M0 0');
    expect(editor.ui.registry.get('italic')?.icon).toBe(icons.italic);
    expect(editor.ui.registry.getMenuItem('bold')?.icon).toBe(drawn('M0 0'));
  });

  it('the pack draws the rest of the interface too: chevrons, "more", menus, dialogs, notifications', async () => {
    const editor = make({
      icons: {
        more: svgWith('M1 1'),
        chevronDown: svgWith('M2 2'),
        close: svgWith('M3 3'),
        check: svgWith('M4 4'),
      },
      toolbar: 'blocks bold italic',
    });
    expect(pathIn(editor, '.nova-tb-more')).toBe('M1 1');
    expect(pathIn(editor, '[data-control="blocks"] .nova-chevron')).toBe('M2 2');

    editor.ui.notify({ text: 'Saved', timeout: 0 });
    expect(pathIn(editor, '.nova-notifications')).toBe('M3 3');

    editor.ui.openDialog({ title: 'Title', body: document.createElement('div') });
    expect(pathIn(editor, '.nova-dialog-close')).toBe('M3 3');
    editor.ui.activeDialog?.close();

    // The block list marks the current block with a check mark.
    editor.root.querySelector<HTMLElement>('[data-control="blocks"]')!.click();
    await Promise.resolve();
    expect(pathIn(editor, '.nova-menu-check')).toBe('M4 4');
  });

  it('addIcon after the buttons still counts; a name resolves; an own SVG stays', () => {
    const editor = make();
    editor.ui.registry.addIcon('bold', B);
    expect(editor.ui.registry.get('bold')?.icon).toBe(drawn('M0 0'));
    editor.ui.registry.addButton('mine', { icon: 'italic', tooltip: 'Mine', onAction: () => {} });
    expect(editor.ui.registry.get('mine')?.icon).toBe(icons.italic);
    editor.ui.registry.addButton('own', {
      icon: '<svg>o</svg>',
      tooltip: 'Own',
      onAction: () => {},
    });
    expect(editor.ui.registry.get('own')?.icon).toBe('<svg aria-hidden="true">o</svg>');
    for (const missing of ['no-such-icon', 'constructor', '__proto__', 'toString']) {
      editor.ui.registry.addButton('none', { icon: missing, tooltip: 'None', onAction: () => {} });
      expect(editor.ui.registry.get('none')?.icon, missing).toBeUndefined();
    }
    editor.ui.registry.addIcon('bad', '<img src=x onerror=alert(1)>');
    expect(editor.ui.registry.getIcon('bad')).toBeUndefined();
  });

  it('a replacement that cannot be drawn leaves the built-in icon', () => {
    const editor = make({ icons: { bold: '<svg></svg><svg></svg>' } });
    expect(editor.ui.registry.get('bold')?.icon).toBe(icons.bold);
  });

  it('the Tabler and Phosphor packs have every built-in icon, as plain SVG', () => {
    for (const [name, pack] of [
      ['tabler', tabler],
      ['phosphor', phosphor],
    ] as const) {
      expect(Object.keys(pack).sort(), name).toEqual(Object.keys(icons).sort());
      for (const [key, svg] of Object.entries(pack)) {
        expect(svg.startsWith('<svg '), `${name}.${key}`).toBe(true);
        expect(svg, `${name}.${key}`).not.toMatch(/<script|\son\w+=|javascript:|href=/i);
        // Cleaning takes nothing away from them (same paths, same shapes).
        expect(cleanIcon(svg)?.match(/<\w+/g), `${name}.${key}`).toEqual(svg.match(/<\w+/g));
      }
    }
  });
});

describe('cleanIcon', () => {
  it('keeps the drawing and removes what runs code, styles the page or leads elsewhere', () => {
    const svg =
      '<svg viewBox="0 0 24 24" onload="alert(1)">' +
      '<script>alert(2)</script>' +
      '<style>body { display: none }</style>' +
      '<a href="javascript:alert(3)"><path d="M5 5"/></a>' +
      '<foreignObject><div>html</div></foreignObject>' +
      '<set attributeName="href" to="javascript:alert(4)"/>' +
      '<use href="#shape" onclick="alert(5)"/>' +
      '<use href="/sprite.svg#bold"/>' +
      '<image href="javascript:alert(6)"/>' +
      '<image xlink:href="data:text/html,x"/>' +
      '<path d="M1 1" fill="currentColor"/>' +
      '</svg>';
    const out = cleanIcon(svg)!;
    expect(out).not.toMatch(
      /alert|<script|<style|<a[\s>]|foreignObject|<set|onload|onclick|data:/i,
    );
    expect(out).toContain('<path d="M1 1" fill="currentColor"></path>');
    expect(out).toContain('<use href="#shape"></use>');
    expect(out).toContain('<use href="/sprite.svg#bold"></use>');
    expect(out.startsWith('<svg viewBox="0 0 24 24"')).toBe(true);
  });

  it('keeps no HTML: <desc>, <title> and <foreignObject> would parse their content as HTML', () => {
    const out = cleanIcon(
      '<svg viewBox="0 0 24 24">' +
        '<desc><form action="javascript:alert(1)"><button>Go</button></form></desc>' +
        '<title><img src="x" onerror="alert(2)"><b>icon</b></title>' +
        '<g><desc><input formaction="javascript:alert(3)" type="submit"></desc></g>' +
        '<path d="M1 1"/>' +
        '</svg>',
    )!;
    expect(out).not.toMatch(/alert|<form|<button|<img|<input|<b>/i);
    expect(out).toContain('<path d="M1 1"></path>');
    // What is drawn reaches the page as it was checked: the HTML parser builds the same elements.
    const host = document.createElement('div');
    host.innerHTML = out;
    expect(
      [...host.querySelectorAll('*')].every(
        (el) => el.namespaceURI === 'http://www.w3.org/2000/svg',
      ),
    ).toBe(true);
  });

  it('takes an SVG file as drawing apps save it: an XML declaration, a doctype, comments', () => {
    const file =
      '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: a drawing app -->\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- a layer --><path d="M1 1"/></svg>\n';
    expect(cleanIcon(file)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 1"></path></svg>',
    );
    const editor = make({ icons: { bold: file } });
    expect(pathIn(editor, '[data-control="bold"]')).toBe('M1 1');
    editor.ui.registry.addIcon('italic', file);
    expect(editor.ui.registry.getIcon('italic')).toBe(cleanIcon(file));
  });

  it('marks the icon decorative: a control is named by its label, never by its icon', () => {
    expect(cleanIcon('<svg><title>Bold</title><path d="M1 1"/></svg>')).toMatch(
      /^<svg aria-hidden="true">/,
    );
  });

  it('accepts only one <svg> element', () => {
    expect(cleanIcon('<svg></svg><svg></svg>')).toBeUndefined();
    expect(cleanIcon('<svg></svg><img src=x onerror=alert(1)>')).toBeUndefined();
    expect(cleanIcon('<img src=x onerror=alert(1)>')).toBeUndefined();
    expect(cleanIcon('text')).toBeUndefined();
    expect(cleanIcon('  <svg viewBox="0 0 1 1"></svg>  ')).toBe(
      '<svg viewBox="0 0 1 1" aria-hidden="true"></svg>',
    );
  });
});
