import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { z } from "zod";
import type { Tools } from "../config/schema.ts";
import { runCapture } from "../media/ffmpeg.ts";
import { writeJsonAtomic } from "../util/fs.ts";
import type { ReelMeta, ReelSource } from "../schemas/source.ts";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const INSTAGRAM = /instagram\.com\/(?:[^/?#]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/;

export function sourceFor(input: string): ReelSource {
  return /^https?:\/\//i.test(input) ? { kind: "url", url: input } : { kind: "file", path: input };
}

export function reelIdFor(source: ReelSource): string {
  if (source.kind === "file") return `file-${slugify(basename(source.path, extname(source.path)))}`;
  const instagram = INSTAGRAM.exec(source.url);
  if (instagram) return `ig-${instagram[1]}`;
  return slugify(source.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/[?#].*$/, "")).slice(0, 80);
}

export function buildYtDlpArgs(opts: {
  url: string;
  outputTemplate: string;
  ffmpeg: string;
  cookiesFromBrowser: string | null;
}): string[] {
  return [
    "--no-playlist",
    "--no-progress",
    "--quiet",
    "--no-warnings",
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "--remux-video",
    "mp4",
    "--write-info-json",
    ...(opts.ffmpeg.includes("/") ? ["--ffmpeg-location", opts.ffmpeg] : []),
    ...(opts.cookiesFromBrowser ? ["--cookies-from-browser", opts.cookiesFromBrowser] : []),
    "-o",
    opts.outputTemplate,
    opts.url,
  ];
}

const InfoSchema = z.object({
  webpage_url: z.string().optional(),
  uploader: z.string().nullish(),
  uploader_id: z.string().nullish(),
  channel: z.string().nullish(),
  description: z.string().nullish(),
  title: z.string().nullish(),
  timestamp: z.number().nullish(),
  upload_date: z.string().nullish(),
  duration: z.number().nullish(),
  view_count: z.number().nullish(),
  like_count: z.number().nullish(),
});

function postedAt(info: z.infer<typeof InfoSchema>): string | null {
  if (info.timestamp) return new Date(info.timestamp * 1000).toISOString();
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(info.upload_date ?? "");
  return date ? `${date[1]}-${date[2]}-${date[3]}T00:00:00.000Z` : null;
}

/** Normalises yt-dlp's info.json. `duration` is the probed duration, which beats the site's rounded value. */
export function metaFromInfo(id: string, url: string, raw: unknown, duration: number): ReelMeta {
  const info = InfoSchema.parse(raw);
  return {
    version: 1,
    id,
    url: info.webpage_url ?? url,
    author: info.channel ?? info.uploader_id ?? info.uploader ?? null,
    caption: info.description || info.title || null,
    postedAt: postedAt(info),
    duration,
    views: info.view_count ?? null,
    likes: info.like_count ?? null,
  };
}

export async function downloadVideo(opts: {
  url: string;
  videoOut: string;
  infoOut: string;
  tools: Tools;
  cookiesFromBrowser: string | null;
}): Promise<unknown> {
  const tempDir = join(dirname(opts.videoOut), ".download");
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir);
  try {
    await runCapture(
      opts.tools.ytDlp,
      buildYtDlpArgs({
        url: opts.url,
        outputTemplate: join(tempDir, "video.%(ext)s"),
        ffmpeg: opts.tools.ffmpeg,
        cookiesFromBrowser: opts.cookiesFromBrowser,
      }),
    );
    const info: unknown = JSON.parse(await readFile(join(tempDir, "video.info.json"), "utf8"));
    await writeJsonAtomic(opts.infoOut, info);
    await rename(join(tempDir, "video.mp4"), opts.videoOut);
    return info;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
