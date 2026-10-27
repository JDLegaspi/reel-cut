import { describe, expect, test } from "vitest";
import { buildCaptions, captionText } from "../src/render/captions.ts";
import { applySpellings, spellingProblems } from "../src/render/spellings.ts";
import { StyleSchema } from "../src/schemas/style.ts";
import { DEFAULT_STYLE } from "../src/style/default.ts";

const words = [
  { i: 0, text: "Hello.", start: 0.5, end: 0.9 },
  { i: 1, text: "I'm", start: 1.0, end: 1.2 },
  { i: 2, text: "Globex+,", start: 1.3, end: 1.8 },
  { i: 3, text: "here.", start: 3.5, end: 3.9 },
];

describe("captionText", () => {
  test("drops punctuation around a word but keeps it inside", () => {
    expect(captionText("Hello.")).toBe("Hello");
    expect(captionText("Globex+,")).toBe("Globex+");
    expect(captionText('"A/B,"')).toBe("A/B");
    expect(captionText("R&D.")).toBe("R&D");
  });
});

describe("buildCaptions", () => {
  test("shows each word from when it is said until the next word, on the frame grid", () => {
    const captions = buildCaptions({ words, accentWords: new Set([2]), fps: 10, durationInFrames: 50, leadMs: 0, holdSeconds: 0.4 });
    expect(captions).toEqual([
      { from: 5, durationInFrames: 5, text: "Hello", accent: false },
      { from: 10, durationInFrames: 3, text: "I'm", accent: false },
      { from: 13, durationInFrames: 9, text: "Globex+", accent: true },
      { from: 35, durationInFrames: 8, text: "here", accent: false },
    ]);
  });
});

describe("applySpellings", () => {
  test("replaces misheard words, keeping their punctuation", () => {
    const fixed = applySpellings(
      [
        { i: 0, text: "Next-JS", start: 0, end: 1 },
        { i: 1, text: "over", start: 1, end: 2 },
        { i: 2, text: "Type-script,", start: 2, end: 3 },
      ],
      { "Next-JS": "nextjs", "type-script": "typescript" },
    );
    expect(fixed.map((word) => word.text)).toEqual(["nextjs", "over", "typescript,"]);
  });

  test("replaces a misheard phrase word for word", () => {
    const fixed = applySpellings(
      ["I", "red", "it", "an", "hour", "ago"].map((text, i) => ({ i, text, start: i, end: i + 1 })),
      { "red it": "read it" },
    );
    expect(fixed.map((word) => word.text).join(" ")).toBe("I read it an hour ago");
  });

  test("names a phrase whose fix has a different number of words", () => {
    expect(spellingProblems({ "Versel": "Vercel Edge" })).toEqual([
      'spellings: "Versel" has 1 word but "Vercel Edge" has 2; a fix must keep the number of words',
    ]);
  });
});

describe("style layout", () => {
  test("styles made before layouts keep the full-bleed speaker and no captions", () => {
    const { layout: _, ...older } = DEFAULT_STYLE;
    expect(StyleSchema.parse(older).layout).toEqual({ speaker: "full", captions: "none" });
  });
});
