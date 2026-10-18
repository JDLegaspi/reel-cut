import { resolve } from "node:path";
import type { ReelcutConfig } from "../config/schema.ts";
import type { Transcriber } from "../transcribe/Transcriber.ts";
import { reelPaths, type ReelPaths } from "./paths.ts";

export type Log = (message: string) => void;

export interface PipelineContext {
  name: string;
  paths: ReelPaths;
  config: ReelcutConfig;
  transcriber: () => Transcriber;
  log: Log;
}

export function createContext(opts: {
  name: string;
  reelsRoot: string;
  config: ReelcutConfig;
  transcriber: () => Transcriber;
  log: Log;
}): PipelineContext {
  return {
    name: opts.name,
    paths: reelPaths(resolve(opts.reelsRoot, opts.name)),
    config: opts.config,
    transcriber: opts.transcriber,
    log: opts.log,
  };
}
