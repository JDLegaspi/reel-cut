import { describe, expect, test } from "vitest";
import { buildAudioExtractArgs, buildNormalizeArgs, isTargetAspect } from "../src/media/ingestArgs.ts";

const video = { width: 1080, height: 1920, crf: 18, preset: "medium", audioBitrate: "192k", audioSampleRate: 48000 };

describe("isTargetAspect", () => {
  test("accepts 9:16 at any resolution", () => {
    expect(isTargetAspect({ width: 720, height: 1280 }, video)).toBe(true);
  });

  test("rejects 16:9 and 3:4", () => {
    expect(isTargetAspect({ width: 1920, height: 1080 }, video)).toBe(false);
    expect(isTargetAspect({ width: 1080, height: 1440 }, video)).toBe(false);
  });
});

describe("buildNormalizeArgs", () => {
  const args = buildNormalizeArgs({ input: "in.mov", output: "out.mp4", fps: { num: 30000, den: 1001 }, video });
  const filter = args[args.indexOf("-vf") + 1];

  test("converts to constant frame rate before scaling", () => {
    expect(filter?.startsWith("fps=30000/1001,")).toBe(true);
  });

  test("centre-crops to the target size after scaling to cover", () => {
    expect(filter).toContain("scale=1080:1920:force_original_aspect_ratio=increase");
    expect(filter).toContain("crop=1080:1920");
  });

  test("encodes H.264 yuv420p with AAC audio", () => {
    expect(args).toEqual(expect.arrayContaining(["-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-b:a", "192k"]));
    expect(filter).toContain("format=yuv420p");
  });

  test("maps the first video and audio streams and writes the output last", () => {
    expect(args).toEqual(expect.arrayContaining(["-map", "0:v:0", "-map", "0:a:0"]));
    expect(args.at(-1)).toBe("out.mp4");
  });
});

describe("buildAudioExtractArgs", () => {
  test("extracts 16 kHz mono PCM", () => {
    const args = buildAudioExtractArgs("source.mp4", "audio.wav");
    expect(args).toEqual(expect.arrayContaining(["-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"]));
    expect(args.at(-1)).toBe("audio.wav");
  });
});
