// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NovaProseEditor, useEditor } from '../src';

// Server rendering (Next.js, Remix): importing the package and rendering must not touch window/document.
describe('SSR', () => {
  it('import and renderToString work without a DOM', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToString(
      <NovaProseEditor id="body" className="field" name="body" defaultValue="<p>a</p>" />,
    );
    expect(html).toContain('id="body"');
    expect(html).toContain('name="body"');
  });

  it('useEditor on the server returns editor = null', () => {
    let seen: unknown = 'not called';
    function App() {
      const { ref, editor } = useEditor({ content: '<p>a</p>' });
      seen = editor;
      return <div ref={ref} />;
    }
    renderToString(<App />);
    expect(seen).toBeNull();
  });
});
