import { audioEncodeArgs, type VideoSettings } from "./ingestArgs.ts";

export function concatList(paths: string[]): string {
  return paths.map((path) => `file '${path.replaceAll("'", "'\\''")}'\n`).join("");
}

export function buildJoinArgs(opts: { list: string; output: string; video: VideoSettings; audioFilter?: string }): string[] {
  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    opts.list,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0",
    "-c:v",
    "copy",
    ...(opts.audioFilter ? ["-af", opts.audioFilter] : []),
    ...audioEncodeArgs(opts.video),
    "-movflags",
    "+faststart",
    opts.output,
  ];
}

export const loudnormTarget = (loudness: number) => `loudnorm=I=${loudness}:TP=-1.5:LRA=11`;

export function buildMeasureArgs(opts: { list: string; loudness: number }): string[] {
  return [
    "-hide_banner",
    "-nostats",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    opts.list,
    "-vn",
    "-af",
    `${loudnormTarget(opts.loudness)}:print_format=json`,
    "-f",
    "null",
    "-",
  ];
}
