import { z } from "zod";
import { EmphasisSchema, LAYOUTS, type PlannerOutput, RevealSchema } from "../schemas/visualPlan.ts";

export const ClaudePlanSchema = z.object({
  segments: z.array(
    z.object({
      layout: z.enum(LAYOUTS),
      template: z.string(),
      startWord: z.number().int(),
      endWord: z.number().int(),
      props: z.string().describe("the template's props as a JSON object, written as text"),
      reveals: z.array(RevealSchema),
      rationale: z.string(),
    }),
  ),
  emphasis: z.array(EmphasisSchema),
});

export type ClaudePlan = z.infer<typeof ClaudePlanSchema>;

function parseProps(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function fromClaudePlan(plan: ClaudePlan): PlannerOutput {
  return { ...plan, segments: plan.segments.map((segment) => ({ ...segment, props: parseProps(segment.props) })) };
}

export function toClaudePlan(plan: PlannerOutput): ClaudePlan {
  return {
    ...plan,
    segments: plan.segments.map((segment) => ({
      ...segment,
      props: typeof segment.props === "string" ? segment.props : JSON.stringify(segment.props),
    })),
  };
}
