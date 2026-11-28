import { afterEach, describe, expect, it, vi } from 'vitest';
import { icons } from '@novaprose/core';
import { createTinymce } from '../src';

/**
 * Icon packs as the public documentation describes them: a pack registers its icons with
 * tinymce.IconManager.add(name, { icons }), the icons option picks it by name, icons_url loads its script.
 */

let tinymce = createTinymce();
afterEach(() => {
  tinymce.remove();
  tinymce = createTinymce();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const svgWith = (d: string) => `<svg width="24" height="24"><path d="${d}"/></svg>`;
const pathOf = (svg: string) => /<path d="([^"]+)"/.exec(svg)?.[1];
const pathIn = (root: Element, selector: string) =>
  root.querySelector(`${selector} svg path`)?.getAttribute('d');

describe('icon packs', () => {
  it('icons: a pack added with IconManager redraws the built-in buttons by TinyMCE names', async () => {
    document.body.innerHTML = '<textarea id="t"></textarea>';
    tinymce.IconManager.add('mine', {
      icons: {
        bold: svgWith('M1 1'),
        'chevron-down': svgWith('M2 2'),
        'more-drawer': svgWith('M3 3'),
      },
    });
    const [editor] = await tinymce.init({
      selector: '#t',
      icons: 'mine',
      toolbar: 'bold italic blocks',
    });
    const root = editor!.getContainer();
    expect(pathIn(root, '[data-control="bold"]')).toBe('M1 1');
    expect(pathIn(root, '[data-control="blocks"] .nova-chevron')).toBe('M2 2');
    expect(pathIn(root, '.nova-tb-more')).toBe('M3 3');
    // What the pack lacks stays NovaProse's.
    expect(pathIn(root, '[data-control="italic"]')).toBe(pathOf(icons.italic));
  });

  it('a pack that is not chosen leaves the built-in buttons alone', async () => {
    document.body.innerHTML = '<textarea id="t"></textarea>';
    tinymce.IconManager.add('other', { icons: { italic: svgWith('M9 9') } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [editor] = await tinymce.init({ selector: '#t', toolbar: 'italic', icons: 'material' });
    expect(pathIn(editor!.getContainer(), '[data-control="italic"]')).toBe(pathOf(icons.italic));
    expect(warn.mock.calls.flat().join(' ')).toContain('icon pack "material" is not loaded');
  });

  it('icons_url loads the pack script before the editors are created', async () => {
    document.body.innerHTML = '<textarea id="t"></textarea>';
    const scripts: string[] = [];
    const append = document.head.append.bind(document.head);
    vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      for (const node of nodes) {
        if (node instanceof HTMLScriptElement) {
          scripts.push(node.src);
          // What the pack's icons.js does when it runs.
          tinymce.IconManager.add('remote', { icons: { bold: svgWith('M5 5') } });
          queueMicrotask(() => node.dispatchEvent(new Event('load')));
        } else append(node);
      }
    });
    const [editor] = await tinymce.init({
      selector: '#t',
      toolbar: 'bold',
      icons: 'remote',
      icons_url: 'https://cdn.example.com/icons/remote/icons.js',
    });
    expect(scripts).toEqual(['https://cdn.example.com/icons/remote/icons.js']);
    expect(pathIn(editor!.getContainer(), '[data-control="bold"]')).toBe('M5 5');
  });

  it('icons_url takes only http(s) addresses; a failed script leaves the built-in icons', async () => {
    document.body.innerHTML = '<textarea id="t"></textarea><textarea id="u"></textarea>';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const appended: string[] = [];
    const append = document.head.append.bind(document.head);
    vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      for (const node of nodes) {
        if (node instanceof HTMLScriptElement) {
          appended.push(node.src);
          queueMicrotask(() => node.dispatchEvent(new Event('error')));
        } else append(node);
      }
    });
    await tinymce.init({
      selector: '#t',
      icons: 'x',
      icons_url: 'javascript:alert(1)',
    });
    await tinymce.init({
      selector: '#t',
      icons: 'y',
      icons_url: 'data:text/javascript,alert(1)',
    });
    expect(appended).toEqual([]);
    const [editor] = await tinymce.init({
      selector: '#u',
      toolbar: 'bold',
      icons: 'z',
      icons_url: '/icons/z/icons.js',
    });
    expect(appended).toHaveLength(1);
    expect(pathIn(editor!.getContainer(), '[data-control="bold"]')).toBe(pathOf(icons.bold));
    expect(warn.mock.calls.flat().join(' ')).toMatch(/http or https address[\s\S]*failed to load/);
  });
});
