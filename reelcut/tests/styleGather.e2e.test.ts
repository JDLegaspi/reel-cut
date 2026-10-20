import { execFileSync } from "node:child_process";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import type { PageFacts } from "../src/style/pageFacts.ts";
import { gatherGithub } from "../src/style/gather/github.ts";
import { gatherAll } from "../src/style/gather/index.ts";
import { stylePaths } from "../src/style/paths.ts";

const BRAND = join(import.meta.dirname, "fixtures/brand.html");

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function maxAlpha(image: string): number {
  const alpha = execFileSync("ffmpeg", ["-loglevel", "error", "-i", image, "-vf", "format=rgba,alphaextract,scale=64:64", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  return Math.max(...alpha);
}

function pixelFormat(image: string): string {
  return execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=pix_fmt", "-of", "csv=p=0", image]).toString().trim();
}

describe("gatherGithub", () => {
  test("uses a repo's homepage and README images, not GitHub's own page", async () => {
    const facts: PageFacts = { colors: [], variables: { "--brand": "#0b84f3" }, fonts: { body: "Inter", headings: null, buttons: null } };
    const fetched: string[] = [];
    const visited: string[] = [];
    const result = await gatherGithub(
      { kind: "github", owner: "remotion-dev", repo: "remotion" },
      {
        fetchJson: async () => ({ homepage: "https://www.remotion.dev", owner: { avatar_url: "https://avatars.example/remotion.png" } }),
        fetchText: async () => "[![npm](https://img.shields.io/npm/v/remotion.svg)](https://npm.im)\n<img src=\"packages/docs/static/img/logo.png\">",
        gatherWebsite: async (url) => {
          visited.push(url);
          return { images: [{ file: "references/01-desktop-top.jpg", caption: "remotion.dev, desktop, top" }], facts };
        },
        gatherImage: async (url, caption) => {
          fetched.push(url);
          return { file: `references/${fetched.length}.png`, caption };
        },
      },
    );
    expect(visited).toEqual(["https://www.remotion.dev"]);
    expect(fetched).toEqual([
      "https://raw.githubusercontent.com/remotion-dev/remotion/HEAD/packages/docs/static/img/logo.png",
      "https://avatars.example/remotion.png",
    ]);
    expect(result.facts).toEqual(facts);
    expect(result.images).toHaveLength(3);
  });
});

describe.skipIf(!hasFfmpeg())("gathering references", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "reelcut-gather-"));
  });

  test("reads a page's real colours and fonts and takes three screenshots", async () => {
    const paths = stylePaths(root, "page");
    const { references } = await gatherAll([BRAND], paths, loadConfig());
    const [page] = references;
    expect(page!.error).toBeNull();
    expect(page!.kind).toBe("website");
    expect(page!.facts!.variables).toMatchObject({ "--brand": "#635bff", "--ink": "#0a2540" });
    expect(page!.facts!.colors.filter((color) => color.use === "background").map((color) => color.hex)).toEqual(
      expect.arrayContaining(["#ffffff", "#0a2540", "#635bff"]),
    );
    expect(page!.facts!.fonts).toEqual({ body: "Space Mono", headings: "Fraunces", buttons: "Inter" });
    expect(page!.images).toHaveLength(3);
    for (const image of page!.images) expect((await stat(join(paths.dir, image.file))).size).toBeGreaterThan(5_000);
  }, 120_000);

  test("keeps a logo's transparency and rasterises SVGs", async () => {
    const logo = join(root, "logo.png");
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=white@0.0:s=400x400,format=rgba",
      "-vf", "drawbox=x=100:y=100:w=200:h=200:color=white@1:t=fill",
      "-frames:v", "1", logo,
    ]);
    const svg = join(root, "mark.svg");
    await writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="80" fill="#635bff"/></svg>');
    const paths = stylePaths(root, "logos");
    const { references } = await gatherAll([logo, svg], paths, loadConfig());
    const [png, vector] = references.map((reference) => join(paths.dir, reference.images[0]!.file));
    expect(png!.endsWith(".png")).toBe(true);
    expect(pixelFormat(png!)).toBe("rgba");
    expect(vector!.endsWith(".png")).toBe(true);
    expect((await stat(vector!)).size).toBeGreaterThan(500);
  }, 120_000);

  test("never shows other files inside an SVG", async () => {
    const secret = join(root, "secret.txt");
    await writeFile(secret, "ANTHROPIC_API_KEY=sk-not-a-real-key ".repeat(40));
    const svg = join(root, "sneaky.svg");
    await writeFile(
      svg,
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><foreignObject width="600" height="600"><iframe xmlns="http://www.w3.org/1999/xhtml" src="${secret}" width="600" height="600" style="border:0"></iframe></foreignObject></svg>`,
    );
    const paths = stylePaths(root, "sneaky");
    const { references } = await gatherAll([svg, BRAND], paths, loadConfig());
    const image = references[0]!.images[0];
    expect(image).toBeDefined();
    expect(maxAlpha(join(paths.dir, image!.file))).toBe(0);
  }, 120_000);

  test("only decodes real images, so a disguised playlist can't make ffmpeg read local files", async () => {
    const disguised = join(root, "playlist.png");
    await writeFile(disguised, "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1.0,\nfile:///etc/hosts\n#EXT-X-ENDLIST\n");
    const paths = stylePaths(root, "disguised");
    const { references } = await gatherAll([disguised, BRAND], paths, loadConfig());
    expect(references[0]!.images).toEqual([]);
    expect(references[0]!.error).toBe("playlist.png is not a PNG, JPEG, GIF or WebP image");
  }, 120_000);

  test("keeps the references that don't need a browser when headless Chrome won't start", async () => {
    const logo = join(root, "plain.png");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=orange:s=200x200", "-frames:v", "1", logo]);
    const launch = async (): Promise<never> => {
      throw new Error("Chrome could not start");
    };
    const { references } = await gatherAll([logo, BRAND], stylePaths(root, "no-chrome"), loadConfig(), { launch });
    expect(references[0]!.images).toHaveLength(1);
    expect(references[1]).toMatchObject({ images: [], error: "Chrome could not start" });
  }, 120_000);

  test("carries on when one reference fails, and names every failure when all do", async () => {
    const paths = stylePaths(root, "mixed");
    const { references } = await gatherAll(["https://127.0.0.1:9/nothing", BRAND], paths, loadConfig());
    expect(references[0]!.error).toMatch(/\S/);
    expect(references[0]!.images).toEqual([]);
    expect(references[1]!.images).toHaveLength(3);

    await expect(gatherAll(["https://127.0.0.1:9/nothing", "no-such-logo.png"], stylePaths(root, "broken"), loadConfig())).rejects.toThrow(
      /None of the references could be used:\n- https:\/\/127\.0\.0\.1:9\/nothing: .+\n- no-such-logo\.png: "no-such-logo\.png" is not a URL and there is no such file/,
    );
  }, 120_000);
});
