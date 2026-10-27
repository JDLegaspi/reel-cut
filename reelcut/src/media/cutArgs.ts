import type { Rational } from "@reel/shared/media/probe.ts";
import type { CutSegment } from "../cut/segments.ts";
import { videoEncodeArgs, type VideoSettings } from "./ingestArgs.ts";
import { loudnormTarget } from "./parts.ts";

const QUIET = ["-y", "-hide_banner", "-loglevel", "error"];

export function buildVoiceArgs(opts: { input: string; output: string; sampleRate: number }): string[] {
  return [...QUIET, "-i", opts.input, "-vn", "-ac", "1", "-ar", String(opts.sampleRate), "-c:a", "pcm_s16le", opts.output];
}

export interface Loudness {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

export function parseLoudness(stderr: string): Loudness {
  const report = /\{[^{}]*"input_i"[^{}]*\}/.exec(stderr);
  if (!report) throw new Error("ffmpeg did not report the loudness of the cut");
  const { input_i, input_tp, input_lra, input_thresh, target_offset } = JSON.parse(report[0]);
  return { input_i, input_tp, input_lra, input_thresh, target_offset };
}

export function loudnessFilter(loudness: number, measured: Loudness): string {
  return (
    `${loudnormTarget(loudness)}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
    `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
  );
}

export function buildPartArgs(opts: {
  video: string;
  audio: string;
  output: string;
  fps: Rational;
  segment: CutSegment;
  fadeSeconds: number;
  settings: VideoSettings;
}): string[] {
  const { segment, settings } = opts;
  const rate = opts.fps.num / opts.fps.den;
  const length = segment.srcEnd - segment.srcStart;
  const frames = Math.round(length * rate);
  const samples = Math.round(length * settings.audioSampleRate);
  const fade = Math.min(opts.fadeSeconds, length / 2);
  const filter = [
    `[0:v]setpts=PTS-STARTPTS,trim=end_frame=${frames}[v]`,
    `[1:a]asetpts=PTS-STARTPTS,atrim=end_sample=${samples},` +
      `afade=t=in:d=${fade.toFixed(3)},afade=t=out:st=${(length - fade).toFixed(3)}:d=${fade.toFixed(3)}[a]`,
  ].join(";");

  return [
    ...QUIET,
    "-ss",
    Math.max(0, segment.srcStart - 0.5 / rate).toFixed(6),
    "-i",
    opts.video,
    "-ss",
    segment.srcStart.toFixed(6),
    "-i",
    opts.audio,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-r",
    `${opts.fps.num}/${opts.fps.den}`,
    "-pix_fmt",
    "yuv420p",
    ...videoEncodeArgs(settings),
    "-c:a",
    "pcm_s16le",
    "-ar",
    String(settings.audioSampleRate),
    "-ac",
    "2",
    opts.output,
  ];
}
