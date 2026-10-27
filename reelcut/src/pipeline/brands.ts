import { access } from "node:fs/promises";
import { readJson } from "@reel/shared/util/fs.ts";
import { BrandsSchema, type Brand } from "../schemas/brands.ts";
import type { ReelcutContext } from "./context.ts";

export async function brandInputs(ctx: ReelcutContext): Promise<string[]> {
  return access(ctx.paths.brands).then(
    () => [ctx.paths.brands],
    () => [],
  );
}

export async function readBrands(ctx: ReelcutContext): Promise<Brand[]> {
  return (await brandInputs(ctx)).length > 0 ? (await readJson(ctx.paths.brands, BrandsSchema)).brands : [];
}
