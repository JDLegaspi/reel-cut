import { Video } from "@remotion/media";
import type { ReactNode } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { speakerFrame, speakerPanel, type Rect, type Size } from "./framing.ts";
import type { EmphasisWord, RenderSegment } from "./props.ts";
import { useStyle } from "./style/StyleContext.tsx";
import { alpha, fontStack, headline, shadowFor, tracking } from "./style/tokens.ts";
import { Backdrop, Camera, clamp01, fitSize, Marker, useProgress, useReveal } from "./templates/parts.tsx";
import { BOX, FULL_BOX_TOP } from "./templates/theme.ts";

const FRAME: Size = { width: 1080, height: 1920 };
const HALF = FRAME.height / 2;
const PUNCH_ZOOM = 1.1;

export function Speaker({ video, crop, segments }: { video: string; crop: Rect; segments: RenderSegment[] }) {
  const frame = useCurrentFrame();
  const style = useStyle();
  const active = segments.find((segment) => frame >= segment.from && frame < segment.from + segment.durationInFrames);
  const split = active?.kind === "visual" && active.layout === "split";
  const shotsSoFar = segments.filter((segment) => segment.from <= frame).length;
  const zoom = !active && shotsSoFar % 2 === 1 ? PUNCH_ZOOM : 1;
  const alone = speakerPanel(crop, FRAME);
  const panel = split ? { top: HALF, width: FRAME.width, height: HALF } : alone;
  const framed = !split && alone.height < FRAME.height;
  const placement = speakerFrame({ crop, source: FRAME, panel, zoom });
  return (
    <AbsoluteFill>
      {framed && <Backdrop />}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: panel.top,
          width: panel.width,
          height: panel.height,
          overflow: "hidden",
          boxShadow: framed ? shadowFor(style, "card") : undefined,
        }}
      >
        <Video src={staticFile(video)} style={{ position: "absolute", ...placement }} />
      </div>
    </AbsoluteFill>
  );
}

export function emphasisTop(crop: Rect): number {
  const panel = speakerPanel(crop, FRAME);
  return panel.height < FRAME.height ? panel.top + panel.height + 40 : 1180;
}

export function VisualShot({ layout, children }: { layout: "split" | "full"; children: ReactNode }) {
  const style = useStyle();
  const shade = style.palette.backdrop[1];
  if (layout === "split") {
    return (
      <AbsoluteFill>
        <div style={{ position: "absolute", left: 0, top: 0, width: FRAME.width, height: HALF, overflow: "hidden" }}>
          <Backdrop />
          <Camera>{children}</Camera>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: HALF,
            width: FRAME.width,
            height: 160,
            background: `linear-gradient(${alpha(shade, 0.75)}, ${alpha(shade, 0)})`,
          }}
        />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Backdrop />
      <Camera>
        <div style={{ position: "absolute", left: 0, top: FULL_BOX_TOP, width: BOX.width, height: BOX.height }}>{children}</div>
      </Camera>
    </AbsoluteFill>
  );
}

export function Emphasis({ word, index, top }: { word: EmphasisWord; index: number; top: number }) {
  const style = useStyle();
  const lively = style.motion === "lively";
  const progress = useReveal(0, 0, lively ? { damping: 11, stiffness: 220, mass: 0.6 } : undefined);
  const swipe = useProgress(0, 0.3, 5);
  const { palette } = style;
  const size = fitSize(word.text, { max: 190, min: 110, fits: 7 });
  const text = headline(style, word.text);
  const entrance = lively ? `scale(${1.7 - 0.7 * progress}) rotate(${(1 - progress) * -6}deg)` : `translateY(${(1 - progress) * 40}px)`;
  const solid = index % 2 === 1 ? palette.accent : palette.onBackdrop;
  const padding = "0 24px 10px";
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: top }}>
      <div
        style={{
          position: "relative",
          padding,
          fontFamily: fontStack(style.type.display),
          fontSize: size,
          fontWeight: style.type.displayWeight,
          letterSpacing: tracking(style, size),
          lineHeight: 1.05,
          color: style.emphasis === "solid" ? solid : style.emphasis === "outline" ? "transparent" : palette.onBackdrop,
          WebkitTextStroke: style.emphasis === "outline" ? `4px ${palette.onBackdrop}` : undefined,
          textShadow: style.emphasis === "highlight" ? undefined : `0 10px 40px ${alpha(palette.backdrop[1], 0.65)}`,
          opacity: clamp01(progress * 2),
          transform: entrance,
          whiteSpace: "nowrap",
        }}
      >
        {text}
        {style.emphasis === "highlight" && (
          <Marker progress={swipe} padding={padding}>
            {text}
          </Marker>
        )}
      </div>
    </AbsoluteFill>
  );
}
