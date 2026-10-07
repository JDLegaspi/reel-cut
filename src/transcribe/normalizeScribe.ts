import type { Transcript } from "../schemas/transcript.ts";

export const SCRIBE_PROVIDER = "elevenlabs/scribe_v2";

export interface ScribeWord {
  text: string;
  start?: number;
  end?: number;
  type: string;
  logprob?: number;
}

export interface ScribeResponse {
  languageCode?: string;
  words: ScribeWord[];
}

export function normalizeScribe(response: ScribeResponse, duration: number, provider = SCRIBE_PROVIDER): Transcript {
  const words = response.words
    .filter((w) => w.type === "word" && typeof w.start === "number" && typeof w.end === "number")
    .map((w) => ({ text: w.text.trim(), start: w.start as number, end: Math.max(w.start as number, w.end as number) }))
    .filter((w) => w.text.length > 0)
    .map((w, i) => ({ i, ...w }));

  return {
    version: 1,
    provider,
    language: response.languageCode ?? null,
    duration,
    words,
  };
}
