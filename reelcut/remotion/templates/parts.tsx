import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, type SpringConfig } from "remotion";
import type { ColorRole } from "../../src/schemas/style.ts";
import { useStyle } from "../style/StyleContext.tsx";
import { alpha, fontStack, mix, readableOn, roleColor, shadowFor, springFor } from "../style/tokens.ts";
import { Glyph } from "./icons.tsx";

export function useReveal(at: number | undefined, delay = 0, config?: Partial<SpringConfig>): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStyle();
  return spring({ frame: frame - (at ?? 0) - delay, fps, config: config ?? springFor(style) });
}

export function useFloat(amplitude = 10, period = 70, phase = 0): number {
  const frame = useCurrentFrame();
  const style = useStyle();
  const scale = style.motion === "calm" ? 0.5 : 1;
  return Math.sin((frame / period) * Math.PI * 2 + phase) * amplitude * scale;
}

export function useProgress(at: number | undefined, seconds: number, delay = 0): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame - (at ?? 0) - delay, [0, Math.round(seconds * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function pop(progress: number, from = 0.4): CSSProperties {
  return { opacity: clamp01(progress * 1.8), transform: `scale(${from + (1 - from) * progress})` };
}

export function rise(progress: number, distance = 60): CSSProperties {
  return { opacity: clamp01(progress * 1.8), transform: `translateY(${(1 - progress) * distance}px)` };
}

export function fitSize(text: string, opts: { max: number; min: number; fits: number }): number {
  if (text.length <= opts.fits) return opts.max;
  return Math.max(opts.min, Math.round((opts.max * opts.fits) / text.length));
}

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`;

export function Backdrop() {
  const frame = useCurrentFrame();
  const style = useStyle();
  const { backdrop, palette } = style;
  const t = backdrop.drift ? frame / 30 : 0;
  const moved = backdrop.drift ? frame : 0;
  const [top, bottom] = palette.backdrop;
  const base = `linear-gradient(160deg, ${top} 0%, ${mix(top, bottom, 0.45)} 45%, ${bottom} 100%)`;

  switch (backdrop.kind) {
    case "flat":
      return <AbsoluteFill style={{ backgroundColor: top }} />;
    case "grid":
      return (
        <AbsoluteFill style={{ backgroundImage: base }}>
          <AbsoluteFill
            style={{
              backgroundImage: `linear-gradient(${alpha(palette.onBackdrop, 0.09)} 2px, transparent 2px), linear-gradient(90deg, ${alpha(palette.onBackdrop, 0.09)} 2px, transparent 2px)`,
              backgroundSize: "72px 72px",
              backgroundPosition: `${(moved * 0.5) % 72}px ${(moved * 0.25) % 72}px`,
            }}
          />
        </AbsoluteFill>
      );
    case "grain":
      return (
        <AbsoluteFill style={{ backgroundImage: base }}>
          <AbsoluteFill
            style={{ backgroundImage: GRAIN, opacity: 0.22, mixBlendMode: "overlay", backgroundPosition: `${(moved * 37) % 240}px ${(moved * 53) % 240}px` }}
          />
        </AbsoluteFill>
      );
    case "spotlight":
      return (
        <AbsoluteFill
          style={{
            backgroundColor: bottom,
            backgroundImage: `radial-gradient(ellipse 95% 75% at ${50 + Math.sin(t * 0.4) * 10}% -8%, ${top} 0%, ${alpha(top, 0)} 72%)`,
          }}
        />
      );
    case "gradient": {
      const a = { x: 22 + Math.sin(t * 0.5) * 10, y: 18 + Math.cos(t * 0.4) * 8 };
      const b = { x: 82 + Math.cos(t * 0.45) * 8, y: 78 + Math.sin(t * 0.35) * 10 };
      return (
        <AbsoluteFill
          style={{
            backgroundColor: bottom,
            backgroundImage: [
              `radial-gradient(circle at ${a.x}% ${a.y}%, ${alpha(palette.tints[2], 0.42)}, transparent 42%)`,
              `radial-gradient(circle at ${b.x}% ${b.y}%, ${alpha(palette.tints[1], 0.45)}, transparent 46%)`,
              base,
            ].join(", "),
          }}
        >
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(${alpha(palette.onBackdrop, 0.14)} 2px, transparent 2.5px)`,
              backgroundSize: "44px 44px",
              backgroundPosition: `${(moved * 0.6) % 44}px ${(moved * 0.3) % 44}px`,
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 85%)",
            }}
          />
        </AbsoluteFill>
      );
    }
  }
}

