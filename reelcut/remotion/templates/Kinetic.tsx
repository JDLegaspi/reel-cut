import { useCurrentFrame } from "remotion";
import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { clamp01, fitSize, useReveal } from "./parts.tsx";
import { theme } from "./theme.ts";

const schema = z.object({
  lines: z
    .array(
      z.object({
        key: z.string().min(1).max(20),
        text: z.string().min(1).max(14),
        style: z.enum(["plain", "highlight", "outline"]).describe("highlight: dark text on a yellow block; outline: hollow letters"),
      }),
    )
    .min(1)
    .max(3)
    .describe("one to three very short lines that slam in, the punchline in the speaker's own words"),
});

type Props = z.infer<typeof schema>;
type Line = Props["lines"][number];

function Slam({ line, at, index }: { line: Line; at: number | undefined; index: number }) {
  const frame = useCurrentFrame();
  const progress = useReveal(at, index * 4, { damping: 12, stiffness: 260, mass: 0.8 });
  const since = frame - (at ?? 0) - index * 4;
  const shake = since > 4 && since < 14 ? Math.sin(since * 2.4) * (14 - since) * 1.4 : 0;
  const size = fitSize(line.text, { max: 210, min: 110, fits: 7 });
  const highlight = line.style === "highlight";
  return (
    <div
      style={{
        alignSelf: "center",
        transform: `translateX(${shake}px) scale(${2.2 - 1.2 * progress}) rotate(${highlight ? -3 : index % 2 === 0 ? -1 : 1}deg)`,
        opacity: clamp01(progress * 2.5),
        padding: highlight ? "6px 34px 14px" : "0 10px",
        backgroundColor: highlight ? theme.yellow : "transparent",
        borderRadius: 18,
        fontSize: size,
        fontWeight: 900,
        letterSpacing: -6,
        lineHeight: 1,
        whiteSpace: "nowrap",
        textTransform: "uppercase",
        color: highlight ? theme.ink : line.style === "outline" ? "transparent" : theme.white,
        WebkitTextStroke: line.style === "outline" ? `5px ${theme.white}` : undefined,
        textShadow: line.style === "plain" ? "0 12px 40px rgba(3,8,45,0.5)" : undefined,
      }}
    >
      {line.text}
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 30 }}>
      {props.lines.map((line, k) => (
        <Slam key={line.key} line={line} at={at[line.key]} index={k} />
      ))}
    </div>
  );
}

export const Kinetic = defineTemplate({
  name: "Kinetic",
  description:
    'One to three huge words slamming in with a shake, for a punchline or a figure worth shouting, e.g. "20X" over "REVENUE". Use sparingly. Elements: each line\'s key.',
  schema,
  revealKeys: (props) => props.lines.map((line) => line.key),
  spokenTexts: (props) => props.lines.map((line) => line.text),
  example: {
    lines: [
      { key: "x", text: "20X", style: "highlight" },
      { key: "revenue", text: "revenue", style: "plain" },
    ],
  },
  Component,
});
