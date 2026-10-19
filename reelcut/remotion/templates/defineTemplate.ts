import type { ComponentType } from "react";
import type { z } from "zod";

export type RevealFrames = Record<string, number>;

export interface TemplateProps<P> {
  props: P;
  at: RevealFrames;
}

export interface Template {
  name: string;
  description: string;
  schema: z.ZodType;
  revealKeys(props: unknown): string[];
  spokenNumbers(props: unknown): number[];
  spokenTexts(props: unknown): string[];
  example: unknown;
  Component: ComponentType<TemplateProps<unknown>>;
}

export function defineTemplate<S extends z.ZodType>(template: {
  name: string;
  description: string;
  schema: S;
  revealKeys: (props: z.infer<S>) => string[];
  spokenNumbers?: (props: z.infer<S>) => number[];
  spokenTexts?: (props: z.infer<S>) => (string | null)[];
  example: z.infer<S>;
  Component: ComponentType<TemplateProps<z.infer<S>>>;
}): Template {
  const { spokenTexts, ...rest } = template;
  return {
    spokenNumbers: () => [],
    ...rest,
    spokenTexts: (props: z.infer<S>) => (spokenTexts?.(props) ?? []).filter((text): text is string => text !== null),
  } as unknown as Template;
}
