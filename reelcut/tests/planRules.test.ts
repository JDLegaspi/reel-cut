import type { Word } from "@reel/shared/schemas/transcript.ts";
import { describe, expect, test } from "vitest";
import { segmentWindow, validatePlan } from "../src/plan/rules.ts";

const rules = { leadMs: 40, minSegmentSeconds: 1.5, minFaceSeconds: 1 };

const words: Word[] = Array.from({ length: 10 }, (_, i) => ({ i, text: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));
const duration = 5.2;

describe("segmentWindow", () => {
  test("cuts in just before the first word and out just before the word after the last", () => {
    const window = segmentWindow({ startWord: 2, endWord: 5 }, words, duration, rules.leadMs);
    expect(window.start).toBeCloseTo(0.96);
    expect(window.end).toBeCloseTo(2.96);
  });

  test("holds until the end of the video when it covers the last word", () => {
    expect(segmentWindow({ startWord: 8, endWord: 9 }, words, duration, rules.leadMs).end).toBe(duration);
  });

  test("never starts before the video does", () => {
    expect(segmentWindow({ startWord: 0, endWord: 3 }, words, duration, rules.leadMs).start).toBe(0);
  });
});

describe("validatePlan", () => {
  test("accepts ordered segments that respect the timing rules", () => {
    const plan = [
      { startWord: 2, endWord: 5 },
      { startWord: 6, endWord: 9 },
    ];
    expect(validatePlan(plan, words, duration, rules)).toEqual([]);
  });

  test("accepts a plan with no visuals", () => {
    expect(validatePlan([], words, duration, rules)).toEqual([]);
  });

  test("rejects word indices outside the transcript", () => {
    expect(validatePlan([{ startWord: 3, endWord: 12 }], words, duration, rules)).toEqual([
      "segment 1: endWord 12 is past the last word (9)",
    ]);
  });

  test("rejects negative word indices", () => {
    expect(validatePlan([{ startWord: -1, endWord: 3 }], words, duration, rules)).toEqual([
      "segment 1: startWord -1 is before the first word (0)",
    ]);
  });

  test("rejects a segment that ends before it starts", () => {
    expect(validatePlan([{ startWord: 5, endWord: 3 }], words, duration, rules)).toEqual([
      "segment 1: endWord 3 comes before startWord 5",
    ]);
  });

  test("rejects overlapping or out-of-order segments", () => {
    const plan = [
      { startWord: 2, endWord: 5 },
      { startWord: 4, endWord: 9 },
    ];
    expect(validatePlan(plan, words, duration, rules)).toEqual([
      "segment 2 starts at word 4, before segment 1 ends at word 5",
    ]);
  });

  test("rejects segments too short to take in", () => {
    expect(validatePlan([{ startWord: 2, endWord: 3 }], words, duration, rules)).toEqual([
      "segment 1 is on screen for 1.0s; a visual needs at least 1.5s",
    ]);
  });

  test("rejects a brief flash of the speaker between segments, but allows back-to-back segments", () => {
    const plan = [
      { startWord: 0, endWord: 3 },
      { startWord: 5, endWord: 9 },
    ];
    expect(validatePlan(plan, words, duration, rules)).toEqual([
      "the speaker is on screen for only 0.5s between segments 1 and 2; put them back to back or leave at least 1s",
    ]);
  });
});
