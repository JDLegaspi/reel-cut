import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCapture } from "@reel/shared/media/ffmpeg.ts";
import { probe, rationalToNumber, type Rational } from "@reel/shared/media/probe.ts";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { commitTemp, tempPathFor, writeJsonAtomic } from "@reel/shared/util/fs.ts";
import { buildNormalizeArgs, buildVoiceOnlyArgs, isTargetAspect, VOICE_ONLY_FPS } from "../../media/ingestArgs.ts";
import { buildJoinArgs, concatList } from "../../media/parts.ts";
import type { Clips } from "../../schemas/cuts.ts";
import type { ReelcutContext } from "../context.ts";
import { readProject, sourceVideos } from "../project.ts";

async function normalizeArgs(ctx: ReelcutContext, input: string, output: string, fps: Rational | null): Promise<string[]> {
  const { video } = ctx.config;
  const info = await probe(ctx.config.paths.ffprobe, input);
  ctx.log(
    `input ${info.width}x${info.height} ${info.videoCodec} ${rationalToNumber(info.fps).toFixed(3)} fps, ${info.duration.toFixed(1)}s`,
  );
  if (!info.hasAudio) throw new Error(`Input has no audio stream: ${input}`);
  if (!isTargetAspect(info, video)) {
    ctx.log(`warning: input is not 9:16 (${info.width}x${info.height}); centre-cropping to ${video.width}x${video.height}`);
  }
  if (info.hdr) {
    ctx.log("warning: HDR input detected; it is converted without tone mapping, so colours may look washed out");
  }
  return buildNormalizeArgs({ input, output, fps: fps ?? info.fps, video });
}

export const ingest: Stage<ReelcutContext> = {
  name: "ingest",
  inputs: async (ctx) => [ctx.paths.project, ...(await sourceVideos(ctx))],
  outputs: async (ctx) => [ctx.paths.source, ctx.paths.clips],
  async run(ctx) {
    const inputs = await sourceVideos(ctx);
    const { face } = await readProject(ctx);
    const { ffmpeg, ffprobe } = ctx.config.paths;
    if (!face) ctx.log("voice only; drawing a plain picture under the audio");
    if (inputs.length > 1) ctx.log(`joining ${inputs.length} clips`);

    const partsDir = await mkdtemp(join(ctx.paths.dir, ".ingest-"));
    try {
      const fps = face ? (await probe(ffprobe, inputs[0]!)).fps : VOICE_ONLY_FPS;
      const parts: string[] = [];
      const clips: Clips["clips"] = [];
      for (const [k, input] of inputs.entries()) {
        const part = join(partsDir, `clip-${k + 1}.mov`);
        const args = face
          ? await normalizeArgs(ctx, input, part, fps)
          : buildVoiceOnlyArgs({ input, output: part, video: ctx.config.video });
        await runCapture(ffmpeg, args);
        const { duration } = await probe(ffprobe, part);
        const start = clips.at(-1)?.end ?? 0;
        clips.push({ path: input, start, end: Math.round((start + duration) * 1000) / 1000 });
        parts.push(part);
      }

      const list = join(partsDir, "clips.txt");
      await writeFile(list, concatList(parts));
      const temp = tempPathFor(ctx.paths.source);
      await runCapture(ffmpeg, buildJoinArgs({ list, output: temp, video: ctx.config.video }));
      await commitTemp(temp, ctx.paths.source);
      await writeJsonAtomic(ctx.paths.clips, { version: 1, clips } satisfies Clips);
    } finally {
      await rm(partsDir, { recursive: true, force: true });
    }
  },
};
