import { c as p } from './playground-Cc_LhchD.js';
const i = `
<h1>Добро пожаловать в NovaProse</h1>
<p>Это <strong>playground</strong> ядра редактора на <em>ProseMirror</em>. Попробуйте:</p>
<ul>
  <li><p>Markdown-шорткаты: <code>#</code> + пробел, <code>-</code> + пробел, <code>1.</code> + пробел, <code>&gt;</code> + пробел, <code>\`\`\`</code></p></li>
  <li><p>Горячие клавиши: Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Z / Ctrl+Y, Tab в списке</p></li>
  <li><p>Вставку из Word или Google Docs — посмотрите, какой HTML получится справа</p></li>
</ul>
<blockquote><p>Цель этапа 1 — чтобы этот редактор был не хуже ядра TinyMCE.</p></blockquote>
<p style="text-align: center;">Выравнивание по центру, <span style="color: #1d4ed8;">цвет текста</span>, <span style="background-color: #fef08a;">маркер</span> и <span style="font-family: Georgia, serif;">другой шрифт</span>.</p>
<p>Поставьте курсор в <a href="https://prosemirror.net">эту ссылку</a> — появится панель. Ctrl+K — вставить ссылку, Alt+F10 — перейти на тулбар.</p>
<pre><code class="language-ts">const editor = createEditor({ element, content: '&lt;p&gt;Привет&lt;/p&gt;' });</code></pre>
`,
  l = 'nova-playground-content-v2',
  a = (e) => document.querySelector(e),
  u = a('#output'),
  S = a('#stats');
let d = 'html';
const o = p({
  element: a('#editor'),
  content: localStorage.getItem(l) ?? i.trim(),
  placeholder: 'Начните печатать…',
  plugins: ['insertdatetime', 'quickbars'],
  mode: new URLSearchParams(location.search).get('mode') ?? 'classic',
  menubar: new URLSearchParams(location.search).has('menubar'),
  ...(new URLSearchParams(location.search).has('invalid')
    ? { invalidElements: new URLSearchParams(location.search).get('invalid') }
    : {}),
  ...(new URLSearchParams(location.search).has('styles')
    ? { validStyles: new URLSearchParams(location.search).get('styles') }
    : {}),
  language: new URLSearchParams(location.search).get('lang') ?? 'ru',
  ...(new URLSearchParams(location.search).has('upload')
    ? {
        uploadImage: (e, t) =>
          new Promise((r, m) => {
            const h = new URLSearchParams(location.search).get('upload');
            let s = 0;
            const g = setInterval(() => t((s = Math.min(100, s + 20))), 300);
            setTimeout(() => {
              if ((clearInterval(g), h === 'fail')) m(new Error('Сервер недоступен'));
              else {
                const n = new FileReader();
                ((n.onload = () => r(String(n.result))), n.readAsDataURL(e));
              }
            }, 1600);
          }),
      }
    : {}),
  onChange: (e) => {
    (localStorage.setItem(l, e.getHTML()), c(e));
  },
});
function c(e) {
  u.textContent = d === 'html' ? L(e.getHTML()) : JSON.stringify(e.getJSON(), null, 2);
  const t = e.getText().trim(),
    r = t ? t.split(/\s+/).length : 0;
  S.textContent = `Слов: ${r} · Символов: ${t.length}`;
}
function L(e) {
  return e
    .replace(
      /(<\/(p|h\d|li|ul|ol|blockquote|pre)>|<hr>)/g,
      `$1
`,
    )
    .trim();
}
a('#readonly').addEventListener('change', (e) => {
  o.setEditable(!e.target.checked);
});
a('#theme').addEventListener('change', (e) => {
  const t = e.target.value;
  t === 'auto'
    ? delete document.documentElement.dataset.theme
    : (document.documentElement.dataset.theme = t);
});
a('#reset').addEventListener('click', () => {
  (localStorage.removeItem(l), o.setContent(i.trim()));
});
document.querySelectorAll('[data-tab]').forEach((e) => {
  e.addEventListener('click', () => {
    ((d = e.dataset.tab),
      document
        .querySelectorAll('[data-tab]')
        .forEach((t) => t.setAttribute('aria-selected', String(t === e))),
      c(o));
  });
});
c(o);
window.editor = o;
