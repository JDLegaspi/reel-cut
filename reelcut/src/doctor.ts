import { spawn } from "node:child_process";
import type { ReelcutConfig } from "./config/schema.ts";

export interface Check {
  name: string;
  ok: boolean;
  required: boolean;
  hint: string;
}

export type CanRun = (command: string, args: string[]) => Promise<boolean>;

export const canRun: CanRun = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });

export async function checkSetup(opts: {
  config: ReelcutConfig;
  env: Record<string, string | undefined>;
  canRun: CanRun;
}): Promise<Check[]> {
  const { paths } = opts.config;
  const tool = async (name: string, command: string, args: string[], required: boolean, hint: string): Promise<Check> => ({
    name,
    ok: await opts.canRun(command, args),
    required,
    hint,
  });
  const key = (name: string, hint: string): Check => ({ name, ok: Boolean(opts.env[name]), required: true, hint });
  return [
    await tool("ffmpeg", paths.ffmpeg, ["-version"], true, "brew install ffmpeg (macOS) or apt install ffmpeg (Linux), or set paths.ffmpeg in reel-cut.config.json"),
    await tool("ffprobe", paths.ffprobe, ["-version"], true, "comes with ffmpeg; or set paths.ffprobe in reel-cut.config.json"),
    await tool("yt-dlp", paths.ytDlp, ["--version"], false, "only needed for reel URLs: brew install yt-dlp or pip install yt-dlp"),
    key("ANTHROPIC_API_KEY", "get one at https://console.anthropic.com and put it in .env or your shell"),
    key("ELEVENLABS_API_KEY", "get one at https://elevenlabs.io and put it in .env or your shell"),
  ];
}
