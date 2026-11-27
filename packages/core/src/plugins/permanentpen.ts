import { Mark, type Schema } from 'prosemirror-model';
import { Plugin, type EditorState } from 'prosemirror-state';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { defaultFontFamilies, defaultFontSizes } from '../ui/builtins';
import type { DialogField } from '../ui/form-dialog-types';
import { icons } from '../ui/icons';
import { pickLabels } from './shared';

/**
 * The permanentpen plugin (named as in TinyMCE): while the pen is on, everything typed gets the pen's
 * formatting, wherever the cursor goes — for notes and remarks that must stand apart from the text.
 * The `permanentpen` button turns it on and off; `configurepermanentpen` (a menu item) opens its
 * properties: font, size, bold, italic, underline, strikethrough, text and highlight color. The
 * defaults come from `pluginOptions.permanentpen.properties` (for TinyMCE, `permanentpen_properties`).
 */

export const LABELS = {
  en: {
    button: 'Permanent pen',
    configure: 'Permanent pen properties',
    highlight: 'Highlight the text',
    on: 'Permanent pen on',
    off: 'Permanent pen off',
  },
};

/** The pen's formatting, with TinyMCE's property names. */
export interface PermanentPenProperties {
  fontname?: string;
  fontsize?: string;
  forecolor?: string;
  /** Background (highlight) color; empty — none. */
  hilitecolor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface PermanentPenOptions {
  properties?: PermanentPenProperties;
}

/** A dark red that keeps 4.5:1 contrast on white, bold. */
export const DEFAULT_PEN: PermanentPenProperties = { forecolor: '#C0392B', bold: true };

/** Marks the pen sets or replaces; other marks at the cursor (links, comments) stay. */
const PEN_MARKS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'font_family',
  'font_size',
];

/** The pen's properties as marks of this schema. */
export function penMarks(schema: Schema, pen: PermanentPenProperties): readonly Mark[] {
  const marks: Mark[] = [];
  const add = (name: string, attrs?: Record<string, unknown>) => {
    const type = schema.marks[name];
    if (type) marks.push(type.create(attrs));
  };
  if (pen.bold) add('bold');
  if (pen.italic) add('italic');
  if (pen.underline) add('underline');
  if (pen.strikethrough) add('strike');
  if (typeof pen.forecolor === 'string' && pen.forecolor) add('color', { value: pen.forecolor });
  if (typeof pen.hilitecolor === 'string' && pen.hilitecolor)
    add('background', { value: pen.hilitecolor });
  if (typeof pen.fontname === 'string' && pen.fontname) add('font_family', { value: pen.fontname });
  if (typeof pen.fontsize === 'string' && pen.fontsize) add('font_size', { value: pen.fontsize });
  return Mark.setFrom(marks);
}

/** The marks for typing at the cursor: the pen's, plus whatever non-formatting marks are there. */
function marksForCursor(state: EditorState, pen: readonly Mark[] | null): readonly Mark[] {
  const current = state.storedMarks ?? state.selection.$from.marks();
  const keep = current.filter((mark) => !PEN_MARKS.includes(mark.type.name));
  return Mark.setFrom([...keep, ...(pen ?? [])]);
}

interface Pen {
  active: boolean;
  properties: PermanentPenProperties;
}

const pens = new WeakMap<Editor, Pen>();

function penOf(editor: Editor): Pen {
  let pen = pens.get(editor);
  if (!pen) {
    const options = (editor.options.pluginOptions?.permanentpen ?? {}) as PermanentPenOptions;
    const properties =
      options.properties && typeof options.properties === 'object'
        ? { ...options.properties }
        : { ...DEFAULT_PEN };
    pen = { active: false, properties };
    pens.set(editor, pen);
  }
  return pen;
}

/** Typing continues with the pen's marks (on) or without them (off). */
function applyToCursor(editor: Editor): void {
  const { state } = editor.view;
  if (!state.selection.empty) return;
  const pen = penOf(editor);
  const marks = marksForCursor(state, pen.active ? penMarks(state.schema, pen.properties) : null);
  editor.view.dispatch(state.tr.setStoredMarks(marks));
}

