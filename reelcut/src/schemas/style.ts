import { z } from "zod";

export const COLOR_ROLES = ["accent", "positive", "negative", "tint1", "tint2", "tint3", "tint4"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "must be a colour written as #rrggbb");
const font = z.string().min(1).max(60);

const PaletteSchema = z.strictObject({
  backdrop: z.tuple([hex, hex]).describe("the two stops of the background behind every visual, top-left to bottom-right; the same colour twice for a flat background"),
  surface: hex.describe("cards, tiles and phone screens"),
  onSurface: hex.describe("text and icons on surface"),
  onSurfaceMuted: hex.describe("secondary text on surface"),
  onBackdrop: hex.describe("text and icons straight on the backdrop"),
  onBackdropMuted: hex.describe("secondary text on the backdrop"),
  accent: hex.describe("the highlight colour: badges, markers, emphasis"),
  onAccent: hex.describe("text on accent"),
  positive: hex.describe("good, growth, ticks"),
  negative: hex.describe("bad, decline, crosses"),
  tints: z.tuple([hex, hex, hex, hex]).describe("four supporting colours for icon tiles and app icons"),
});

const TypeSchema = z.strictObject({
  display: font.describe("Google Fonts family for numbers, headlines and emphasis words"),
  body: font.describe("Google Fonts family for labels"),
  displayWeight: z.literal([500, 600, 700, 800, 900]),
  tracking: z.enum(["tight", "normal"]).describe("letter spacing of big type"),
  headlineCase: z.enum(["as-written", "uppercase"]),
});

const ShapeSchema = z.strictObject({
  radius: z.number().int().min(0).max(48).describe("corner radius of cards in pixels on a 1080-wide frame"),
  cards: z.enum(["solid", "outline", "glass"]),
  shadow: z.enum(["none", "soft", "deep"]),
  tilt: z.boolean().describe("cards sit at a slight 3D angle"),
});

const BackdropSchema = z.strictObject({
  kind: z.enum(["gradient", "flat", "grid", "grain", "spotlight"]),
  drift: z.boolean().describe("the backdrop moves slowly"),
});

const FlourishesSchema = z.strictObject({
  bursts: z.boolean().describe("particles burst when a result lands"),
  coins: z.boolean().describe("floating coins around money"),
  glow: z.boolean().describe("glowing halos around icons and curves"),
  shake: z.boolean().describe("big words shake as they land"),
});

const IconsSchema = z.strictObject({
  stroke: z.number().min(1.25).max(3).describe("icon line width"),
  tiles: z.enum(["filled", "outline", "bare"]).describe("how icons sit on their tiles"),
});

const MotionSchema = z.enum(["calm", "lively"]).describe("calm: soft springs and little floating; lively: snappy springs with overshoot");
const EmphasisStyleSchema = z.enum(["solid", "highlight", "outline"]).describe("how the speaker's emphasis words are drawn");
const NotesSchema = z.string().max(600).describe("a few sentences on how this style reflects the references");

export const StyleSchema = z.strictObject({
  version: z.literal(1),
  palette: PaletteSchema,
  type: TypeSchema,
  shape: ShapeSchema,
  backdrop: BackdropSchema,
  motion: MotionSchema,
  flourishes: FlourishesSchema,
  icons: IconsSchema,
  emphasis: EmphasisStyleSchema,
  notes: NotesSchema,
});

export type Style = z.infer<typeof StyleSchema>;

export const StyleOverridesSchema = z
  .strictObject({
    palette: PaletteSchema.partial(),
    type: TypeSchema.partial(),
    shape: ShapeSchema.partial(),
    backdrop: BackdropSchema.partial(),
    motion: MotionSchema,
    flourishes: FlourishesSchema.partial(),
    icons: IconsSchema.partial(),
    emphasis: EmphasisStyleSchema,
    notes: NotesSchema,
  })
  .partial();

export type StyleOverrides = z.infer<typeof StyleOverridesSchema>;

export const ProjectStyleSchema = z.strictObject({
  version: z.literal(1),
  base: z.string().min(1).nullable(),
  overrides: StyleOverridesSchema,
});

export type ProjectStyle = z.infer<typeof ProjectStyleSchema>;
