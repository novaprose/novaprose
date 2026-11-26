import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTinymce, type CompatEditor } from '../src';
import type { DialogApi } from '../src/dialog';

/** windowManager.open, addContextToolbar, editor.dom and editor.formatter: scenarios of custom plugins. */

let tinymce = createTinymce();
afterEach(() => {
  tinymce.remove();
  tinymce = createTinymce();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function editor(content = '<p>text</p>'): Promise<CompatEditor> {
  document.body.innerHTML = `<textarea id="t">${content}</textarea>`;
  const [ed] = await tinymce.init({ selector: '#t' });
  return ed!;
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const tick = () => new Promise((r) => setTimeout(r, 0));
/** A dialog from a description is a separate module (lazy in the CDN): wait until it is drawn. */
const opened = () =>
  vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

describe('windowManager.open', () => {
  it('before the dialogs module loads: the API right away, setData goes into the opened dialog', async () => {
    vi.resetModules();
    const fresh = await import('../src');
    const tm = fresh.createTinymce();
    document.body.innerHTML = '<textarea id="t"></textarea>';
    const [ed] = await tm.init({ selector: '#t' });
    const api = ed!.windowManager.open({
      title: 'Early',
      body: { type: 'panel', items: [{ type: 'input', name: 'title', label: 'Title' }] },
      initialData: { title: 'a' },
      buttons: [{ type: 'cancel', text: 'Close' }],
    });
    api.setData({ title: 'b' });
    expect(api.getData()).toEqual({ title: 'b' });
    api.focus('title');
    await opened();
    expect(dialog().querySelector<HTMLInputElement>('input')!.value).toBe('b');
    await vi.waitFor(() => expect(document.activeElement).toBe(dialog().querySelector('input')));
    api.close();
    await tick();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    tm.remove();
  });

  it("fields, initialData, getData and onSubmit with api.close(): a typical plugin's dialog", async () => {
    const ed = await editor();
    const onSubmit = vi.fn((api: DialogApi) => {
      const data = api.getData();
      ed.insertContent(`<p>${String(data.title)} (${data.public ? 'public' : 'private'})</p>`);
      api.close();
    });
    ed.windowManager.open({
      title: 'Insert card',
      body: {
        type: 'panel',
        items: [
          { type: 'input', name: 'title', label: 'Title' },
          {
            type: 'selectbox',
            name: 'kind',
            label: 'Kind',
            items: [
              { text: 'Note', value: 'note' },
              { text: 'Tip', value: 'tip' },
            ],
          },
          { type: 'checkbox', name: 'public', label: 'Public' },
          { type: 'textarea', name: 'notes', label: 'Notes' },
        ],
      },
      initialData: { title: 'Hello', kind: 'tip', public: true },
      buttons: [
        { type: 'cancel', text: 'Close' },
        { type: 'submit', text: 'Insert', primary: true },
      ],
      onSubmit,
    });
    await opened();
    const box = dialog();
    expect(box.textContent).toContain('Insert card');
    const title = box.querySelector<HTMLInputElement>('input[type="text"]')!;
    expect(title.value).toBe('Hello');
    expect(box.querySelector<HTMLSelectElement>('select')!.value).toBe('tip');
    title.value = 'World';
    box.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await tick();
    expect(onSubmit).toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(ed.getContent()).toContain('World (public)');
  });

  it('onChange, a custom button → onAction, disable/enable, setData; cancel gives onCancel and onClose', async () => {
    const ed = await editor();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    const onClose = vi.fn();
    const api = ed.windowManager.open({
      title: 'Settings',
      body: { type: 'panel', items: [{ type: 'input', name: 'url', label: 'URL' }] },
      buttons: [
        { type: 'custom', name: 'fill', text: 'Fill example' },
        { type: 'cancel', text: 'Cancel' },
      ],
      onChange,
      onAction: (dialogApi, details) => {
        if (details.name === 'fill') dialogApi.setData({ url: 'https://example.com' });
      },
      onCancel,
      onClose,
    });
    await opened();
    const input = dialog().querySelector<HTMLInputElement>('input')!;
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith(expect.anything(), { name: 'url' });
    [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Fill example')!.click();
    expect(api.getData()).toEqual({ url: 'https://example.com' });
    api.disable('url');
    expect(input.disabled).toBe(true);
    api.enable('url');
    expect(input.disabled).toBe(false);
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick();
    expect(onCancel).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('tabs: showTab and onTabChange; htmlpanel without scripts and handlers', async () => {
    const ed = await editor();
    const onTabChange = vi.fn();
    const api = ed.windowManager.open({
      title: 'Help',
      body: {
        type: 'tabpanel',
        tabs: [
          {
            name: 'general',
            title: 'General',
            items: [
              {
                type: 'htmlpanel',
                html: '<p onclick="alert(1)">Hi <a href="javascript:alert(1)">x</a></p><script>alert(1)</script>',
              },
            ],
          },
          {
            name: 'more',
            title: 'More',
            items: [{ type: 'alertbanner', level: 'warn', text: 'Careful' }],
          },
        ],
      },
      buttons: [{ type: 'cancel', text: 'Close' }],
      onTabChange,
    });
    await opened();
    const panels = dialog().querySelectorAll<HTMLElement>('[role="tabpanel"]');
    expect(panels[0]!.hidden).toBe(false);
    expect(panels[1]!.hidden).toBe(true);
    expect(dialog().querySelector('script, [onclick], a[href^="javascript"]')).toBeNull();
    api.showTab('more');
    expect(panels[1]!.hidden).toBe(false);
    expect(onTabChange).toHaveBeenCalledWith(expect.anything(), {
      newTabName: 'more',
      oldTabName: 'general',
    });
    api.close();
  });
});

describe('addContextToolbar, dom, formatter', () => {
  it('the context toolbar shows by predicate(node)', async () => {
    document.body.innerHTML =
      '<textarea id="t"><p>Plain</p><blockquote><p>Quote</p></blockquote></textarea>';
    const [ed] = await tinymce.init({
      selector: '#t',
      setup: (e) => {
        e.ui.registry.addButton('unquote', { text: 'Unquote', onAction: () => {} });
        e.ui.registry.addContextToolbar('quote', {
          predicate: (node) => !!node.closest('blockquote'),
          items: 'unquote',
          position: 'node',
        });
      },
    });
    const registry = ed!.core.ui.registry.getContextToolbars();
    const entry = registry.find(([name]) => name === 'quote')![1];
    expect(entry.predicate(ed!.core)).toBe(false);
    ed!.execCommand('SelectAll');
    ed!.selection.collapse(false);
    expect(entry.predicate(ed!.core)).toBe(true);
  });

  it('dom: select, getParent, getAttrib, encode, create; DOM changes give a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ed = await editor('<p>One <a href="https://example.com">link</a></p><p>Two</p>');
    expect(ed.dom.select('p')).toHaveLength(2);
    const link = ed.dom.select('a')[0]!;
    expect(ed.dom.getAttrib(link, 'href')).toBe('https://example.com');
    expect(ed.dom.getParent(link, 'p')?.textContent).toBe('One link');
    expect(ed.dom.encode('<b>&')).toBe('&#60;b&#62;&#38;');
    const created = ed.dom.create('span', { class: 'x', onclick: 'alert(1)' }, '<b>');
    expect(created.outerHTML).toBe('<span class="x">&lt;b&gt;</span>');
    ed.dom.setAttrib();
    expect(warn).toHaveBeenCalled();
  });

  it('formatter: apply/remove/toggle/match for built-in formats and color', async () => {
    const ed = await editor('<p>text</p>');
    ed.execCommand('SelectAll');
    ed.formatter.apply('bold');
    expect(ed.formatter.match('bold')).toBe(true);
    ed.formatter.toggle('bold');
    expect(ed.formatter.match('bold')).toBe(false);
    ed.formatter.apply('h3');
    expect(ed.getContent()).toBe('<h3>text</h3>');
    ed.formatter.remove('h3');
    expect(ed.getContent()).toBe('<p>text</p>');
    ed.formatter.apply('forecolor', { value: '#ff0000' });
    expect(ed.getContent()).toBe('<p><span style="color: #ff0000;">text</span></p>');
    expect(ed.formatter.match('forecolor')).toBe(true);
  });
});
