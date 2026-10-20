import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import type { SheetProps } from "./props.ts";
import { Emphasis } from "./Shots.tsx";
import { StyleProvider, useStyle } from "./style/StyleContext.tsx";
import { StyleFonts } from "./style/StyleFonts.tsx";
import { fontStack } from "./style/tokens.ts";
import { TemplateView } from "./TemplateView.tsx";
import { Backdrop, Camera } from "./templates/parts.tsx";
import { TEMPLATES } from "./templates/registry.ts";
import { BOX } from "./templates/theme.ts";

const COLUMNS = 3;
const SCALE = 0.5;

function Tile({ index, children }: { index: number; children: ReactNode }) {
  const left = (index % COLUMNS) * BOX.width * SCALE;
  const top = Math.floor(index / COLUMNS) * BOX.height * SCALE;
  return (
    <div style={{ position: "absolute", left, top, width: BOX.width * SCALE, height: BOX.height * SCALE, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: BOX.width, height: BOX.height, transform: `scale(${SCALE})`, transformOrigin: "top left", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Swatches() {
  const style = useStyle();
  const { palette, type } = style;
  const chips = [...palette.backdrop, palette.surface, palette.onSurface, palette.accent, palette.positive, palette.negative, ...palette.tints];
  return (
    <AbsoluteFill style={{ padding: 70, gap: 40, color: palette.onBackdrop, fontFamily: fontStack(type.body) }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
        {chips.map((color, k) => (
          <div key={k} style={{ width: 120, height: 120, borderRadius: Math.min(style.shape.radius, 60), backgroundColor: color, boxShadow: `0 0 0 3px ${palette.onBackdropMuted}` }} />
        ))}
      </div>
      <div style={{ fontFamily: fontStack(type.display), fontWeight: type.displayWeight, fontSize: 84, lineHeight: 1 }}>{type.display}</div>
      <div style={{ fontSize: 48, fontWeight: 500, color: palette.onBackdropMuted }}>{type.body}</div>
    </AbsoluteFill>
  );
}

export function StyleSheet({ style, fonts }: SheetProps) {
  return (
    <StyleProvider style={style}>
      <StyleFonts fonts={fonts} />
      <AbsoluteFill style={{ backgroundColor: style.palette.backdrop[1] }}>
        {TEMPLATES.map((template, k) => (
          <Tile key={template.name} index={k}>
            <Backdrop />
            <Camera>
              <TemplateView template={template.name} props={template.example as Record<string, unknown>} at={{}} />
            </Camera>
          </Tile>
        ))}
        <Tile index={TEMPLATES.length}>
          <Backdrop />
          <Emphasis word={{ from: 0, durationInFrames: 120, text: "growth strategy" }} index={1} top={390} />
        </Tile>
        <Tile index={TEMPLATES.length + 1}>
          <Backdrop />
          <Swatches />
        </Tile>
      </AbsoluteFill>
    </StyleProvider>
  );
}
