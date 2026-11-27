import type { Node as PMNode } from 'prosemirror-model';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { checkAccessibility, type A11yCheckOptions, type A11yIssue } from '../a11y';
import type { Editor } from '../editor';
import { openLinkDialog } from '../link';
import { definePlugin } from '../plugins';
import { activeElement, h, uniqueId } from '../ui/dom';
import css from './a11ychecker.css?raw';
import { pickLabels } from './shared';

/**
 * The a11ychecker plugin (named as in TinyMCE): the Accessibility panel lists what in the document
 * keeps people from reading it with a screen reader, a keyboard or weak eyesight — images without
 * alternative text, skipped heading levels, lists typed by hand, low contrast, vague links — each
 * with a fix where one is clear (a field for the alternative text, "Change to Heading 3", "Make it
 * a list"), Show in the text and Ignore. It checks again as the document changes. The rules are in
 * a11y.ts and run on a server too (`@novaprose/core/a11y`).
 */

export const LABELS = {
  en: {
    button: 'Check accessibility',
    panel: 'Accessibility',
    checkAgain: 'Check again',
    summary: 'Errors: {errors}. Warnings: {warnings}.',
    none: 'No accessibility problems found.',
    error: 'Error',
    warning: 'Warning',
    wcag: 'WCAG {level}',
    show: 'Show in the text',
    ignore: 'Ignore',
    altText: 'Alternative text',
    save: 'Save',
    decorative: 'Decorative image',
    fixed: 'Fixed.',
    ruleI1: 'A decorative image: describe what it shows, unless it really adds nothing.',
    ruleI2: 'An image without alternative text: screen readers cannot say what it shows.',
    ruleI3: 'The alternative text is a file name: describe what the image shows.',
    ruleI4: 'The alternative text is very long: keep it short, details belong in the text.',
    ruleD1: 'This paragraph looks like a heading: make it one, so the structure can be navigated.',
    ruleD2: 'A heading level is skipped: headings go down one level at a time.',
    ruleD3: 'Two links next to each other lead to the same address: make them one link.',
    ruleD4U: 'A list typed with bullet characters: make it a real list.',
    ruleD4O: 'A list typed with numbers: make it a real numbered list.',
    ruleD5: 'The text has too little contrast with its background ({ratio}:1, needs {required}:1).',
    ruleH93: 'The same id is used twice: links to it cannot tell the places apart.',
    ruleT4B: 'A table without header cells: screen readers cannot say what the cells mean.',
    ruleN1: 'The link text does not say where it leads ("click here", "read more").',
    ruleN2: 'An empty heading.',
    ruleN3: 'A link without text.',
    fixHeading: 'Make it Heading {level}',
    fixLevel: 'Change to Heading {level}',
    fixRemoveHeading: 'Remove the heading',
    fixJoin: 'Join the links',
    fixList: 'Make it a list',
    fixColor: 'Remove the colors',
    fixId: 'Make the id unique',
    fixHeader: 'Make the first row a header',
    fixUnlink: 'Remove the link',
    fixEditLink: 'Edit the link',
  },
};

type Labels = (typeof LABELS)['en'];

export interface A11yCheckerOptions extends A11yCheckOptions {
  /** Leave out issues: return false for the ones not to show. */
  filterIssue?: (issue: A11yIssue) => boolean;
}

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/></svg>';

const PANEL = 'a11ychecker';
const IMAGE_RULES = new Set(['I1', 'I2', 'I3', 'I4']);
const BULLET_PREFIX = /^\s*[•◦▪▫‣⁃●○■□–—*-]\s+/;
const NUMBER_PREFIX = /^\s*(\d{1,3})[.)]\s+/;

/** The place of the issue the person is looking at in the panel, outlined in the text. */
const highlightKey = new PluginKey<{ from: number; to: number } | null>('nova-a11y-highlight');

function setHighlight(editor: Editor, target: { from: number; to: number } | null): void {
  if (editor.view.isDestroyed) return;
  editor.view.dispatch(editor.view.state.tr.setMeta(highlightKey, target));
}

