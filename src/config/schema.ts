import { z } from "zod";

export const ConfigSchema = z.object({
  paths: z.object({
    libraryDir: z.string(),
    ffmpeg: z.string(),
    ffprobe: z.string(),
    ytDlp: z.string(),
  }),
  download: z.object({
    cookiesFromBrowser: z.string().nullable(),
  }),
  frames: z.object({
    interval: z.number().positive(),
    maxFrames: z.number().int().positive(),
    width: z.number().int().positive(),
  }),
  transcription: z.object({
    model: z.string(),
    languageCode: z.string().nullable(),
    keyterms: z.array(z.string()),
  }),
});

export type ReelcutConfig = z.infer<typeof ConfigSchema>;
