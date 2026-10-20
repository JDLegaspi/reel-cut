import type { Word } from "@reel/shared/schemas/transcript.ts";
import type { Rect } from "../../remotion/framing.ts";
import type { FontFile, RenderProps, RenderSegment } from "../../remotion/props.ts";
import { findTemplate } from "../../remotion/templates/registry.ts";
import type { Style } from "../schemas/style.ts";
import { segmentWindow } from "../plan/rules.ts";
import type { VisualPlan } from "../schemas/visualPlan.ts";

const EMPHASIS_SECONDS = 0.8;

export function buildRenderProps(opts: {
  plan: VisualPlan;
  words: Word[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  leadMs: number;
  video: string;
  speakerCrop: Rect;
  style: Style;
  fonts: FontFile[];
}): RenderProps {
  const { plan, words, duration, fps, leadMs } = opts;
  const durationInFrames = Math.floor(duration * fps);
  const toFrame = (seconds: number) => Math.min(Math.round(seconds * fps), durationInFrames);

  const segments = plan.segments.map((segment): RenderSegment => {
      const window = segmentWindow(segment, words, duration, leadMs);
      const from = toFrame(window.start);
      const timing = { id: segment.id, from, durationInFrames: toFrame(window.end) - from };
      if (segment.kind === "placeholder") {
        return {
          kind: "placeholder",
          ...timing,
          description: segment.description,
          spoken: words
            .slice(segment.startWord, segment.endWord + 1)
            .map((word) => word.text)
            .join(" "),
        };
      }
      const at = Object.fromEntries(
        segment.reveals.map((reveal) => [
          reveal.key,
          Math.max(0, toFrame(words[reveal.atWord]!.start - leadMs / 1000) - from),
        ]),
      );
      const props = (findTemplate(segment.template)?.schema.parse(segment.props) ?? segment.props) as Record<string, unknown>;
      return { kind: "visual", layout: segment.layout, ...timing, template: segment.template, props, at };
  });

  const emphasis = plan.emphasis.map((word) => {
    const from = toFrame(words[word.atWord]!.start - leadMs / 1000);
    const next = segments.find((segment) => segment.from > from)?.from ?? durationInFrames;
    return { from, durationInFrames: Math.min(Math.round(EMPHASIS_SECONDS * fps), next - from), text: word.text };
  });

  return {
    video: opts.video,
    width: opts.width,
    height: opts.height,
    fps,
    durationInFrames,
    speakerCrop: opts.speakerCrop,
    style: opts.style,
    fonts: opts.fonts,
    segments,
    emphasis,
  };
}
