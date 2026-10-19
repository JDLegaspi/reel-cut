import type { Word } from "@reel/shared/schemas/transcript.ts";
import { findTemplate, TEMPLATES } from "../../remotion/templates/registry.ts";
import type { PlannedVisual, Reveal } from "../schemas/visualPlan.ts";
import { numbersIn } from "./numbers.ts";

const NUMBER_TOKEN = /\$?\d[\d,]*(?:\.\d+)?[kmbx%]?/gi;

type Visual = Pick<PlannedVisual, "template" | "startWord" | "endWord" | "props" | "reveals">;

export function contentProblems(segment: Visual, words: Word[], n: number): string[] {
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

  const problems: string[] = [];
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
