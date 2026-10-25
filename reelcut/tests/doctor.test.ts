import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { checkSetup } from "../src/doctor.ts";

const config = loadConfig();
const KEYS = { ANTHROPIC_API_KEY: "a", ELEVENLABS_API_KEY: "e" };

describe("checkSetup", () => {
  test("passes when the tools run and both keys are set", async () => {
    const checks = await checkSetup({ config, env: KEYS, canRun: async () => true });
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  test("flags a missing API key as required", async () => {
    const checks = await checkSetup({ config, env: { ANTHROPIC_API_KEY: "a" }, canRun: async () => true });
    const failed = checks.filter((check) => !check.ok);
    expect(failed.map((check) => [check.name, check.required])).toEqual([["ELEVENLABS_API_KEY", true]]);
  });

  test("runs the tools at the configured paths", async () => {
    const ran: string[] = [];
    await checkSetup({
      config: { ...config, paths: { ...config.paths, ffmpeg: "/opt/ffmpeg" } },
      env: KEYS,
      canRun: async (command) => {
        ran.push(command);
        return true;
      },
    });
    expect(ran).toEqual(["/opt/ffmpeg", "ffprobe", "yt-dlp"]);
  });

  test("treats yt-dlp as optional", async () => {
    const checks = await checkSetup({ config, env: KEYS, canRun: async (command) => command !== "yt-dlp" });
    expect(checks.find((check) => check.name === "yt-dlp")).toMatchObject({ ok: false, required: false });
  });
});
