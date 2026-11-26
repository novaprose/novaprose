import { NovaProseEditor } from '@novaprose/react';
import { useState } from 'react';
import { callout } from './callout';

const INITIAL =
  '<h2>NovaProse + React</h2>' +
  '<p>Edit this text. The box below is a <strong>React component</strong> inside the document.</p>' +
  '<div data-callout="" data-tone="info"><p>Pick a tone in the list: it is an attribute of the node.</p></div>' +
  '<p>A formula: <span data-type="inline-math" data-latex="E=mc^2"></span>. Type <code>$a^2$</code> for another.</p>';

export function App() {
  const [html, setHtml] = useState(INITIAL);
  return (
    <main>
      <NovaProseEditor
        defaultValue={INITIAL}
        onChange={setHtml}
        plugins={[callout, 'math', 'codesample']}
        init={{
          toolbar:
            'undo redo | blocks | bold italic link | bullist numlist | callout math codesample',
        }}
      />
      <h3>HTML</h3>
      <pre>{html}</pre>
    </main>
  );
}
