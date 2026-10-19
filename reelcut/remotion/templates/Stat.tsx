import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { Glyph, iconName } from "./icons.tsx";
import { Card, clamp01, fitSize, pop, useFloat, useProgress, useReveal } from "./parts.tsx";
import { theme } from "./theme.ts";

const schema = z.object({
  value: z.number().describe("the number exactly as spoken, without its unit: 800000 for 'eight hundred thousand'"),
  prefix: z.string().min(1).max(3).nullable().describe("symbol before the number, e.g. '$'"),
  suffix: z.string().min(1).max(10).nullable().describe("unit right after the number, e.g. '%', 'k', 'x', '+'"),
  label: z.string().min(1).max(28).describe("what the number measures, e.g. 'every month'"),
  icon: iconName,
  trend: z.enum(["up", "down", "none"]).describe("draws a rising or falling chart under the number"),
});

type Props = z.infer<typeof schema>;

const UP = [0.08, 0.16, 0.12, 0.3, 0.26, 0.48, 0.44, 0.66, 0.62, 0.9];

function chartPath(trend: "up" | "down", width: number, height: number): { line: string; area: string } {
  const points = UP.map((y, k) => {
    const value = trend === "up" ? y : 1 - y;
    return [(k / (UP.length - 1)) * width, height - value * height * 0.9] as const;
  });
  const line = points.map(([x, y], k) => `${k === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}

function Coin({ x, y, phase, at, symbol }: { x: number; y: number; phase: number; at: number | undefined; symbol: string }) {
  const progress = useReveal(at, 8 + phase * 4);
  const float = useFloat(14, 80, phase);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + float,
        width: 110,
        height: 110,
        borderRadius: 55,
        background: "radial-gradient(circle at 35% 30%, #FFF3B0, #FFD43B 45%, #E0A800)",
        boxShadow: "0 16px 30px rgba(3,8,45,0.4), inset 0 -6px 0 rgba(160,110,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...pop(progress),
      }}
    >
      <Glyph name={symbol} size={60} color="#8A5A00" strokeWidth={2.8} />
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const card = useReveal(0);
  const count = useProgress(at.value, 1.1);
  const chart = useProgress(at.value, 1.4, 4);
  const label = useReveal(at.label);
  const decimals = (String(props.value).split(".")[1] ?? "").length;
  const shown = (props.value * count).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const full = `${props.prefix ?? ""}${props.value.toLocaleString("en-US")}${props.suffix ?? ""}`;
  const tilt = 1 - clamp01(card);
  const trendColor = props.trend === "down" ? theme.red : theme.green;
  const paths = props.trend === "none" ? null : chartPath(props.trend, 740, 200);
  const money = props.prefix === "$" || props.prefix === "€" || props.prefix === "£";
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", perspective: 1800 }}>
      {money && (
        <>
          <Coin x={60} y={120} phase={0} at={at.value} symbol="dollar-sign" />
          <Coin x={900} y={90} phase={1.7} at={at.value} symbol="dollar-sign" />
          <Coin x={930} y={700} phase={3.1} at={at.value} symbol="dollar-sign" />
        </>
      )}
      <Card
        style={{
          width: 840,
          padding: "52px 52px 40px",
          transform: `rotateX(${8 + tilt * 20}deg) rotateY(${-10 - tilt * 14}deg) scale(${0.8 + 0.2 * card})`,
          opacity: clamp01(card * 2),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, ...{ opacity: clamp01(label * 2) } }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 26,
              background: `linear-gradient(135deg, ${theme.blue}, #6A8BFF)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Glyph name={props.icon} size={54} color="#fff" />
          </div>
          <div style={{ fontSize: 42, fontWeight: 700, color: theme.inkMuted }}>{props.label}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginTop: 26 }}>
          <div
            style={{
              fontSize: fitSize(full, { max: 150, min: 88, fits: 7 }),
              fontWeight: 900,
              letterSpacing: -6,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {props.prefix}
            {shown}
            {props.suffix}
          </div>
          {props.trend !== "none" && (
            <div
              style={{
                marginBottom: 18,
                padding: "10px 18px",
                borderRadius: 999,
                backgroundColor: props.trend === "up" ? "#DCFCE7" : "#FFE4E6",
                display: "flex",
                ...pop(clamp01(count * 1.4)),
              }}
            >
              <Glyph name={props.trend === "up" ? "trending-up" : "trending-down"} size={46} color={trendColor} strokeWidth={3} />
            </div>
          )}
        </div>
        {paths && (
          <svg width={740} height={200} style={{ marginTop: 28, overflow: "visible" }}>
            <defs>
              <linearGradient id="stat-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
              </linearGradient>
              <clipPath id="stat-reveal">
                <rect x={0} y={-20} width={740 * chart} height={240} />
              </clipPath>
            </defs>
            <path d={paths.area} fill="url(#stat-fill)" clipPath="url(#stat-reveal)" />
            <path
              d={paths.line}
              fill="none"
              stroke={trendColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - chart}
            />
          </svg>
        )}
      </Card>
    </div>
  );
}

export const Stat = defineTemplate({
  name: "Stat",
  description:
    'A dashboard card for one number the speaker says: an icon, the number counting up with its unit, a trend chart drawing in, and floating coins for money. The number must be said in the segment. Elements: "value", "label".',
  schema,
  revealKeys: () => ["value", "label"],
  spokenNumbers: (props) => [props.value],
  example: { value: 800000, prefix: "$", suffix: null, label: "every month", icon: "wallet", trend: "up" },
  Component,
});
