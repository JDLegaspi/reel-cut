import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type Reference =
  | { kind: "website"; url: string }
  | { kind: "github"; owner: string; repo: string }
  | { kind: "reel"; url: string }
  | { kind: "image"; url: string }
  | { kind: "file-image"; path: string }
  | { kind: "file-video"; path: string };

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".mkv"];
const PAGE_EXTENSIONS = [".html", ".htm"];

function isReel(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "instagram.com") return /^\/(p|reel|reels)\//.test(url.pathname);
  if (host === "tiktok.com") return /^\/@[^/]+\/video\//.test(url.pathname);
  if (host === "youtube.com") return url.pathname.startsWith("/shorts/");
  return false;
}

function parseUrl(value: string): URL | null {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function classifyReference(value: string, exists: (path: string) => boolean): Reference {
  const url = parseUrl(value);
  if (url) {
    if (isReel(url)) return { kind: "reel", url: value };
    if (url.hostname.replace(/^www\./, "") === "github.com") {
      const [owner, repo] = url.pathname.split("/").filter(Boolean);
      if (!owner || !repo) throw new Error(`"${value}" is not a GitHub repo; pass github.com/<owner>/<repo> or the project's own website`);
      return { kind: "github", owner, repo: repo.replace(/\.git$/, "") };
    }
    if (IMAGE_EXTENSIONS.includes(extname(url.pathname).toLowerCase())) return { kind: "image", url: value };
    return { kind: "website", url: value };
  }
  if (!exists(value)) throw new Error(`"${value}" is not a URL and there is no such file`);
  const path = resolve(value);
  const extension = extname(value).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(extension)) return { kind: "file-image", path };
  if (VIDEO_EXTENSIONS.includes(extension)) return { kind: "file-video", path };
  if (PAGE_EXTENSIONS.includes(extension)) return { kind: "website", url: pathToFileURL(path).href };
  throw new Error(`"${value}" is not an image, a video or a web page`);
}
