import { describe, expect, it } from 'vitest';
import { parseColor, type Rgba } from '../src/components/site/dot-color';

/**
 * The dot field reads its colors from CSS custom properties. The production build minifies them to hex
 * (`rgb(226 219 255 / 78%)` becomes `#e2dbffc7`), so both forms must read the same.
 */

const FALLBACK: Rgba = [1, 2, 3, 0.5];

describe('parseColor', () => {
  it('reads rgb() in both syntaxes', () => {
    expect(parseColor('rgb(124 92 196 / 30%)', FALLBACK)).toEqual([124, 92, 196, 0.3]);
    expect(parseColor('rgba(124, 92, 196, 0.3)', FALLBACK)).toEqual([124, 92, 196, 0.3]);
    expect(parseColor(' rgb(226 219 255) ', FALLBACK)).toEqual([226, 219, 255, 1]);
  });

  it('reads hex, the form a minified build serves', () => {
    expect(parseColor('#e2dbffc7', FALLBACK)).toEqual([226, 219, 255, 199 / 255]);
    expect(parseColor('#fdfcff', FALLBACK)).toEqual([253, 252, 255, 1]);
    expect(parseColor('#7c5cc44d', FALLBACK)).toEqual([124, 92, 196, 77 / 255]);
    expect(parseColor(' #fff ', FALLBACK)).toEqual([255, 255, 255, 1]);
    expect(parseColor('#0008', FALLBACK)).toEqual([0, 0, 0, 136 / 255]);
  });

  it('anything else gives the fallback', () => {
    expect(parseColor('', FALLBACK)).toBe(FALLBACK);
    expect(parseColor('purple', FALLBACK)).toBe(FALLBACK);
    expect(parseColor('#12345', FALLBACK)).toBe(FALLBACK);
    expect(parseColor('#gg0000', FALLBACK)).toBe(FALLBACK);
  });
});
