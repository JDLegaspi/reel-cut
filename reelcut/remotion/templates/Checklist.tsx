import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { Card, clamp01, rise, useProgress, useReveal } from "./parts.tsx";
import { theme } from "./theme.ts";

const schema = z.object({
  title: z.string().min(1).max(32),
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(20),
        text: z.string().min(1).max(30),
        mark: z.enum(["check", "cross"]).describe("check for something to do, cross for something to avoid"),
      }),
    )
    .min(2)
    .max(4),
});

type Props = z.infer<typeof schema>;
type Item = Props["items"][number];

function Row({ item, at }: { item: Item; at: number | undefined }) {
  const row = useReveal(at);
  const stroke = useProgress(at, 0.45, 5);
  const good = item.mark === "check";
  const color = good ? theme.green : theme.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 34, ...rise(row, 40) }}>
      <svg width={84} height={84} viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
        <rect x={4} y={4} width={76} height={76} rx={22} fill={stroke > 0 ? `${color}22` : theme.paperDim} stroke={stroke > 0 ? color : theme.line} strokeWidth={5} />
        {good ? (
          <path d="M22,44 L37,58 L63,28" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - stroke} />
        ) : (
          <path d="M26,26 L58,58 M58,26 L26,58" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - stroke} />
        )}
      </svg>
      <div style={{ position: "relative", fontSize: 52, fontWeight: 800, letterSpacing: -1, color: good ? theme.ink : theme.inkMuted }}>
        {item.text}
        {!good && <div style={{ position: "absolute", left: 0, top: "52%", height: 6, borderRadius: 3, width: `${clamp01(stroke) * 100}%`, backgroundColor: theme.red }} />}
      </div>
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const card = useReveal(at.title);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", perspective: 1800 }}>
      <Card style={{ width: 880, padding: "52px 60px 60px", transform: `rotateX(${(1 - card) * 20 + 5}deg) rotateY(5deg) scale(${0.85 + 0.15 * card})`, opacity: clamp01(card * 2) }}>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2 }}>{props.title}</div>
        <div style={{ width: 140, height: 12, borderRadius: 6, backgroundColor: theme.yellow, marginTop: 20 }} />
        {props.items.map((item) => (
          <Row key={item.key} item={item} at={at[item.key]} />
        ))}
      </Card>
    </div>
  );
}

export const Checklist = defineTemplate({
  name: "Checklist",
  description:
    'A card with a title and two to four items that tick or cross themselves off, crossed items struck through, for dos and don\'ts or steps to follow. Elements: "title", and each item\'s key.',
  schema,
  revealKeys: (props) => ["title", ...props.items.map((item) => item.key)],
  spokenTexts: (props) => [props.title, ...props.items.map((item) => item.text)],
  example: {
    title: "Their paywall",
    items: [
      { key: "free", text: "5 free recipe saves", mark: "check" },
      { key: "pay", text: "Then you have to pay", mark: "check" },
      { key: "ten", text: "10 features, done badly", mark: "cross" },
    ],
  },
  Component,
});
