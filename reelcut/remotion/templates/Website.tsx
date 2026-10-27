import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { z } from "zod";
import { useBrand } from "../BrandsContext.tsx";
import { useStyle } from "../style/StyleContext.tsx";
import { alpha, fontStack, headline, shadowFor } from "../style/tokens.ts";
import { defineTemplate } from "./defineTemplate.ts";
import { pop, rise, useReveal } from "./parts.tsx";

const schema = z.object({
  brand: z.string().min(1).max(30).describe("a company from the brands list that has a website"),
  caption: z.string().min(1).max(32).nullable().describe("a short label from the speaker's words, such as their role there"),
});

type Props = z.infer<typeof schema>;

const WINDOW = { left: 70, top: 90, width: 940, bar: 58 };
const SHOT_HEIGHT = Math.round((WINDOW.width * 600) / 960);

function Placeholder() {
  const style = useStyle();
  const line = (width: number, top: number) => (
    <div style={{ position: "absolute", left: 60, top, width, height: 26, borderRadius: 13, backgroundColor: alpha(style.palette.onSurface, 0.12) }} />
  );
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: style.palette.surface }}>
      {line(520, 120)}
      {line(380, 170)}
      {line(640, 260)}
      {line(600, 300)}
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const style = useStyle();
  const { palette } = style;
  const brand = useBrand(props.brand);
  const frame = useCurrentFrame();
  const shown = useReveal(at.site, 0, { damping: 16, stiffness: 120 });
  const caption = useReveal(at.caption, 6);
  const drift = interpolate(frame - (at.site ?? 0), [0, 150], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const radius = Math.max(16, style.shape.radius);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: WINDOW.left,
          top: WINDOW.top,
          width: WINDOW.width,
          height: WINDOW.bar + SHOT_HEIGHT,
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: palette.surface,
          border: `2px solid ${alpha(palette.onBackdrop, 0.18)}`,
          boxShadow: shadowFor(style, "card"),
          ...pop(shown, 0.85),
        }}
      >
        <div style={{ height: WINDOW.bar, display: "flex", alignItems: "center", gap: 12, padding: "0 22px", backgroundColor: alpha(palette.onSurface, 0.06) }}>
          {[0, 1, 2].map((k) => (
            <div key={k} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: alpha(palette.onSurface, 0.22) }} />
          ))}
          <div
            style={{
              marginLeft: 18,
              flex: 1,
              height: 34,
              borderRadius: 17,
              backgroundColor: alpha(palette.onSurface, 0.08),
              color: palette.onSurfaceMuted,
              fontFamily: fontStack(style.type.body),
              fontSize: 22,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              paddingLeft: 20,
            }}
          >
            {brand?.url ?? props.brand.toLowerCase()}
          </div>
        </div>
        <div style={{ position: "relative", height: SHOT_HEIGHT, overflow: "hidden" }}>
          {brand?.site ? (
            <Img
              src={staticFile(brand.site)}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", transform: `scale(${drift})`, transformOrigin: "50% 0%" }}
            />
          ) : (
            <Placeholder />
          )}
        </div>
      </div>
      {props.caption && (
        <div style={{ position: "absolute", left: 0, right: 0, top: WINDOW.top + WINDOW.bar + SHOT_HEIGHT + 44, display: "flex", justifyContent: "center", ...rise(caption) }}>
          <div
            style={{
              padding: "14px 38px",
              borderRadius: 999,
              backgroundColor: palette.accent,
              color: palette.onAccent,
              fontFamily: fontStack(style.type.display),
              fontSize: 48,
              fontWeight: style.type.displayWeight,
              letterSpacing: -1,
            }}
          >
            {headline(style, props.caption)}
          </div>
        </div>
      )}
    </div>
  );
}

export const Website = defineTemplate({
  name: "Website",
  description:
    'A company\'s real website in a browser window, gently zooming, with an optional caption pill underneath. Use it when the speaker introduces a company from the brands list that has a website. Elements: "site", "caption".',
  schema,
  revealKeys: (props) => ["site", ...(props.caption ? ["caption"] : [])],
  spokenTexts: (props) => [props.caption],
  brandsUsed: (props) => [{ name: props.brand, needs: "site" }],
  example: { brand: "Acme", caption: "Lead designer" },
  Component,
});
