import type Anthropic from "@anthropic-ai/sdk";
import type { FrameImage } from "@reel/shared/frames/frames.ts";
import type { Transcript, Word } from "@reel/shared/schemas/transcript.ts";
import { describe, expect, test } from "vitest";
import { TEMPLATES } from "../remotion/templates/registry.ts";
import { buildPlanMessages, indexedTranscript, planSystemPrompt } from "../src/plan/prompt.ts";
import { fromClaudePlan, toClaudePlan } from "../src/plan/schema.ts";

function words(...items: [string, number, number][]): Word[] {
  return items.map(([text, start, end], i) => ({ i, text, start, end }));
}

const transcript: Transcript = {
  version: 1,
  provider: "mock",
  language: "eng",
  duration: 4.2,
  words: words(["Five", 0.1, 0.3], ["videos.", 0.35, 0.8], ["The", 2.0, 2.1], ["first", 2.15, 2.4]),
};

const frames: FrameImage[] = [
  { t: 0, data: Buffer.from("a") },
  { t: 2.112, data: Buffer.from("b") },
];

const rules = { leadMs: 40, minSegmentSeconds: 1.5, minFaceSeconds: 1 };

function text(block: Anthropic.Beta.BetaContentBlockParam | undefined): string {
  return (block as { text: string }).text;
}

describe("indexedTranscript", () => {
  test("numbers every word and starts each line with its time", () => {
    expect(indexedTranscript(transcript.words)).toEqual(["[0.1s] 0:Five 1:videos.", "[2.0s] 2:The 3:first"]);
  });
});

describe("planSystemPrompt", () => {
  test("states the timing rules the plan is checked against", () => {
    const prompt = planSystemPrompt(rules);
    expect(prompt).toContain("at least 1.5s");
    expect(prompt).toContain("at least 1s");
  });

  test("uses on-screen text only to correct the spelling of names", () => {
    expect(planSystemPrompt(rules)).toContain("use the on-screen spelling");
  });

  test("lists every template with its description and the JSON schema of its props", () => {
    const prompt = planSystemPrompt(rules);
    for (const template of TEMPLATES) expect(prompt).toContain(`- ${template.name}: ${template.description}`);
    expect(prompt).toContain('"title":{"type":"string","minLength":1,"maxLength":48');
  });

  test("explains the split and full layouts and emphasis words", () => {
    const prompt = planSystemPrompt(rules);
    expect(prompt).toContain("- split:");
    expect(prompt).toContain("- full:");
    expect(prompt).toContain("Emphasis.");
  });
});

describe("Claude's plan format", () => {
  const segment = { layout: "split" as const, template: "Checklist", startWord: 0, endWord: 3, reveals: [], rationale: "list" };

  test("carries props as JSON text, parsed back into objects", () => {
    const props = { title: "Tips", items: [] };
    const claude = toClaudePlan({ segments: [{ ...segment, props }], emphasis: [] });
    expect(claude.segments[0]!.props).toBe(JSON.stringify(props));
    expect(fromClaudePlan(claude)).toEqual({ segments: [{ ...segment, props }], emphasis: [] });
  });

  test("keeps props that are not valid JSON as text, so the content check reports them", () => {
    expect(fromClaudePlan({ segments: [{ ...segment, props: "{title:" }], emphasis: [] }).segments[0]!.props).toBe("{title:");
  });
});

describe("buildPlanMessages", () => {
  test("sends the duration and the numbered transcript, then each frame labelled with its time", () => {
    const [message, ...rest] = buildPlanMessages({ transcript, frames });
    expect(rest).toEqual([]);
    expect(message?.role).toBe("user");
    const content = message!.content as Anthropic.Beta.BetaContentBlockParam[];
    const [header, label0, image0, label1, image1, ask] = content;
    expect(text(header)).toContain("Duration: 4.2s");
    expect(text(header)).toContain("[2.0s] 2:The 3:first");
    expect(label0).toEqual({ type: "text", text: "Frame at 0.0s" });
    expect(image0).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: Buffer.from("a").toString("base64") },
    });
    expect(label1).toEqual({ type: "text", text: "Frame at 2.1s" });
    expect(image1).toMatchObject({ type: "image" });
    expect(text(ask)).toBe("Plan the visuals for this video.");
    expect(content).toHaveLength(6);
  });

  test("on a retry, replays the rejected plan and lists what was wrong with it", () => {
    const previous = { segments: [], emphasis: [] };
    const messages = buildPlanMessages({ transcript, frames, retry: { previous, errors: ["segment 1 is too short", "another"] } });
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(JSON.parse(messages[1]!.content as string)).toEqual(previous);
    expect(messages[2]!.content).toContain("- segment 1 is too short\n- another");
  });
});
