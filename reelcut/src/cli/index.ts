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
import { createRemotionRenderer, createRemotionSheetRenderer, openStudio } from "../render/remotion.ts";
import { createClaudeStyler } from "../style/claude.ts";
import { createStyleContext, type StyleContext } from "../style/pipeline/context.ts";
import { findStyleStage, initStyle, runStyleStage, runStylePipeline, STYLE_STAGES } from "../style/pipeline/runner.ts";

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

loadEnv({ path: resolve(PACKAGE_ROOT, "../.env"), quiet: true });

function contextFor(name: string): ReelcutContext {
  const config = loadConfig();
  return createContext({
    name,
    projectsRoot: resolve(PACKAGE_ROOT, config.paths.projectsDir),
    stylesRoot: resolve(PACKAGE_ROOT, config.paths.stylesDir),
    config,
    transcriber: () => createElevenLabsTranscriber(config.transcription),
    planner: () => createClaudePlanner(),
    renderer: () => createRemotionRenderer(),
    log: (message) => console.log(message),
  });
}

function styleContextFor(name: string): StyleContext {
  const config = loadConfig();
  return createStyleContext({
    name,
    stylesRoot: resolve(PACKAGE_ROOT, config.paths.stylesDir),
    config,
    styler: () => createClaudeStyler(),
    sheet: () => createRemotionSheetRenderer(),
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
  .option("--no-face", "the input is a voiceover with no one on camera; shots without a visual show the spoken words")
  .option("--style <name>", 'style to draw the visuals in, made with "reelcut style create"; "default" for the built-in look')
  .option("--force", "rerun every stage")
  .action(
    async (
      input: string,
      opts: { name?: string; retakeWord?: string; aggressive?: boolean; face?: boolean; speakerCrop?: string; style?: string; force?: boolean },
    ) => {
    const source = sourceFor(input);
    const name = opts.name ?? defaultProjectName(source);
    const ctx = contextFor(name);
    await initProject(ctx, {
      source,
      retakeWord: opts.retakeWord ?? ctx.config.retakes.retakeWord,
      aggressive: opts.aggressive ?? ctx.config.retakes.aggressive,
      face: opts.face,
      speakerCrop: opts.speakerCrop === undefined ? undefined : parseSpeakerCrop(opts.speakerCrop, ctx.config.video),
      style: opts.style === undefined ? undefined : opts.style === "default" ? null : opts.style,
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

const style = program.command("style").description("Make styles from references and preview them");

style
  .command("create")
  .description("Gather references, make a style from them with Claude, and draw its sheet")
  .argument("<name>", "style name: lowercase letters, digits and dashes")
  .requiredOption("--from <reference...>", "websites, GitHub repos, reels, images or local files")
  .option("--force", "rerun every stage")
  .action(async (name: string, opts: { from: string[]; force?: boolean }) => {
    const ctx = styleContextFor(name);
    await initStyle(ctx, opts.from);
    await runStylePipeline(ctx, { force: opts.force ?? false });
    console.log(`style ${name} → ${ctx.paths.style}\nsheet: ${ctx.paths.sheet}`);
  });

style
  .command("sheet")
  .description("Redraw a style's sheet, e.g. after editing its style.json")
  .argument("<name>")
  .action(async (name: string) => {
    const ctx = styleContextFor(name);
    await runStyleStage(ctx, findStyleStage("sheet"), { force: true });
    console.log(`sheet: ${ctx.paths.sheet}`);
  });

style
  .command("stage")
  .description(`Run a single style stage (${STYLE_STAGES.map((s) => s.name).join(", ")})`)
  .argument("<stage>")
  .argument("<name>")
  .option("--force", "rerun even if up to date")
  .action(async (stageName: string, name: string, opts: { force?: boolean }) => {
    await runStyleStage(styleContextFor(name), findStyleStage(stageName), { force: opts.force ?? false });
  });

program.parseAsync().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
