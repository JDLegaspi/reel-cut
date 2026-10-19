import { z } from "zod";

const wordIndex = z.number().int().nonnegative();

export const RevealSchema = z.object({
  key: z.string(),
  atWord: z.number().int(),
});

export const LAYOUTS = ["split", "full"] as const;

export const EmphasisSchema = z.object({
  atWord: z.number().int(),
  text: z.string(),
});

export const PlannedVisualSchema = z.object({
  layout: z.enum(LAYOUTS),
  template: z.string(),
  startWord: z.number().int(),
  endWord: z.number().int(),
  props: z.unknown(),
  reveals: z.array(RevealSchema),
  rationale: z.string(),
});

export const PlannerOutputSchema = z.object({
  segments: z.array(PlannedVisualSchema),
  emphasis: z.array(EmphasisSchema),
});

export const VisualSegmentSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("visual"),
    layout: z.enum(LAYOUTS),
    template: z.string(),
    startWord: wordIndex,
    endWord: wordIndex,
    props: z.record(z.string(), z.unknown()),
    reveals: z.array(RevealSchema),
    rationale: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("placeholder"),
    startWord: wordIndex,
    endWord: wordIndex,
    description: z.string().min(1),
    rationale: z.string(),
  }),
]);

export const DowngradedSchema = z.object({
  template: z.string(),
  startWord: z.number().int(),
  endWord: z.number().int(),
  reason: z.string(),
});

export const VisualPlanSchema = z.object({
  version: z.literal(1),
  segments: z.array(VisualSegmentSchema),
  emphasis: z.array(EmphasisSchema).default([]),
  downgraded: z.array(DowngradedSchema).default([]),
});

export type Reveal = z.infer<typeof RevealSchema>;
export type Layout = (typeof LAYOUTS)[number];
export type Emphasis = z.infer<typeof EmphasisSchema>;
export type PlannedVisual = z.infer<typeof PlannedVisualSchema>;
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;
export type VisualSegment = z.infer<typeof VisualSegmentSchema>;
export type Downgraded = z.infer<typeof DowngradedSchema>;
export type VisualPlan = z.infer<typeof VisualPlanSchema>;
