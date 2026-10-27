import type { Word } from "@reel/shared/schemas/transcript.ts";
import { BRANDS } from "../../remotion/templates/icons.tsx";
import { findTemplate, TEMPLATES } from "../../remotion/templates/registry.ts";
import type { Brand } from "../schemas/brands.ts";
import type { PlannedVisual, Reveal } from "../schemas/visualPlan.ts";
import { numbersIn } from "./numbers.ts";

const NUMBER_TOKEN = /\$?\d[\d,]*(?:\.\d+)?[kmbx%]?/gi;

type Visual = Pick<PlannedVisual, "template" | "startWord" | "endWord" | "props" | "reveals">;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function brandProblems(label: string, uses: { name: string; needs: "logo" | "site" }[], brands: Brand[]): string[] {
  return uses.flatMap(({ name, needs }) => {
    if (needs === "site") {
      const sites = brands.filter((brand) => brand.site).map((brand) => brand.name);
      return sites.some((site) => same(site, name)) ? [] : [`${label}: there is no website for "${name}"; websites: ${sites.join(", ") || "none"}`];
    }
    const logos = [...BRANDS, ...brands.filter((brand) => brand.logo).map((brand) => brand.name)];
    return logos.some((logo) => same(logo, name)) ? [] : [`${label}: there is no logo for "${name}"; logos: ${logos.join(", ")}`];
  });
}

export function contentProblems(segment: Visual, words: Word[], n: number, brands: Brand[] = []): string[] {
  const template = findTemplate(segment.template);
  if (!template) {
    return [`segment ${n}: unknown template "${segment.template}"; use one of ${TEMPLATES.map((t) => t.name).join(", ")}`];
  }
  const label = `segment ${n} (${template.name})`;
  const parsed = template.schema.safeParse(segment.props);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "props"}: ${issue.message}`);
    return [`${label}: props are invalid: ${issues.join("; ")}`];
  }

  const problems: string[] = brandProblems(label, template.brandsUsed(parsed.data), brands);
  const keys = template.revealKeys(parsed.data);
  const repeated = keys.find((key, k) => keys.indexOf(key) !== k);
  if (repeated) problems.push(`${label}: element keys must be unique; "${repeated}" is used twice`);

  let previous: Reveal | null = null;
  for (const reveal of segment.reveals) {
    if (!keys.includes(reveal.key)) {
      problems.push(`${label}: there is no element "${reveal.key}" to reveal; its elements are ${keys.join(", ")}`);
      continue;
    }
    if (reveal.atWord < segment.startWord || reveal.atWord > segment.endWord) {
      problems.push(
        `${label}: "${reveal.key}" is revealed on word ${reveal.atWord}, outside the segment (words ${segment.startWord}-${segment.endWord})`,
      );
      continue;
    }
    if (previous && reveal.atWord < previous.atWord) {
      problems.push(
        `${label}: reveals must follow the speech; "${reveal.key}" on word ${reveal.atWord} comes after "${previous.key}" on word ${previous.atWord}`,
      );
    }
    previous = reveal;
  }

  const said = numbersIn(
    words
      .slice(segment.startWord, segment.endWord + 1)
      .map((word) => word.text)
      .join(" "),
  );
  for (const value of template.spokenNumbers(parsed.data)) {
    if (!said.has(value)) problems.push(`${label}: ${value} is never said in this segment`);
  }
  for (const text of template.spokenTexts(parsed.data)) {
    for (const token of text.match(NUMBER_TOKEN) ?? []) {
      if (![...numbersIn(token)].some((value) => said.has(value))) {
        problems.push(`${label}: "${token}" in "${text}" is never said in this segment`);
      }
    }
  }
  return problems;
}
