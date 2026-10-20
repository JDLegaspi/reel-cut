import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const REMOTION = join(import.meta.dirname, "../remotion");
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g;

const files = [
  ...readdirSync(join(REMOTION, "templates")).map((file) => join(REMOTION, "templates", file)),
  join(REMOTION, "Shots.tsx"),
  join(REMOTION, "StyleSheet.tsx"),
];

test.each(files.map((file) => [file.slice(REMOTION.length + 1), file]))("%s takes every colour from the style", (_, file) => {
  const literals = readFileSync(file, "utf8").match(COLOUR_LITERAL) ?? [];
  expect(literals).toEqual([]);
});
