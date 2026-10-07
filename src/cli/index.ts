import { basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config/load.ts";
import { createContext, type PipelineContext } from "../pipeline/context.ts";
import { findStage, initProject, runPipeline, runStage, STAGES } from "../pipeline/runner.ts";
import { createElevenLabsTranscriber } from "../transcribe/elevenlabs.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

loadEnv({ path: resolve(ROOT, ".env"), quiet: true });

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function contextFor(name: string): PipelineContext {
  const config = loadConfig();
  return createContext({
    name,
    workRoot: resolve(ROOT, config.paths.workDir),
    config,
    transcriber: () => createElevenLabsTranscriber(config.transcription),
    log: (message) => console.log(message),
  });
}

const program = new Command()
  .name("reelcut")
  .description("Turn a raw vertical talking-head recording into an Instagram-ready Reel");

program
  .command("run")
  .description("Run every stage that is missing or out of date")
  .argument("<input>", "raw recording")
  .option("--name <project>", "project name (defaults to the input file name)")
  .option("--retake-word <word>", "word that abandons the previous attempt")
  .option("--aggressive", "also remove natural fillers inside good sentences")
  .option("--force", "rerun every stage")
  .action(async (input: string, opts: { name?: string; retakeWord?: string; aggressive?: boolean; force?: boolean }) => {
    const name = opts.name ?? slugify(basename(input, extname(input)));
    const ctx = contextFor(name);
    await initProject(ctx, {
      input,
      retakeWord: opts.retakeWord ?? ctx.config.retakes.retakeWord,
      aggressive: opts.aggressive ?? ctx.config.retakes.aggressive,
    });
    console.log(`project ${name} → ${ctx.paths.dir}`);
    await runPipeline(ctx, { force: opts.force ?? false });
  });

program
  .command("stage")
  .description(`Run a single stage (${STAGES.map((s) => s.name).join(", ")})`)
  .argument("<stage>")
  .argument("<project>")
  .option("--force", "rerun even if up to date")
  .action(async (stageName: string, name: string, opts: { force?: boolean }) => {
    await runStage(contextFor(name), findStage(stageName), { force: opts.force ?? false });
  });

program
  .command("studio")
  .description("Open Remotion Studio for a project")
  .argument("<project>")
  .action(() => {
    throw new Error("studio is not available yet (milestone 3)");
  });

program.parseAsync().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
