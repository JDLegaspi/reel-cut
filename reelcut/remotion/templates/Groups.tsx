import { z } from "zod";
import type { ColorRole } from "../../src/schemas/style.ts";
import { useStyle } from "../style/StyleContext.tsx";
import { fontStack, headline, roleColor } from "../style/tokens.ts";
import { defineTemplate } from "./defineTemplate.ts";
import { Glyph, iconName } from "./icons.tsx";
import { Card, IconTile, pop, rise, useFloat, useReveal } from "./parts.tsx";

const schema = z.object({
  title: z.string().min(1).max(28).nullable(),
  groups: z
    .array(
      z.object({
        key: z.string().min(1).max(20),
        label: z.string().min(1).max(18),
        icon: iconName,
        items: z
          .array(z.object({ key: z.string().min(1).max(20), label: z.string().min(1).max(16), icon: iconName.nullable() }))
          .min(1)
          .max(4),
      }),
    )
    .min(2)
    .max(4)
    .describe("the things the speaker names, each holding the several things inside it, e.g. projects each with their worktrees"),
});

type Props = z.infer<typeof schema>;
type Group = Props["groups"][number];

const ROLES: ColorRole[] = ["accent", "tint1", "tint2", "tint3"];
const MARGIN = 36;
const GAP = 24;
const TITLE_SPACE = 150;

function Item({ item, at, delay, role, size }: { item: Group["items"][number]; at: number | undefined; delay: number; role: ColorRole; size: number }) {
  const style = useStyle();
  const progress = useReveal(at, delay);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 18px",
        borderRadius: Math.min(16, style.shape.radius),
        backgroundColor: style.palette.backdrop[1],
        color: style.palette.onBackdrop,
        fontFamily: fontStack(style.type.body),
        fontSize: size,
        fontWeight: 700,
        ...pop(progress, 0.6),
      }}
    >
      <Glyph name={item.icon ?? "git-branch"} size={size + 4} color={roleColor(style, role)} />
      <span style={{ lineHeight: 1.1 }}>{item.label}</span>
    </div>
  );
}

function Column({ group, at, index, left, width, top }: { group: Group; at: Record<string, number>; index: number; left: number; width: number; top: number }) {
  const style = useStyle();
  const progress = useReveal(at[group.key], index * 4);
  const bob = useFloat(6, 80, index * 1.3);
  const role = ROLES[index % ROLES.length]!;
  const longest = Math.max(...group.items.map((item) => item.label.length));
  const itemSize = Math.max(22, Math.min(36, Math.floor((width - 52 - 36 - 14) / (longest * 0.58 + 1.2))));
  return (
    <div style={{ position: "absolute", left, top: top + bob, width, ...pop(progress, 0.7) }}>
      <Card style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
          <IconTile icon={group.icon} size={84} role={role} />
          <div style={{ fontFamily: fontStack(style.type.display), fontWeight: style.type.displayWeight, fontSize: width > 300 ? 48 : 40, lineHeight: 1.05 }}>
            {headline(style, group.label)}
          </div>
        </div>
        {group.items.map((item, k) => (
          <Item key={item.key} item={item} at={at[item.key] ?? at[group.key]} delay={at[item.key] === undefined ? 6 + k * 5 : 0} role={role} size={itemSize} />
        ))}
      </Card>
    </div>
  );
}

function Component({ props, at }: { props: Props; at: Record<string, number> }) {
  const style = useStyle();
  const title = useReveal(at.title);
  const count = props.groups.length;
  const width = (1080 - MARGIN * 2 - GAP * (count - 1)) / count;
  const tallest = Math.max(...props.groups.map((group) => group.items.length));
  const height = 26 * 2 + 84 + 14 + 56 + tallest * (36 + 32 + 18) + 18;
  const space = props.title ? TITLE_SPACE : 0;
  const top = space + Math.max(20, (960 - space - height) / 2);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {props.title && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 50,
            textAlign: "center",
            fontFamily: fontStack(style.type.display),
            fontWeight: style.type.displayWeight,
            fontSize: 60,
            color: style.palette.onBackdrop,
            ...rise(title),
          }}
        >
          {headline(style, props.title)}
        </div>
      )}
      {props.groups.map((group, k) => (
        <Column key={group.key} group={group} at={at} index={k} left={MARGIN + k * (width + GAP)} width={width} top={top} />
      ))}
    </div>
  );
}

export const Groups = defineTemplate({
  name: "Groups",
  description:
    'Two to four cards side by side, each holding one to four items, to show several things that each contain several more, literally: projects with their worktrees, teams with their apps, clients with their products. Elements: "title", each group\'s key, and each item\'s key.',
  schema,
  revealKeys: (props) => [...(props.title ? ["title"] : []), ...props.groups.flatMap((group) => [group.key, ...group.items.map((item) => item.key)])],
  spokenTexts: (props) => [props.title, ...props.groups.flatMap((group) => [group.label, ...group.items.map((item) => item.label)])],
  example: {
    title: "Parallel work",
    groups: [
      { key: "p1", label: "Project A", icon: "folder", items: [{ key: "a1", label: "worktree 1", icon: null }, { key: "a2", label: "worktree 2", icon: null }] },
      { key: "p2", label: "Project B", icon: "folder", items: [{ key: "b1", label: "worktree 1", icon: null }, { key: "b2", label: "worktree 2", icon: null }, { key: "b3", label: "worktree 3", icon: null }] },
      { key: "p3", label: "Project C", icon: "folder", items: [{ key: "c1", label: "worktree 1", icon: null }] },
    ],
  },
  Component,
});
