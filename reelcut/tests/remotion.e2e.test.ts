import { execFileSync } from "node:child_process";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probe } from "@reel/shared/media/probe.ts";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { describe, expect, test } from "vitest";
import { PREVIEW_ID, type PreviewProps, type RenderProps } from "../remotion/props.ts";
import { TEMPLATES } from "../remotion/templates/registry.ts";
import { loadConfig } from "../src/config/load.ts";
import { createRemotionRenderer, REMOTION_ENTRY } from "../src/render/remotion.ts";

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
      emphasis: [],
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

  test("renders every template's example in both layouts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reelcut-templates-"));
    const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY });
    for (const template of TEMPLATES) {
      for (const layout of ["split", "full"] as const) {
        const inputProps: PreviewProps = { layout, template: template.name, props: template.example as Record<string, unknown>, at: {} };
        const composition = await selectComposition({ serveUrl, id: PREVIEW_ID, inputProps });
        const output = join(dir, `${template.name}-${layout}.png`);
        await renderStill({ composition, serveUrl, output, inputProps, frame: 60 });
        expect((await stat(output)).size, `${template.name} ${layout}`).toBeGreaterThan(20_000);
      }
    }
  }, 600_000);
});
