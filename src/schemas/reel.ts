import { z } from "zod";

export const ReelSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().url() }),
  z.object({ kind: z.literal("file"), path: z.string() }),
]);

export const ReelSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  source: ReelSourceSchema,
});

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

export const FrameSchema = z.object({
  file: z.string(),
  t: z.number().nonnegative(),
});

export const FramesSchema = z.object({
  version: z.literal(1),
  interval: z.number().positive(),
  frames: z.array(FrameSchema),
});

export type ReelSource = z.infer<typeof ReelSourceSchema>;
export type Reel = z.infer<typeof ReelSchema>;
export type ReelMeta = z.infer<typeof ReelMetaSchema>;
export type Frames = z.infer<typeof FramesSchema>;
