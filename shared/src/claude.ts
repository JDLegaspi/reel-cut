import Anthropic from "@anthropic-ai/sdk";
import type { FrameImage } from "./frames/frames.ts";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function claudeModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export function createClaudeClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env");
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});
}

export function frameBlocks(frames: FrameImage[]): Anthropic.Beta.BetaContentBlockParam[] {
  return frames.flatMap((frame): Anthropic.Beta.BetaContentBlockParam[] => [
    { type: "text", text: `Frame at ${frame.t.toFixed(1)}s` },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame.data.toString("base64") } },
  ]);
}
