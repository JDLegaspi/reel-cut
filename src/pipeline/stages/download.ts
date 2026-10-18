import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildYtDlpArgs, metaFromInfo } from "../../download/ytdlp.ts";
import { runCapture } from "../../media/ffmpeg.ts";
import { buildRemuxArgs } from "../../media/ffmpegArgs.ts";
import { probe } from "../../media/probe.ts";
import type { ReelMeta } from "../../schemas/reel.ts";
import { commitTemp, tempPathFor, writeJsonAtomic } from "../../util/fs.ts";
import { readReel } from "../reel.ts";
import type { Stage } from "../stage.ts";

export const download: Stage = {
  name: "download",
  inputs: async (ctx) => [ctx.paths.reel],
  outputs: (ctx) => [ctx.paths.video, ctx.paths.meta],
  async run(ctx) {
    const { id, source } = await readReel(ctx);
    const { ffmpeg, ffprobe, ytDlp } = ctx.config.paths;
    let meta: ReelMeta;

    if (source.kind === "url") {
      const tempDir = join(ctx.paths.dir, ".download");
      await rm(tempDir, { recursive: true, force: true });
      await mkdir(tempDir);
      try {
        ctx.log(`downloading ${source.url}`);
        await runCapture(
          ytDlp,
          buildYtDlpArgs({
            url: source.url,
            outputTemplate: join(tempDir, "video.%(ext)s"),
            ffmpeg,
            cookiesFromBrowser: ctx.config.download.cookiesFromBrowser,
          }),
        );
        const video = join(tempDir, "video.mp4");
        const info = JSON.parse(await readFile(join(tempDir, "video.info.json"), "utf8"));
        const { duration } = await probe(ffprobe, video);
        meta = metaFromInfo(id, source.url, info, duration);
        await writeJsonAtomic(ctx.paths.infoRaw, info);
        await rename(video, ctx.paths.video);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    } else {
      const temp = tempPathFor(ctx.paths.video);
      await runCapture(ffmpeg, buildRemuxArgs(source.path, temp));
      await commitTemp(temp, ctx.paths.video);
      const { duration } = await probe(ffprobe, ctx.paths.video);
      meta = { version: 1, id, url: null, author: null, caption: null, postedAt: null, duration, views: null, likes: null };
    }

    await writeJsonAtomic(ctx.paths.meta, meta);
    ctx.log(`${meta.duration.toFixed(1)}s${meta.author ? ` by @${meta.author}` : ""}`);
  },
};
