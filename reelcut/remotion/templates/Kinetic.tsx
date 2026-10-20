import { useCurrentFrame } from "remotion";
import { z } from "zod";
import { useStyle } from "../style/StyleContext.tsx";
import { fontStack, headline, tracking } from "../style/tokens.ts";
import { defineTemplate } from "./defineTemplate.ts";
import { clamp01, fitSize, Marker, useProgress, useReveal } from "./parts.tsx";

function asSpoken(text: unknown): unknown {
  if (typeof text !== "string") return text;
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length <= 4 || letters !== letters.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.replace(/^\p{L}/u, (first) => first.toUpperCase());
}

const schema = z.object({
  lines: z
    .array(
      z.object({
        key: z.string().min(1).max(20),
        text: z.preprocess(asSpoken, z.string().min(1).max(16)).describe("written as spoken; lines in capitals are turned into sentence case"),
        style: z.enum(["plain", "highlight", "outline"]).describe("highlight: a marker stroke swipes in behind the words; outline: hollow letters"),
      }),
    )
    .min(1)
    .max(3)
    .describe("one to three short lines, the punchline in the speaker's own words, written as spoken"),
});

type Props = z.infer<typeof schema>;
type Line = Props["lines"][number];

const ENTRANCE = { damping: 18, stiffness: 120, mass: 0.9 };
const STAGGER = 6;

function KineticLine({ line, at, index }: { line: Line; at: number | undefined; index: number }) {
  const frame = useCurrentFrame();
  const style = useStyle();
  const { palette } = style;
  const progress = useReveal(at, index * STAGGER, ENTRANCE);
  const swipe = useProgress(at, 0.35, index * STAGGER + 8);
  const since = frame - (at ?? 0) - index * STAGGER - 6;
  const shake = style.flourishes.shake && since > 0 && since < 8 ? Math.sin(since * 2.2) * (8 - since) * 0.75 : 0;
  const highlight = line.style === "highlight";
  const size = fitSize(line.text, { max: 150, min: 90, fits: 9 });
  const text = headline(style, line.text);
  const padding = "0 22px 8px";
  return (
    <div
      style={{
        position: "relative",
        alignSelf: "center",
        opacity: clamp01(progress * 2),
        transform: `translate(${shake}px, ${(1 - progress) * 50}px) scale(${0.94 + 0.06 * progress})`,
        padding,
        fontFamily: fontStack(style.type.display),
        fontSize: size,
        fontWeight: style.type.displayWeight,
        letterSpacing: tracking(style, size) * 0.6,
        lineHeight: 1.05,
        whiteSpace: "nowrap",
        color: line.style === "outline" ? "transparent" : palette.onBackdrop,
        WebkitTextStroke: line.style === "outline" ? `3px ${palette.onBackdrop}` : undefined,
      }}
    >
      {text}
      {highlight && (
        <Marker progress={swipe} padding={padding}>
          {text}
        </Marker>
      )}
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
      {props.lines.map((line, k) => (
        <KineticLine key={line.key} line={line} at={at[line.key]} index={k} />
      ))}
    </div>
  );
}

export const Kinetic = defineTemplate({
  name: "Kinetic",
  description:
    'One to three short lines in the speaker\'s own words rising in one after another, for the single line that lands hardest, e.g. "20x" over "revenue". Write the words as spoken, never in capitals. Use it at most once per video. Elements: each line\'s key.',
  schema,
  revealKeys: (props) => props.lines.map((line) => line.key),
  spokenTexts: (props) => props.lines.map((line) => line.text),
  example: {
    lines: [
      { key: "x", text: "20x", style: "highlight" },
      { key: "revenue", text: "revenue", style: "plain" },
    ],
  },
  Component,
});
