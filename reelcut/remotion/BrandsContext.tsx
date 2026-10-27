import { createContext, useContext, type ReactNode } from "react";
import type { Brand } from "../src/schemas/brands.ts";

const BrandsContext = createContext<Brand[]>([]);

export function BrandsProvider({ brands, children }: { brands: Brand[]; children: ReactNode }) {
  return <BrandsContext.Provider value={brands}>{children}</BrandsContext.Provider>;
}

export function useBrand(name: string): Brand | undefined {
  return useContext(BrandsContext).find((brand) => brand.name.toLowerCase() === name.toLowerCase());
}
