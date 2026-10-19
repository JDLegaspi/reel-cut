import type { Word } from "@reel/shared/schemas/transcript.ts";
import { describe, expect, test } from "vitest";
import { contentProblems } from "../src/plan/content.ts";
import type { PlannedVisual } from "../src/schemas/visualPlan.ts";

function spoken(sentence: string): Word[] {
  return sentence.split(" ").map((text, i) => ({ i, text, start: i * 0.4, end: i * 0.4 + 0.3 }));
}

const words = spoken("Number four is Phillipp Humm's storytelling video. It has forty thousand views.");

function listItem(overrides: Partial<PlannedVisual> = {}): PlannedVisual {
  return {
    layout: "split",
    template: "Countdown",
    startWord: 0,
    endWord: 6,
    props: {
      position: { index: 4, total: 5 },
      title: "Storytelling 101",
      subtitle: "Phillipp Humm",
      icon: "book-open",
      badges: [],
    },
    reveals: [
      { key: "position", atWord: 1 },
      { key: "title", atWord: 5 },
    ],
    rationale: "fourth item",
    ...overrides,
  };
}

function bigNumber(value: number): PlannedVisual {
  return {
    layout: "split",
    template: "Stat",
    startWord: 7,
    endWord: 11,
    props: { value, prefix: null, suffix: null, label: "views", icon: "eye", trend: "up" },
    reveals: [{ key: "value", atWord: 9 }],
    rationale: "stat",
  };
}

describe("contentProblems", () => {
  test("accepts a template whose props, reveals and numbers check out", () => {
    expect(contentProblems(listItem(), words, 1)).toEqual([]);
    expect(contentProblems(bigNumber(40000), words, 1)).toEqual([]);
  });

  test("rejects an unknown template", () => {
    expect(contentProblems(listItem({ template: "Carousel" }), words, 1)).toEqual([
      'segment 1: unknown template "Carousel"; use one of Stat, Growth, Versus, Concept, Flow, Phone, Logos, Kinetic, Countdown, Checklist',
    ]);
  });

  test("rejects props that don't fit the template", () => {
    const [problem, ...rest] = contentProblems(listItem({ props: { title: "x".repeat(200) } }), words, 2);
    expect(problem).toMatch(/^segment 2 \(Countdown\): props are invalid:/);
    expect(rest).toEqual([]);
  });

  test("rejects a reveal for an element the props don't have", () => {
    const problems = contentProblems(listItem({ reveals: [{ key: "badge-0", atWord: 2 }] }), words, 1);
    expect(problems).toEqual([
      'segment 1 (Countdown): there is no element "badge-0" to reveal; its elements are position, title, subtitle',
    ]);
  });

  test("rejects a reveal outside the segment", () => {
    const problems = contentProblems(listItem({ reveals: [{ key: "title", atWord: 9 }] }), words, 1);
    expect(problems).toEqual(['segment 1 (Countdown): "title" is revealed on word 9, outside the segment (words 0-6)']);
  });

  test("rejects reveals that don't follow the speech", () => {
    const reveals = [
      { key: "title", atWord: 5 },
      { key: "position", atWord: 1 },
    ];
    expect(contentProblems(listItem({ reveals }), words, 1)).toEqual([
      'segment 1 (Countdown): reveals must follow the speech; "position" on word 1 comes after "title" on word 5',
    ]);
  });

  test("rejects a number the speaker never says in the segment", () => {
    expect(contentProblems(bigNumber(50000), words, 3)).toEqual([
      "segment 3 (Stat): 50000 is never said in this segment",
    ]);
  });

  test("rejects element keys that repeat", () => {
    const list: PlannedVisual = {
      layout: "split",
      template: "Checklist",
      startWord: 0,
      endWord: 6,
      props: {
        title: "Tips",
        items: [
          { key: "a", text: "One", mark: "check" },
          { key: "a", text: "Two", mark: "check" },
        ],
      },
      reveals: [],
      rationale: "list",
    };
    expect(contentProblems(list, words, 1)).toEqual(['segment 1 (Checklist): element keys must be unique; "a" is used twice']);
  });

  test("rejects a number in a card's text that the speaker never says", () => {
    const segment = listItem({ props: { position: null, title: "Storytelling", subtitle: null, icon: "book-open", badges: ["10 hours"] } });
    expect(contentProblems({ ...segment, reveals: [] }, words, 1)).toEqual([
      'segment 1 (Countdown): "10" in "10 hours" is never said in this segment',
    ]);
  });

  test("rejects an icon that doesn't exist", () => {
    const segment = listItem({ props: { position: null, title: "Storytelling", subtitle: null, icon: "spatula-x", badges: [] } });
    expect(contentProblems({ ...segment, reveals: [] }, words, 1)[0]).toContain("icon: not a lucide icon name");
  });
});
