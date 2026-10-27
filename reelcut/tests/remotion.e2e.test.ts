import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probe } from "@reel/shared/media/probe.ts";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { describe, expect, test } from "vitest";
import { PREVIEW_ID, SHEET_ID, type PreviewProps, type RenderProps, type SheetProps } from "../remotion/props.ts";
import { TEMPLATES } from "../remotion/templates/registry.ts";
import { loadConfig } from "../src/config/load.ts";
import { createRemotionRenderer, REMOTION_ENTRY } from "../src/render/remotion.ts";
import type { Style } from "../src/schemas/style.ts";
import { DEFAULT_STYLE } from "../src/style/default.ts";
import { resolveFontFiles } from "../src/style/fonts.ts";
import { LIGHT_STYLE, TEST_STYLES } from "./fixtures/styles.ts";

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function meanLuma(video: string, seconds: number): number {
  const pixel = execFileSync("ffmpeg", [
    "-loglevel", "error",
    "-ss", String(seconds), "-i", video,
    "-frames:v", "1", "-vf", "scale=1:1:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ]);
  return pixel[0]!;
}

function pixelAt(image: string, x: number, y: number): number[] {
  return [...execFileSync("ffmpeg", ["-loglevel", "error", "-i", image, "-vf", `crop=1:1:${x}:${y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])];
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
}

async function previewProps(style: Style, template: string, layout: "split" | "full", props: unknown): Promise<PreviewProps> {
  return { layout, template, props: props as Record<string, unknown>, at: {}, style, fonts: await resolveFontFiles(style) };
}

describe.skipIf(!hasFfmpeg())("remotion renderer", () => {
  test("plays the source and covers the planned frames with a placeholder", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reelcut-remotion-"));
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=white:size=1080x1920:rate=25:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(dir, "source.mp4"),
    ]);
    const props: RenderProps = {
      video: "source.mp4",
      width: 1080,
      height: 1920,
      fps: 25,
      durationInFrames: 50,
      speakerCrop: { x: 0, y: 0, width: 1080, height: 1920 },
      style: DEFAULT_STYLE,
      fonts: [],
      emphasis: [],
      face: true,
      phrases: [],
      captions: [],
      brands: [],
      segments: [
        { kind: "placeholder", id: "seg-01", from: 25, durationInFrames: 25, description: "Countdown card", spoken: "hello world" },
      ],
    };
    const output = join(dir, "out.mp4");

    await createRemotionRenderer().render({ props, publicDir: dir, output, video: loadConfig().video, log: () => {} });

    const info = await probe("ffprobe", output);
    expect(info).toMatchObject({ width: 1080, height: 1920, hasAudio: true, videoCodec: "h264" });
    expect(info.duration).toBeCloseTo(2, 1);
    expect(meanLuma(output, 0.5)).toBeGreaterThan(200);
    expect(meanLuma(output, 1.5)).toBeLessThan(60);
  }, 300_000);

  test("draws the speaker in a rounded card under split visuals and the spoken word as a caption", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reelcut-card-"));
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=white:size=1080x1920:rate=25:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(dir, "source.mp4"),
    ]);
    const style: Style = { ...LIGHT_STYLE, palette: { ...LIGHT_STYLE.palette, backdrop: ["#000000", "#000000"] }, backdrop: { kind: "flat", drift: false }, layout: { speaker: "card", captions: "word" } };
    const countdown = TEMPLATES.find((template) => template.name === "Countdown")!;
    const props: RenderProps = {
      video: "source.mp4",
      width: 1080,
      height: 1920,
      fps: 25,
      durationInFrames: 50,
      speakerCrop: { x: 0, y: 0, width: 1080, height: 1920 },
      style,
      fonts: await resolveFontFiles(style),
      emphasis: [],
      face: true,
      phrases: [],
      captions: [{ from: 0, durationInFrames: 50, text: "modern", accent: true }],
      brands: [],
      segments: [
        { kind: "visual", id: "seg-01", layout: "split", from: 0, durationInFrames: 50, template: "Countdown", props: countdown.example as Record<string, unknown>, at: {} },
      ],
    };
    const output = join(dir, "out.mp4");
    await createRemotionRenderer().render({ props, publicDir: dir, output, video: loadConfig().video, log: () => {} });
    const still = join(dir, "frame.png");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "1", "-i", output, "-frames:v", "1", still]);

    expect(pixelAt(still, 540, 1500).every((channel) => channel > 200)).toBe(true);
    expect(pixelAt(still, 10, 1500).every((channel) => channel < 40)).toBe(true);
    expect(pixelAt(still, 50, 1125).every((channel) => channel < 40)).toBe(true);
    const red = rgb(style.palette.accent);
    const centre = pixelAt(still, 540, 1040);
    const left = [...Array(60).keys()].map((k) => pixelAt(still, 380 + k * 5, 1040));
    expect([centre, ...left].some((pixel) => pixel.every((channel, c) => Math.abs(channel - red[c]!) < 40))).toBe(true);
  }, 300_000);

  test("shows a company's website screenshot from the project folder", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reelcut-site-"));
    await mkdir(join(dir, "brands"));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x00ff00:size=960x600", "-frames:v", "1", join(dir, "brands", "acme.png")]);
    const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, publicDir: dir });
    const inputProps: PreviewProps = {
      ...(await previewProps(LIGHT_STYLE, "Website", "full", { brand: "Acme", caption: null })),
      brands: [{ name: "Acme", url: "acme.com", logo: null, site: "brands/acme.png" }],
    };
    const composition = await selectComposition({ serveUrl, id: PREVIEW_ID, inputProps });
    const output = join(dir, "site.png");
    await renderStill({ composition, serveUrl, output, inputProps, frame: 40 });
    const [r, g, b] = pixelAt(output, 540, 900);
    expect(g).toBeGreaterThan(200);
    expect(r! + b!).toBeLessThan(120);
  }, 300_000);

  test("voice-only: draws the backdrop and the spoken phrase instead of the plain source picture", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reelcut-voice-"));
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=black:size=1080x1920:rate=25:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(dir, "source.mp4"),
    ]);
    const props: RenderProps = {
      video: "source.mp4",
      width: 1080,
      height: 1920,
      fps: 25,
      durationInFrames: 50,
      speakerCrop: { x: 0, y: 0, width: 1080, height: 1920 },
      style: LIGHT_STYLE,
      fonts: await resolveFontFiles(LIGHT_STYLE),
      emphasis: [],
      face: false,
      phrases: [{ from: 0, durationInFrames: 50, words: [{ text: "hello", from: 0, accent: false }, { text: "world", from: 10, accent: true }] }],
      captions: [],
      brands: [],
      segments: [],
    };
    const output = join(dir, "out.mp4");

    await createRemotionRenderer().render({ props, publicDir: dir, output, video: loadConfig().video, log: () => {} });

    expect(meanLuma(output, 1.0)).toBeGreaterThan(150);
    expect((await probe("ffprobe", output)).hasAudio).toBe(true);
  }, 300_000);

  test("renders every template's example in both layouts, in two different styles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reelcut-templates-"));
    const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY });
    for (const [name, style] of TEST_STYLES) {
      for (const template of TEMPLATES) {
        for (const layout of ["split", "full"] as const) {
          const inputProps = await previewProps(style, template.name, layout, template.example);
          const composition = await selectComposition({ serveUrl, id: PREVIEW_ID, inputProps });
          const output = join(dir, `${name}-${template.name}-${layout}.png`);
          await renderStill({ composition, serveUrl, output, inputProps, frame: 60 });
          expect((await stat(output)).size, `${name} ${template.name} ${layout}`).toBeGreaterThan(20_000);
        }
      }
    }
  }, 900_000);

  test("draws the backdrop in the style's colours", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reelcut-backdrop-"));
    const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY });
    const corners: Record<string, number[]> = {};
    for (const [name, style] of TEST_STYLES) {
      const inputProps = await previewProps(style, "Stat", "split", TEMPLATES[0]!.example);
      const composition = await selectComposition({ serveUrl, id: PREVIEW_ID, inputProps });
      const output = join(dir, `${name}.png`);
      await renderStill({ composition, serveUrl, output, inputProps, frame: 30 });
      corners[name] = pixelAt(output, 20, 20);
    }
    const [r, g, b] = corners.default!;
    expect(b).toBeGreaterThan(r! + 60);
    expect(b).toBeGreaterThan(g! + 60);
    corners.light!.forEach((channel, k) => expect(Math.abs(channel - rgb(LIGHT_STYLE.palette.backdrop[0])[k]!)).toBeLessThanOrEqual(12));
  }, 300_000);

  test("renders the style sheet", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reelcut-sheet-"));
    const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY });
    const inputProps: SheetProps = { style: LIGHT_STYLE, fonts: await resolveFontFiles(LIGHT_STYLE) };
    const composition = await selectComposition({ serveUrl, id: SHEET_ID, inputProps });
    const output = join(dir, "sheet.png");
    await renderStill({ composition, serveUrl, output, inputProps, frame: 90 });
    expect(await probe("ffprobe", output)).toMatchObject({ width: 1620, height: 1920 });
  }, 300_000);
});
