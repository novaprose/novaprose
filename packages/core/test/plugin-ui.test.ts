import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';

/**
 * The public UI for plugins: a dialog from a field description (editor.ui.dialog) and sidebars
 * (registry.addSidebar + editor.ui.sidebar).
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(
  options: Parameters<typeof createEditor>[0] extends infer O ? Partial<O> : never = {},
) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content: '<p>Text</p>', ...options });
  return editor;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const dialogEl = (e: Editor) => e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
const input = (e: Editor, name: string) =>
  dialogEl(e).querySelector<HTMLInputElement>(`[name="${name}"]`)!;
const submit = async (e: Editor) => {
  dialogEl(e).requestSubmit();
  await flush();
};
/** The dialog implementation loads on first open: wait for it to appear. */
const opened = (e: Editor) => vi.waitFor(() => expect(dialogEl(e)).not.toBeNull());

describe('editor.ui.dialog: a dialog from a field description', () => {
  it('fields with labels, initial data, value types; the result is the data', async () => {
    const e = mount();
    const result = e.ui.dialog({
      title: 'Insert video',
      submitLabel: 'Insert',
      initialData: { src: 'https://a.io/v', width: 640, autoplay: true, size: 'm' },
      fields: [
        { type: 'url', name: 'src', label: 'Video URL', hint: 'YouTube or Vimeo' },
        { type: 'number', name: 'width', label: 'Width' },
        { type: 'checkbox', name: 'autoplay', label: 'Autoplay' },
        {
          type: 'select',
          name: 'size',
          label: 'Size',
          options: [
            { value: 's', label: 'Small' },
            { value: 'm', label: 'Medium' },
          ],
        },
      ],
    });
    await opened(e);
    // The label is linked to the field, the hint through aria-describedby.
    const src = input(e, 'src');
    expect(dialogEl(e).querySelector(`label[for="${src.id}"]`)?.textContent).toBe('Video URL');
    expect(document.getElementById(src.getAttribute('aria-describedby')!)?.textContent).toBe(
      'YouTube or Vimeo',
    );
    input(e, 'width').value = '';
    await submit(e);
    expect(await result).toEqual({
      src: 'https://a.io/v',
      width: null,
      autoplay: true,
      size: 'm',
    });
    expect(e.root.querySelector('.nova-dialog')).toBeNull();
  });

  it('a required field and a format: an error at the field, aria-invalid, focus on the first invalid one', async () => {
    const e = mount();
    const onSubmit = vi.fn();
    void e.ui.dialog({
      title: 'T',
      fields: [
        { type: 'text', name: 'title', label: 'Title', required: true },
        { type: 'email', name: 'mail', label: 'Email' },
      ],
      onSubmit,
    });
    await opened(e);
    // The asterisk is visible but isn't part of the field name for screen readers.
    expect(dialogEl(e).querySelector('.nova-required')?.getAttribute('aria-hidden')).toBe('true');
    input(e, 'mail').value = 'not an email';
    await submit(e);
    expect(onSubmit).not.toHaveBeenCalled();
    const title = input(e, 'title');
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(title.getAttribute('aria-required')).toBe('true');
    const errorId = title.getAttribute('aria-describedby')!;
    expect(document.getElementById(errorId)?.textContent).toBe('This field is required');
    expect(document.activeElement).toBe(title);
    // Typing clears the field error.
    title.value = 'x';
    title.dispatchEvent(new Event('input'));
    expect(title.getAttribute('aria-invalid')).toBe('false');
  });

  it('a custom check, an error from onSubmit keeps the dialog open, closing gives null', async () => {
    const e = mount();
    const controller = new AbortController();
    const result = e.ui.dialog({
      title: 'T',
      signal: controller.signal,
      fields: [
        {
          type: 'text',
          name: 'slug',
          label: 'Slug',
          validate: (v) => (/^[a-z-]+$/.test(String(v)) ? null : 'Lowercase letters only'),
        },
      ],
      onSubmit: (data) => (data.slug === 'taken' ? 'Already taken' : undefined),
    });
    await opened(e);
    input(e, 'slug').value = 'Bad Slug';
    await submit(e);
    expect(dialogEl(e).textContent).toContain('Lowercase letters only');
    input(e, 'slug').value = 'taken';
    await submit(e);
    expect(dialogEl(e).querySelector('.nova-dialog-error')?.textContent).toBe('Already taken');
    // Closing from outside (AbortSignal) works like "Cancel".
    controller.abort();
    expect(await result).toBeNull();
    expect(e.root.querySelector('.nova-dialog')).toBeNull();
  });

  it('onChange gets the data and control over the dialog; a message', async () => {
    const e = mount();
    const onChange = vi.fn();
    const result = e.ui.dialog({
      title: 'T',
      fields: [
        { type: 'message', text: 'Heads up', tone: 'warning' },
        { type: 'text', name: 'a', label: 'A' },
        { type: 'text', name: 'b', label: 'B' },
      ],
      onChange: (data, { name }, dialog) => {
        onChange(name, data);
        dialog.setData({ b: String(data.a).toUpperCase() });
        dialog.setEnabled('b', false);
        if (data.a === 'done') dialog.close();
      },
    });
    await opened(e);
    expect(dialogEl(e).querySelector('.nova-form-message')?.textContent).toBe('Heads up');
    input(e, 'a').value = 'hi';
    input(e, 'a').dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('a', { a: 'hi', b: '' });
    expect(input(e, 'b').value).toBe('HI');
    expect(input(e, 'b').disabled).toBe(true);
    input(e, 'a').value = 'done';
    input(e, 'a').dispatchEvent(new Event('input'));
    expect(await result).toBeNull();
  });
});

