import type { WordRange } from "../cut/segments.ts";

export function keepProblems(keep: WordRange[], wordCount: number): string[] {
  const last = wordCount - 1;
  const problems = keep.flatMap((range, index) => {
    const n = index + 1;
    const errors: string[] = [];
    for (const key of ["fromWord", "toWord"] as const) {
      if (range[key] < 0) errors.push(`keep ${n}: ${key} ${range[key]} is before the first word (0)`);
      if (range[key] > last) errors.push(`keep ${n}: ${key} ${range[key]} is past the last word (${last})`);
    }
    if (range.toWord < range.fromWord) errors.push(`keep ${n}: toWord ${range.toWord} comes before fromWord ${range.fromWord}`);
    return errors;
  });
  if (problems.length > 0) return problems;
  if (wordCount > 0 && keep.length === 0) return ["keep is empty, so the video would have no words"];

  const keptBy = new Map<number, number>();
  const twice: string[] = [];
  keep.forEach((range, index) => {
    for (let word = range.fromWord; word <= range.toWord; word++) {
      const earlier = keptBy.get(word);
      if (earlier !== undefined) twice.push(`word ${word} is kept twice (keep ${earlier} and keep ${index + 1})`);
      else keptBy.set(word, index + 1);
    }
  });
  return twice;
}
