import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test } from "vitest";
import type { References } from "../src/schemas/references.ts";
import { buildStyleMessages, styleSystemPrompt } from "../src/style/prompt.ts";
import type { StylerImage } from "../src/style/Styler.ts";

const references: References = {
  version: 1,
  references: [
    {
      source: "https://stripe.com",
      kind: "website",
      images: [{ file: "references/01-desktop-top.jpg", caption: "stripe.com, desktop, top" }],
      facts: {
        colors: [{ hex: "#635bff", share: 0.1, use: "background" }],
        variables: { "--brand": "#635bff" },
        fonts: { body: "Söhne", headings: null, buttons: null },
      },
      error: null,
    },
    { source: "./logo.png", kind: "file-image", images: [{ file: "references/02-logo.png", caption: "logo.png" }], facts: null, error: null },
    { source: "https://example.com/down", kind: "website", images: [], facts: null, error: "net::ERR_CONNECTION_REFUSED" },
  ],
};

const images: StylerImage[] = [
  { reference: 0, caption: "stripe.com, desktop, top", mediaType: "image/jpeg", data: Buffer.from("jpeg bytes") },
  { reference: 1, caption: "logo.png", mediaType: "image/png", data: Buffer.from("png bytes") },
];

type Block = Anthropic.Beta.BetaContentBlockParam;

function blocks(message: Anthropic.Beta.BetaMessageParam): Block[] {
  return typeof message.content === "string" ? [{ type: "text", text: message.content }] : (message.content as Block[]);
}

function texts(message: Anthropic.Beta.BetaMessageParam): string {
  return blocks(message)
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n");
}

describe("style prompt", () => {
  test("describes each reference with its facts, then its images", () => {
    const [message] = buildStyleMessages({ references, images });
    const content = blocks(message!);
    const text = texts(message!);
    expect(text).toContain("Reference 1: https://stripe.com (website)");
    expect(text).toContain('"--brand":"#635bff"');
    expect(text).toContain("Reference 3: https://example.com/down (website)");
    expect(text).toContain("could not be used: net::ERR_CONNECTION_REFUSED");
    const pictures = content.filter((block) => block.type === "image");
    expect(pictures.map((block) => block.type === "image" && block.source.type === "base64" && block.source.media_type)).toEqual(["image/jpeg", "image/png"]);
    expect(pictures[0]!.type === "image" && pictures[0]!.source.type === "base64" && pictures[0]!.source.data).toBe(Buffer.from("jpeg bytes").toString("base64"));
    const order = content.map((block) => (block.type === "text" ? block.text.split("\n")[0] : "image"));
    expect(order.indexOf("Reference 2: ./logo.png (file-image)")).toBeGreaterThan(order.indexOf("image"));
    expect(texts(message!).trim().endsWith("Make the style.")).toBe(true);
  });

  test("sends a style back with its problems on the retry", () => {
    const messages = buildStyleMessages({
      references,
      images,
      retry: { previous: { notes: "first try" }, problems: ['type.display: "Interr" is not a Google Font; did you mean "Inter"?'] },
    });
    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({ role: "assistant", content: JSON.stringify({ notes: "first try" }) });
    expect(texts(messages[2]!)).toBe(
      'That style breaks these rules:\n- type.display: "Interr" is not a Google Font; did you mean "Inter"?\n\nReturn the whole style again with these fixed.',
    );
  });

  test("explains the rules and the schema", () => {
    const prompt = styleSystemPrompt();
    expect(prompt).toContain("Google Fonts");
    expect(prompt).toContain("4.5:1");
    expect(prompt).toContain('"headlineCase"');
  });
});
