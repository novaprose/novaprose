import { InputRule, inputRules } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { NodeSelection, type Command, type EditorState } from 'prosemirror-state';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h } from '../ui/dom';
import { icons } from '../ui/icons';
import { loadTemml, mathLatex, renderMath } from './math';
import { pickLabels } from './shared';

/**
 * The lazy part of the math plugin: the "Formula" dialog with a live preview, typing `$formula$` in the text and
 * `$$` at the start of a line, Enter on a selected formula, the `math` button and menu item.
 */

export const LABELS = {
  en: {
    insert: 'Formula',
    latex: 'LaTeX',
    hint: 'For example: E = mc^2, \\frac{a}{b}, \\sqrt{x}',
    block: 'On its own line',
    preview: 'Preview',
  },
};

type Labels = (typeof LABELS)['en'];

/** The selected formula (after a click on it or with the arrows). */
function selectedMath(state: EditorState): NodeSelection | null {
  const { selection } = state;
  return selection instanceof NodeSelection &&
    /^math_(inline|block)$/.test(selection.node.type.name)
    ? selection
    : null;
}

async function mathDialog(editor: Editor, labels: Labels): Promise<void> {
  const { state } = editor.view;
  const selected = selectedMath(state);
  const latex = selected
    ? mathLatex(selected.node.attrs.latex)
    : state.doc.textBetween(state.selection.from, state.selection.to, ' ');
  const block = selected?.node.type.name === 'math_block';
  const preview = h('div', {
    className: 'nova-math-preview',
    role: 'group',
    'aria-label': labels.preview,
  });
  // An error in the formula shows as text under the preview (a screen reader announces it without losing focus).
  const message = h('p', { className: 'nova-field-error', 'aria-live': 'polite', hidden: true });
  const draw = (source: string, display: boolean) => {
    if (!source.trim()) {
      preview.textContent = '';
      message.hidden = true;
      return;
    }
    void loadTemml().then((engine) => {
      if (!engine) return;
      const error = renderMath(engine, source, preview, display);
      message.textContent = error ?? '';
      message.hidden = !error;
    });
  };
  draw(latex, block);
  const data = await editor.ui.dialog({
    title: labels.insert,
    submitLabel: editor.ui.t(selected ? 'dialog.save' : 'dialog.insert'),
    initialData: { latex, block },
    fields: [
      {
        type: 'textarea',
        name: 'latex',
        label: labels.latex,
        rows: 4,
        code: true,
        hint: labels.hint,
        required: true,
      },
      { type: 'checkbox', name: 'block', label: labels.block },
      { type: 'custom', render: () => h('div', {}, preview, message) },
    ],
    onChange: (values) => draw(String(values.latex ?? ''), values.block === true),
  });
  if (!data) return;
  const source = mathLatex(String(data.latex ?? '')).trim();
  const next = editor.view.state;
  const type = next.schema.nodes[data.block === true ? 'math_block' : 'math_inline']!;
  const node = type.create({ latex: source });
  // While the dialog was open the document may have changed: the formula is found again.
  const current = selected ? selectedMath(next) : null;
  const tr =
    current && current.node.type === type
      ? next.tr.setNodeMarkup(current.from, undefined, { latex: source })
      : current
        ? next.tr.replaceRangeWith(current.from, current.to, node)
        : next.tr.replaceSelectionWith(node);
  editor.view.dispatch(tr.scrollIntoView());
  editor.focus();
}

/** Whether there is no code mark under the cursor: "$x$" in code is code, not a formula. */
const inCode = (state: EditorState) =>
  state.selection.$from.marks().some((mark) => mark.type.name === 'code');

/**
 * `$x^2$` in the text is an inline formula. As in Pandoc: after the opening "$" and before the closing one
 * there is no space, so "$5 and $10" stays text; "\$" is an escaped dollar.
 */
function inlineRule(): InputRule {
  return new InputRule(/(^|[^$\\])\$([^\s$](?:[^$]*[^\s$\\])?)\$$/, (state, match, start, end) => {
    const type = state.schema.nodes.math_inline;
    if (!type || inCode(state)) return null;
    const from = start + match[1]!.length;
    return state.tr.replaceWith(from, end, type.create({ latex: match[2] }));
  });
}

/** `$$` and a space at the start of a line make a formula on its own line, opened for editing right away. */
function blockRule(editor: Editor, labels: Labels): InputRule {
  return new InputRule(/^\$\$\s$/, (state, _match, start, end) => {
    const type = state.schema.nodes.math_block;
    const $start = state.doc.resolve(start);
    if (!type || inCode(state) || $start.parent.type.name !== 'paragraph') return null;
    const tr = state.tr.delete(start, end);
    const at = tr.mapping.map($start.before());
    tr.replaceWith(at, at + tr.doc.nodeAt(at)!.nodeSize, type.create());
    tr.setSelection(NodeSelection.create(tr.doc, at));
    setTimeout(() => void mathDialog(editor, labels), 0);
    return tr;
  });
}

export default definePlugin({
  name: 'math-ui',
  requires: ['math'],
  toolbar: 'math',
  prosemirrorPlugins: (editor) => {
    const labels = pickLabels(editor, 'math', LABELS);
    const editSelected: Command = (state) => {
      if (!selectedMath(state)) return false;
      void mathDialog(editor, labels);
      return true;
    };
    return [
      inputRules({ rules: [inlineRule(), blockRule(editor, labels)] }),
      keymap({ Enter: editSelected }),
    ];
  },
  setup(editor) {
    const labels = pickLabels(editor, 'math', LABELS);
    const open = () => void mathDialog(editor, labels);
    editor.ui.registry.addToggleButton('math', {
      icon: icons.math,
      tooltip: labels.insert,
      isEnabled: (e) => e.isEditable(),
      isActive: (e) => !!selectedMath(e.view.state),
      onAction: open,
    });
    editor.ui.registry.addMenuItem('math', {
      text: labels.insert,
      icon: icons.math,
      onAction: open,
    });
  },
});
