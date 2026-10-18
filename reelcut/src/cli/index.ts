import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceFor } from "@reel/shared/download/ytdlp.ts";
import { createElevenLabsTranscriber } from "@reel/shared/transcribe/elevenlabs.ts";
import { Command } from "commander";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config/load.ts";
import { createContext, type ReelcutContext } from "../pipeline/context.ts";
import { defaultProjectName } from "../pipeline/project.ts";
import { findStage, initProject, runPipeline, runStage, STAGES } from "../pipeline/runner.ts";

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

loadEnv({ path: resolve(PACKAGE_ROOT, "../.env"), quiet: true });

function contextFor(name: string): ReelcutContext {
  const config = loadConfig();
  return createContext({
    name,
    projectsRoot: resolve(PACKAGE_ROOT, config.paths.projectsDir),
    config,
    transcriber: () => createElevenLabsTranscriber(config.transcription),
    log: (message) => console.log(message),
  });
}

const program = new Command()
  .name("reelcut")
  .description("Turn a vertical talking-head video into an Instagram-ready Reel");

program
  .command("run")
  .description("Run every stage that is missing or out of date")
  .argument("<input>", "reel URL or video file")
  .option("--name <project>", "project name (defaults to the reel id or file name)")
  .option("--retake-word <word>", "word that abandons the previous attempt")
  .option("--aggressive", "also remove natural fillers inside good sentences")
  .option("--force", "rerun every stage")
  .action(async (input: string, opts: { name?: string; retakeWord?: string; aggressive?: boolean; force?: boolean }) => {
    const source = sourceFor(input);
    const name = opts.name ?? defaultProjectName(source);
    const ctx = contextFor(name);
    await initProject(ctx, {
      source,
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
