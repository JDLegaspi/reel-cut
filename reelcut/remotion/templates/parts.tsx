import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme.ts";

export function useReveal(at: number | undefined, delay = 0, config = { damping: 13, stiffness: 170, mass: 0.7 }): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - (at ?? 0) - delay, fps, config });
}

export function useFloat(amplitude = 10, period = 70, phase = 0): number {
  const frame = useCurrentFrame();
  return Math.sin((frame / period) * Math.PI * 2 + phase) * amplitude;
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

export function Backdrop() {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const a = { x: 22 + Math.sin(t * 0.5) * 10, y: 18 + Math.cos(t * 0.4) * 8 };
  const b = { x: 82 + Math.cos(t * 0.45) * 8, y: 78 + Math.sin(t * 0.35) * 10 };
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.deep,
        backgroundImage: [
          `radial-gradient(circle at ${a.x}% ${a.y}%, rgba(34,211,238,0.42), transparent 42%)`,
          `radial-gradient(circle at ${b.x}% ${b.y}%, rgba(167,139,250,0.45), transparent 46%)`,
          "linear-gradient(160deg, #2445FF 0%, #1326B8 45%, #070B3A 100%)",
        ].join(", "),
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 2px, transparent 2.5px)",
          backgroundSize: "44px 44px",
          backgroundPosition: `${(frame * 0.6) % 44}px ${(frame * 0.3) % 44}px`,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 85%)",
        }}
      />
    </AbsoluteFill>
  );
}

export function Camera({ children }: { children: ReactNode }) {
  const frame = useCurrentFrame();
  const scale = 1 + Math.min(frame, 240) * 0.00025;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, fontFamily: `${theme.font}, Helvetica, Arial, sans-serif` }}>
      {children}
    </AbsoluteFill>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: theme.paper,
        borderRadius: 40,
        boxShadow: "0 40px 90px rgba(3, 8, 45, 0.45)",
        color: theme.ink,
        ...style,
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
  if (progress <= 0 || progress >= 1) return null;
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
