import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { downloadVideo } from "../src/download/ytdlp.ts";
import { createFakeYtDlp } from "../src/testing/fakeYtDlp.ts";

function hasFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasFfmpeg())("downloadVideo", () => {
  test("downloads via yt-dlp to the given paths and cleans up", async () => {
    const root = await mkdtemp(join(tmpdir(), "download-"));
    const clip = join(root, "clip.mp4");
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=25:duration=2",
      "-c:v", "libx264", clip,
    ]);
    const info = { webpage_url: "https://www.instagram.com/p/abc/", channel: "someone" };
    const ytDlp = await createFakeYtDlp(root, { video: clip, info });
    const dir = join(root, "reel");
    execFileSync("mkdir", [dir]);

    const returned = await downloadVideo({
      url: "https://www.instagram.com/p/abc/",
      videoOut: join(dir, "video.mp4"),
      infoOut: join(dir, "info.raw.json"),
      tools: { ffmpeg: "ffmpeg", ffprobe: "ffprobe", ytDlp },
      cookiesFromBrowser: null,
    });

    expect(returned).toEqual(info);
    expect(JSON.parse(await readFile(join(dir, "info.raw.json"), "utf8"))).toEqual(info);
    expect((await stat(join(dir, "video.mp4"))).size).toBeGreaterThan(0);
    expect((await readdir(dir)).sort()).toEqual(["info.raw.json", "video.mp4"]);
  });
});
