import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeModel, createClaudeClient } from "@reel/shared/claude.ts";
import { z } from "zod";
import { RemovalSchema, WordRangeSchema } from "../schemas/cuts.ts";
import { buildRetakeMessages, retakeSystemPrompt } from "./prompt.ts";
import type { RetakeFinder } from "./RetakeFinder.ts";

const ClaudeRetakesSchema = z.object({ keep: z.array(WordRangeSchema), removed: z.array(RemovalSchema) });

export function createClaudeRetakeFinder(model = claudeModel()): RetakeFinder {
  const client = createClaudeClient();

  return {
    async find(input) {
      const response = await client.beta.messages
        .stream({
          model,
          max_tokens: 64000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: retakeSystemPrompt(input),
          messages: buildRetakeMessages(input),
          output_config: { format: betaZodOutputFormat(ClaudeRetakesSchema) },
        })
        .finalMessage();
      if (response.stop_reason === "refusal") {
        throw new Error(`Claude declined to find retakes (${response.stop_details?.category ?? "no category"})`);
      }
      if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of output tokens while finding retakes");
      if (!response.parsed_output) throw new Error("Claude returned retakes that do not match the schema");
      const { parsed_output, ...raw } = response;
      return { raw, ...parsed_output };
    },
  };
}
