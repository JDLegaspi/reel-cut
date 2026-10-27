import type { Style } from "../../src/schemas/style.ts";
import { DEFAULT_STYLE } from "../../src/style/default.ts";

export const LIGHT_STYLE: Style = {
  version: 1,
  palette: {
    backdrop: ["#f4efe6", "#f4efe6"],
    surface: "#ffffff",
    onSurface: "#1d1d1f",
    onSurfaceMuted: "#55534e",
    onBackdrop: "#1d1d1f",
    onBackdropMuted: "#55534e",
    accent: "#d9480f",
    onAccent: "#1d1d1f",
    positive: "#0f8a4f",
    negative: "#d1342f",
    tints: ["#ff5a1f", "#1d4ed8", "#0f8a4f", "#a16207"],
  },
  type: { display: "Space Grotesk", body: "Space Grotesk", displayWeight: 700, tracking: "normal", headlineCase: "uppercase" },
  shape: { radius: 8, cards: "outline", shadow: "none", tilt: false },
  backdrop: { kind: "flat", drift: false },
  motion: "calm",
  flourishes: { bursts: false, coins: false, glow: false, shake: false },
  icons: { stroke: 1.5, tiles: "outline" },
  emphasis: "highlight",
  layout: { speaker: "full", captions: "none" },
  notes: "A flat, editorial test style that differs from the default in every setting.",
};

export const TEST_STYLES: [string, Style][] = [
  ["default", DEFAULT_STYLE],
  ["light", LIGHT_STYLE],
];