describe('editor.ui.dialog: tabs', () => {
  const tabsSpec = (onSubmit = vi.fn()) => ({
    title: 'Image',
    tabs: [
      { title: 'General', fields: [{ type: 'url' as const, name: 'src', label: 'Source' }] },
      {
        title: 'Advanced',
        fields: [{ type: 'text' as const, name: 'alt', label: 'Alt text', required: true }],
      },
    ],
    onSubmit,
  });

  it('WAI-ARIA roles, data from all tabs, arrows and Home/End switch', async () => {
    const e = mount();
    const result = e.ui.dialog(tabsSpec());
    await opened(e);
    const tabs = [...dialogEl(e).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panels = [...dialogEl(e).querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    expect(dialogEl(e).querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Image');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(panels.map((p) => p.hidden)).toEqual([false, true]);
    expect(panels[1]!.getAttribute('aria-labelledby')).toBe(tabs[1]!.id);
    // Only the selected tab is in the Tab order (roving tabindex).
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1]);
    tabs[0]!.focus();
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tabs[1]);
    expect(panels.map((p) => p.hidden)).toEqual([true, false]);
    tabs[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(tabs[0]);
    input(e, 'src').value = 'https://a.io/x.png';
    input(e, 'alt').value = 'Cat';
    await submit(e);
    expect(await result).toEqual({ src: 'https://a.io/x.png', alt: 'Cat' });
  });

  it('an error on a hidden tab: the dialog switches to it and focuses the field', async () => {
    const e = mount();
    const onSubmit = vi.fn();
    void e.ui.dialog(tabsSpec(onSubmit));
    await opened(e);
    await submit(e);
    expect(onSubmit).not.toHaveBeenCalled();
    const panels = [...dialogEl(e).querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    expect(panels.map((p) => p.hidden)).toEqual([true, false]);
    expect(document.activeElement).toBe(input(e, 'alt'));
  });
});

describe('editor.ui.dialog: a file field', () => {
  const png = (name = 'cat.png', size = 10) =>
    new File([new Uint8Array(size)], name, { type: 'image/png' });
  const fileSpec = (extra: object = {}) => ({
    title: 'Attach',
    fields: [
      {
        type: 'file' as const,
        name: 'files',
        label: 'Attachments',
        accept: 'image/*,.pdf',
        multiple: true,
        maxSize: 100,
        required: true,
        ...extra,
      },
    ],
  });
  const zone = (e: Editor) => dialogEl(e).querySelector<HTMLElement>('.nova-dropzone')!;
  const drop = (e: Editor, files: File[]) => {
    const event = Object.assign(new Event('drop', { bubbles: true, cancelable: true }), {
      dataTransfer: { files },
    });
    zone(e).dispatchEvent(event);
  };

  it('dropping and choosing: matching files in the list, the data is an array of File', async () => {
    const e = mount();
    const onChange = vi.fn();
    const result = e.ui.dialog({ ...fileSpec(), onChange });
    await opened(e);
    const fileInput = input(e, 'files');
    // The field name for screen readers is the field label.
    expect(document.getElementById(fileInput.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Attachments *',
    );
    drop(e, [png('a.png'), png('doc.pdf')]);
    Object.defineProperty(fileInput, 'files', { value: [png('b.png')], configurable: true });
    fileInput.dispatchEvent(new Event('change'));
    const names = [...dialogEl(e).querySelectorAll('.nova-file-name')].map((n) => n.textContent);
    expect(names).toEqual(['a.png', 'doc.pdf', 'b.png']);
    expect(onChange).toHaveBeenCalledTimes(2);
    // Removing: a button by the file (with the file name for screen readers).
    const remove = dialogEl(e).querySelector<HTMLButtonElement>('.nova-file-remove')!;
    expect(remove.getAttribute('aria-label')).toBe('Remove: a.png');
    remove.click();
    await submit(e);
    const data = await result;
    expect((data!.files as File[]).map((f) => f.name)).toEqual(['doc.pdf', 'b.png']);
  });

  it('a wrong type and a too large file are rejected with an error at the field; a required field', async () => {
    const e = mount();
    void e.ui.dialog(fileSpec());
    await opened(e);
    drop(e, [new File(['x'], 'evil.exe', { type: 'application/x-msdownload' })]);
    expect(dialogEl(e).querySelector('.nova-field-error')?.textContent).toBe(
      'This file type is not allowed',
    );
    drop(e, [png('big.png', 500)]);
    expect(dialogEl(e).querySelector('.nova-field-error')?.textContent).toBe(
      'The file is too large',
    );
    expect(dialogEl(e).querySelectorAll('.nova-file')).toHaveLength(0);
    await submit(e);
    expect(dialogEl(e).querySelector('.nova-field-error')?.textContent).toBe(
      'This field is required',
    );
    expect(document.activeElement).toBe(input(e, 'files'));
  });

  it('without multiple a new file replaces the previous one', async () => {
    const e = mount();
    const result = e.ui.dialog(fileSpec({ multiple: false }));
    await opened(e);
    drop(e, [png('one.png')]);
    drop(e, [png('two.png')]);
    await submit(e);
    expect(((await result)!.files as File[]).map((f) => f.name)).toEqual(['two.png']);
  });
});

describe('sidebars', () => {
  const outline = (render = vi.fn()) => ({
    title: 'Outline',
    render: (container: HTMLElement) => {
      render();
      container.append(Object.assign(document.createElement('button'), { textContent: 'Go' }));
      return () => render('cleanup');
    },
  });

  it('registering adds a toggle button; the panel renders once', async () => {
    const render = vi.fn();
    const e = mount({
      toolbar: 'bold outline',
      setup: (ed) => ed.ui.registry.addSidebar('outline', outline(render)),
    });
    const button = e.root.querySelector<HTMLButtonElement>('[data-control="outline"]')!;
    expect(button.getAttribute('aria-label')).toBe('Outline');
    button.click();
    await flush();
    const panel = e.root.querySelector<HTMLElement>('.nova-sidebar[data-sidebar="outline"]')!;
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute('role')).toBe('complementary');
    expect(document.getElementById(panel.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Outline',
    );
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(panel.hidden).toBe(true);
    await e.ui.sidebar.show('outline');
    expect(render).toHaveBeenCalledTimes(1);
    e.destroy();
    editor = null;
    expect(render).toHaveBeenLastCalledWith('cleanup');
  });

  it('one panel at a time; Esc closes it and returns focus to the text', async () => {
    const e = mount({
      setup: (ed) => {
        ed.ui.registry.addSidebar('a', outline());
        ed.ui.registry.addSidebar('b', { ...outline(), title: 'B' });
      },
    });
    await e.ui.sidebar.show('a', { focus: true });
    const a = e.root.querySelector<HTMLElement>('[data-sidebar="a"]')!;
    expect(a.contains(document.activeElement)).toBe(true);
    await e.ui.sidebar.show('b');
    expect(a.hidden).toBe(true);
    expect(e.ui.sidebar.active).toBe('b');
    const b = e.root.querySelector<HTMLElement>('[data-sidebar="b"]')!;
    b.querySelector('button')!.focus();
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(e.ui.sidebar.active).toBeNull();
    expect(
      e.view.dom.contains(document.activeElement) || e.view.dom === document.activeElement,
    ).toBe(true);
  });

  it("without panels the markup doesn't change; a panel goes into a column next to the text", async () => {
    const e = mount({ setup: (ed) => ed.ui.registry.addSidebar('a', outline()) });
    expect(e.root.querySelector('.nova-body')).toBeNull();
    await e.ui.sidebar.show('a');
    const body = e.root.querySelector('.nova-body')!;
    expect(body.querySelector('.nova-content')).not.toBeNull();
    expect(body.querySelector('.nova-sidebar')).not.toBeNull();
  });

  it("a rendering error doesn't break the editor; an unknown panel gives a warning", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount({
      setup: (ed) =>
        ed.ui.registry.addSidebar('broken', {
          title: 'Broken',
          render: () => {
            throw new Error('boom');
          },
        }),
    });
    await e.ui.sidebar.show('broken');
    expect(e.ui.sidebar.active).toBeNull();
    expect(error).toHaveBeenCalled();
    await e.ui.sidebar.show('missing');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"missing"'));
  });
});
