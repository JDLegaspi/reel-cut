import { findTemplate } from "./templates/registry.ts";

export function TemplateView({ template, props, at }: { template: string; props: Record<string, unknown>; at: Record<string, number> }) {
  const definition = findTemplate(template);
  if (!definition) throw new Error(`Unknown template "${template}"`);
  return <definition.Component props={props} at={at} />;
}
