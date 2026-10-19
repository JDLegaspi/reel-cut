import { icons } from "lucide-react";
import {
  siAnthropic,
  siApple,
  siAppstore,
  siClaude,
  siDiscord,
  siFacebook,
  siGoogle,
  siGoogleplay,
  siInstagram,
  siMeta,
  siNotion,
  siPinterest,
  siReddit,
  siShopify,
  siSnapchat,
  siSpotify,
  siStripe,
  siThreads,
  siTiktok,
  siTwitch,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";
import { z } from "zod";

const BRAND_ICONS = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  appstore: siAppstore,
  googleplay: siGoogleplay,
  x: siX,
  facebook: siFacebook,
  threads: siThreads,
  snapchat: siSnapchat,
  pinterest: siPinterest,
  reddit: siReddit,
  whatsapp: siWhatsapp,
  discord: siDiscord,
  twitch: siTwitch,
  spotify: siSpotify,
  apple: siApple,
  google: siGoogle,
  meta: siMeta,
  shopify: siShopify,
  stripe: siStripe,
  notion: siNotion,
  anthropic: siAnthropic,
  claude: siClaude,
};

export type Brand = keyof typeof BRAND_ICONS;
export const BRANDS = Object.keys(BRAND_ICONS) as [Brand, ...Brand[]];

function iconKey(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function isIconName(name: string): boolean {
  return iconKey(name) in icons;
}

export const iconName = z
  .string()
  .refine(isIconName, { message: "not a lucide icon name; use kebab-case names such as chef-hat, dollar-sign, trending-up" })
  .describe("a lucide icon name in kebab-case, e.g. chef-hat, dollar-sign, smartphone, bookmark, lock, users, rocket");

export function Glyph({ name, size, color, strokeWidth = 2.2 }: { name: string; size: number; color: string; strokeWidth?: number }) {
  const Icon = icons[iconKey(name) as keyof typeof icons] ?? icons.Sparkles;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} absoluteStrokeWidth={false} />;
}

export function BrandMark({ brand, size }: { brand: Brand; size: number }) {
  const icon = BRAND_ICONS[brand];
  const color = icon.hex === "000000" || icon.hex === "191919" ? "#0B1020" : `#${icon.hex}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d={icon.path} fill={color} />
    </svg>
  );
}

export function brandTitle(brand: Brand): string {
  return BRAND_ICONS[brand].title;
}
