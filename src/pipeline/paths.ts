import { join } from "node:path";

export function projectPaths(dir: string) {
  return {
    dir,
    project: join(dir, "project.json"),
    source: join(dir, "source.mp4"),
    audio: join(dir, "audio.wav"),
    transcriptRaw: join(dir, "transcript.raw.json"),
    transcript: join(dir, "transcript.json"),
    cuts: join(dir, "cuts.json"),
    cut: join(dir, "cut.mp4"),
    transcriptCut: join(dir, "transcript.cut.json"),
    visualPlan: join(dir, "visual_plan.json"),
    final: join(dir, "final.mp4"),
    report: join(dir, "edit_report.md"),
  };
}

export type ProjectPaths = ReturnType<typeof projectPaths>;
