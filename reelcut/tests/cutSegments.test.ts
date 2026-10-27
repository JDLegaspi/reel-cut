import { describe, expect, test } from "vitest";
import { keepFromRemoved, planCut } from "../src/cut/segments.ts";

const settings = { padBefore: 0.1, padAfter: 0.1, maxGap: 0.4 };

const words = [
  { i: 0, text: "one", start: 1.0, end: 1.5 },
  { i: 1, text: "two", start: 1.6, end: 2.0 },
  { i: 2, text: "uh", start: 2.1, end: 2.5 },
  { i: 3, text: "three", start: 2.6, end: 3.0 },
  { i: 4, text: "four", start: 5.0, end: 5.5 },
];

describe("planCut", () => {
  test("keeps one padded segment when everything is kept and there are no long pauses", () => {
    const cut = planCut({ words: words.slice(0, 4), keep: [{ fromWord: 0, toWord: 3 }], duration: 6, fps: 10, settings });
    expect(cut.segments).toEqual([{ srcStart: 0.9, srcEnd: 3.1, cutStart: 0, cutEnd: 2.2 }]);
    expect(cut.duration).toBeCloseTo(2.2);
  });

  test("drops words outside the kept ranges, clamping the padding against them, and shortens long pauses", () => {
    const keep = [
      { fromWord: 0, toWord: 1 },
      { fromWord: 3, toWord: 4 },
    ];
    const cut = planCut({ words, keep, duration: 6, fps: 10, settings });
    expect(cut.segments).toEqual([
      { srcStart: 0.9, srcEnd: 2.1, cutStart: 0, cutEnd: 1.2 },
      { srcStart: 2.5, srcEnd: 3.2, cutStart: 1.2, cutEnd: 1.9 },
      { srcStart: 4.8, srcEnd: 5.6, cutStart: 1.9, cutEnd: 2.7 },
    ]);
    expect(cut.words).toEqual([
      { i: 0, srcI: 0, text: "one", start: 0.1, end: 0.6 },
      { i: 1, srcI: 1, text: "two", start: 0.7, end: 1.1 },
      { i: 2, srcI: 3, text: "three", start: 1.3, end: 1.7 },
      { i: 3, srcI: 4, text: "four", start: 2.1, end: 2.6 },
    ]);
    expect(cut.duration).toBeCloseTo(2.7);
  });

  test("plays the kept ranges in the order given", () => {
    const keep = [
      { fromWord: 3, toWord: 3 },
      { fromWord: 0, toWord: 1 },
    ];
    const cut = planCut({ words, keep, duration: 6, fps: 10, settings });
    expect(cut.segments).toEqual([
      { srcStart: 2.5, srcEnd: 3.1, cutStart: 0, cutEnd: 0.6 },
      { srcStart: 0.9, srcEnd: 2.1, cutStart: 0.6, cutEnd: 1.8 },
    ]);
    expect(cut.words.map((word) => [word.i, word.srcI, word.start])).toEqual([
      [0, 3, 0.1],
      [1, 0, 0.7],
      [2, 1, 1.3],
    ]);
  });

  test("joins ranges that continue each other without repeating any sound", () => {
    const keep = [
      { fromWord: 0, toWord: 0 },
      { fromWord: 1, toWord: 1 },
    ];
    const cut = planCut({ words, keep, duration: 6, fps: 10, settings });
    expect(cut.segments).toEqual([{ srcStart: 0.9, srcEnd: 2.1, cutStart: 0, cutEnd: 1.2 }]);
  });

  test("never pads across the start of a clip", () => {
    const clipWords = [
      { i: 0, text: "end", start: 1.5, end: 2.0 },
      { i: 1, text: "start", start: 2.35, end: 2.6 },
    ];
    const cut = planCut({
      words: clipWords,
      keep: [{ fromWord: 1, toWord: 1 }],
      duration: 4,
      fps: 10,
      settings: { ...settings, padBefore: 0.2 },
      clips: [
        { start: 0, end: 2.3 },
        { start: 2.3, end: 4 },
      ],
    });
    expect(cut.segments[0]!.srcStart).toBeCloseTo(2.3);
  });

  test("keeps a clip with no speech whole, in its place", () => {
    const clipWords = [
      { i: 0, text: "first", start: 0.5, end: 1.5 },
      { i: 1, text: "third", start: 4.5, end: 5.5 },
    ];
    const cut = planCut({
      words: clipWords,
      keep: [{ fromWord: 0, toWord: 1 }],
      duration: 6,
      fps: 10,
      settings,
      clips: [
        { start: 0, end: 2 },
        { start: 2, end: 4 },
        { start: 4, end: 6 },
      ],
    });
    expect(cut.segments.map((segment) => [segment.srcStart, segment.srcEnd])).toEqual([
      [0.4, 1.7],
      [2, 4],
      [4.3, 5.6],
    ]);
    expect(cut.words.map((word) => [word.text, word.start])).toEqual([
      ["first", 0.1],
      ["third", 3.5],
    ]);
  });

  test("puts every segment edge on the frame grid", () => {
    const cut = planCut({
      words: [{ i: 0, text: "hi", start: 0.33, end: 0.71 }],
      keep: [{ fromWord: 0, toWord: 0 }],
      duration: 2,
      fps: 30,
      settings: { padBefore: 0.08, padAfter: 0.12, maxGap: 0.4 },
    });
    for (const segment of cut.segments) {
      for (const edge of [segment.srcStart, segment.srcEnd, segment.cutStart, segment.cutEnd]) {
        expect(edge * 30).toBeCloseTo(Math.round(edge * 30), 6);
      }
    }
  });

  test("never pads past the start or end of the video", () => {
    const cut = planCut({
      words: [{ i: 0, text: "hi", start: 0.05, end: 1.95 }],
      keep: [{ fromWord: 0, toWord: 0 }],
      duration: 2,
      fps: 10,
      settings,
    });
    expect(cut.segments).toEqual([{ srcStart: 0, srcEnd: 2, cutStart: 0, cutEnd: 2 }]);
  });

  test("keeps the whole video when there are no words", () => {
    const cut = planCut({ words: [], keep: [], duration: 3, fps: 10, settings });
    expect(cut.segments).toEqual([{ srcStart: 0, srcEnd: 3, cutStart: 0, cutEnd: 3 }]);
    expect(cut.words).toEqual([]);
  });
});

describe("keepFromRemoved", () => {
  test("keeps every word outside the removed ranges, in order", () => {
    expect(keepFromRemoved(5, [{ fromWord: 2, toWord: 2 }])).toEqual([
      { fromWord: 0, toWord: 1 },
      { fromWord: 3, toWord: 4 },
    ]);
    expect(keepFromRemoved(3, [{ fromWord: 0, toWord: 0 }])).toEqual([{ fromWord: 1, toWord: 2 }]);
  });
});
