import type { PageFacts } from "../pageFacts.ts";
import { readmeImages } from "../readme.ts";
import type { Reference } from "../references.ts";
import type { GatheredImage } from "./types.ts";
import type { WebsiteResult } from "./website.ts";

export type GithubDeps = {
  fetchJson(url: string): Promise<unknown>;
  fetchText(url: string): Promise<string>;
  gatherWebsite(url: string): Promise<WebsiteResult>;
  gatherImage(url: string, caption: string): Promise<GatheredImage | null>;
};

type Repo = { homepage?: string | null; owner?: { avatar_url?: string | null } };

export async function gatherGithub(
  ref: Extract<Reference, { kind: "github" }>,
  deps: GithubDeps,
): Promise<{ images: GatheredImage[]; facts: PageFacts | null }> {
  const api = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  const repo = (await deps.fetchJson(api)) as Repo;
  const readme = await deps.fetchText(`${api}/readme`).catch(() => "");

  const homepage = repo.homepage?.trim();
  const site = homepage && /^https?:\/\//i.test(homepage) ? await deps.gatherWebsite(homepage).catch(() => null) : null;
  const images: GatheredImage[] = [...(site?.images ?? [])];
  for (const url of readmeImages(readme, ref.owner, ref.repo)) {
    const image = await deps.gatherImage(url, `${ref.owner}/${ref.repo}, image from the README`);
    if (image) images.push(image);
  }
  if (repo.owner?.avatar_url) {
    const avatar = await deps.gatherImage(repo.owner.avatar_url, `${ref.owner}'s avatar on GitHub`);
    if (avatar) images.push(avatar);
  }
  return { images, facts: site?.facts ?? null };
}
