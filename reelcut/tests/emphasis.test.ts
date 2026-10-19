import type { Word } from "@reel/shared/schemas/transcript.ts";
import { describe, expect, test } from "vitest";
import { emphasisProblems } from "../src/plan/emphasis.ts";

const words: Word[] = "They saw a twenty X in their revenue. Make sure you follow."
  .split(" ")
  .map((text, i) => ({ i, text, start: i * 0.5, end: i * 0.5 + 0.4 }));

const segments = [{ startWord: 2, endWord: 7 }];
const opts = { words, duration: 6.5, leadMs: 40, segments };

describe("emphasisProblems", () => {
  test("accepts spoken words on the speaker's own shots", () => {
    expect(emphasisProblems({ atWord: 8, text: "MAKE SURE" }, opts)).toEqual([]);
    expect(emphasisProblems({ atWord: 11, text: "follow" }, opts)).toEqual([]);
  });

  test("accepts a corrected spelling of a misheard word", () => {
    const named: Word[] = [{ i: 0, text: "RecipeMe's", start: 0, end: 0.5 }];
    expect(emphasisProblems({ atWord: 0, text: "ReciMe's" }, { ...opts, words: named, segments: [] })).toEqual([]);
  });

  test("rejects text that isn't what is said at that word", () => {
    expect(emphasisProblems({ atWord: 11, text: "subscribe" }, opts)).toEqual([
      'emphasis "subscribe" on word 11 doesn\'t match what is said there ("follow.")',
    ]);
  });

  test("rejects emphasis during a visual segment", () => {
    expect(emphasisProblems({ atWord: 3, text: "twenty" }, opts)).toEqual([
      'emphasis "twenty" on word 3 falls inside segment 1; emphasis is for the speaker\'s own shots',
    ]);
  });

  test("rejects more than three words and words past the end", () => {
    expect(emphasisProblems({ atWord: 8, text: "make sure you follow" }, opts)).toEqual([
      'emphasis "make sure you follow" is longer than three words',
    ]);
    expect(emphasisProblems({ atWord: 40, text: "follow" }, opts)).toEqual(['emphasis "follow" is on word 40, past the last word (11)']);
  });
});
