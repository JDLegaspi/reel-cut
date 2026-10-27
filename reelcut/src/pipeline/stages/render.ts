import { basename } from "node:path";
import { probe, rationalToNumber } from "@reel/shared/media/probe.ts";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { commitTemp, readJson, tempPathFor } from "@reel/shared/util/fs.ts";
import type { RenderProps } from "../../../remotion/props.ts";
import { contentProblems } from "../../plan/content.ts";
import { emphasisProblems } from "../../plan/emphasis.ts";
import { bulleted, validatePlan } from "../../plan/rules.ts";
import { buildRenderProps } from "../../render/props.ts";
import { VisualPlanSchema } from "../../schemas/visualPlan.ts";
import { resolveFontFiles } from "../../style/fonts.ts";
import type { ReelcutContext } from "../context.ts";
import { readProject, readSpeaker } from "../project.ts";
import { resolveProjectStyle, styleInputs } from "../style.ts";
import { readCutTranscript, spellingInputs } from "../words.ts";
import { brandInputs, readBrands } from "../brands.ts";

export async function renderPropsFor(ctx: ReelcutContext): Promise<RenderProps> {
  const transcript = await readCutTranscript(ctx);
  const plan = await readJson(ctx.paths.visualPlan, VisualPlanSchema);
  const info = await probe(ctx.config.paths.ffprobe, ctx.paths.cut);
  const speakerCrop = (await readSpeaker(ctx))?.crop ?? null;
  const { face } = await readProject(ctx);
  const { style, warnings } = await resolveProjectStyle(ctx);
  for (const warning of warnings) ctx.log(`warning: ${warning}`);
  const { video, visuals } = ctx.config;
  const words = transcript.words;
  const brands = await readBrands(ctx);

  const errors = [
    ...validatePlan(plan.segments, transcript.words, info.duration, visuals),
    ...plan.segments.flatMap((segment, k) => (segment.kind === "visual" ? contentProblems(segment, words, k + 1, brands) : [])),
    ...plan.emphasis.flatMap((word) =>
      emphasisProblems(word, { words, duration: info.duration, leadMs: visuals.leadMs, segments: plan.segments }),
    ),
  ];
  if (errors.length > 0) throw new Error(`visual_plan.json breaks these rules:\n${bulleted(errors)}`);

  return buildRenderProps({
    plan,
    words: transcript.words,
    duration: info.duration,
    fps: rationalToNumber(info.fps),
    width: video.width,
    height: video.height,
    leadMs: visuals.leadMs,
    video: basename(ctx.paths.cut),
    speakerCrop: speakerCrop ?? { x: 0, y: 0, width: info.width, height: info.height },
    style,
    fonts: await resolveFontFiles(style),
    face,
    brands,
  });
}

export const render: Stage<ReelcutContext> = {
  name: "render",
  inputs: async (ctx) => [
    ctx.paths.project,
    ctx.paths.cut,
    ctx.paths.cutTranscript,
    ctx.paths.visualPlan,
    ...((await readSpeaker(ctx)) ? [ctx.paths.speaker] : []),
    ...(await styleInputs(ctx)),
    ...(await spellingInputs(ctx)),
    ...(await brandInputs(ctx)),
  ],
  outputs: async (ctx) => [ctx.paths.final],
  async run(ctx) {
    const props = await renderPropsFor(ctx);
    const temp = tempPathFor(ctx.paths.final);
    await ctx.renderer().render({ props, publicDir: ctx.paths.dir, output: temp, video: ctx.config.video, log: ctx.log });
    await commitTemp(temp, ctx.paths.final);
  },
};
