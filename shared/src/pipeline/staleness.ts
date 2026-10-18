import { stat } from "node:fs/promises";
import { basename } from "node:path";

export interface StalenessCheck {
  inputs: string[];
  outputs: string[];
  force: boolean;
}

export interface StalenessResult {
  run: boolean;
  reason: string;
}

async function mtimeOrNull(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

export async function checkStaleness({ inputs, outputs, force }: StalenessCheck): Promise<StalenessResult> {
  const inputTimes = await Promise.all(inputs.map(async (path) => ({ path, mtime: await mtimeOrNull(path) })));
  const missingInput = inputTimes.find((t) => t.mtime === null);
  if (missingInput) throw new Error(`Missing input ${missingInput.path}`);

  if (force) return { run: true, reason: "forced" };

  const outputTimes = await Promise.all(outputs.map(async (path) => ({ path, mtime: await mtimeOrNull(path) })));
  const missingOutput = outputTimes.find((t) => t.mtime === null);
  if (missingOutput) return { run: true, reason: `${basename(missingOutput.path)} does not exist` };

  const oldestOutput = Math.min(...outputTimes.map((t) => t.mtime as number));
  const newerInput = inputTimes.find((t) => (t.mtime as number) > oldestOutput);
  if (newerInput) return { run: true, reason: `${basename(newerInput.path)} changed` };

  return { run: false, reason: "up to date" };
}
