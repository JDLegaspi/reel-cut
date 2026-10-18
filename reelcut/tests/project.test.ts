import { describe, expect, test } from "vitest";
import { defaultProjectName } from "../src/pipeline/project.ts";

describe("defaultProjectName", () => {
  test("uses the reel id for Instagram URLs", () => {
    expect(defaultProjectName({ kind: "url", url: "https://www.instagram.com/p/DcKwm7DT6Ar/" })).toBe("ig-DcKwm7DT6Ar");
  });

  test("slugifies the file name for local files", () => {
    expect(defaultProjectName({ kind: "file", path: "/x/My Take 2.mov" })).toBe("my-take-2");
  });
});
