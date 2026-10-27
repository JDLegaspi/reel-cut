import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCapture, runWithOutput } from "@reel/shared/media/ffmpeg.ts";
import { probe, rationalToNumber } from "@reel/shared/media/probe.ts";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { TranscriptSchema } from "@reel/shared/schemas/transcript.ts";
import { commitTemp, readJson, tempPathFor, writeJsonAtomic } from "@reel/shared/util/fs.ts";
import { keepFromRemoved, planCut } from "../../cut/segments.ts";
import { buildPartArgs, loudnessFilter, parseLoudness } from "../../media/cutArgs.ts";
import { buildJoinArgs, buildMeasureArgs, concatList } from "../../media/parts.ts";
import { bulleted } from "../../plan/rules.ts";
import { keepProblems } from "../../retakes/rules.ts";
import { CutsSchema, ClipsSchema, type CutTranscript } from "../../schemas/cuts.ts";
import type { ReelcutContext } from "../context.ts";

const PARALLEL_PARTS = 4;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

async function inParallel<T>(items: T[], limit: number, work: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      await work(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export const cut: Stage<ReelcutContext> = {
  name: "cut",
  inputs: async (ctx) => [ctx.paths.source, ctx.paths.clips, ctx.paths.voice, ctx.paths.transcript, ctx.paths.cuts],
  outputs: async (ctx) => [ctx.paths.cut, ctx.paths.cutTranscript],
  async run(ctx) {
    const transcript = await readJson(ctx.paths.transcript, TranscriptSchema);
    const cuts = await readJson(ctx.paths.cuts, CutsSchema);
    const keep = cuts.keep ?? keepFromRemoved(transcript.words.length, cuts.removed);
    const problems = keepProblems(keep, transcript.words.length);
    if (problems.length > 0) throw new Error(`cuts.json breaks these rules:\n${bulleted(problems)}`);

    const { clips } = await readJson(ctx.paths.clips, ClipsSchema);
    const info = await probe(ctx.config.paths.ffprobe, ctx.paths.source);
    const fps = rationalToNumber(info.fps);
    const { fadeMs, ...settings } = ctx.config.cut;
    const plan = planCut({ words: transcript.words, keep, duration: info.duration, fps, settings, clips });
    const { ffmpeg } = ctx.config.paths;

    const partsDir = await mkdtemp(join(ctx.paths.dir, ".cut-"));
    try {
      const parts = plan.segments.map((_, k) => join(partsDir, `part-${String(k).padStart(5, "0")}.mov`));
      await inParallel(plan.segments, PARALLEL_PARTS, async (segment, k) => {
        const args = buildPartArgs({
          video: ctx.paths.source,
          audio: ctx.paths.voice,
          output: parts[k]!,
          fps: info.fps,
          segment,
          fadeSeconds: fadeMs / 1000,
          settings: ctx.config.video,
        });
        await runCapture(ffmpeg, args);
      });

      const list = join(partsDir, "parts.txt");
      await writeFile(list, concatList(parts));
      const { loudness } = ctx.config.audio;
      const measured = parseLoudness((await runWithOutput(ffmpeg, buildMeasureArgs({ list, loudness }))).stderr);
      ctx.log(`voice is ${measured.input_i} LUFS; bringing it to ${loudness}`);

      const temp = tempPathFor(ctx.paths.cut);
      const audioFilter = `${loudnessFilter(loudness, measured)},aresample=${ctx.config.video.audioSampleRate}`;
      await runCapture(ffmpeg, buildJoinArgs({ list, output: temp, video: ctx.config.video, audioFilter }));
      await commitTemp(temp, ctx.paths.cut);
    } finally {
      await rm(partsDir, { recursive: true, force: true });
    }

    const cutTranscript: CutTranscript = { ...transcript, duration: plan.duration, fps, segments: plan.segments, words: plan.words };
    await writeJsonAtomic(ctx.paths.cutTranscript, cutTranscript);
    ctx.log(`kept ${clock(plan.duration)} of ${clock(info.duration)} in ${plan.segments.length} pieces`);
  },
};
