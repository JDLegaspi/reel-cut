import { Video } from "@remotion/media";
import type { ReactNode } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { speakerFrame, speakerPanel, type Rect, type Size } from "./framing.ts";
import type { EmphasisWord, RenderSegment } from "./props.ts";
import { Backdrop, Camera, clamp01, fitSize, useReveal } from "./templates/parts.tsx";
import { BOX, FULL_BOX_TOP, theme } from "./templates/theme.ts";

const FRAME: Size = { width: 1080, height: 1920 };
const HALF = FRAME.height / 2;
const PUNCH_ZOOM = 1.1;

export function Speaker({ video, crop, segments }: { video: string; crop: Rect; segments: RenderSegment[] }) {
  const frame = useCurrentFrame();
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
          boxShadow: framed ? "0 30px 90px rgba(3,8,45,0.6)" : undefined,
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
            background: "linear-gradient(rgba(6,10,43,0.75), rgba(6,10,43,0))",
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
  const progress = useReveal(0, 0, { damping: 11, stiffness: 220, mass: 0.6 });
  const highlight = index % 2 === 1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: top }}>
      <div
        style={{
          fontFamily: `${theme.font}, Helvetica, Arial, sans-serif`,
          fontSize: fitSize(word.text, { max: 190, min: 110, fits: 7 }),
          fontWeight: 900,
          letterSpacing: -4,
          color: highlight ? theme.yellow : theme.white,
          textShadow: "0 10px 40px rgba(0,0,0,0.55), 0 2px 0 rgba(0,0,0,0.25)",
          opacity: clamp01(progress * 2),
          transform: `scale(${1.7 - 0.7 * progress}) rotate(${(1 - progress) * -6}deg)`,
          whiteSpace: "nowrap",
        }}
      >
        {word.text}
      </div>
    </AbsoluteFill>
  );
}
