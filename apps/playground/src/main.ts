import { createEditor, registerLanguage, type Editor } from '@novaprose/core';
import type { AiRequest } from '../../../packages/core/src/plugins/ai';
import '@novaprose/core/style.css';
import './playground.css';
import ru from '@novaprose/core/i18n/ru';

// Language packs aren't built into the core: ?lang=ru checks the Russian translation.
registerLanguage('ru', ru);

/** People for "@" in the playground (?comments=1). */
/** Versions for the history in the playground (?comments=1). */
const REVISIONS: { id: string; createdAt: number; authors: string[]; html: string }[] = [];

const PEOPLE = [
  { id: 'u-boris', name: 'Boris Petrov', description: 'Engineering' },
  { id: 'u-carla', name: 'Carla Mendes', description: 'Design' },
  { id: 'u-dmitry', name: 'Dmitry Orlov', description: 'Head of Sales' },
];

const SAMPLE = `
<h1>Welcome to NovaProse</h1>
<p>This is the <strong>playground</strong> of the editor core on <em>ProseMirror</em>. Try:</p>
<ul>
  <li><p>Markdown shortcuts: <code>#</code> + space, <code>-</code> + space, <code>1.</code> + space, <code>&gt;</code> + space, <code>\`\`\`</code></p></li>
  <li><p>Keyboard shortcuts: Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Z / Ctrl+Y, Tab in a list</p></li>
  <li><p>Pasting from Word or Google Docs: see the HTML it produces on the right</p></li>
</ul>
<blockquote><p>Everything typed here goes through the same schema that produces the HTML on the right.</p></blockquote>
<p style="text-align: center;">Centered text, <span style="color: #1d4ed8;">text color</span>, <span style="background-color: #fef08a;">highlight</span> and <span style="font-family: Georgia, serif;">another font</span>.</p>
<p>Put the cursor into <a href="https://prosemirror.net">this link</a> and a bubble appears. Ctrl+K inserts a link, Alt+F10 moves to the toolbar.</p>
<pre><code class="language-ts">const editor = createEditor({ element, content: '&lt;p&gt;Hello&lt;/p&gt;' });</code></pre>
`;

const STORAGE_KEY = 'nova-playground-content-v2';
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const output = $('#output');
const stats = $('#stats');
let tab: 'html' | 'json' = 'html';

/**
 * An offline demo AI model: predictable edits (e2e checks them), the answer streams word by word.
 * In a real application the request goes to your server, and from there to the model (see the "AI assistant" guide).
 */
async function* demoModel(request: AiRequest): AsyncGenerator<string> {
  const rewrite: Record<string, (text: string) => string> = {
    shorter: (t) => t.replace(/\b(very|really|just|quite|actually)\s+/gi, ''),
    fix: (t) => t.replace(/\bteh\b/g, 'the').replace(/ {2,}/g, ' '),
    improve: (t) => t.replace(/\bgood\b/g, 'excellent'),
    formal: (t) => t.replace(/\bhi\b/gi, 'Hello'),
  };
  const result =
    request.action === 'continue'
      ? 'This sentence was written by the demo model.'
      : request.action === 'summarize'
        ? 'A short summary from the demo model.'
        : request.action === 'custom' && !request.text
          ? // A custom request at the cursor gets a long answer (several seconds of streaming): e2e cancels it midway.
            'Once upon a time, the demo model told a story. '.repeat(40)
          : (rewrite[request.action] ?? ((t: string) => t))(request.text);
  for (const word of result.split(/(?<= )/)) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (request.signal.aborted) return;
    yield word;
  }
}

