import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { StyleSchema } from "../schemas/style.ts";
import type { StylerInput } from "./Styler.ts";

export function styleSystemPrompt(): string {
  const { $schema: _, ...schema } = z.toJSONSchema(StyleSchema);
  return `You set the visual style of the motion graphics that are cut into a vertical talking-head video (an Instagram Reel): cards, icons, counters, charts, phone mockups and big words that appear beside or instead of the speaker, in a 1080×1920 frame. The templates and their animation are fixed; you choose the style they are drawn in.

You get references the person wants the graphics to feel like: screenshots of websites, images from a GitHub project, frames from other creators' reels, logos and mood images. Websites come with facts read from their CSS.

How to read the references:
- For colours and fonts, trust the facts over the pixels: they are the brand's real values. Use the pixels for what the facts don't cover, and for the feel: airy or dense, flat or glossy, rounded or sharp, calm or loud.
- A website's look is in its hero, buttons and cards. Ignore cookie banners, chat widgets and stock photos.
- A reel's frames show the look of its graphics. Ignore the person, their room and burned-in captions unless the captions are styled graphics.
- A logo usually suggests the accent colour.
- When references disagree, follow the brand ones (websites, repos, logos) for colour and type, and the reels for layout and energy.

Rules:
- palette.backdrop is the background behind every visual. Make it feel like the brand: dark if the brand is dark, light if it is light.
- Text must stay readable: onSurface and onSurfaceMuted on surface at 4.5:1 or more; onBackdrop and accent on both backdrop colours (emphasis words are drawn in the accent straight on the backdrop), and onAccent on accent, at 3:1 or more.
- positive must read as good and negative as bad. The four tints are supporting colours, distinct from each other and from the backdrop.
- type.display and type.body must be Google Fonts family names, spelled exactly as Google Fonts spells them. When a reference uses a font that isn't on Google Fonts, choose the closest one that is.
- Prefer restraint. Leave shake off unless the references are clearly loud. Use bursts, coins and glow only when they suit the references. Use uppercase headlines only when the references set their headings in capitals.
- notes: two or three sentences on what you took from which reference.

The style is JSON matching this schema (version is added for you):
${JSON.stringify(schema)}`;
}

function referenceText(input: StylerInput, k: number): string {
  const reference = input.references.references[k]!;
  const lines = [`Reference ${k + 1}: ${reference.source} (${reference.kind ?? "unknown"})`];
  if (reference.facts) lines.push(`Facts read from the page: ${JSON.stringify(reference.facts)}`);
  if (reference.error) lines.push(`This reference could not be used: ${reference.error}`);
  return lines.join("\n");
}

export function buildStyleMessages(input: StylerInput): Anthropic.Beta.BetaMessageParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = input.references.references.flatMap((_, k) => [
    { type: "text" as const, text: referenceText(input, k) },
    ...input.images
      .filter((image) => image.reference === k)
      .flatMap((image): Anthropic.Beta.BetaContentBlockParam[] => [
        { type: "text", text: image.caption },
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data.toString("base64") } },
      ]),
  ]);
  content.push({ type: "text", text: "Make the style." });

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
  if (input.retry) {
    messages.push(
      { role: "assistant", content: JSON.stringify(input.retry.previous) },
      {
        role: "user",
        content: `That style breaks these rules:\n${input.retry.problems.map((problem) => `- ${problem}`).join("\n")}\n\nReturn the whole style again with these fixed.`,
      },
    );
  }
  return messages;
}
