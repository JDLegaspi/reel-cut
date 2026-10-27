import { join } from "node:path";

export function projectPaths(dir: string) {
  return {
    dir,
    project: join(dir, "project.json"),
    speaker: join(dir, "speaker.json"),
    style: join(dir, "style.json"),
    original: join(dir, "original.mp4"),
    infoRaw: join(dir, "info.raw.json"),
    source: join(dir, "source.mp4"),
    clips: join(dir, "clips.json"),
    voice: join(dir, "voice.wav"),
    transcriptRaw: join(dir, "transcript.raw.json"),
    transcript: join(dir, "transcript.json"),
    cutsRaw: join(dir, "cuts.raw.json"),
    cuts: join(dir, "cuts.json"),
    cut: join(dir, "cut.mp4"),
    cutTranscript: join(dir, "transcript.cut.json"),
    spellings: join(dir, "spellings.json"),
    brands: join(dir, "brands.json"),
    framesDir: join(dir, "frames"),
    frames: join(dir, "frames.json"),
    visualPlanRaw: join(dir, "visual_plan.raw.json"),
    visualPlan: join(dir, "visual_plan.json"),
    final: join(dir, "final.mp4"),
  };
}

export type ProjectPaths = ReturnType<typeof projectPaths>;
