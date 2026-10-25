import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function packageRoot(moduleUrl: string): string {
  let dir = dirname(fileURLToPath(moduleUrl));
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No package.json above ${moduleUrl}`);
    dir = parent;
  }
  return dir;
}
