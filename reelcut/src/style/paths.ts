import { join } from "node:path";

const STYLE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function stylePaths(stylesRoot: string, name: string) {
  if (!STYLE_NAME.test(name)) throw new Error(`"${name}" is not a style name; use lowercase letters, digits and dashes`);
  const dir = join(stylesRoot, name);
  return {
    dir,
    sources: join(dir, "sources.json"),
    referencesDir: join(dir, "references"),
    references: join(dir, "references.json"),
    styleRaw: join(dir, "style.raw.json"),
    style: join(dir, "style.json"),
    sheet: join(dir, "sheet.png"),
  };
}

export type StylePaths = ReturnType<typeof stylePaths>;
