import type { Rational } from "@reel/shared/media/probe.ts";
import type { ReelcutConfig } from "../config/schema.ts";

export type VideoSettings = ReelcutConfig["video"];

const ASPECT_TOLERANCE = 0.01;

export function isTargetAspect(size: { width: number; height: number }, target: VideoSettings): boolean {
  return Math.abs(size.width / size.height - target.width / target.height) <= ASPECT_TOLERANCE;
}

export const VOICE_ONLY_FPS: Rational = { num: 30, den: 1 };

function encodeArgs(video: VideoSettings, output: string): string[] {
  return [
    "-c:v",
    "libx264",
    "-preset",
    video.preset,
    "-crf",
    String(video.crf),
    "-c:a",
    "aac",
    "-b:a",
    video.audioBitrate,
    "-ar",
    String(video.audioSampleRate),
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    output,
  ];
}

export function buildVoiceOnlyArgs(opts: { input: string; output: string; video: VideoSettings }): string[] {
  const { input, output, video } = opts;
  const fps = VOICE_ONLY_FPS.num / VOICE_ONLY_FPS.den;
  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${video.width}x${video.height}:r=${fps}`,
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-map_metadata",
    "-1",
    "-shortest",
    "-pix_fmt",
    "yuv420p",
    ...encodeArgs(video, output),
  ];
}

export function buildNormalizeArgs(opts: { input: string; output: string; fps: Rational; video: VideoSettings }): string[] {
  const { input, output, fps, video } = opts;
  const filter = [
    `fps=${fps.num}/${fps.den}`,
    `scale=${video.width}:${video.height}:force_original_aspect_ratio=increase`,
    `crop=${video.width}:${video.height}`,
    "setsar=1",
    "format=yuv420p",
  ].join(",");

  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0",
    "-map_metadata",
    "-1",
    "-vf",
    filter,
    "-af",
    "aresample=async=1:first_pts=0",
    ...encodeArgs(video, output),
  ];
}
