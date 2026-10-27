import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPipeline } from "@reel/shared/pipeline/runner.ts";
import type { ReelSource } from "@reel/shared/schemas/source.ts";
import type { Rect } from "../../remotion/framing.ts";
import { readJson, writeJsonAtomic } from "@reel/shared/util/fs.ts";
import { ProjectSchema, type Project, type Speaker } from "../schemas/project.ts";
import type { ProjectStyle } from "../schemas/style.ts";
import type { ReelcutContext } from "./context.ts";
import { readSpeaker } from "./project.ts";
import { readProjectStyle } from "./style.ts";
import { clean } from "./stages/clean.ts";
import { cut } from "./stages/cut.ts";
import { download } from "./stages/download.ts";
import { frames } from "./stages/frames.ts";
import { ingest } from "./stages/ingest.ts";
import { plan } from "./stages/plan.ts";
import { render } from "./stages/render.ts";
import { retakes } from "./stages/retakes.ts";
import { transcribe } from "./stages/transcribe.ts";

export const { stages: STAGES, findStage, runStage, runPipeline } = createPipeline<ReelcutContext>({
  command: "reel-cut",
  stages: [download, ingest, clean, transcribe, retakes, cut, frames, plan, render],
});

export async function initProject(
  ctx: ReelcutContext,
  opts: {
    sources: ReelSource[];
    retakeWord: string;
    aggressive: boolean;
    face?: boolean;
    isolateVoice?: boolean;
    speakerCrop?: Rect | null;
    style?: string | null;
  },
): Promise<void> {
  if (opts.sources.length > 1 && opts.sources.some((source) => source.kind === "url")) {
    throw new Error("Several clips must all be local files; a reel URL can only be used on its own");
  }
  await mkdir(ctx.paths.dir, { recursive: true });
  const project: Project = {
    version: 1,
    sources: opts.sources.map((source) => (source.kind === "file" ? { kind: "file", path: resolve(source.path) } : source)),
    retakeWord: opts.retakeWord,
    aggressive: opts.aggressive,
    face: opts.face ?? true,
    isolateVoice: opts.isolateVoice ?? false,
  };
  const current = await readJson(ctx.paths.project, ProjectSchema).catch(() => null);
  if (JSON.stringify(current) !== JSON.stringify(project)) await writeJsonAtomic(ctx.paths.project, project);

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
