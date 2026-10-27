import { ReelSourceSchema } from "@reel/shared/schemas/source.ts";
import { z } from "zod";

export const RectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

function singleSourceAsClips(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("source" in value)) return value;
  const { source, ...rest } = value as { source: unknown };
  return { ...rest, sources: [source] };
}

export const ProjectSchema = z.preprocess(singleSourceAsClips, z.object({
  version: z.literal(1),
  sources: z.array(ReelSourceSchema).min(1),
  retakeWord: z.string().min(1),
  aggressive: z.boolean(),
  face: z.boolean().default(true),
  isolateVoice: z.boolean().default(false),
}));

export const SpeakerSchema = z.object({
  version: z.literal(1),
  crop: RectSchema.nullable(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Speaker = z.infer<typeof SpeakerSchema>;
