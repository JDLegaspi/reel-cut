import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probe } from "@reel/shared/media/probe.ts";
import type { ReelSource } from "@reel/shared/schemas/source.ts";
import type { Transcript } from "@reel/shared/schemas/transcript.ts";
import { createFakeYtDlp } from "@reel/shared/testing/fakeYtDlp.ts";
import { createMockTranscriber } from "@reel/shared/transcribe/mock.ts";
import { beforeAll, describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import type { ReelcutConfig } from "../src/config/schema.ts";
import { createContext } from "../src/pipeline/context.ts";
import { findStage, initProject, runPipeline, runStage } from "../src/pipeline/runner.ts";

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function makeClip(output: string, opts: { size: string; audio: boolean; frequency?: number }) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `testsrc2=size=${opts.size}:rate=25:duration=2`,
    ...(opts.audio ? ["-f", "lavfi", "-i", `sine=frequency=${opts.frequency ?? 440}:duration=2`] : []),
    "-c:v", "libx264", ...(opts.audio ? ["-c:a", "aac", "-shortest"] : []), output,
  ]);
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

const options = { retakeWord: "again", aggressive: false };

describe.skipIf(!hasFfmpeg())("pipeline: download, ingest and transcribe", () => {
  let root: string;
  let input: string;
  let otherInput: string;
  let silent: string;
  let portrait: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "reelcut-e2e-"));
    input = join(root, "landscape.mp4");
    otherInput = join(root, "other.mp4");
    silent = join(root, "silent.mp4");
    portrait = join(root, "portrait.mp4");
    makeClip(input, { size: "1280x720", audio: true });
    makeClip(otherInput, { size: "1280x720", audio: true, frequency: 880 });
    makeClip(silent, { size: "1280x720", audio: false });
    makeClip(portrait, { size: "720x1280", audio: true });
  });

  function context(name: string, config: ReelcutConfig = loadConfig()) {
    return createContext({
      name,
      projectsRoot: join(root, "projects"),
      config,
      transcriber: () => createMockTranscriber(transcript),
      log: () => {},
    });
  }

  function fileSource(path: string): ReelSource {
    return { kind: "file", path };
  }

  test("produces a normalised 1080x1920 source, 16 kHz audio and transcript", async () => {
    const ctx = context("demo");
    await initProject(ctx, { source: fileSource(input), ...options });
    const reports = await runPipeline(ctx, { force: false });

    expect(reports.map((r) => [r.stage, r.ran])).toEqual([
      ["download", false],
      ["ingest", true],
      ["transcribe", true],
    ]);

    const source = await probe("ffprobe", ctx.paths.source);
    expect(source).toMatchObject({ width: 1080, height: 1920, fps: { num: 25, den: 1 }, hasAudio: true });

    const audio = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", ctx.paths.audio]).toString(),
    );
    expect(audio.streams[0]).toMatchObject({ sample_rate: "16000", channels: 1 });

    expect(JSON.parse(await readFile(ctx.paths.transcript, "utf8"))).toEqual(transcript);
    expect((await stat(ctx.paths.transcriptRaw)).size).toBeGreaterThan(0);
  });

  test("skips stages whose outputs are up to date", async () => {
    expect((await runPipeline(context("demo"), { force: false })).map((r) => r.ran)).toEqual([false, false, false]);
  });

  test("reruns everything with force", async () => {
    expect((await runPipeline(context("demo"), { force: true })).map((r) => r.ran)).toEqual([true, true, true]);
  });

  test("names the stage to run when an input is missing", async () => {
    const fresh = context("fresh");
    await initProject(fresh, { source: fileSource(input), ...options });
    await expect(runStage(fresh, findStage("transcribe"), { force: false })).rejects.toThrow(
      'Run "reelcut stage ingest fresh" first',
    );
  });

  test("does not rewrite project.json when options are unchanged", async () => {
    const ctx = context("demo");
    const before = (await stat(ctx.paths.project)).mtimeMs;
    await initProject(ctx, { source: fileSource(input), ...options });
    expect((await stat(ctx.paths.project)).mtimeMs).toBe(before);
  });

  test("downloads URL inputs before ingesting", async () => {
    const base = loadConfig();
    const ytDlp = await createFakeYtDlp(root, {
      video: portrait,
      info: { webpage_url: "https://www.instagram.com/p/abc/", channel: "someone" },
    });
    const ctx = context("ig-abc", { ...base, paths: { ...base.paths, ytDlp } });
    await initProject(ctx, { source: { kind: "url", url: "https://www.instagram.com/p/abc/" }, ...options });

    expect((await runPipeline(ctx, { force: false })).map((r) => [r.stage, r.ran])).toEqual([
      ["download", true],
      ["ingest", true],
      ["transcribe", true],
    ]);
    await access(ctx.paths.original);
    expect(JSON.parse(await readFile(ctx.paths.infoRaw, "utf8"))).toMatchObject({ channel: "someone" });
    expect(await probe("ffprobe", ctx.paths.source)).toMatchObject({ width: 1080, height: 1920 });
    expect((await runPipeline(ctx, { force: false })).map((r) => r.ran)).toEqual([false, false, false]);
  });

  test("rejects inputs without audio", async () => {
    const ctx = context("silent");
    await initProject(ctx, { source: fileSource(silent), ...options });
    await expect(runPipeline(ctx, { force: false })).rejects.toThrow("Input has no audio stream");
  });

  test("reruns ingest when the project's input changes", async () => {
    const ctx = context("swap");
    await initProject(ctx, { source: fileSource(input), ...options });
    await runPipeline(ctx, { force: false });

    await initProject(ctx, { source: fileSource(otherInput), ...options });
    const reports = await runPipeline(ctx, { force: false });
    expect(reports.find((r) => r.stage === "ingest")?.ran).toBe(true);
    expect(JSON.parse(await readFile(ctx.paths.project, "utf8")).source).toEqual(fileSource(otherInput));
  });
});
