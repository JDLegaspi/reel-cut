import { z } from "zod";
import { DownloadSchema, ToolsSchema, TranscriptionSchema } from "@reel/shared/config/schema.ts";
import { FrameSettingsSchema } from "@reel/shared/frames/frames.ts";

export const X264_PRESETS = [
  "ultrafast",
  "superfast",
  "veryfast",
  "faster",
  "fast",
  "medium",
  "slow",
  "slower",
  "veryslow",
  "placebo",
] as const;

export const ConfigSchema = z.object({
  paths: z.object({
    projectsDir: z.string(),
    ...ToolsSchema.shape,
  }),
  video: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    crf: z.number().int().min(0).max(51),
    preset: z.enum(X264_PRESETS),
    audioBitrate: z.templateLiteral([z.number().int().positive(), z.enum(["k", "M"])]),
    audioSampleRate: z.number().int().positive(),
  }),
  download: DownloadSchema,
  transcription: TranscriptionSchema,
  frames: FrameSettingsSchema,
  retakes: z.object({
    retakeWord: z.string().min(1),
    aggressive: z.boolean(),
  }),
  visuals: z.object({
    leadMs: z.number().nonnegative(),
    minSegmentSeconds: z.number().positive(),
    minFaceSeconds: z.number().nonnegative(),
  }),
});

export type ReelcutConfig = z.infer<typeof ConfigSchema>;
