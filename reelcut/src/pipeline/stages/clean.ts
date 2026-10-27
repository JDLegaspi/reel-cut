import { rm } from "node:fs/promises";
import { runCapture } from "@reel/shared/media/ffmpeg.ts";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { commitTemp, tempPathFor } from "@reel/shared/util/fs.ts";
import { buildVoiceArgs } from "../../media/cutArgs.ts";
import type { ReelcutContext } from "../context.ts";
import { readProject } from "../project.ts";

export const clean: Stage<ReelcutContext> = {
  name: "clean",
  inputs: async (ctx) => [ctx.paths.project, ctx.paths.source],
  outputs: async (ctx) => [ctx.paths.voice],
  async run(ctx) {
    const { ffmpeg } = ctx.config.paths;
    const sampleRate = ctx.config.video.audioSampleRate;
    const temp = tempPathFor(ctx.paths.voice);
    await runCapture(ffmpeg, buildVoiceArgs({ input: ctx.paths.source, output: temp, sampleRate }));

    if ((await readProject(ctx)).isolateVoice) {
      const isolated = `${temp}.isolated`;
      ctx.log("isolating the voice with ElevenLabs");
      await ctx.isolator().isolate(temp, isolated);
      await runCapture(ffmpeg, buildVoiceArgs({ input: isolated, output: temp, sampleRate }));
      await rm(isolated, { force: true });
    }
    await commitTemp(temp, ctx.paths.voice);
  },
};
