import type { Word } from "@reel/shared/schemas/transcript.ts";
import type { Rect } from "../../remotion/framing.ts";
import type { FontFile, RenderProps, RenderSegment } from "../../remotion/props.ts";
import { findTemplate } from "../../remotion/templates/registry.ts";
import type { Brand } from "../schemas/brands.ts";
import type { Style } from "../schemas/style.ts";
import { segmentWindow } from "../plan/rules.ts";
import { buildCaptions } from "./captions.ts";
import { buildPhrases } from "./phrases.ts";
import type { VisualPlan } from "../schemas/visualPlan.ts";

const EMPHASIS_SECONDS = 0.8;
const PHRASE_MAX_WORDS = 6;
const CAPTION_HOLD_SECONDS = 0.4;

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
  face: boolean;
  brands?: Brand[];
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

  const accentWords = new Set(
    plan.emphasis.flatMap((word) => Array.from({ length: word.text.trim().split(/\s+/).length }, (_, k) => word.atWord + k)),
  );
  const phrases = opts.face ? [] : buildPhrases({ words, accentWords, fps, durationInFrames, leadMs, maxWords: PHRASE_MAX_WORDS });
  const captioned = opts.face && opts.style.layout.captions === "word";
  const captions = captioned
    ? buildCaptions({ words, accentWords, fps, durationInFrames, leadMs, holdSeconds: CAPTION_HOLD_SECONDS })
    : [];

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
    emphasis: opts.face && !captioned ? emphasis : [],
    face: opts.face,
    phrases,
    captions,
    brands: opts.brands ?? [],
  };
}
