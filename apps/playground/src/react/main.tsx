import '@novaprose/core/style.css';
import '../playground.css';
import {
  NovaProseEditor,
  useCommand,
  useEditor,
  useEditorState,
  type CommandName,
  type Editor,
} from '@novaprose/react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * React-песочница: компонент в форме (controlled + FormData) и headless-редактор со своим тулбаром
 * на хуках. Работает в StrictMode — так ловим ошибки двойного монтирования. Её же гоняет e2e.
 */

const INITIAL = '<p>Привет из <strong>React</strong>!</p>';

function FormDemo() {
  const [value, setValue] = useState(INITIAL);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [changes, setChanges] = useState(0);
  return (
    <section className="pg-react-block" aria-labelledby="form-title">
      <h2 id="form-title">Компонент в форме</h2>
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
          <button type="submit">Отправить</button>
          <button type="button" onClick={() => setValue(INITIAL)}>
            Сбросить
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
  ['bold', 'Ж'],
  ['italic', 'К'],
  ['h2', 'H2'],
  ['bulletList', '• Список'],
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
      // mousedown не уводит фокус из редактора — выделение сохраняется.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => run()}
    >
      {label}
    </button>
  );
}

function HeadlessDemo() {
  const { ref, editor } = useEditor({
    content: '<p>Свой тулбар на хуках useEditor и useCommand.</p>',
    toolbar: false,
    statusbar: false,
  });
  const stats = useEditorState(editor, (e) => ({
    words: e.getText().trim().split(/\s+/).filter(Boolean).length,
    canUndo: e.can('undo'),
  }));
  return (
    <section className="pg-react-block" aria-labelledby="headless-title">
      <h2 id="headless-title">Headless: свой тулбар</h2>
      <div role="toolbar" aria-label="Свой тулбар" className="pg-react-toolbar">
        {BUTTONS.map(([command, label]) => (
          <CommandButton key={command} editor={editor} command={command} label={label} />
        ))}
        <button type="button" disabled={!stats?.canUndo} onClick={() => editor?.exec('undo')}>
          Отменить
        </button>
      </div>
      <div ref={ref} data-testid="headless" />
      <p>
        Слов: <output data-testid="words">{stats?.words ?? 0}</output>
      </p>
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
    </main>
  </StrictMode>,
);
