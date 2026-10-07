import { probe } from "../../media/probe.ts";
import { writeJsonAtomic } from "../../util/fs.ts";
import type { Stage } from "../stage.ts";

export const transcribe: Stage = {
  name: "transcribe",
  inputs: async (ctx) => [ctx.paths.audio],
  outputs: (ctx) => [ctx.paths.transcriptRaw, ctx.paths.transcript],
  async run(ctx) {
    const { duration } = await probe(ctx.config.paths.ffprobe, ctx.paths.source);
    const { raw, transcript } = await ctx.transcriber().transcribe(ctx.paths.audio, { duration });
    await writeJsonAtomic(ctx.paths.transcriptRaw, raw);
    await writeJsonAtomic(ctx.paths.transcript, transcript);
    ctx.log(`${transcript.words.length} words, language ${transcript.language ?? "unknown"}`);
  },
};
