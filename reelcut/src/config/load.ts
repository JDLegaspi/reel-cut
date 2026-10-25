import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import defaults from "../../reelcut.config.ts";
import { ConfigSchema, type ReelcutConfig } from "./schema.ts";

export const CONFIG_FILE = "reel-cut.config.json";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function merge(base: unknown, override: unknown): unknown {
  if (!isObject(base) || !isObject(override)) return override;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) merged[key] = merge(base[key], value);
  return merged;
}

export function loadConfig(dir: string = process.cwd()): ReelcutConfig {
  const file = join(dir, CONFIG_FILE);
  const overrides: unknown = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const result = ConfigSchema.safeParse(merge(defaults, overrides));
  if (!result.success) throw new Error(`Invalid settings in ${file}:\n${result.error.message}`);
  return result.data;
}
