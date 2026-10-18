import type { Rational } from "@reel/shared/media/probe.ts";

export interface VideoSettings {
  width: number;
  height: number;
  crf: number;
  preset: string;
  audioBitrate: string;
  audioSampleRate: number;
}

const ASPECT_TOLERANCE = 0.01;

export function isTargetAspect(size: { width: number; height: number }, target: VideoSettings): boolean {
  return Math.abs(size.width / size.height - target.width / target.height) <= ASPECT_TOLERANCE;
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
