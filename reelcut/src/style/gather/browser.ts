import { ensureBrowser } from "@remotion/renderer";
import puppeteer, { type Browser } from "puppeteer-core";

export interface LazyBrowser {
  get(): Promise<Browser>;
  close(): Promise<void>;
}

export async function launchHeadlessChrome(): Promise<Browser> {
  const status = await ensureBrowser();
  if (!("path" in status)) throw new Error(`No headless Chrome is available (${status.type})`);
  return puppeteer.launch({ executablePath: status.path, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
}

export function lazyBrowser(launch: () => Promise<Browser> = launchHeadlessChrome): LazyBrowser {
  let browser: Promise<Browser> | null = null;
  return {
    get() {
      browser ??= launch();
      return browser;
    },
    async close() {
      const started = await browser?.catch(() => null);
      browser = null;
      await started?.close().catch(() => {});
    },
  };
}
