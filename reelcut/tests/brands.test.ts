import type { Word } from "@reel/shared/schemas/transcript.ts";
import { describe, expect, test } from "vitest";
import { contentProblems } from "../src/plan/content.ts";
import { buildPlanMessages, planSystemPrompt } from "../src/plan/prompt.ts";
import { varietyProblems } from "../src/plan/variety.ts";
import type { PlannedVisual } from "../src/schemas/visualPlan.ts";

const words: Word[] = "I'm a lead designer here at Acme working with eBay".split(" ").map((text, i) => ({ i, text, start: i * 0.4, end: i * 0.4 + 0.3 }));
const brands = [
  { name: "Acme", url: "acme.com", logo: "brands/acme.svg", site: "brands/acme.webp" },
  { name: "Globex+", url: null, logo: "brands/globex.webp", site: null },
];

function visual(template: string, props: unknown): PlannedVisual {
  return { layout: "split", template, startWord: 0, endWord: words.length - 1, props, reveals: [], rationale: "company" };
}

describe("company brands", () => {
  test("shows a project brand's website", () => {
    expect(contentProblems(visual("Website", { brand: "Acme", caption: "Lead designer" }), words, 1, brands)).toEqual([]);
  });

  test("rejects a website for a brand with no screenshot, naming the ones that have one", () => {
    expect(contentProblems(visual("Website", { brand: "Globex+", caption: null }), words, 1, brands)).toEqual([
      'segment 1 (Website): there is no website for "Globex+"; websites: Acme',
    ]);
  });

  test("accepts built-in and project logos, and names an unknown one", () => {
    const logos = { brands: [{ key: "ebay", brand: "ebay" }, { key: "acme", brand: "Acme" }], label: null };
    expect(contentProblems(visual("Logos", logos), words, 1, brands)).toEqual([]);
    const unknown = { brands: [{ key: "initech", brand: "Initech" }], label: null };
    expect(contentProblems(visual("Logos", unknown), words, 1, brands)[0]).toMatch(/^segment 1 \(Logos\): there is no logo for "Initech"; logos: .*Acme, Globex\+/);
  });

  test("tells the planner which companies have a website or a logo", () => {
    const [message] = buildPlanMessages({ transcript: { version: 1, provider: "x", language: "en", duration: 5, words }, frames: [], brands });
    const text = JSON.stringify(message!.content);
    expect(text).toContain("Acme (website, logo)");
    expect(text).toContain("Globex+ (logo)");
  });
});

describe("variety", () => {
  test("limits any one template to a quarter of the visuals", () => {
    const plan = [...Array(6).fill("Concept"), "Stat", "Flow"].map((template) => ({ template }));
    expect(varietyProblems(plan)).toEqual(["Concept is used for 6 of 8 visuals; use it for at most 2 and pick templates that show what is said"]);
    expect(varietyProblems(["Concept", "Concept", "Stat"].map((template) => ({ template })))).toEqual([]);
  });

  test("asks for concrete full-screen visuals and literal counts", () => {
    const prompt = planSystemPrompt({ leadMs: 40, minSegmentSeconds: 1.5, minFaceSeconds: 1 });
    expect(prompt).toContain("Never a generic chart or word for an adjective");
    expect(prompt).toContain("show that many");
  });
});
