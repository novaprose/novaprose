import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { classAttr, imageSize } from '../schema';
import { isSafeImageUrl } from '../url';

const MIN_WIDTH = 24;
type Corner = 'nw' | 'ne' | 'sw' | 'se';

/**
 * The image view in the editor: a wrapper + resize handles in the corners (visible while the image is selected).
 * Resizing keeps the proportions and works with a mouse or a finger (Pointer Events). The wrapper doesn't
 * reach the HTML output: serialization follows the schema's toDOM.
 */
export class ImageView implements NodeView {
  readonly dom: HTMLSpanElement;
  private readonly img: HTMLImageElement;
  private node: PMNode;
  private resizing = false;

  constructor(
    node: PMNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly editor: Editor,
  ) {
    this.node = node;
    this.dom = document.createElement('span');
    this.dom.className = 'nova-image';
    this.img = document.createElement('img');
    this.img.draggable = false;
    this.dom.append(this.img);

    for (const corner of ['nw', 'ne', 'sw', 'se'] as Corner[]) {
      const handle = document.createElement('span');
      handle.className = `nova-image-handle nova-image-handle-${corner}`;
      handle.dataset.corner = corner;
      handle.addEventListener('pointerdown', (event) => this.startResize(event, corner));
      this.dom.append(handle);
    }
    this.render();
  }

  private render(): void {
    const { src, alt, title, width, height, align } = this.node.attrs;
    const safeSrc = isSafeImageUrl(src) ? src : '';
    if (this.img.getAttribute('src') !== safeSrc) this.img.setAttribute('src', safeSrc);
    this.setAttr('alt', alt);
    this.setAttr('title', title);
    this.setAttr('class', classAttr(this.node.attrs.class).class ?? null);
    const w = imageSize(width);
    const h = imageSize(height);
    this.img.style.width = w ? `${w}px` : '';
    // The height isn't fixed: with max-width: 100% the image must shrink proportionally.
    this.img.style.aspectRatio = w && h ? `${w} / ${h}` : '';
    this.dom.dataset.align = align ?? '';
  }

  private setAttr(name: string, value: string | null): void {
    if (value) this.img.setAttribute(name, value);
    else this.img.removeAttribute(name);
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.resizing) this.render();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('is-selected');
  }

  deselectNode(): void {
    this.dom.classList.remove('is-selected');
  }

  /** The handles are ours; ProseMirror must not handle events on them. */
  stopEvent(event: Event): boolean {
    return (event.target as HTMLElement).classList?.contains('nova-image-handle') ?? false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  private startResize(event: PointerEvent, corner: Corner): void {
    if (!this.editor.isEditable()) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const rect = this.img.getBoundingClientRect();
    const startX = event.clientX;
    const startWidth = rect.width;
    const ratio =
      rect.width > 0
        ? rect.height / rect.width
        : this.img.naturalHeight / (this.img.naturalWidth || 1);
    const maxWidth = Math.max(MIN_WIDTH, this.view.dom.clientWidth - 40);
    const direction = corner === 'ne' || corner === 'se' ? 1 : -1;
    let width = startWidth;
    this.resizing = true;
    this.dom.classList.add('is-resizing');

    const onMove = (e: PointerEvent) => {
      width = Math.round(
        Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + direction * (e.clientX - startX))),
      );
      this.img.style.width = `${width}px`;
      this.dom.dataset.size = `${width} × ${Math.round(width * ratio)}`;
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      this.resizing = false;
      this.dom.classList.remove('is-resizing');
      delete this.dom.dataset.size;
      const pos = this.getPos();
      if (pos === undefined || Math.abs(width - startWidth) < 1) return this.render();
      const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        width,
        height: Math.round(width * ratio),
      });
      // The image stays selected, so you can keep resizing or open the toolbar.
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      this.view.dispatch(tr);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }
}
