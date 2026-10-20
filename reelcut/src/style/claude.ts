import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeModel, createClaudeClient } from "@reel/shared/claude.ts";
import { z } from "zod";
import { StyleSchema } from "../schemas/style.ts";
import { buildStyleMessages, styleSystemPrompt } from "./prompt.ts";
import type { Styler } from "./Styler.ts";

const style = StyleSchema.shape;
const color = z.string().describe("#rrggbb");

export const ClaudeStyleSchema = z.object({
  palette: z.object({
    backdrop: z.array(color).describe("two colours"),
    surface: color,
    onSurface: color,
    onSurfaceMuted: color,
    onBackdrop: color,
    onBackdropMuted: color,
    accent: color,
    onAccent: color,
    positive: color,
    negative: color,
    tints: z.array(color).describe("four colours"),
  }),
  type: z.object({
    display: z.string(),
    body: z.string(),
    displayWeight: z.number().int().describe("500, 600, 700, 800 or 900"),
    tracking: style.type.shape.tracking,
    headlineCase: style.type.shape.headlineCase,
  }),
  shape: z.object({
    radius: z.number().int().describe("0 to 48"),
    cards: style.shape.shape.cards,
    shadow: style.shape.shape.shadow,
    tilt: z.boolean(),
  }),
  backdrop: z.object({ kind: style.backdrop.shape.kind, drift: z.boolean() }),
  motion: style.motion,
  flourishes: z.object({ bursts: z.boolean(), coins: z.boolean(), glow: z.boolean(), shake: z.boolean() }),
  icons: z.object({ stroke: z.number().describe("1.25 to 3"), tiles: style.icons.shape.tiles }),
  emphasis: style.emphasis,
  notes: z.string(),
});

export function createClaudeStyler(model = claudeModel()): Styler {
  const client = createClaudeClient();

  return {
    async style(input) {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: styleSystemPrompt(),
        messages: buildStyleMessages(input),
        output_config: { format: betaZodOutputFormat(ClaudeStyleSchema) },
      });
      if (response.stop_reason === "refusal") {
        throw new Error(`Claude declined to make a style (${response.stop_details?.category ?? "no category"})`);
      }
      if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of output tokens while making a style");
      if (!response.parsed_output) throw new Error("Claude returned a style that does not match the schema");
      const { parsed_output, ...raw } = response;
      return { raw, output: { version: 1, ...parsed_output } };
    },
  };
}
