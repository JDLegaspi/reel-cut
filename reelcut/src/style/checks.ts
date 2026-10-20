import { StyleSchema, type Style } from "../schemas/style.ts";
import { contrastRatio } from "./color.ts";
import { closestFonts, isGoogleFont } from "./fonts.ts";

export { contrastRatio };

const TEXT_CONTRAST = 4.5;
const LARGE_CONTRAST = 3;

function fontProblems(style: Style): string[] {
  return (["display", "body"] as const).flatMap((role) => {
    const family = style.type[role];
    if (isGoogleFont(family)) return [];
    const suggestions = closestFonts(family).map((name) => `"${name}"`);
    return [`type.${role}: "${family}" is not a Google Font; did you mean ${suggestions.join(" or ")}?`];
  });
}

function contrastProblems(style: Style): string[] {
  const { palette } = style;
  const pairs: [string, string, string, string, number][] = [
    ["onSurface", palette.onSurface, "surface", palette.surface, TEXT_CONTRAST],
    ["onSurfaceMuted", palette.onSurfaceMuted, "surface", palette.surface, TEXT_CONTRAST],
    ["onBackdrop", palette.onBackdrop, "backdrop.0", palette.backdrop[0], LARGE_CONTRAST],
    ["onBackdrop", palette.onBackdrop, "backdrop.1", palette.backdrop[1], LARGE_CONTRAST],
    ["onAccent", palette.onAccent, "accent", palette.accent, LARGE_CONTRAST],
    ["accent", palette.accent, "backdrop.0", palette.backdrop[0], LARGE_CONTRAST],
    ["accent", palette.accent, "backdrop.1", palette.backdrop[1], LARGE_CONTRAST],
  ];
  return pairs.flatMap(([name, color, behindName, behind, minimum]) => {
    const ratio = contrastRatio(color, behind);
    if (ratio >= minimum) return [];
    return [`palette.${name} (${color}) on palette.${behindName} (${behind}) has contrast ${ratio}:1; it needs at least ${minimum}:1`];
  });
}

export function styleProblems(value: unknown): { errors: string[]; contrast: string[]; style: Style | null } {
  const parsed = StyleSchema.safeParse(value);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => `${issue.path.join(".") || "style"}: ${issue.message}`);
    return { errors, contrast: [], style: null };
  }
  const errors = fontProblems(parsed.data);
  return { errors, contrast: contrastProblems(parsed.data), style: errors.length === 0 ? parsed.data : null };
}
