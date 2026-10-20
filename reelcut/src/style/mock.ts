import type { Styler, StylerInput } from "./Styler.ts";

export function createMockStyler(outputs: unknown[], calls: StylerInput[] = []): Styler {
  return {
    async style(input) {
      calls.push(input);
      const output = outputs[Math.min(calls.length - 1, outputs.length - 1)];
      return { raw: { mock: true, attempt: calls.length }, output };
    },
  };
}
