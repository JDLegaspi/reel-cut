import type { SpringConfig } from "remotion";
import type { ColorRole, Style } from "../../src/schemas/style.ts";
import { contrastRatio, hexToRgb, luminance, rgbToHex } from "../../src/style/color.ts";

export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function mix(a: string, b: string, t: number): string {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((k) => from[k]! + (to[k]! - from[k]!) * t) as [number, number, number]);
}

export function lighten(hex: string, t: number): string {
  return mix(hex, "#ffffff", t);
}

export function darken(hex: string, t: number): string {
  return mix(hex, "#000000", t);
}

export function bezel(style: Style): string {
  const { onSurface, backdrop } = style.palette;
  return darken(luminance(onSurface) < luminance(backdrop[1]) ? onSurface : backdrop[1], 0.7);
}

export function roleColor(style: Style, role: ColorRole): string {
  const { palette } = style;
  switch (role) {
    case "accent":
      return palette.accent;
    case "positive":
      return palette.positive;
    case "negative":
      return palette.negative;
    case "tint1":
      return palette.tints[0];
    case "tint2":
      return palette.tints[1];
    case "tint3":
      return palette.tints[2];
    case "tint4":
      return palette.tints[3];
  }
}

export function readableOn(style: Style, background: string): string {
  const { palette } = style;
  const candidates = [palette.onSurface, palette.surface, palette.onBackdrop, palette.onAccent];
  return candidates.reduce((best, candidate) => (contrastRatio(candidate, background) > contrastRatio(best, background) ? candidate : best));
}

export function shadowColor(style: Style): string {
  return mix(style.palette.backdrop[1], "#000000", 0.6);
}

export function shadowFor(style: Style, depth: "card" | "small"): string | undefined {
  const color = shadowColor(style);
  switch (style.shape.shadow) {
    case "none":
      return undefined;
    case "soft":
      return depth === "card" ? `0 18px 44px ${alpha(color, 0.22)}` : `0 8px 20px ${alpha(color, 0.18)}`;
    case "deep":
      return depth === "card" ? `0 40px 90px ${alpha(color, 0.45)}` : `0 18px 40px ${alpha(color, 0.3)}`;
  }
}

export function springFor(style: Style): Partial<SpringConfig> {
  return style.motion === "lively" ? { damping: 13, stiffness: 170, mass: 0.7 } : { damping: 20, stiffness: 110, mass: 0.9 };
}

export function fontStack(family: string): string {
  return `"${family}", Helvetica, Arial, sans-serif`;
}

export function tracking(style: Style, size: number): number {
  return style.type.tracking === "tight" ? Math.round(-size * 0.035) : 0;
}

export function headline(style: Style, text: string): string {
  return style.type.headlineCase === "uppercase" ? text.toUpperCase() : text;
}
