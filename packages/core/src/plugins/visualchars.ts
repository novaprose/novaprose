import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import css from './visualchars.css?raw';
import { pickLabels } from './shared';

/**
 * The visualchars plugin (named as in TinyMCE): shows characters that look like nothing or like an
 * ordinary space — no-break spaces (a dot), soft hyphens and zero-width spaces (a dashed mark). Only the
 * view changes, never the text; the marks are pictures, so screen readers don't read them.
 * `pluginOptions.visualchars.default` turns it on right away (for TinyMCE, `visualchars_default_state`).
 */

export const LABELS = { en: { title: 'Show invisible characters' } };

/** The invisible characters and how each is shown. */
const KINDS: Record<string, 'nbsp' | 'shy' | 'zwsp'> = {
  '\u00a0': 'nbsp', // no-break space
  '\u202f': 'nbsp', // narrow no-break space
  '\u2007': 'nbsp', // figure space
  '\u00ad': 'shy', // soft hyphen
  '\u200b': 'zwsp', // zero-width space
  '\u2060': 'zwsp', // word joiner
  '\ufeff': 'zwsp', // zero-width no-break space
};
const PATTERN = /[\u00a0\u202f\u2007\u00ad\u200b\u2060\ufeff]/g;

/** Marks for the invisible characters between two positions. */
export function invisibleCharacters(doc: PMNode, from = 0, to = doc.content.size): Decoration[] {
  const decorations: Decoration[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return true;
    for (const match of node.text!.matchAll(PATTERN)) {
      const start = pos + match.index!;
      if (start < from || start >= to) continue;
      decorations.push(
        Decoration.inline(start, start + 1, {
          class: 'nova-visualchar',
          'data-char': KINDS[match[0]]!,
        }),
      );
    }
    return false;
  });
  return decorations;
}

/** The ranges a transaction changed, in the new document. */
function changedRanges(tr: Transaction): [number, number][] {
  const ranges: [number, number][] = [];
  tr.mapping.maps.forEach((map, index) => {
    const rest = tr.mapping.slice(index + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      ranges.push([rest.map(newStart, -1), rest.map(newEnd, 1)]);
    });
  });
  return ranges;
}

interface VisualCharsState {
  on: boolean;
  decorations: DecorationSet;
}

export const visualCharsKey = new PluginKey<VisualCharsState>('nova-visualchars');

function visualCharsPlugin(initial: boolean): Plugin<VisualCharsState> {
  return new Plugin<VisualCharsState>({
    key: visualCharsKey,
    state: {
      init: (_config, state) => ({
        on: initial,
        decorations: initial
          ? DecorationSet.create(state.doc, invisibleCharacters(state.doc))
          : DecorationSet.empty,
      }),
      apply(tr, value) {
        const toggle = tr.getMeta(visualCharsKey) as boolean | undefined;
        const on = toggle ?? value.on;
        if (!on) return { on, decorations: DecorationSet.empty };
        if (toggle !== undefined && !value.on) {
          return { on, decorations: DecorationSet.create(tr.doc, invisibleCharacters(tr.doc)) };
        }
        if (!tr.docChanged) return value;
        // Only the changed text blocks are scanned again: a long document stays fast while typing.
        let decorations = value.decorations.map(tr.mapping, tr.doc);
        for (const [from, to] of changedRanges(tr)) {
          const $from = tr.doc.resolve(Math.min(from, tr.doc.content.size));
          const $to = tr.doc.resolve(Math.min(to, tr.doc.content.size));
          const start = $from.parent.isTextblock ? $from.start() : $from.pos;
          const end = $to.parent.isTextblock ? $to.end() : $to.pos;
          decorations = decorations
            .remove(decorations.find(start, end))
            .add(tr.doc, invisibleCharacters(tr.doc, start, end));
        }
        return { on, decorations };
      },
    },
    props: {
      decorations: (state) => visualCharsKey.getState(state)?.decorations,
    },
  });
}

const isOn = (editor: Editor) => !!visualCharsKey.getState(editor.view.state)?.on;

export default definePlugin({
  name: 'visualchars',
  toolbar: 'visualchars',
  prosemirrorPlugins: (editor) => {
    const options = (editor.options.pluginOptions?.visualchars ?? {}) as { default?: boolean };
    return [visualCharsPlugin(options.default === true)];
  },
  setup(editor) {
    editor.ui.addStyles('nova-visualchars', css);
    const { title } = pickLabels(editor, 'visualchars', LABELS);
    const toggle = (e: Editor) => {
      e.view.dispatch(e.view.state.tr.setMeta(visualCharsKey, !isOn(e)));
      e.focus();
    };
    editor.ui.registry.addToggleButton('visualchars', {
      icon: icons.visualChars,
      tooltip: title,
      isActive: isOn,
      onAction: toggle,
    });
    editor.ui.registry.addToggleMenuItem('visualchars', {
      text: title,
      icon: icons.visualChars,
      isActive: isOn,
      onAction: toggle,
    });
  },
});
