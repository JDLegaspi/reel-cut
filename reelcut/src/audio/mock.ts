import { copyFile } from "node:fs/promises";
import type { VoiceIsolator } from "./VoiceIsolator.ts";

export function createMockVoiceIsolator(calls: string[] = []): VoiceIsolator {
  return {
    async isolate(input, output) {
      calls.push(input);
      await copyFile(input, output);
    },
  };
}
