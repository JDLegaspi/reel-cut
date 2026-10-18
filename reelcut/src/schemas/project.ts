import { ReelSourceSchema } from "@reel/shared/schemas/source.ts";
import { z } from "zod";

export const ProjectSchema = z.object({
  version: z.literal(1),
  source: ReelSourceSchema,
  retakeWord: z.string().min(1),
  aggressive: z.boolean(),
});

export type Project = z.infer<typeof ProjectSchema>;
