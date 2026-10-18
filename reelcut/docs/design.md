# reelcut design

Approved 2026-10-07, revised 2026-10-18 when the repo was split. The original brief is the source of truth for behaviour; this file records the decisions and refinements agreed on top of it.

reelcut turns a vertical talking-head video into an Instagram-ready Reel. Its input is a reel URL (downloaded with yt-dlp) or a local video file. Its download, media, transcription, pipeline and Claude code live in `@reel/shared` (`shared/` at the repo root).

## Stack (verified against docs on 2026-10-07)

- Node >= 22, TypeScript, npm workspaces (pnpm needs a newer Node than the machine has), tsx for the CLI, vitest for tests.
- Remotion 4.0.533 (`remotion`, `@remotion/cli`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/media`, `@remotion/captions`, `@remotion/transitions`, `@remotion/google-fonts`), all pinned to the same version. Zod 4.
- Base video uses `<Video>` from `@remotion/media`, so `cut.mp4` must be H.264. Media is served from a per-project public dir (`bundle({ publicDir })`, `remotion studio --public-dir --props`).
- FFmpeg/ffprobe and yt-dlp from Homebrew (paths configurable). Remotion's bundled FFmpeg is codec-limited and is not used for ingest/cut.
- ElevenLabs `scribe_v2` via `@elevenlabs/elevenlabs-js` (`client.speechToText.convert`), `tagAudioEvents: false`, verbatim (default). Behind a `Transcriber` interface.
- Anthropic TS SDK, `client.messages.parse` + `zodOutputFormat` for both LLM steps (forced tool choice is rejected on current models). The client comes from `@reel/shared/claude.ts`: model from `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`, and `ANTHROPIC_WORKSPACE_ID` sent as the workspace header. Server-side refusal fallback enabled (`fallbacks: "default"`).

## Pipeline semantics

- `reelcut run <url or file> [--name <project>] [--retake-word <word>] [--aggressive] [--force]`. The project name defaults to `ig-<shortcode>` for Instagram URLs and a slug of the file name for local files.
- Projects live in `reelcut/projects/<name>/`. `project.json` records the source (`{ "kind": "url", "url": … }` or `{ "kind": "file", "path": … }`), `retakeWord` and `aggressive`.
- Stages: download, ingest, transcribe, retakes, cut, plan, render, report.
  - **download**: URL sources only; writes `original.mp4` and `info.raw.json`. For file sources it has no outputs and does nothing.
  - **ingest**: `project.json` plus `original.mp4` or the local file → `source.mp4` (1080×1920, constant frame rate, H.264) and `audio.wav`. Inputs without audio are rejected.
  - **transcribe**: `audio.wav` → `transcript.json`.
- Make-style staleness: a stage runs when any output is missing or older than any input. `--force` always reruns. `reelcut stage <name> <project>` runs one stage.
- All tunables in `reelcut/reelcut.config.ts`.

## Artifacts

All JSON artifacts carry `version: 1`.

### transcript.json

```json
{ "version": 1, "provider": "elevenlabs/scribe_v2", "language": "en", "duration": 84.2,
  "words": [ { "i": 0, "text": "so", "start": 0.42, "end": 0.61 } ] }
```

### cuts.json (hand-editable decisions only)

```json
{ "version": 1, "retakeWord": "again", "aggressive": false,
  "keep":    [ { "fromWord": 0, "toWord": 11 } ],
  "removed": [ { "fromWord": 12, "toWord": 16, "kind": "retake", "reason": "abandoned take before retake word" } ] }
```

- Ranges are inclusive. `kind`: `retake | retake-word | false-start | filler | dead-air | other`.
- Time ranges are always derived from this file, never stored in it.
- If the LLM output is still invalid after one retry, the stage fails with the errors.

### transcript.cut.json

```json
{ "version": 1, "fps": 30, "duration": 71.9,
  "segments": [ { "srcStart": 0.34, "srcEnd": 4.73, "cutStart": 0.0, "cutEnd": 4.39 } ],
  "words":    [ { "i": 0, "srcI": 0, "text": "so", "start": 0.08, "end": 0.27 } ] }
```

- Segment edges are snapped to the frame grid so audio and video lengths match.
- Padding: ~80 ms before, ~120 ms after, clamped against adjacent removed words.
- Gaps longer than `maxGap` inside a kept range are split, keeping `maxGap / 2` each side.
- ~30 ms audio fades inside every segment edge.

### visual_plan.json

```json
{ "version": 1,
  "segments": [
    { "id": "seg-04", "kind": "visual", "startWord": 41, "endWord": 58, "template": "Flow",
      "props": { "steps": [ { "key": "req", "label": "Request" } ] },
      "reveals": [ { "key": "req", "atWord": 43 } ],
      "rationale": "..." },
    { "id": "seg-05", "kind": "placeholder", "startWord": 70, "endWord": 81,
      "description": "...", "rationale": "..." }
  ],
  "downgraded": [ { "id": "seg-07", "template": "BarChart", "reason": "..." } ] }
```

- Word indices refer to `transcript.cut.json`.
- Face is implicit: any time not covered by a segment shows the speaker. Editorial rules are checked against the gaps.
- Numbers in `BigNumber` / `BarChart` props must appear in the segment's spoken words ("forty" == "40"), otherwise the segment is downgraded.
- Reveal keys must exist in the template's `revealKeys(props)`, `atWord` must be inside the segment, reveals must be in order. Unrevealed elements show at segment start. Animation starts at word start minus `revealLeadMs` (default 40 ms).

## Templates

One file per template exporting `defineTemplate({ name, description, schema, revealKeys, Component })`, plus one line in `remotion/templates/registry.ts`. The planner catalog is generated from the schemas with `z.toJSONSchema`.

## Milestones

1. Scaffold, config, download, ingest, transcribe. (Done; restored on `@reel/shared` in the 2026-10-18 split.)
2. Retake detection and cutting.
3. Visual planning; every non-face segment rendered as a placeholder.
4. Template library and word-synced reveals.
5. Captions, transitions, edit report, polish.

Next up is the visuals (milestones 3 and 4), judged on downloaded talking-head reels that have no visuals of their own: reelcut should add visuals to the speaker. Downloaded reels are already edited, so retake cutting (milestone 2) has little to do on them and is best tested on raw recordings.
