import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import type { Style } from "../../src/schemas/style.ts";
import { useStyle } from "../style/StyleContext.tsx";
import { alpha, bezel, darken, fontStack, headline, lighten, mix, readableOn, roleColor, shadowColor, shadowFor } from "../style/tokens.ts";
import { colorRole, Glyph, iconName } from "./icons.tsx";
import { clamp01, pop, rise, useFloat, useProgress, useReveal } from "./parts.tsx";

const app = z.object({
  name: z.string().min(1).max(20),
  icon: iconName,
  color: colorRole,
});

const key = z.string().min(1).max(20).describe("short unique id");

const screen = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("video"),
    creator: z.string().min(1).max(20).nullable().describe("who posted it, as said, e.g. 'cooking creator'"),
    icon: iconName.describe("what the video is about"),
    sticker: z.string().min(1).max(30).nullable().describe("a call-out that pops onto the video and gets tapped, e.g. 'Save recipe with ReciMe'"),
  }),
  z.object({
    type: z.literal("paywall"),
    freeCount: z.number().int().min(1).max(10).describe("how many free uses, as said"),
    unit: z.string().min(1).max(20).describe("what is free, e.g. 'recipe saves'"),
    action: z.string().min(1).max(18).describe("the paywall button, e.g. 'Upgrade'"),
  }),
  z.object({
    type: z.literal("notifications"),
    items: z.array(z.object({ key, title: z.string().min(1).max(28), body: z.string().min(1).max(40) })).min(1).max(3),
  }),
  z.object({
    type: z.literal("listing"),
    subtitle: z.string().min(1).max(30).nullable(),
  }),
]);

const schema = z.object({
  app: app.nullable().describe("the app shown, if the speaker names one"),
  screen,
  callout: z.string().min(1).max(24).nullable().describe("a short label beside the phone, e.g. 'Free recipe saves'"),
});

type Props = z.infer<typeof schema>;
type App = NonNullable<Props["app"]>;

const PHONE = { width: 410, height: 830 };

function appColor(style: Style, app: App | null): string {
  return app ? roleColor(style, app.color) : style.palette.tints[0];
}

function AppIcon({ app, size }: { app: App | null; size: number }) {
  const style = useStyle();
  const color = appColor(style, app);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: `linear-gradient(140deg, ${color}, ${alpha(color, 0.73)})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Glyph name={app?.icon ?? "smartphone"} size={size * 0.58} color={readableOn(style, color)} />
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const style = useStyle();
  const body = bezel(style);
  const shadows = [shadowFor(style, "card"), `inset 0 0 0 3px ${lighten(body, 0.15)}`].filter(Boolean).join(", ");
  return (
    <div style={{ width: PHONE.width, height: PHONE.height, borderRadius: 72, backgroundColor: body, padding: 14, boxShadow: shadows }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 58, overflow: "hidden", backgroundColor: style.palette.surface }}>
        {children}
        <div style={{ position: "absolute", top: 16, left: "50%", width: 130, height: 38, marginLeft: -65, borderRadius: 19, backgroundColor: body }} />
      </div>
    </div>
  );
}

function Tap({ at, x, y }: { at: number | undefined; x: number; y: number }) {
  const progress = useProgress(at, 0.5);
  const style = useStyle();
  if (progress <= 0 || progress >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 60,
        top: y - 60,
        width: 120,
        height: 120,
        borderRadius: 60,
        border: `8px solid ${alpha(style.palette.accent, 0.9)}`,
        opacity: 1 - progress,
        transform: `scale(${0.3 + progress})`,
      }}
    />
  );
}

function VideoScreen({ screen, app, at }: { screen: Extract<Props["screen"], { type: "video" }>; app: App | null; at: Record<string, number> }) {
  const frame = useCurrentFrame();
  const sticker = useReveal(at.sticker ?? 12);
  const tapAt = (at.sticker ?? 12) + 18;
  const saved = frame >= tapAt;
  const bob = useFloat(12, 50);
  const style = useStyle();
  const { palette } = style;
  const tone = appColor(style, app);
  const ink = readableOn(style, tone);
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(165deg, ${lighten(tone, 0.35)}, ${tone} 45%, ${darken(tone, 0.35)})` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230 + bob, display: "flex", justifyContent: "center" }}>
        <Glyph name={screen.icon} size={200} color={alpha(ink, 0.95)} strokeWidth={1.8} />
      </div>
      <div style={{ position: "absolute", right: 22, bottom: 170, display: "flex", flexDirection: "column", gap: 34, alignItems: "center" }}>
        <Glyph name="heart" size={54} color={ink} />
        <Glyph name="message-circle" size={54} color={ink} />
        <div style={{ transform: saved ? "scale(1.25)" : "scale(1)" }}>
          <svg width={54} height={54} viewBox="0 0 24 24">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill={saved ? palette.accent : "none"} stroke={saved ? palette.accent : ink} strokeWidth={2} strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {screen.creator && (
        <div style={{ position: "absolute", left: 26, bottom: 96, fontSize: 30, fontWeight: 800, color: ink }}>@{screen.creator.replace(/\s+/g, "").toLowerCase()}</div>
      )}
      <div style={{ position: "absolute", left: 26, right: 26, bottom: 64, height: 6, borderRadius: 3, backgroundColor: alpha(ink, 0.35) }}>
        <div style={{ width: `${(frame % 150) / 1.5}%`, height: "100%", borderRadius: 3, backgroundColor: ink }} />
      </div>
      {screen.sticker && (
        <div style={{ position: "absolute", left: 22, right: 22, top: 520, ...pop(sticker, 0.2) }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: Math.min(28, style.shape.radius), backgroundColor: palette.surface, boxShadow: shadowFor(style, "small") }}>
            <AppIcon app={app} size={62} />
            <div style={{ fontSize: 28, fontWeight: 800, color: palette.onSurface, lineHeight: 1.15 }}>{screen.sticker}</div>
            <Tap at={tapAt} x={180} y={50} />
          </div>
        </div>
      )}
    </div>
  );
}

