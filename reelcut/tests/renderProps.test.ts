import type { Word } from "@reel/shared/schemas/transcript.ts";
import { expect, test } from "vitest";
import { buildRenderProps } from "../src/render/props.ts";
import type { VisualPlan } from "../src/schemas/visualPlan.ts";
import { DEFAULT_STYLE } from "../src/style/default.ts";

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
const fonts = [{ family: "Inter", weight: "900", url: "https://fonts.gstatic.com/inter.woff2", unicodeRange: "U+0000-00FF" }];

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
    style: DEFAULT_STYLE,
    fonts,
  });

  expect(props).toEqual({
    video: "source.mp4",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 156,
    speakerCrop,
    style: DEFAULT_STYLE,
    fonts,
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

test("passes props through the template's schema, so colour names from older plans become roles", () => {
  const concept = { icon: "target", label: null, satellites: [], color: "violet" };
  const older: VisualPlan = {
    ...plan,
    segments: [{ id: "seg-01", kind: "visual", layout: "split", template: "Concept", startWord: 2, endWord: 5, props: concept, reveals: [], rationale: "idea" }],
    emphasis: [],
  };
  const props = buildRenderProps({ plan: older, words, duration: 5.2, fps: 30, width: 1080, height: 1920, leadMs: 40, video: "source.mp4", speakerCrop, style: DEFAULT_STYLE, fonts });
  expect(props.segments[0]).toMatchObject({ kind: "visual", props: { ...concept, color: "tint2" } });
});
