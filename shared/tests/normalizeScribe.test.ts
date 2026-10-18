import { describe, expect, test } from "vitest";
import { normalizeScribe } from "../src/transcribe/normalizeScribe.ts";

const response = {
  languageCode: "eng",
  languageProbability: 0.99,
  text: "So the cache, again so",
  words: [
    { text: "So", start: 0.42, end: 0.61, type: "word", logprob: -0.1 },
    { text: " ", start: 0.61, end: 0.66, type: "spacing", logprob: 0 },
    { text: "the", start: 0.66, end: 0.8, type: "word", logprob: -0.1 },
    { text: " ", start: 0.8, end: 0.85, type: "spacing", logprob: 0 },
    { text: "(laughs)", start: 0.85, end: 1.2, type: "audio_event", logprob: 0 },
    { text: "cache,", start: 1.2, end: 1.5, type: "word", logprob: -0.2 },
    { text: "again", start: 2.9, end: 3.3, type: "word", logprob: -0.1 },
    { text: "so", type: "word", logprob: -0.1 },
  ],
};

describe("normalizeScribe", () => {
  test("keeps only timed words and re-indexes them from zero", () => {
    const transcript = normalizeScribe(response, 4.0);
    expect(transcript.words).toEqual([
      { i: 0, text: "So", start: 0.42, end: 0.61 },
      { i: 1, text: "the", start: 0.66, end: 0.8 },
      { i: 2, text: "cache,", start: 1.2, end: 1.5 },
      { i: 3, text: "again", start: 2.9, end: 3.3 },
    ]);
  });

  test("records provider, language and duration", () => {
    const transcript = normalizeScribe(response, 4.0);
    expect(transcript).toMatchObject({
      version: 1,
      provider: "elevenlabs/scribe_v2",
      language: "eng",
      duration: 4.0,
    });
  });

  test("trims whitespace and drops words that are empty after trimming", () => {
    const transcript = normalizeScribe(
      {
        ...response,
        words: [
          { text: " hello ", start: 0, end: 0.3, type: "word", logprob: 0 },
          { text: "  ", start: 0.3, end: 0.4, type: "word", logprob: 0 },
        ],
      },
      1,
    );
    expect(transcript.words).toEqual([{ i: 0, text: "hello", start: 0, end: 0.3 }]);
  });

  test("clamps an end that precedes its start", () => {
    const transcript = normalizeScribe(
      { ...response, words: [{ text: "x", start: 1.0, end: 0.9, type: "word", logprob: 0 }] },
      2,
    );
    expect(transcript.words[0]).toEqual({ i: 0, text: "x", start: 1.0, end: 1.0 });
  });
});
