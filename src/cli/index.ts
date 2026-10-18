import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config/load.ts";
import { reelIdFor, sourceFor } from "../download/ytdlp.ts";
import { createContext, type PipelineContext } from "../pipeline/context.ts";
import { findStage, initReel, runPipeline, runStage, STAGES } from "../pipeline/runner.ts";
import { createElevenLabsTranscriber } from "../transcribe/elevenlabs.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

loadEnv({ path: resolve(ROOT, ".env"), quiet: true });

function contextFor(name: string): PipelineContext {
  const config = loadConfig();
  return createContext({
    name,
    reelsRoot: resolve(ROOT, config.paths.libraryDir, "reels"),
    config,
    transcriber: () => createElevenLabsTranscriber(config.transcription),
    log: (message) => console.log(`${name} ${message}`),
  });
}

const program = new Command()
  .name("reelcut")
  .description("Download, transcribe and sample reels");

program
  .command("add")
  .description("Add reels by URL (or local file) and process every stage that is missing or out of date")
  .argument("<inputs...>", "reel URLs or video files")
  .option("--force", "rerun every stage")
  .action(async (inputs: string[], opts: { force?: boolean }) => {
    const failed: string[] = [];
    for (const input of inputs) {
      const source = sourceFor(input);
      const ctx = contextFor(reelIdFor(source));
      try {
        await initReel(ctx, source);
        await runPipeline(ctx, { force: opts.force ?? false });
      } catch (error) {
        console.error(`${ctx.name} failed: ${error instanceof Error ? error.message : String(error)}`);
        failed.push(input);
      }
    }
    console.log(`${inputs.length - failed.length}/${inputs.length} reels processed`);
    if (failed.length > 0) {
      console.error(`failed:\n  ${failed.join("\n  ")}`);
      process.exitCode = 1;
    }
  });

program
  .command("stage")
  .description(`Run a single stage for one reel (${STAGES.map((s) => s.name).join(", ")})`)
  .argument("<stage>")
  .argument("<reelId>")
  .option("--force", "rerun even if up to date")
  .action(async (stageName: string, name: string, opts: { force?: boolean }) => {
    await runStage(contextFor(name), findStage(stageName), { force: opts.force ?? false });
  });

program.parseAsync().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
