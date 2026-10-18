import { join } from "node:path";

export function reelPaths(dir: string) {
  return {
    dir,
    reel: join(dir, "reel.json"),
    infoRaw: join(dir, "info.raw.json"),
    meta: join(dir, "meta.json"),
    video: join(dir, "video.mp4"),
    audio: join(dir, "audio.wav"),
    transcriptRaw: join(dir, "transcript.raw.json"),
    transcript: join(dir, "transcript.json"),
    framesDir: join(dir, "frames"),
    frames: join(dir, "frames.json"),
    notes: join(dir, "notes.json"),
  };
}

export type ReelPaths = ReturnType<typeof reelPaths>;
