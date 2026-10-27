import type { Word } from "@reel/shared/schemas/transcript.ts";
import { captionText } from "./captions.ts";

export type Spellings = Record<string, string>;

const wordsOf = (text: string) => text.trim().split(/\s+/);

export function spellingProblems(spellings: Spellings): string[] {
  return Object.entries(spellings).flatMap(([heard, fixed]) => {
    const [from, to] = [wordsOf(heard).length, wordsOf(fixed).length];
    return from === to
      ? []
      : [`spellings: "${heard}" has ${from} word${from === 1 ? "" : "s"} but "${fixed}" has ${to}; a fix must keep the number of words`];
  });
}

export function applySpellings<T extends Word>(words: T[], spellings: Spellings): T[] {
  const fixed = words.map((word) => ({ ...word }));
  for (const [heard, correct] of Object.entries(spellings)) {
    const from = wordsOf(heard).map((part) => part.toLowerCase());
    const to = wordsOf(correct);
    for (let k = 0; k + from.length <= fixed.length; k++) {
      const run = fixed.slice(k, k + from.length);
      if (!run.every((word, j) => captionText(word.text).toLowerCase() === from[j])) continue;
      run.forEach((word, j) => {
        const bare = captionText(word.text);
        const at = word.text.indexOf(bare);
        word.text = word.text.slice(0, at) + to[j] + word.text.slice(at + bare.length);
      });
    }
  }
  return fixed;
}
