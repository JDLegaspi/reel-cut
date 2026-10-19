import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { z } from "zod";
import { defineTemplate } from "./defineTemplate.ts";
import { Glyph, iconName } from "./icons.tsx";
import { clamp01, pop, rise, useFloat, useProgress, useReveal } from "./parts.tsx";
import { softShadow, theme } from "./theme.ts";

const APP_COLORS = { blue: theme.blue, green: theme.green, orange: "#F97316", pink: "#EC4899", violet: "#7C5CFF", red: theme.red } as const;

const app = z.object({
  name: z.string().min(1).max(20),
  icon: iconName,
  color: z.enum(["blue", "green", "orange", "pink", "violet", "red"]),
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

function AppIcon({ app, size }: { app: App | null; size: number }) {
  const color = app ? APP_COLORS[app.color] : theme.blue;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: `linear-gradient(140deg, ${color}, ${color}BB)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Glyph name={app?.icon ?? "smartphone"} size={size * 0.58} color="#fff" />
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: PHONE.width, height: PHONE.height, borderRadius: 72, backgroundColor: "#0B0D14", padding: 14, boxShadow: "0 50px 100px rgba(3,8,45,0.6), inset 0 0 0 3px #2A2F3D" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 58, overflow: "hidden", backgroundColor: theme.paper }}>
        {children}
        <div style={{ position: "absolute", top: 16, left: "50%", width: 130, height: 38, marginLeft: -65, borderRadius: 19, backgroundColor: "#0B0D14" }} />
      </div>
    </div>
  );
}

function Tap({ at, x, y }: { at: number | undefined; x: number; y: number }) {
  const progress = useProgress(at, 0.5);
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
        border: "8px solid rgba(255,255,255,0.9)",
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
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(165deg, #FDBA74, #F97316 45%, #BE185D)" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230 + bob, display: "flex", justifyContent: "center" }}>
        <Glyph name={screen.icon} size={200} color="rgba(255,255,255,0.95)" strokeWidth={1.8} />
      </div>
      <div style={{ position: "absolute", right: 22, bottom: 170, display: "flex", flexDirection: "column", gap: 34, alignItems: "center" }}>
        <Glyph name="heart" size={54} color="#fff" />
        <Glyph name="message-circle" size={54} color="#fff" />
        <div style={{ transform: saved ? "scale(1.25)" : "scale(1)" }}>
          <svg width={54} height={54} viewBox="0 0 24 24">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill={saved ? theme.yellow : "none"} stroke={saved ? theme.yellow : "#fff"} strokeWidth={2} strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {screen.creator && (
        <div style={{ position: "absolute", left: 26, bottom: 96, fontSize: 30, fontWeight: 800, color: "#fff" }}>@{screen.creator.replace(/\s+/g, "").toLowerCase()}</div>
      )}
      <div style={{ position: "absolute", left: 26, right: 26, bottom: 64, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" }}>
        <div style={{ width: `${(frame % 150) / 1.5}%`, height: "100%", borderRadius: 3, backgroundColor: "#fff" }} />
      </div>
      {screen.sticker && (
        <div style={{ position: "absolute", left: 22, right: 22, top: 520, ...pop(sticker, 0.2) }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 28, backgroundColor: theme.paper, boxShadow: softShadow }}>
            <AppIcon app={app} size={62} />
            <div style={{ fontSize: 28, fontWeight: 800, color: theme.ink, lineHeight: 1.15 }}>{screen.sticker}</div>
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
  const color = app ? APP_COLORS[app.color] : theme.blue;
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: theme.paperDim, color: theme.ink }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "86px 28px 0" }}>
        <AppIcon app={app} size={58} />
        <div style={{ fontSize: 34, fontWeight: 900 }}>{app?.name ?? "App"}</div>
      </div>
      <div style={{ padding: "34px 28px 0", fontSize: 30, fontWeight: 700, color: theme.inkMuted }}>
        {screen.freeCount} free {screen.unit}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, padding: "20px 28px" }}>
        {Array.from({ length: screen.freeCount }, (_, k) => (
          <div key={k} style={{ aspectRatio: "1", borderRadius: 18, backgroundColor: k < filled ? theme.yellow : theme.paper, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(3,8,45,0.08)" }}>
            <Glyph name={k < filled ? "bookmark-check" : "bookmark"} size={34} color={k < filled ? theme.ink : theme.inkMuted} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(6,10,43,0.55)", opacity: clamp01(lock) }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "40px 30px 50px",
          borderRadius: "40px 40px 0 0",
          backgroundColor: theme.paper,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          transform: `translateY(${(1 - lock) * 110}%)`,
        }}
      >
        <div style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Glyph name="lock" size={60} color="#B45309" strokeWidth={2.6} />
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, textAlign: "center" }}>All {screen.unit} used</div>
        <div style={{ width: "100%", padding: "22px 0", borderRadius: 999, backgroundColor: color, color: "#fff", fontSize: 32, fontWeight: 900, textAlign: "center" }}>{screen.action}</div>
      </div>
    </div>
  );
}

function Notification({ item, app, at, index }: { item: { title: string; body: string }; app: App | null; at: number | undefined; index: number }) {
  const progress = useReveal(at, index * 8);
  return (
    <div style={{ display: "flex", gap: 14, padding: 18, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.92)", boxShadow: softShadow, ...rise(progress, -80) }}>
      <AppIcon app={app} size={58} />
      <div style={{ color: theme.ink, minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>{item.title}</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: theme.inkMuted, marginTop: 4 }}>{item.body}</div>
      </div>
    </div>
  );
}

function NotificationsScreen({ screen, app, at }: { screen: Extract<Props["screen"], { type: "notifications" }>; app: App | null; at: Record<string, number> }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(170deg, #4F46E5, #0EA5E9)", padding: "160px 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
      {screen.items.map((item, k) => (
        <Notification key={item.key} item={item} app={app} at={at[item.key]} index={k} />
      ))}
    </div>
  );
}

function ListingScreen({ screen, app, at }: { screen: Extract<Props["screen"], { type: "listing" }>; app: App | null; at: Record<string, number> }) {
  const stars = useProgress(0, 1, 6);
  const get = useReveal(at.get ?? 30);
  const color = app ? APP_COLORS[app.color] : theme.blue;
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: theme.paper, color: theme.ink, padding: "110px 30px 0" }}>
      <div style={{ display: "flex", gap: 22 }}>
        <AppIcon app={app} size={150} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 4 }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 900 }}>{app?.name ?? "App"}</div>
            {screen.subtitle && <div style={{ fontSize: 22, fontWeight: 600, color: theme.inkMuted, marginTop: 6 }}>{screen.subtitle}</div>}
          </div>
          <div style={{ alignSelf: "flex-start", padding: "10px 34px", borderRadius: 999, backgroundColor: get > 0.5 ? theme.green : color, color: "#fff", fontSize: 26, fontWeight: 900, transform: `scale(${1 + Math.sin(clamp01(get) * Math.PI) * 0.2})` }}>
            {get > 0.5 ? "OPEN" : "GET"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 30 }}>
        {[0, 1, 2, 3, 4].map((k) => (
          <svg key={k} width={42} height={42} viewBox="0 0 24 24">
            <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill={stars * 5 > k ? theme.yellow : theme.line} />
          </svg>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 34 }}>
        {[0, 1].map((k) => (
          <div key={k} style={{ height: 300, borderRadius: 26, background: `linear-gradient(160deg, ${color}33, ${color}11)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  const hasCallout = props.callout !== null;
  const { screen } = props;
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2000 }}>
      <div
        style={{
          position: "absolute",
          left: hasCallout ? 120 : (1080 - PHONE.width) / 2,
          top: 65 + float,
          transform: `translateY(${(1 - phone) * 500}px) rotateY(${hasCallout ? 14 : 0}deg) rotateZ(${hasCallout ? -3 : 0}deg)`,
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
            <path d="M130,10 C80,0 40,40 10,70" stroke={theme.yellow} strokeWidth={8} fill="none" strokeLinecap="round" />
            <path d="M24,48 L10,70 L36,72" stroke={theme.yellow} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ padding: "26px 34px", borderRadius: 32, backgroundColor: theme.yellow, color: theme.ink, fontSize: 50, fontWeight: 900, lineHeight: 1.05, letterSpacing: -1, transform: "rotate(3deg)", boxShadow: softShadow }}>
            {props.callout}
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
    app: { name: "ReciMe", icon: "chef-hat", color: "orange" },
    screen: { type: "video", creator: "cooking creator", icon: "soup", sticker: "Save this recipe with ReciMe" },
    callout: "Built into the video",
  },
  Component,
});
