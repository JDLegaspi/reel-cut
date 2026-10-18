import { join } from "node:path";

export function projectPaths(dir: string) {
  return {
    dir,
    project: join(dir, "project.json"),
    original: join(dir, "original.mp4"),
    infoRaw: join(dir, "info.raw.json"),
    source: join(dir, "source.mp4"),
    audio: join(dir, "audio.wav"),
    transcriptRaw: join(dir, "transcript.raw.json"),
    transcript: join(dir, "transcript.json"),
  };
}

export type ProjectPaths = ReturnType<typeof projectPaths>;
