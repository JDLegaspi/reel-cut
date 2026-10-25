import { describe, expect, test } from "vitest";
import { TEMPLATES } from "../remotion/templates/registry.ts";
import { templateCatalog } from "../src/plan/catalog.ts";

describe("templateCatalog", () => {
  test("lists every template with its description and props schema", () => {
    const catalog = templateCatalog();
    for (const template of TEMPLATES) expect(catalog).toContain(`- ${template.name}: ${template.description}\n  props: {`);
  });
});
