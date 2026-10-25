import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { packageRoot } from "../src/packageRoot.ts";
import { REMOTION_ENTRY } from "../src/render/remotion.ts";

describe("packageRoot", () => {
  test("finds the nearest folder with a package.json above a module", async () => {
    const root = await mkdtemp(join(tmpdir(), "reelcut-root-"));
    await writeFile(join(root, "package.json"), "{}");
    await mkdir(join(root, "dist", "cli"), { recursive: true });
    expect(packageRoot(pathToFileURL(join(root, "dist", "cli", "index.js")).href)).toBe(root);
  });

  test("locates the Remotion entry point inside the package", () => {
    expect(existsSync(REMOTION_ENTRY)).toBe(true);
  });
});
