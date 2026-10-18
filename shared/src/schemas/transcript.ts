import { z } from "zod";

export const WordSchema = z.object({
  i: z.number().int().nonnegative(),
  text: z.string().min(1),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
});

export const TranscriptSchema = z.object({
  version: z.literal(1),
  provider: z.string(),
  language: z.string().nullable(),
  duration: z.number().nonnegative(),
  words: z.array(WordSchema),
});

export type Word = z.infer<typeof WordSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;
