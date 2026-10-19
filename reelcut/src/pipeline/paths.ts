import { join } from "node:path";

export function projectPaths(dir: string) {
  return {
    dir,
    project: join(dir, "project.json"),
    speaker: join(dir, "speaker.json"),
    original: join(dir, "original.mp4"),
    infoRaw: join(dir, "info.raw.json"),
    source: join(dir, "source.mp4"),
    audio: join(dir, "audio.wav"),
    transcriptRaw: join(dir, "transcript.raw.json"),
    transcript: join(dir, "transcript.json"),
    framesDir: join(dir, "frames"),
    frames: join(dir, "frames.json"),
    visualPlanRaw: join(dir, "visual_plan.raw.json"),
    visualPlan: join(dir, "visual_plan.json"),
    final: join(dir, "final.mp4"),
  };
}

export type ProjectPaths = ReturnType<typeof projectPaths>;
