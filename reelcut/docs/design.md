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

- `reelcut run <url or file> [--name <project>] [--retake-word <word>] [--aggressive] [--speaker-crop <crop>] [--force]`. The project name defaults to `ig-<shortcode>` for Instagram URLs and a slug of the file name for local files.
- Projects live in `reel-cut/projects/<name>/` under the current folder. `project.json` records the source (`{ "kind": "url", "url": … }` or `{ "kind": "file", "path": … }`), `retakeWord` and `aggressive`. `speaker.json` records the speaker crop (`top-half`, `bottom-half` or `x,y,width,height` in the 1080×1920 source): the part of the video that shows the speaker cleanly, without the original creator's overlays. It is a separate file so changing it only re-renders; a run without `--speaker-crop` keeps the current crop.
- Stages: download, ingest, transcribe, frames, retakes, cut, plan, render, report.
  - **download**: URL sources only; writes `original.mp4` and `info.raw.json`. For file sources it has no outputs and does nothing.
  - **ingest**: `project.json` plus `original.mp4` or the local file → `source.mp4` (1080×1920, constant frame rate, H.264) and `audio.wav`. Inputs without audio are rejected.
  - **transcribe**: `audio.wav` → `transcript.json`.
  - **frames**: `source.mp4` and `transcript.json` → `frames/` and `frames.json`. One frame while each capitalised word inside a sentence is spoken (likely a name, so burned-in captions show its spelling), the rest of the `maxFrames` budget evenly spaced at least `interval` apart.
  - **plan**: `transcript.json` and `frames.json` → `visual_plan.json` (plus `visual_plan.raw.json`, the raw responses). Claude gets the transcript with every word numbered, the frames, the visual brief below and the template catalog. On-screen text is used only to correct the spelling of names. The plan is checked against the timing rules and the content rules below; if anything fails, Claude gets one retry with every problem listed. After the retry, segments that still break a content rule are dropped (the speaker shows instead) and recorded in `downgraded`; a timing problem still fails the stage.
  - **render**: `source.mp4`, `transcript.json`, `visual_plan.json` and `speaker.json` → `final.mp4` through Remotion (`reelcut/remotion/`). The plan is checked again first, so a hand edit that breaks a rule fails with the problem instead of rendering. `reelcut studio <project>` opens the same composition in Remotion Studio.
  - Until retakes and cut exist (milestone 2), plan and render work on the uncut `transcript.json` and `source.mp4`.
- Make-style staleness: a stage runs when any output is missing or older than any input. `--force` always reruns. `reelcut stage <name> <project>` runs one stage.
- All tunables in `reelcut/reelcut.config.ts`; a `reel-cut.config.json` in the current folder overrides any of them (objects merge, arrays replace).

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
  "downgraded": [ { "template": "BarChart", "startWord": 90, "endWord": 104, "reason": "..." } ] }