/** The fix of an issue as a transaction (null when there is nothing to do or it no longer fits). */
export function fixTransaction(
  state: EditorState,
  issue: A11yIssue,
  value?: string | null,
): Transaction | null {
  const { schema } = state;
  const tr = state.tr;
  const node: PMNode | null = state.doc.nodeAt(issue.from);
  switch (issue.rule) {
    case 'I1':
    case 'I2':
    case 'I3':
    case 'I4':
      if (!node || (node.type.name !== 'image' && node.type.name !== 'figure_image')) return null;
      return tr.setNodeAttribute(issue.from, 'alt', value === undefined ? null : value);
    case 'D1':
      if (node?.type.name !== 'paragraph' || !schema.nodes.heading) return null;
      tr.setNodeMarkup(issue.from, schema.nodes.heading, {
        ...node.attrs,
        level: issue.data?.level ?? 2,
      });
      // A heading is bold anyway.
      if (schema.marks.bold) tr.removeMark(issue.from, issue.to, schema.marks.bold);
      return tr;
    case 'D2':
      if (node?.type.name !== 'heading') return null;
      return tr.setNodeAttribute(issue.from, 'level', issue.data?.to ?? node.attrs.level);
    case 'N2':
      if (node?.type.name !== 'heading') return null;
      // The document can't be left without a block.
      return state.doc.childCount === 1 && state.doc.firstChild === node
        ? tr.replaceWith(issue.from, issue.to, schema.nodes.paragraph!.create())
        : tr.delete(issue.from, issue.to);
    case 'D3': {
      const link = node?.marks.find((m) => m.type.name === 'link');
      return link ? tr.addMark(issue.from, issue.to, link) : null;
    }
    case 'N3':
      return schema.marks.link ? tr.removeMark(issue.from, issue.to, schema.marks.link) : null;
    case 'D5A':
    case 'D5B':
    case 'D5C':
      for (const name of ['color', 'background']) {
        const type = schema.marks[name];
        if (type) tr.removeMark(issue.from, issue.to, type);
      }
      return tr;
    case 'H93': {
      const id = String(issue.data?.id ?? '');
      if (!node || node.attrs.id !== id) return null;
      const used = new Set<string>();
      state.doc.descendants((n) => {
        if (typeof n.attrs.id === 'string') used.add(n.attrs.id);
        return true;
      });
      let n = 2;
      while (used.has(`${id}-${n}`)) n++;
      return tr.setNodeAttribute(issue.from, 'id', `${id}-${n}`);
    }
    case 'T4B': {
      const header = schema.nodes.table_header;
      const firstRow = node?.type.name === 'table' ? node.firstChild : null;
      if (!header || !firstRow) return null;
      let pos = issue.from + 2;
      firstRow.forEach((cell) => {
        if (cell.type.name === 'table_cell') tr.setNodeMarkup(pos, header, cell.attrs);
        pos += cell.nodeSize;
      });
      return tr;
    }
    case 'D4U':
    case 'D4O': {
      const ordered = issue.rule === 'D4O';
      const list = ordered ? schema.nodes.ordered_list : schema.nodes.bullet_list;
      const item = schema.nodes.list_item;
      const paragraph = schema.nodes.paragraph;
      if (!list || !item || !paragraph) return null;
      const items: PMNode[] = [];
      let start = 1;
      state.doc.nodesBetween(issue.from, issue.to, (block) => {
        if (block.type !== paragraph) return false;
        const marker = (ordered ? NUMBER_PREFIX : BULLET_PREFIX).exec(block.textContent);
        if (ordered && marker && !items.length) start = Number(marker[1]) || 1;
        items.push(
          item.create(
            null,
            paragraph.create(block.attrs, block.content.cut(marker?.[0].length ?? 0)),
          ),
        );
        return false;
      });
      if (!items.length) return null;
      return tr.replaceWith(issue.from, issue.to, list.create(ordered ? { start } : null, items));
    }
    default:
      return null;
  }
}

