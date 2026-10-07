import { z } from "zod";

export const ConfigSchema = z.object({
  paths: z.object({
    workDir: z.string(),
    ffmpeg: z.string(),
    ffprobe: z.string(),
  }),
  video: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    crf: z.number().int().min(0).max(51),
    preset: z.string(),
    audioBitrate: z.string(),
    audioSampleRate: z.number().int().positive(),
  }),
  transcription: z.object({
    model: z.string(),
    languageCode: z.string().nullable(),
    keyterms: z.array(z.string()),
  }),
  retakes: z.object({
    retakeWord: z.string().min(1),
    aggressive: z.boolean(),
  }),
});

export type ReelcutConfig = z.infer<typeof ConfigSchema>;
