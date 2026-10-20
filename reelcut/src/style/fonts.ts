import { getAvailableFonts } from "@remotion/google-fonts";
import type { FontFile } from "../../remotion/props.ts";
import type { Style } from "../schemas/style.ts";

const AVAILABLE = getAvailableFonts();
const FAMILIES = AVAILABLE.map((font) => font.fontFamily);
const BODY_WEIGHTS = [500, 700, 800];
const SUBSETS = ["latin", "latin-ext"];
const BY_LOWER = new Map(FAMILIES.map((family) => [family.toLowerCase(), family]));

export function isGoogleFont(family: string): boolean {
  return BY_LOWER.get(family.toLowerCase()) === family;
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length]!;
}

export function closestFonts(family: string, n = 3): string[] {
  const wanted = family.toLowerCase();
  const exact = BY_LOWER.get(wanted);
  if (exact) return [exact];
  return FAMILIES.map((candidate) => {
    const lower = candidate.toLowerCase();
    const prefix = lower.startsWith(wanted) || wanted.startsWith(lower) ? 0 : 1;
    return { candidate, prefix, distance: levenshtein(wanted, lower) };
  })
    .sort((a, b) => a.prefix - b.prefix || a.distance - b.distance || a.candidate.length - b.candidate.length)
    .slice(0, n)
    .map((match) => match.candidate);
}

export function nearestWeight(available: string[], wanted: number): string {
  return [...available].sort((a, b) => Math.abs(Number(a) - wanted) - Math.abs(Number(b) - wanted) || Number(b) - Number(a))[0]!;
}

export async function resolveFontFiles(style: Style): Promise<FontFile[]> {
  const wanted = new Map<string, number[]>();
  wanted.set(style.type.display, [style.type.displayWeight]);
  wanted.set(style.type.body, [...(wanted.get(style.type.body) ?? []), ...BODY_WEIGHTS]);

  const files: FontFile[] = [];
  for (const [family, weights] of wanted) {
    const font = AVAILABLE.find((candidate) => candidate.fontFamily === family);
    if (!font) throw new Error(`"${family}" is not a Google Font`);
    const info = (await font.load()).getInfo();
    const normal = info.fonts.normal ?? {};
    const chosen = [...new Set(weights.map((weight) => nearestWeight(Object.keys(normal), weight)))];
    for (const weight of chosen) {
      for (const subset of SUBSETS) {
        const url = normal[weight]?.[subset];
        if (url) files.push({ family, weight, url, unicodeRange: info.unicodeRanges[subset] ?? "U+0000-00FF" });
      }
    }
  }
  return files;
}
