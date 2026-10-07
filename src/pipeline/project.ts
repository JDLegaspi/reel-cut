import { ProjectSchema, type Project } from "../schemas/project.ts";
import { readJson } from "../util/fs.ts";
import type { PipelineContext } from "./context.ts";

export async function readProject(ctx: PipelineContext): Promise<Project> {
  try {
    return await readJson(ctx.paths.project, ProjectSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Project "${ctx.name}" does not exist. Start it with: reelcut run <input.mp4> --name ${ctx.name}`);
    }
    throw error;
  }
}
