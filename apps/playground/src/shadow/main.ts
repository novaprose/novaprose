import { createEditor, type Editor } from '@novaprose/core';
// ?inline gives the CSS text for adoptedStyleSheets (a path to the source: the package alias doesn't accept a query).
import css from '../../../../packages/core/src/style.css?inline';
import '../playground.css';

/**
 * An editor inside a shadow root, the way it is embedded into custom web components (Lit, Stencil,
 * design systems). The core styles attach to the root itself: page styles don't reach inside it.
 * ?mode=closed gives a closed root (its nodes aren't visible from outside). e2e/shadow.spec.ts drives it.
 */
const mode = new URLSearchParams(location.search).get('mode') === 'closed' ? 'closed' : 'open';

class MyApp extends HTMLElement {
  editor?: Editor;
  root?: ShadowRoot;

  connectedCallback() {
    const root = this.attachShadow({ mode });
    this.root = root;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
    const element = document.createElement('div');
    root.append(element);
    this.editor = createEditor({
      element,
      menubar: true,
      content: '<p>Hello shadow world</p>',
    });
  }
}
customElements.define('my-app', MyApp);

const app = document.querySelector<MyApp>('my-app')!;
const w = window as unknown as { editor?: Editor; shadow?: ShadowRoot };
w.editor = app.editor;
// For closed-root tests: the nodes can't be reached from outside, so the component hands out the reference itself.
w.shadow = app.root;
