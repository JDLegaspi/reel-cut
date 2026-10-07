import type { PipelineContext } from "./context.ts";

export interface Stage {
  name: string;
  inputs(ctx: PipelineContext): Promise<string[]>;
  outputs(ctx: PipelineContext): string[];
  run(ctx: PipelineContext): Promise<void>;
}
