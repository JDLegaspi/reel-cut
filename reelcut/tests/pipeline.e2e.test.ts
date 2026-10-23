import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probe } from "@reel/shared/media/probe.ts";
import type { ReelSource } from "@reel/shared/schemas/source.ts";
import type { Transcript } from "@reel/shared/schemas/transcript.ts";
import { createFakeYtDlp } from "@reel/shared/testing/fakeYtDlp.ts";
import { createMockTranscriber } from "@reel/shared/transcribe/mock.ts";
import { beforeAll, describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { createMockPlanner } from "../src/plan/mock.ts";
import type { PlanInput } from "../src/plan/Planner.ts";
import type { RenderJob, Renderer } from "../src/render/Renderer.ts";
import type { ReelcutConfig } from "../src/config/schema.ts";
import { createContext } from "../src/pipeline/context.ts";
import { findStage, initProject, runPipeline, runStage } from "../src/pipeline/runner.ts";
import type { PlannerOutput, VisualPlan } from "../src/schemas/visualPlan.ts";
import type { ProjectStyle, Style } from "../src/schemas/style.ts";
import { DEFAULT_STYLE } from "../src/style/default.ts";
import { LIGHT_STYLE } from "./fixtures/styles.ts";

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

const options = { retakeWord: "again", aggressive: false, speakerCrop: null };

const noVisuals: PlannerOutput = { segments: [], emphasis: [] };
const titleCard = { position: null, title: "Hello world", subtitle: null, icon: "hand", badges: [] };
const wholeClip: PlannerOutput = {
  segments: [
    {
      layout: "split",
      template: "Countdown",
      startWord: 0,
      endWord: 1,
      props: titleCard,
      reveals: [{ key: "title", atWord: 1 }],
      rationale: "opening line",
    },
  ],
  emphasis: [],
};
const tooShort: PlannerOutput = {
  segments: [{ layout: "split", template: "Countdown", startWord: 0, endWord: 0, props: titleCard, reveals: [], rationale: "opening line" }],
  emphasis: [],
};
const unsaidNumber: PlannerOutput = {
  segments: [
    {
      layout: "full",
      template: "Stat",
      startWord: 0,
      endWord: 1,
      props: { value: 40, prefix: null, suffix: null, label: "views", icon: "eye", trend: "none" },
      reveals: [],
      rationale: "stat",
    },
  ],
  emphasis: [],
};

function fakeRenderer(jobs: RenderJob[] = []): Renderer {
  return {
    async render(job) {
      jobs.push(job);
      await writeFile(job.output, "rendered");
    },
  };
}

describe.skipIf(!hasFfmpeg())("pipeline", () => {
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

  function context(
    name: string,
    opts: { config?: ReelcutConfig; plans?: PlannerOutput[]; planCalls?: PlanInput[]; renders?: RenderJob[]; logs?: string[] } = {},
  ) {
    return createContext({
      name,
      projectsRoot: join(root, "projects"),
      stylesRoot: join(root, "styles"),
      config: opts.config ?? loadConfig(),
      transcriber: () => createMockTranscriber(transcript),
      planner: () => createMockPlanner(opts.plans ?? [noVisuals], opts.planCalls),
      renderer: () => fakeRenderer(opts.renders),
      log: (message) => opts.logs?.push(message),
    });
  }

  async function writeStyle(name: string, style: Style) {
    await mkdir(join(root, "styles", name), { recursive: true });
    const path = join(root, "styles", name, "style.json");
    await writeFile(path, JSON.stringify(style));
    const later = new Date(Date.now() + 10000);
    await utimes(path, later, later);
  }

  async function editProjectStyle(path: string, edit: (style: ProjectStyle) => ProjectStyle, seconds: number) {
    const current: ProjectStyle = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify(edit(current)));
    const later = new Date(Date.now() + seconds * 1000);
    await utimes(path, later, later);
  }

  function ranStages(reports: { stage: string; ran: boolean }[]) {
    return reports.filter((report) => report.ran).map((report) => report.stage);
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
      ["frames", true],
      ["plan", true],
      ["render", true],
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
    expect((await runPipeline(context("demo"), { force: false })).map((r) => r.ran)).toEqual([false, false, false, false, false, false]);
  });

  test("reruns everything with force", async () => {
    expect((await runPipeline(context("demo"), { force: true })).map((r) => r.ran)).toEqual([true, true, true, true, true, true]);
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
    const ctx = context("ig-abc", { config: { ...base, paths: { ...base.paths, ytDlp } } });
    await initProject(ctx, { source: { kind: "url", url: "https://www.instagram.com/p/abc/" }, ...options });

    expect((await runPipeline(ctx, { force: false })).map((r) => [r.stage, r.ran])).toEqual([
      ["download", true],
      ["ingest", true],
      ["transcribe", true],
      ["frames", true],
      ["plan", true],
      ["render", true],
    ]);
    await access(ctx.paths.original);
    expect(JSON.parse(await readFile(ctx.paths.infoRaw, "utf8"))).toMatchObject({ channel: "someone" });
    expect(await probe("ffprobe", ctx.paths.source)).toMatchObject({ width: 1080, height: 1920 });
    expect((await runPipeline(ctx, { force: false })).map((r) => r.ran)).toEqual([false, false, false, false, false, false]);
  });

  test("runs a voice-only project from an mp3", async () => {
    const mp3 = join(root, "voice.mp3");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", mp3]);
    const ctx = context("voice");
    await initProject(ctx, { source: fileSource(mp3), ...options, face: false });
    for (const stage of ["ingest", "transcribe", "frames"]) await runStage(ctx, findStage(stage), { force: false });

    expect(await probe("ffprobe", ctx.paths.source)).toMatchObject({ width: 1080, height: 1920, hasAudio: true });
    expect(JSON.parse(await readFile(ctx.paths.frames, "utf8"))).toEqual({ version: 1, frames: [] });
  });

  test("tells the planner a voice-only project has no face", async () => {
    const planCalls: PlanInput[] = [];
    await runStage(context("voice", { planCalls }), findStage("plan"), { force: false });
    expect(planCalls[0]?.face).toBe(false);
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

  test("plans visuals and hands them to the renderer on the video's frame grid", async () => {
    const renders: RenderJob[] = [];
    const ctx = context("planned", { plans: [wholeClip], renders });
    await initProject(ctx, { source: fileSource(input), ...options });
    await runPipeline(ctx, { force: false });

    expect(JSON.parse(await readFile(ctx.paths.visualPlan, "utf8"))).toEqual({
      version: 1,
      segments: [
        {
          id: "seg-01",
          kind: "visual",
          layout: "split",
          template: "Countdown",
          startWord: 0,
          endWord: 1,
          props: titleCard,
          reveals: [{ key: "title", atWord: 1 }],
          rationale: "opening line",
        },
      ],
      emphasis: [],
      downgraded: [],
    });
    expect(renders).toHaveLength(1);
    const [job] = renders;
    expect(job!.publicDir).toBe(ctx.paths.dir);
    expect(job!.props).toMatchObject({
      video: "source.mp4",
      width: 1080,
      height: 1920,
      fps: 25,
      speakerCrop: { x: 0, y: 0, width: 1080, height: 1920 },
    });
    expect(job!.props.segments).toEqual([
      {
        kind: "visual",
        layout: "split",
        id: "seg-01",
        from: 4,
        durationInFrames: job!.props.durationInFrames - 4,
        template: "Countdown",
        props: titleCard,
        at: { title: 10 },
      },
    ]);
    expect(await readFile(ctx.paths.final, "utf8")).toBe("rendered");
  });

  test("sends a plan that breaks a rule back to the planner once, with the problems", async () => {
    const planCalls: PlanInput[] = [];
    const ctx = context("retried", { plans: [tooShort, wholeClip], planCalls });
    await initProject(ctx, { source: fileSource(input), ...options });
    await runPipeline(ctx, { force: false });

    expect(planCalls).toHaveLength(2);
    expect(planCalls[0]!.frames.length).toBeGreaterThan(0);
    expect(planCalls[0]!.frames[0]).toMatchObject({ t: 0 });
    expect(planCalls[0]!.frames[0]!.data.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(planCalls[1]!.retry).toEqual({
      previous: tooShort,
      errors: ["segment 1 is on screen for 0.4s; a visual needs at least 1.5s"],
    });
    const plan: VisualPlan = JSON.parse(await readFile(ctx.paths.visualPlan, "utf8"));
    expect(plan.segments.map((s) => [s.startWord, s.endWord])).toEqual([[0, 1]]);
  });

  test("fails with the problems when the retried plan still breaks a rule", async () => {
    const ctx = context("unfixable", { plans: [tooShort, tooShort] });
    await initProject(ctx, { source: fileSource(input), ...options });
    await expect(runPipeline(ctx, { force: false })).rejects.toThrow(
      "segment 1 is on screen for 0.4s; a visual needs at least 1.5s",
    );
  });

  test("keeps a hand-edited plan and renders it again", async () => {
    const renders: RenderJob[] = [];
    const ctx = context("planned", { plans: [noVisuals], renders });
    const plan: VisualPlan = JSON.parse(await readFile(ctx.paths.visualPlan, "utf8"));
    const segment = plan.segments[0]!;
    if (segment.kind !== "visual") throw new Error("expected a visual segment");
    segment.props = { ...segment.props, title: "Edited card" };
    await writeFile(ctx.paths.visualPlan, JSON.stringify(plan));
    const later = new Date(Date.now() + 5000);
    await utimes(ctx.paths.visualPlan, later, later);

    const reports = await runPipeline(ctx, { force: false });
    expect(reports.map((r) => [r.stage, r.ran])).toEqual([
      ["download", false],
      ["ingest", false],
      ["transcribe", false],
      ["frames", false],
      ["plan", false],
      ["render", true],
    ]);
    expect(renders[0]!.props.segments[0]).toMatchObject({ props: { title: "Edited card" } });
  });

  test("drops a visual that still shows an unsaid number after the retry, and records why", async () => {
    const renders: RenderJob[] = [];
    const planCalls: PlanInput[] = [];
    const ctx = context("unsaid", { plans: [unsaidNumber, unsaidNumber], planCalls, renders });
    await initProject(ctx, { source: fileSource(input), ...options });
    await runPipeline(ctx, { force: false });

    const reason = "segment 1 (Stat): 40 is never said in this segment";
    expect(planCalls[1]!.retry?.errors).toEqual([reason]);
    const plan: VisualPlan = JSON.parse(await readFile(ctx.paths.visualPlan, "utf8"));
    expect(plan.segments).toEqual([]);
    expect(plan.downgraded).toEqual([{ template: "Stat", startWord: 0, endWord: 1, reason }]);
    expect(renders[0]!.props.segments).toEqual([]);
  });

  test("shows the speaker from the project's speaker crop", async () => {
    const renders: RenderJob[] = [];
    const ctx = context("cropped", { renders });
    const speakerCrop = { x: 0, y: 0, width: 1080, height: 960 };
    await initProject(ctx, { source: fileSource(input), ...options, speakerCrop });
    await runPipeline(ctx, { force: false });
    expect(renders[0]!.props.speakerCrop).toEqual(speakerCrop);

    const { speakerCrop: _, ...withoutCrop } = options;
    await initProject(ctx, { source: fileSource(input), ...withoutCrop });
    expect((await runPipeline(ctx, { force: false })).every((report) => !report.ran)).toBe(true);

    await initProject(ctx, { source: fileSource(input), ...options, speakerCrop: { x: 0, y: 960, width: 1080, height: 960 } });
    const reports = await runPipeline(ctx, { force: false });
    expect(reports.filter((report) => report.ran).map((report) => report.stage)).toEqual(["render"]);
    expect(renders.at(-1)!.props.speakerCrop).toEqual({ x: 0, y: 960, width: 1080, height: 960 });
  });

  test("keeps emphasis words said on the speaker's shots and drops the rest after the retry", async () => {
    const renders: RenderJob[] = [];
    const planCalls: PlanInput[] = [];
    const plans: PlannerOutput[] = [
      { segments: [], emphasis: [{ atWord: 1, text: "World" }, { atWord: 0, text: "goodbye" }] },
    ];
    const ctx = context("emphasis", { plans, planCalls, renders });
    await initProject(ctx, { source: fileSource(input), ...options });
    await runPipeline(ctx, { force: false });

    expect(planCalls[1]!.retry?.errors).toEqual(['emphasis "goodbye" on word 0 doesn\'t match what is said there ("hello")']);
    const plan: VisualPlan = JSON.parse(await readFile(ctx.paths.visualPlan, "utf8"));
    expect(plan.emphasis).toEqual([{ atWord: 1, text: "World" }]);
    expect(renders[0]!.props.emphasis).toEqual([{ from: 14, durationInFrames: 20, text: "World" }]);
  });

  test("refuses to render a hand-edited plan that breaks a rule", async () => {
    const ctx = context("planned");
    const plan: VisualPlan = JSON.parse(await readFile(ctx.paths.visualPlan, "utf8"));
    plan.segments[0]!.endWord = 0;
    await writeFile(ctx.paths.visualPlan, JSON.stringify(plan));
    const later = new Date(Date.now() + 10000);
    await utimes(ctx.paths.visualPlan, later, later);

    await expect(runStage(ctx, findStage("render"), { force: false })).rejects.toThrow(
      "visual_plan.json breaks these rules:\n- segment 1 is on screen for 0.4s",
    );
  });

  test("renders in the built-in style when the project has none", async () => {
    const renders: RenderJob[] = [];
    const ctx = context("unstyled", { renders });
    await initProject(ctx, { source: fileSource(input), ...options });
    await runPipeline(ctx, { force: false });
    expect(renders[0]!.props.style).toEqual(DEFAULT_STYLE);
    expect(renders[0]!.props.fonts.length).toBeGreaterThan(0);
  });

  test("renders in the chosen style with the project's overrides on top, re-rendering only", async () => {
    const renders: RenderJob[] = [];
    const ctx = context("styled", { renders });
    await writeStyle("brand", LIGHT_STYLE);
    await initProject(ctx, { source: fileSource(input), ...options, style: "brand" });
    await runPipeline(ctx, { force: false });
    expect(JSON.parse(await readFile(ctx.paths.style, "utf8"))).toEqual({ version: 1, base: "brand", overrides: {} });
    expect(renders.at(-1)!.props.style).toEqual(LIGHT_STYLE);
    expect(renders.at(-1)!.props.fonts.map((font) => font.family)).toContain("Space Grotesk");

    await editProjectStyle(ctx.paths.style, (style) => ({ ...style, overrides: { palette: { accent: "#123456" } } }), 20);
    expect(ranStages(await runPipeline(ctx, { force: false }))).toEqual(["render"]);
    expect(renders.at(-1)!.props.style.palette).toEqual({ ...LIGHT_STYLE.palette, accent: "#123456" });

    await initProject(ctx, { source: fileSource(input), ...options, style: "brand" });
    expect(JSON.parse(await readFile(ctx.paths.style, "utf8")).overrides).toEqual({ palette: { accent: "#123456" } });
  });

  test("re-renders when the base style changes and nothing else", async () => {
    const renders: RenderJob[] = [];
    const ctx = context("styled", { renders });
    const later = new Date(Date.now() + 30000);
    await writeStyle("brand", { ...LIGHT_STYLE, notes: "Edited by hand." });
    await utimes(join(root, "styles", "brand", "style.json"), later, later);
    expect(ranStages(await runPipeline(ctx, { force: false }))).toEqual(["render"]);
    expect(renders.at(-1)!.props.style.notes).toBe("Edited by hand.");
  });

  test("renders with a warning when only the contrast of a hand edit fails", async () => {
    const logs: string[] = [];
    const ctx = context("styled", { logs });
    await editProjectStyle(ctx.paths.style, (style) => ({ ...style, overrides: { palette: { onSurface: "#eeeeee" } } }), 40);
    await runStage(ctx, findStage("render"), { force: false });
    expect(logs.some((line) => line.includes("warning:") && line.includes("palette.onSurface"))).toBe(true);
  });

  test("fails on a broken hand-edited style, naming the setting", async () => {
    const ctx = context("styled");
    await editProjectStyle(ctx.paths.style, (style) => ({ ...style, overrides: { palette: { accent: "yellow" } } }), 50);
    await expect(runStage(ctx, findStage("render"), { force: false })).rejects.toThrow(/style\.json breaks these rules:\n- overrides\.palette\.accent: must be a colour/);
  });

  test("names a missing style and how to make it", async () => {
    const ctx = context("styled");
    await editProjectStyle(ctx.paths.style, (style) => ({ ...style, overrides: {} }), 0);
    await initProject(ctx, { source: fileSource(input), ...options, style: "missing" });
    await editProjectStyle(ctx.paths.style, (style) => style, 60);
    await expect(runStage(ctx, findStage("render"), { force: false })).rejects.toThrow(
      'Style "missing" does not exist. Make it with: reelcut style create missing --from <reference>',
    );
  });
});
