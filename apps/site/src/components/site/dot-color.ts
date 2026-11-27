/** A color as the dot field draws it: red, green, blue (0–255) and alpha (0–1). */
export type Rgba = [number, number, number, number];

const HEX = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

/**
 * Reads a CSS custom property value: `rgb(124 92 196 / 30%)`, `rgba(124, 92, 196, 0.3)` or hex. The
 * production build minifies the colors in style sheets to hex (`#7c5cc44d`), the source has rgb().
 */
export function parseColor(value: string, fallback: Rgba): Rgba {
  const text = value.trim();
  const hex = HEX.exec(text)?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? [...hex].map((d) => d + d) : hex.match(/../g)!;
    const [r, g, b, a] = digits.map((pair) => Number.parseInt(pair, 16));
    return [r!, g!, b!, a === undefined ? 1 : a / 255];
  }
  if (!/^rgba?\(/i.test(text)) return fallback;
  const parts = text.match(/[\d.]+%?/g);
  if (!parts || parts.length < 3) return fallback;
  const alpha = parts[3];
  return [
    Number.parseFloat(parts[0]!),
    Number.parseFloat(parts[1]!),
    Number.parseFloat(parts[2]!),
    alpha === undefined
      ? 1
      : alpha.endsWith('%')
        ? Number.parseFloat(alpha) / 100
        : Number.parseFloat(alpha),
  ];
}
