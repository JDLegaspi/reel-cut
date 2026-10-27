import { sampleFramesAt } from "@reel/shared/frames/frames.ts";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { TranscriptSchema } from "@reel/shared/schemas/transcript.ts";
import { readJson, writeJsonAtomic } from "@reel/shared/util/fs.ts";
import { frameTimes } from "../../plan/frameTimes.ts";
import type { ReelcutContext } from "../context.ts";
import { readProject } from "../project.ts";

export const frames: Stage<ReelcutContext> = {
  name: "frames",
  inputs: async (ctx) => [ctx.paths.project, ctx.paths.cut, ctx.paths.cutTranscript],
  outputs: async (ctx) => [ctx.paths.frames],
  async run(ctx) {
    if (!(await readProject(ctx)).face) {
      await writeJsonAtomic(ctx.paths.frames, { version: 1, frames: [] });
      ctx.log("voice only; no frames");
      return;
    }
    const transcript = await readJson(ctx.paths.cutTranscript, TranscriptSchema);
    const { maxFrames, interval, width } = ctx.config.frames;
    const times = frameTimes({ words: transcript.words, duration: transcript.duration, maxFrames, interval });
    const manifest = await sampleFramesAt({
      ffmpeg: ctx.config.paths.ffmpeg,
      video: ctx.paths.cut,
      framesDir: ctx.paths.framesDir,
      manifest: ctx.paths.frames,
      times,
      width,
    });
    ctx.log(`${manifest.frames.length} frames, including one on each name-like word`);
  },
};
