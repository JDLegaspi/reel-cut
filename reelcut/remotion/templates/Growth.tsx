import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { useStyle } from "../style/StyleContext.tsx";
import { alpha, fontStack, headline, shadowFor, tracking } from "../style/tokens.ts";
import { Burst, clamp01, fitSize, pop, rise, useFloat, useProgress, useReveal } from "./parts.tsx";

const SHAPES = ["hockey-stick", "exponential", "steady", "decline"] as const;

const schema = z.object({
  shape: z.enum(SHAPES).describe("hockey-stick: flat then a sudden take-off; exponential: ever faster; steady: climbing; decline: falling"),
  startLabel: z.string().min(1).max(16).nullable().describe("label at the start of the curve, e.g. 'Before'"),
  endLabel: z.string().min(1).max(16).nullable().describe("label at the end of the curve, e.g. 'After paywall'"),
  badge: z.string().min(1).max(14).nullable().describe("the result shown at the peak, e.g. '20x revenue'; any number in it must be said"),
});

type Props = z.infer<typeof schema>;

const WIDTH = 860;
const HEIGHT = 560;
const SAMPLES = 60;

function curve(shape: Props["shape"], x: number): number {
  switch (shape) {
    case "hockey-stick":
      return x < 0.58 ? 0.08 + 0.06 * x + 0.015 * Math.sin(x * 30) : 0.115 + Math.pow(x - 0.58, 2) * 4.6;
    case "exponential":
      return 0.06 + (0.88 * (Math.exp(3.2 * x) - 1)) / (Math.exp(3.2) - 1);
    case "steady":
      return 0.1 + 0.72 * x + 0.035 * Math.sin(x * 14);
    case "decline":
      return 0.9 - 0.72 * x + 0.035 * Math.sin(x * 12);
  }
}

function points(shape: Props["shape"]): [number, number][] {
  return Array.from({ length: SAMPLES + 1 }, (_, k) => {
    const x = k / SAMPLES;
    return [x * WIDTH, HEIGHT - curve(shape, x) * HEIGHT];
  });
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const style = useStyle();
  const { palette } = style;
  const drawn = useProgress(at.curve, 1.6);
  const badge = useReveal(at.badge ?? Math.round(1.6 * 30));
  const pulse = useFloat(0.25, 40);
  const line = points(props.shape);
  const head = line[Math.round(drawn * SAMPLES)]!;
  const visible = line.slice(0, Math.round(drawn * SAMPLES) + 1);
  const path = visible.map(([x, y], k) => `${k === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${head[0].toFixed(1)},${HEIGHT} L0,${HEIGHT} Z`;
  const color = props.shape === "decline" ? palette.negative : palette.accent;
  const glow = style.flourishes.glow;
  const badgeSize = props.badge ? fitSize(props.badge, { max: 100, min: 64, fits: 7 }) : 0;
  const badgeLeft = props.shape === "decline" ? WIDTH - 460 : 0;
  return (
    <div style={{ position: "absolute", left: 110, top: 150, width: WIDTH, height: HEIGHT }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", overflow: "visible" }}>
        <defs>
          <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={WIDTH} y1={HEIGHT - f * HEIGHT} y2={HEIGHT - f * HEIGHT} stroke={alpha(palette.onBackdrop, 0.12)} strokeWidth={3} strokeDasharray="10 14" />
        ))}
        <line x1={0} x2={WIDTH} y1={HEIGHT} y2={HEIGHT} stroke={alpha(palette.onBackdrop, 0.4)} strokeWidth={4} />
        <path d={area} fill="url(#growth-fill)" />
        <path d={path} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" style={{ filter: glow ? `drop-shadow(0 0 18px ${color})` : undefined }} />
        {glow && <circle cx={head[0]} cy={head[1]} r={22 + pulse * 20} fill={color} opacity={0.35} />}
        <circle cx={head[0]} cy={head[1]} r={16} fill={palette.surface} stroke={color} strokeWidth={6} />
      </svg>
      {props.startLabel && (
        <div style={{ position: "absolute", left: 0, top: HEIGHT + 24, fontSize: 40, fontWeight: 800, color: palette.onBackdropMuted, ...rise(clamp01(drawn * 3)) }}>
          {props.startLabel}
        </div>
      )}
      {props.endLabel && (
        <div style={{ position: "absolute", right: 0, top: HEIGHT + 24, fontSize: 40, fontWeight: 800, color: palette.onBackdrop, ...rise(clamp01((drawn - 0.7) * 4)) }}>
          {props.endLabel}
        </div>
      )}
      {props.badge && (
        <div style={{ position: "absolute", left: badgeLeft, top: 10, width: 460, height: 180 }}>
          <Burst at={at.badge ?? Math.round(1.6 * 30)} color={palette.accent} size={260} count={12} />
          <div
            style={{
              width: 460,
              height: 180,
              borderRadius: style.shape.radius,
              backgroundColor: palette.surface,
              boxShadow: shadowFor(style, "small"),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fontStack(style.type.display),
              fontSize: badgeSize,
              fontWeight: style.type.displayWeight,
              letterSpacing: tracking(style, badgeSize),
              color: palette.onSurface,
              transform: `rotate(${style.shape.tilt ? -4 : 0}deg) ${pop(badge).transform}`,
              opacity: pop(badge).opacity,
            }}
          >
            {headline(style, props.badge)}
          </div>
        </div>
      )}
    </div>
  );
}

export const Growth = defineTemplate({
  name: "Growth",
  description:
    'A curve drawing itself across the panel, for growth or decline the speaker describes, with optional labels and a result badge that bursts in at the peak. Elements: "curve", "badge".',
  schema,
  revealKeys: (props) => ["curve", ...(props.badge ? ["badge"] : [])],
  spokenTexts: (props) => [props.startLabel, props.endLabel, props.badge],
  example: { shape: "hockey-stick", startLabel: "Before", endLabel: "Paywall", badge: "20x revenue" },
  Component,
});
