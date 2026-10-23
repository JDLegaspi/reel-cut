import { runCapture } from "@reel/shared/media/ffmpeg.ts";
import { buildAudioExtractArgs } from "@reel/shared/media/ffmpegArgs.ts";
import { probe, rationalToNumber } from "@reel/shared/media/probe.ts";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { commitTemp, tempPathFor } from "@reel/shared/util/fs.ts";
import { buildNormalizeArgs, buildVoiceOnlyArgs, isTargetAspect } from "../../media/ingestArgs.ts";
import type { ReelcutContext } from "../context.ts";
import { readProject, sourceVideo } from "../project.ts";

async function normalizeArgs(ctx: ReelcutContext, input: string, output: string): Promise<string[]> {
  const { video } = ctx.config;
  const info = await probe(ctx.config.paths.ffprobe, input);
  ctx.log(
    `input ${info.width}x${info.height} ${info.videoCodec} ${rationalToNumber(info.fps).toFixed(3)} fps, ${info.duration.toFixed(1)}s`,
  );
  if (!info.hasAudio) throw new Error("Input has no audio stream");
  if (!isTargetAspect(info, video)) {
    ctx.log(`warning: input is not 9:16 (${info.width}x${info.height}); centre-cropping to ${video.width}x${video.height}`);
  }
  if (info.hdr) {
    ctx.log("warning: HDR input detected; it is converted without tone mapping, so colours may look washed out");
  }
  return buildNormalizeArgs({ input, output, fps: info.fps, video });
}

export const ingest: Stage<ReelcutContext> = {
  name: "ingest",
  inputs: async (ctx) => [ctx.paths.project, await sourceVideo(ctx)],
  outputs: async (ctx) => [ctx.paths.source, ctx.paths.audio],
  async run(ctx) {
    const input = await sourceVideo(ctx);
    const { face } = await readProject(ctx);
    const { ffmpeg } = ctx.config.paths;

    const sourceTemp = tempPathFor(ctx.paths.source);
    if (!face) ctx.log("voice only; drawing a plain picture under the audio");
    const args = face
      ? await normalizeArgs(ctx, input, sourceTemp)
      : buildVoiceOnlyArgs({ input, output: sourceTemp, video: ctx.config.video });
    await runCapture(ffmpeg, args);
    await commitTemp(sourceTemp, ctx.paths.source);

    const audioTemp = tempPathFor(ctx.paths.audio);
    await runCapture(ffmpeg, buildAudioExtractArgs(ctx.paths.source, audioTemp));
    await commitTemp(audioTemp, ctx.paths.audio);
  },
};
