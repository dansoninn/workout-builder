// Colour maths for checking the design tokens: OKLCH → sRGB → WCAG contrast.
// OKLab matrices from Björn Ottosson, "A perceptual color space for image
// processing" (2020); luminance and contrast per WCAG 2.2.

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Linear-light sRGB, clamped to the displayable gamut. */
export function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Oklch, b: Oklch): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Opaque `--token: oklch(L C H);` declarations in one CSS block. */
export function parseOklchTokens(css: string): Record<string, Oklch> {
  const tokens: Record<string, Oklch> = {};
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)\s*;/g)) {
    const [, name, l, c, h] = match;
    if (name && l && c && h) tokens[name] = { l: Number(l), c: Number(c), h: Number(h) };
  }
  return tokens;
}

/** The light (`:root, .light`) and dark (`.dark`) token blocks of globals.css. */
export function themeTokens(css: string): { light: Record<string, Oklch>; dark: Record<string, Oklch> } {
  const block = (selector: RegExp) => {
    const start = css.search(selector);
    if (start < 0) throw new Error(`token block not found: ${selector}`);
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    return css.slice(open + 1, close);
  };
  return {
    light: parseOklchTokens(block(/^:root,\s*\n?\.light\s*\{/m)),
    dark: parseOklchTokens(block(/^\.dark\s*\{/m)),
  };
}
