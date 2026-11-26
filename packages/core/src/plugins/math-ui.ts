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
 * Ленивая часть плагина math: диалог «Формула» с живым просмотром, ввод `$формула$` в тексте и
 * `$$` в начале строки, Enter на выделенной формуле, кнопка и пункт меню `math`.
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

/** Выделенная формула (после нажатия на неё или стрелками). */
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
  // Ошибка в формуле — текстом под просмотром (объявляется экранным диктором без потери фокуса).
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
  // Пока диалог был открыт, документ мог измениться — формулу ищем заново.
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

/** Нет ли под курсором марки кода: «$x$» в коде — это код, а не формула. */
const inCode = (state: EditorState) =>
  state.selection.$from.marks().some((mark) => mark.type.name === 'code');

/**
 * `$x^2$` в тексте — формула в строке. Как в Pandoc: после открывающего и перед закрывающим «$» —
 * не пробел, поэтому «$5 и $10» остаётся текстом; «\$» — экранированный доллар.
 */
function inlineRule(): InputRule {
  return new InputRule(/(^|[^$\\])\$([^\s$](?:[^$]*[^\s$\\])?)\$$/, (state, match, start, end) => {
    const type = state.schema.nodes.math_inline;
    if (!type || inCode(state)) return null;
    const from = start + match[1]!.length;
    return state.tr.replaceWith(from, end, type.create({ latex: match[2] }));
  });
}

/** `$$` и пробел в начале строки — формула отдельной строкой, сразу правка. */
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