export default definePlugin({
  name: 'a11ychecker',
  toolbar: 'a11ycheck',
  prosemirrorPlugins: () => [
    new Plugin<{ from: number; to: number } | null>({
      key: highlightKey,
      state: {
        init: () => null,
        apply(tr, value) {
          const meta = tr.getMeta(highlightKey) as { from: number; to: number } | null | undefined;
          if (meta !== undefined) return meta;
          if (!value || !tr.docChanged) return value;
          const from = tr.mapping.map(value.from, 1);
          const to = tr.mapping.map(value.to, -1);
          return to > from ? { from, to } : null;
        },
      },
      props: {
        decorations(state) {
          const target = highlightKey.getState(state);
          if (!target || target.to > state.doc.content.size) return null;
          const node = state.doc.nodeAt(target.from);
          const whole = node && !node.isText && target.from + node.nodeSize === target.to;
          return DecorationSet.create(state.doc, [
            whole
              ? Decoration.node(target.from, target.to, { class: 'nova-a11y-target' })
              : Decoration.inline(target.from, target.to, { class: 'nova-a11y-target' }),
          ]);
        },
      },
    }),
  ],
  setup(editor) {
    const options = (editor.options.pluginOptions?.a11ychecker ?? {}) as A11yCheckerOptions;
    const labels = pickLabels(editor, 'a11ychecker', LABELS);
    editor.ui.addStyles('nova-a11ychecker', css);
    let panel: ReturnType<typeof createPanel> | null = null;
    editor.ui.registry.addSidebar(PANEL, {
      title: labels.panel,
      button: false,
      render: (container) => {
        panel = createPanel(editor, labels, options);
        container.append(panel.el);
        return () => panel?.destroy();
      },
      onShow: () => panel?.render(),
      onHide: () => setHighlight(editor, null),
    });
    const toggle = () => void editor.ui.sidebar.toggle(PANEL);
    editor.ui.registry.addToggleButton('a11ycheck', {
      icon: ICON,
      tooltip: labels.button,
      isActive: (e) => e.ui.sidebar.isOpen(PANEL),
      onAction: toggle,
    });
    editor.ui.registry.addMenuItem('a11ycheck', {
      text: labels.button,
      icon: ICON,
      onAction: toggle,
    });
  },
});

