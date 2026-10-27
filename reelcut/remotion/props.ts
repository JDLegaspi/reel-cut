import type { Brand } from "../src/schemas/brands.ts";
import type { Style } from "../src/schemas/style.ts";
import type { Rect } from "./framing.ts";

export const COMPOSITION_ID = "Reel";
export const PREVIEW_ID = "TemplatePreview";
export const SHEET_ID = "StyleSheet";

export type FontFile = {
  family: string;
  weight: string;
  url: string;
  unicodeRange: string;
};

export type PlaceholderSegment = {
  kind: "placeholder";
  id: string;
  from: number;
  durationInFrames: number;
  description: string;
  spoken: string;
};

export type TemplateSegment = {
  kind: "visual";
  id: string;
  layout: "split" | "full";
  from: number;
  durationInFrames: number;
  template: string;
  props: Record<string, unknown>;
  at: Record<string, number>;
};

export type RenderSegment = PlaceholderSegment | TemplateSegment;

export type EmphasisWord = {
  from: number;
  durationInFrames: number;
  text: string;
};

export type CaptionWord = {
  from: number;
  durationInFrames: number;
  text: string;
  accent: boolean;
};

export type PhraseWord = {
  text: string;
  from: number;
  accent: boolean;
};

export type Phrase = {
  from: number;
  durationInFrames: number;
  words: PhraseWord[];
};

export type RenderProps = {
  video: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  speakerCrop: Rect;
  style: Style;
  fonts: FontFile[];
  segments: RenderSegment[];
  emphasis: EmphasisWord[];
  face: boolean;
  phrases: Phrase[];
  captions: CaptionWord[];
  brands: Brand[];
};

export type PreviewProps = {
  brands?: Brand[];
  layout: "split" | "full";
  template: string;
  props: Record<string, unknown>;
  at: Record<string, number>;
  style: Style;
  fonts: FontFile[];
};

export type SheetProps = {
  style: Style;
  fonts: FontFile[];
};
