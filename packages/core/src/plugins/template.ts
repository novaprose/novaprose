import { DOMSerializer } from 'prosemirror-model';
import { htmlSerializer } from '../document';
import { parseContent, type Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h } from '../ui/dom';
import type { DialogApi } from '../ui/form-dialog-types';
import { icons } from '../ui/icons';
import css from './template.css?raw';
import { pickLabels } from './shared';

/**
 * The template plugin (named as in TinyMCE 5–6): "Insert template" lists your templates with their
 * description and a preview, and inserts the chosen one at the cursor. A template is HTML (`content`)
 * or a file with HTML (`url`); when it has a `div.mceTmpl`, only what is inside is inserted.
 * In a template:
 * - `{$name}` becomes `values.name` (as text; `previewValues` only in the preview);
 * - an element with the class `selcontent` gets the selected content;
 * - `cdate` and `mdate` elements get today's date (`creationDateFormat`, `modifiedDateFormat`:
 *   `%Y-%m-%d` by default; %d %m %y %Y %B %b %A %a %H %I %M %S %p %D %r %%).
 * Everything goes through the editor's schema, like a paste: no scripts, unsafe links or unknown tags.
 */

export const LABELS = {
  en: {
    title: 'Insert template',
    template: 'Template',
    preview: 'Preview',
    insert: 'Insert',
    empty: 'No templates',
    failed: 'Could not load the template',
  },
};

export interface Template {
  title: string;
  description?: string;
  /** The template's HTML. */
  content?: string;
  /** Or a file with it. */
  url?: string;
}

export interface TemplateOptions {
  /** The templates, a URL of a JSON list, or a function that returns them. */
  templates?: Template[] | string | (() => Template[] | Promise<Template[]>);
  /** `{$name}` → value, when a template is inserted (as text). */
  values?: Record<string, string>;
  /** `{$name}` → value in the preview only (falls back to `values`). */
  previewValues?: Record<string, string>;
  /** Classes of elements that get the selected content ('selcontent'). */
  selectedContentClasses?: string;
  /** Classes of elements that get today's date: 'cdate' and 'mdate'. */
  creationDateClasses?: string;
  modifiedDateClasses?: string;
  creationDateFormat?: string;
  modifiedDateFormat?: string;
}

/** A date in a TinyMCE-style format: '%Y-%m-%d', '%B %d, %Y'… */
export function formatDate(format: string, date: Date, locale?: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const name = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, options).format(date);
  const hours12 = date.getHours() % 12 || 12;
  const tokens: Record<string, () => string> = {
    Y: () => String(date.getFullYear()),
    y: () => pad(date.getFullYear() % 100),
    m: () => pad(date.getMonth() + 1),
    d: () => pad(date.getDate()),
    H: () => pad(date.getHours()),
    I: () => pad(hours12),
    M: () => pad(date.getMinutes()),
    S: () => pad(date.getSeconds()),
    p: () => (date.getHours() < 12 ? 'AM' : 'PM'),
    B: () => name({ month: 'long' }),
    b: () => name({ month: 'short' }),
    A: () => name({ weekday: 'long' }),
    a: () => name({ weekday: 'short' }),
    D: () => `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${pad(date.getFullYear() % 100)}`,
    r: () =>
      `${pad(hours12)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${date.getHours() < 12 ? 'AM' : 'PM'}`,
    '%': () => '%',
  };
  return format.replace(/%([YymdHIMSpBbAaDr%])/g, (_match, token: string) => tokens[token]!());
}

