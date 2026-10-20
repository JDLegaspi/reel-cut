import { resolve } from "node:path";
import type { BaseContext, Log } from "@reel/shared/pipeline/stage.ts";
import type { ReelcutConfig } from "../../config/schema.ts";
import type { SheetRenderer } from "../../render/Renderer.ts";
import { stylePaths, type StylePaths } from "../paths.ts";
import type { Styler } from "../Styler.ts";

export interface StyleContext extends BaseContext {
  paths: StylePaths;
  config: ReelcutConfig;
  styler: () => Styler;
  sheet: () => SheetRenderer;
}

export function createStyleContext(opts: {
  name: string;
  stylesRoot: string;
  config: ReelcutConfig;
  styler: () => Styler;
  sheet: () => SheetRenderer;
  log: Log;
}): StyleContext {
  return {
    name: opts.name,
    paths: stylePaths(resolve(opts.stylesRoot), opts.name),
    config: opts.config,
    styler: opts.styler,
    sheet: opts.sheet,
    log: opts.log,
  };
}
