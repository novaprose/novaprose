// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { NovaProseEditor, useEditor } from '../src';

// Nuxt and other SSR: importing the package and rendering must not touch window/document.
describe('SSR', () => {
  it('renderToString works without a DOM', async () => {
    expect(typeof window).toBe('undefined');
    const app = createSSRApp({
      render: () => h(NovaProseEditor, { id: 'body', name: 'body', defaultValue: '<p>a</p>' }),
    });
    const html = await renderToString(app);
    expect(html).toContain('id="body"');
    expect(html).toContain('name="body"');
  });

  it('useEditor on the server leaves editor = null', async () => {
    let seen: unknown = 'not called';
    const App = defineComponent(() => {
      const { el, editor } = useEditor({ content: '<p>a</p>' });
      seen = editor.value;
      return () => h('div', { ref: el });
    });
    await renderToString(createSSRApp(App));
    expect(seen).toBeNull();
  });
});
