// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NovaProseEditor, useEditor } from '../src';

// Серверный рендер (Next.js, Remix): импорт пакета и рендер не должны трогать window/document.
describe('SSR', () => {
  it('импорт и renderToString работают без DOM', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToString(
      <NovaProseEditor id="body" className="field" name="body" defaultValue="<p>a</p>" />,
    );
    expect(html).toContain('id="body"');
    expect(html).toContain('name="body"');
  });

  it('useEditor на сервере возвращает editor = null', () => {
    let seen: unknown = 'не вызван';
    function App() {
      const { ref, editor } = useEditor({ content: '<p>a</p>' });
      seen = editor;
      return <div ref={ref} />;
    }
    renderToString(<App />);
    expect(seen).toBeNull();
  });
});
