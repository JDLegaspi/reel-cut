import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { checkStaleness } from "../src/pipeline/staleness.ts";

let dir: string;

async function touch(name: string, secondsAgo: number) {
  const path = join(dir, name);
  await writeFile(path, name);
  const t = new Date(Date.now() - secondsAgo * 1000);
  await utimes(path, t, t);
  return path;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "stale-"));
});

describe("checkStaleness", () => {
  test("runs when an output is missing", async () => {
    const input = await touch("in.json", 10);
    const result = await checkStaleness({ inputs: [input], outputs: [join(dir, "out.json")], force: false });
    expect(result).toEqual({ run: true, reason: expect.stringContaining("out.json") });
  });

  test("skips when every output is newer than every input", async () => {
    const input = await touch("in.json", 10);
    const output = await touch("out.json", 5);
    const result = await checkStaleness({ inputs: [input], outputs: [output], force: false });
    expect(result.run).toBe(false);
  });

  test("runs when an input was edited after the oldest output", async () => {
    const outA = await touch("a.json", 20);
    const outB = await touch("b.json", 5);
    const input = await touch("in.json", 10);
    const result = await checkStaleness({ inputs: [input], outputs: [outA, outB], force: false });
    expect(result).toEqual({ run: true, reason: expect.stringContaining("in.json") });
  });

  test("runs when forced even if fresh", async () => {
    const input = await touch("in.json", 10);
    const output = await touch("out.json", 5);
    const result = await checkStaleness({ inputs: [input], outputs: [output], force: true });
    expect(result).toEqual({ run: true, reason: "forced" });
  });

  test("throws when an input is missing", async () => {
    await expect(
      checkStaleness({ inputs: [join(dir, "nope.json")], outputs: [join(dir, "out.json")], force: false }),
    ).rejects.toThrow(/nope\.json/);
  });
});
