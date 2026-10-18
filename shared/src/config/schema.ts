import { z } from "zod";

export const ToolsSchema = z.object({
  ffmpeg: z.string(),
  ffprobe: z.string(),
  ytDlp: z.string(),
});

export const DownloadSchema = z.object({
  cookiesFromBrowser: z.string().nullable(),
});

export const TranscriptionSchema = z.object({
  model: z.string(),
  languageCode: z.string().nullable(),
  keyterms: z.array(z.string()),
});

export type Tools = z.infer<typeof ToolsSchema>;
export type DownloadSettings = z.infer<typeof DownloadSchema>;
export type TranscriptionSettings = z.infer<typeof TranscriptionSchema>;