async function configure(editor: Editor): Promise<void> {
  const { t } = editor.ui;
  const labels = pickLabels(editor, 'permanentpen', LABELS);
  const pen = penOf(editor);
  const current = pen.properties;
  const families = editor.options.fontFamilies ?? defaultFontFamilies;
  const fontOptions = [
    { value: '', label: t('default') },
    ...families.map((family) => ({ value: family.value, label: family.label })),
  ];
  if (current.fontname && !fontOptions.some((option) => option.value === current.fontname)) {
    fontOptions.push({ value: current.fontname, label: current.fontname });
  }
  const sizes = editor.options.fontSizes ?? defaultFontSizes;
  const sizeOptions = [
    { value: '', label: t('default') },
    ...sizes.map((size) => ({ value: size, label: size })),
  ];
  if (current.fontsize && !sizeOptions.some((option) => option.value === current.fontsize)) {
    sizeOptions.push({ value: current.fontsize, label: current.fontsize });
  }
  const fields: DialogField[] = [
    { type: 'select', name: 'fontname', label: t('fontFamily'), options: fontOptions },
    { type: 'select', name: 'fontsize', label: t('fontSize'), options: sizeOptions },
    { type: 'checkbox', name: 'bold', label: t('bold') },
    { type: 'checkbox', name: 'italic', label: t('italic') },
    { type: 'checkbox', name: 'underline', label: t('underline') },
    { type: 'checkbox', name: 'strikethrough', label: t('strike') },
    { type: 'color', name: 'forecolor', label: t('textColor') },
    { type: 'checkbox', name: 'highlight', label: labels.highlight },
    {
      type: 'color',
      name: 'hilitecolor',
      label: t('backgroundColor'),
      disabled: !current.hilitecolor,
    },
  ];
  const data = await editor.ui.dialog({
    title: labels.configure,
    fields,
    initialData: {
      fontname: current.fontname ?? '',
      fontsize: current.fontsize ?? '',
      bold: !!current.bold,
      italic: !!current.italic,
      underline: !!current.underline,
      strikethrough: !!current.strikethrough,
      forecolor: current.forecolor || '#000000',
      highlight: !!current.hilitecolor,
      hilitecolor: current.hilitecolor || '#ffff00',
    },
    onChange: (values, { name }, api) => {
      if (name === 'highlight') api.setEnabled('hilitecolor', values.highlight === true);
    },
  });
  if (!data) return;
  pen.properties = {
    fontname: String(data.fontname ?? ''),
    fontsize: String(data.fontsize ?? ''),
    bold: data.bold === true,
    italic: data.italic === true,
    underline: data.underline === true,
    strikethrough: data.strikethrough === true,
    forecolor: String(data.forecolor ?? ''),
    hilitecolor: data.highlight === true ? String(data.hilitecolor ?? '') : '',
  };
  if (pen.active) applyToCursor(editor);
  editor.focus();
}

export default definePlugin({
  name: 'permanentpen',
  toolbar: 'permanentpen',
  prosemirrorPlugins: (editor) => [
    new Plugin({
      // While the pen is on, the marks for typing at the cursor are the pen's (after Enter, a click,
      // arrows): typed and composed (IME) text both take stored marks.
      appendTransaction(_transactions, _old, state) {
        const pen = penOf(editor);
        if (!pen.active || !state.selection.empty) return null;
        const want = marksForCursor(state, penMarks(state.schema, pen.properties));
        const current = state.storedMarks ?? state.selection.$from.marks();
        return Mark.sameSet(current, want) ? null : state.tr.setStoredMarks(want);
      },
    }),
  ],
  setup(editor: Editor) {
    const labels = pickLabels(editor, 'permanentpen', LABELS);
    const pen = penOf(editor);
    editor.ui.registry.addButton('permanentpen', {
      icon: icons.permanentPen,
      tooltip: labels.button,
      isActive: () => pen.active,
      isEnabled: (e) => e.isEditable(),
      onAction: (e) => {
        pen.active = !pen.active;
        applyToCursor(e);
        e.updateUI();
        e.ui.announce(pen.active ? labels.on : labels.off);
        e.focus();
      },
    });
    editor.ui.registry.addMenuItem('configurepermanentpen', {
      text: labels.configure,
      isEnabled: (e) => e.isEditable(),
      onAction: (e) => void configure(e),
    });
    return () => pens.delete(editor);
  },
});
