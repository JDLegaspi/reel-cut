import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export async function createFakeYtDlp(dir: string, opts: { video: string; info: Record<string, unknown> }): Promise<string> {
  const home = await mkdtemp(join(dir, "fake-yt-dlp-"));
  const infoPath = join(home, "info.json");
  const script = join(home, "yt-dlp");
  await writeFile(infoPath, JSON.stringify(opts.info));
  await writeFile(
    script,
    [
      "#!/bin/sh",
      'while [ $# -gt 0 ]; do',
      '  if [ "$1" = "-o" ]; then template="$2"; shift; fi',
      "  shift",
      "done",
      `cp ${shellQuote(opts.video)} "$(printf '%s' "$template" | sed 's/%(ext)s/mp4/')"`,
      `cp ${shellQuote(infoPath)} "$(printf '%s' "$template" | sed 's/\\.%(ext)s/.info.json/')"`,
      "",
    ].join("\n"),
  );
  await chmod(script, 0o755);
  return script;
}
