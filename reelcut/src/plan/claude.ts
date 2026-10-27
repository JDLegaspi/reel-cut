import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeModel, createClaudeClient } from "@reel/shared/claude.ts";
import type { Planner } from "./Planner.ts";
import { buildPlanMessages, planSystemPrompt } from "./prompt.ts";
import { ClaudePlanSchema, fromClaudePlan } from "./schema.ts";

export function createClaudePlanner(model = claudeModel()): Planner {
  const client = createClaudeClient();

  return {
    async plan(input) {
      const response = await client.beta.messages
        .stream({
          model,
          max_tokens: 64000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: planSystemPrompt(input.rules, input.face),
          messages: buildPlanMessages(input),
          output_config: { format: betaZodOutputFormat(ClaudePlanSchema) },
        })
        .finalMessage();
      if (response.stop_reason === "refusal") {
        throw new Error(`Claude declined to plan visuals (${response.stop_details?.category ?? "no category"})`);
      }
      if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of output tokens while planning visuals");
      if (!response.parsed_output) throw new Error("Claude returned a visual plan that does not match the schema");
      const { parsed_output, ...raw } = response;
      return { raw, output: fromClaudePlan(parsed_output) };
    },
  };
}
