import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { Glyph, iconName } from "./icons.tsx";
import { Card, clamp01, fitSize, pop, rise, useFloat, useReveal } from "./parts.tsx";
import { softShadow, theme } from "./theme.ts";

const schema = z.object({
  position: z
    .object({
      index: z.number().int().min(1),
      total: z.number().int().min(1).nullable().describe("how many items, when the speaker makes it clear"),
    })
    .nullable(),
  title: z.string().min(1).max(48).describe("the item's name or title"),
  subtitle: z.string().min(1).max(32).nullable().describe("who made it, or what kind of thing it is"),
  icon: iconName.describe("what the item is about"),
  badges: z.array(z.string().min(1).max(16)).max(3).describe("up to three short facts the speaker gives, e.g. '6 hours', 'Free'"),
});

type Props = z.infer<typeof schema>;

function Badge({ text, at, index }: { text: string; at: number | undefined; index: number }) {
  const progress = useReveal(at, index * 3);
  return (
    <div style={{ padding: "14px 30px", borderRadius: 999, backgroundColor: theme.yellow, color: theme.ink, fontSize: 40, fontWeight: 900, boxShadow: softShadow, ...pop(progress) }}>
      {text}
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const card = useReveal(at.title);
  const position = useReveal(at.position);
  const subtitle = useReveal(at.subtitle);
  const bob = useFloat(10, 80);
  const { position: place } = props;
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1800 }}>
      {place && (
        <div style={{ position: "absolute", left: 80, top: 70, display: "flex", alignItems: "center", gap: 24, ...pop(position) }}>
          <div style={{ width: 180, height: 180, borderRadius: 90, backgroundColor: theme.yellow, color: theme.ink, fontSize: 120, fontWeight: 900, letterSpacing: -6, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: softShadow }}>
            {place.index}
          </div>
          {place.total !== null && (
            <div style={{ display: "flex", gap: 12 }}>
              {Array.from({ length: Math.min(place.total, 10) }, (_, k) => (
                <div key={k} style={{ width: 44, height: 14, borderRadius: 7, backgroundColor: k < place.index ? theme.yellow : "rgba(255,255,255,0.3)" }} />
              ))}
            </div>
          )}
        </div>
      )}
      <Card
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 300 + bob,
          padding: 44,
          display: "flex",
          gap: 40,
          alignItems: "center",
          transform: `rotateX(${(1 - card) * 25 + 4}deg) rotateY(-6deg) translateY(${(1 - card) * 120}px)`,
          opacity: clamp01(card * 2),
        }}
      >
        <div style={{ width: 190, height: 190, borderRadius: 52, flexShrink: 0, background: `linear-gradient(140deg, ${theme.blue}, #7C5CFF)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Glyph name={props.icon} size={110} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: fitSize(props.title, { max: 72, min: 48, fits: 18 }), fontWeight: 900, letterSpacing: -2, lineHeight: 1.04 }}>{props.title}</div>
          {props.subtitle && <div style={{ fontSize: 40, fontWeight: 700, color: theme.inkMuted, marginTop: 14, ...rise(subtitle, 20) }}>{props.subtitle}</div>}
        </div>
      </Card>
      {props.badges.length > 0 && (
        <div style={{ position: "absolute", left: 80, top: 690, display: "flex", gap: 18 }}>
          {props.badges.map((badge, k) => (
            <Badge key={k} text={badge} at={at[`badge-${k}`]} index={k} />
          ))}
        </div>
      )}
    </div>
  );
}

export const Countdown = defineTemplate({
  name: "Countdown",
  description:
    'One item in a list or countdown, or one named resource: a big position number with progress pips, a card with an icon, the title and who made it, and up to three short badges. Elements: "position", "title", "subtitle", "badge-0", "badge-1", "badge-2".',
  schema,
  revealKeys: (props) => [
    ...(props.position ? ["position"] : []),
    "title",
    ...(props.subtitle ? ["subtitle"] : []),
    ...props.badges.map((_, k) => `badge-${k}`),
  ],
  spokenTexts: (props) => props.badges,
  example: {
    position: { index: 1, total: 5 },
    title: "How to Build a Personal Brand",
    subtitle: "Caleb Ralston",
    icon: "graduation-cap",
    badges: ["6 hours", "Free"],
  },
  Component,
});
