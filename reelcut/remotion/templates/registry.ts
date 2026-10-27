import { Checklist } from "./Checklist.tsx";
import { Concept } from "./Concept.tsx";
import { Countdown } from "./Countdown.tsx";
import type { Template } from "./defineTemplate.ts";
import { Flow } from "./Flow.tsx";
import { Groups } from "./Groups.tsx";
import { Growth } from "./Growth.tsx";
import { Kinetic } from "./Kinetic.tsx";
import { Logos } from "./Logos.tsx";
import { Phone } from "./Phone.tsx";
import { Stat } from "./Stat.tsx";
import { Versus } from "./Versus.tsx";
import { Website } from "./Website.tsx";

export const TEMPLATES: Template[] = [Stat, Growth, Versus, Concept, Flow, Phone, Logos, Website, Groups, Kinetic, Countdown, Checklist];

export function findTemplate(name: string): Template | undefined {
  return TEMPLATES.find((template) => template.name === name);
}
