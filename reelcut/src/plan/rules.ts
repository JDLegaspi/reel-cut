import type { Word } from "@reel/shared/schemas/transcript.ts";

export interface WordSpan {
  startWord: number;
  endWord: number;
}

export interface VisualRules {
  leadMs: number;
  minSegmentSeconds: number;
  minFaceSeconds: number;
}

export function segmentWindow(span: WordSpan, words: Word[], duration: number, leadMs: number): { start: number; end: number } {
  const lead = leadMs / 1000;
  const start = Math.max(0, words[span.startWord]!.start - lead);
  const next = words[span.endWord + 1];
  return { start, end: next ? Math.max(start, next.start - lead) : duration };
}

function rangeErrors(span: WordSpan, n: number, last: number): string[] {
  const errors: string[] = [];
  for (const key of ["startWord", "endWord"] as const) {
    if (span[key] < 0) errors.push(`segment ${n}: ${key} ${span[key]} is before the first word (0)`);
    if (span[key] > last) errors.push(`segment ${n}: ${key} ${span[key]} is past the last word (${last})`);
  }
  if (span.endWord < span.startWord) errors.push(`segment ${n}: endWord ${span.endWord} comes before startWord ${span.startWord}`);
  return errors;
}

export function validatePlan(spans: WordSpan[], words: Word[], duration: number, rules: VisualRules): string[] {
  const errors: string[] = [];
  let previous: { n: number; endWord: number; end: number } | null = null;

  spans.forEach((span, index) => {
    const n = index + 1;
    const invalid = rangeErrors(span, n, words.length - 1);
    if (invalid.length > 0) {
      errors.push(...invalid);
      return;
    }
    if (previous && span.startWord <= previous.endWord) {
      errors.push(`segment ${n} starts at word ${span.startWord}, before segment ${previous.n} ends at word ${previous.endWord}`);
      return;
    }

    const window = segmentWindow(span, words, duration, rules.leadMs);
    const length = window.end - window.start;
    if (length < rules.minSegmentSeconds) {
      errors.push(`segment ${n} is on screen for ${length.toFixed(1)}s; a visual needs at least ${rules.minSegmentSeconds}s`);
    }
    if (previous) {
      const face = window.start - previous.end;
      if (face > 0 && face < rules.minFaceSeconds) {
        errors.push(
          `the speaker is on screen for only ${face.toFixed(1)}s between segments ${previous.n} and ${n}; put them back to back or leave at least ${rules.minFaceSeconds}s`,
        );
      }
    }
    previous = { n, endWord: span.endWord, end: window.end };
  });

  return errors;
}

export function bulleted(errors: string[]): string {
  return errors.map((error) => `- ${error}`).join("\n");
}