const escapeHTML = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** `{$name}` placeholders, with values as text. Unknown names stay as they are. */
export function replaceValues(html: string, values: Record<string, unknown> = {}): string {
  return html.replace(/\{\$([\w-]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) && values[name] != null ? escapeHTML(String(values[name])) : match,
  );
}

/** Class names of an option; anything that isn't a plain class name is ignored. */
const classList = (value: string | undefined, fallback: string) =>
  (value ?? fallback).split(/\s+/).filter((name) => /^-?[_a-zA-Z][\w-]*$/.test(name));

/** The HTML of a template ready to insert (or to preview). */
export function processTemplate(
  html: string,
  options: TemplateOptions & {
    selection?: string;
    date?: Date;
    locale?: string;
    preview?: boolean;
  },
): string {
  const values = options.preview ? { ...options.values, ...options.previewValues } : options.values;
  // A <template> is inert: nothing in it runs or loads.
  const template = document.createElement('template');
  template.innerHTML = replaceValues(html, values);
  const root = template.content;
  // Only what is inside div.mceTmpl is inserted; around it is for the preview.
  const wrapper = options.preview ? null : root.querySelector('.mceTmpl');
  const scope: ParentNode = wrapper ?? root;
  const date = options.date ?? new Date();
  const dates: [string[], string][] = [
    [classList(options.creationDateClasses, 'cdate'), options.creationDateFormat ?? '%Y-%m-%d'],
    [classList(options.modifiedDateClasses, 'mdate'), options.modifiedDateFormat ?? '%Y-%m-%d'],
  ];
  for (const [classes, format] of dates) {
    for (const name of classes) {
      for (const el of scope.querySelectorAll(`.${name}`)) {
        el.textContent = formatDate(format, date, options.locale);
      }
    }
  }
  if (options.selection !== undefined) {
    for (const name of classList(options.selectedContentClasses, 'selcontent')) {
      for (const el of scope.querySelectorAll(`.${name}`)) {
        const selected = document.createElement('template');
        selected.innerHTML = options.selection;
        el.replaceChildren(selected.content);
      }
    }
  }
  const holder = document.createElement('div');
  holder.append(...(wrapper ? [...wrapper.childNodes] : [...root.childNodes]));
  return holder.innerHTML;
}

const optionsOf = (editor: Editor) =>
  (editor.options.pluginOptions?.template ?? {}) as TemplateOptions;

async function loadTemplates(editor: Editor): Promise<Template[]> {
  const source = optionsOf(editor).templates;
  if (!source) return [];
  if (typeof source === 'function') return (await source()) ?? [];
  if (typeof source === 'string') {
    const response = await fetch(new URL(source, document.baseURI));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as Template[];
  }
  return source;
}

const contents = new WeakMap<Template, Promise<string>>();

/** A template's HTML: its content, or its file (loaded once). */
function contentOf(template: Template): Promise<string> {
  if (typeof template.content === 'string') return Promise.resolve(template.content);
  let loading = contents.get(template);
  if (!loading) {
    loading = template.url
      ? fetch(new URL(template.url, document.baseURI)).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
      : Promise.resolve('');
    contents.set(template, loading);
  }
  return loading;
}

/** The selected content as HTML (for `selcontent`). */
function selectionHTML(editor: Editor): string {
  const { selection } = editor.view.state;
  if (selection.empty) return '';
  const slice = selection.content();
  // Text inside one paragraph: its words, not the paragraph (a paragraph in a paragraph would split).
  const only = slice.content.childCount === 1 ? slice.content.firstChild : null;
  const fragment = only?.isTextblock && slice.openStart > 0 ? only.content : slice.content;
  return htmlSerializer.serializeFragment(fragment);
}

/** Inserts template HTML at the cursor: values, dates and the selection filled in. */
export function insertTemplate(editor: Editor, html: string): void {
  const options = optionsOf(editor);
  editor.insertContent(
    processTemplate(html, {
      ...options,
      selection: selectionHTML(editor),
      locale: editor.options.language,
    }),
  );
}

async function openTemplates(editor: Editor): Promise<void> {
  const labels = pickLabels(editor, 'template', LABELS);
  editor.ui.addStyles('nova-template', css);
  let templates: Template[] = [];
  try {
    templates = await loadTemplates(editor);
  } catch (error) {
    console.warn('[nova] template: could not load the list', error);
  }
  const description = h('p', { className: 'nova-template-description' });
  const preview = h('div', {
    className: 'nova-prosemirror nova-preview nova-template-preview',
    role: 'region',
    'aria-label': labels.preview,
    tabindex: '0',
  });
  let shown = 0;
  /** Shows a template's description and preview (only the latest request wins). */
  const show = async (index: number, api?: DialogApi) => {
    shown = index;
    const template = templates[index];
    description.textContent = template?.description ?? '';
    preview.replaceChildren();
    if (!template) return;
    try {
      const html = await contentOf(template);
      if (shown !== index) return;
      const doc = parseContent(
        editor.schema,
        processTemplate(html, {
          ...optionsOf(editor),
          preview: true,
          locale: editor.options.language,
        }),
      );
      preview.append(DOMSerializer.fromSchema(editor.schema).serializeFragment(doc.content));
      api?.setError(null);
    } catch {
      if (shown === index) api?.setError(labels.failed);
    }
  };
  const data = await editor.ui.dialog({
    title: labels.title,
    size: 'large',
    submitLabel: labels.insert,
    fields: templates.length
      ? [
          {
            type: 'select',
            name: 'template',
            label: labels.template,
            options: templates.map((template, index) => ({
              value: String(index),
              label: String(template.title ?? ''),
            })),
          },
          {
            type: 'custom',
            render: (api) => {
              void show(0, api);
              return h('div', { className: 'nova-template-details' }, description, preview);
            },
          },
        ]
      : [{ type: 'message', text: labels.empty }],
    initialData: { template: '0' },
    onChange: (values, { name }, api) => {
      if (name === 'template') void show(Number(values.template), api);
    },
    onSubmit: async (values, api) => {
      const template = templates[Number(values.template)];
      if (!template) return false;
      try {
        insertTemplate(editor, await contentOf(template));
      } catch {
        api.setError(labels.failed);
        return false;
      }
    },
  });
  if (!data) editor.focus();
}

export default definePlugin({
  name: 'template',
  toolbar: 'template',
  setup(editor) {
    const labels = pickLabels(editor, 'template', LABELS);
    const open = (e: Editor) => void openTemplates(e);
    editor.ui.registry.addButton('template', {
      icon: icons.template,
      tooltip: labels.title,
      isEnabled: (e) => e.isEditable(),
      onAction: open,
    });
    editor.ui.registry.addMenuItem('template', {
      text: labels.title,
      icon: icons.template,
      isEnabled: (e) => e.isEditable(),
      onAction: open,
    });
    // tinymce.init: mceInsertTemplate inserts template HTML the way the dialog does.
    const onInsert = (event: Event) =>
      insertTemplate(editor, String((event as CustomEvent).detail));
    editor.root.addEventListener('nova-insert-template', onInsert);
    return () => editor.root.removeEventListener('nova-insert-template', onInsert);
  },
});
