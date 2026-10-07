import { buildAudioExtractArgs, buildNormalizeArgs, isTargetAspect } from "../../media/ingestArgs.ts";
import { runCapture } from "../../media/ffmpeg.ts";
import { probe, rationalToNumber } from "../../media/probe.ts";
import { commitTemp, tempPathFor } from "../../util/fs.ts";
import { readProject } from "../project.ts";
import type { Stage } from "../stage.ts";

export const ingest: Stage = {
  name: "ingest",
  async inputs(ctx) {
    return [(await readProject(ctx)).input];
  },
  outputs: (ctx) => [ctx.paths.source, ctx.paths.audio],
  async run(ctx) {
    const { input } = await readProject(ctx);
    const { ffmpeg, ffprobe } = ctx.config.paths;
    const { video } = ctx.config;

    const info = await probe(ffprobe, input);
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

    const sourceTemp = tempPathFor(ctx.paths.source);
    await runCapture(ffmpeg, buildNormalizeArgs({ input, output: sourceTemp, fps: info.fps, video }));
    await commitTemp(sourceTemp, ctx.paths.source);

    const audioTemp = tempPathFor(ctx.paths.audio);
    await runCapture(ffmpeg, buildAudioExtractArgs(ctx.paths.source, audioTemp));
    await commitTemp(audioTemp, ctx.paths.audio);
  },
};
