import { probe } from "../../media/probe.ts";
import type { Transcript } from "../../schemas/transcript.ts";
import { writeJsonAtomic } from "../../util/fs.ts";
import type { Stage } from "../stage.ts";

export const transcribe: Stage = {
  name: "transcribe",
  inputs: async (ctx) => [ctx.paths.audio],
  outputs: (ctx) => [ctx.paths.transcriptRaw, ctx.paths.transcript],
  async run(ctx) {
    const { duration, hasAudio } = await probe(ctx.config.paths.ffprobe, ctx.paths.video);
    if (!hasAudio) {
      const empty: Transcript = { version: 1, provider: "none", language: null, duration, words: [] };
      await writeJsonAtomic(ctx.paths.transcriptRaw, { skipped: "no audio stream" });
      await writeJsonAtomic(ctx.paths.transcript, empty);
      ctx.log("no audio stream; wrote an empty transcript");
      return;
    }
    const { raw, transcript } = await ctx.transcriber().transcribe(ctx.paths.audio, { duration });
    await writeJsonAtomic(ctx.paths.transcriptRaw, raw);
    await writeJsonAtomic(ctx.paths.transcript, transcript);
    ctx.log(`${transcript.words.length} words, language ${transcript.language ?? "unknown"}`);
  },
};
