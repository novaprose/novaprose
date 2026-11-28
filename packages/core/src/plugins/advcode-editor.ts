import { html } from '@codemirror/lang-html';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { openSearchPanel } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import type { Editor } from '../editor';
import { setSourceHTML, sourceHTML } from '../page';
import { prettyHTML } from '../pretty-html';
import { h, icon } from '../ui/dom';
import { icons } from '../ui/icons';
import { formatHTML } from '../ui/views';
import type { AdvCodeLabels, AdvCodeOptions } from './advcode';
import css from './advcode.css?raw';

/**
 * The code editor of the advcode plugin: CodeMirror in the Source code dialog. A separate chunk,
 * loaded when it is first opened.
 */

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const SMALLER = svg('<path d="M3 18 8 6l5 12"/><path d="M4.6 14h6.8"/><path d="M16 12h6"/>');
const LARGER = svg(
  '<path d="M3 18 8 6l5 12"/><path d="M4.6 14h6.8"/><path d="M16 12h6"/><path d="M19 9v6"/>',
);
const WRAP = svg(
  '<path d="M4 6h16"/><path d="M4 12h13a3 3 0 0 1 0 6h-5"/><path d="m14 16-2 2 2 2"/><path d="M4 18h4"/>',
);

/** Colors from the --nova-code-* tokens of advcode.css (contrast ≥ 4.5:1 in both themes). */
const highlight = HighlightStyle.define([
  { tag: [tags.tagName, tags.keyword], color: 'var(--nova-code-keyword)' },
  { tag: [tags.attributeName, tags.propertyName], color: 'var(--nova-code-attr)' },
  { tag: [tags.attributeValue, tags.string], color: 'var(--nova-code-string)' },
  { tag: tags.comment, color: 'var(--nova-code-comment)', fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.null, tags.unit], color: 'var(--nova-code-number)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--nova-code-function)',
  },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--nova-code-type)' },
  {
    tag: [tags.angleBracket, tags.processingInstruction, tags.documentMeta, tags.character],
    color: 'var(--nova-code-meta)',
  },
  { tag: tags.invalid, color: 'var(--nova-code-deleted)' },
]);

/** CodeMirror in the editor's tokens: the same colors in the light and dark themes. */
const theme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--nova-fg)',
    backgroundColor: 'var(--nova-code-bg)',
    fontSize: 'var(--nova-advcode-size, 14px)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--nova-mono)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--nova-fg)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--nova-fg)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'color-mix(in srgb, var(--nova-accent) 28%, transparent)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--nova-fg) 5%, transparent)' },
  '.cm-gutters': {
    backgroundColor: 'var(--nova-code-bg)',
    color: 'var(--nova-muted)',
    borderRight: '1px solid var(--nova-border)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--nova-fg)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--nova-hover)',
    border: '1px solid var(--nova-border)',
    color: 'var(--nova-muted)',
  },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--nova-accent) 18%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--nova-accent) 50%, transparent)',
  },
  '&.cm-focused .cm-nonmatchingBracket': { color: 'var(--nova-code-deleted)' },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in srgb, #e3b341 35%, transparent)',
    outline: '1px solid color-mix(in srgb, #e3b341 70%, transparent)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in srgb, var(--nova-accent) 35%, transparent)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'color-mix(in srgb, var(--nova-accent) 14%, transparent)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--nova-surface)',
    color: 'var(--nova-fg)',
  },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--nova-border)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--nova-border)' },
  '.cm-textfield': {
    backgroundColor: 'var(--nova-bg)',
    color: 'var(--nova-fg)',
    border: '1px solid var(--nova-border)',
    borderRadius: '4px',
  },
  '.cm-button': {
    backgroundColor: 'var(--nova-surface)',
    backgroundImage: 'none',
    color: 'var(--nova-fg)',
    border: '1px solid var(--nova-border)',
    borderRadius: '4px',
  },
  '.cm-panel button[name=close]': { color: 'var(--nova-muted)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--nova-surface)',
    color: 'var(--nova-fg)',
    border: '1px solid var(--nova-border)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--nova-accent-strong)',
    color: '#ffffff',
  },
  '.cm-completionDetail': { color: 'var(--nova-muted)' },
});

/** What this page's person chose last time (until the page closes). */
let lastSize: number | null = null;
let lastWrap: boolean | null = null;

const clampSize = (n: number) => Math.min(28, Math.max(10, Math.round(n)));

