import { afterEach, describe, expect, test, vi } from "vitest";
import { claudeModel, createClaudeClient } from "../src/claude.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("claude", () => {
  test("throws a clear error without an API key", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => createClaudeClient()).toThrow("ANTHROPIC_API_KEY is not set. Add it to .env");
  });

  test("uses ANTHROPIC_MODEL when set, else claude-sonnet-5-5", () => {
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(claudeModel()).toBe("claude-sonnet-5-5");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-opus-5-5");
    expect(claudeModel()).toBe("claude-opus-5-5");
  });
});
