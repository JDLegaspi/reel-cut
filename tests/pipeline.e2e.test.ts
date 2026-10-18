import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { createContext } from "../src/pipeline/context.ts";
import { findStage, initReel, runPipeline, runStage } from "../src/pipeline/runner.ts";
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
  duration: 6,
  words: [
    { i: 0, text: "hello", start: 0.2, end: 0.5 },
    { i: 1, text: "world", start: 0.6, end: 0.9 },
  ],
};

describe.skipIf(!hasFfmpeg())("pipeline: local file reels", () => {
  let root: string;
  let withAudio: string;
  let silent: string;
  let transcriberCalls = 0;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "reelcut-e2e-"));
    withAudio = join(root, "talking.mov");
    silent = join(root, "text-only.mp4");
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=25:duration=6",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
      "-c:v", "libx264", "-c:a", "aac", "-shortest", withAudio,
    ]);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=25:duration=6",
      "-c:v", "libx264", silent,
    ]);
  });

  function context(name: string) {
    return createContext({
      name,
      reelsRoot: join(root, "library", "reels"),
      config: loadConfig(),
      transcriber: () => {
        transcriberCalls++;
        return createMockTranscriber(transcript);
      },
      log: () => {},
    });
  }

  test("produces video, meta, 16 kHz audio, frames and transcript", async () => {
    const ctx = context("file-talking");
    await initReel(ctx, { kind: "file", path: withAudio });
    const reports = await runPipeline(ctx, { force: false });
    expect(reports.map((r) => [r.stage, r.ran])).toEqual([
      ["download", true],
      ["audio", true],
      ["frames", true],
      ["transcribe", true],
    ]);

    const meta = JSON.parse(await readFile(ctx.paths.meta, "utf8"));
    expect(meta).toMatchObject({ id: "file-talking", url: null, author: null });
    expect(meta.duration).toBeCloseTo(6, 0);

    const audio = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", ctx.paths.audio]).toString(),
    );
    expect(audio.streams[0]).toMatchObject({ sample_rate: "16000", channels: 1 });

    const frames = JSON.parse(await readFile(ctx.paths.frames, "utf8"));
    expect(frames.interval).toBe(2);
    expect(frames.frames.map((f: { t: number }) => f.t)).toEqual([0, 2, 4]);
    expect(await readdir(ctx.paths.framesDir)).toEqual(["001.jpg", "002.jpg", "003.jpg"]);

    expect(JSON.parse(await readFile(ctx.paths.transcript, "utf8"))).toEqual(transcript);
  });

  test("skips stages whose outputs are up to date, reruns with force", async () => {
    const ctx = context("file-talking");
    expect((await runPipeline(ctx, { force: false })).map((r) => r.ran)).toEqual([false, false, false, false]);
    expect((await runPipeline(ctx, { force: true })).map((r) => r.ran)).toEqual([true, true, true, true]);
  });

  test("reels without audio get silence and an empty transcript without calling the transcriber", async () => {
    const ctx = context("file-text-only");
    await initReel(ctx, { kind: "file", path: silent });
    const before = transcriberCalls;
    await runPipeline(ctx, { force: false });
    expect(transcriberCalls).toBe(before);
    const written = JSON.parse(await readFile(ctx.paths.transcript, "utf8"));
    expect(written).toMatchObject({ provider: "none", words: [] });
    expect((await stat(ctx.paths.audio)).size).toBeGreaterThan(0);
  });

  test("names the stage to run when an input is missing", async () => {
    const ctx = context("file-fresh");
    await initReel(ctx, { kind: "file", path: withAudio });
    await expect(runStage(ctx, findStage("transcribe"), { force: false })).rejects.toThrow(
      'Run "reelcut stage audio file-fresh" first',
    );
  });

  test("does not rewrite reel.json when the source is unchanged", async () => {
    const ctx = context("file-talking");
    const before = (await stat(ctx.paths.reel)).mtimeMs;
    await initReel(ctx, { kind: "file", path: withAudio });
    expect((await stat(ctx.paths.reel)).mtimeMs).toBe(before);
  });
});
