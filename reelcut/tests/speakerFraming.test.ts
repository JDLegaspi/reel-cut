import { describe, expect, test } from "vitest";
import { speakerFrame, speakerPanel } from "../remotion/framing.ts";
import { parseSpeakerCrop } from "../src/media/speakerCrop.ts";

const source = { width: 1080, height: 1920 };
const topHalf = { x: 0, y: 0, width: 1080, height: 960 };

describe("speakerFrame", () => {
  test("shows a crop at its own size when the panel matches it", () => {
    expect(speakerFrame({ crop: topHalf, source, panel: { width: 1080, height: 960 }, zoom: 1 })).toEqual({
      width: 1080,
      height: 1920,
      left: 0,
      top: 0,
    });
  });

  test("scales a crop up to cover a taller panel, centred on the crop", () => {
    expect(speakerFrame({ crop: topHalf, source, panel: { width: 1080, height: 1920 }, zoom: 1 })).toEqual({
      width: 2160,
      height: 3840,
      left: -540,
      top: 0,
    });
  });

  test("can sit the crop higher in a wide panel so the head is not cut off", () => {
    const frame = speakerFrame({ crop: { x: 0, y: 0, width: 1080, height: 1920 }, source, panel: { width: 1000, height: 740 }, zoom: 1, anchorY: 0.25 });
    expect(frame.width).toBeCloseTo(1000);
    expect(frame.top).toBeCloseTo(((740 - 1920 * (1000 / 1080)) * 0.25));
  });

  test("zooms in around the centre of the crop", () => {
    const frame = speakerFrame({ crop: { x: 0, y: 0, width: 1080, height: 1920 }, source, panel: source, zoom: 1.5 });
    expect(frame).toEqual({ width: 1620, height: 2880, left: -270, top: -480 });
  });
});

describe("speakerPanel", () => {
  test("fills the screen when the crop is about as tall as the screen", () => {
    expect(speakerPanel({ x: 0, y: 0, width: 1080, height: 1920 }, source)).toEqual({ top: 0, width: 1080, height: 1920 });
    expect(speakerPanel({ x: 100, y: 0, width: 900, height: 1300 }, source)).toEqual({ top: 0, width: 1080, height: 1920 });
  });

  test("shows a wide crop at full width, above centre, so it isn't blown up", () => {
    expect(speakerPanel(topHalf, source)).toEqual({ top: 360, width: 1080, height: 960 });
  });
});

describe("parseSpeakerCrop", () => {
  test("understands top-half and bottom-half", () => {
    expect(parseSpeakerCrop("top-half", source)).toEqual(topHalf);
    expect(parseSpeakerCrop("bottom-half", source)).toEqual({ x: 0, y: 960, width: 1080, height: 960 });
  });

  test("takes an explicit x,y,width,height rectangle", () => {
    expect(parseSpeakerCrop("100,200,600,800", source)).toEqual({ x: 100, y: 200, width: 600, height: 800 });
  });

  test("rejects rectangles outside the video", () => {
    expect(() => parseSpeakerCrop("600,0,600,800", source)).toThrow("outside the 1080x1920 video");
    expect(() => parseSpeakerCrop("middle", source)).toThrow('use "top-half", "bottom-half" or x,y,width,height');
  });
});
