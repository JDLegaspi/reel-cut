import { z } from "zod";

export const ProjectSchema = z.object({
  version: z.literal(1),
  input: z.string(),
  retakeWord: z.string().min(1),
  aggressive: z.boolean(),
});

export type Project = z.infer<typeof ProjectSchema>;
