import { describe, expect, test } from "vitest";
import { buildYtDlpArgs, metaFromInfo, reelIdFor, sourceFor } from "../src/download/ytdlp.ts";

describe("sourceFor / reelIdFor", () => {
  test.each([
    ["https://www.instagram.com/reel/C9xYz_-1/?igsh=abc", "ig-C9xYz_-1"],
    ["https://instagram.com/reels/C9xYz/", "ig-C9xYz"],
    ["https://www.instagram.com/seo.sam/reel/C9xYz/", "ig-C9xYz"],
    ["https://www.instagram.com/p/DAbc123/", "ig-DAbc123"],
  ])("Instagram %s → %s", (url, id) => {
    expect(reelIdFor(sourceFor(url))).toBe(id);
  });

  test("other URLs become a slug without the query string", () => {
    expect(reelIdFor(sourceFor("https://www.tiktok.com/@a.b/video/123?lang=en"))).toBe("tiktok-com-a-b-video-123");
  });

  test("local files are prefixed with file-", () => {
    expect(sourceFor("./clips/My Reel.MOV")).toEqual({ kind: "file", path: "./clips/My Reel.MOV" });
    expect(reelIdFor(sourceFor("./clips/My Reel.MOV"))).toBe("file-my-reel");
  });
});

describe("buildYtDlpArgs", () => {
  const base = { url: "https://x/reel/1", outputTemplate: "d/video.%(ext)s", ffmpeg: "ffmpeg", cookiesFromBrowser: null };

  test("writes an mp4 plus info.json to the template", () => {
    const args = buildYtDlpArgs(base);
    expect(args).toEqual(expect.arrayContaining(["--write-info-json", "--merge-output-format", "mp4", "-o", "d/video.%(ext)s"]));
    expect(args.at(-1)).toBe("https://x/reel/1");
    expect(args).not.toContain("--cookies-from-browser");
    expect(args).not.toContain("--ffmpeg-location");
  });

  test("passes browser cookies and an explicit ffmpeg path when configured", () => {
    const args = buildYtDlpArgs({ ...base, ffmpeg: "/opt/homebrew/bin/ffmpeg", cookiesFromBrowser: "chrome" });
    expect(args).toEqual(expect.arrayContaining(["--cookies-from-browser", "chrome", "--ffmpeg-location", "/opt/homebrew/bin/ffmpeg"]));
  });
});

describe("metaFromInfo", () => {
  test("normalises Instagram info.json", () => {
    const meta = metaFromInfo(
      "ig-C9xYz",
      "https://www.instagram.com/reel/C9xYz/?igsh=abc",
      {
        webpage_url: "https://www.instagram.com/reel/C9xYz/",
        uploader: "Sam | SEO",
        uploader_id: "seo.sam",
        description: "3 local SEO wins",
        timestamp: 1790000000,
        duration: 41,
        view_count: 1200,
        like_count: 88,
        unrelated: { nested: true },
      },
      41.23,
    );
    expect(meta).toEqual({
      version: 1,
      id: "ig-C9xYz",
      url: "https://www.instagram.com/reel/C9xYz/",
      author: "seo.sam",
      caption: "3 local SEO wins",
      postedAt: new Date(1790000000 * 1000).toISOString(),
      duration: 41.23,
      views: 1200,
      likes: 88,
    });
  });

  test("falls back to upload_date and tolerates missing fields", () => {
    const meta = metaFromInfo("x", "https://x", { upload_date: "20260930", description: null }, 10);
    expect(meta).toMatchObject({ url: "https://x", author: null, caption: null, postedAt: "2026-09-30T00:00:00.000Z" });
  });
});
