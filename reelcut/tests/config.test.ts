import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";

async function folderWith(config?: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "reelcut-config-"));
  if (config !== undefined) await writeFile(join(dir, "reel-cut.config.json"), JSON.stringify(config));
  return dir;
}

describe("loadConfig", () => {
  test("uses the defaults when the folder has no reel-cut.config.json", async () => {
    const config = loadConfig(await folderWith());
    expect(config.transcription.keyterms).toEqual([]);
    expect(config.paths.projectsDir).toBe("reel-cut/projects");
  });

  test("merges reel-cut.config.json over the defaults", async () => {
    const config = loadConfig(await folderWith({ transcription: { keyterms: ["Acme"] }, paths: { ffmpeg: "/opt/ffmpeg" } }));
    expect(config.transcription.keyterms).toEqual(["Acme"]);
    expect(config.transcription.model).toBe("scribe_v2");
    expect(config.paths.ffmpeg).toBe("/opt/ffmpeg");
    expect(config.paths.ffprobe).toBe("ffprobe");
  });

  test("names the file when its settings are invalid", async () => {
    const dir = await folderWith({ video: { crf: 99 } });
    expect(() => loadConfig(dir)).toThrow(/reel-cut\.config\.json/);
  });
});
