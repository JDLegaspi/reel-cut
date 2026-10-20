import { join } from "node:path";
import type { Browser, Page } from "puppeteer-core";
import type { GatheredImage } from "./types.ts";
import { summarizeFacts, type PageFacts } from "../pageFacts.ts";
import { PAGE_SAMPLER, type PageSampling } from "./sampler.ts";

export type WebsiteResult = { images: GatheredImage[]; facts: PageFacts };

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true };

async function settle(page: Page): Promise<void> {
  await page.evaluate("document.fonts.ready.then(() => true)");
  await new Promise((resolve) => setTimeout(resolve, 700));
}

function label(url: string): string {
  const parsed = new URL(url);
  return parsed.protocol === "file:" ? (parsed.pathname.split("/").pop() ?? "page") : parsed.hostname.replace(/^www\./, "");
}

export async function gatherWebsite(opts: { browser: Browser; url: string; dir: string; prefix: string; timeoutSeconds: number }): Promise<WebsiteResult> {
  const { browser, url, dir, prefix, timeoutSeconds } = opts;
  const name = label(url);
  const page = await browser.newPage();
  try {
    await page.setViewport(DESKTOP);
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutSeconds * 1000 });
    if (response && response.status() >= 400) throw new Error(`${url} answered ${response.status()}`);
    await settle(page);

    const shots: [string, string][] = [
      [`${prefix}-desktop-top.jpg`, `${name}, desktop, top of the page`],
      [`${prefix}-desktop-below.jpg`, `${name}, desktop, one screen down`],
      [`${prefix}-phone.jpg`, `${name}, phone`],
    ];
    await page.screenshot({ path: join(dir, shots[0]![0]), type: "jpeg", quality: 82 });
    const top = (await page.evaluate(PAGE_SAMPLER)) as PageSampling;

    await page.evaluate(`window.scrollTo(0, ${DESKTOP.height})`);
    await settle(page);
    await page.screenshot({ path: join(dir, shots[1]![0]), type: "jpeg", quality: 82 });
    const below = (await page.evaluate(PAGE_SAMPLER)) as PageSampling;

    await page.setViewport(PHONE);
    await page.evaluate("window.scrollTo(0, 0)");
    await settle(page);
    await page.screenshot({ path: join(dir, shots[2]![0]), type: "jpeg", quality: 82 });

    return {
      images: shots.map(([file, caption]) => ({ file: `references/${file}`, caption })),
      facts: summarizeFacts([...top.samples, ...below.samples], { ...below.variables, ...top.variables }),
    };
  } finally {
    await page.close();
  }
}

export async function rasterizeSvg(opts: { browser: Browser; svg: Buffer; output: string; timeoutSeconds: number }): Promise<void> {
  const page = await opts.browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: 1200, height: 1200 });
    const source = `data:image/svg+xml;base64,${opts.svg.toString("base64")}`;
    await page.setContent(`<body style="margin:0;background:transparent"><img src="${source}" style="display:block;max-width:1200px;max-height:1200px"></body>`, {
      waitUntil: "load",
      timeout: opts.timeoutSeconds * 1000,
    });
    const image = await page.$("img");
    const loaded = await page.evaluate("document.querySelector('img').naturalWidth > 0");
    if (!image || !loaded) throw new Error("the SVG could not be drawn");
    await image.screenshot({ path: opts.output as `${string}.png`, type: "png", omitBackground: true });
  } finally {
    await page.close();
  }
}
