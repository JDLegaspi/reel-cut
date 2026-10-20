import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type { ReelcutConfig } from "../../config/schema.ts";
import type { GatheredReference, References } from "../../schemas/references.ts";
import type { PageFacts } from "../pageFacts.ts";
import type { StylePaths } from "../paths.ts";
import { classifyReference, type Reference } from "../references.ts";
import type { Browser } from "puppeteer-core";
import { lazyBrowser, type LazyBrowser } from "./browser.ts";
import { gatherGithub } from "./github.ts";
import { normalizeImage } from "./images.ts";
import { gatherReel, gatherVideoFrames } from "./reel.ts";
import type { GatheredImage } from "./types.ts";
import { gatherWebsite, rasterizeSvg, type WebsiteResult } from "./website.ts";

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

type Gathered = { images: GatheredImage[]; facts: PageFacts | null };

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0]!.trim();
}

function githubHeaders(accept: string): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return { Accept: accept, "User-Agent": "reelcut", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

class Gatherer {
  constructor(
    private readonly paths: StylePaths,
    private readonly config: ReelcutConfig,
    private readonly browser: LazyBrowser,
  ) {}

  private get timeoutMs(): number {
    return this.config.styles.pageTimeoutSeconds * 1000;
  }

  private entry(output: string, caption: string): GatheredImage {
    return { file: relative(this.paths.dir, output), caption };
  }

  private async prepareImage(input: string, base: string, caption: string, svg: boolean, name = basename(input)): Promise<GatheredImage> {
    const outputBase = join(this.paths.referencesDir, base);
    if (!svg) return this.entry(await normalizeImage(this.config.paths, input, outputBase, name), caption);
    const raster = join(this.paths.referencesDir, `.${base}.raster.png`);
    try {
      await rasterizeSvg({ browser: await this.browser.get(), svg: await readFile(input), output: raster, timeoutSeconds: this.config.styles.pageTimeoutSeconds });
      return this.entry(await normalizeImage(this.config.paths, raster, outputBase), caption);
    } finally {
      await rm(raster, { force: true });
    }
  }

  async fetchImage(url: string, base: string, caption: string): Promise<GatheredImage> {
    const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs), headers: { "User-Agent": "reelcut" } });
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    const svg = type.includes("svg") || extname(new URL(url).pathname).toLowerCase() === ".svg";
    if (!svg && !type.startsWith("image/")) throw new Error(`${url} is not an image (${type || "no content type"})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error(`${url} is larger than 20 MB`);
    const original = join(this.paths.referencesDir, `.${base}${svg ? ".svg" : ".download"}`);
    await writeFile(original, bytes);
    try {
      return await this.prepareImage(original, base, caption, svg, url);
    } finally {
      await rm(original, { force: true });
    }
  }

  private website(url: string, prefix: string): Promise<WebsiteResult> {
    return this.browser.get().then((browser) =>
      gatherWebsite({ browser, url, dir: this.paths.referencesDir, prefix, timeoutSeconds: this.config.styles.pageTimeoutSeconds }),
    );
  }

  private async fetchGithub(url: string, accept: string): Promise<Response> {
    const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs), headers: githubHeaders(accept) });
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${url}`);
    return response;
  }

  async gather(reference: Reference, prefix: string, source: string): Promise<Gathered> {
    const tools = this.config.paths;
    const dir = this.paths.referencesDir;
    switch (reference.kind) {
      case "website":
        return this.website(reference.url, prefix);
      case "github": {
        let count = 0;
        return gatherGithub(reference, {
          fetchJson: async (url) => (await this.fetchGithub(url, "application/vnd.github+json")).json(),
          fetchText: async (url) => (await this.fetchGithub(url, "application/vnd.github.raw")).text(),
          gatherWebsite: (url) => this.website(url, `${prefix}-site`),
          gatherImage: (url, caption) => this.fetchImage(url, `${prefix}-image-${++count}`, caption).catch(() => null),
        });
      }
      case "reel": {
        const images = await gatherReel({
          url: reference.url,
          tools,
          cookiesFromBrowser: this.config.download.cookiesFromBrowser,
          dir,
          prefix,
          frames: this.config.styles.reelFrames,
        });
        return { images, facts: null };
      }
      case "image":
        return { images: [await this.fetchImage(reference.url, `${prefix}-image`, source)], facts: null };
      case "file-image": {
        const svg = extname(reference.path).toLowerCase() === ".svg";
        return { images: [await this.prepareImage(reference.path, `${prefix}-image`, basename(reference.path), svg)], facts: null };
      }
      case "file-video": {
        const images = await gatherVideoFrames({ tools, video: reference.path, dir, prefix, frames: this.config.styles.reelFrames, caption: basename(reference.path) });
        return { images, facts: null };
      }
    }
  }
}

export async function gatherAll(
  sources: string[],
  paths: StylePaths,
  config: ReelcutConfig,
  opts: { launch?: () => Promise<Browser> } = {},
): Promise<References> {
  await rm(paths.referencesDir, { recursive: true, force: true });
  await mkdir(paths.referencesDir, { recursive: true });
  const browser = lazyBrowser(opts.launch);
  const gatherer = new Gatherer(paths, config, browser);
  const references: GatheredReference[] = [];
  try {
    for (const [k, source] of sources.entries()) {
      const prefix = String(k + 1).padStart(2, "0");
      let kind: Reference["kind"] | null = null;
      try {
        const reference = classifyReference(source, existsSync);
        kind = reference.kind;
        const { images, facts } = await gatherer.gather(reference, prefix, source);
        references.push({ source, kind, images, facts, error: images.length > 0 ? null : "nothing usable was found there" });
      } catch (error) {
        references.push({ source, kind, images: [], facts: null, error: firstLine(error) });
      }
    }
  } finally {
    await browser.close();
  }
  if (!references.some((reference) => reference.images.length > 0)) {
    throw new Error(`None of the references could be used:\n${references.map((reference) => `- ${reference.source}: ${reference.error}`).join("\n")}`);
  }
  return { version: 1, references };
}
