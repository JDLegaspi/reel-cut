import type { Word } from "@reel/shared/schemas/transcript.ts";
import type { TimeSpan, WordRange } from "../cut/segments.ts";
import type { Removal } from "../schemas/cuts.ts";

export interface RetakeOutput {
  keep: WordRange[];
  removed: Removal[];
}

export interface RetakeInput {
  words: Word[];
  clips: TimeSpan[];
  retakeWord: string;
  aggressive: boolean;
  retry?: { previous: RetakeOutput; errors: string[] };
}

export interface RetakeResult extends RetakeOutput {
  raw: unknown;
}

export interface RetakeFinder {
  find(input: RetakeInput): Promise<RetakeResult>;
}
