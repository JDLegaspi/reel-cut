import { ReelSourceSchema } from "@reel/shared/schemas/source.ts";
import { z } from "zod";

export const RectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const ProjectSchema = z.object({
  version: z.literal(1),
  source: ReelSourceSchema,
  retakeWord: z.string().min(1),
  aggressive: z.boolean(),
});

export const SpeakerSchema = z.object({
  version: z.literal(1),
  crop: RectSchema.nullable(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Speaker = z.infer<typeof SpeakerSchema>;
