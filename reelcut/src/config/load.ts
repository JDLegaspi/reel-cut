import config from "../../reelcut.config.ts";
import { ConfigSchema, type ReelcutConfig } from "./schema.ts";

export function loadConfig(): ReelcutConfig {
  const result = ConfigSchema.safeParse(config);
  if (!result.success) throw new Error(`Invalid reelcut.config.ts:\n${result.error.message}`);
  return result.data;
}
