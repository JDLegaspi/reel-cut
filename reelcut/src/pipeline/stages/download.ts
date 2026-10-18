import { downloadVideo } from "@reel/shared/download/ytdlp.ts";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import type { ReelcutContext } from "../context.ts";
import { readProject } from "../project.ts";

export const download: Stage<ReelcutContext> = {
  name: "download",
  inputs: async (ctx) => [ctx.paths.project],
  async outputs(ctx) {
    const { source } = await readProject(ctx);
    return source.kind === "url" ? [ctx.paths.original, ctx.paths.infoRaw] : [];
  },
  async run(ctx) {
    const { source } = await readProject(ctx);
    if (source.kind === "file") {
      ctx.log("local file; nothing to download");
      return;
    }
    ctx.log(`downloading ${source.url}`);
    await downloadVideo({
      url: source.url,
      videoOut: ctx.paths.original,
      infoOut: ctx.paths.infoRaw,
      tools: ctx.config.paths,
      cookiesFromBrowser: ctx.config.download.cookiesFromBrowser,
    });
  },
};