export function Camera({ children }: { children: ReactNode }) {
  const frame = useCurrentFrame();
  const style = useStyle();
  const scale = 1 + Math.min(frame, 240) * (style.motion === "calm" ? 0.00012 : 0.00025);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, fontFamily: fontStack(style.type.body), color: style.palette.onBackdrop }}>
      {children}
    </AbsoluteFill>
  );
}

export function Card({ children, style: css }: { children: ReactNode; style?: CSSProperties }) {
  const style = useStyle();
  const { palette, shape } = style;
  return (
    <div
      style={{
        backgroundColor: shape.cards === "glass" ? alpha(palette.surface, 0.8) : palette.surface,
        backdropFilter: shape.cards === "glass" ? "blur(24px)" : undefined,
        border:
          shape.cards === "outline"
            ? `4px solid ${palette.onSurface}`
            : shape.cards === "glass"
              ? `2px solid ${alpha(palette.surface, 0.95)}`
              : undefined,
        borderRadius: shape.radius,
        boxShadow: shadowFor(style, "card"),
        color: palette.onSurface,
        ...css,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({ children, color, background, style }: { children: ReactNode; color: string; background: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 30px",
        borderRadius: 999,
        backgroundColor: background,
        color,
        fontSize: 40,
        fontWeight: 800,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Burst({ at, color, size, count = 10 }: { at: number | undefined; color: string; size: number; count?: number }) {
  const progress = useProgress(at, 0.6);
  const style = useStyle();
  if (!style.flourishes.bursts || progress <= 0 || progress >= 1) return null;
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
      {Array.from({ length: count }, (_, k) => {
        const angle = (k / count) * Math.PI * 2;
        const distance = size * (0.35 + 0.65 * progress);
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: color,
              opacity: 1 - progress,
              transform: `translate(${Math.cos(angle) * distance - 7}px, ${Math.sin(angle) * distance - 7}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

export function IconTile({ icon, size, role, style: css }: { icon: string; size: number; role: ColorRole; style?: CSSProperties }) {
  const style = useStyle();
  const color = roleColor(style, role);
  const { tiles } = style.icons;
  const radius = Math.min(size / 2, Math.round((size * 0.3 * style.shape.radius) / 40));
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tiles === "filled" ? color : "transparent",
        border: tiles === "outline" ? `${Math.max(3, Math.round(size / 28))}px solid ${color}` : undefined,
        ...css,
      }}
    >
      <Glyph name={icon} size={Math.round(size * (tiles === "bare" ? 0.86 : 0.58))} color={tiles === "filled" ? readableOn(style, color) : color} />
    </div>
  );
}

export function Marker({ progress, padding, children }: { progress: number; padding: string; children: ReactNode }) {
  const style = useStyle();
  return (
    <div style={{ position: "absolute", inset: 0, clipPath: `inset(-10% ${(1 - progress) * 100}% -10% 0)` }}>
      <div style={{ position: "absolute", inset: "8% 0 4%", borderRadius: Math.min(14, style.shape.radius), backgroundColor: style.palette.accent }} />
      <div style={{ position: "relative", padding, color: style.palette.onAccent, WebkitTextStroke: "0px transparent" }}>{children}</div>
    </div>
  );
}
