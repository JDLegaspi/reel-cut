import { rm } from "node:fs/promises";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { TranscriptSchema } from "@reel/shared/schemas/transcript.ts";
import { readJson, writeJsonAtomic } from "@reel/shared/util/fs.ts";
import { bulleted } from "../../plan/rules.ts";
import type { RetakeOutput } from "../../retakes/RetakeFinder.ts";
import { keepProblems } from "../../retakes/rules.ts";
import { ClipsSchema, type Cuts } from "../../schemas/cuts.ts";
import type { ReelcutContext } from "../context.ts";
import { readProject } from "../project.ts";

export const retakes: Stage<ReelcutContext> = {
  name: "retakes",
  inputs: async (ctx) => [ctx.paths.project, ctx.paths.clips, ctx.paths.transcript],
  outputs: async (ctx) => [ctx.paths.cutsRaw, ctx.paths.cuts],
  async run(ctx) {
    const { words } = await readJson(ctx.paths.transcript, TranscriptSchema);
    const clips = (await readJson(ctx.paths.clips, ClipsSchema)).clips.map(({ start, end }) => ({ start, end }));
    const { retakeWord, aggressive } = await readProject(ctx);
    const attempts: unknown[] = [];
    let output: RetakeOutput = { keep: [], removed: [] };

    if (words.length > 0) {
      const finder = ctx.retakeFinder();
      const first = await finder.find({ words, clips, retakeWord, aggressive });
      attempts.push(first.raw);
      output = { keep: first.keep, removed: first.removed };
      let problems = keepProblems(output.keep, words.length);
      if (problems.length > 0) {
        ctx.log(`${problems.length} problem(s) with the kept ranges; asking again`);
        const second = await finder.find({ words, clips, retakeWord, aggressive, retry: { previous: output, errors: problems } });
        attempts.push(second.raw);
        output = { keep: second.keep, removed: second.removed };
        problems = keepProblems(output.keep, words.length);
      }
      await writeJsonAtomic(ctx.paths.cutsRaw, attempts);
      if (problems.length > 0) {
        await rm(ctx.paths.cuts, { force: true });
        throw new Error(`The kept ranges still have these problems after a retry:\n${bulleted(problems)}`);
      }
    } else {
      await writeJsonAtomic(ctx.paths.cutsRaw, attempts);
    }

    const removed = [...output.removed].sort((a, b) => a.fromWord - b.fromWord);
    const cuts: Cuts = { version: 1, retakeWord, aggressive, keep: output.keep, removed };
    await writeJsonAtomic(ctx.paths.cuts, cuts);
    const kept = output.keep.reduce((total, range) => total + range.toWord - range.fromWord + 1, 0);
    const reordered = output.keep.some((range, k) => k > 0 && range.fromWord < output.keep[k - 1]!.fromWord);
    ctx.log(`keeping ${kept} of ${words.length} words in ${output.keep.length} range(s)${reordered ? ", reordered across clips" : ""}`);
  },
};
