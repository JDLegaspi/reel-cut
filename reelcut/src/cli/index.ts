import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceFor } from "@reel/shared/download/ytdlp.ts";
import { createElevenLabsTranscriber } from "@reel/shared/transcribe/elevenlabs.ts";
import { Command } from "commander";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config/load.ts";
import { parseSpeakerCrop } from "../media/speakerCrop.ts";
import { createContext, type ReelcutContext } from "../pipeline/context.ts";
import { defaultProjectName } from "../pipeline/project.ts";
import { findStage, initProject, runPipeline, runStage, STAGES } from "../pipeline/runner.ts";
import { renderPropsFor } from "../pipeline/stages/render.ts";
import { createClaudePlanner } from "../plan/claude.ts";
import { createRemotionRenderer, openStudio } from "../render/remotion.ts";

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

loadEnv({ path: resolve(PACKAGE_ROOT, "../.env"), quiet: true });

function contextFor(name: string): ReelcutContext {
  const config = loadConfig();
  return createContext({
    name,
    projectsRoot: resolve(PACKAGE_ROOT, config.paths.projectsDir),
    config,
    transcriber: () => createElevenLabsTranscriber(config.transcription),
    planner: () => createClaudePlanner(),
    renderer: () => createRemotionRenderer(),
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
  .option("--speaker-crop <crop>", 'part of the video that shows the speaker: "top-half", "bottom-half" or x,y,width,height')
  .option("--force", "rerun every stage")
  .action(
    async (
      input: string,
      opts: { name?: string; retakeWord?: string; aggressive?: boolean; speakerCrop?: string; force?: boolean },
    ) => {
    const source = sourceFor(input);
    const name = opts.name ?? defaultProjectName(source);
    const ctx = contextFor(name);
    await initProject(ctx, {
      source,
      retakeWord: opts.retakeWord ?? ctx.config.retakes.retakeWord,
      aggressive: opts.aggressive ?? ctx.config.retakes.aggressive,
      speakerCrop: opts.speakerCrop === undefined ? undefined : parseSpeakerCrop(opts.speakerCrop, ctx.config.video),
    });
    console.log(`project ${name} → ${ctx.paths.dir}`);
    await runPipeline(ctx, { force: opts.force ?? false });
    },
  );

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
  .action(async (name: string) => {
    const ctx = contextFor(name);
    await openStudio({ props: await renderPropsFor(ctx), publicDir: ctx.paths.dir });
  });

program.parseAsync().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
