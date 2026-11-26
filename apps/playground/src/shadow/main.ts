import { createEditor, type Editor } from '@novaprose/core';
// ?inline — текст CSS для adoptedStyleSheets (путь к исходнику: псевдоним пакета не принимает запрос).
import css from '../../../../packages/core/src/style.css?inline';
import '../playground.css';

/**
 * Редактор внутри теневого корня — так его встраивают в свои веб-компоненты (Lit, Stencil,
 * дизайн-системы). Стили ядра подключаются в сам корень: стили страницы туда не проникают.
 * ?mode=closed — закрытый корень (снаружи его узлы не видны). Её гоняет e2e/shadow.spec.ts.
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
// Для тестов закрытого корня: снаружи до узлов добраться нельзя, ссылку отдаёт сам компонент.
w.shadow = app.root;
