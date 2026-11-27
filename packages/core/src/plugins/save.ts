import { keymap } from 'prosemirror-keymap';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { pickLabels } from './shared';

/**
 * The save plugin (named as in TinyMCE): the `save` button (and Ctrl/Cmd+S) saves, `cancel` brings
 * back the text as it was at the last save (or at the start). Saving calls
 * `pluginOptions.save.onSave(editor)`; without it, the form around the editor is submitted (the
 * <novaprose-editor> element and tinymce.init put the text into the form themselves). By default the
 * button is enabled only when there are unsaved changes (`enableWhenDirty: false` — always).
 */

export const LABELS = {
  en: {
    save: 'Save',
    cancel: 'Cancel changes',
    saved: 'Saved',
    canceled: 'Changes canceled',
    failed: 'Could not save',
  },
};

export interface SaveOptions {
  /** Saves the document (for example, sends getHTML() to your server). May return a promise. */
  onSave?: (editor: Editor) => void | Promise<void>;
  /** Called after Cancel brought back the saved text. */
  onCancel?: (editor: Editor) => void;
  /** The Save button only when there are unsaved changes (true by default). */
  enableWhenDirty?: boolean;
}

interface SaveState {
  /** The text at the last save (or at the start). */
  saved: string;
  dirty: boolean;
  saving: boolean;
}

const states = new WeakMap<Editor, SaveState>();

function stateOf(editor: Editor): SaveState {
  let state = states.get(editor);
  if (!state) {
    state = { saved: editor.getHTML(), dirty: false, saving: false };
    states.set(editor, state);
  }
  return state;
}

const optionsOf = (editor: Editor) => (editor.options.pluginOptions?.save ?? {}) as SaveOptions;

/** Saves: your onSave, or the form around the editor. False when there is nothing to do. */
async function save(editor: Editor): Promise<boolean> {
  const state = stateOf(editor);
  const options = optionsOf(editor);
  const labels = pickLabels(editor, 'save', LABELS);
  const form = editor.root.closest('form');
  if (state.saving || (!options.onSave && !form)) return false;
  state.saving = true;
  editor.updateUI();
  const html = editor.getHTML();
  try {
    if (options.onSave) await options.onSave(editor);
    else if (form) {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    }
    state.saved = html;
    state.dirty = editor.getHTML() !== html;
    editor.ui.announce(labels.saved);
    return true;
  } catch (error) {
    editor.ui.notify({ type: 'error', text: labels.failed });
    console.error('[nova] save:', error);
    return false;
  } finally {
    state.saving = false;
    editor.updateUI();
  }
}

/** Brings back the text of the last save. */
function cancel(editor: Editor): void {
  const state = stateOf(editor);
  editor.setContent(state.saved);
  state.dirty = false;
  editor.updateUI();
  optionsOf(editor).onCancel?.(editor);
  editor.ui.announce(pickLabels(editor, 'save', LABELS).canceled);
}

export default definePlugin({
  name: 'save',
  toolbar: 'save cancel',
  prosemirrorPlugins: (editor) => [
    keymap({
      // Ctrl/Cmd+S saves; the browser's "Save page" is never what is meant inside the editor.
      'Mod-s': () => {
        void save(editor);
        return true;
      },
    }),
  ],
  setup(editor) {
    const labels = pickLabels(editor, 'save', LABELS);
    const state = stateOf(editor);
    const enableWhenDirty = optionsOf(editor).enableWhenDirty !== false;
    const offChange = editor.on('change', () => {
      if (state.dirty) return;
      state.dirty = true;
      editor.updateUI();
    });
    // setContent from your code is a new starting point, not an unsaved change.
    const offSet = editor.on('setContent', () => {
      state.saved = editor.getHTML();
      state.dirty = false;
      editor.updateUI();
    });
    const canSave = (e: Editor) =>
      e.isEditable() && !state.saving && (!enableWhenDirty || state.dirty);
    editor.ui.registry.addButton('save', {
      icon: icons.save,
      tooltip: labels.save,
      shortcut: 'Mod-s',
      isEnabled: canSave,
      onAction: (e) => void save(e),
    });
    editor.ui.registry.addButton('cancel', {
      icon: icons.cancelChanges,
      tooltip: labels.cancel,
      isEnabled: (e) => e.isEditable() && state.dirty && !state.saving,
      onAction: cancel,
    });
    return () => {
      offChange();
      offSet();
      states.delete(editor);
    };
  },
});
