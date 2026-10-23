import { describe, expect, test } from "vitest";
import { defaultProjectName } from "../src/pipeline/project.ts";
import { ProjectSchema } from "../src/schemas/project.ts";

describe("defaultProjectName", () => {
  test("uses the reel id for Instagram URLs", () => {
    expect(defaultProjectName({ kind: "url", url: "https://www.instagram.com/p/DcKwm7DT6Ar/" })).toBe("ig-DcKwm7DT6Ar");
  });

  test("slugifies the file name for local files", () => {
    expect(defaultProjectName({ kind: "file", path: "/x/My Take 2.mov" })).toBe("my-take-2");
  });
});

describe("ProjectSchema", () => {
  test("reads projects made before voice-only mode as having a face", () => {
    const old = { version: 1, source: { kind: "file", path: "/x/a.mov" }, retakeWord: "again", aggressive: false };
    expect(ProjectSchema.parse(old).face).toBe(true);
  });
});
