import type { Word } from "@reel/shared/schemas/transcript.ts";
import type { Emphasis } from "../schemas/visualPlan.ts";
import { segmentWindow, type WordSpan } from "./rules.ts";

const MAX_WORDS = 3;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length]!;
}

function sameWord(written: string, spoken: Word): boolean {
  const a = normalize(written);
  const b = normalize(spoken.text);
  if (a === b) return true;
  const name = /^\p{Lu}/u.test(spoken.text);
  return name && distance(a, b) <= Math.max(2, Math.floor(0.3 * Math.max(a.length, b.length)));
}

export function emphasisProblems(
  emphasis: Emphasis,
  opts: { words: Word[]; duration: number; leadMs: number; segments: WordSpan[] },
): string[] {
  const { words, duration, leadMs, segments } = opts;
  const label = `emphasis "${emphasis.text}"`;
  const parts = emphasis.text.trim().split(/\s+/);
  if (parts.length > MAX_WORDS) return [`${label} is longer than three words`];
  const last = words.length - 1;
  const word = words[emphasis.atWord];
  if (!word) return [`${label} is on word ${emphasis.atWord}, past the last word (${last})`];

  const inside = segments.findIndex((segment) => {
    const window = segmentWindow(segment, words, duration, leadMs);
    return word.start >= window.start && word.start < window.end;
  });
  if (inside >= 0) {
    return [`${label} on word ${emphasis.atWord} falls inside segment ${inside + 1}; emphasis is for the speaker's own shots`];
  }

  const said = words.slice(emphasis.atWord, emphasis.atWord + parts.length);
  if (said.length !== parts.length || !parts.every((part, k) => sameWord(part, said[k]!))) {
    return [`${label} on word ${emphasis.atWord} doesn't match what is said there ("${said.map((w) => w.text).join(" ")}")`];
  }
  return [];
}
