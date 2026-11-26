import { a as e } from './style.jq9nI6HT.js';
var t = document.getElementById(`np-demo-editor`),
  n = document.getElementById(`np-demo-html`),
  r = t.innerHTML;
(t.replaceChildren(),
  (n.textContent = e({
    element: t,
    content: r,
    language: t.dataset.lang === `ru` ? `ru` : `en`,
    placeholder: `Start typing…`,
    plugins: [`insertdatetime`, `quickbars`],
    onChange: (e) => (n.textContent = e.getHTML()),
  }).getHTML()));
