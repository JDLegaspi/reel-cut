import type { ComponentType } from "react";
import type { z } from "zod";

export type RevealFrames = Record<string, number>;

export interface TemplateProps<P> {
  props: P;
  at: RevealFrames;
}

export interface BrandUse {
  name: string;
  needs: "logo" | "site";
}

export interface Template {
  name: string;
  description: string;
  schema: z.ZodType;
  revealKeys(props: unknown): string[];
  spokenNumbers(props: unknown): number[];
  spokenTexts(props: unknown): string[];
  brandsUsed(props: unknown): BrandUse[];
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
  brandsUsed?: (props: z.infer<S>) => BrandUse[];
  example: z.infer<S>;
  Component: ComponentType<TemplateProps<z.infer<S>>>;
}): Template {
  const { spokenTexts, ...rest } = template;
  return {
    spokenNumbers: () => [],
    brandsUsed: () => [],
    ...rest,
    spokenTexts: (props: z.infer<S>) => (spokenTexts?.(props) ?? []).filter((text): text is string => text !== null),
  } as unknown as Template;
}