function PaywallScreen({ screen, app, at }: { screen: Extract<Props["screen"], { type: "paywall" }>; app: App | null; at: Record<string, number> }) {
  const counting = useProgress(at.count, 1.2);
  const lock = useReveal(at.lock ?? 48);
  const filled = Math.floor(counting * screen.freeCount + 0.001);
  const style = useStyle();
  const { palette } = style;
  const color = appColor(style, app);
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: mix(palette.surface, palette.onSurface, 0.05), color: palette.onSurface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "86px 28px 0" }}>
        <AppIcon app={app} size={58} />
        <div style={{ fontSize: 34, fontWeight: 900 }}>{app?.name ?? "App"}</div>
      </div>
      <div style={{ padding: "34px 28px 0", fontSize: 30, fontWeight: 700, color: palette.onSurfaceMuted }}>
        {screen.freeCount} free {screen.unit}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, padding: "20px 28px" }}>
        {Array.from({ length: screen.freeCount }, (_, k) => (
          <div key={k} style={{ aspectRatio: "1", borderRadius: 18, backgroundColor: k < filled ? palette.accent : palette.surface, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 10px ${alpha(shadowColor(style), 0.08)}` }}>
            <Glyph name={k < filled ? "bookmark-check" : "bookmark"} size={34} color={k < filled ? palette.onAccent : palette.onSurfaceMuted} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, backgroundColor: alpha(shadowColor(style), 0.55), opacity: clamp01(lock) }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "40px 30px 50px",
          borderRadius: `${style.shape.radius}px ${style.shape.radius}px 0 0`,
          backgroundColor: palette.surface,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          transform: `translateY(${(1 - lock) * 110}%)`,
        }}
      >
        <div style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: mix(palette.accent, palette.surface, 0.75), display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Glyph name="lock" size={60} color={darken(palette.accent, 0.45)} strokeWidth={2.6} />
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, textAlign: "center" }}>All {screen.unit} used</div>
        <div style={{ width: "100%", padding: "22px 0", borderRadius: 999, backgroundColor: color, color: readableOn(style, color), fontSize: 32, fontWeight: 900, textAlign: "center" }}>{headline(style, screen.action)}</div>
      </div>
    </div>
  );
}

function Notification({ item, app, at, index }: { item: { title: string; body: string }; app: App | null; at: number | undefined; index: number }) {
  const progress = useReveal(at, index * 8);
  const style = useStyle();
  const { palette } = style;
  return (
    <div style={{ display: "flex", gap: 14, padding: 18, borderRadius: Math.min(30, style.shape.radius), backgroundColor: alpha(palette.surface, 0.92), boxShadow: shadowFor(style, "small"), ...rise(progress, -80) }}>
      <AppIcon app={app} size={58} />
      <div style={{ color: palette.onSurface, minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>{item.title}</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: palette.onSurfaceMuted, marginTop: 4 }}>{item.body}</div>
      </div>
    </div>
  );
}

function NotificationsScreen({ screen, app, at }: { screen: Extract<Props["screen"], { type: "notifications" }>; app: App | null; at: Record<string, number> }) {
  const { tints } = useStyle().palette;
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(170deg, ${tints[1]}, ${tints[2]})`, padding: "160px 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
      {screen.items.map((item, k) => (
        <Notification key={item.key} item={item} app={app} at={at[item.key]} index={k} />
      ))}
    </div>
  );
}

function ListingScreen({ screen, app, at }: { screen: Extract<Props["screen"], { type: "listing" }>; app: App | null; at: Record<string, number> }) {
  const stars = useProgress(0, 1, 6);
  const get = useReveal(at.get ?? 30);
  const style = useStyle();
  const { palette } = style;
  const color = appColor(style, app);
  const button = get > 0.5 ? palette.positive : color;
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: palette.surface, color: palette.onSurface, padding: "110px 30px 0" }}>
      <div style={{ display: "flex", gap: 22 }}>
        <AppIcon app={app} size={150} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 4 }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 900 }}>{app?.name ?? "App"}</div>
            {screen.subtitle && <div style={{ fontSize: 22, fontWeight: 600, color: palette.onSurfaceMuted, marginTop: 6 }}>{screen.subtitle}</div>}
          </div>
          <div style={{ alignSelf: "flex-start", padding: "10px 34px", borderRadius: 999, backgroundColor: button, color: readableOn(style, button), fontSize: 26, fontWeight: 900, transform: `scale(${1 + Math.sin(clamp01(get) * Math.PI) * 0.2})` }}>
            {get > 0.5 ? "OPEN" : "GET"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 30 }}>
        {[0, 1, 2, 3, 4].map((k) => (
          <svg key={k} width={42} height={42} viewBox="0 0 24 24">
            <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill={stars * 5 > k ? palette.accent : mix(palette.surface, palette.onSurface, 0.12)} />
          </svg>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 34 }}>
        {[0, 1].map((k) => (
          <div key={k} style={{ height: 300, borderRadius: 26, background: `linear-gradient(160deg, ${alpha(color, 0.2)}, ${alpha(color, 0.07)})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Glyph name={app?.icon ?? "smartphone"} size={80} color={color} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const phone = useReveal(0);
  const float = useFloat(14, 90);
  const callout = useReveal(at.callout ?? 10);
  const style = useStyle();
  const { palette } = style;
  const hasCallout = props.callout !== null;
  const lean = hasCallout && style.shape.tilt;
  const { screen } = props;
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2000 }}>
      <div
        style={{
          position: "absolute",
          left: hasCallout ? 120 : (1080 - PHONE.width) / 2,
          top: 65 + float,
          transform: `translateY(${(1 - phone) * 500}px) rotateY(${lean ? 14 : 0}deg) rotateZ(${lean ? -3 : 0}deg)`,
        }}
      >
        <Frame>
          {screen.type === "video" && <VideoScreen screen={screen} app={props.app} at={at} />}
          {screen.type === "paywall" && <PaywallScreen screen={screen} app={props.app} at={at} />}
          {screen.type === "notifications" && <NotificationsScreen screen={screen} app={props.app} at={at} />}
          {screen.type === "listing" && <ListingScreen screen={screen} app={props.app} at={at} />}
        </Frame>
      </div>
      {props.callout && (
        <div style={{ position: "absolute", left: 590, top: 360, width: 420, ...pop(callout, 0.3) }}>
          <svg width={140} height={80} style={{ position: "absolute", left: -110, top: 40, overflow: "visible" }}>
            <path d="M130,10 C80,0 40,40 10,70" stroke={palette.accent} strokeWidth={8} fill="none" strokeLinecap="round" />
            <path d="M24,48 L10,70 L36,72" stroke={palette.accent} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ padding: "26px 34px", borderRadius: Math.min(32, style.shape.radius), backgroundColor: palette.accent, color: palette.onAccent, fontFamily: fontStack(style.type.display), fontSize: 50, fontWeight: style.type.displayWeight, lineHeight: 1.05, letterSpacing: -1, transform: `rotate(${style.shape.tilt ? 3 : 0}deg)`, boxShadow: shadowFor(style, "small") }}>
            {headline(style, props.callout)}
          </div>
        </div>
      )}
    </div>
  );
}

function screenKeys(screen: Props["screen"]): string[] {
  switch (screen.type) {
    case "video":
      return screen.sticker ? ["sticker"] : [];
    case "paywall":
      return ["count", "lock"];
    case "notifications":
      return screen.items.map((item) => item.key);
    case "listing":
      return ["get"];
  }
}

export const Phone = defineTemplate({
  name: "Phone",
  description:
    'A floating phone with a drawn app screen, for anything that happens in an app: "video" (a creator\'s video with a call-out sticker that gets tapped and a save button that lights up), "paywall" (free uses filling up, then a lock and an upgrade sheet), "notifications" (alerts sliding in), or "listing" (an app store page with stars and a GET button). An optional callout points at the phone. Elements: "callout", plus "sticker" for video, "count" and "lock" for paywall, each item\'s key for notifications, "get" for listing.',
  schema,
  revealKeys: (props) => [...screenKeys(props.screen), ...(props.callout ? ["callout"] : [])],
  spokenNumbers: (props) => (props.screen.type === "paywall" ? [props.screen.freeCount] : []),
  spokenTexts: (props) => [
    props.callout,
    ...(props.screen.type === "notifications" ? props.screen.items.flatMap((item) => [item.title, item.body]) : []),
  ],
  example: {
    app: { name: "ReciMe", icon: "chef-hat", color: "tint4" },
    screen: { type: "video", creator: "cooking creator", icon: "soup", sticker: "Save this recipe with ReciMe" },
    callout: "Built into the video",
  },
  Component,
});
