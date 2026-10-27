import { basename, extname } from "node:path";
import { reelIdFor, slugify } from "@reel/shared/download/ytdlp.ts";
import type { ReelSource } from "@reel/shared/schemas/source.ts";
import { readJson } from "@reel/shared/util/fs.ts";
import { ProjectSchema, SpeakerSchema, type Project, type Speaker } from "../schemas/project.ts";
import type { ReelcutContext } from "./context.ts";

export function defaultProjectName(source: ReelSource): string {
  return source.kind === "url" ? reelIdFor(source) : slugify(basename(source.path, extname(source.path)));
}

export async function readProject(ctx: ReelcutContext): Promise<Project> {
  try {
    return await readJson(ctx.paths.project, ProjectSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Project "${ctx.name}" does not exist. Start it with: reelcut run <url or file> --name ${ctx.name}`);
    }
    throw error;
  }
}

export async function sourceVideos(ctx: ReelcutContext): Promise<string[]> {
  const { sources } = await readProject(ctx);
  return sources.map((source) => (source.kind === "url" ? ctx.paths.original : source.path));
}

export async function readSpeaker(ctx: ReelcutContext): Promise<Speaker | null> {
  try {
    return await readJson(ctx.paths.speaker, SpeakerSchema);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
