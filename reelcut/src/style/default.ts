import type { Style } from "../schemas/style.ts";

export const DEFAULT_STYLE: Style = {
  version: 1,
  palette: {
    backdrop: ["#2445ff", "#070b3a"],
    surface: "#ffffff",
    onSurface: "#0b1020",
    onSurfaceMuted: "#5b6478",
    onBackdrop: "#ffffff",
    onBackdropMuted: "#c9d1ff",
    accent: "#ffd43b",
    onAccent: "#0b1020",
    positive: "#22c55e",
    negative: "#f43f5e",
    tints: ["#2f5bff", "#7c5cff", "#22d3ee", "#f97316"],
  },
  type: { display: "Inter", body: "Inter", displayWeight: 900, tracking: "tight", headlineCase: "as-written" },
  shape: { radius: 40, cards: "solid", shadow: "deep", tilt: true },
  backdrop: { kind: "gradient", drift: true },
  motion: "lively",
  flourishes: { bursts: true, coins: true, glow: true, shake: false },
  icons: { stroke: 2.2, tiles: "filled" },
  emphasis: "solid",
  layout: { speaker: "full", captions: "none" },
  notes: "The built-in reelcut look: a vivid blue backdrop with drifting light, white cards with deep shadows, yellow, green and red accents, set in Inter.",
};
