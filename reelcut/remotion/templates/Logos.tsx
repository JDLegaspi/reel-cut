import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { BRANDS, BrandMark } from "./icons.tsx";
import { pop, rise, useFloat, useReveal } from "./parts.tsx";
import { softShadow, theme } from "./theme.ts";

const schema = z.object({
  brands: z
    .array(z.object({ key: z.string().min(1).max(20), brand: z.enum(BRANDS) }))
    .min(1)
    .max(4)
    .describe("platforms or companies the speaker names"),
  label: z.string().min(1).max(30).nullable(),
});

type Props = z.infer<typeof schema>;

function Tile({ brand, at, index, x, y, size }: { brand: Props["brands"][number]["brand"]; at: number | undefined; index: number; x: number; y: number; size: number }) {
  const progress = useReveal(at, index * 5, { damping: 10, stiffness: 180, mass: 0.7 });
  const bob = useFloat(12, 64, index * 1.7);
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2 + bob,
        width: size,
        height: size,
        borderRadius: size * 0.26,
        backgroundColor: theme.paper,
        boxShadow: softShadow,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `${pop(progress, 0.2).transform} rotate(${(1 - progress) * (index % 2 === 0 ? -25 : 25)}deg)`,
        opacity: pop(progress).opacity,
      }}
    >
      <BrandMark brand={brand} size={size * 0.56} />
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const label = useReveal(at.label);
  const count = props.brands.length;
  const size = count <= 2 ? 300 : count === 3 ? 250 : 220;
  const positions =
    count === 4
      ? [[330, 250], [750, 250], [330, 560], [750, 560]]
      : props.brands.map((_, k) => [(1080 / count) * k + 540 / count, 400]);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {props.brands.map((item, k) => (
        <Tile key={item.key} brand={item.brand} at={at[item.key]} index={k} x={positions[k]![0]!} y={positions[k]![1]!} size={size} />
      ))}
      {props.label && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center", ...rise(label) }}>
          <div style={{ padding: "18px 44px", borderRadius: 999, backgroundColor: theme.yellow, color: theme.ink, fontSize: 52, fontWeight: 900, letterSpacing: -1 }}>
            {props.label}
          </div>
        </div>
      )}
    </div>
  );
}

export const Logos = defineTemplate({
  name: "Logos",
  description: `One to four platform or company logos bouncing in on white tiles, with an optional label. Brands: ${BRANDS.join(", ")}. Elements: "label", and each logo's key.`,
  schema,
  revealKeys: (props) => [...props.brands.map((item) => item.key), ...(props.label ? ["label"] : [])],
  spokenTexts: (props) => [props.label],
  example: {
    brands: [
      { key: "ig", brand: "instagram" },
      { key: "tt", brand: "tiktok" },
      { key: "yt", brand: "youtube" },
    ],
    label: "Cooking creators",
  },
  Component,
});
