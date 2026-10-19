import type { Word } from "@reel/shared/schemas/transcript.ts";
import { expect, test } from "vitest";
import { buildRenderProps } from "../src/render/props.ts";
import type { VisualPlan } from "../src/schemas/visualPlan.ts";

const words: Word[] = Array.from({ length: 10 }, (_, i) => ({ i, text: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));

const listItem = { position: null, title: "Title", subtitle: null, icon: "star", badges: [] };

const plan: VisualPlan = {
  version: 1,
  segments: [
    {
      id: "seg-01",
      kind: "visual",
      layout: "split",
      template: "Countdown",
      startWord: 2,
      endWord: 5,
      props: listItem,
      reveals: [{ key: "title", atWord: 4 }],
      rationale: "item",
    },
    { id: "seg-02", kind: "placeholder", startWord: 7, endWord: 9, description: "Big number", rationale: "stat" },
  ],
  emphasis: [{ atWord: 6, text: "W6" }],
  downgraded: [],
};

const speakerCrop = { x: 0, y: 0, width: 1080, height: 960 };

test("converts segments, reveals and emphasis words into frames on the video's timeline", () => {
  const props = buildRenderProps({
    plan,
    words,
    duration: 5.2,
    fps: 30,
    width: 1080,
    height: 1920,
    leadMs: 40,
    video: "source.mp4",
    speakerCrop,
  });

  expect(props).toEqual({
    video: "source.mp4",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 156,
    speakerCrop,
    segments: [
      {
        kind: "visual",
        id: "seg-01",
        layout: "split",
        from: 29,
        durationInFrames: 60,
        template: "Countdown",
        props: listItem,
        at: { title: 30 },
      },
      { kind: "placeholder", id: "seg-02", from: 104, durationInFrames: 52, description: "Big number", spoken: "w7 w8 w9" },
    ],
    emphasis: [{ from: 89, durationInFrames: 15, text: "W6" }],
  });
});
