export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

export function speakerFrame(opts: { crop: Rect; source: Size; panel: Size; zoom: number; anchorY?: number }): Size & { left: number; top: number } {
  const { crop, source, panel, zoom } = opts;
  const anchorY = opts.anchorY ?? 0.5;
  const scale = Math.max(panel.width / crop.width, panel.height / crop.height) * zoom;
  return {
    width: source.width * scale,
    height: source.height * scale,
    left: (panel.width - crop.width * scale) / 2 - crop.x * scale,
    top: (panel.height - crop.height * scale) * anchorY - crop.y * scale,
  };
}

const WIDE_CROP = 0.75;

export function speakerPanel(crop: Rect, frame: Size): { top: number; width: number; height: number } {
  const aspect = crop.width / crop.height;
  if (aspect <= WIDE_CROP) return { top: 0, width: frame.width, height: frame.height };
  const height = Math.round(frame.width / aspect);
  return { top: Math.round((frame.height - height) / 2 - frame.height / 16), width: frame.width, height };
}
