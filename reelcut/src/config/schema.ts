import { z } from "zod";
import { DownloadSchema, ToolsSchema, TranscriptionSchema } from "@reel/shared/config/schema.ts";

export const ConfigSchema = z.object({
  paths: z.object({
    projectsDir: z.string(),
    ...ToolsSchema.shape,
  }),
  video: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    crf: z.number().int().min(0).max(51),
    preset: z.string(),
    audioBitrate: z.string(),
    audioSampleRate: z.number().int().positive(),
  }),
  download: DownloadSchema,
  transcription: TranscriptionSchema,
  retakes: z.object({
    retakeWord: z.string().min(1),
    aggressive: z.boolean(),
  }),
});

export type ReelcutConfig = z.infer<typeof ConfigSchema>;
