import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { COMPOSITION_ID, SHEET_ID, type RenderProps, type SheetProps } from "../../remotion/props.ts";
import { packageRoot } from "../packageRoot.ts";
import { resolveFontFiles } from "../style/fonts.ts";
import type { Renderer, SheetRenderer } from "./Renderer.ts";

export const REMOTION_ENTRY = join(packageRoot(import.meta.url), "remotion", "index.ts");

export function createRemotionRenderer(): Renderer {
  return {
    async render({ props, publicDir, output, video, log }) {
      log("bundling compositions");
      const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, publicDir, symlinkPublicDir: true });
      try {
        const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: props });
        let reported = -1;
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          outputLocation: output,
          inputProps: props,
          crf: video.crf,
          x264Preset: video.preset,
          audioBitrate: video.audioBitrate,
          onProgress: ({ progress }) => {
            const percent = Math.floor(progress * 10) * 10;
            if (percent > reported) {
              reported = percent;
              log(`rendering ${percent}%`);
            }
          },
        });
      } finally {
        await rm(serveUrl, { recursive: true, force: true });
      }
    },
  };
}

export function createRemotionSheetRenderer(): SheetRenderer {
  return {
    async render(style, output) {
      const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY });
      try {
        const inputProps: SheetProps = { style, fonts: await resolveFontFiles(style) };
        const composition = await selectComposition({ serveUrl, id: SHEET_ID, inputProps });
        await renderStill({ composition, serveUrl, output, inputProps, frame: 90, imageFormat: "png" });
      } finally {
        await rm(serveUrl, { recursive: true, force: true });
      }
    },
  };
}

export function openStudio(opts: { props: RenderProps; publicDir: string }): Promise<void> {
  const cliDir = dirname(createRequire(import.meta.url).resolve("@remotion/cli/package.json"));
  const args = [
    join(cliDir, "remotion-cli.js"),
    "studio",
    REMOTION_ENTRY,
    "--public-dir",
    opts.publicDir,
    "--props",
    JSON.stringify(opts.props),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`remotion studio exited with code ${code}`))));
  });
}
