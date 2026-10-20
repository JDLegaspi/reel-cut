const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_IMAGE = /<img\b[^>]*?\ssrc=["']([^"']+)["']/gi;
const BADGE_HOSTS = ["img.shields.io", "badge.fury.io", "badgen.net", "codecov.io", "travis-ci.org", "travis-ci.com", "circleci.com", "app.netlify.com"];

function isBadge(url: URL): boolean {
  if (BADGE_HOSTS.includes(url.hostname)) return true;
  return /\/badge(\.svg)?$|\/badges?\//i.test(url.pathname);
}

function resolveImage(src: string, owner: string, repo: string): URL | null {
  if (src.startsWith("data:")) return null;
  const absolute = src.startsWith("//") ? `https:${src}` : src;
  if (/^https?:\/\//i.test(absolute)) {
    const url = new URL(absolute);
    const blob = url.hostname === "github.com" ? url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/) : null;
    return blob ? new URL(`https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}/${blob[4]}`) : url;
  }
  const path = absolute.replace(/^\.?\//, "");
  return new URL(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`);
}

export function readmeImages(markdown: string, owner: string, repo: string, max = 4): string[] {
  const found = [...markdown.matchAll(MARKDOWN_IMAGE), ...markdown.matchAll(HTML_IMAGE)].sort((a, b) => a.index - b.index);
  const images: string[] = [];
  for (const match of found) {
    const url = resolveImage(match[1]!, owner, repo);
    if (!url || isBadge(url)) continue;
    const href = url.href;
    if (!images.includes(href)) images.push(href);
    if (images.length === max) break;
  }
  return images;
}
