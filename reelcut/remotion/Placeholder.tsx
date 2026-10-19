import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { PlaceholderSegment } from "./props.ts";

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

export function Placeholder({ segment }: { segment: PlaceholderSegment }) {
  const frame = useCurrentFrame();
  const elapsed = Math.min(frame / Math.max(segment.durationInFrames - 1, 1), 1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#14171f",
        backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 24px, transparent 24px 48px)",
        color: "#f2f3f5",
        fontFamily: FONT,
        padding: "160px 90px",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 34, letterSpacing: 4, color: "#9aa3b2" }}>
        <span style={{ border: "3px solid #f5b83d", color: "#f5b83d", padding: "6px 18px", borderRadius: 8 }}>
          PLACEHOLDER
        </span>
        <span>{segment.id.toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 50, lineHeight: 1.35, fontWeight: 500 }}>{segment.description}</div>
      <div>
        <div style={{ fontSize: 34, lineHeight: 1.4, color: "#9aa3b2", fontStyle: "italic", marginBottom: 40 }}>
          “{segment.spoken}”
        </div>
        <div style={{ height: 8, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 4 }}>
          <div style={{ height: 8, width: `${elapsed * 100}%`, backgroundColor: "#f5b83d", borderRadius: 4 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
