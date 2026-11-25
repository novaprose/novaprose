// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('SSR', () => {
  it('импорт пакета и define не падают без DOM', async () => {
    expect(typeof window).toBe('undefined');
    const mod = await import('../src');
    expect(() => mod.defineNovaProseEditor()).not.toThrow();
    await import('../src/define');
  });
});
