import type { Node as PMNode } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { codeLanguage } from '../code-language';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { isRtl } from '../ui/dom';
import { icons } from '../ui/icons';
import type { MenuEntry } from '../ui/menu';
import { Highlighter } from './code-highlight';
import {
  DEFAULT_LANGUAGES,
  GRAMMARS,
  languageLabel,
  type CodeGrammarLoader,
  type CodeLanguage,
} from './code-languages';
import css from './codesample.css?raw';
import { pickLabels } from './shared';

/**
 * The codesample plugin: syntax highlighting in code blocks, language choice and the "Code sample" dialog
 * (the `codesample` button, as in TinyMCE). `plugins: ['codesample']`.
 *
 * Highlighting is highlight.js, in the editor only (decorations on top of the text): the output HTML stays
 * `<pre><code class="language-js">`, and any library on the site's page can highlight it. The highlight.js core
 * and grammars load when a code block in that language appears in the document.
 */

export const LABELS = {
  en: {
    title: 'Code sample',
    language: 'Language',
    code: 'Code',
    plainText: 'Plain text',
    toolbar: 'Code block',
  },
};

export interface CodeSampleOptions {
  /**
   * Languages in the menu and dialog, in order. The value is the name for the `language-…` class;
   * highlighting uses the built-in grammar with the same name or alias (js, ts, sh, html, markup…).
   */
  languages?: CodeLanguage[];
  /**
   * Your own highlight.js grammars for languages outside the built-in set, by language value:
   * `{ '1c': () => import('highlight.js/lib/languages/1c') }`.
   */
  grammars?: Record<string, CodeGrammarLoader>;
}

/** Code blocks larger than this (in characters) are recolored after a pause in typing, not on every letter. */
const SYNC_LIMIT = 20_000;
const DEFER_DELAY = 300;

interface HighlightState {
  set: DecorationSet;
  /** There are large blocks waiting to be recolored after a pause. */
  deferred: boolean;
}

type Meta = 'refresh' | 'deferred';

const key = new PluginKey<HighlightState>('nova-codesample');

/** The code block with the cursor (the selection entirely inside one block). */
export function codeBlockAt(state: EditorState): { node: PMNode; pos: number } | null {
  const { $from, $to } = state.selection;
  if ($from.parent.type.name !== 'code_block' || !$from.sameParent($to)) return null;
  return { node: $from.parent, pos: $from.before() };
}

/** The language of the code block under the cursor (null means plain text). */
export function setCodeLanguage(language: string | null): Command {
  return (state, dispatch) => {
    const block = codeBlockAt(state);
    if (!block) return false;
    dispatch?.(state.tr.setNodeAttribute(block.pos, 'language', codeLanguage(language)));
    return true;
  };
}

/** Every grammar load has finished and the highlighting is drawn (for tests and printing). */
export async function codeHighlightIdle(state: EditorState): Promise<void> {
  const highlighter = key.get(state)?.spec.highlighter as Highlighter | undefined;
  await highlighter?.idle();
}

function sameLanguage(a: string | null, b: string): boolean {
  return !!a && a.toLowerCase() === b.toLowerCase();
}

/** The list for the menu and the dialog; a block language not in the list goes first, so you can see what it is. */
function languageChoices(languages: CodeLanguage[], current: string | null): CodeLanguage[] {
  if (!current || languages.some((l) => sameLanguage(current, l.value))) return languages;
  return [{ value: current, label: languageLabel(current, languages) }, ...languages];
}

