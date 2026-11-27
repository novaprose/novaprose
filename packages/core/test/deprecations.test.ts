import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type CommandName, type Editor, type EditorEvent } from '../src';
import { RENAMED, currentName, renameOptions, type Renames } from '../src/deprecations';

/**
 * Renamed options, commands and events keep working under their old names and warn once in the console,
 * naming the replacement: the promise of novaprose.com/project/versioning/ for 1.0. Nothing is renamed
 * yet, so these tests rename things for a moment.
 */

const editors: Editor[] = [];
const saved: Renames = {
  options: { ...RENAMED.options },
  commands: { ...RENAMED.commands },
  events: { ...RENAMED.events },
};
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  RENAMED.options = { ...saved.options };
  RENAMED.commands = { ...saved.commands };
  RENAMED.events = { ...saved.events };
  vi.restoreAllMocks();
});

function mount(options: Record<string, unknown>): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, ...options });
  editors.push(editor);
  return editor;
}

/** Each test uses names of its own: a name warns only once per page. */
let id = 0;
const fresh = (base: string) => `${base}${++id}`;

describe('deprecated names', () => {
  it('nothing is renamed today', () => {
    expect(RENAMED).toEqual({ options: {}, commands: {}, events: {} });
  });

  it('currentName maps an old name to the new one and warns once, naming the replacement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const old = fresh('strikethrough');
    const renamed: Renames = { options: {}, commands: { [old]: 'strike' }, events: {} };
    expect(currentName('commands', old, renamed)).toBe('strike');
    expect(currentName('commands', old, renamed)).toBe('strike');
    expect(currentName('commands', 'bold', renamed)).toBe('bold');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toBe(
      `[nova] the command "${old}" is deprecated: use "strike". Old names keep working for at least one minor version (https://novaprose.com/project/versioning/).`,
    );
  });

  it('renameOptions moves an old option to its new name; the new name wins when both are given', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const old = fresh('placeholderText');
    const renamed: Renames = { options: { [old]: 'placeholder' }, commands: {}, events: {} };
    const original = { [old]: 'Type here', language: 'en' };
    expect(renameOptions(original, renamed)).toEqual({ placeholder: 'Type here', language: 'en' });
    // The caller's object stays as it was.
    expect(original).toEqual({ [old]: 'Type here', language: 'en' });
    expect(renameOptions({ [old]: 'old', placeholder: 'new' }, renamed)).toEqual({
      placeholder: 'new',
    });
    const untouched = { language: 'en' };
    expect(renameOptions(untouched, renamed)).toBe(untouched);
  });

  it('an editor accepts a renamed option, command and event', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const option = fresh('placeholderText');
    const command = fresh('strikethrough');
    const event = fresh('selectionchange');
    RENAMED.options = { [option]: 'placeholder' };
    RENAMED.commands = { [command]: 'strike' };
    RENAMED.events = { [event]: 'selectionChange' };

    const editor = mount({ content: '<p>one two</p>', [option]: 'Type here' });
    expect(editor.view.dom.getAttribute('data-placeholder')).toBe('Type here');

    const changes: unknown[] = [];
    const listener = () => changes.push(1);
    editor.on(event as EditorEvent, listener);
    const { state } = editor.view;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, 4)));
    expect(changes).toHaveLength(1);

    expect(editor.can(command as CommandName)).toBe(true);
    expect(editor.exec(command as CommandName)).toBe(true);
    expect(editor.getHTML()).toBe('<p><s>one</s> two</p>');
    expect(editor.isActive(command as CommandName)).toBe(true);

    // Unsubscribing under the old name works too.
    const heard = changes.length;
    editor.off(event as EditorEvent, listener);
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 2)),
    );
    expect(changes).toHaveLength(heard);

    // One warning per old name, however often it is used.
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((m) => m.includes(`"${option}"`))).toHaveLength(1);
    expect(messages.filter((m) => m.includes(`"${command}"`))).toHaveLength(1);
    expect(messages.filter((m) => m.includes(`"${event}"`))).toHaveLength(1);
  });
});
