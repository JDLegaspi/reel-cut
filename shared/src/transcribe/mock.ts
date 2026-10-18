import type { Transcript } from "../schemas/transcript.ts";
import type { Transcriber } from "./Transcriber.ts";

export function createMockTranscriber(transcript: Transcript): Transcriber {
  return {
    async transcribe() {
      return { raw: { mock: true, transcript }, transcript };
    },
  };
}
