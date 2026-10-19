import { useCurrentFrame } from "remotion";
import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { Glyph, iconName } from "./icons.tsx";
import { clamp01, pop, rise, useFloat, useReveal } from "./parts.tsx";
import { softShadow, theme } from "./theme.ts";

const ACCENTS = [theme.blue, "#7C5CFF", theme.green, "#F97316"];

const schema = z.object({
  steps: z
    .array(
      z.object({
        key: z.string().min(1).max(20).describe("short unique id"),
        icon: iconName,
        label: z.string().min(1).max(16),
      }),
    )
    .min(2)
    .max(4)
    .describe("two to four stages in order, e.g. creator, video, app"),
});

type Props = z.infer<typeof schema>;
type Step = Props["steps"][number];

const TILE = 210;
const ROW_Y = 300;

function Node({ step, x, at, index, color }: { step: Step; x: number; at: number | undefined; index: number; color: string }) {
  const progress = useReveal(at);
  const bob = useFloat(8, 70, index * 1.1);
  return (
    <div style={{ position: "absolute", left: x - TILE / 2, top: ROW_Y + bob, width: TILE, display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
      <div
        style={{
          width: TILE,
          height: TILE,
          borderRadius: 56,
          backgroundColor: theme.paper,
          boxShadow: `${softShadow}, inset 0 -10px 0 ${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...pop(progress),
        }}
      >
        <Glyph name={step.icon} size={112} color={color} strokeWidth={2.3} />
      </div>
      <div style={{ fontSize: 44, fontWeight: 900, color: theme.white, textAlign: "center", letterSpacing: -1, lineHeight: 1.05, ...rise(progress, 30) }}>
        {step.label}
      </div>
    </div>
  );
}

function Link({ from, to, at }: { from: number; to: number; at: number | undefined }) {
  const frame = useCurrentFrame();
  const progress = useReveal(at, -4);
  const start = from + TILE / 2 + 16;
  const end = to - TILE / 2 - 16;
  const y = ROW_Y + TILE / 2;
  const length = (end - start) * clamp01(progress);
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1080} height={960}>
      <line x1={start} y1={y} x2={start + length} y2={y} stroke="rgba(255,255,255,0.5)" strokeWidth={8} strokeLinecap="round" strokeDasharray="2 18" />
      {progress > 0.9 &&
        [0, 1, 2].map((dot) => {
          const t = ((frame / 26 + dot / 3) % 1) * (end - start);
          return <circle key={dot} cx={start + t} cy={y} r={11} fill={theme.yellow} />;
        })}
      {progress > 0.9 && <path d={`M${end - 22},${y - 20} L${end},${y} L${end - 22},${y + 20}`} stroke={theme.yellow} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const count = props.steps.length;
  const gap = 1080 / count;
  const xs = props.steps.map((_, k) => gap * k + gap / 2);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {props.steps.slice(1).map((step, k) => (
        <Link key={step.key} from={xs[k]!} to={xs[k + 1]!} at={at[step.key]} />
      ))}
      {props.steps.map((step, k) => (
        <Node key={step.key} step={step} x={xs[k]!} at={at[step.key]} index={k} color={ACCENTS[k % ACCENTS.length]!} />
      ))}
    </div>
  );
}

export const Flow = defineTemplate({
  name: "Flow",
  description:
    'Two to four stages as icon tiles in a row, linked by connectors with dots flowing along them, e.g. creator → video → app. Elements: each step\'s key.',
  schema,
  revealKeys: (props) => props.steps.map((step) => step.key),
  spokenTexts: (props) => props.steps.map((step) => step.label),
  example: {
    steps: [
      { key: "creator", icon: "chef-hat", label: "Creators" },
      { key: "video", icon: "clapperboard", label: "Videos" },
      { key: "app", icon: "smartphone", label: "ReciMe" },
    ],
  },
  Component,
});
