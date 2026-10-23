import { rm } from "node:fs/promises";
import { loadFrameImages } from "@reel/shared/frames/frames.ts";
import type { Stage } from "@reel/shared/pipeline/stage.ts";
import { TranscriptSchema, type Transcript } from "@reel/shared/schemas/transcript.ts";
import { readJson, writeJsonAtomic } from "@reel/shared/util/fs.ts";
import { contentProblems } from "../../plan/content.ts";
import { emphasisProblems } from "../../plan/emphasis.ts";
import { bulleted, segmentWindow, validatePlan, type VisualRules } from "../../plan/rules.ts";
import type { Downgraded, Emphasis, PlannedVisual, PlannerOutput, VisualPlan } from "../../schemas/visualPlan.ts";
import type { ReelcutContext } from "../context.ts";
import { readProject } from "../project.ts";

function emphasisCheck(transcript: Transcript, rules: VisualRules, segments: PlannedVisual[]) {
  return (word: Emphasis) =>
    emphasisProblems(word, { words: transcript.words, duration: transcript.duration, leadMs: rules.leadMs, segments });
}

function review(output: PlannerOutput, transcript: Transcript, rules: VisualRules) {
  const content = output.segments.map((segment, k) => contentProblems(segment, transcript.words, k + 1));
  const timing = validatePlan(output.segments, transcript.words, transcript.duration, rules);
  const emphasis = output.emphasis.flatMap(emphasisCheck(transcript, rules, output.segments));
  return { content, all: [...timing, ...content.flat(), ...emphasis] };
}

export const plan: Stage<ReelcutContext> = {
  name: "plan",
  inputs: async (ctx) => [ctx.paths.project, ctx.paths.transcript, ctx.paths.frames],
  outputs: async (ctx) => [ctx.paths.visualPlanRaw, ctx.paths.visualPlan],
  async run(ctx) {
    const transcript = await readJson(ctx.paths.transcript, TranscriptSchema);
    const frames = await loadFrameImages(ctx.paths.frames);
    const rules = ctx.config.visuals;
    const planner = ctx.planner();
    const { face } = await readProject(ctx);

    const first = await planner.plan({ transcript, frames, rules, face });
    const attempts = [first.raw];
    let output = first.output;
    let problems = review(output, transcript, rules);
    if (problems.all.length > 0) {
      ctx.log(`plan has ${problems.all.length} problem(s); asking for a corrected plan`);
      const second = await planner.plan({ transcript, frames, rules, face, retry: { previous: output, errors: problems.all } });
      attempts.push(second.raw);
      output = second.output;
      problems = review(output, transcript, rules);
    }
    await writeJsonAtomic(ctx.paths.visualPlanRaw, attempts);

    const kept: PlannedVisual[] = [];
    const downgraded: Downgraded[] = [];
    output.segments.forEach((segment, k) => {
      const reasons = problems.content[k] ?? [];
      if (reasons.length === 0) kept.push(segment);
      else downgraded.push({ template: segment.template, startWord: segment.startWord, endWord: segment.endWord, reason: reasons.join("; ") });
    });
    const timing = validatePlan(kept, transcript.words, transcript.duration, rules);
    if (timing.length > 0) {
      await rm(ctx.paths.visualPlan, { force: true });
      throw new Error(`The visual plan still breaks these rules after a retry:\n${bulleted(timing)}`);
    }

    const check = emphasisCheck(transcript, rules, kept);
    const emphasis = output.emphasis.filter((word) => check(word).length === 0);
    for (const word of output.emphasis) {
      const problems = check(word);
      if (problems.length > 0) ctx.log(`dropped ${problems.join("; ")}`);
    }

    const visualPlan: VisualPlan = {
      version: 1,
      segments: kept.map((segment, k) => ({
        id: `seg-${String(k + 1).padStart(2, "0")}`,
        kind: "visual",
        ...segment,
        props: segment.props as Record<string, unknown>,
      })),
      emphasis,
      downgraded,
    };
    await writeJsonAtomic(ctx.paths.visualPlan, visualPlan);

    const covered = kept.reduce((total, segment) => {
      const window = segmentWindow(segment, transcript.words, transcript.duration, rules.leadMs);
      return total + window.end - window.start;
    }, 0);
    ctx.log(`${kept.length} visuals covering ${covered.toFixed(1)}s of ${transcript.duration.toFixed(1)}s`);
    for (const dropped of downgraded) ctx.log(`dropped ${dropped.template} on words ${dropped.startWord}-${dropped.endWord}: ${dropped.reason}`);
  },
};
