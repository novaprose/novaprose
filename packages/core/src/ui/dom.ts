/**
 * Мини-хелпер для построения DOM без innerHTML.
 * Тексты всегда идут через textContent — пользовательские данные не могут стать разметкой.
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

/** Иконки — это наши собственные статичные SVG-строки (не пользовательские данные). */
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

/** 'Mod-Shift-b' → '⌘⇧B' на macOS, 'Ctrl+Shift+B' на остальных. */
export function formatShortcut(shortcut: string): string {
  const parts = shortcut.split('-');
  const key = parts.pop()!;
  const keyLabel = key.length === 1 ? key.toUpperCase() : key;
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
// Редактор может жить внутри теневого корня (веб-компонент клиента). Там document.activeElement —
// это хост, а у слушателей на document цель события подменена хостом.

/** Элемент в фокусе с учётом теневых корней (context — любой узел редактора). */
export function activeElement(context: Node): Element | null {
  const root = context.getRootNode() as Document | ShadowRoot;
  let active = ('activeElement' in root ? root.activeElement : null) ?? document.activeElement;
  // Фокус во вложенном теневом корне (например, в веб-компоненте внутри содержимого).
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** Настоящая цель события — и сквозь открытый теневой корень. */
export function eventTarget(event: Event): Node | null {
  return ((event.composedPath?.()[0] as Node | undefined) ?? event.target) as Node | null;
}

/**
 * Слушать событие на всём документе (клик мимо панели, уход фокуса из диалога) с настоящей целью.
 * Если редактор в теневом корне, слушаем и сам корень: снаружи закрытого корня composedPath не
 * видит внутренних узлов — такие события обрабатывает слушатель корня.
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

// ---------- направление письма ----------

/**
 * Интерфейс справа налево: ближайший dir — у редактора (опция direction) или у страницы.
 * По атрибуту, а не по вычисленному стилю: работает и без вёрстки (SSR, тесты), и дёшево.
 */
export function isRtl(el: Element): boolean {
  return el.closest('[dir]')?.getAttribute('dir')?.toLowerCase() === 'rtl';
}

/**
 * Клавиша с учётом направления: в интерфейсе справа налево стрелки «вправо» и «влево» меняются
 * местами — фокус идёт по видимому порядку (первая кнопка тулбара там справа).
 */
export function logicalKey(event: KeyboardEvent, context: Element): string {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return event.key;
  if (!isRtl(context)) return event.key;
  return event.key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
}
