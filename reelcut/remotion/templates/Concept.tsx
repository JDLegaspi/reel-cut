import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { Glyph, iconName } from "./icons.tsx";
import { clamp01, pop, rise, useFloat, useReveal } from "./parts.tsx";
import { softShadow, theme } from "./theme.ts";
import { useCurrentFrame } from "remotion";

const COLORS = { blue: ["#7DA2FF", theme.blue], green: ["#86EFAC", theme.green], yellow: ["#FFE680", "#F5B400"], violet: ["#D3C3FF", "#7C5CFF"], red: ["#FDA4AF", theme.red] } as const;

const schema = z.object({
  icon: iconName.describe("the main idea as a lucide icon in kebab-case, e.g. target, chef-hat, rocket"),
  label: z.string().min(1).max(28).nullable().describe("a few words naming the idea"),
  satellites: z
    .array(z.object({ key: z.string().min(1).max(20), icon: iconName }))
    .max(5)
    .describe("up to five related things the speaker mentions, orbiting the main icon"),
  color: z.enum(["blue", "green", "yellow", "violet", "red"]),
});

type Props = z.infer<typeof schema>;

const CENTER = { x: 540, y: 400 };
const ORBIT = { x: 360, y: 250 };

function Satellite({ icon, angle, at, index }: { icon: string; angle: number; at: number | undefined; index: number }) {
  const progress = useReveal(at, 6 + index * 3);
  const bob = useFloat(10, 60, index * 1.3);
  const x = CENTER.x + Math.cos(angle) * ORBIT.x;
  const y = CENTER.y + Math.sin(angle) * ORBIT.y + bob;
  return (
    <>
      <svg style={{ position: "absolute", inset: 0, overflow: "visible", opacity: clamp01(progress) * 0.7 }} width={1080} height={960}>
        <line x1={CENTER.x} y1={CENTER.y} x2={x} y2={y} stroke="rgba(255,255,255,0.55)" strokeWidth={4} strokeDasharray="4 14" strokeLinecap="round" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x - 72,
          top: y - 72,
          width: 144,
          height: 144,
          borderRadius: 72,
          backgroundColor: theme.paper,
          boxShadow: softShadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...pop(progress),
        }}
      >
        <Glyph name={icon} size={72} color={theme.ink} />
      </div>
    </>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const frame = useCurrentFrame();
  const hero = useReveal(at.icon);
  const label = useReveal(at.label);
  const breathe = useFloat(0.04, 50);
  const [light, dark] = COLORS[props.color];
  const spin = frame * 0.004;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {[0, 1].map((ring) => {
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
          boxShadow: `0 0 80px ${light}, 0 30px 60px rgba(3,8,45,0.5)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${(0.3 + 0.7 * hero) * (1 + breathe)})`,
          opacity: clamp01(hero * 2),
        }}
      >
        <Glyph name={props.icon} size={170} color="#fff" strokeWidth={2.2} />
      </div>
      {props.label && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center", ...rise(label) }}>
          <div style={{ padding: "18px 44px", borderRadius: 999, backgroundColor: theme.paper, color: theme.ink, fontSize: 52, fontWeight: 900, letterSpacing: -1, boxShadow: softShadow }}>
            {props.label}
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
    color: "yellow",
  },
  Component,
});
