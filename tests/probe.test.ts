import { describe, expect, test } from "vitest";
import { parseProbe, snapFps } from "../src/media/probe.ts";

function probeJson(video: Record<string, unknown>, extraStreams: unknown[] = [{ codec_type: "audio" }]) {
  return {
    streams: [{ codec_type: "video", codec_name: "h264", width: 1080, height: 1920, ...video }, ...extraStreams],
    format: { duration: "84.250000" },
  };
}

describe("snapFps", () => {
  test("snaps a variable phone rate to NTSC 29.97", () => {
    expect(snapFps(29.87)).toEqual({ num: 30000, den: 1001 });
  });

  test("keeps exact integer rates", () => {
    expect(snapFps(30)).toEqual({ num: 30, den: 1 });
    expect(snapFps(25)).toEqual({ num: 25, den: 1 });
  });

  test("snaps near-60 rates to 60", () => {
    expect(snapFps(59.98)).toEqual({ num: 60, den: 1 });
  });

  test("rounds rates that are far from any standard", () => {
    expect(snapFps(15.2)).toEqual({ num: 15, den: 1 });
  });
});

describe("parseProbe", () => {
  test("reads dimensions, duration, audio presence and average frame rate", () => {
    const info = parseProbe(probeJson({ avg_frame_rate: "2987/100", r_frame_rate: "120/1" }));
    expect(info).toMatchObject({
      width: 1080,
      height: 1920,
      duration: 84.25,
      hasAudio: true,
      fps: { num: 30000, den: 1001 },
      hdr: false,
    });
  });

  test("falls back to r_frame_rate when the average is missing", () => {
    const info = parseProbe(probeJson({ avg_frame_rate: "0/0", r_frame_rate: "25/1" }));
    expect(info.fps).toEqual({ num: 25, den: 1 });
  });

  test("swaps dimensions for a 90 degree display rotation", () => {
    const info = parseProbe(
      probeJson({
        width: 1920,
        height: 1080,
        avg_frame_rate: "30/1",
        side_data_list: [{ side_data_type: "Display Matrix", rotation: -90 }],
      }),
    );
    expect(info).toMatchObject({ width: 1080, height: 1920, rotation: -90 });
  });

  test("reads legacy rotate tags", () => {
    const info = parseProbe(probeJson({ width: 1920, height: 1080, avg_frame_rate: "30/1", tags: { rotate: "90" } }));
    expect(info).toMatchObject({ width: 1080, height: 1920, rotation: 90 });
  });

  test("flags HLG and PQ sources as HDR", () => {
    expect(parseProbe(probeJson({ avg_frame_rate: "30/1", color_transfer: "arib-std-b67" })).hdr).toBe(true);
    expect(parseProbe(probeJson({ avg_frame_rate: "30/1", color_transfer: "smpte2084" })).hdr).toBe(true);
  });

  test("reports missing audio", () => {
    expect(parseProbe(probeJson({ avg_frame_rate: "30/1" }, [])).hasAudio).toBe(false);
  });

  test("throws when there is no video stream", () => {
    expect(() => parseProbe({ streams: [{ codec_type: "audio" }], format: { duration: "1" } })).toThrow(/video stream/);
  });
});
