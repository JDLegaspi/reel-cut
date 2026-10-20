import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { Glyph, iconName } from "./icons.tsx";
import { useStyle } from "../style/StyleContext.tsx";
import { alpha, fontStack, mix, readableOn, shadowFor } from "../style/tokens.ts";
import { Card, clamp01, pop, useFloat, useReveal } from "./parts.tsx";

const side = z.object({
  icon: iconName,
  count: z.number().int().min(1).max(12).describe("how many copies of the icon to show: 1 for 'one thing', 10 for 'ten things'"),
  label: z.string().min(1).max(26),
  verdict: z.enum(["good", "bad"]),
});

const schema = z.object({ left: side, right: side });

type Props = z.infer<typeof schema>;
type Side = Props["left"];

function Cluster({ side, at }: { side: Side; at: number | undefined }) {
  const progress = useReveal(at, 4);
  const style = useStyle();
  const good = side.verdict === "good";
  const color = good ? style.palette.positive : style.palette.negative;
  if (side.count === 1) {
    return (
      <div
        style={{
          width: 230,
          height: 230,
          borderRadius: 115,
          background: `radial-gradient(circle at 35% 30%, ${mix(color, style.palette.surface, 0.45)}, ${color})`,
          boxShadow: `0 0 0 18px ${alpha(color, 0.15)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...pop(progress),
        }}
      >
        <Glyph name={side.icon} size={130} color={readableOn(style, color)} />
      </div>
    );
  }
  const columns = Math.ceil(Math.sqrt(side.count));
  const size = Math.floor(300 / columns) - 14;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, ${size}px)`, gap: 14, justifyContent: "center" }}>
      {Array.from({ length: side.count }, (_, k) => (
        <Tile key={k} index={k} size={size} side={side} at={at} />
      ))}
    </div>
  );
}

function Tile({ index, size, side, at }: { index: number; size: number; side: Side; at: number | undefined }) {
  const progress = useReveal(at, 3 + index * 2);
  const wobble = useFloat(side.verdict === "bad" ? 7 : 0, 22, index);
  const style = useStyle();
  const good = side.verdict === "good";
  const color = good ? style.palette.positive : style.palette.negative;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: mix(color, style.palette.surface, 0.82),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${0.4 + 0.6 * progress}) rotate(${wobble}deg)`,
        opacity: clamp01(progress * 1.8) * (good ? 1 : 0.85),
      }}
    >
      <Glyph name={side.icon} size={size * 0.56} color={color} />
    </div>
  );
}

function Panel({ side, at, x }: { side: Side; at: number | undefined; x: number }) {
  const progress = useReveal(at);
  const style = useStyle();
  const good = side.verdict === "good";
  const color = good ? style.palette.positive : style.palette.negative;
  const lean = style.shape.tilt ? (x < 500 ? -3 : 3) * (1 - progress * 0.6) : 0;
  return (
    <Card
      style={{
        position: "absolute",
        left: x,
        top: 110,
        width: 430,
        height: 690,
        padding: 36,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        transform: `translateY(${(1 - progress) * 120}px) rotate(${lean}deg)`,
        opacity: clamp01(progress * 2),
        boxShadow: good ? [`0 0 0 6px ${alpha(color, 0.55)}`, shadowFor(style, "card")].filter(Boolean).join(", ") : undefined,
      }}
    >
      <div style={{ alignSelf: "flex-start", width: 76, height: 76, borderRadius: 38, backgroundColor: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Glyph name={good ? "check" : "x"} size={48} color={readableOn(style, color)} strokeWidth={4} />
      </div>
      <Cluster side={side} at={at} />
      <div style={{ fontSize: 46, fontWeight: 800, textAlign: "center", lineHeight: 1.1, letterSpacing: -1 }}>{side.label}</div>
    </Card>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const vs = useReveal(at.right, 2);
  const style = useStyle();
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Panel side={props.left} at={at.left} x={70} />
      <Panel side={props.right} at={at.right} x={580} />
      <div
        style={{
          position: "absolute",
          left: 540 - 70,
          top: 380,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: style.palette.accent,
          color: style.palette.onAccent,
          fontFamily: fontStack(style.type.display),
          fontSize: 56,
          fontWeight: style.type.displayWeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: shadowFor(style, "small"),
          ...pop(vs),
        }}
      >
        VS
      </div>
    </div>
  );
}

export const Versus = defineTemplate({
  name: "Versus",
  description:
    'Two side-by-side cards weighed against each other, each drawn as a cluster of icons (one big icon, or a grid of up to twelve) with a short label and a good or bad verdict, e.g. one app done well versus ten things done badly. Elements: "left", "right".',
  schema,
  revealKeys: () => ["left", "right"],
  spokenTexts: (props) => [props.left.label, props.right.label],
  example: {
    left: { icon: "layout-grid", count: 10, label: "10 things, badly", verdict: "bad" },
    right: { icon: "target", count: 1, label: "1 thing, extremely well", verdict: "good" },
  },
  Component,
});
