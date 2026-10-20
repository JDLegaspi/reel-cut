import { open } from "node:fs/promises";
import { basename } from "node:path";
import { runCapture } from "@reel/shared/media/ffmpeg.ts";

const LONGEST_EDGE = 1568;
const ALPHA_FORMATS = /^(rgba|bgra|argb|abgr|ya|yuva|gbrap|pal8)/;

const SIGNATURES: [string, (head: Buffer) => boolean][] = [
  ["png_pipe", (head) => head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["jpeg_pipe", (head) => head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff],
  ["gif_pipe", (head) => ["GIF87a", "GIF89a"].includes(head.subarray(0, 6).toString("latin1"))],
  ["webp_pipe", (head) => head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP"],
];

export async function imageDemuxer(path: string): Promise<string | null> {
  const file = await open(path, "r");
  try {
    const head = Buffer.alloc(16);
    await file.read(head, 0, 16, 0);
    return SIGNATURES.find(([, matches]) => matches(head))?.[0] ?? null;
  } finally {
    await file.close();
  }
}

export async function normalizeImage(
  tools: { ffmpeg: string; ffprobe: string },
  input: string,
  outputBase: string,
  name = basename(input),
): Promise<string> {
  const demuxer = await imageDemuxer(input);
  if (!demuxer) throw new Error(`${name} is not a PNG, JPEG, GIF or WebP image`);
  const format = (
    await runCapture(tools.ffprobe, ["-v", "error", "-f", demuxer, "-i", input, "-select_streams", "v:0", "-show_entries", "stream=pix_fmt", "-of", "csv=p=0"])
  ).trim();
  const png = ALPHA_FORMATS.test(format);
  const output = `${outputBase}.${png ? "png" : "jpg"}`;
  const fit = `scale=w='min(${LONGEST_EDGE},iw)':h='min(${LONGEST_EDGE},ih)':force_original_aspect_ratio=decrease`;
  await runCapture(tools.ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-f",
    demuxer,
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    png ? `${fit},format=rgba` : `${fit},format=yuvj420p`,
    ...(png ? [] : ["-q:v", "3"]),
    output,
  ]);
  return output;
}
