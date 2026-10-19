import { describe, expect, test } from "vitest";
import { numbersIn } from "../src/plan/numbers.ts";

function has(text: string, ...values: number[]) {
  const found = numbersIn(text);
  for (const value of values) expect(found, `${value} in "${text}"`).toContain(value);
}

describe("numbersIn", () => {
  test("reads digits, including separators, decimals, currency and percentages", () => {
    has("a 45 minute masterclass", 45);
    has("over 3,000 people", 3000);
    has("costs $40 a month", 40);
    has("grew 50% in a week", 50);
    has("a 1.5x return", 1.5);
  });

  test("reads digits with a magnitude as both the spoken figure and its value", () => {
    has("10k followers", 10, 10000);
    has("1.6 million views", 1.6, 1600000);
  });

  test("reads spelled-out numbers, hyphenated or not", () => {
    has("a forty-five-minute long masterclass", 45);
    has("six-hour personal brand course", 6);
    has("one hundred and twenty days", 120);
    has("two million dollars", 2000000);
    has("twelve thousand five hundred", 12500);
    has("number four is", 4);
  });

  test("reads years said as two pairs", () => {
    has("the best skill in twenty twenty-six", 2026);
  });

  test("reads ordinals", () => {
    has("the first video", 1);
    has("the third one", 3);
  });

  test("does not invent numbers", () => {
    expect([...numbersIn("the last video is the best")]).toEqual([]);
    expect(numbersIn("forty-five minutes")).not.toContain(40);
  });
});
