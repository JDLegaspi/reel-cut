import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPipeline } from "@reel/shared/pipeline/runner.ts";
import type { ReelSource } from "@reel/shared/schemas/source.ts";
import { writeJsonAtomic } from "@reel/shared/util/fs.ts";
import type { Project } from "../schemas/project.ts";
import type { ReelcutContext } from "./context.ts";
import { download } from "./stages/download.ts";
import { ingest } from "./stages/ingest.ts";
import { transcribe } from "./stages/transcribe.ts";

export const { stages: STAGES, findStage, runStage, runPipeline } = createPipeline<ReelcutContext>({
  command: "reelcut",
  stages: [download, ingest, transcribe],
});

export async function initProject(
  ctx: ReelcutContext,
  opts: { source: ReelSource; retakeWord: string; aggressive: boolean },
): Promise<void> {
  await mkdir(ctx.paths.dir, { recursive: true });
  const project: Project = {
    version: 1,
    source: opts.source.kind === "file" ? { kind: "file", path: resolve(opts.source.path) } : opts.source,
    retakeWord: opts.retakeWord,
    aggressive: opts.aggressive,
  };
  const next = `${JSON.stringify(project, null, 2)}\n`;
  const current = await readFile(ctx.paths.project, "utf8").catch(() => null);
  if (current !== next) await writeJsonAtomic(ctx.paths.project, project);
}
