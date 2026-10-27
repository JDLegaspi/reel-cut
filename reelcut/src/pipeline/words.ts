import { access } from "node:fs/promises";
import { readJson } from "@reel/shared/util/fs.ts";
import { z } from "zod";
import { bulleted } from "../plan/rules.ts";
import { applySpellings, spellingProblems } from "../render/spellings.ts";
import { CutTranscriptSchema, type CutTranscript } from "../schemas/cuts.ts";
import type { ReelcutContext } from "./context.ts";

const SpellingsSchema = z.object({ version: z.literal(1), spellings: z.record(z.string(), z.string()) });

export async function spellingInputs(ctx: ReelcutContext): Promise<string[]> {
  return access(ctx.paths.spellings).then(
    () => [ctx.paths.spellings],
    () => [],
  );
}

export async function readCutTranscript(ctx: ReelcutContext): Promise<CutTranscript> {
  const transcript = await readJson(ctx.paths.cutTranscript, CutTranscriptSchema);
  if ((await spellingInputs(ctx)).length === 0) return transcript;
  const { spellings } = await readJson(ctx.paths.spellings, SpellingsSchema);
  const problems = spellingProblems(spellings);
  if (problems.length > 0) throw new Error(`spellings.json breaks these rules:\n${bulleted(problems)}`);
  return { ...transcript, words: applySpellings(transcript.words, spellings) };
}
