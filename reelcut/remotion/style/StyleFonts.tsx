import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import type { FontFile } from "../props.ts";

const loading = new Map<string, Promise<void>>();

function loadFile(file: FontFile): Promise<void> {
  const key = `${file.family}|${file.weight}|${file.url}`;
  const existing = loading.get(key);
  if (existing) return existing;
  const face = new FontFace(file.family, `url(${file.url}) format("woff2")`, {
    weight: file.weight,
    unicodeRange: file.unicodeRange,
    display: "block",
  });
  const promise = face.load().then((ready) => {
    document.fonts.add(ready);
  });
  loading.set(key, promise);
  return promise;
}

export function StyleFonts({ fonts }: { fonts: FontFile[] }) {
  const [handle] = useState(() => delayRender(`Loading ${fonts.length} font files`));
  useEffect(() => {
    Promise.all(fonts.map(loadFile)).then(
      () => continueRender(handle),
      (error: unknown) => cancelRender(error),
    );
  }, [fonts, handle]);
  return null;
}
