import type { Word } from "@reel/shared/schemas/transcript.ts";
import { describe, expect, test } from "vitest";
import { frameTimes } from "../src/plan/frameTimes.ts";

function spoken(sentence: string): Word[] {
  return sentence.split(" ").map((text, i) => ({ i, text, start: i, end: i + 0.5 }));
}

describe("frameTimes", () => {
  test("takes a frame while each capitalised word inside a sentence is spoken", () => {
    const words = spoken("The next one is Jake Trinder's training. And I loved it.");
    expect(frameTimes({ words, duration: 10, maxFrames: 2, interval: 1 })).toEqual([4.25, 5.25]);
  });

  test("ignores sentence starts and the word I", () => {
    const words = spoken("Honestly I think so. Start with that.");
    expect(frameTimes({ words, duration: 7, maxFrames: 0, interval: 1 })).toEqual([]);
  });

  test("fills the rest of the budget with evenly spaced frames", () => {
    const words = spoken("watch Jake today");
    expect(frameTimes({ words, duration: 9, maxFrames: 4, interval: 1 })).toEqual([0, 1.25, 3, 6]);
  });

  test("keeps evenly spaced frames at least the interval apart on short videos", () => {
    expect(frameTimes({ words: spoken("hello world"), duration: 2, maxFrames: 24, interval: 2 })).toEqual([0]);
  });

  test("drops a spaced frame that lands next to a name frame", () => {
    const words = spoken("hi Jake");
    expect(frameTimes({ words, duration: 2.5, maxFrames: 3, interval: 1 })).toEqual([0, 1.25]);
  });

  test("keeps the earliest names when there are more than the budget allows", () => {
    const words = spoken("ask Ann Bob Cat Dan");
    expect(frameTimes({ words, duration: 5, maxFrames: 2, interval: 1 })).toEqual([1.25, 2.25]);
  });
});
