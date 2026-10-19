import { mkdir, readdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { Tools } from "../config/schema.ts";
import { runCapture } from "../media/ffmpeg.ts";
import { buildFrameAtArgs, buildFramesArgs, frameInterval } from "../media/ffmpegArgs.ts";
import { probe } from "../media/probe.ts";
import { readJson, tempPathFor, writeJsonAtomic } from "../util/fs.ts";

export const FrameSchema = z.object({
  file: z.string(),
  t: z.number().nonnegative(),
});

export const FramesSchema = z.object({
  version: z.literal(1),
  interval: z.number().positive().optional(),
  frames: z.array(FrameSchema),
});

export const FrameSettingsSchema = z.object({
  interval: z.number().positive(),
  maxFrames: z.number().int().positive(),
  width: z.number().int().positive(),
});

export type Frames = z.infer<typeof FramesSchema>;
export type FrameSettings = z.infer<typeof FrameSettingsSchema>;

export interface FrameImage {
  t: number;
  data: Buffer;
}

export async function sampleFrames(opts: {
  tools: Pick<Tools, "ffmpeg" | "ffprobe">;
  video: string;
  framesDir: string;
  manifest: string;
  settings: FrameSettings;
}): Promise<Frames & { interval: number }> {
  const { tools, video, framesDir, settings } = opts;
  const { duration } = await probe(tools.ffprobe, video);
  const interval = frameInterval(duration, { interval: settings.interval, maxFrames: settings.maxFrames });

  const tempDir = tempPathFor(framesDir);
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir);
  await runCapture(
    tools.ffmpeg,
    buildFramesArgs({
      input: video,
      outputPattern: join(tempDir, "%03d.jpg"),
      interval,
      maxFrames: settings.maxFrames,
      width: settings.width,
    }),
  );
  await rm(framesDir, { recursive: true, force: true });
  await rename(tempDir, framesDir);

  const files = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();
  const manifest = {
    version: 1 as const,
    interval,
    frames: files.map((file, k) => ({ file: `frames/${file}`, t: Number((k * interval).toFixed(3)) })),
  };
  await writeJsonAtomic(opts.manifest, manifest);
  return manifest;
}

export async function sampleFramesAt(opts: {
  ffmpeg: string;
  video: string;
  framesDir: string;
  manifest: string;
  times: number[];
  width: number;
}): Promise<Frames> {
  const { ffmpeg, video, framesDir, times, width } = opts;
  const tempDir = tempPathFor(framesDir);
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir);
  const files = times.map((_, k) => `${String(k + 1).padStart(3, "0")}.jpg`);
  for (const [k, seconds] of times.entries()) {
    await runCapture(ffmpeg, buildFrameAtArgs({ input: video, output: join(tempDir, files[k]!), seconds, width }));
  }
  await rm(framesDir, { recursive: true, force: true });
  await rename(tempDir, framesDir);

  const manifest: Frames = {
    version: 1,
    frames: times.map((t, k) => ({ file: `frames/${files[k]}`, t: Number(t.toFixed(3)) })),
  };
  await writeJsonAtomic(opts.manifest, manifest);
  return manifest;
}

export async function loadFrameImages(manifestPath: string): Promise<FrameImage[]> {
  const manifest = await readJson(manifestPath, FramesSchema);
  const dir = dirname(manifestPath);
  return Promise.all(manifest.frames.map(async (frame) => ({ t: frame.t, data: await readFile(join(dir, frame.file)) })));
}
