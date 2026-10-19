import "./fonts.ts";
import { Composition } from "remotion";
import { COMPOSITION_ID, PREVIEW_ID, type PreviewProps, type RenderProps } from "./props.ts";
import { Reel, TemplatePreview } from "./Reel.tsx";
import { TEMPLATES } from "./templates/registry.ts";

const defaultProps: RenderProps = {
  video: "source.mp4",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 30,
  speakerCrop: { x: 0, y: 0, width: 1080, height: 1920 },
  segments: [],
  emphasis: [],
};

const firstTemplate = TEMPLATES[0]!;

const previewProps: PreviewProps = {
  layout: "split",
  template: firstTemplate.name,
  props: firstTemplate.example as Record<string, unknown>,
  at: {},
};

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
    </>
  );
}
