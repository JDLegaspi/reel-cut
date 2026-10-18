const QUIET = ["-y", "-hide_banner", "-loglevel", "error"];

export function buildAudioExtractArgs(input: string, output: string): string[] {
  return [...QUIET, "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", output];
}

export function buildSilenceArgs(duration: number, output: string): string[] {
  return [
    ...QUIET,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=mono:sample_rate=16000",
    "-t",
    String(Math.max(duration, 0.1)),
    "-c:a",
    "pcm_s16le",
    output,
  ];
}

/** Seconds between sampled frames: the configured interval, widened so at most maxFrames are taken. */
export function frameInterval(duration: number, opts: { interval: number; maxFrames: number }): number {
  return Math.max(opts.interval, duration / opts.maxFrames);
}

export function buildFramesArgs(opts: {
  input: string;
  outputPattern: string;
  interval: number;
  maxFrames: number;
  width: number;
}): string[] {
  return [
    ...QUIET,
    "-i",
    opts.input,
    "-vf",
    `fps=1/${opts.interval},scale=${opts.width}:-2`,
    "-frames:v",
    String(opts.maxFrames),
    "-q:v",
    "4",
    opts.outputPattern,
  ];
}

export function buildRemuxArgs(input: string, output: string): string[] {
  return [...QUIET, "-i", input, "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-movflags", "+faststart", output];
}
