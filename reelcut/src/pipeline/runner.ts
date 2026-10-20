import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPipeline } from "@reel/shared/pipeline/runner.ts";
import type { ReelSource } from "@reel/shared/schemas/source.ts";
import type { Rect } from "../../remotion/framing.ts";
import { writeJsonAtomic } from "@reel/shared/util/fs.ts";
import type { Project, Speaker } from "../schemas/project.ts";
import type { ProjectStyle } from "../schemas/style.ts";
import type { ReelcutContext } from "./context.ts";
import { readSpeaker } from "./project.ts";
import { readProjectStyle } from "./style.ts";
import { download } from "./stages/download.ts";
import { frames } from "./stages/frames.ts";
import { ingest } from "./stages/ingest.ts";
import { plan } from "./stages/plan.ts";
import { render } from "./stages/render.ts";
import { transcribe } from "./stages/transcribe.ts";

export const { stages: STAGES, findStage, runStage, runPipeline } = createPipeline<ReelcutContext>({
  command: "reelcut",
  stages: [download, ingest, transcribe, frames, plan, render],
});

export async function initProject(
  ctx: ReelcutContext,
  opts: { source: ReelSource; retakeWord: string; aggressive: boolean; speakerCrop?: Rect | null; style?: string | null },
): Promise<void> {
  await mkdir(ctx.paths.dir, { recursive: true });
  const project: Project = {
    version: 1,
    source: opts.source.kind === "file" ? { kind: "file", path: resolve(opts.source.path) } : opts.source,
    retakeWord: opts.retakeWord,
    aggressive: opts.aggressive,
  };
  await writeIfChanged(ctx.paths.project, project);

  const existing = await readSpeaker(ctx);
  if (opts.speakerCrop !== undefined || existing === null) {
    const speaker: Speaker = { version: 1, crop: opts.speakerCrop ?? existing?.crop ?? null };
    await writeIfChanged(ctx.paths.speaker, speaker);
  }

  if (opts.style !== undefined) {
    const current = await readProjectStyle(ctx);
    const style: ProjectStyle = { version: 1, base: opts.style, overrides: current?.overrides ?? {} };
    await writeIfChanged(ctx.paths.style, style);
  }
}

export async function writeIfChanged(path: string, value: unknown): Promise<void> {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const current = await readFile(path, "utf8").catch(() => null);
  if (current !== next) await writeJsonAtomic(path, value);
}
