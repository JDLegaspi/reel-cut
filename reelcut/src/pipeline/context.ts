import { resolve } from "node:path";
import type { BaseContext, Log } from "@reel/shared/pipeline/stage.ts";
import type { Transcriber } from "@reel/shared/transcribe/Transcriber.ts";
import type { VoiceIsolator } from "../audio/VoiceIsolator.ts";
import type { ReelcutConfig } from "../config/schema.ts";
import type { Planner } from "../plan/Planner.ts";
import type { Renderer } from "../render/Renderer.ts";
import type { RetakeFinder } from "../retakes/RetakeFinder.ts";
import { projectPaths, type ProjectPaths } from "./paths.ts";

export interface ReelcutContext extends BaseContext {
  paths: ProjectPaths;
  stylesRoot: string;
  config: ReelcutConfig;
  isolator: () => VoiceIsolator;
  transcriber: () => Transcriber;
  retakeFinder: () => RetakeFinder;
  planner: () => Planner;
  renderer: () => Renderer;
}

export function createContext(opts: {
  name: string;
  projectsRoot: string;
  stylesRoot: string;
  config: ReelcutConfig;
  isolator: () => VoiceIsolator;
  transcriber: () => Transcriber;
  retakeFinder: () => RetakeFinder;
  planner: () => Planner;
  renderer: () => Renderer;
  log: Log;
}): ReelcutContext {
  return {
    name: opts.name,
    paths: projectPaths(resolve(opts.projectsRoot, opts.name)),
    stylesRoot: resolve(opts.stylesRoot),
    config: opts.config,
    isolator: opts.isolator,
    transcriber: opts.transcriber,
    retakeFinder: opts.retakeFinder,
    planner: opts.planner,
    renderer: opts.renderer,
    log: opts.log,
  };
}
