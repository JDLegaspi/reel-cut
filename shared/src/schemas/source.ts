import { z } from "zod";

export const ReelSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().url() }),
  z.object({ kind: z.literal("file"), path: z.string() }),
]);

export const ReelMetaSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  url: z.string().nullable(),
  author: z.string().nullable(),
  caption: z.string().nullable(),
  postedAt: z.string().nullable(),
  duration: z.number().nonnegative(),
  views: z.number().int().nullable(),
  likes: z.number().int().nullable(),
});

export type ReelSource = z.infer<typeof ReelSourceSchema>;
export type ReelMeta = z.infer<typeof ReelMetaSchema>;
