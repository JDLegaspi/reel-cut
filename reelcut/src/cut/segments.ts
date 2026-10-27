import type { Word } from "@reel/shared/schemas/transcript.ts";

export interface CutSettings {
  padBefore: number;
  padAfter: number;
  maxGap: number;
}

export interface WordRange {
  fromWord: number;
  toWord: number;
}

export interface TimeSpan {
  start: number;
  end: number;
}

export interface CutSegment {
  srcStart: number;
  srcEnd: number;
  cutStart: number;
  cutEnd: number;
}

export interface CutWord extends Word {
  srcI: number;
}

export interface CutPlan {
  segments: CutSegment[];
  words: CutWord[];
  duration: number;
}

export function keepFromRemoved(wordCount: number, removed: WordRange[]): WordRange[] {
  const gone = new Set(removed.flatMap((range) => Array.from({ length: range.toWord - range.fromWord + 1 }, (_, k) => range.fromWord + k)));
  const keep: WordRange[] = [];
  for (let i = 0; i < wordCount; i++) {
    if (gone.has(i)) continue;
    const last = keep.at(-1);
    if (last && last.toWord === i - 1) last.toWord = i;
    else keep.push({ fromWord: i, toWord: i });
  }
  return keep;
}

function runsIn(words: Word[], range: WordRange, maxGap: number): Word[][] {
  const runs: Word[][] = [];
  for (const word of words.slice(range.fromWord, range.toWord + 1)) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    if (run && last && word.start - last.end <= maxGap) run.push(word);
    else runs.push([word]);
  }
  return runs;
}

function clipAround(clips: TimeSpan[], time: number, duration: number): TimeSpan {
  return clips.find((clip) => time >= clip.start && time < clip.end) ?? { start: 0, end: duration };
}

const ms = (seconds: number) => Math.round(seconds * 1000) / 1000;

export function planCut(opts: {
  words: Word[];
  keep: WordRange[];
  duration: number;
  fps: number;
  settings: CutSettings;
  clips?: TimeSpan[];
}): CutPlan {
  const { words, duration, fps, settings } = opts;
  const clips = opts.clips ?? [];
  const total = Math.round(duration * fps);
  if (words.length === 0) return { segments: [{ srcStart: 0, srcEnd: total / fps, cutStart: 0, cutEnd: total / fps }], words: [], duration: total / fps };

  const spans: { from: number; to: number; words: Word[] }[] = [];
  for (const range of opts.keep) {
    for (const run of runsIn(words, range, settings.maxGap)) {
      const first = run[0]!;
      const last = run.at(-1)!;
      const before = words[first.i - 1];
      const after = words[last.i + 1];
      const lead = first.i > range.fromWord ? settings.maxGap / 2 : settings.padBefore;
      const tail = last.i < range.toWord ? settings.maxGap / 2 : settings.padAfter;
      const clip = clipAround(clips, first.start, duration);
      const start = Math.max(first.start - lead, before?.end ?? 0, clip.start, 0);
      const end = Math.min(last.end + tail, after?.start ?? duration, clipAround(clips, last.end, duration).end, duration);
      const from = Math.round(start * fps);
      const to = Math.min(Math.round(end * fps), total);
      const previous = spans.at(-1);
      if (previous && from >= previous.from && from <= previous.to) {
        previous.to = Math.max(previous.to, to);
        previous.words.push(...run);
      } else if (to > from) spans.push({ from, to, words: [...run] });
    }
  }

  for (const clip of clips) {
    if (words.some((word) => word.start >= clip.start && word.start < clip.end)) continue;
    const silent = { from: Math.round(clip.start * fps), to: Math.min(Math.round(clip.end * fps), total), words: [] };
    const next = spans.findIndex((span) => span.from >= silent.to);
    spans.splice(next === -1 ? spans.length : next, 0, silent);
  }

  let elapsed = 0;
  const segments: CutSegment[] = [];
  const cutWords: CutWord[] = [];
  for (const span of spans) {
    const segment = { srcStart: span.from / fps, srcEnd: span.to / fps, cutStart: elapsed / fps, cutEnd: (elapsed + span.to - span.from) / fps };
    const shift = segment.cutStart - segment.srcStart;
    const clamp = (t: number) => ms(Math.min(Math.max(t + shift, segment.cutStart), segment.cutEnd));
    for (const word of span.words) {
      cutWords.push({ i: cutWords.length, srcI: word.i, text: word.text, start: clamp(word.start), end: clamp(word.end) });
    }
    segments.push(segment);
    elapsed += span.to - span.from;
  }
  return { segments, words: cutWords, duration: elapsed / fps };
}
