// Applies a school's brand colour by overriding the --brand-* CSS variables
// that Tailwind's brand-50…800 classes read.

type RGB = [number, number, number];

const SHADES = ['50', '100', '400', '500', '600', '700', '800'] as const;

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  return a.map((v, i) => Math.round(v + (b[i] - v) * amount)) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Buttons put white text on the 600 shade, so a very light colour (e.g.
 * yellow) is darkened until white text on it stays readable.
 */
export function readableBase(hex: string): RGB {
  let base = hexToRgb(hex);
  for (let i = 0; i < 10 && luminance(base) > 0.18; i++) base = mix(base, [0, 0, 0], 0.15);
  return base;
}

export function brandShades(hex: string): Record<(typeof SHADES)[number], RGB> {
  const base = readableBase(hex);
  const white: RGB = [255, 255, 255];
  const black: RGB = [0, 0, 0];
  return {
    50: mix(base, white, 0.93),
    100: mix(base, white, 0.82),
    400: mix(base, white, 0.35),
    500: mix(base, white, 0.15),
    600: base,
    700: mix(base, black, 0.18),
    800: mix(base, black, 0.35),
  };
}

export function applyBrandColor(hex: string | null | undefined) {
  const root = document.documentElement.style;
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    SHADES.forEach((s) => root.removeProperty(`--brand-${s}`));
    return;
  }
  const shades = brandShades(hex);
  SHADES.forEach((s) => root.setProperty(`--brand-${s}`, shades[s].join(' ')));
}
