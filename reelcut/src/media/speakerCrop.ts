import type { Rect, Size } from "../../remotion/framing.ts";

export function parseSpeakerCrop(value: string, video: Size): Rect {
  const half = Math.round(video.height / 2);
  if (value === "top-half") return { x: 0, y: 0, width: video.width, height: half };
  if (value === "bottom-half") return { x: 0, y: video.height - half, width: video.width, height: half };

  const match = /^(\d+),(\d+),(\d+),(\d+)$/.exec(value);
  if (!match) throw new Error(`Unknown speaker crop "${value}"; use "top-half", "bottom-half" or x,y,width,height`);
  const [x, y, width, height] = match.slice(1).map(Number) as [number, number, number, number];
  if (width === 0 || height === 0 || x + width > video.width || y + height > video.height) {
    throw new Error(`Speaker crop ${value} is outside the ${video.width}x${video.height} video`);
  }
  return { x, y, width, height };
}