function createPanel(editor: Editor, labels: Labels, options: A11yCheckerOptions) {
  let issues: A11yIssue[] = [];
  // Ignored this session: by rule and text, so an ignored issue stays ignored as the text moves.
  const ignored = new Set<string>();
  const key = (issue: A11yIssue) => `${issue.rule}\u0000${issue.text}`;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const summary = h('p', { className: 'nova-a11y-summary', role: 'status' });
  const again = h(
    'button',
    { type: 'button', className: 'nova-button', onClick: () => render() },
    labels.checkAgain,
  );
  const list = h('ul', { className: 'nova-a11y-list' });
  const el = h(
    'div',
    { className: 'nova-a11y-panel' },
    h('div', { className: 'nova-a11y-head' }, summary, again),
    list,
  );

  function run(): A11yIssue[] {
    return checkAccessibility(editor.view.state.doc, options).filter((issue) => {
      if (ignored.has(key(issue))) return false;
      try {
        return options.filterIssue?.(issue) ?? true;
      } catch (error) {
        console.warn('[nova] a11ychecker: filterIssue failed', error);
        return true;
      }
    });
  }

  const describe = (issue: A11yIssue): string => {
    if (issue.rule.startsWith('D5')) {
      return labels.ruleD5
        .replace('{ratio}', String(issue.data?.ratio ?? ''))
        .replace('{required}', String(issue.data?.required ?? ''));
    }
    return (labels as Record<string, string>)[`rule${issue.rule}`] ?? issue.rule;
  };

  const fixLabel = (issue: A11yIssue): string | null => {
    const level = (template: string, value: unknown) => template.replace('{level}', String(value));
    switch (issue.rule) {
      case 'D1':
        return level(labels.fixHeading, issue.data?.level);
      case 'D2':
        return level(labels.fixLevel, issue.data?.to);
      case 'N2':
        return labels.fixRemoveHeading;
      case 'D3':
        return labels.fixJoin;
      case 'D4U':
      case 'D4O':
        return labels.fixList;
      case 'D5A':
      case 'D5B':
      case 'D5C':
        return labels.fixColor;
      case 'H93':
        return labels.fixId;
      case 'T4B':
        return labels.fixHeader;
      case 'N3':
        return labels.fixUnlink;
      default:
        return null;
    }
  };

  /** The issue in the text: selected and scrolled to; focus stays in the panel. */
  function show(issue: A11yIssue): void {
    const { state } = editor.view;
    if (issue.to > state.doc.content.size) return;
    const node = state.doc.nodeAt(issue.from);
    const selection =
      node && node.isAtom && issue.from + node.nodeSize === issue.to
        ? NodeSelection.create(state.doc, issue.from)
        : TextSelection.between(state.doc.resolve(issue.from), state.doc.resolve(issue.to));
    editor.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
    setHighlight(editor, { from: issue.from, to: issue.to });
  }

  /** Apply a fix to the issue as it is now (the document may have changed since the list was drawn). */
  function apply(issue: A11yIssue, value?: string | null): void {
    const now = run().find((i) => i.rule === issue.rule && i.from === issue.from);
    const tr = now && editor.isEditable() ? fixTransaction(editor.view.state, now, value) : null;
    if (tr) {
      editor.view.dispatch(tr.scrollIntoView());
      editor.ui.announce(labels.fixed);
    }
    render();
  }

  function editLink(issue: A11yIssue): void {
    show(issue);
    editor.focus();
    openLinkDialog(editor);
  }

  function altForm(issue: A11yIssue): HTMLElement {
    const id = uniqueId('nova-a11y-alt');
    const current = editor.view.state.doc.nodeAt(issue.from)?.attrs.alt;
    const input = h('input', {
      id,
      type: 'text',
      className: 'nova-input',
      'data-key': key(issue),
      'data-action': 'alt',
    });
    input.value = issue.rule === 'I3' || issue.rule === 'I4' ? String(current ?? '') : '';
    return h(
      'form',
      {
        className: 'nova-a11y-alt',
        onSubmit: ((event: Event) => {
          event.preventDefault();
          const text = input.value.trim();
          if (text) apply(issue, text);
          else input.focus();
        }) as EventListener,
      },
      h('label', { for: id }, labels.altText),
      input,
      h('button', { type: 'submit', className: 'nova-button' }, labels.save),
      options.allowDecorativeImages !== false
        ? h(
            'button',
            { type: 'button', className: 'nova-button', onClick: () => apply(issue, '') },
            labels.decorative,
          )
        : null,
    );
  }

  function card(issue: A11yIssue): HTMLElement {
    const action = (label: string, name: string, onClick: () => void, primary = false) =>
      h(
        'button',
        {
          type: 'button',
          className: `nova-button${primary ? ' nova-button-primary' : ''}`,
          'data-key': key(issue),
          'data-action': name,
          onClick,
        },
        label,
      );
    const fix = fixLabel(issue);
    const target = { from: issue.from, to: issue.to };
    const item = h(
      'li',
      {
        className: `nova-a11y-card is-${issue.severity}`,
        onMouseenter: () => setHighlight(editor, target),
        onMouseleave: () => setHighlight(editor, null),
        onFocusin: () => setHighlight(editor, target),
      },
      h(
        'span',
        { className: `nova-a11y-badge is-${issue.severity}` },
        `${issue.severity === 'error' ? labels.error : labels.warning} · ${labels.wcag.replace('{level}', issue.level)}`,
      ),
      h('p', { className: 'nova-a11y-desc' }, describe(issue)),
      issue.text ? h('p', { className: 'nova-a11y-text' }, issue.text) : null,
      IMAGE_RULES.has(issue.rule) ? altForm(issue) : null,
      h(
        'div',
        { className: 'nova-a11y-actions' },
        action(labels.show, 'show', () => show(issue)),
        fix ? action(fix, 'fix', () => apply(issue), true) : null,
        issue.rule === 'N1' ? action(labels.fixEditLink, 'edit', () => editLink(issue)) : null,
        action(labels.ignore, 'ignore', () => {
          ignored.add(key(issue));
          render();
        }),
      ),
    );
    return item;
  }

  function render(): void {
    clearTimeout(timer);
    // Focus survives the redraw: the same control of the same issue, or the card that took its place.
    const focused = activeElement(el);
    const focusKey = focused && el.contains(focused) ? focused.getAttribute('data-key') : null;
    const focusAction = focused?.getAttribute('data-action') ?? null;
    const before = [...list.children].map((li) =>
      li.querySelector('[data-key]')?.getAttribute('data-key'),
    );

    issues = run();
    const errors = issues.filter((i) => i.severity === 'error').length;
    summary.textContent = issues.length
      ? labels.summary
          .replace('{errors}', String(errors))
          .replace('{warnings}', String(issues.length - errors))
      : labels.none;
    list.replaceChildren(...issues.map(card));

    if (focusKey) {
      const controls = [...list.querySelectorAll<HTMLElement>('[data-action]')];
      const same = controls.find(
        (c) => c.getAttribute('data-key') === focusKey && c.dataset.action === focusAction,
      );
      if (same) same.focus();
      else {
        const index = Math.max(0, before.indexOf(focusKey));
        const next = list.children[Math.min(index, list.children.length - 1)];
        (next?.querySelector<HTMLElement>('[data-action]') ?? again).focus();
      }
    }
  }

  const offChange = editor.on('change', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 300);
  });

  return {
    el,
    render,
    destroy() {
      clearTimeout(timer);
      offChange();
      setHighlight(editor, null);
    },
  };
}
