import type { Rect } from "./framing.ts";

export const COMPOSITION_ID = "Reel";
export const PREVIEW_ID = "TemplatePreview";

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

export type RenderProps = {
  video: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  speakerCrop: Rect;
  segments: RenderSegment[];
  emphasis: EmphasisWord[];
};

export type PreviewProps = {
  layout: "split" | "full";
  template: string;
  props: Record<string, unknown>;
  at: Record<string, number>;
};
