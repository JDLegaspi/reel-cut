import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { summarizeFacts, type PageSample } from "../src/style/pageFacts.ts";
import { readmeImages } from "../src/style/readme.ts";
import { classifyReference } from "../src/style/references.ts";

const files = new Set(["logo.png", "site.html", "clip.mov", "notes.txt"]);
const exists = (path: string) => files.has(path);

describe("classifyReference", () => {
  test.each([
    ["https://stripe.com", { kind: "website", url: "https://stripe.com" }],
    ["https://github.com/remotion-dev/remotion", { kind: "github", owner: "remotion-dev", repo: "remotion" }],
    ["https://github.com/remotion-dev/remotion/tree/main/packages", { kind: "github", owner: "remotion-dev", repo: "remotion" }],
    ["https://github.com/vercel/next.js.git", { kind: "github", owner: "vercel", repo: "next.js" }],
    ["https://www.instagram.com/p/DWysLjODhfW/", { kind: "reel", url: "https://www.instagram.com/p/DWysLjODhfW/" }],
    ["https://www.instagram.com/reel/DWysLjODhfW", { kind: "reel", url: "https://www.instagram.com/reel/DWysLjODhfW" }],
    ["https://www.tiktok.com/@someone/video/7312345678901234567", { kind: "reel", url: "https://www.tiktok.com/@someone/video/7312345678901234567" }],
    ["https://www.youtube.com/shorts/abc123", { kind: "reel", url: "https://www.youtube.com/shorts/abc123" }],
    ["https://example.com/brand/logo.SVG?v=2", { kind: "image", url: "https://example.com/brand/logo.SVG?v=2" }],
    ["logo.png", { kind: "file-image", path: resolve("logo.png") }],
    ["clip.mov", { kind: "file-video", path: resolve("clip.mov") }],
    ["site.html", { kind: "website", url: `file://${resolve("site.html")}` }],
  ])("%s", (value, expected) => {
    expect(classifyReference(value, exists)).toEqual(expected);
  });

  test("refuses GitHub pages that aren't a repo, since they only show GitHub's own style", () => {
    for (const value of ["https://github.com/vercel", "https://github.com", "https://www.github.com/"]) {
      expect(() => classifyReference(value, exists)).toThrow(`"${value}" is not a GitHub repo; pass github.com/<owner>/<repo> or the project's own website`);
    }
  });

  test("names a reference it can't use", () => {
    expect(() => classifyReference("brand-guide", exists)).toThrow('"brand-guide" is not a URL and there is no such file');
    expect(() => classifyReference("notes.txt", exists)).toThrow('"notes.txt" is not an image, a video or a web page');
  });
});

describe("readmeImages", () => {
  const readme = [
    "<p align=\"center\"><img src=\"packages/docs/static/img/logo.png\" width=\"200\"></p>",
    "[![npm](https://img.shields.io/npm/v/remotion.svg)](https://npm.im/remotion)",
    "![CI](https://github.com/remotion-dev/remotion/actions/workflows/ci.yml/badge.svg)",
    "![Banner](./assets/banner.jpg)",
    "![Again](packages/docs/static/img/logo.png)",
    "![Hosted](https://github.com/remotion-dev/remotion/blob/main/assets/demo.gif)",
    "![Elsewhere](https://cdn.example.com/brand.webp \"title\")",
  ].join("\n");

  test("finds logos and banners in order, resolved to raw files, without badges or repeats", () => {
    expect(readmeImages(readme, "remotion-dev", "remotion")).toEqual([
      "https://raw.githubusercontent.com/remotion-dev/remotion/HEAD/packages/docs/static/img/logo.png",
      "https://raw.githubusercontent.com/remotion-dev/remotion/HEAD/assets/banner.jpg",
      "https://raw.githubusercontent.com/remotion-dev/remotion/main/assets/demo.gif",
      "https://cdn.example.com/brand.webp",
    ]);
  });

  test("keeps only the first few", () => {
    expect(readmeImages(readme, "remotion-dev", "remotion", 2)).toHaveLength(2);
  });
});

describe("summarizeFacts", () => {
  const samples: PageSample[] = [
    { tag: "body", role: "body", background: "#ffffff", color: "#0a2540", area: 1_000_000, fontFamily: '"Söhne", "Helvetica Neue", sans-serif' },
    { tag: "section", role: "other", background: "rgb(10, 37, 64)", color: "rgb(255, 255, 255)", area: 400_000, fontFamily: "Söhne, sans-serif" },
    { tag: "h1", role: "heading", background: "transparent", color: "#0a2540", area: 60_000, fontFamily: "'Sohne Breit', serif" },
    { tag: "a", role: "button", background: "#635BFF", color: "#ffffff", area: 20_000, fontFamily: "-apple-system, system-ui, Inter" },
  ];

  test("weights colours by the area they cover and reads the main fonts", () => {
    const facts = summarizeFacts(samples, { "--brand": "#635bff", "--radius": "8px", "--ink": "rgb(10, 37, 64)" });
    expect(facts.colors.filter((c) => c.use === "background").map((c) => c.hex)).toEqual(["#ffffff", "#0a2540", "#635bff"]);
    expect(facts.colors.find((c) => c.use === "background" && c.hex === "#ffffff")!.share).toBeCloseTo(1_000_000 / 1_420_000, 3);
    expect(facts.colors.filter((c) => c.use === "text")[0]!.hex).toBe("#0a2540");
    expect(facts.variables).toEqual({ "--brand": "#635bff", "--ink": "#0a2540" });
    expect(facts.fonts).toEqual({ body: "Söhne", headings: "Sohne Breit", buttons: "Inter" });
  });
});
