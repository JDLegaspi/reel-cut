import { describe, expect, test } from "vitest";
import { contrastRatio, styleProblems } from "../src/style/checks.ts";
import { DEFAULT_STYLE } from "../src/style/default.ts";
import { closestFonts, isGoogleFont, nearestWeight, resolveFontFiles } from "../src/style/fonts.ts";
import { mergeStyle } from "../src/style/resolve.ts";
import { LIGHT_STYLE } from "./fixtures/styles.ts";

describe("styles", () => {
  test("the built-in default is a valid style with no problems", () => {
    expect(styleProblems(DEFAULT_STYLE)).toEqual({ errors: [], contrast: [], style: DEFAULT_STYLE });
  });

  test("merges overrides deeply and replaces arrays", () => {
    const merged = mergeStyle(DEFAULT_STYLE, { palette: { accent: "#ff0000" }, backdrop: { kind: "flat" } });
    expect(merged.palette.accent).toBe("#ff0000");
    expect(merged.palette.surface).toBe(DEFAULT_STYLE.palette.surface);
    expect(merged.backdrop).toEqual({ kind: "flat", drift: DEFAULT_STYLE.backdrop.drift });

    const tints = ["#111111", "#222222", "#333333", "#444444"] as [string, string, string, string];
    expect(mergeStyle(DEFAULT_STYLE, { palette: { tints } }).palette.tints).toEqual(tints);
    expect(DEFAULT_STYLE.palette.accent).not.toBe("#ff0000");
  });

  test("measures contrast like WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  test("names the path of a bad value", () => {
    const style = { ...DEFAULT_STYLE, palette: { ...DEFAULT_STYLE.palette, accent: "yellow" } };
    const problems = styleProblems(style);
    expect(problems.errors[0]).toMatch(/^palette\.accent: /);
    expect(problems.style).toBeNull();
  });

  test("rejects a misspelt setting instead of ignoring it", () => {
    const style = { ...DEFAULT_STYLE, shape: { ...DEFAULT_STYLE.shape, radious: 12 } };
    expect(styleProblems(style).errors[0]).toMatch(/^shape: .*radious/);
  });

  test("suggests a real font for a typo", () => {
    const style = { ...DEFAULT_STYLE, type: { ...DEFAULT_STYLE.type, display: "Interr" } };
    expect(styleProblems(style).errors).toEqual([expect.stringContaining('type.display: "Interr" is not a Google Font; did you mean "Inter"')]);
  });

  test("reports low contrast separately from errors", () => {
    const style = { ...DEFAULT_STYLE, palette: { ...DEFAULT_STYLE.palette, onSurface: "#eeeeee" } };
    const problems = styleProblems(style);
    expect(problems.errors).toEqual([]);
    expect(problems.contrast).toEqual([expect.stringMatching(/^palette\.onSurface \(#eeeeee\) on palette\.surface .* 1\.\d+:1/)]);
    expect(problems.style).not.toBeNull();
  });

  test("checks accent-coloured words against the backdrop they sit on", () => {
    const pale = mergeStyle(DEFAULT_STYLE, { palette: { backdrop: ["#fafafa", "#f0f0f0"], onBackdrop: "#111111", accent: "#ffe14d", onAccent: "#111111" } });
    expect(styleProblems(pale).contrast).toEqual([
      expect.stringMatching(/^palette\.accent \(#ffe14d\) on palette\.backdrop\.0 /),
      expect.stringMatching(/^palette\.accent \(#ffe14d\) on palette\.backdrop\.1 /),
    ]);
    expect(styleProblems(LIGHT_STYLE)).toMatchObject({ errors: [], contrast: [] });
  });

  test("knows the Google Fonts by name", () => {
    expect(isGoogleFont("Inter")).toBe(true);
    expect(isGoogleFont("Söhne")).toBe(false);
    expect(closestFonts("space grotes")[0]).toBe("Space Grotesk");
  });

  test("finds the font files for a style, falling back to the weights a family has", async () => {
    const files = await resolveFontFiles(mergeStyle(DEFAULT_STYLE, { type: { display: "Space Mono", body: "Space Mono", displayWeight: 900 } }));
    expect([...new Set(files.map((file) => file.weight))].sort()).toEqual(["400", "700"]);
    expect(files.every((file) => file.family === "Space Mono" && file.url.startsWith("https://fonts.gstatic.com/"))).toBe(true);
    expect(files.some((file) => file.unicodeRange.includes("U+0000-00FF"))).toBe(true);
  });

  test("picks the nearest available weight", () => {
    expect(nearestWeight(["400", "700"], 900)).toBe("700");
    expect(nearestWeight(["400"], 800)).toBe("400");
    expect(nearestWeight(["300", "500", "800"], 600)).toBe("500");
  });
});
