import type { RetakeFinder, RetakeInput, RetakeOutput } from "./RetakeFinder.ts";

export function createMockRetakeFinder(outputs?: RetakeOutput[], calls: RetakeInput[] = []): RetakeFinder {
  let next = 0;
  return {
    async find(input) {
      calls.push(input);
      const keepAll: RetakeOutput = { keep: [{ fromWord: 0, toWord: input.words.length - 1 }], removed: [] };
      const output = outputs ? outputs[Math.min(next++, outputs.length - 1)]! : keepAll;
      return { raw: { mock: true }, ...output };
    },
  };
}
