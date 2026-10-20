import type { Style, StyleOverrides } from "../schemas/style.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) merged[key] = deepMerge(base[key], value);
  return merged;
}

export function mergeStyle(base: Style, overrides: StyleOverrides): Style {
  return deepMerge(base, overrides) as Style;
}