const editor = createEditor({
  element: $('#editor'),
  content: localStorage.getItem(STORAGE_KEY) ?? SAMPLE.trim(),
  placeholder: 'Start typing…',
  // ?resize=1 | both: a resize handle in the statusbar; ?disabled=1: a disabled editor.
  ...(new URLSearchParams(location.search).has('resize')
    ? { resize: new URLSearchParams(location.search).get('resize') === 'both' ? 'both' : true }
    : {}),
  disabled: new URLSearchParams(location.search).has('disabled'),
  // ?mergetags=1: template variables (e2e/editor-options.spec.ts drives them).
  ...(new URLSearchParams(location.search).has('mergetags')
    ? { toolbar: 'undo redo | mergetags | bold italic' }
    : {}),
  // ?styles=1: the "Styles" menu with custom formats (classes + content styles for them).
  ...(new URLSearchParams(location.search).has('styles')
    ? {
        toolbar: 'undo redo | styles | bold italic | link image',
        styleFormats: [
          {
            title: 'Layout',
            items: [
              { title: 'Lead paragraph', block: 'p', classes: 'lead' },
              { title: 'Note', block: 'p', classes: 'note' },
              { title: 'Pull quote', block: 'blockquote', classes: 'pull' },
            ],
          },
          {
            title: 'Text',
            items: [
              { title: 'Marker', inline: 'span', classes: 'marker' },
              { title: 'Red', inline: 'span', styles: { color: '#d1242f' } },
            ],
          },
          { title: 'Image left', selector: 'img', classes: 'float-left' },
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
  // ?contentcss=1: content styles from a file (+ @import) and as a string (e2e/editor-options.spec.ts drives them).
  ...(new URLSearchParams(location.search).has('contentcss')
    ? { contentCss: '/test-css/content.css', contentStyle: 'h2 { color: rgb(0, 128, 0) }' }
    : {}),
  // ?picker=1: "Browse" in the link/image/video dialogs (imitating your own file manager).
  ...(new URLSearchParams(location.search).has('picker')
    ? {
        filePicker: async ({ type }: { type: string }) =>
          type === 'image'
            ? { url: 'https://picsum.photos/seed/nova/640/360', alt: 'A sample image' }
            : { url: 'https://example.com/report.pdf', text: 'Report.pdf', title: 'PDF, 2 MB' },
      }
    : {}),
  // A built-in plugin: it loads lazily as a separate chunk.
  // ?parity=1: the parity plugins (e2e/plugins-parity.spec.ts drives them).
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
          'accordion',
          'tableofcontents',
          'math',
        ]
      : []),
    // ?comments=1: comments on the text (e2e/comments.spec.ts drives them).
    // Together with them, "@" mentions (in the text and in comments), people from PEOPLE below.
    ...(new URLSearchParams(location.search).has('comments')
      ? ['comments', 'mentions', 'revisionhistory', 'suggestions']
      : []),
    // ?ai=1: the AI assistant with an offline demo model (e2e/ai.spec.ts); edits arrive as suggestions.
    ...(new URLSearchParams(location.search).has('ai')
      ? [...(new URLSearchParams(location.search).has('comments') ? [] : ['suggestions']), 'ai']
      : []),
  ],
  pluginOptions: {
    ai: { request: demoModel },
    mergetags: {
      list: [
        {
          title: 'Client',
          items: [
            { key: 'client', label: 'Client name' },
            { key: 'phone', label: 'Phone' },
          ],
        },
        { title: 'Order', items: [{ key: 'orderId', label: 'Order number' }] },
      ],
    },
    comments: { author: { id: 'anna', name: 'Anna' } },
    suggestions: { author: { id: 'anna', name: 'Anna' } },
    // Version history without a server: versions in the page's memory ("Save version" takes an HTML snapshot).
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
    // Imitates searching for people on a server (with a delay, like a real request).
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
  // Modes and the menubar: ?mode=inline | distraction-free, ?menubar=1
  mode: (new URLSearchParams(location.search).get('mode') ?? 'classic') as
    'classic' | 'inline' | 'distraction-free',
  menubar: new URLSearchParams(location.search).has('menubar'),
  // Content restrictions for manual checks: ?invalid=h1,table&styles=color
  ...(new URLSearchParams(location.search).has('invalid')
    ? { invalidElements: new URLSearchParams(location.search).get('invalid')! }
    : {}),
  ...(new URLSearchParams(location.search).has('styles')
    ? { validStyles: new URLSearchParams(location.search).get('styles')! }
    : {}),
  language: new URLSearchParams(location.search).get('lang') ?? 'en',
  // ?dir=rtl: interface and text right to left (for ?lang=he|ar it turns on by itself).
  ...(new URLSearchParams(location.search).get('dir') === 'rtl'
    ? { direction: 'rtl' as const }
    : {}),
  // Imitates uploading to a server: ?upload=slow adds a delay, ?upload=fail an error.
  ...(new URLSearchParams(location.search).has('upload')
    ? {
        uploadImage: (file: File, progress: (p: number) => void) =>
          new Promise<string>((resolve, reject) => {
            const mode = new URLSearchParams(location.search).get('upload');
            let p = 0;
            const timer = setInterval(() => progress((p = Math.min(100, p + 20))), 300);
            setTimeout(() => {
              clearInterval(timer);
              if (mode === 'fail') reject(new Error('The server is unavailable'));
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
  stats.textContent = `Words: ${words} · Characters: ${text.length}`;
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

// For debugging from the browser console: window.editor
(window as unknown as { editor: Editor }).editor = editor;
