import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { transcribeVideo } from "@reel/shared/transcribe/transcribeVideo.ts";
import type { ReelcutContext } from "../context.ts";

export const transcribe: Stage<ReelcutContext> = {
  name: "transcribe",
  inputs: async (ctx) => [ctx.paths.source, ctx.paths.voice],
  outputs: async (ctx) => [ctx.paths.transcriptRaw, ctx.paths.transcript],
  async run(ctx) {
    await transcribeVideo({
      ffprobe: ctx.config.paths.ffprobe,
      video: ctx.paths.source,
      audio: ctx.paths.voice,
      transcriptRaw: ctx.paths.transcriptRaw,
      transcript: ctx.paths.transcript,
      transcriber: ctx.transcriber,
      log: ctx.log,
    });
  },
};
