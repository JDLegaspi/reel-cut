import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { VoiceIsolator } from "./VoiceIsolator.ts";

export function createElevenLabsVoiceIsolator(): VoiceIsolator {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set. Add it to .env");
  const client = new ElevenLabsClient({ apiKey });

  return {
    async isolate(input, output) {
      const stream = await client.audioIsolation.convert(
        { audio: { data: await readFile(input), filename: basename(input), contentType: "audio/wav" } },
        { timeoutInSeconds: 900, maxRetries: 2 },
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      await writeFile(output, Buffer.concat(chunks));
    },
  };
}
