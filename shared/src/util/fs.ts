import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { z } from "zod";

export function tempPathFor(path: string): string {
  return join(dirname(path), `.tmp-${process.pid}-${basename(path)}`);
}

export async function commitTemp(tempPath: string, path: string): Promise<void> {
  await rename(tempPath, path);
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temp = tempPathFor(path);
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await commitTemp(temp, path);
}

export async function readJson<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${basename(path)} is invalid:\n${result.error.message}`);
  return result.data;
}
