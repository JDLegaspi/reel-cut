import type { Word } from "@reel/shared/schemas/transcript.ts";

const NEAR_SECONDS = 0.5;

function isNameLike(word: Word, previous: Word | undefined): boolean {
  if (!previous || !/^[A-Z]/.test(word.text)) return false;
  if (/^I(['’].*)?$/.test(word.text)) return false;
  return !/[.?!]["')\]]*$/.test(previous.text);
}

export function frameTimes(opts: { words: Word[]; duration: number; maxFrames: number; interval: number }): number[] {
  const { words, duration, maxFrames, interval } = opts;
  const names = words
    .filter((word, k) => isNameLike(word, words[k - 1]))
    .map((word) => (word.start + word.end) / 2)
    .slice(0, maxFrames);
  const count = Math.min(maxFrames - names.length, Math.ceil(duration / interval));
  const spaced = Array.from({ length: count }, (_, k) => (k * duration) / count).filter((t) =>
    names.every((name) => Math.abs(name - t) >= NEAR_SECONDS),
  );
  return [...names, ...spaced].sort((a, b) => a - b);
}
