import { resolve } from "node:path";
import type { BaseContext, Log } from "@reel/shared/pipeline/stage.ts";
import type { Transcriber } from "@reel/shared/transcribe/Transcriber.ts";
import type { ReelcutConfig } from "../config/schema.ts";
import type { Planner } from "../plan/Planner.ts";
import type { Renderer } from "../render/Renderer.ts";
import { projectPaths, type ProjectPaths } from "./paths.ts";

export interface ReelcutContext extends BaseContext {
  paths: ProjectPaths;
  stylesRoot: string;
  config: ReelcutConfig;
  transcriber: () => Transcriber;
  planner: () => Planner;
  renderer: () => Renderer;
}

export function createContext(opts: {
  name: string;
  projectsRoot: string;
  stylesRoot: string;
  config: ReelcutConfig;
  transcriber: () => Transcriber;
  planner: () => Planner;
  renderer: () => Renderer;
  log: Log;
}): ReelcutContext {
  return {
    name: opts.name,
    paths: projectPaths(resolve(opts.projectsRoot, opts.name)),
    stylesRoot: resolve(opts.stylesRoot),
    config: opts.config,
    transcriber: opts.transcriber,
    planner: opts.planner,
    renderer: opts.renderer,
    log: opts.log,
  };
}
