import type { Word } from "@reel/shared/schemas/transcript.ts";
import type { CaptionWord } from "../../remotion/props.ts";

export function captionText(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+/u, "").replace(/[.,!?;:"'”’)\]…-]+$/u, "");
}

export function buildCaptions(opts: {
  words: Word[];
  accentWords: Set<number>;
  fps: number;
  durationInFrames: number;
  leadMs: number;
  holdSeconds: number;
}): CaptionWord[] {
  const { words, fps, durationInFrames, leadMs } = opts;
  const toFrame = (seconds: number) => Math.min(Math.max(0, Math.round(seconds * fps)), durationInFrames);
  return words.flatMap((word, k): CaptionWord[] => {
    const text = captionText(word.text);
    if (!text) return [];
    const from = toFrame(word.start - leadMs / 1000);
    const next = words[k + 1];
    const until = Math.min(next ? toFrame(next.start - leadMs / 1000) : durationInFrames, toFrame(word.end + opts.holdSeconds));
    return until > from ? [{ from, durationInFrames: until - from, text, accent: opts.accentWords.has(word.i) }] : [];
  });
}