function highlightPlugin(highlighter: Highlighter, languages: CodeLanguage[]): Plugin {
  /** The decorations of one block: <pre> attributes (the language label) and highlighted ranges. */
  const decorate = (node: PMNode, pos: number): Decoration[] => {
    const language = codeLanguage(node.attrs.language);
    const attrs: Record<string, string> = { spellcheck: 'false' };
    if (language) attrs['data-language'] = languageLabel(language, languages);
    // spec.codeBlock is the node the decorations were built for: a different node means it is time to recolor.
    const decorations = [Decoration.node(pos, pos + node.nodeSize, attrs, { codeBlock: node })];
    const segments = highlighter.highlight(node.textContent, language);
    if (Array.isArray(segments)) {
      const start = pos + 1;
      for (const s of segments) {
        decorations.push(Decoration.inline(start + s.from, start + s.to, { class: s.className }));
      }
    }
    return decorations;
  };

  const build = (doc: PMNode): DecorationSet => {
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name !== 'code_block') return !node.isTextblock;
      decorations.push(...decorate(node, pos));
      return false;
    });
    return DecorationSet.create(doc, decorations);
  };

  /** Recolors only the blocks that changed: the other decorations just shift. */
  const update = (tr: Transaction, previous: DecorationSet, force: boolean): HighlightState => {
    let set = previous.map(tr.mapping, tr.doc);
    let deferred = false;
    tr.doc.descendants((node, pos) => {
      if (node.type.name !== 'code_block') return !node.isTextblock;
      const end = pos + node.nodeSize;
      const own = set.find(pos, end, (spec) => spec.codeBlock !== undefined);
      const current = own.find((d) => d.from === pos && d.to === end);
      if (current?.spec.codeBlock === node) return false;
      if (current && !force && node.content.size > SYNC_LIMIT) {
        deferred = true;
        return false;
      }
      // find() also catches neighbors touching the edges, so only our own are removed.
      set = set
        .remove(set.find(pos, end).filter((d) => d.from >= pos && d.to <= end))
        .add(tr.doc, decorate(node, pos));
      return false;
    });
    return { set, deferred };
  };

  return new Plugin<HighlightState>({
    key,
    highlighter,
    state: {
      init: (_, state) => ({ set: build(state.doc), deferred: false }),
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(key) as Meta | undefined;
        if (meta === 'refresh') return { set: build(state.doc), deferred: false };
        if (!tr.docChanged && meta !== 'deferred') return value;
        return update(tr, value.set, meta === 'deferred');
      },
    },
    props: {
      decorations: (state) => key.getState(state)?.set,
    },
    view(view) {
      const dispatchMeta = (meta: Meta) => {
        if (view.isDestroyed) return;
        view.dispatch(view.state.tr.setMeta(key, meta).setMeta('addToHistory', false));
      };
      // A grammar loaded: recolor the blocks in that language (and in all the others).
      const stop = highlighter.onLoad(() => dispatchMeta('refresh'));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        if (!key.getState(view.state)?.deferred) return;
        clearTimeout(timer);
        timer = setTimeout(() => dispatchMeta('deferred'), DEFER_DELAY);
      };
      return {
        update: schedule,
        destroy() {
          stop();
          clearTimeout(timer);
        },
      };
    },
  });
}

/** Inserts a block: it replaces an empty paragraph under the cursor, otherwise it takes the selection's place. */
function insertBlock(state: EditorState, block: PMNode): Transaction {
  const { $from, empty } = state.selection;
  const tr = state.tr;
  const parent = $from.parent;
  const index = $from.index(-1);
  if (
    empty &&
    $from.depth > 0 &&
    parent.isTextblock &&
    parent.content.size === 0 &&
    $from.node(-1).canReplaceWith(index, index + 1, block.type)
  ) {
    tr.replaceWith($from.before(), $from.after(), block);
  } else {
    tr.replaceSelectionWith(block);
  }
  // The cursor goes to the end of the code, so you can keep typing.
  let end = -1;
  tr.doc.descendants((node, pos) => {
    if (end >= 0) return false;
    if (node === block) end = pos + node.nodeSize - 1;
    return end < 0;
  });
  if (end >= 0) tr.setSelection(TextSelection.create(tr.doc, end));
  return tr;
}

