import type { PageSample } from "../pageFacts.ts";

export type PageSampling = { samples: PageSample[]; variables: Record<string, string> };

export const PAGE_SAMPLER = `(() => {
  const COLUMNS = 24;
  const ROWS = 36;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const paint = canvas.getContext("2d", { willReadFrequently: true });

  const toHex = (value) => {
    if (!value) return "transparent";
    let color = value.trim();
    if (!CSS.supports("color", color)) {
      if (CSS.supports("color", "hsl(" + color + ")")) color = "hsl(" + color + ")";
      else return "transparent";
    }
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = "#000";
    paint.fillStyle = color;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
    if (a < 128) return "transparent";
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  };

  const backgroundOf = (element) => {
    for (let node = element; node; node = node.parentElement) {
      const hex = toHex(getComputedStyle(node).backgroundColor);
      if (hex !== "transparent") return hex;
    }
    return toHex(getComputedStyle(document.documentElement).backgroundColor);
  };

  const hasText = (element) => [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length > 0);

  const roleOf = (element) => {
    if (element.closest("h1, h2, h3, h4")) return "heading";
    const button = element.closest("button, [role=button], a");
    if (button && (button.tagName === "BUTTON" || button.getAttribute("role") === "button" || toHex(getComputedStyle(button).backgroundColor) !== "transparent")) return "button";
    return "body";
  };

  const width = window.innerWidth;
  const height = window.innerHeight;
  const area = (width / COLUMNS) * (height / ROWS);
  const samples = [];
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const element = document.elementFromPoint(((column + 0.5) * width) / COLUMNS, ((row + 0.5) * height) / ROWS);
      if (!element) continue;
      const style = getComputedStyle(element);
      const text = hasText(element);
      samples.push({
        tag: element.tagName.toLowerCase(),
        role: text ? roleOf(element) : "other",
        background: backgroundOf(element),
        color: text ? toHex(style.color) : "transparent",
        area,
        fontFamily: text ? style.fontFamily : "",
      });
    }
  }

  const variables = {};
  const root = getComputedStyle(document.documentElement);
  const names = new Set();
  for (const sheet of [...document.styleSheets]) {
    let rules = [];
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (!rule.style || !/(^|,)\\s*(:root|html)\\s*(,|$)/.test(rule.selectorText || "")) continue;
      for (const name of rule.style) if (name.startsWith("--")) names.add(name);
    }
  }
  for (const name of [...names].slice(0, 200)) {
    const hex = toHex(root.getPropertyValue(name));
    if (hex !== "transparent") variables[name] = hex;
  }
  return { samples, variables };
})()`;
