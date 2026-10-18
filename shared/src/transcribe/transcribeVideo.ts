import { probe } from "../media/probe.ts";
import type { Log } from "../pipeline/stage.ts";
import type { Transcript } from "../schemas/transcript.ts";
import { writeJsonAtomic } from "../util/fs.ts";
import type { Transcriber } from "./Transcriber.ts";

export async function transcribeVideo(opts: {
  ffprobe: string;
  video: string;
  audio: string;
  transcriptRaw: string;
  transcript: string;
  transcriber: () => Transcriber;
  log: Log;
}): Promise<void> {
  const { duration, hasAudio } = await probe(opts.ffprobe, opts.video);
  if (!hasAudio) {
    const empty: Transcript = { version: 1, provider: "none", language: null, duration, words: [] };
    await writeJsonAtomic(opts.transcriptRaw, { skipped: "no audio stream" });
    await writeJsonAtomic(opts.transcript, empty);
    opts.log("no audio stream; wrote an empty transcript");
    return;
  }
  const { raw, transcript } = await opts.transcriber().transcribe(opts.audio, { duration });
  await writeJsonAtomic(opts.transcriptRaw, raw);
  await writeJsonAtomic(opts.transcript, transcript);
  opts.log(`${transcript.words.length} words, language ${transcript.language ?? "unknown"}`);
}
