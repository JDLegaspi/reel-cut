import type { ReelcutConfig } from "./src/config/schema.ts";

const config: ReelcutConfig = {
  paths: {
    workDir: "work",
    ffmpeg: "ffmpeg",
    ffprobe: "ffprobe",
  },
  video: {
    width: 1080,
    height: 1920,
    crf: 18,
    preset: "medium",
    audioBitrate: "192k",
    audioSampleRate: 48000,
  },
  transcription: {
    model: "scribe_v2",
    languageCode: null,
    keyterms: [],
  },
  retakes: {
    retakeWord: "again",
    aggressive: false,
  },
};

export default config;
