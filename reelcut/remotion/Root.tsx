import { Composition } from "remotion";
import { DEFAULT_STYLE } from "../src/style/default.ts";
import { COMPOSITION_ID, PREVIEW_ID, SHEET_ID, type PreviewProps, type RenderProps, type SheetProps } from "./props.ts";
import { Reel, TemplatePreview } from "./Reel.tsx";
import { StyleSheet } from "./StyleSheet.tsx";
import { TEMPLATES } from "./templates/registry.ts";

const defaultProps: RenderProps = {
  video: "source.mp4",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 30,
  speakerCrop: { x: 0, y: 0, width: 1080, height: 1920 },
  style: DEFAULT_STYLE,
  fonts: [],
  segments: [],
  emphasis: [],
  face: true,
  phrases: [],
};

const firstTemplate = TEMPLATES[0]!;

const previewProps: PreviewProps = {
  layout: "split",
  template: firstTemplate.name,
  props: firstTemplate.example as Record<string, unknown>,
  at: {},
  style: DEFAULT_STYLE,
  fonts: [],
};

const sheetProps: SheetProps = { style: DEFAULT_STYLE, fonts: [] };

export function Root() {
  return (
    <>
      <Composition
        id={COMPOSITION_ID}
        component={Reel}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.durationInFrames,
          fps: props.fps,
          width: props.width,
          height: props.height,
        })}
      />
      <Composition
        id={PREVIEW_ID}
        component={TemplatePreview}
        defaultProps={previewProps}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition id={SHEET_ID} component={StyleSheet} defaultProps={sheetProps} durationInFrames={120} fps={30} width={1620} height={1920} />
    </>
  );
}
