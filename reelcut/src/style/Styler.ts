import type { References } from "../schemas/references.ts";

export interface StylerImage {
  reference: number;
  caption: string;
  mediaType: "image/jpeg" | "image/png";
  data: Buffer;
}

export interface StylerInput {
  references: References;
  images: StylerImage[];
  retry?: { previous: unknown; problems: string[] };
}

export interface StylerResult {
  raw: unknown;
  output: unknown;
}

export interface Styler {
  style(input: StylerInput): Promise<StylerResult>;
}
