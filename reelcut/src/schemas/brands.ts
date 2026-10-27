import { z } from "zod";

export const BrandSchema = z.object({
  name: z.string().min(1),
  url: z.string().nullable(),
  logo: z.string().nullable().describe("path of a logo image inside the project folder"),
  site: z.string().nullable().describe("path of a website screenshot inside the project folder"),
});

export const BrandsSchema = z.object({ version: z.literal(1), brands: z.array(BrandSchema) });

export type Brand = z.infer<typeof BrandSchema>;
