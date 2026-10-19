import type { ReelcutConfig } from "./src/config/schema.ts";

const config: ReelcutConfig = {
  paths: {
    projectsDir: "projects",
    ffmpeg: "ffmpeg",
    ffprobe: "ffprobe",
    ytDlp: "yt-dlp",
  },
  video: {
    width: 1080,
    height: 1920,
    crf: 18,
    preset: "medium",
    audioBitrate: "192k",
    audioSampleRate: 48000,
  },
  download: {
    // e.g. "chrome" or "firefox" if Instagram asks for a login
    cookiesFromBrowser: null,
  },
  transcription: {
    model: "scribe_v2",
    languageCode: null,
    keyterms: [],
  },
  frames: {
    interval: 2,
    maxFrames: 24,
    width: 720,
  },
  retakes: {
    retakeWord: "again",
    aggressive: false,
  },
  visuals: {
    leadMs: 40,
    minSegmentSeconds: 1.5,
    minFaceSeconds: 1,
  },
};

export default config;
