import '@novaprose/core/style.css';
import '../playground.css';
import {
  NodeViewContent,
  NovaProseEditor,
  reactNodeView,
  useCommand,
  useEditor,
  useEditorState,
  type CommandName,
  type Editor,
  type NodeViewProps,
} from '@novaprose/react';
import { createContext, StrictMode, useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CALLOUT_CONTENT, calloutPlugin, TONES } from '../callout';

/**
 * The React playground: the component in a form (controlled + FormData) and a headless editor with its own toolbar
 * built on hooks. Runs in StrictMode to catch double-mount bugs. e2e drives it too.
 */

const INITIAL = '<p>Hello from <strong>React</strong>!</p>';

function FormDemo() {
  const [value, setValue] = useState(INITIAL);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [changes, setChanges] = useState(0);
  return (
    <section className="pg-react-block" aria-labelledby="form-title">
      <h2 id="form-title">The component in a form</h2>
      <form
        data-testid="form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(String(new FormData(event.currentTarget).get('body')));
        }}
      >
        <NovaProseEditor
          name="body"
          value={value}
          onChange={(html) => {
            setValue(html);
            setChanges((n) => n + 1);
          }}
          init={{ toolbar: 'undo redo | bold italic | bullist numlist', statusbar: false }}
        />
        <div className="pg-react-actions">
          <button type="submit">Submit</button>
          <button type="button" onClick={() => setValue(INITIAL)}>
            Reset
          </button>
        </div>
      </form>
      <p>
        onChange: <output data-testid="changes">{changes}</output>
      </p>
      <pre data-testid="value">{value}</pre>
      {submitted !== null && <pre data-testid="submitted">{submitted}</pre>}
    </section>
  );
}

const BUTTONS: Array<[CommandName, string]> = [
  ['bold', 'B'],
  ['italic', 'I'],
  ['h2', 'H2'],
  ['bulletList', '• List'],
];

function CommandButton({
  editor,
  command,
  label,
}: {
  editor: Editor | null;
  command: CommandName;
  label: string;
}) {
  const { active, enabled, run } = useCommand(editor, command);
  return (
    <button
      type="button"
      data-command={command}
      aria-pressed={active}
      disabled={!enabled && !active}
      // mousedown doesn't take focus from the editor: the selection is kept.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => run()}
    >
      {label}
    </button>
  );
}

function HeadlessDemo() {
  const { ref, editor } = useEditor({
    content: '<p>A custom toolbar on the useEditor and useCommand hooks.</p>',
    toolbar: false,
    statusbar: false,
  });
  const stats = useEditorState(editor, (e) => ({
    words: e.getText().trim().split(/\s+/).filter(Boolean).length,
    canUndo: e.can('undo'),
  }));
  return (
    <section className="pg-react-block" aria-labelledby="headless-title">
      <h2 id="headless-title">Headless: a custom toolbar</h2>
      <div role="toolbar" aria-label="Custom toolbar" className="pg-react-toolbar">
        {BUTTONS.map(([command, label]) => (
          <CommandButton key={command} editor={editor} command={command} label={label} />
        ))}
        <button type="button" disabled={!stats?.canUndo} onClick={() => editor?.exec('undo')}>
          Undo
        </button>
      </div>
      <div ref={ref} data-testid="headless" />
      <p>
        Words: <output data-testid="words">{stats?.words ?? 0}</output>
      </p>
    </section>
  );
}

const Theme = createContext('light');

/** A node view in React: its own fields (they don't reach the document text) and the content in its place. */
function Callout({ node, updateAttributes }: NodeViewProps) {
  const theme = useContext(Theme);
  return (
    <div className="pg-callout" data-tone={String(node.attrs.tone)}>
      <div className="pg-callout-bar" contentEditable={false}>
        <select
          aria-label="Callout tone"
          value={String(node.attrs.tone)}
          onChange={(event) => updateAttributes({ tone: event.target.value })}
        >
          {TONES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label="Callout title"
          placeholder="Title"
          value={String(node.attrs.title)}
          onChange={(event) => updateAttributes({ title: event.target.value })}
        />
        <span data-testid="nv-theme">{theme}</span>
      </div>
      <NodeViewContent className="pg-callout-body" />
    </div>
  );
}

const callout = calloutPlugin(reactNodeView(Callout));

function NodeViewsDemo() {
  const [html, setHtml] = useState(CALLOUT_CONTENT);
  return (
    <section className="pg-react-block" aria-labelledby="nv-title">
      <h2 id="nv-title">A node view as a React component</h2>
      <Theme.Provider value="dark">
        <NovaProseEditor
          plugins={[callout]}
          defaultValue={CALLOUT_CONTENT}
          onChange={setHtml}
          init={{ toolbar: 'undo redo | bold italic', statusbar: false }}
          className="pg-node-views"
        />
      </Theme.Provider>
      <pre data-testid="nv-html">{html}</pre>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="pg-react">
      <h1>
        NovaProse <span className="pg-badge">React</span>
      </h1>
      <FormDemo />
      <HeadlessDemo />
      <NodeViewsDemo />
    </main>
  </StrictMode>,
);
