import type { Transcript } from "../schemas/transcript.ts";

export interface TranscriptionResult {
  raw: unknown;
  transcript: Transcript;
}

export interface Transcriber {
  transcribe(audioPath: string, opts: { duration: number }): Promise<TranscriptionResult>;
}
