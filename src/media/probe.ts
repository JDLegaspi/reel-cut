import { z } from "zod";
import { runCapture } from "./ffmpeg.ts";

export interface Rational {
  num: number;
  den: number;
}

export interface MediaInfo {
  width: number;
  height: number;
  rotation: number;
  fps: Rational;
  duration: number;
  hasAudio: boolean;
  hdr: boolean;
  videoCodec: string;
}

const STANDARD_RATES: Rational[] = [
  { num: 24000, den: 1001 },
  { num: 24, den: 1 },
  { num: 25, den: 1 },
  { num: 30000, den: 1001 },
  { num: 30, den: 1 },
  { num: 48, den: 1 },
  { num: 50, den: 1 },
  { num: 60000, den: 1001 },
  { num: 60, den: 1 },
];

const SNAP_TOLERANCE = 0.02;
const HDR_TRANSFERS = new Set(["smpte2084", "arib-std-b67"]);

export function rationalToNumber(r: Rational): number {
  return r.num / r.den;
}

export function snapFps(rate: number): Rational {
  let best = STANDARD_RATES[0]!;
  let bestError = Infinity;
  for (const candidate of STANDARD_RATES) {
    const error = Math.abs(rationalToNumber(candidate) - rate) / rate;
    if (error < bestError) {
      best = candidate;
      bestError = error;
    }
  }
  return bestError <= SNAP_TOLERANCE ? best : { num: Math.round(rate), den: 1 };
}

function parseRate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const [n, d] = value.split("/").map(Number);
  if (!n || !d || !Number.isFinite(n / d)) return null;
  return n / d;
}

const ProbeStreamSchema = z.object({
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  avg_frame_rate: z.string().optional(),
  r_frame_rate: z.string().optional(),
  color_transfer: z.string().optional(),
  tags: z.object({ rotate: z.string().optional() }).optional(),
  side_data_list: z.array(z.object({ rotation: z.number().optional() })).optional(),
});

const ProbeJsonSchema = z.object({
  streams: z.array(ProbeStreamSchema).default([]),
  format: z.object({ duration: z.string().optional() }).optional(),
});

type ProbeStream = z.infer<typeof ProbeStreamSchema>;

function readRotation(stream: ProbeStream): number {
  const fromSideData = stream.side_data_list?.find((s) => typeof s.rotation === "number")?.rotation;
  if (typeof fromSideData === "number") return fromSideData;
  const fromTag = Number(stream.tags?.rotate);
  return Number.isFinite(fromTag) ? fromTag : 0;
}

export function parseProbe(raw: unknown): MediaInfo {
  const json = ProbeJsonSchema.parse(raw);
  const streams = json.streams;
  const video = streams.find((s) => s.codec_type === "video");
  if (!video || !video.width || !video.height) throw new Error("Input has no video stream");

  const rate = parseRate(video.avg_frame_rate) ?? parseRate(video.r_frame_rate);
  if (!rate) throw new Error("Could not determine the input frame rate");

  const rotation = readRotation(video);
  const swap = Math.abs(rotation) % 180 === 90;

  return {
    width: swap ? video.height : video.width,
    height: swap ? video.width : video.height,
    rotation,
    fps: snapFps(rate),
    duration: Number(json.format?.duration ?? 0),
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    hdr: HDR_TRANSFERS.has(video.color_transfer ?? ""),
    videoCodec: video.codec_name ?? "unknown",
  };
}

export async function probe(ffprobePath: string, file: string): Promise<MediaInfo> {
  const stdout = await runCapture(ffprobePath, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    file,
  ]);
  return parseProbe(JSON.parse(stdout));
}
