import '@novaprose/core/style.css';
import '../playground.css';
import { tinymce } from '@novaprose/tinymce-compat';

/**
 * A TinyMCE-style configuration, as existing projects write it. Only the import changes.
 */
const events: string[] = [];
const log = (name: string) => {
  events.push(name);
  document.getElementById('events')!.textContent = events.slice(-6).join(', ');
};

tinymce.PluginManager.add('signature', (editor) => {
  editor.addCommand('insertSignature', () => editor.insertContent('<p>— The NovaProse team</p>'));
  editor.ui.registry.addButton('signature', {
    text: 'Signature',
    tooltip: 'Insert signature',
    onAction: () => editor.execCommand('insertSignature'),
  });
});

// A plugin with a dialog from a description (windowManager.open), the way custom TinyMCE plugins are written.
tinymce.PluginManager.add('callout', (editor) => {
  editor.ui.registry.addButton('callout', {
    text: 'Callout',
    tooltip: 'Insert callout',
    onAction: () =>
      editor.windowManager.open({
        title: 'Insert callout',
        body: {
          type: 'panel',
          items: [
            { type: 'input', name: 'text', label: 'Text' },
            {
              type: 'selectbox',
              name: 'kind',
              label: 'Kind',
              items: [
                { text: 'Note', value: 'Note' },
                { text: 'Warning', value: 'Warning' },
              ],
            },
          ],
        },
        initialData: { kind: 'Note' },
        buttons: [
          { type: 'cancel', text: 'Cancel' },
          { type: 'submit', text: 'Insert', primary: true },
        ],
        onSubmit: (api) => {
          const data = api.getData() as { text: string; kind: string };
          editor.insertContent(
            '<blockquote><p><strong>' +
              editor.dom.encode(data.kind) +
              ':</strong> ' +
              editor.dom.encode(data.text) +
              '</p></blockquote>',
          );
          api.close();
        },
      }),
  });
});

void tinymce.init({
  selector: '#body',
  plugins: 'lists link image table code charmap anchor signature callout',
  toolbar:
    'undo redo | blocks | bold italic underline | bullist numlist | link image table | charmap anchor | signature callout code',
  menubar: false,
  height: 320,
  placeholder: 'Write your release notes…',
  content_style: 'body { font-size: 16px; }',
  setup: (editor) => {
    editor.on('init', () => log('init'));
    editor.on('input', () => log('input'));
    editor.on('change', () => log('change'));
  },
  init_instance_callback: () => log('callback'),
});

document.getElementById('post-form')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.target as HTMLFormElement);
  document.getElementById('submitted')!.textContent = String(data.get('body'));
});

Object.assign(window, { tinymce });
