import { createContext, useContext, type ReactNode } from "react";
import type { Style } from "../../src/schemas/style.ts";
import { DEFAULT_STYLE } from "../../src/style/default.ts";

const StyleContext = createContext<Style>(DEFAULT_STYLE);

export function StyleProvider({ style, children }: { style: Style; children: ReactNode }) {
  return <StyleContext.Provider value={style}>{children}</StyleContext.Provider>;
}

export function useStyle(): Style {
  return useContext(StyleContext);
}