/** Where the block with the cursor starts in the laid-out code (its top-level blocks start at column 0). */
function blockStart(code: string, index: number): number {
  let count = -1;
  let offset = 0;
  for (const line of code.split('\n')) {
    if (/^<[a-zA-Z]/.test(line) && ++count === index) return offset;
    offset += line.length + 1;
  }
  return 0;
}

export function openCodeEditor(editor: Editor, labels: AdvCodeLabels): void {
  const options = (editor.options.pluginOptions?.advcode ?? {}) as AdvCodeOptions;
  const { t } = editor.ui;
  editor.ui.addStyles('nova-advcode', css);
  const prettify = options.prettify !== false;
  const source = sourceHTML(editor);
  const original = prettify ? prettyHTML(source) : formatHTML(source);
  let size = lastSize ?? clampSize(Number(options.fontSize) || 14);
  let wrapOn = lastWrap ?? options.wrap !== false;
  // The code editor opens where the cursor is in the text.
  const start = prettify ? blockStart(original, editor.view.state.selection.$from.index(0)) : 0;

  const wrap = new Compartment();
  const code = h('div', { className: 'nova-advcode-code' });
  code.style.setProperty('--nova-advcode-size', `${size}px`);
  let save = () => {};
  const view = new EditorView({
    parent: code,
    state: EditorState.create({
      doc: original,
      selection: { anchor: Math.min(start, original.length) },
      extensions: [
        basicSetup,
        html(),
        syntaxHighlighting(highlight),
        theme,
        wrap.of(wrapOn ? EditorView.lineWrapping : []),
        EditorView.contentAttributes.of({ 'aria-label': t('sourceCode') }),
        keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              save();
              return true;
            },
          },
        ]),
      ],
    }),
  });

  const button = (svgIcon: string, label: string, onClick: () => void, pressed?: boolean) => {
    const el = h(
      'button',
      {
        type: 'button',
        className: 'nova-btn',
        'aria-label': label,
        'data-tooltip': label,
        ...(pressed === undefined ? {} : { 'aria-pressed': String(pressed) }),
      },
      icon(svgIcon, editor.ui.registry),
    );
    el.addEventListener('click', onClick);
    editor.ui.tooltip.attach(el);
    return el;
  };
  const resize = (step: number) => {
    size = clampSize(size + step);
    lastSize = size;
    code.style.setProperty('--nova-advcode-size', `${size}px`);
    view.requestMeasure();
  };
  const wrapButton = button(
    WRAP,
    labels.wrap,
    () => {
      wrapOn = !wrapOn;
      lastWrap = wrapOn;
      wrapButton.setAttribute('aria-pressed', String(wrapOn));
      view.dispatch({ effects: wrap.reconfigure(wrapOn ? EditorView.lineWrapping : []) });
    },
    wrapOn,
  );
  let full = false;
  const fullButton = button(
    icons.fullscreen,
    labels.fullscreen,
    () => {
      full = !full;
      handle.el.classList.toggle('nova-advcode-full', full);
      fullButton.setAttribute('aria-pressed', String(full));
      fullButton.replaceChildren(
        icon(full ? icons.fullscreenExit : icons.fullscreen, editor.ui.registry),
      );
      view.requestMeasure();
      view.focus();
    },
    false,
  );
  const toolbar = h(
    'div',
    { className: 'nova-advcode-toolbar', role: 'toolbar', 'aria-label': t('sourceCode') },
    button(icons.search, labels.find, () => {
      openSearchPanel(view);
    }),
    h('span', { className: 'nova-bubble-sep', role: 'separator' }),
    button(SMALLER, labels.smaller, () => resize(-2)),
    button(LARGER, labels.larger, () => resize(2)),
    wrapButton,
    h('span', { className: 'nova-bubble-sep', role: 'separator' }),
    fullButton,
  );

  const handle = editor.ui.openDialog({
    title: t('sourceCode'),
    body: h('div', { className: 'nova-advcode' }, toolbar, code),
    size: 'large',
    submitLabel: t('dialog.save'),
    initialFocus: view.contentDOM,
    onSubmit: () => {
      const value = view.state.doc.toString();
      if (value !== original) setSourceHTML(editor, value);
      return true;
    },
    onClose: () => view.destroy(),
  });
  save = () => (handle.el as HTMLFormElement).requestSubmit();
  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' }),
  });
}
