import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).flatMap((name) => [name, `${name}/*`]);

await build({
  entryPoints: [fileURLToPath(new URL("../src/cli/index.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../dist/cli.js", import.meta.url)),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external,
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "warning",
});
