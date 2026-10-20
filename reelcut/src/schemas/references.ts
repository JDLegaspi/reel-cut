import { z } from "zod";

export const REFERENCE_KINDS = ["website", "github", "reel", "image", "file-image", "file-video"] as const;

export const PageFactsSchema = z.object({
  colors: z.array(z.object({ hex: z.string(), share: z.number(), use: z.enum(["background", "text"]) })),
  variables: z.record(z.string(), z.string()),
  fonts: z.object({ body: z.string().nullable(), headings: z.string().nullable(), buttons: z.string().nullable() }),
});

export const GatheredReferenceSchema = z.object({
  source: z.string(),
  kind: z.enum(REFERENCE_KINDS).nullable(),
  images: z.array(z.object({ file: z.string(), caption: z.string() })),
  facts: PageFactsSchema.nullable(),
  error: z.string().nullable(),
});

export const ReferencesSchema = z.object({
  version: z.literal(1),
  references: z.array(GatheredReferenceSchema),
});

export const SourcesSchema = z.object({
  version: z.literal(1),
  sources: z.array(z.string().min(1)).min(1),
});

export type GatheredReference = z.infer<typeof GatheredReferenceSchema>;
export type References = z.infer<typeof ReferencesSchema>;