/** The "Code sample" dialog: with the cursor in a code block it edits the block, otherwise it inserts a new one. */
async function codeDialog(
  editor: Editor,
  languages: CodeLanguage[],
  memory: { last: string },
): Promise<void> {
  const labels = pickLabels(editor, 'codesample', LABELS);
  const { state } = editor.view;
  const block = codeBlockAt(state);
  const current = block ? (codeLanguage(block.node.attrs.language) ?? '') : memory.last;
  const { from, to } = state.selection;
  const data = await editor.ui.dialog({
    title: labels.title,
    size: 'large',
    submitLabel: editor.ui.t(block ? 'dialog.save' : 'dialog.insert'),
    initialData: {
      language: current,
      code: block ? block.node.textContent : state.doc.textBetween(from, to, '\n'),
    },
    fields: [
      {
        type: 'select',
        name: 'language',
        label: labels.language,
        options: [
          { value: '', label: labels.plainText },
          ...languageChoices(languages, current || null).map((l) => ({
            value: l.value,
            label: l.label,
          })),
        ],
      },
      { type: 'textarea', name: 'code', label: labels.code, rows: 14, code: true },
    ],
  });
  if (!data) return;
  const language = codeLanguage(data.language);
  memory.last = language ?? '';
  const code = String(data.code ?? '').replace(/\r\n?/g, '\n');
  const next = editor.view.state;
  const type = next.schema.nodes.code_block!;
  const node = type.create({ language }, code ? next.schema.text(code) : undefined);
  // While the dialog was open the document may have changed (co-authors): find the block again.
  const target = block ? codeBlockAt(next) : null;
  let tr: Transaction;
  if (target) {
    tr = next.tr.replaceWith(target.pos, target.pos + target.node.nodeSize, node);
    tr.setSelection(TextSelection.create(tr.doc, target.pos + 1 + code.length));
  } else {
    tr = insertBlock(next, node);
  }
  editor.view.dispatch(tr.scrollIntoView());
  editor.focus();
}

function options(editor: Editor): CodeSampleOptions {
  return (editor.options.pluginOptions?.codesample as CodeSampleOptions | undefined) ?? {};
}

export default definePlugin({
  name: 'codesample',
  toolbar: 'codesample',
  prosemirrorPlugins: (editor) => {
    const { languages = DEFAULT_LANGUAGES, grammars } = options(editor);
    return [highlightPlugin(new Highlighter({ ...GRAMMARS, ...grammars }), languages)];
  },
  setup(editor) {
    editor.ui.addStyles('nova-codesample', css);
    const labels = pickLabels(editor, 'codesample', LABELS);
    const languages = options(editor).languages ?? DEFAULT_LANGUAGES;
    const memory = { last: '' };
    const { registry } = editor.ui;
    const canEdit = (e: Editor) => e.isEditable() && e.isAllowed('codeblock');
    const currentLanguage = (e: Editor) => {
      const block = codeBlockAt(e.view.state);
      return block ? codeLanguage(block.node.attrs.language) : null;
    };

    registry.addButton('codesample', {
      icon: icons.codeSample,
      tooltip: labels.title,
      isEnabled: canEdit,
      isActive: (e) => !!codeBlockAt(e.view.state),
      onAction: (e) => void codeDialog(e, languages, memory),
    });
    registry.addMenuItem('codesample', {
      text: labels.title,
      icon: icons.codeSample,
      onAction: (e) => void codeDialog(e, languages, memory),
    });
    registry.addMenuButton('codelanguage', {
      tooltip: labels.language,
      label: (e) => {
        const language = currentLanguage(e);
        return language ? languageLabel(language, languages) : labels.plainText;
      },
      minChars: 10,
      isEnabled: (e) => canEdit(e) && !!codeBlockAt(e.view.state),
      items: (e) => {
        const language = currentLanguage(e);
        const pick = (value: string | null) => () => {
          if (value) memory.last = value;
          e.exec(setCodeLanguage(value));
        };
        const entries: MenuEntry[] = [
          { id: '', label: labels.plainText, active: !language, onSelect: pick(null) },
          { type: 'separator' },
        ];
        for (const l of languageChoices(languages, language)) {
          entries.push({
            id: l.value,
            label: l.label,
            active: sameLanguage(language, l.value),
            onSelect: pick(l.value),
          });
        }
        return entries;
      },
    });
    // Above tables (priority 1): for a code block in a cell the language matters more than the table buttons.
    registry.addContextToolbar('codesample', {
      label: labels.toolbar,
      priority: 1,
      predicate: (e) => canEdit(e) && !!codeBlockAt(e.view.state),
      anchor: (e) => {
        const block = codeBlockAt(e.view.state);
        const dom = block ? (e.view.nodeDOM(block.pos) as HTMLElement | null) : null;
        return dom?.getBoundingClientRect() ?? null;
      },
      // Above the block's right corner, next to the language label: covers neither the code nor the text on the left.
      // Code is always left to right, so in a right-to-left document the corner is the right one too.
      placement: (e) => (isRtl(e.root) ? 'top-start' : 'top-end'),
      items: 'codelanguage',
    });
  },
});
