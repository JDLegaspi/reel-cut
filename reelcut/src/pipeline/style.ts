import { access, readFile } from "node:fs/promises";
import { bulleted } from "../plan/rules.ts";
import { ProjectStyleSchema, type ProjectStyle, type Style } from "../schemas/style.ts";
import { styleProblems } from "../style/checks.ts";
import { DEFAULT_STYLE } from "../style/default.ts";
import { stylePaths } from "../style/paths.ts";
import { mergeStyle } from "../style/resolve.ts";
import type { ReelcutContext } from "./context.ts";

async function readJsonOrNull(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

export async function readProjectStyle(ctx: ReelcutContext): Promise<ProjectStyle | null> {
  const raw = await readJsonOrNull(ctx.paths.style);
  if (raw === null) return null;
  const parsed = ProjectStyleSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "style"}: ${issue.message}`);
    throw new Error(`style.json breaks these rules:\n${bulleted(issues)}`);
  }
  return parsed.data;
}

export async function styleInputs(ctx: ReelcutContext): Promise<string[]> {
  if (!(await exists(ctx.paths.style))) return [];
  const project = await readProjectStyle(ctx);
  if (!project?.base) return [ctx.paths.style];
  const base = stylePaths(ctx.stylesRoot, project.base).style;
  return [ctx.paths.style, ...((await exists(base)) ? [base] : [])];
}

export async function resolveProjectStyle(ctx: ReelcutContext): Promise<{ style: Style; warnings: string[] }> {
  const project = await readProjectStyle(ctx);
  if (!project) return { style: DEFAULT_STYLE, warnings: [] };
  let base = DEFAULT_STYLE;
  if (project.base) {
    const raw = await readJsonOrNull(stylePaths(ctx.stylesRoot, project.base).style);
    if (raw === null) throw new Error(`Style "${project.base}" does not exist. Make it with: reel-cut style create ${project.base} --from <reference>`);
    base = raw as Style;
  }
  const { errors, contrast, style } = styleProblems(mergeStyle(base, project.overrides));
  if (!style) {
    const source = project.base ? `Style "${project.base}" with this project's overrides` : "This project's style";
    throw new Error(`${source} breaks these rules:\n${bulleted(errors)}`);
  }
  return { style, warnings: contrast };
}
