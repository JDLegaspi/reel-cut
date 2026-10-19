import { AbsoluteFill, Sequence } from "remotion";
import { Placeholder } from "./Placeholder.tsx";
import type { PreviewProps, RenderProps } from "./props.ts";
import { Emphasis, emphasisTop, Speaker, VisualShot } from "./Shots.tsx";
import { TemplateView } from "./TemplateView.tsx";

export function Reel({ video, speakerCrop, segments, emphasis }: RenderProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Speaker video={video} crop={speakerCrop} segments={segments} />
      {emphasis.map((word, k) => (
        <Sequence key={`emphasis-${k}`} name={`emphasis ${word.text}`} from={word.from} durationInFrames={word.durationInFrames}>
          <Emphasis word={word} index={k} top={emphasisTop(speakerCrop)} />
        </Sequence>
      ))}
      {segments.map((segment) => (
        <Sequence key={segment.id} name={segment.id} from={segment.from} durationInFrames={segment.durationInFrames}>
          {segment.kind === "placeholder" ? (
            <Placeholder segment={segment} />
          ) : (
            <VisualShot layout={segment.layout}>
              <TemplateView template={segment.template} props={segment.props} at={segment.at} />
            </VisualShot>
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export function TemplatePreview({ template, props, at, layout }: PreviewProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a1a" }}>
      <VisualShot layout={layout}>
        <TemplateView template={template} props={props} at={at} />
      </VisualShot>
    </AbsoluteFill>
  );
}
