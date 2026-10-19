import type { PlannerOutput } from "../schemas/visualPlan.ts";
import type { PlanInput, Planner } from "./Planner.ts";

export function createMockPlanner(outputs: PlannerOutput[], calls: PlanInput[] = []): Planner {
  let next = 0;
  return {
    async plan(input) {
      calls.push(input);
      const output = outputs[Math.min(next++, outputs.length - 1)]!;
      return { raw: { mock: true }, output };
    },
  };
}
