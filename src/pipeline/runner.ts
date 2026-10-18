import { access, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Reel, ReelSource } from "../schemas/reel.ts";
import { writeJsonAtomic } from "../util/fs.ts";
import type { PipelineContext } from "./context.ts";
import { checkStaleness } from "./staleness.ts";
import type { Stage } from "./stage.ts";
import { audio } from "./stages/audio.ts";
import { download } from "./stages/download.ts";
import { frames } from "./stages/frames.ts";
import { transcribe } from "./stages/transcribe.ts";

export const STAGES: Stage[] = [download, audio, frames, transcribe];

export interface StageReport {
  stage: string;
  ran: boolean;
  reason: string;
  seconds: number;
}

export async function initReel(ctx: PipelineContext, source: ReelSource): Promise<void> {
  await mkdir(ctx.paths.dir, { recursive: true });
  const reel: Reel = {
    version: 1,
    id: ctx.name,
    source: source.kind === "file" ? { kind: "file", path: resolve(source.path) } : source,
  };
  const next = `${JSON.stringify(reel, null, 2)}\n`;
  const current = await readFile(ctx.paths.reel, "utf8").catch(() => null);
  if (current !== next) await writeJsonAtomic(ctx.paths.reel, reel);
}

async function firstMissing(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      await access(path);
    } catch {
      return path;
    }
  }
  return null;
}

export function findStage(name: string): Stage {
  const stage = STAGES.find((s) => s.name === name);
  if (!stage)
    throw new Error(
      `Unknown stage "${name}". Stages: ${STAGES.map((s) => s.name).join(", ")}`,
    );
  return stage;
}

export async function runStage(
  ctx: PipelineContext,
  stage: Stage,
  opts: { force: boolean },
): Promise<StageReport> {
  const started = performance.now();
  const inputs = await stage.inputs(ctx);
  const missing = await firstMissing(inputs);
  if (missing) {
    const producer = STAGES.find((s) => s.outputs(ctx).includes(missing));
    const hint = producer
      ? ` Run "reelcut stage ${producer.name} ${ctx.name}" first.`
      : "";
    throw new Error(`[${stage.name}] missing input ${missing}.${hint}`);
  }
  const decision = await checkStaleness({
    inputs,
    outputs: stage.outputs(ctx),
    force: opts.force,
  });
  const log = (message: string) => ctx.log(`[${stage.name}] ${message}`);
  if (!decision.run) {
    log(`skipped (${decision.reason})`);
    return {
      stage: stage.name,
      ran: false,
      reason: decision.reason,
      seconds: 0,
    };
  }
  log(`running (${decision.reason})`);
  await stage.run({ ...ctx, log });
  const seconds = (performance.now() - started) / 1000;
  log(`done in ${seconds.toFixed(1)}s`);
  return { stage: stage.name, ran: true, reason: decision.reason, seconds };
}

export async function runPipeline(
  ctx: PipelineContext,
  opts: { force: boolean },
): Promise<StageReport[]> {
  const reports: StageReport[] = [];
  for (const stage of STAGES) reports.push(await runStage(ctx, stage, opts));
  return reports;
}
