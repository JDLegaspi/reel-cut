import { readFile, rename, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Tools } from "@reel/shared/config/schema.ts";
import { downloadVideo } from "@reel/shared/download/ytdlp.ts";
import { FramesSchema, sampleFrames } from "@reel/shared/frames/frames.ts";
import type { GatheredImage } from "./types.ts";

export async function gatherVideoFrames(opts: {
  tools: Pick<Tools, "ffmpeg" | "ffprobe">;
  video: string;
  dir: string;
  prefix: string;
  frames: number;
  caption: string;
}): Promise<GatheredImage[]> {
  const framesDir = join(opts.dir, `.${opts.prefix}-frames`);
  const manifest = join(opts.dir, `.${opts.prefix}-frames.json`);
  try {
    await sampleFrames({ tools: opts.tools, video: opts.video, framesDir, manifest, settings: { interval: 1, maxFrames: opts.frames, width: 720 } });
    const { frames } = FramesSchema.parse(JSON.parse(await readFile(manifest, "utf8")));
    const images: GatheredImage[] = [];
    for (const [k, frame] of frames.entries()) {
      const file = `${opts.prefix}-frame-${String(k + 1).padStart(2, "0")}.jpg`;
      await rename(join(framesDir, basename(frame.file)), join(opts.dir, file));
      images.push({ file: `references/${file}`, caption: `${opts.caption}, frame at ${frame.t.toFixed(1)}s` });
    }
    return images;
  } finally {
    await rm(framesDir, { recursive: true, force: true });
    await rm(manifest, { force: true });
  }
}

export async function gatherReel(opts: {
  url: string;
  tools: Tools;
  cookiesFromBrowser: string | null;
  dir: string;
  prefix: string;
  frames: number;
}): Promise<GatheredImage[]> {
  const video = join(opts.dir, `.${opts.prefix}.mp4`);
  const info = join(opts.dir, `.${opts.prefix}.info.json`);
  try {
    await downloadVideo({ url: opts.url, videoOut: video, infoOut: info, tools: opts.tools, cookiesFromBrowser: opts.cookiesFromBrowser });
    return await gatherVideoFrames({ tools: opts.tools, video, dir: opts.dir, prefix: opts.prefix, frames: opts.frames, caption: opts.url });
  } finally {
    await rm(video, { force: true });
    await rm(info, { force: true });
  }
}
