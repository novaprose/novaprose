import { createEditor, registerLanguage, type Editor } from '@novaprose/core';
import '@novaprose/core/style.css';
import './playground.css';
import ru from '@novaprose/core/i18n/ru';

// Русский — пакет (в ядро не встроен): playground по умолчанию на русском.
registerLanguage('ru', ru);

/** Люди для «@» в песочнице (?comments=1). */
/** Версии для истории в песочнице (?comments=1). */
const REVISIONS: { id: string; createdAt: number; authors: string[]; html: string }[] = [];

const PEOPLE = [
  { id: 'u-boris', name: 'Boris Petrov', description: 'Engineering' },
  { id: 'u-carla', name: 'Carla Mendes', description: 'Design' },
  { id: 'u-dmitry', name: 'Dmitry Orlov', description: 'Head of Sales' },
];

const SAMPLE = `
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
`;

const STORAGE_KEY = 'nova-playground-content-v2';
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const output = $('#output');
const stats = $('#stats');
let tab: 'html' | 'json' = 'html';

const editor = createEditor({
  element: $('#editor'),
  content: localStorage.getItem(STORAGE_KEY) ?? SAMPLE.trim(),
  placeholder: 'Начните печатать…',
  // ?resize=1 | both — ручка размера в статусбаре; ?disabled=1 — отключённый редактор.
  ...(new URLSearchParams(location.search).has('resize')
    ? { resize: new URLSearchParams(location.search).get('resize') === 'both' ? 'both' : true }
    : {}),
  disabled: new URLSearchParams(location.search).has('disabled'),
  // ?mergetags=1 — переменные шаблона (их гоняет e2e/editor-options.spec.ts).
  ...(new URLSearchParams(location.search).has('mergetags')
    ? { toolbar: 'undo redo | mergetags | bold italic' }
    : {}),
  // ?styles=1 — меню «Стили» со своими форматами (классы + стили содержимого для них).
  ...(new URLSearchParams(location.search).has('styles')
    ? {
        toolbar: 'undo redo | styles | bold italic | link image',
        styleFormats: [
          {
            title: 'Оформление',
            items: [
              { title: 'Вводный абзац', block: 'p', classes: 'lead' },
              { title: 'Примечание', block: 'p', classes: 'note' },
              { title: 'Цитата-выноска', block: 'blockquote', classes: 'pull' },
            ],
          },
          {
            title: 'Текст',
            items: [
              { title: 'Маркер', inline: 'span', classes: 'marker' },
              { title: 'Красный', inline: 'span', styles: { color: '#d1242f' } },
            ],
          },
          { title: 'Картинка слева', selector: 'img', classes: 'float-left' },
        ],
        contentStyle: [
          '.lead { font-size: 1.2em; color: #57606a; }',
          '.note { padding: 8px 12px; border-left: 3px solid #0969da; background: rgba(9,105,218,.08); }',
          '.pull { font-size: 1.3em; font-style: italic; }',
          '.marker { background: #fff8c5; }',
          '.float-left { float: left; margin: 0 12px 8px 0; }',
        ].join('\n'),
      }
    : {}),
  // ?contentcss=1 — стили содержимого из файла (+ @import) и строкой (их гоняет e2e/editor-options.spec.ts).
  ...(new URLSearchParams(location.search).has('contentcss')
    ? { contentCss: '/test-css/content.css', contentStyle: 'h2 { color: rgb(0, 128, 0) }' }
    : {}),
  // ?picker=1 — «Обзор» в диалогах ссылки/картинки/видео (имитация своего менеджера файлов).
  ...(new URLSearchParams(location.search).has('picker')
    ? {
        filePicker: async ({ type }: { type: string }) =>
          type === 'image'
            ? { url: 'https://picsum.photos/seed/nova/640/360', alt: 'Пример картинки' }
            : { url: 'https://example.com/report.pdf', text: 'Отчёт.pdf', title: 'PDF, 2 МБ' },
      }
    : {}),
  // Встроенный плагин — грузится лениво отдельным чанком.
  // ?parity=1 — плагины паритета с TinyMCE (их гоняет e2e/plugins-parity.spec.ts).
  plugins: [
    'insertdatetime',
    'quickbars',
    ...(new URLSearchParams(location.search).has('mergetags') ? ['mergetags'] : []),
    ...(new URLSearchParams(location.search).has('parity')
      ? [
          'charmap',
          'emoticons',
          'nonbreaking',
          'autolink',
          'autosave',
          'visualblocks',
          'anchor',
          'pagebreak',
          'media',
          'directionality',
          'advlist',
          'checklist',
          'codesample',
          'draghandle',
        ]
      : []),
    // ?comments=1 — комментарии к тексту (их гоняет e2e/comments.spec.ts).
    // Вместе с ними — упоминания «@» (в тексте и в комментариях), люди — из PEOPLE ниже.
    ...(new URLSearchParams(location.search).has('comments')
      ? ['comments', 'mentions', 'revisionhistory', 'suggestions']
      : []),
  ],
  pluginOptions: {
    mergetags: {
      list: [
        {
          title: 'Клиент',
          items: [
            { key: 'client', label: 'Имя клиента' },
            { key: 'phone', label: 'Телефон' },
          ],
        },
        { title: 'Заказ', items: [{ key: 'orderId', label: 'Номер заказа' }] },
      ],
    },
    comments: { author: { id: 'anna', name: 'Anna' } },
    suggestions: { author: { id: 'anna', name: 'Anna' } },
    // История версий без сервера: версии в памяти страницы («Сохранить версию» — снимок HTML).
    revisionhistory: {
      list: async () => REVISIONS.map(({ html: _html, ...revision }) => revision),
      load: async (revision: { id: string }) => REVISIONS.find((r) => r.id === revision.id)!.html,
      save: async () => {
        REVISIONS.push({
          id: String(REVISIONS.length + 1),
          createdAt: Date.now(),
          authors: ['Anna'],
          html: editor.getHTML(),
        });
      },
    },
    // Имитация поиска людей на сервере (с задержкой, как настоящий запрос).
    mentions: {
      fetch: (query: string) =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                PEOPLE.filter((p) =>
                  p.name
                    .toLowerCase()
                    .split(' ')
                    .some((w) => w.startsWith(query.toLowerCase())),
                ),
              ),
            50,
          ),
        ),
    },
  },
  // Режимы и менюбар: ?mode=inline | distraction-free, ?menubar=1
  mode: (new URLSearchParams(location.search).get('mode') ?? 'classic') as
    'classic' | 'inline' | 'distraction-free',
  menubar: new URLSearchParams(location.search).has('menubar'),
  // Ограничения контента для ручной проверки: ?invalid=h1,table&styles=color
  ...(new URLSearchParams(location.search).has('invalid')
    ? { invalidElements: new URLSearchParams(location.search).get('invalid')! }
    : {}),
  ...(new URLSearchParams(location.search).has('styles')
    ? { validStyles: new URLSearchParams(location.search).get('styles')! }
    : {}),
  language: new URLSearchParams(location.search).get('lang') ?? 'ru',
  // ?dir=rtl — интерфейс и текст справа налево (для ?lang=he|ar включается сам).
  ...(new URLSearchParams(location.search).get('dir') === 'rtl'
    ? { direction: 'rtl' as const }
    : {}),
  // Имитация загрузки на сервер: ?upload=slow — с задержкой, ?upload=fail — с ошибкой.
  ...(new URLSearchParams(location.search).has('upload')
    ? {
        uploadImage: (file: File, progress: (p: number) => void) =>
          new Promise<string>((resolve, reject) => {
            const mode = new URLSearchParams(location.search).get('upload');
            let p = 0;
            const timer = setInterval(() => progress((p = Math.min(100, p + 20))), 300);
            setTimeout(() => {
              clearInterval(timer);
              if (mode === 'fail') reject(new Error('Сервер недоступен'));
              else {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.readAsDataURL(file);
              }
            }, 1600);
          }),
      }
    : {}),
  onChange: (e) => {
    localStorage.setItem(STORAGE_KEY, e.getHTML());
    render(e);
  },
});

function render(e: Editor) {
  output.textContent =
    tab === 'html' ? formatHTML(e.getHTML()) : JSON.stringify(e.getJSON(), null, 2);
  const text = e.getText().trim();
  const words = text ? text.split(/\s+/).length : 0;
  stats.textContent = `Слов: ${words} · Символов: ${text.length}`;
}

function formatHTML(html: string): string {
  return html.replace(/(<\/(p|h\d|li|ul|ol|blockquote|pre)>|<hr>)/g, '$1\n').trim();
}

$<HTMLInputElement>('#readonly').addEventListener('change', (ev) => {
  editor.setEditable(!(ev.target as HTMLInputElement).checked);
});

$<HTMLSelectElement>('#theme').addEventListener('change', (ev) => {
  const value = (ev.target as HTMLSelectElement).value;
  if (value === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
});

$('#reset').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  editor.setContent(SAMPLE.trim());
});

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    tab = button.dataset.tab as 'html' | 'json';
    document
      .querySelectorAll('[data-tab]')
      .forEach((b) => b.setAttribute('aria-selected', String(b === button)));
    render(editor);
  });
});

render(editor);

// Для отладки из консоли браузера: window.editor
(window as unknown as { editor: Editor }).editor = editor;
