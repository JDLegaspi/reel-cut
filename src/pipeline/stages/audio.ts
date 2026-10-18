import { runCapture } from "../../media/ffmpeg.ts";
import { buildAudioExtractArgs, buildSilenceArgs } from "../../media/ffmpegArgs.ts";
import { probe } from "../../media/probe.ts";
import { commitTemp, tempPathFor } from "../../util/fs.ts";
import type { Stage } from "../stage.ts";

export const audio: Stage = {
  name: "audio",
  inputs: async (ctx) => [ctx.paths.video],
  outputs: (ctx) => [ctx.paths.audio],
  async run(ctx) {
    const { ffmpeg, ffprobe } = ctx.config.paths;
    const info = await probe(ffprobe, ctx.paths.video);
    const temp = tempPathFor(ctx.paths.audio);
    if (info.hasAudio) {
      await runCapture(ffmpeg, buildAudioExtractArgs(ctx.paths.video, temp));
    } else {
      ctx.log("video has no audio stream; writing silence");
      await runCapture(ffmpeg, buildSilenceArgs(info.duration, temp));
    }
    await commitTemp(temp, ctx.paths.audio);
  },
};
