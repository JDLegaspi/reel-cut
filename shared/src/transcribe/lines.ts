import type { Word } from "../schemas/transcript.ts";

const PAUSE_BREAK_SECONDS = 0.8;
const MAX_WORDS_PER_LINE = 20;

export function splitIntoLines(words: Word[]): Word[][] {
  const lines: Word[][] = [];
  let current: Word[] = [];
  for (const word of words) {
    const previous = current.at(-1);
    const breakBefore =
      previous !== undefined &&
      (/[.?!]["')\]]*$/.test(previous.text) ||
        word.start - previous.end >= PAUSE_BREAK_SECONDS ||
        current.length >= MAX_WORDS_PER_LINE);
    if (breakBefore) {
      lines.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length > 0) lines.push(current);
  return lines;
}
