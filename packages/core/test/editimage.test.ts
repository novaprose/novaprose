import { NodeSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditImageOptions } from '../src';
import {
  adjustPixels,
  clampRect,
  editedName,
  editGeometry,
  NO_EDIT,
  outputType,
  rectOfRatio,
  rotatedSize,
  turn,
} from '../src/plugins/editimage-pixels';

/**
 * Image editing (editimage). The pixels themselves (a canvas) are checked in real browsers
 * (e2e/plugins-parity.spec.ts); here the geometry, the colors and the reading of the image.
 */

describe('editimage: geometry and colors', () => {
  it('a quarter turn swaps the sides; turns wrap around', () => {
    expect(rotatedSize(40, 20, 90)).toEqual([20, 40]);
    expect(rotatedSize(40, 20, 180)).toEqual([40, 20]);
    expect(turn(0, -90)).toBe(270);
    expect(turn(270, 90)).toBe(0);
  });

  it('a crop stays inside the image; a ratio is the largest centered area', () => {
    expect(clampRect({ x: -5, y: 3.4, width: 100, height: 0 }, 40, 20)).toEqual({
      x: 0,
      y: 3,
      width: 40,
      height: 1,
    });
    expect(rectOfRatio(40, 20, 1)).toEqual({ x: 10, y: 0, width: 20, height: 20 });
    expect(rectOfRatio(40, 20, null)).toEqual({ x: 0, y: 0, width: 40, height: 20 });
  });

  it('the result: the crop in the turned image, its size or the one asked for', () => {
    expect(editGeometry(40, 20, { ...NO_EDIT, rotate: 90 })).toEqual({
      crop: { x: 0, y: 0, width: 20, height: 40 },
      width: 20,
      height: 40,
    });
    expect(
      editGeometry(40, 20, {
        ...NO_EDIT,
        crop: { x: 10, y: 0, width: 20, height: 20 },
        width: 100,
        height: 100,
      }),
    ).toMatchObject({ width: 100, height: 100 });
  });

  it('brightness, contrast and saturation on pixels; alpha stays; 0 changes nothing', () => {
    const pixels = () => new Uint8ClampedArray([200, 100, 50, 128]);
    const same = pixels();
    adjustPixels(same, { brightness: 0, contrast: 0, saturation: 0 });
    expect([...same]).toEqual([200, 100, 50, 128]);
    const bright = pixels();
    adjustPixels(bright, { brightness: 20, contrast: 0, saturation: 0 });
    expect([...bright]).toEqual([240, 120, 60, 128]);
    const gray = pixels();
    adjustPixels(gray, { brightness: 0, contrast: 0, saturation: -100 });
    expect(new Set([...gray].slice(0, 3)).size).toBe(1);
    expect(gray[3]).toBe(128);
    const flat = pixels();
    adjustPixels(flat, { brightness: 0, contrast: -100, saturation: 0 });
    expect([...flat].slice(0, 3)).toEqual([128, 128, 128]);
  });

  it('the file: PNG, JPEG and WebP stay, others become PNG; a name with -edited', () => {
    expect(outputType('image/jpeg')).toBe('image/jpeg');
    expect(outputType('image/gif')).toBe('image/png');
    expect(editedName('https://example.com/photos/cat.jpg', 'image/jpeg')).toBe('cat-edited.jpg');
    expect(editedName('/media/cat-edited.png', 'image/png')).toBe('cat-edited.png');
    expect(editedName('data:image/png;base64,AAAA', 'image/png')).toBe('image-edited.png');
  });
});

describe('editimage: reading the image', () => {
  const editors: Editor[] = [];
  afterEach(() => {
    editors.splice(0).forEach((e) => e.destroy());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function mount(src: string, options: EditImageOptions = {}) {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({
      element,
      content: `<p><img src="${src}" alt="A photo"></p>`,
      plugins: ['editimage'],
      pluginOptions: { editimage: options },
    });
    editors.push(editor);
    await editor.ready;
    editor.view.dispatch(
      editor.view.state.tr.setSelection(NodeSelection.create(editor.view.state.doc, 1)),
    );
    return editor;
  }

  const run = (e: Editor, name: string) => {
    const button = e.ui.registry.get(name);
    if (button?.type !== 'button') throw new Error(`no button ${name}`);
    button.onAction(e);
  };

  it('the buttons join the image toolbar and work only on a selected image', async () => {
    const e = await mount('https://example.com/cat.png');
    const toolbar = e.ui.registry.getContextToolbars().find(([name]) => name === 'image')![1];
    expect(toolbar.items).toContain('rotateleft rotateright | flipv fliph | editimage');
    const button = e.ui.registry.get('rotateright');
    expect(button?.type === 'button' && button.isEnabled!(e)).toBe(true);
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, 0)));
    expect(button?.type === 'button' && button.isEnabled!(e)).toBe(false);
  });

  it('an image on a site that doesn’t allow reading it: a notice, the image as it was', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = await mount('https://other.example/cat.png');
    const notify = vi.spyOn(e.ui, 'notify');
    run(e, 'rotateright');
    await vi.waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('doesn’t allow editing it here') }),
      ),
    );
    expect(e.getHTML()).toContain('src="https://other.example/cat.png"');
  });

  it('an SVG is never edited, even with a generic type; your fetchImage is used', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'], {
      type: 'image/svg+xml',
    });
    const fetchImage = vi.fn(async () => svg);
    const e = await mount('https://example.com/logo.svg', { fetchImage });
    const notify = vi.spyOn(e.ui, 'notify');
    run(e, 'fliph');
    await vi.waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Only PNG, JPEG, WebP, GIF, AVIF and BMP images can be edited.',
        }),
      ),
    );
    expect(fetchImage).toHaveBeenCalledWith('https://example.com/logo.svg');
    // Bytes that are no image, sent as a generic type: refused too.
    // A text body with the type in the header: a jsdom Blob inside Node's Response breaks on Node 22.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>', { headers: { 'Content-Type': 'application/octet-stream' } }),
    );
    const plain = await mount('https://example.com/file.bin');
    const notifyPlain = vi.spyOn(plain.ui, 'notify');
    run(plain, 'flipv');
    await vi.waitFor(() =>
      expect(notifyPlain).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Only PNG, JPEG, WebP, GIF, AVIF and BMP images can be edited.',
        }),
      ),
    );
  });
});
