import { describe, expect, test } from "vitest";
import { buildRetakeMessages, retakeSystemPrompt } from "../src/retakes/prompt.ts";
import { keepProblems } from "../src/retakes/rules.ts";

const words = [
  { i: 0, text: "So", start: 0.2, end: 0.4 },
  { i: 1, text: "today", start: 0.5, end: 0.9 },
  { i: 2, text: "again.", start: 1.0, end: 1.3 },
  { i: 3, text: "So", start: 2.5, end: 2.7 },
  { i: 4, text: "today", start: 2.8, end: 3.1 },
];

const range = (fromWord: number, toWord: number) => ({ fromWord, toWord });

describe("keepProblems", () => {
  test("accepts ranges inside the transcript, in any order", () => {
    expect(keepProblems([range(3, 4), range(0, 1)], words.length)).toEqual([]);
  });

  test("names ranges outside the transcript or written backwards", () => {
    expect(keepProblems([range(3, 9), range(2, 1)], words.length)).toEqual([
      "keep 1: toWord 9 is past the last word (4)",
      "keep 2: toWord 1 comes before fromWord 2",
    ]);
  });

  test("names words kept twice", () => {
    expect(keepProblems([range(0, 2), range(2, 3)], words.length)).toEqual(["word 2 is kept twice (keep 1 and keep 2)"]);
  });

  test("refuses to keep nothing", () => {
    expect(keepProblems([], words.length)).toEqual(["keep is empty, so the video would have no words"]);
    expect(keepProblems([], 0)).toEqual([]);
  });
});

describe("retake prompt", () => {
  test("names the retake word and keeps natural fillers unless aggressive", () => {
    expect(retakeSystemPrompt({ retakeWord: "again", aggressive: false })).toContain('"again"');
    expect(retakeSystemPrompt({ retakeWord: "again", aggressive: false })).toContain("Keep natural fillers");
    expect(retakeSystemPrompt({ retakeWord: "again", aggressive: true })).toContain("Also remove natural fillers");
  });

  test("keeps separately recorded clips in the order given", () => {
    const prompt = retakeSystemPrompt({ retakeWord: "again", aggressive: false });
    expect(prompt).toContain("Keep the clips in the order given");
    expect(prompt).not.toContain("script order");
  });

  test("numbers every word and marks long pauses", () => {
    const [message] = buildRetakeMessages({ words, clips: [] });
    expect(message!.content).toContain("0:So 1:today 2:again.");
    expect(message!.content).toContain("(pause 1.2s)");
  });

  test("marks where each clip starts when there are several", () => {
    const clips = [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ];
    const [message] = buildRetakeMessages({ words, clips });
    expect(message!.content).toContain("--- clip 1 ---\n[0.2s] 0:So 1:today 2:again.\n--- clip 2 ---\n[2.5s] 3:So 4:today");
  });

  test("returns the problems with the previous answer on a retry", () => {
    const previous = { keep: [range(2, 1)], removed: [] };
    const messages = buildRetakeMessages({ words, clips: [], retry: { previous, errors: ["keep 1: toWord 1 comes before fromWord 2"] } });
    expect(messages).toHaveLength(3);
    expect(messages[2]!.content).toContain("- keep 1: toWord 1 comes before fromWord 2");
  });
});