```

- Word indices refer to `transcript.cut.json` (until milestone 2, `transcript.json`).
- Face is implicit: any time not covered by a segment shows the speaker. Editorial rules are checked against the gaps.
- Content rules: the template exists, its props match the template's schema, numbers a template declares in `spokenNumbers` (the `BigNumber` value, `BarChart` values) appear in the segment's spoken words ("forty" == "40"), and element keys are unique.
- Reveal keys must exist in the template's `revealKeys(props)`, `atWord` must be inside the segment, reveals must be in order. Unrevealed elements show at segment start. Animation starts at word start minus `revealLeadMs` (default 40 ms).

### Visual brief (agreed 2026-10-19, revised the same day)

- Modelled on Kallaway-style explainer reels: fast cuts between three kinds of shot, every two to four seconds.
  - **Speaker**: any time outside a segment. Optional `emphasis` words (one to three of the speaker's own words) punch up huge as they are said.
  - **split**: the visual fills the top half and the speaker carries on in the bottom half. The default for most visuals.
  - **full**: the visual fills the screen while the voice carries on, for big numbers, punchlines and reveals.
- Visuals illustrate what is said instead of captioning it: phones with drawn app screens, money counters, growth curves, icon clusters, logos, kinetic text. Everything keeps moving.
- Drawn motion graphics only (the user's choice over stock footage or AI images): Lucide icons, Simple Icons brand logos, and shapes drawn in code. No photos, screenshots or footage.
- Still unusable: a visual claiming something the speaker didn't say, visuals out of sync with the words, or visuals that repeat the sentence.
- Speaker framing: when the speaker crop is about as tall as the screen it fills the screen; a wide crop (such as half of the original) is shown at full width just above centre on the backdrop, with emphasis words in the band below it, rather than blown up. Speaker shots alternate between 1× and 1.1× zoom, like jump cuts.

### Timing rules

- A segment is on screen from `leadMs` (default 40) before its first word until `leadMs` before the word after its last word, or to the end of the video when it covers the last word.
- Each segment lasts at least `minSegmentSeconds` (1.5). Between two segments the speaker is either not shown at all (back to back) or shown for at least `minFaceSeconds` (1).
- Emphasis words must fall outside every segment and match the words spoken from `atWord` on; a capitalised (likely misheard) name may differ by a couple of letters so it can take its on-screen spelling. Emphasis that fails after the retry is dropped.
- The planner only produces `kind: "visual"` segments, each with a `layout` of `split` or `full`. `kind: "placeholder"` (milestone 3) is still accepted in hand-edited plans and renders as a labelled card.

## Templates

One file per template in `reelcut/remotion/templates/` exporting `defineTemplate({ name, description, schema, revealKeys, spokenNumbers, spokenTexts, example, Component })`, plus one line in `registry.ts`. The planner catalog in the system prompt is generated from the schemas with `z.toJSONSchema`. Claude returns each segment's props as JSON text: a structured-output schema with one branch per template compiles to a grammar the API rejects as too large, so props are validated by the content rules instead.

- Every template draws into a 1080×960 box: the top half in `split`, centred 380 px from the top in `full`.
- Numbers declared by `spokenNumbers` and any digits inside `spokenTexts` (labels, badges, callouts) must be said in the segment.
- Templates (revised 2026-10-19, replacing the first text-card set): `Stat` (tilted dashboard card, number counting up, trend chart, coins), `Growth` (curve drawing in, result badge bursting at the peak), `Versus` (good and bad cards built from icon clusters), `Concept` (glowing icon with orbiting icons and pulse rings), `Flow` (icon tiles with flowing connectors), `Phone` (phone mockup with a drawn screen: creator video with a tapped sticker, paywall, notifications, app listing), `Logos`, `Kinetic` (short lines rising in one after another, with a marker swipe for highlights; toned down 2026-10-20 after the all-caps slam with shake felt tacky; lines written in capitals are turned into sentence case, and the style decides whether headlines are uppercase), `Countdown`, `Checklist` (self-drawing ticks and crosses).
- Look: set by the style (see Styles). The built-in `reelcut` style is a vivid blue backdrop with drifting light and a moving dot grid, white cards with deep shadows and a slight 3D tilt, yellow, green and red accents, in Inter. Elements spring in, float, count up and draw themselves.
- `Concept.color` and `Phone.app.color` take colour roles; the colour names in plans made before styles (`blue`, `violet`, `orange`…) are mapped onto roles.
- `TemplatePreview` composition renders one template with its `example` props, for Studio and for tests.

## Styles (milestone 5, built and signed off 2026-10-20)

Every visual's look comes from a style: data with a closed schema instead of code. A style is made from references (brand sites, logos, GitHub repos, other creators' reels, mood images) by one Claude request, and can be edited by hand. reelcut is meant to become multi-tenant, with users changing their own style through a form, so every value is a choice from a fixed set or a number within limits. Nothing in a style runs as code or loads from an arbitrary URL.

- **A style is look only.** The plan never depends on it, so changing the style only re-renders. Template props stop naming colours: `Concept.color` and `Phone.app.color` become roles (accent, positive, negative, tint 1–4), so a plan works in any style.
- **Schema** (`reelcut/src/schemas/style.ts`), shared by the generator, hand edits, render and, later, the settings form:
  - palette: backdrop (two gradient stops, equal for flat), surface, on-surface, on-surface muted, on-backdrop, on-backdrop muted, accent, positive, negative, four tints for icon tiles.
  - type: display and body font (any of the 1,837 Google Fonts that `@remotion/google-fonts` loads by name), display weight, letter spacing (tight or normal), headline case (as written or uppercase).
  - shape: corner radius (0–48 px), cards (solid, outline or glass), shadow (none, soft or deep), tilt on or off.
  - backdrop: gradient, flat, grid, grain or spotlight, with ambient drift on or off.
  - motion: calm or lively (spring presets, float amount, stagger).
  - flourishes: bursts, coins, glow and shake, each on or off.
  - icons: stroke width, and tiles filled, outlined or bare.
  - emphasis words: solid, highlight or outline.
  - notes: Claude's short reasoning, for whoever reviews the style.
- **Checks in code**: colours are valid, fonts exist, values are in range, and text contrast holds (on-surface on surface and on-backdrop on both backdrop stops; 4.5:1 for small text, 3:1 for large). A generated style must pass, with one retry listing the problems, as for the plan. A hand-edited style that fails only on contrast renders with a warning.
- **Built-in default**: today's blue look with shake off. Projects without a style use it, and `--style default` switches a project back to it.

### Making a style

`reelcut style create <name> --from <reference> [--from <reference> …]` writes `reel-cut/styles/<name>/` under the current folder:

| File | Contents |
| --- | --- |
| `sources.json` | the `--from` values |
| `references/`, `references.json` | what was gathered, and the facts read from it |
| `style.raw.json` | Claude's raw responses |
| `style.json` | the style, hand-editable |
| `sheet.png` | every template drawn in the style, plus a speaker shot with emphasis words |

It uses the same make-style runner as projects (stages gather, derive, sheet), so after a hand edit `reelcut style sheet <name>` only redraws the sheet.

What each kind of reference gives:

- **Website**: screenshots at desktop and phone width (the first screen and one further down), plus facts read from the page: colours weighted by the area they cover, `:root` CSS variables, and the fonts of body text, headings and buttons. The page's real CSS is preferred over guessing from pixels. The browser is puppeteer-core driving the Chrome Headless Shell that Remotion already downloads (`ensureBrowser()` returns its path).
- **GitHub repo**: the repo's homepage, treated as a website, when it has one; images in its README (logos, banners); and the owner's avatar. GitHub's own page is never screenshotted, since it shows GitHub's style rather than the project's.
- **Reel**: downloaded and sampled with the shared download and frames code. Stills give the look but not the movement.
- **Image or logo**, as a file or URL: used as is. SVGs are rasterised in the browser.

The derive stage sends one Claude request with the references (images resized for the API), the facts and the style schema, and gets a style back through structured output.

### Using a style

- `reelcut run <input> --style <name>` writes the project's `style.json`: `{ "version": 1, "base": "<name>", "overrides": {} }`. `overrides` holds any part of a style for this project only, deep-merged over the base. This is the split between a tenant's brand style and per-project changes that the multi-tenant version needs.
- render's inputs gain the project's `style.json` and the base style's `style.json`, so editing either re-renders and nothing else.
- In Remotion, the resolved style is part of the render props and templates read it through a `useStyle()` context instead of importing `theme`. The colours written straight into templates (about 80) move onto palette roles, and fonts load by name at render time.
- Later, Remotion Player can preview a style on the user's own video in the browser without a server render.

### Not in this milestone

- Template packs with a different visual language (hand-drawn, paper cut-out, 3D, photo collage). Those need new components and are built separately.
- Putting the brand's logo on the video.
- Fetching user-supplied URLs safely on a server (blocking private addresses, size and time limits). That is needed once reelcut is multi-tenant; for now the CLI fetches what it is given.

### How it is judged

Two or three styles made from real references of different kinds, each shown as its sheet and as ig-DZdNqU3vaF8 rendered in it.

### Settled while building

- Fonts are resolved in Node (`resolveFontFiles`: each family's nearest available weights, latin and latin-ext files) and passed in the render props as `fonts`, which the composition loads with `FontFace`. Loading them by name inside the bundle would make webpack bundle all 1,838 font modules on every render.
- Style names are lowercase letters, digits and dashes, so a name can never point outside `reel-cut/styles/`.
- `style.json` rejects unknown keys, so a misspelt setting is an error rather than silently ignored.
- Website colours come from a grid of points on the first two screens (the colour actually painted at each point) and every colour is normalised through a canvas, so `oklch()` and `hsl()` values come out as hex.
- Images keep PNG only when they have transparency; photos and screenshots are JPEG, which keeps them under the API's per-image limit.
- A GitHub homepage that fails to load is skipped; the README images and owner avatar are still used.
- `Placeholder` (hand-written placeholder segments) keeps its fixed debug look.
- The sheet's emphasis tile shows the emphasis words on the backdrop; a style has no speaker video to show.
- Contrast also covers `accent` on both backdrop colours, since every other emphasis word is drawn in the accent.
- Reference safety: SVGs are drawn as images (`data:` URI, scripts off), so they can't pull in local files; downloaded images are decoded only as PNG, JPEG, GIF or WebP, chosen from their first bytes, so a disguised playlist can't make ffmpeg read local files; GitHub homepages must be http(s); a GitHub URL that isn't a repo is refused, since it would only show GitHub's own style. If headless Chrome won't start, only the references that need it fail.
- Settings under `styles` in `reelcut.config.ts`: `maxImages` (20), `pageTimeoutSeconds` (30), `reelFrames` (6). `GITHUB_TOKEN`, when set, raises GitHub's rate limit.

## Milestone 6 (design in progress, 2026-10-20)

Captions, transitions, edit report and polish. Settled so far:

- **Captions, Kallaway-style** (agreed with mockups in the default, Kallaway and crontent styles). Short phrases of two or three words, broken at commas and full stops, written as spoken: punctuation kept, no capitals added, no highlighted current word (the brief's highlight was dropped for the Kallaway look). A phrase appears when its first word is said and stays until the next one, or clears in a pause of more than about half a second. Placement: on a speaker shot, in the band under the speaker (over the chest when the speaker fills the screen); on a split shot, on the seam between visual and speaker, on an ink pill (the dark pill from the Kallaway reel, chosen over a white chip); on a full shot, under the visual; none on Kinetic, whose words are already on screen. The caption steps aside while an emphasis word is showing. Captions keep clear of Instagram's buttons and caption, with the margins in config. The style gains a small closed `captions` section (font: display or body; italic), filled in for the existing styles from their other settings.
- **Name fixes.** Captions show the transcript's words, so a misheard name shows wrong ("RecipeMe's" for ReciMe). The planner also returns name fixes, read from the on-screen text it already sees, and captions use them.
- **Read time.** A visual whose words end soon after its last reveal is cut off before it can be read: the visual ends the moment the next sentence starts. In ig-DZdNqU3vaF8 the "ten things, done badly" card finishes animating about a tenth of a second before the next shot, and four of nine visuals end within a second of their last reveal. So every visual stays on screen for at least `holdSeconds` (1.2) after its last element finishes animating in, holding over the start of the next sentence while the voice carries on; the next shot starts later. A hold never pushes the next visual past its first reveal, never shortens it below `minSegmentSeconds`, and never covers an emphasis word; where it would, the hold is shortened. Worked out at render time, so existing plans get it without re-planning; the planner prompt is told about the hold.

## Milestones

1. Scaffold, config, download, ingest, transcribe. (Done; restored on `@reel/shared` in the 2026-10-18 split.)
2. Retake detection and cutting.
3. Visual planning; every non-face segment rendered as a placeholder. (Done; signed off 2026-10-19.)
4. Template library, layouts and word-synced reveals. (First version built 2026-10-19; redesigned the same day after feedback that it lacked flair; Kinetic toned down 2026-10-20. Signed off 2026-10-20.)
5. Styles from references (above). Moved ahead of captions on 2026-10-20; built and signed off the same day.
6. Captions, transitions, edit report, polish.

Next up is the visuals (milestones 3 and 4), judged on downloaded talking-head reels that have no visuals of their own: reelcut should add visuals to the speaker. Downloaded reels are already edited, so retake cutting (milestone 2) has little to do on them and is best tested on raw recordings.
