import { TranscriptSchema, WordSchema } from "@reel/shared/schemas/transcript.ts";
import { z } from "zod";

export const REMOVAL_KINDS = ["retake", "retake-word", "false-start", "filler", "other"] as const;

export const WordRangeSchema = z.object({
  fromWord: z.number().int(),
  toWord: z.number().int(),
});

export const RemovalSchema = WordRangeSchema.extend({
  kind: z.enum(REMOVAL_KINDS),
  reason: z.string(),
});

export const CutsSchema = z.object({
  version: z.literal(1),
  retakeWord: z.string(),
  aggressive: z.boolean(),
  keep: z.array(WordRangeSchema).optional(),
  removed: z.array(RemovalSchema),
});

export const ClipsSchema = z.object({
  version: z.literal(1),
  clips: z.array(z.object({ path: z.string(), start: z.number().nonnegative(), end: z.number().nonnegative() })),
});

export const CutTranscriptSchema = TranscriptSchema.extend({
  fps: z.number().positive(),
  segments: z.array(
    z.object({
      srcStart: z.number().nonnegative(),
      srcEnd: z.number().nonnegative(),
      cutStart: z.number().nonnegative(),
      cutEnd: z.number().nonnegative(),
    }),
  ),
  words: z.array(WordSchema.extend({ srcI: z.number().int().nonnegative() })),
});

export type Removal = z.infer<typeof RemovalSchema>;
export type Cuts = z.infer<typeof CutsSchema>;
export type CutTranscript = z.infer<typeof CutTranscriptSchema>;
export type Clips = z.infer<typeof ClipsSchema>;
