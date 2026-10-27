import type { FrameImage } from "@reel/shared/frames/frames.ts";
import type { Transcript } from "@reel/shared/schemas/transcript.ts";
import type { Brand } from "../schemas/brands.ts";
import type { PlannerOutput } from "../schemas/visualPlan.ts";
import type { VisualRules } from "./rules.ts";

export interface PlanInput {
  transcript: Transcript;
  frames: FrameImage[];
  rules: VisualRules;
  face: boolean;
  brands: Brand[];
  retry?: { previous: PlannerOutput; errors: string[] };
}

export interface PlanResult {
  raw: unknown;
  output: PlannerOutput;
}

export interface Planner {
  plan(input: PlanInput): Promise<PlanResult>;
}
