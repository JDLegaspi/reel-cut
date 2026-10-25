import { z } from "zod";
import { TEMPLATES } from "../../remotion/templates/registry.ts";

export function templateCatalog(): string {
  return TEMPLATES.map((template) => {
    const { $schema: _, ...props } = z.toJSONSchema(template.schema);
    return `- ${template.name}: ${template.description}\n  props: ${JSON.stringify(props)}`;
  }).join("\n");
}
