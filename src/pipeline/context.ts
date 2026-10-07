import { resolve } from "node:path";
import type { ReelcutConfig } from "../config/schema.ts";
import type { Transcriber } from "../transcribe/Transcriber.ts";
import { projectPaths, type ProjectPaths } from "./paths.ts";

export type Log = (message: string) => void;

export interface PipelineContext {
  name: string;
  paths: ProjectPaths;
  config: ReelcutConfig;
  transcriber: () => Transcriber;
  log: Log;
}

export function createContext(opts: {
  name: string;
  workRoot: string;
  config: ReelcutConfig;
  transcriber: () => Transcriber;
  log: Log;
}): PipelineContext {
  return {
    name: opts.name,
    paths: projectPaths(resolve(opts.workRoot, opts.name)),
    config: opts.config,
    transcriber: opts.transcriber,
    log: opts.log,
  };
}
