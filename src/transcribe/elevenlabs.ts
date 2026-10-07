import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { ReelcutConfig } from "../config/schema.ts";
import { normalizeScribe } from "./normalizeScribe.ts";
import type { Transcriber } from "./Transcriber.ts";

export function createElevenLabsTranscriber(settings: ReelcutConfig["transcription"]): Transcriber {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set. Add it to .env");
  const client = new ElevenLabsClient({ apiKey });

  return {
    async transcribe(audioPath, { duration }) {
      const response = await client.speechToText.convert(
        {
          file: { data: await readFile(audioPath), filename: basename(audioPath), contentType: "audio/wav" },
          modelId: settings.model,
          languageCode: settings.languageCode ?? undefined,
          keyterms: settings.keyterms.length > 0 ? settings.keyterms : undefined,
          tagAudioEvents: false,
          timestampsGranularity: "word",
          noVerbatim: false,
        },
        { timeoutInSeconds: 600, maxRetries: 2 },
      );
      if (!("words" in response)) throw new Error("ElevenLabs returned an unexpected response shape (no words)");
      return {
        raw: response,
        transcript: normalizeScribe(response, duration, `elevenlabs/${settings.model}`),
      };
    },
  };
}
