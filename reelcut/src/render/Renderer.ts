import type { Log } from "@reel/shared/pipeline/stage.ts";
import type { RenderProps } from "../../remotion/props.ts";
import type { Style } from "../schemas/style.ts";
import type { VideoSettings } from "../media/ingestArgs.ts";

export interface RenderJob {
  props: RenderProps;
  publicDir: string;
  output: string;
  video: VideoSettings;
  log: Log;
}

export interface Renderer {
  render(job: RenderJob): Promise<void>;
}

export interface SheetRenderer {
  render(style: Style, output: string): Promise<void>;
}
