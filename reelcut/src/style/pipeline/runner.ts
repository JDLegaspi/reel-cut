import { mkdir } from "node:fs/promises";
import { createPipeline } from "@reel/shared/pipeline/runner.ts";
import { writeIfChanged } from "../../pipeline/runner.ts";
import type { StyleContext } from "./context.ts";
import { derive, gather, sheet } from "./stages.ts";

export const {
  stages: STYLE_STAGES,
  findStage: findStyleStage,
  runStage: runStyleStage,
  runPipeline: runStylePipeline,
} = createPipeline<StyleContext>({ command: "reelcut style", stages: [gather, derive, sheet] });

export async function initStyle(ctx: StyleContext, sources: string[]): Promise<void> {
  if (sources.length === 0) throw new Error("A style needs at least one reference: --from <url or file>");
  await mkdir(ctx.paths.dir, { recursive: true });
  await writeIfChanged(ctx.paths.sources, { version: 1, sources });
}
