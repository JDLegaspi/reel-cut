import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { runCapture } from "../../media/ffmpeg.ts";
import { buildFramesArgs, frameInterval } from "../../media/ffmpegArgs.ts";
import { probe } from "../../media/probe.ts";
import type { Frames } from "../../schemas/reel.ts";
import { tempPathFor, writeJsonAtomic } from "../../util/fs.ts";
import type { Stage } from "../stage.ts";

export const frames: Stage = {
  name: "frames",
  inputs: async (ctx) => [ctx.paths.video],
  outputs: (ctx) => [ctx.paths.frames],
  async run(ctx) {
    const { ffmpeg, ffprobe } = ctx.config.paths;
    const { interval: minInterval, maxFrames, width } = ctx.config.frames;
    const { duration } = await probe(ffprobe, ctx.paths.video);
    const interval = frameInterval(duration, { interval: minInterval, maxFrames });

    const tempDir = tempPathFor(ctx.paths.framesDir);
    await rm(tempDir, { recursive: true, force: true });
    await mkdir(tempDir);
    await runCapture(
      ffmpeg,
      buildFramesArgs({ input: ctx.paths.video, outputPattern: join(tempDir, "%03d.jpg"), interval, maxFrames, width }),
    );
    await rm(ctx.paths.framesDir, { recursive: true, force: true });
    await rename(tempDir, ctx.paths.framesDir);

    const files = (await readdir(ctx.paths.framesDir)).filter((f) => f.endsWith(".jpg")).sort();
    const manifest: Frames = {
      version: 1,
      interval,
      frames: files.map((file, k) => ({ file: `frames/${file}`, t: Number((k * interval).toFixed(3)) })),
    };
    await writeJsonAtomic(ctx.paths.frames, manifest);
    ctx.log(`${files.length} frames, one every ${interval.toFixed(1)}s`);
  },
};
