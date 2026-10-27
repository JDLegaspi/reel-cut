import { AbsoluteFill, Sequence } from "remotion";
import { BrandsProvider } from "./BrandsContext.tsx";
import { Placeholder } from "./Placeholder.tsx";
import type { PreviewProps, RenderProps } from "./props.ts";
import { Captions, Emphasis, emphasisTop, Speaker, VisualShot } from "./Shots.tsx";
import { StyleProvider } from "./style/StyleContext.tsx";
import { StyleFonts } from "./style/StyleFonts.tsx";
import { TemplateView } from "./TemplateView.tsx";

export function Reel({ video, speakerCrop, segments, emphasis, style, fonts, face, phrases, captions, brands }: RenderProps) {
  return (
    <BrandsProvider brands={brands}>
    <StyleProvider style={style}>
      <StyleFonts fonts={fonts} />
      <AbsoluteFill style={{ backgroundColor: style.palette.backdrop[1] }}>
        <Speaker video={video} crop={speakerCrop} segments={segments} face={face} phrases={phrases} />
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
        <Captions captions={captions} segments={segments} />
      </AbsoluteFill>
    </StyleProvider>
    </BrandsProvider>
  );
}

export function TemplatePreview({ template, props, at, layout, style, fonts, brands }: PreviewProps) {
  return (
    <BrandsProvider brands={brands ?? []}>
    <StyleProvider style={style}>
      <StyleFonts fonts={fonts} />
      <AbsoluteFill style={{ backgroundColor: style.palette.backdrop[1] }}>
        <VisualShot layout={layout}>
          <TemplateView template={template} props={props} at={at} />
        </VisualShot>
      </AbsoluteFill>
    </StyleProvider>
    </BrandsProvider>
  );
}
