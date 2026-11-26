/**
 * A mini helper for building DOM without innerHTML.
 * Texts always go through textContent: user data can't become markup.
 */
type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') {
      el.addEventListener(name.replace(/^on/, '').toLowerCase(), value);
    } else if (name === 'className') {
      el.className = String(value);
    } else {
      el.setAttribute(name, value === true ? '' : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** Icons are our own static SVG strings (not user data). */
export function icon(svg: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'nova-icon';
  span.innerHTML = svg;
  return span;
}

let uid = 0;
export function uniqueId(prefix = 'nova'): string {
  uid += 1;
  return `${prefix}-${uid}`;
}

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

/** 'Mod-Shift-b' → '⌘⇧B' on macOS, 'Ctrl+Shift+B' elsewhere. */
const ARROWS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

export function formatShortcut(shortcut: string): string {
  const parts = shortcut.split('-');
  const key = parts.pop()!;
  const keyLabel = key.length === 1 ? key.toUpperCase() : (ARROWS[key] ?? key);
  if (isMac) {
    const map: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' };
    return parts.map((p) => map[p] ?? p).join('') + keyLabel;
  }
  const map: Record<string, string> = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Ctrl: 'Ctrl' };
  return [...parts.map((p) => map[p] ?? p), keyLabel].join('+');
}

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ---------- Shadow DOM ----------
// The editor can live inside a shadow root (a customer's web component). There document.activeElement
// is the host, and listeners on document see the event target replaced by the host.

/** The focused element, minding shadow roots (context is any node of the editor). */
export function activeElement(context: Node): Element | null {
  const root = context.getRootNode() as Document | ShadowRoot;
  let active = ('activeElement' in root ? root.activeElement : null) ?? document.activeElement;
  // Focus inside a nested shadow root (for example, a web component inside the content).
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** The real target of an event, through an open shadow root too. */
export function eventTarget(event: Event): Node | null {
  return ((event.composedPath?.()[0] as Node | undefined) ?? event.target) as Node | null;
}

/**
 * Listens to an event on the whole document (a click outside a panel, focus leaving a dialog) with the real target.
 * If the editor is in a shadow root, the root itself is listened to as well: outside a closed root composedPath doesn't
 * see the inner nodes, so the root's listener handles such events.
 */
export function listenDocument<K extends keyof DocumentEventMap>(
  context: Node,
  type: K,
  handler: (event: DocumentEventMap[K], target: Node | null) => void,
): () => void {
  const root = context.getRootNode();
  const shadow = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : null;
  const onDocument = (event: DocumentEventMap[K]) => {
    if (shadow && event.composedPath().includes(shadow.host)) return;
    handler(event, eventTarget(event));
  };
  const onRoot = (event: Event) => handler(event as DocumentEventMap[K], eventTarget(event));
  document.addEventListener(type, onDocument, true);
  shadow?.addEventListener(type, onRoot, true);
  return () => {
    document.removeEventListener(type, onDocument, true);
    shadow?.removeEventListener(type, onRoot, true);
  };
}

// ---------- writing direction ----------

/**
 * A right-to-left interface: the nearest dir, on the editor (the direction option) or on the page.
 * By the attribute, not the computed style: works without layout (SSR, tests) and is cheap.
 */
export function isRtl(el: Element): boolean {
  return el.closest('[dir]')?.getAttribute('dir')?.toLowerCase() === 'rtl';
}

/**
 * A key adjusted for direction: in a right-to-left interface the "right" and "left" arrows swap
 * places, so focus follows the visual order (the first toolbar button is on the right there).
 */
export function logicalKey(event: KeyboardEvent, context: Element): string {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return event.key;
  if (!isRtl(context)) return event.key;
  return event.key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
}
