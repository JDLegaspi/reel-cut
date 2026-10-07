import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { probe } from "../src/media/probe.ts";
import { createContext } from "../src/pipeline/context.ts";
import { findStage, initProject, runPipeline, runStage } from "../src/pipeline/runner.ts";
import type { Transcript } from "../src/schemas/transcript.ts";
import { createMockTranscriber } from "../src/transcribe/mock.ts";

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const transcript: Transcript = {
  version: 1,
  provider: "mock",
  language: "en",
  duration: 2,
  words: [
    { i: 0, text: "hello", start: 0.2, end: 0.5 },
    { i: 1, text: "world", start: 0.6, end: 0.9 },
  ],
};

describe.skipIf(!hasFfmpeg())("pipeline: ingest and transcribe", () => {
  let workRoot: string;
  let input: string;

  beforeAll(async () => {
    workRoot = await mkdtemp(join(tmpdir(), "reelcut-e2e-"));
    input = join(workRoot, "landscape.mp4");
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=25:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-c:a", "aac", "-shortest", input,
    ]);
  });

  function context() {
    const config = loadConfig();
    return createContext({
      name: "demo",
      workRoot,
      config,
      transcriber: () => createMockTranscriber(transcript),
      log: () => {},
    });
  }

  test("produces a normalised 1080x1920 source, 16 kHz audio and transcript", async () => {
    const ctx = context();
    await initProject(ctx, { input, retakeWord: "again", aggressive: false });
    const reports = await runPipeline(ctx, { force: false });

    expect(reports.map((r) => [r.stage, r.ran])).toEqual([
      ["ingest", true],
      ["transcribe", true],
    ]);

    const source = await probe("ffprobe", ctx.paths.source);
    expect(source).toMatchObject({ width: 1080, height: 1920, fps: { num: 25, den: 1 }, hasAudio: true });

    const audio = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", ctx.paths.audio]).toString(),
    );
    expect(audio.streams[0]).toMatchObject({ sample_rate: "16000", channels: 1 });

    const written = JSON.parse(await readFile(ctx.paths.transcript, "utf8"));
    expect(written).toEqual(transcript);
    expect((await stat(ctx.paths.transcriptRaw)).size).toBeGreaterThan(0);
  });

  test("skips stages whose outputs are up to date", async () => {
    const ctx = context();
    const reports = await runPipeline(ctx, { force: false });
    expect(reports.map((r) => r.ran)).toEqual([false, false]);
  });

  test("reruns everything with force", async () => {
    const ctx = context();
    const reports = await runPipeline(ctx, { force: true });
    expect(reports.map((r) => r.ran)).toEqual([true, true]);
  });

  test("names the stage to run when an input is missing", async () => {
    const config = loadConfig();
    const fresh = createContext({
      name: "fresh",
      workRoot,
      config,
      transcriber: () => createMockTranscriber(transcript),
      log: () => {},
    });
    await initProject(fresh, { input, retakeWord: "again", aggressive: false });
    await expect(runStage(fresh, findStage("transcribe"), { force: false })).rejects.toThrow(
      'Run "reelcut stage ingest fresh" first',
    );
  });

  test("does not rewrite project.json when options are unchanged", async () => {
    const ctx = context();
    const before = (await stat(ctx.paths.project)).mtimeMs;
    await initProject(ctx, { input, retakeWord: "again", aggressive: false });
    expect((await stat(ctx.paths.project)).mtimeMs).toBe(before);
  });
});
