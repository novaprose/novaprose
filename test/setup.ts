/**
 * jsdom doesn't compute layout, and ProseMirror asks for coordinates when scrolling to the selection.
 * The stubs are only for unit tests; real behavior is checked in the browser e2e tests (Playwright).
 */
// Tests in the node environment (SSR) have no DOM and need no stubs.
if (typeof window !== 'undefined') installDomStubs();

function installDomStubs(): void {
  const emptyRect = (): DOMRect =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  const emptyRectList = (): DOMRectList =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList;

  for (const proto of [Range.prototype, Element.prototype, Text.prototype] as Array<
    Record<string, unknown>
  >) {
    proto.getClientRects ??= emptyRectList;
    proto.getBoundingClientRect ??= emptyRect;
  }

  Element.prototype.scrollIntoView ??= () => {};

  // jsdom doesn't implement ClipboardEvent; ProseMirror creates one in view.pasteHTML().
  if (typeof globalThis.ClipboardEvent === 'undefined') {
    class ClipboardEventStub extends Event {
      readonly clipboardData: DataTransfer | null;
      constructor(type: string, init: ClipboardEventInit = {}) {
        super(type, init);
        this.clipboardData = init.clipboardData ?? null;
      }
    }
    (globalThis as unknown as { ClipboardEvent: unknown }).ClipboardEvent = ClipboardEventStub;
  }
}

// Node 26 declares its own localStorage (unusable without a storage file), and it shadows jsdom's.
// Tests get a simple in-memory storage.
if (typeof window !== 'undefined') {
  let works = false;
  try {
    window.localStorage.setItem('__nova_probe', '1');
    window.localStorage.removeItem('__nova_probe');
    works = true;
  } catch {
    works = false;
  }
  if (!works) {
    const data = new Map<string, string>();
    const memory: Storage = {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      getItem: (key) => data.get(key) ?? null,
      key: (index) => [...data.keys()][index] ?? null,
      removeItem: (key) => void data.delete(key),
      setItem: (key, value) => void data.set(key, String(value)),
    };
    Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });
    Object.defineProperty(window, 'localStorage', { value: memory, configurable: true });
  }
}
