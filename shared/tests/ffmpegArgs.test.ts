import { describe, expect, test } from "vitest";
import { buildAudioExtractArgs, buildFramesArgs, buildRemuxArgs, frameInterval } from "../src/media/ffmpegArgs.ts";

describe("buildAudioExtractArgs", () => {
  test("extracts 16 kHz mono PCM", () => {
    const args = buildAudioExtractArgs("in.mp4", "out.wav");
    expect(args).toEqual(expect.arrayContaining(["-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"]));
    expect(args.at(-1)).toBe("out.wav");
  });
});

describe("frameInterval", () => {
  test("uses the configured interval for short reels", () => {
    expect(frameInterval(30, { interval: 2, maxFrames: 24 })).toBe(2);
  });

  test("widens the interval so long reels stay within maxFrames", () => {
    expect(frameInterval(120, { interval: 2, maxFrames: 24 })).toBe(5);
  });
});

describe("buildFramesArgs", () => {
  const args = buildFramesArgs({ input: "v.mp4", outputPattern: "f/%03d.jpg", interval: 2.5, maxFrames: 24, width: 720 });

  test("samples at the interval and scales to the width", () => {
    expect(args[args.indexOf("-vf") + 1]).toBe("fps=1/2.5,scale=720:-2");
  });

  test("caps the frame count", () => {
    expect(args[args.indexOf("-frames:v") + 1]).toBe("24");
  });
});

describe("buildRemuxArgs", () => {
  test("copies streams and tolerates a missing audio track", () => {
    const args = buildRemuxArgs("in.mov", "out.mp4");
    expect(args).toEqual(expect.arrayContaining(["-map", "0:a:0?", "-c", "copy"]));
  });
});
