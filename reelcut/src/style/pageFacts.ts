import { rgbToHex } from "./color.ts";

export type PageSample = {
  tag: string;
  role: "body" | "heading" | "button" | "other";
  background: string;
  color: string;
  area: number;
  fontFamily: string;
};

export type PageFacts = {
  colors: { hex: string; share: number; use: "background" | "text" }[];
  variables: Record<string, string>;
  fonts: { body: string | null; headings: string | null; buttons: string | null };
};

const TOP_COLORS = 8;
const MAX_VARIABLES = 40;
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "-apple-system",
  "blinkmacsystemfont",
  "emoji",
  "math",
]);

export function toHex(value: string): string | null {
  const text = value.trim().toLowerCase();
  const short = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const long = text.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (long) return long[2] !== undefined && parseInt(long[2], 16) < 128 ? null : `#${long[1]}`;
  const rgb = text.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+)(%?))?\s*\)$/);
  if (!rgb) return null;
  const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] ? 100 : 1);
  if (alpha < 0.5) return null;
  return rgbToHex([Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]);
}

function firstFamily(stack: string): string | null {
  for (const part of stack.split(",")) {
    const family = part.trim().replace(/^["']|["']$/g, "");
    if (family && !GENERIC_FAMILIES.has(family.toLowerCase())) return family;
  }
  return null;
}

function ranked(samples: PageSample[], pick: (sample: PageSample) => string | null): [string, number][] {
  const totals = new Map<string, number>();
  for (const sample of samples) {
    const key = pick(sample);
    if (key) totals.set(key, (totals.get(key) ?? 0) + sample.area);
  }
  return [...totals].sort((a, b) => b[1] - a[1]);
}

function shares(samples: PageSample[], use: "background" | "text"): PageFacts["colors"] {
  const totals = ranked(samples, (sample) => toHex(use === "background" ? sample.background : sample.color));
  const sum = totals.reduce((total, [, area]) => total + area, 0);
  return totals.slice(0, TOP_COLORS).map(([hex, area]) => ({ hex, share: Math.round((area / sum) * 1000) / 1000, use }));
}

function mainFont(samples: PageSample[], role: PageSample["role"]): string | null {
  return ranked(
    samples.filter((sample) => sample.role === role),
    (sample) => firstFamily(sample.fontFamily),
  )[0]?.[0] ?? null;
}

export function summarizeFacts(samples: PageSample[], variables: Record<string, string>): PageFacts {
  const colorVariables = Object.entries(variables)
    .map(([name, value]) => [name, toHex(value)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null)
    .slice(0, MAX_VARIABLES);
  return {
    colors: [...shares(samples, "background"), ...shares(samples, "text")],
    variables: Object.fromEntries(colorVariables),
    fonts: { body: mainFont(samples, "body"), headings: mainFont(samples, "heading"), buttons: mainFont(samples, "button") },
  };
}
