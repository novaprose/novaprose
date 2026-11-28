import { describe, expect, it } from 'vitest';
import { fitWithin, hasMetadata, optimizeImage } from '../src/image-optimize';

/** The parts of image preparation that need no image decoder (the rest runs in e2e/image-optimize.spec.ts). */

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)),
  );

describe('fitWithin', () => {
  it('scales down to fit, keeps the proportions, never scales up', () => {
    expect(fitWithin(4000, 3000, 2560, 2560)).toEqual({ width: 2560, height: 1920 });
    expect(fitWithin(3000, 4000, 2560, 2560)).toEqual({ width: 1920, height: 2560 });
    expect(fitWithin(800, 600, 2560, 2560)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 10, 1000, 1000)).toEqual({ width: 1000, height: 1 });
  });
});

describe('hasMetadata', () => {
  const app = (marker: number, payload: string) => [
    0xff,
    marker,
    0,
    payload.length + 2,
    ...[...payload].map((c) => c.charCodeAt(0)),
  ];

  it('JPEG: EXIF/XMP (APP1) and IPTC (APP13) count, the JFIF header and ICC profile do not', () => {
    const sos = [0xff, 0xda, 0, 2];
    expect(hasMetadata(bytes([0xff, 0xd8], app(0xe0, 'JFIF\0'), sos), 'image/jpeg')).toBe(false);
    expect(
      hasMetadata(
        bytes([0xff, 0xd8], app(0xe0, 'JFIF\0'), app(0xe1, 'Exif\0\0II*'), sos),
        'image/jpeg',
      ),
    ).toBe(true);
    expect(hasMetadata(bytes([0xff, 0xd8], app(0xed, 'Photoshop 3.0'), sos), 'image/jpeg')).toBe(
      true,
    );
    expect(hasMetadata(bytes([0xff, 0xd8], app(0xe2, 'ICC_PROFILE'), sos), 'image/jpeg')).toBe(
      false,
    );
    // Fill bytes before a marker.
    expect(hasMetadata(bytes([0xff, 0xd8, 0xff], app(0xe1, 'Exif\0\0'), sos), 'image/jpeg')).toBe(
      true,
    );
  });

  it('PNG: eXIf and text chunks count; WebP: EXIF and XMP chunks count', () => {
    const chunk = (name: string, data = '') => [
      0,
      0,
      0,
      data.length,
      ...[...name, ...data].map((c) => c.charCodeAt(0)),
      0,
      0,
      0,
      0,
    ];
    const png = (...chunks: number[][]) =>
      bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ...chunks);
    expect(hasMetadata(png(chunk('IHDR', 'x'.repeat(13)), chunk('IDAT', 'x')), 'image/png')).toBe(
      false,
    );
    expect(
      hasMetadata(
        png(chunk('IHDR', 'x'.repeat(13)), chunk('eXIf', 'II*'), chunk('IDAT')),
        'image/png',
      ),
    ).toBe(true);
    expect(
      hasMetadata(
        png(chunk('IHDR', 'x'.repeat(13)), chunk('tEXt', 'k\0v'), chunk('IDAT')),
        'image/png',
      ),
    ).toBe(true);
    const riff = (...names: string[]) =>
      bytes('RIFF', [0, 0, 0, 0], 'WEBP', ...names.flatMap((n) => [n, [2, 0, 0, 0], 'xx']));
    expect(hasMetadata(riff('VP8X', 'VP8 '), 'image/webp')).toBe(false);
    expect(hasMetadata(riff('VP8X', 'VP8 ', 'EXIF'), 'image/webp')).toBe(true);
  });
});

describe('optimizeImage', () => {
  it('GIF, SVG and files the browser can’t decode go as they are', async () => {
    const gif = new File([bytes('GIF89a')], 'a.gif', { type: 'image/gif' });
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    // jsdom has no image decoder: the original comes back instead of an error.
    const jpeg = new File([bytes([0xff, 0xd8, 0xff, 0xd9])], 'a.jpg', { type: 'image/jpeg' });
    for (const file of [gif, svg, jpeg]) expect(await optimizeImage(file)).toBe(file);
  });
});
