import type { ReelcutConfig } from "./src/config/schema.ts";

const config: ReelcutConfig = {
  paths: {
    libraryDir: "library",
    ffmpeg: "ffmpeg",
    ffprobe: "ffprobe",
    ytDlp: "yt-dlp",
  },
  download: {
    // e.g. "chrome" or "firefox" if Instagram asks for a login
    cookiesFromBrowser: null,
  },
  frames: {
    interval: 2,
    maxFrames: 24,
    width: 720,
  },
  transcription: {
    model: "scribe_v2",
    languageCode: null,
    keyterms: [],
  },
};

export default config;
