import { access } from "node:fs/promises";
import { checkStaleness } from "./staleness.ts";
import type { BaseContext, Stage } from "./stage.ts";

export interface StageReport {
  stage: string;
  ran: boolean;
  reason: string;
  seconds: number;
}

export interface Pipeline<Ctx extends BaseContext> {
  stages: Stage<Ctx>[];
  findStage(name: string): Stage<Ctx>;
  runStage(ctx: Ctx, stage: Stage<Ctx>, opts: { force: boolean }): Promise<StageReport>;
  runPipeline(ctx: Ctx, opts: { force: boolean }): Promise<StageReport[]>;
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

export function createPipeline<Ctx extends BaseContext>(opts: { command: string; stages: Stage<Ctx>[] }): Pipeline<Ctx> {
  const { command, stages } = opts;

  async function producerOf(ctx: Ctx, path: string): Promise<Stage<Ctx> | undefined> {
    for (const stage of stages) {
      if ((await stage.outputs(ctx)).includes(path)) return stage;
    }
    return undefined;
  }

  function findStage(name: string): Stage<Ctx> {
    const stage = stages.find((s) => s.name === name);
    if (!stage) throw new Error(`Unknown stage "${name}". Stages: ${stages.map((s) => s.name).join(", ")}`);
    return stage;
  }

  async function runStage(ctx: Ctx, stage: Stage<Ctx>, runOpts: { force: boolean }): Promise<StageReport> {
    const started = performance.now();
    const inputs = await stage.inputs(ctx);
    const missing = await firstMissing(inputs);
    if (missing) {
      const producer = await producerOf(ctx, missing);
      const hint = producer ? ` Run "${command} stage ${producer.name} ${ctx.name}" first.` : "";
      throw new Error(`[${stage.name}] missing input ${missing}.${hint}`);
    }
    const decision = await checkStaleness({ inputs, outputs: await stage.outputs(ctx), force: runOpts.force });
    const log = (message: string) => ctx.log(`[${stage.name}] ${message}`);
    if (!decision.run) {
      log(`skipped (${decision.reason})`);
      return { stage: stage.name, ran: false, reason: decision.reason, seconds: 0 };
    }
    log(`running (${decision.reason})`);
    await stage.run({ ...ctx, log });
    const seconds = (performance.now() - started) / 1000;
    log(`done in ${seconds.toFixed(1)}s`);
    return { stage: stage.name, ran: true, reason: decision.reason, seconds };
  }

  async function runPipeline(ctx: Ctx, runOpts: { force: boolean }): Promise<StageReport[]> {
    const reports: StageReport[] = [];
    for (const stage of stages) reports.push(await runStage(ctx, stage, runOpts));
    return reports;
  }

  return { stages, findStage, runStage, runPipeline };
}
