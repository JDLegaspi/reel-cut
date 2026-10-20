import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import type { SheetRenderer } from "../src/render/Renderer.ts";
import type { Style } from "../src/schemas/style.ts";
import { createMockStyler } from "../src/style/mock.ts";
import { createStyleContext } from "../src/style/pipeline/context.ts";
import { initStyle, runStylePipeline } from "../src/style/pipeline/runner.ts";
import type { StylerInput } from "../src/style/Styler.ts";
import { LIGHT_STYLE } from "./fixtures/styles.ts";

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function makeLogo(path: string, color: string) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=white@0.0:s=300x300,format=rgba",
    "-vf", `drawbox=x=60:y=60:w=180:h=180:color=${color}@1:t=fill`,
    "-frames:v", "1", path,
  ]);
}

function fakeSheet(rendered: Style[]): SheetRenderer {
  return {
    async render(style, output) {
      rendered.push(style);
      await writeFile(output, "sheet");
    },
  };
}

const misspelt: Style = { ...LIGHT_STYLE, type: { ...LIGHT_STYLE.type, display: "Interr" } };

describe.skipIf(!hasFfmpeg())("style pipeline", () => {
  let root: string;
  let logo: string;
  let otherLogo: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "reelcut-styles-"));
    logo = join(root, "logo.png");
    otherLogo = join(root, "other.png");
    makeLogo(logo, "orange");
    makeLogo(otherLogo, "blue");
  });

  function context(name: string, opts: { outputs?: unknown[]; calls?: StylerInput[]; sheets?: Style[] } = {}) {
    return createStyleContext({
      name,
      stylesRoot: join(root, "styles"),
      config: loadConfig(),
      styler: () => createMockStyler(opts.outputs ?? [LIGHT_STYLE], opts.calls),
      sheet: () => fakeSheet(opts.sheets ?? []),
      log: () => {},
    });
  }

  test("makes a style from references, with its sheet", async () => {
    const calls: StylerInput[] = [];
    const sheets: Style[] = [];
    const ctx = context("brand", { calls, sheets });
    await initStyle(ctx, [logo]);
    const reports = await runStylePipeline(ctx, { force: false });

    expect(reports.map((report) => [report.stage, report.ran])).toEqual([
      ["gather", true],
      ["derive", true],
      ["sheet", true],
    ]);
    expect(JSON.parse(await readFile(ctx.paths.style, "utf8"))).toEqual(LIGHT_STYLE);
    expect(JSON.parse(await readFile(ctx.paths.styleRaw, "utf8"))).toHaveLength(1);
    expect(calls[0]!.images).toEqual([expect.objectContaining({ reference: 0, caption: "logo.png", mediaType: "image/png" })]);
    expect(sheets).toEqual([LIGHT_STYLE]);
    await access(ctx.paths.sheet);
  });

  test("keeps a hand-edited style until the references change", async () => {
    const ctx = context("brand", { outputs: [{ ...LIGHT_STYLE, notes: "Made again." }] });
    const edited = { ...LIGHT_STYLE, notes: "Edited by hand." };
    await writeFile(ctx.paths.style, JSON.stringify(edited));
    const later = new Date(Date.now() + 10000);
    await utimes(ctx.paths.style, later, later);

    expect((await runStylePipeline(ctx, { force: false })).map((report) => report.ran)).toEqual([false, false, true]);
    expect(JSON.parse(await readFile(ctx.paths.style, "utf8")).notes).toBe("Edited by hand.");

    await initStyle(ctx, [logo, otherLogo]);
    expect((await runStylePipeline(ctx, { force: false })).map((report) => report.ran)).toEqual([true, true, true]);
    expect(JSON.parse(await readFile(ctx.paths.style, "utf8")).notes).toBe("Made again.");
  });

  test("retries once with the problems", async () => {
    const calls: StylerInput[] = [];
    const ctx = context("retried", { outputs: [misspelt, LIGHT_STYLE], calls });
    await initStyle(ctx, [logo]);
    await runStylePipeline(ctx, { force: false });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.retry!.problems[0]).toContain('did you mean "Inter"');
    expect(calls[1]!.retry!.previous).toEqual(misspelt);
    expect(JSON.parse(await readFile(ctx.paths.styleRaw, "utf8"))).toHaveLength(2);
  });

  test("fails with the problems when the retried style still breaks a rule", async () => {
    const ctx = context("broken", { outputs: [misspelt] });
    await initStyle(ctx, [logo]);
    await expect(runStylePipeline(ctx, { force: false })).rejects.toThrow(
      /The style still breaks these rules after a retry:\n- type\.display: "Interr" is not a Google Font/,
    );
    await expect(access(ctx.paths.style)).rejects.toThrow();
  });
});
