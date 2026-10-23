import type { Word } from "@reel/shared/schemas/transcript.ts";
import { describe, expect, test } from "vitest";
import { buildPhrases } from "../src/render/phrases.ts";

const words: Word[] = Array.from({ length: 12 }, (_, i) => ({
  i,
  text: i === 5 ? `w${i}.` : `w${i}`,
  start: i * 0.5,
  end: i * 0.5 + 0.4,
}));

const base = { words, fps: 30, durationInFrames: 180, leadMs: 40, maxWords: 4 };

describe("buildPhrases", () => {
  const phrases = buildPhrases({ ...base, accentWords: new Set() });

  test("splits at sentence ends and at maxWords", () => {
    expect(phrases.map((phrase) => phrase.words[0]!.text)).toEqual(["w0", "w4", "w6", "w10"]);
  });

  test("each phrase starts leadMs before its first word and lasts until the next phrase starts", () => {
    expect(phrases[0]!.from).toBe(0);
    expect(phrases[1]!.from).toBe(Math.round((2.0 - 0.04) * 30));
    expect(phrases[0]!.durationInFrames).toBe(phrases[1]!.from - phrases[0]!.from);
    expect(phrases.at(-1)!.from + phrases.at(-1)!.durationInFrames).toBe(180);
  });

  test("word frames are relative to the phrase", () => {
    expect(phrases[1]!.words[1]!.from).toBe(Math.round(2.5 * 30) - phrases[1]!.from);
  });

  test("marks accent words", () => {
    const accented = buildPhrases({ ...base, accentWords: new Set([6]) });
    expect(accented[2]!.words[0]!.accent).toBe(true);
    expect(accented.flatMap((phrase) => phrase.words).filter((word) => word.accent)).toHaveLength(1);
  });
});
