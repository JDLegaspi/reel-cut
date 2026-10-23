import type { Word } from "@reel/shared/schemas/transcript.ts";
import { splitIntoLines } from "@reel/shared/transcribe/lines.ts";
import type { Phrase } from "../../remotion/props.ts";

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, k) => items.slice(k * size, (k + 1) * size));
}

export function buildPhrases(opts: {
  words: Word[];
  accentWords: Set<number>;
  fps: number;
  durationInFrames: number;
  leadMs: number;
  maxWords: number;
}): Phrase[] {
  const { words, accentWords, fps, durationInFrames, leadMs, maxWords } = opts;
  const toFrame = (seconds: number) => Math.min(Math.max(0, Math.round(seconds * fps)), durationInFrames);
  const groups = splitIntoLines(words).flatMap((line) => chunk(line, maxWords));
  const starts = groups.map((group) => toFrame(group[0]!.start - leadMs / 1000));
  return groups.map((group, k) => {
    const from = starts[k]!;
    const end = starts[k + 1] ?? durationInFrames;
    return {
      from,
      durationInFrames: end - from,
      words: group.map((word) => ({ text: word.text, from: toFrame(word.start) - from, accent: accentWords.has(word.i) })),
    };
  });
}
