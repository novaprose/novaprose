import { NodeSelection } from 'prosemirror-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';

/**
 * The Edit image dialog and the quick actions, in jsdom: a stand-in canvas records what is drawn,
 * so the crop, the size, the turn and the colors are checked to reach the drawing as asked. (The
 * pixels themselves are checked in real browsers: e2e/plugins-parity.spec.ts.)
 */

/** A 40×20 PNG (the e2e's two halves), embedded. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAACRXR/mAAAAKUlEQVR4nGO8qKPDQB/ARCd7Ri0etXjU4lGLRy0etXjU4lGLRy0eChYDAPh2AcDgfbG7AAAAAElFTkSuQmCC';

interface Call {
  method: string;
  args: unknown[];
}
let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        translate: record('translate'),
        scale: record('scale'),
        rotate: record('rotate'),
        drawImage: record('drawImage'),
        getImageData: (_x: number, _y: number, w: number, h: number) => {
          calls.push({ method: 'getImageData', args: [w, h] });
          return { data: new Uint8ClampedArray(Math.max(1, w * h) * 4).fill(100) };
        },
        putImageData: record('putImageData'),
        imageSmoothingQuality: 'low',
      }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    calls.push({ method: 'toBlob', args: [this.width, this.height, type] });
    callback(new Blob(['edited'], { type: type ?? 'image/png' }));
  });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 40, height: 20, close() {} }));
  // The preview is drawn in an animation frame.
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
    run(0);
    return 1;
  });
});

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(img = `<img src="${PNG}" alt="Halves">`) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content: `<p>${img}</p>`, plugins: ['editimage'] });
  editors.push(editor);
  await editor.ready;
  editor.view.dispatch(
    editor.view.state.tr.setSelection(NodeSelection.create(editor.view.state.doc, 1)),
  );
  return editor;
}

const button = (e: Editor, name: string) => {
  const control = e.ui.registry.get(name);
  if (control?.type !== 'button') throw new Error(`no button ${name}`);
  return control;
};
const lastDraw = () => [...calls].reverse().find((c) => c.method === 'drawImage')!.args;
const output = () => [...calls].reverse().find((c) => c.method === 'toBlob')!.args;
const src = (e: Editor) => String(e.view.state.doc.firstChild!.firstChild!.attrs.src);

describe('editimage: quick actions', () => {
  it('rotate right: a quarter turn, the sides swapped; the image is the new file', async () => {
    const e = await mount();
    button(e, 'rotateright').onAction(e);
    await vi.waitFor(() => expect(src(e)).not.toBe(PNG));
    expect(calls.find((c) => c.method === 'rotate')!.args[0]).toBeCloseTo(Math.PI / 2);
    expect(output()).toEqual([20, 40, 'image/png']);
    expect(src(e)).toMatch(/^data:image\/png;base64,/);
    // One undo: the original again.
    e.exec('undo');
    expect(src(e)).toBe(PNG);
  });

  it('flip horizontally mirrors after the turn; a shown size keeps its scale', async () => {
    const e = await mount(`<img src="${PNG}" alt="Halves" width="80" height="40">`);
    button(e, 'fliph').onAction(e);
    await vi.waitFor(() => expect(src(e)).not.toBe(PNG));
    expect(calls.find((c) => c.method === 'scale')!.args).toEqual([-1, 1]);
    const image = e.view.state.doc.firstChild!.firstChild!;
    expect([image.attrs.width, image.attrs.height]).toEqual([80, 40]);
  });
});

describe('editimage: the dialog', () => {
  async function openDialog(e: Editor) {
    button(e, 'editimage').onAction(e);
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).not.toBeNull());
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    const group = (name: string) =>
      [...dialog.querySelectorAll('fieldset')].find(
        (f) => f.querySelector('legend')!.textContent === name,
      )!;
    const field = (groupName: string, label: string) =>
      [...group(groupName).querySelectorAll('label')]
        .find((l) => l.querySelector('span')?.textContent === label)!
        .querySelector<HTMLInputElement & HTMLSelectElement>('input, select')!;
    const change = (
      input: HTMLInputElement | HTMLSelectElement,
      value: string,
      event = 'change',
    ) => {
      input.value = value;
      input.dispatchEvent(new Event(event, { bubbles: true }));
    };
    const tool = (label: string) =>
      dialog.querySelector<HTMLButtonElement>(`.nova-editimage-tools [aria-label="${label}"]`)!;
    return { dialog, field, change, tool };
  }

  it('a square crop: the fields follow the shape, the drawing takes that square', async () => {
    const e = await mount();
    const { dialog, field, change } = await openDialog(e);
    change(field('Crop', 'Shape'), '1');
    expect(field('Crop', 'Left, px').value).toBe('10');
    expect(field('Crop', 'Width, px').value).toBe('20');
    expect(field('Size', 'Width, px').value).toBe('20');
    change(field('Crop', 'Left, px'), '0');
    dialog.requestSubmit();
    await vi.waitFor(() => expect(src(e)).not.toBe(PNG));
    expect(lastDraw().slice(1)).toEqual([0, 0, 20, 20, 0, 0, 20, 20]);
    expect(output()).toEqual([20, 20, 'image/png']);
  });

  it('the size with the proportions kept; colors go through the pixels', async () => {
    const e = await mount();
    const { dialog, field, change } = await openDialog(e);
    change(field('Size', 'Width, px'), '80');
    expect(field('Size', 'Height, px').value).toBe('40');
    const brightness = dialog.querySelector<HTMLInputElement>('input[type="range"]')!;
    change(brightness, '30', 'input');
    expect(dialog.querySelector('output')!.textContent).toBe('30');
    dialog.requestSubmit();
    await vi.waitFor(() => expect(src(e)).not.toBe(PNG));
    expect(output()).toEqual([80, 40, 'image/png']);
    expect(calls.some((c) => c.method === 'putImageData')).toBe(true);
    // A resized image shows at its new size (no old scale).
    const image = e.view.state.doc.firstChild!.firstChild!;
    expect(image.attrs.width).toBeNull();
  });

  it('turning in the dialog clears the crop; Start over clears everything', async () => {
    const e = await mount();
    const { field, change, tool, dialog } = await openDialog(e);
    change(field('Crop', 'Shape'), '1');
    tool('Rotate right').click();
    expect(field('Crop', 'Width, px').value).toBe('20');
    expect(field('Crop', 'Height, px').value).toBe('40');
    tool('Flip vertically').click();
    dialog.querySelector<HTMLButtonElement>('.nova-editimage-tools .nova-button')!.click();
    expect(field('Crop', 'Width, px').value).toBe('40');
    expect(field('Crop', 'Shape').value).toBe('');
    dialog.requestSubmit();
    await vi.waitFor(() => expect(src(e)).not.toBe(PNG));
    expect(output()).toEqual([40, 20, 'image/png']);
  });
});
