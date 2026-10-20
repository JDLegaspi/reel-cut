import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { useCurrentFrame } from "remotion";
import { useStyle } from "../style/StyleContext.tsx";
import { alpha, fontStack, headline, mix, readableOn, roleColor, shadowColor, shadowFor } from "../style/tokens.ts";
import { colorRole, Glyph, iconName } from "./icons.tsx";
import { clamp01, pop, rise, useFloat, useReveal } from "./parts.tsx";

const schema = z.object({
  icon: iconName.describe("the main idea as a lucide icon in kebab-case, e.g. target, chef-hat, rocket"),
  label: z.string().min(1).max(28).nullable().describe("a few words naming the idea"),
  satellites: z
    .array(z.object({ key: z.string().min(1).max(20), icon: iconName }))
    .max(5)
    .describe("up to five related things the speaker mentions, orbiting the main icon"),
  color: colorRole,
});

type Props = z.infer<typeof schema>;

const CENTER = { x: 540, y: 400 };
const ORBIT = { x: 360, y: 250 };

function Satellite({ icon, angle, at, index }: { icon: string; angle: number; at: number | undefined; index: number }) {
  const progress = useReveal(at, 6 + index * 3);
  const bob = useFloat(10, 60, index * 1.3);
  const style = useStyle();
  const { palette } = style;
  const x = CENTER.x + Math.cos(angle) * ORBIT.x;
  const y = CENTER.y + Math.sin(angle) * ORBIT.y + bob;
  return (
    <>
      <svg style={{ position: "absolute", inset: 0, overflow: "visible", opacity: clamp01(progress) * 0.7 }} width={1080} height={960}>
        <line x1={CENTER.x} y1={CENTER.y} x2={x} y2={y} stroke={alpha(palette.onBackdrop, 0.55)} strokeWidth={4} strokeDasharray="4 14" strokeLinecap="round" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x - 72,
          top: y - 72,
          width: 144,
          height: 144,
          borderRadius: 72,
          backgroundColor: palette.surface,
          boxShadow: shadowFor(style, "small"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...pop(progress),
        }}
      >
        <Glyph name={icon} size={72} color={palette.onSurface} />
      </div>
    </>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const frame = useCurrentFrame();
  const style = useStyle();
  const { palette } = style;
  const hero = useReveal(at.icon);
  const label = useReveal(at.label);
  const breathe = useFloat(0.04, 50);
  const dark = roleColor(style, props.color);
  const light = mix(dark, palette.surface, 0.45);
  const glow = style.flourishes.glow;
  const labelSize = 52;
  const spin = frame * 0.004;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {glow && [0, 1].map((ring) => {
        const phase = ((frame + ring * 30) % 60) / 60;
        return (
          <div
            key={ring}
            style={{
              position: "absolute",
              left: CENTER.x - 160,
              top: CENTER.y - 160,
              width: 320,
              height: 320,
              borderRadius: 160,
              border: `6px solid ${light}`,
              opacity: (1 - phase) * 0.6 * clamp01(hero),
              transform: `scale(${1 + phase * 0.9})`,
            }}
          />
        );
      })}
      {props.satellites.map((satellite, k) => (
        <Satellite
          key={satellite.key}
          icon={satellite.icon}
          index={k}
          at={at[satellite.key]}
          angle={-Math.PI / 2 + (k / Math.max(props.satellites.length, 1)) * Math.PI * 2 + spin + 0.4}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: CENTER.x - 160,
          top: CENTER.y - 160,
          width: 320,
          height: 320,
          borderRadius: 160,
          background: `radial-gradient(circle at 35% 30%, ${light}, ${dark})`,
          boxShadow: glow ? `0 0 80px ${light}, 0 30px 60px ${alpha(shadowColor(style), 0.5)}` : shadowFor(style, "card"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${(0.3 + 0.7 * hero) * (1 + breathe)})`,
          opacity: clamp01(hero * 2),
        }}
      >
        <Glyph name={props.icon} size={170} color={readableOn(style, dark)} />
      </div>
      {props.label && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center", ...rise(label) }}>
          <div style={{ padding: "18px 44px", borderRadius: 999, backgroundColor: palette.surface, color: palette.onSurface, fontFamily: fontStack(style.type.display), fontSize: labelSize, fontWeight: style.type.displayWeight, letterSpacing: -1, boxShadow: shadowFor(style, "small") }}>
            {headline(style, props.label)}
          </div>
        </div>
      )}
    </div>
  );
}

export const Concept = defineTemplate({
  name: "Concept",
  description:
    'One idea as a big glowing icon with pulse rings, optional related icons orbiting it, and a short label, e.g. "niching down" as a target. Elements: "icon", "label", and each satellite\'s key.',
  schema,
  revealKeys: (props) => ["icon", ...(props.label ? ["label"] : []), ...props.satellites.map((s) => s.key)],
  spokenTexts: (props) => [props.label],
  example: {
    icon: "target",
    label: "Niche down",
    satellites: [
      { key: "chef", icon: "chef-hat" },
      { key: "book", icon: "book-open" },
      { key: "save", icon: "bookmark" },
    ],
    color: "accent",
  },
  Component,
});
