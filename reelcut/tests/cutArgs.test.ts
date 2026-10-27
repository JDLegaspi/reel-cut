import { describe, expect, test } from "vitest";
import { buildPartArgs, buildVoiceArgs, loudnessFilter, parseLoudness } from "../src/media/cutArgs.ts";
import type { VideoSettings } from "../src/media/ingestArgs.ts";
import { buildJoinArgs, buildMeasureArgs, concatList } from "../src/media/parts.ts";

const video: VideoSettings = { width: 1080, height: 1920, crf: 18, preset: "medium", audioBitrate: "192k", audioSampleRate: 48000 };
const measured = { input_i: "-21.75", input_tp: "-18.06", input_lra: "0.00", input_thresh: "-31.75", target_offset: "0.05" };

describe("buildVoiceArgs", () => {
  test("extracts mono PCM at the output sample rate", () => {
    const args = buildVoiceArgs({ input: "source.mp4", output: "voice.wav", sampleRate: 48000 });
    expect(args.slice(args.indexOf("-i"))).toEqual(["-i", "source.mp4", "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", "voice.wav"]);
  });
});

describe("buildPartArgs", () => {
  const args = buildPartArgs({
    video: "source.mp4",
    audio: "voice.wav",
    output: "part.mov",
    fps: { num: 10, den: 1 },
    segment: { srcStart: 0.9, srcEnd: 2.1, cutStart: 0, cutEnd: 1.2 },
    fadeSeconds: 0.03,
    settings: video,
  });
  const filter = args[args.indexOf("-filter_complex") + 1]!;

  test("seeks the picture half a frame early and keeps a whole number of frames", () => {
    expect(args.slice(args.indexOf("-ss"), args.indexOf("-ss") + 4)).toEqual(["-ss", "0.850000", "-i", "source.mp4"]);
    expect(filter).toContain("[0:v]setpts=PTS-STARTPTS,trim=end_frame=12[v]");
  });

  test("takes the sound from the voice track, sample-accurate, fading in and out", () => {
    expect(args.slice(args.lastIndexOf("-ss"), args.lastIndexOf("-ss") + 4)).toEqual(["-ss", "0.900000", "-i", "voice.wav"]);
    expect(filter).toContain("[1:a]asetpts=PTS-STARTPTS,atrim=end_sample=57600,afade=t=in:d=0.030,afade=t=out:st=1.170:d=0.030[a]");
  });

  test("writes H.264 with PCM sound so the parts join without gaps", () => {
    expect(args).toEqual(expect.arrayContaining(["-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-c:a", "pcm_s16le"]));
    expect(args.at(-1)).toBe("part.mov");
  });
});

describe("loudness", () => {
  test("reads ffmpeg's loudness report", () => {
    const stderr = `[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-21.75",\n\t"input_tp" : "-18.06",\n\t"input_lra" : "0.00",\n\t"input_thresh" : "-31.75",\n\t"output_i" : "-14.05",\n\t"normalization_type" : "linear",\n\t"target_offset" : "0.05"\n}\nsize=N/A`;
    expect(parseLoudness(stderr)).toEqual(measured);
  });

  test("applies one gain from the measurement to reach the target", () => {
    expect(loudnessFilter(-14, measured)).toBe(
      "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-21.75:measured_TP=-18.06:measured_LRA=0.00:measured_thresh=-31.75:offset=0.05:linear=true",
    );
  });
});

describe("parts", () => {
  test("lists parts for ffmpeg's concat demuxer, quoting paths safely", () => {
    expect(concatList(["/a/part-1.mov", "/a/it's.mov"])).toBe("file '/a/part-1.mov'\nfile '/a/it'\\''s.mov'\n");
  });

  test("joins parts by copying the picture and encoding the sound once", () => {
    const args = buildJoinArgs({ list: "parts.txt", output: "out.mp4", video, audioFilter: "loudnorm=I=-14" });
    expect(args.slice(args.indexOf("-f"), args.indexOf("-f") + 6)).toEqual(["-f", "concat", "-safe", "0", "-i", "parts.txt"]);
    expect(args).toEqual(expect.arrayContaining(["-c:v", "copy", "-af", "loudnorm=I=-14", "-c:a", "aac", "-b:a", "192k"]));
    expect(args.at(-1)).toBe("out.mp4");
  });

  test("measures the joined sound without writing a file", () => {
    const args = buildMeasureArgs({ list: "parts.txt", loudness: -14 });
    expect(args).toEqual(expect.arrayContaining(["-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json"]));
    expect(args.slice(-3)).toEqual(["-f", "null", "-"]);
  });
});
