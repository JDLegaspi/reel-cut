import { ReelSchema, type Reel } from "../schemas/reel.ts";
import { readJson } from "../util/fs.ts";
import type { PipelineContext } from "./context.ts";

export async function readReel(ctx: PipelineContext): Promise<Reel> {
  try {
    return await readJson(ctx.paths.reel, ReelSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Reel "${ctx.name}" does not exist. Add it with: reelcut add <url>`);
    }
    throw error;
  }
}
