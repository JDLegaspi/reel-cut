import { readFile, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { commitTemp, readJson, tempPathFor, writeJsonAtomic } from "@reel/shared/util/fs.ts";
import { bulleted } from "../../plan/rules.ts";
import { ReferencesSchema, SourcesSchema, type References } from "../../schemas/references.ts";
import { styleProblems } from "../checks.ts";
import { gatherAll } from "../gather/index.ts";
import type { StylerImage } from "../Styler.ts";
import type { StyleContext } from "./context.ts";

export const gather: Stage<StyleContext> = {
  name: "gather",
  inputs: async (ctx) => [ctx.paths.sources],
  outputs: async (ctx) => [ctx.paths.references],
  async run(ctx) {
    const { sources } = await readJson(ctx.paths.sources, SourcesSchema);
    const references = await gatherAll(sources, ctx.paths, ctx.config);
    await writeJsonAtomic(ctx.paths.references, references);
    for (const reference of references.references) {
      if (reference.error) ctx.log(`${reference.source}: skipped (${reference.error})`);
      else ctx.log(`${reference.source}: ${reference.images.length} images${reference.facts ? ", plus colours and fonts from the page" : ""}`);
    }
  },
};

async function loadImages(dir: string, references: References, max: number): Promise<StylerImage[]> {
  const listed = references.references.flatMap((reference, k) => reference.images.map((image) => ({ ...image, reference: k })));
  return Promise.all(
    listed.slice(0, max).map(async (image) => ({
      reference: image.reference,
      caption: image.caption,
      mediaType: extname(image.file).toLowerCase() === ".png" ? ("image/png" as const) : ("image/jpeg" as const),
      data: await readFile(join(dir, image.file)),
    })),
  );
}

export const derive: Stage<StyleContext> = {
  name: "derive",
  inputs: async (ctx) => [ctx.paths.references],
  outputs: async (ctx) => [ctx.paths.styleRaw, ctx.paths.style],
  async run(ctx) {
    const references = await readJson(ctx.paths.references, ReferencesSchema);
    const images = await loadImages(ctx.paths.dir, references, ctx.config.styles.maxImages);
    const styler = ctx.styler();

    const first = await styler.style({ references, images });
    const attempts = [first.raw];
    let output = first.output;
    let checked = styleProblems(output);
    let problems = [...checked.errors, ...checked.contrast];
    if (problems.length > 0) {
      ctx.log(`style has ${problems.length} problem(s); asking for a corrected style`);
      const second = await styler.style({ references, images, retry: { previous: output, problems } });
      attempts.push(second.raw);
      output = second.output;
      checked = styleProblems(output);
      problems = [...checked.errors, ...checked.contrast];
    }
    await writeJsonAtomic(ctx.paths.styleRaw, attempts);

    if (problems.length > 0 || !checked.style) {
      await rm(ctx.paths.style, { force: true });
      throw new Error(`The style still breaks these rules after a retry:\n${bulleted(problems)}`);
    }
    await writeJsonAtomic(ctx.paths.style, checked.style);
    ctx.log(checked.style.notes);
  },
};

export const sheet: Stage<StyleContext> = {
  name: "sheet",
  inputs: async (ctx) => [ctx.paths.style],
  outputs: async (ctx) => [ctx.paths.sheet],
  async run(ctx) {
    const { errors, contrast, style } = styleProblems(JSON.parse(await readFile(ctx.paths.style, "utf8")));
    if (!style) throw new Error(`style.json breaks these rules:\n${bulleted(errors)}`);
    for (const warning of contrast) ctx.log(`warning: ${warning}`);
    const temp = tempPathFor(ctx.paths.sheet);
    await ctx.sheet().render(style, temp);
    await commitTemp(temp, ctx.paths.sheet);
  },
};
