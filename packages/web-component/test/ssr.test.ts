// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('SSR', () => {
  it("importing the package and define don't crash without a DOM", async () => {
    expect(typeof window).toBe('undefined');
    const mod = await import('../src');
    expect(() => mod.defineNovaProseEditor()).not.toThrow();
    await import('../src/define');
  });
});
