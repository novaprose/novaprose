// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { NovaProseEditor, useEditor } from '../src';

// Nuxt и другой SSR: импорт пакета и рендер не должны трогать window/document.
describe('SSR', () => {
  it('renderToString работает без DOM', async () => {
    expect(typeof window).toBe('undefined');
    const app = createSSRApp({
      render: () => h(NovaProseEditor, { id: 'body', name: 'body', defaultValue: '<p>a</p>' }),
    });
    const html = await renderToString(app);
    expect(html).toContain('id="body"');
    expect(html).toContain('name="body"');
  });

  it('useEditor на сервере оставляет editor = null', async () => {
    let seen: unknown = 'не вызван';
    const App = defineComponent(() => {
      const { el, editor } = useEditor({ content: '<p>a</p>' });
      seen = editor.value;
      return () => h('div', { ref: el });
    });
    await renderToString(createSSRApp(App));
    expect(seen).toBeNull();
  });
});
