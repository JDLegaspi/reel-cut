import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { createPipeline } from "../src/pipeline/runner.ts";
import type { BaseContext, Stage } from "../src/pipeline/stage.ts";

interface TestContext extends BaseContext {
  dir: string;
}

const a: Stage<TestContext> = {
  name: "a",
  inputs: async () => [],
  outputs: async (ctx) => [join(ctx.dir, "a.txt")],
  async run(ctx) {
    ctx.log("writing a");
    await writeFile(join(ctx.dir, "a.txt"), "a");
  },
};

const b: Stage<TestContext> = {
  name: "b",
  inputs: async (ctx) => [join(ctx.dir, "a.txt")],
  outputs: async (ctx) => [join(ctx.dir, "b.txt")],
  async run(ctx) {
    await writeFile(join(ctx.dir, "b.txt"), await readFile(join(ctx.dir, "a.txt"), "utf8"));
  },
};

const pipeline = createPipeline({ command: "tool", stages: [a, b] });

describe("createPipeline", () => {
  let ctx: TestContext;
  let logged: string[];

  beforeEach(async () => {
    logged = [];
    ctx = { name: "demo", dir: await mkdtemp(join(tmpdir(), "runner-")), log: (message) => logged.push(message) };
  });

  test("runs stages in order and skips up-to-date ones", async () => {
    expect((await pipeline.runPipeline(ctx, { force: false })).map((r) => [r.stage, r.ran])).toEqual([
      ["a", true],
      ["b", true],
    ]);
    expect((await pipeline.runPipeline(ctx, { force: false })).map((r) => [r.stage, r.ran])).toEqual([
      ["a", false],
      ["b", false],
    ]);
  });

  test("names the producing stage and the command when an input is missing", async () => {
    await expect(pipeline.runStage(ctx, b, { force: false })).rejects.toThrow('Run "tool stage a demo" first');
  });

  test("treats a stage with no outputs as up to date unless forced", async () => {
    const none: Stage<TestContext> = { name: "none", inputs: async () => [], outputs: async () => [], run: async () => {} };
    expect(await pipeline.runStage(ctx, none, { force: false })).toMatchObject({ ran: false, reason: "up to date" });
    expect(await pipeline.runStage(ctx, none, { force: true })).toMatchObject({ ran: true });
  });

  test("passes a stage-prefixed log to run", async () => {
    await pipeline.runStage(ctx, a, { force: false });
    expect(logged).toContain("[a] writing a");
  });

  test("findStage lists the stages when the name is unknown", () => {
    expect(() => pipeline.findStage("x")).toThrow('Unknown stage "x". Stages: a, b');
  });
});
