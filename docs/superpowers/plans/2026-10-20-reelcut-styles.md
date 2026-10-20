# reelcut Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every visual's look out of template code into a validated style file, make styles from references (websites, GitHub repos, reels, images) with one Claude request, and render any project in any style.

**Architecture:** A closed zod `StyleSchema` is the single source of truth. Remotion templates read the resolved style through a React context; the render stage resolves a project's `style.json` (`base` style plus `overrides`) and passes it in the render props. Styles live in `reelcut/styles/<name>/` and are made by a second small make-style pipeline (gather → derive → sheet) on the shared runner.

**Tech Stack:** Node 22.12, TypeScript, tsx, vitest, Zod 4, Remotion 4.0.533 (`@remotion/google-fonts` `getAvailableFonts`, `@remotion/renderer` `ensureBrowser`, `renderStill`), puppeteer-core 25.12.0, ffmpeg, yt-dlp, Anthropic SDK 0.131.

**Spec:** `reelcut/docs/design.md`, section "Styles (milestone 5, proposed 2026-10-20)".

## Global Constraints

- Never run `git commit` or `git push`. Staging is fine.
- No code comments unless a non-obvious "why" demands one.
- npm, not pnpm. New dependency `puppeteer-core` pinned to exactly `25.12.0` in `reelcut/package.json`. Remotion packages stay pinned at `4.0.533`.
- The plan never depends on the style: no change in this milestone may make a style change rerun the plan stage.
- Every value in a style is an enum, a boolean, a hex colour `#rrggbb`, a Google Font family name, or a number with bounds. No free CSS, no URLs.
- Templates take every colour from the style. No hex or `rgb(` literal remains in `reelcut/remotion/templates/*.tsx` or `reelcut/remotion/Shots.tsx`.
- Claude calls go through `createClaudeClient()` / `claudeModel()` from `@reel/shared/claude.ts`, `client.beta.messages.parse` with `betaZodOutputFormat`, `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`, and the same refusal / max_tokens / no-parse errors as `src/plan/claude.ts`.
- Restraint is the default taste (user feedback 2026-10-19): the derive prompt leaves shake off and keeps flourishes sparing unless the references are clearly loud.
- Tunables go in `reelcut/reelcut.config.ts`; `reelcut/styles/` is gitignored.

## Review Focus

1. **Plans made before this milestone use colour names** (`"blue"`, `"orange"`, `"violet"`) in `Concept.color` and `Phone.app.color`. They must still render, mapped to roles. Test in Task 3.
2. **A reference that fails** (site times out, blocks headless Chrome, 404s, private repo) must not sink the whole style: it is recorded with its error and the others are used. Only when nothing usable was gathered does the stage fail, naming each source and its error. Test in Task 6.
3. **A chosen Google Font that lacks the requested weight** (for example a display face with only 400) must still render, using the nearest weight the family has. Test in Task 2.
4. **Transparent logos** must keep their alpha when normalised, so a white logo isn't flattened onto black. Test in Task 6.
5. **A hand-edited `style.json` with a wrong value** (bad colour, unknown font, misspelt enum) fails render with the path and the problem (`palette.accent: …`), not a stack trace; a contrast-only failure renders with a warning. Test in Task 4.

---

### Task 1: Style schema, built-in default, merge and checks

**Files:**
- Create: `reelcut/src/schemas/style.ts`, `reelcut/src/style/default.ts`, `reelcut/src/style/resolve.ts`, `reelcut/src/style/checks.ts`, `reelcut/src/style/fonts.ts`
- Test: `reelcut/tests/style.test.ts`

**Interfaces:**
- Produces:
  - `StyleSchema`, `type Style` with exactly these fields:
    - `version: 1`
    - `palette: { backdrop: [hex, hex]; surface; onSurface; onSurfaceMuted; onBackdrop; onBackdropMuted; accent; onAccent; positive; negative; tints: [hex, hex, hex, hex] }` (all `#rrggbb`, lowercase accepted and normalised)
    - `type: { display: string; body: string; displayWeight: 500|600|700|800|900; tracking: "tight"|"normal"; headlineCase: "as-written"|"uppercase" }`
    - `shape: { radius: int 0–48; cards: "solid"|"outline"|"glass"; shadow: "none"|"soft"|"deep"; tilt: boolean }`
    - `backdrop: { kind: "gradient"|"flat"|"grid"|"grain"|"spotlight"; drift: boolean }`
    - `motion: "calm"|"lively"`
    - `flourishes: { bursts: boolean; coins: boolean; glow: boolean; shake: boolean }`
    - `icons: { stroke: number 1.25–3; tiles: "filled"|"outline"|"bare" }`
    - `emphasis: "solid"|"highlight"|"outline"`
    - `notes: string` (max 600)
  - `StyleOverridesSchema` (deep partial of the above, minus `version`), `ProjectStyleSchema = { version: 1, base: string | null, overrides: StyleOverrides }`, `type ProjectStyle`.
  - `DEFAULT_STYLE: Style` in `src/style/default.ts`: today's look (`theme.ts` colours: backdrop `["#2445ff", "#070b3a"]`, surface white, onSurface `#0b1020`, accent `#ffd43b`, positive `#22c55e`, negative `#f43f5e`, tints blue/violet/cyan/orange), Inter 900, radius 40, solid cards, deep shadow, tilt on, gradient backdrop with drift, lively, bursts/coins/glow on, shake off, stroke 2.2, filled tiles, emphasis `solid`.
  - `mergeStyle(base: Style, overrides: StyleOverrides): Style` (deep merge; arrays replace).
  - `contrastRatio(a: string, b: string): number` (WCAG relative luminance).
  - `styleProblems(style: unknown): { errors: string[]; contrast: string[]; style: Style | null }`: zod issues as `"<path>: <message>"`, unknown fonts as `type.display: "Interr" is not a Google Font; did you mean "Inter"?`, contrast below 4.5 for `onSurface`/`surface` and `onSurfaceMuted`/`surface`, below 3 for `onBackdrop` against each backdrop stop and `onAccent`/`accent`.
  - `src/style/fonts.ts`: `isGoogleFont(family: string): boolean`, `closestFonts(family: string, n = 3): string[]`, `nearestWeight(available: string[], wanted: number): string` (used by Task 2 too; must not import Remotion browser code).

- [ ] **Step 1: Write the failing tests** in `tests/style.test.ts`:
  - `"the built-in default is a valid style with no problems"`: `styleProblems(DEFAULT_STYLE)` → `{ errors: [], contrast: [] }`.
  - `"merges overrides deeply and replaces arrays"`: `mergeStyle(DEFAULT_STYLE, { palette: { accent: "#ff0000" }, backdrop: { kind: "flat" } })` keeps `palette.surface` and `backdrop.drift`, sets the two values; overriding `palette.tints` with 4 colours replaces all four.
  - `"measures contrast like WCAG"`: `contrastRatio("#000000", "#ffffff")` → 21; `contrastRatio("#777777", "#ffffff")` → close to 4.48 (2 dp).
  - `"names the path of a bad value"`: `styleProblems({ ...DEFAULT_STYLE, palette: { ...DEFAULT_STYLE.palette, accent: "yellow" } }).errors[0]` starts with `palette.accent:`.
  - `"suggests a real font for a typo"`: display `"Interr"` → error contains `did you mean "Inter"`.
  - `"reports low contrast separately from errors"`: onSurface `#eeeeee` on white surface → `errors: []`, `contrast[0]` contains `palette.onSurface` and the ratio.
  - `"picks the nearest available weight"`: `nearestWeight(["400", "700"], 900)` → `"700"`; `nearestWeight(["400"], 800)` → `"400"`.
- [ ] **Step 2:** `npx vitest run reelcut/tests/style.test.ts` → FAIL (modules missing).
- [ ] **Step 3:** Implement the files above. Font names come from `getAvailableFonts()` of `@remotion/google-fonts` (works in Node); `closestFonts` ranks by case-insensitive prefix match, then Levenshtein.
- [ ] **Step 4:** Run the test → PASS. Stage the files.

### Task 2: Remotion reads the style

**Files:**
- Create: `reelcut/remotion/style/StyleContext.tsx`, `reelcut/remotion/style/tokens.ts`, `reelcut/remotion/style/StyleFonts.tsx`, `reelcut/remotion/StyleSheet.tsx`
- Modify: `reelcut/remotion/props.ts`, `reelcut/remotion/Reel.tsx`, `reelcut/remotion/Root.tsx`, `reelcut/remotion/templates/parts.tsx`, `reelcut/remotion/templates/theme.ts` (keep only `BOX`, `FULL_BOX_TOP`), `reelcut/remotion/Shots.tsx`, `reelcut/remotion/fonts.ts` (delete), `reelcut/src/render/props.ts`, `reelcut/remotion/templates/icons.tsx`
- Test: `reelcut/tests/remotion.e2e.test.ts`, `reelcut/tests/renderProps.test.ts`

**Interfaces:**
- Consumes: `Style`, `DEFAULT_STYLE`, `nearestWeight` (Task 1).
- Produces:
  - `RenderProps.style: Style`, `PreviewProps.style: Style`, `SheetProps = { style: Style }`, `SHEET_ID = "StyleSheet"` in `remotion/props.ts`. `buildRenderProps` takes `style: Style` and copies it through.
  - `StyleProvider({ style, children })`, `useStyle(): Style`.
  - `StyleFonts({ style })`: loads `type.display` and `type.body` by name via `getAvailableFonts()` → `load()` → `loadFont("normal", { weights, subsets: ["latin"] })`, holding the render with `delayRender`/`continueRender`; weights come from the family's available weights through `nearestWeight`.
  - tokens: `alpha(hex: string, a: number): string`, `mix(a: string, b: string, t: number): string`, `shadowFor(style: Style, depth: "card" | "small"): string | undefined`, `springFor(style: Style): SpringConfig`, `fontStack(family: string): string`, `trackingFor(style: Style, size: number): number`, `headline(style: Style, text: string): string` (applies `headlineCase`), `tint(style: Style, role: ColorRole): string` with `ColorRole = "accent" | "positive" | "negative" | "tint1" | "tint2" | "tint3" | "tint4"`.
  - parts.tsx: `useReveal(at, delay?, config?)` defaults to `springFor(style)`; `useFloat` amplitude halves when `motion` is `calm`; `Backdrop` draws the five kinds from `palette.backdrop` and moves only when `drift`; `Card` uses surface, radius, `cards` and shadow; `Camera` sets `fontStack(type.body)`; `Burst` renders nothing unless `flourishes.bursts`; new `IconTile({ icon, size, role })` drawing filled / outline / bare tiles; `Glyph` default stroke from `icons.stroke` (pass explicitly from callers that have the style).
  - `Emphasis` in Shots.tsx follows `emphasis` (`solid` text, `highlight` marker as in Kinetic, `outline` hollow), `headlineCase`, display font and weight.
  - `StyleSheet` composition, 1620×1920: a 3×4 grid of 540×480 tiles, each one template's `example` drawn at half scale in its `split` box at frame 90, plus one tile of an emphasis word on the backdrop and one swatch tile (palette chips, font names).
- [ ] **Step 1: Write the failing tests** in `tests/remotion.e2e.test.ts`:
  - `"draws the backdrop in the style's colours"`: `renderStill` of `TemplatePreview` (Stat example, split) with `DEFAULT_STYLE` and with a flat light style (`backdrop: { kind: "flat", drift: false }`, `palette.backdrop: ["#f4efe6", "#f4efe6"]`); the pixel at (20, 20) is within 12 per channel of `#f4efe6` for the light style and is blue-dominant for the default.
  - `"renders the style sheet"`: `renderStill` of `SheetProps` with `DEFAULT_STYLE` writes a 1620×1920 PNG.
  - existing `"renders every template's example in both layouts"`: loops over `[DEFAULT_STYLE, lightStyle]`.
  - In `renderProps.test.ts`, the expected props include `style: DEFAULT_STYLE` passed through.
- [ ] **Step 2:** `npx vitest run reelcut/tests/remotion.e2e.test.ts reelcut/tests/renderProps.test.ts` → FAIL.
- [ ] **Step 3:** Implement. `Reel`, `TemplatePreview` and `StyleSheet` each wrap their tree in `StyleProvider` and render `StyleFonts`. Root's default props use `DEFAULT_STYLE`. Templates keep working in this task by reading `useStyle()` wherever they used `theme`. Task 3 removes the literals.
- [ ] **Step 4:** Run the tests → PASS. Run `npm run typecheck`. Stage the files.

### Task 3: Templates take every colour and flourish from the style

**Files:**
- Modify: all ten files in `reelcut/remotion/templates/` (`Stat`, `Growth`, `Versus`, `Concept`, `Flow`, `Phone`, `Logos`, `Kinetic`, `Countdown`, `Checklist`), `reelcut/remotion/Placeholder.tsx`
- Test: `reelcut/tests/planContent.test.ts`, new `reelcut/tests/templateStyle.test.ts`

**Interfaces:**
- Consumes: Task 2 tokens and parts.
- Produces: `Concept.color` and `Phone.app.color` become `colorRole`: `z.preprocess(legacyColor, z.enum(["accent","positive","negative","tint1","tint2","tint3","tint4"]))`, exported from `templates/icons.tsx` next to `iconName`. Legacy map: `yellow→accent, green→positive, red→negative, blue→tint1, violet→tint2, cyan→tint3, orange→tint4, pink→tint4`.
- Rules per template: coins only when `flourishes.coins`; glows, glowing `drop-shadow`s and halo `box-shadow`s only when `flourishes.glow`; card tilts and rotations only when `shape.tilt`; Kinetic adds back a small shake (max 6 px, 8 frames) only when `flourishes.shake`, and its lines and every big headline go through `headline(style, text)`; icon tiles use `IconTile`.
- [ ] **Step 1: Write the failing tests:**
  - `templateStyle.test.ts` `"templates take every colour from the style"`: reads each `remotion/templates/*.tsx` and `remotion/Shots.tsx` and asserts no match for `/#[0-9a-fA-F]{3,8}\b|rgba?\(/`. `parts.tsx` and `style/tokens.ts` may build colours from the style, so `parts.tsx` is exempt only for `rgba(` built from `alpha()`; simplest is to make `parts.tsx` pass the same assertion.
  - `planContent.test.ts` `"accepts colour names from plans made before styles"`: a Concept segment with `color: "violet"` has no problems, and `Concept.schema.parse(...).color` is `"tint2"`.
- [ ] **Step 2:** Run both → FAIL.
- [ ] **Step 3:** Convert each template. Update each template's `description` where it mentions colour names. Update the `planSystemPrompt` catalog text only through the schemas; there is no hand-written colour list in the prompt.
- [ ] **Step 4:** Run `npx vitest run reelcut/tests` → PASS (including the two-style render of every template from Task 2). Render the ig-DZdNqU3vaF8 split and full stills for Stat, Phone and Kinetic with `DEFAULT_STYLE` and eyeball them against `final.before-kinetic.mp4` for regressions. Stage the files.

### Task 4: Projects choose a style; render resolves it

**Files:**
- Modify: `reelcut/src/pipeline/paths.ts` (`style`), `reelcut/src/pipeline/project.ts`, `reelcut/src/pipeline/runner.ts`, `reelcut/src/pipeline/context.ts` (`stylesRoot: string`), `reelcut/src/pipeline/stages/render.ts`, `reelcut/src/cli/index.ts`, `reelcut/src/config/schema.ts` + `reelcut/reelcut.config.ts` (`paths.stylesDir: "styles"`), `.gitignore` (`reelcut/styles/`)
- Create: `reelcut/src/style/paths.ts`
- Test: `reelcut/tests/pipeline.e2e.test.ts`

**Interfaces:**
- Consumes: `ProjectStyleSchema`, `mergeStyle`, `styleProblems`, `DEFAULT_STYLE`.
- Produces:
  - `stylePaths(stylesRoot: string, name: string)` → `{ dir, sources, referencesDir, references, styleRaw, style, sheet }` (`sources.json`, `references/`, `references.json`, `style.raw.json`, `style.json`, `sheet.png`).
  - `readProjectStyle(ctx): Promise<ProjectStyle | null>`.
  - `resolveStyle(ctx): Promise<{ style: Style; warnings: string[]; inputs: string[] }>`: no project style or `base: null` → `DEFAULT_STYLE`; a missing base fails with `Style "<name>" does not exist. Make it with: reelcut style create <name> --from <reference>`; errors fail with `style breaks these rules:\n- …`; contrast problems become warnings logged by render.
  - `initProject` takes `style?: string | null`: `undefined` keeps the current file; a name writes `{ version: 1, base: name, overrides }`, keeping existing overrides; `null` writes `base: null`. Uses `writeIfChanged`.
  - render inputs add the project `style.json` and the base `style.json` when they exist.
  - CLI: `reelcut run … --style <name>` (`--style default` means `null`).
- [ ] **Step 1: Write the failing tests** in `pipeline.e2e.test.ts` (fake renderer records `props.style`):
  - `"renders in the default style when the project has none"`.
  - `"renders in the chosen style with the project's overrides on top"`: write `styles/brand/style.json`, run with `style: "brand"`, then add `overrides.palette.accent` → render re-runs, plan doesn't, and the recorded accent is the override.
  - `"re-renders when the base style changes and nothing else"`: bump the base file's mtime → only render runs.
  - `"names the missing style and how to make it"`.
  - `"fails on a broken hand-edited style with the path"` (`palette.accent: "yellow"`) and `"renders with a warning when only contrast fails"` (log contains `warning:` and `palette.onSurface`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. `renderPropsFor` calls `resolveStyle` and passes `style` to `buildRenderProps`; `reelcut studio` gets it for free.
- [ ] **Step 4:** Run `npx vitest run reelcut/tests` → PASS. Stage.

### Task 5: Understanding references (pure functions)

**Files:**
- Create: `reelcut/src/style/references.ts`, `reelcut/src/style/readme.ts`, `reelcut/src/style/pageFacts.ts`
- Test: `reelcut/tests/styleReferences.test.ts`

**Interfaces:**
- Produces:
  - `type Reference = { kind: "website"; url: string } | { kind: "github"; owner: string; repo: string } | { kind: "reel"; url: string } | { kind: "image"; url: string } | { kind: "file-image"; path: string } | { kind: "file-video"; path: string }`.
  - `classifyReference(value: string, exists: (path: string) => boolean): Reference`. Instagram `/p/`, `/reel/`, `/reels/`, TikTok and YouTube Shorts URLs → reel; `github.com/<owner>/<repo>` (any subpath) → github; URL path ending in an image extension (`png jpg jpeg webp gif svg`) → image; other http(s) → website; an existing local `.html` file → website with a `file://` URL; existing image / video files → file-image / file-video; anything else throws `"<value>" is not a URL and there is no such file`.
  - `readmeImages(markdown: string, owner: string, repo: string, max = 4): string[]`: markdown `![…](…)` and `<img src="…">`, relative paths resolved against `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/`, skipping badge hosts (`img.shields.io`, `badge.fury.io`, `badgen.net`, `github.com/.../workflows/.../badge.svg`, `codecov.io`), de-duplicated, first `max`.
  - `type PageSample = { tag: string; background: string; color: string; area: number; fontFamily: string; role: "body" | "heading" | "button" | "other" }`, `PAGE_SAMPLER: string` (a self-contained function source that `page.evaluate` runs: visible elements' computed styles plus `:root` custom properties whose values parse as colours), and `summarizeFacts(samples: PageSample[], variables: Record<string, string>): PageFacts` with `PageFacts = { colors: { hex: string; share: number; use: "background" | "text" }[]; variables: Record<string, string>; fonts: { body: string | null; headings: string | null; buttons: string | null } }`. Colours normalised to `#rrggbb`, transparent ignored, shares by area summing to 1 per use, top 8 per use; font = first family in the stack, quotes stripped, generic families (`sans-serif`, `system-ui`, `-apple-system`) skipped; at most 40 variables.
- [ ] **Step 1: Write the failing tests** for each case named above, including `github.com/remotion-dev/remotion/tree/main/packages` → github `remotion-dev/remotion`, and `https://www.instagram.com/p/DWysLjODhfW/` → reel.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. Stage.

### Task 6: Gathering references into images and facts

**Files:**
- Create: `reelcut/src/style/gather/images.ts`, `reelcut/src/style/gather/browser.ts`, `reelcut/src/style/gather/website.ts`, `reelcut/src/style/gather/github.ts`, `reelcut/src/style/gather/reel.ts`, `reelcut/src/style/gather/index.ts`, `reelcut/src/schemas/references.ts`
- Modify: `reelcut/package.json` (`puppeteer-core: 25.12.0`), config (`styles: { maxImages: 20, pageTimeoutSeconds: 30, reelFrames: 6 }`)
- Test: `reelcut/tests/styleGather.e2e.test.ts`, fixtures `reelcut/tests/fixtures/brand.html` (inline CSS: `:root { --brand: #635bff }`, body `#0a2540` on white, a button in `--brand`, `font-family: "Space Mono", monospace`), `reelcut/tests/fixtures/logo.png` generated in the test with ffmpeg (`color=c=white@0.0` RGBA with a white square).

**Interfaces:**
- Consumes: Task 5 functions; `downloadVideo`, `sampleFrames` from `@reel/shared`.
- Produces:
  - `ReferencesSchema = { version: 1, references: { source: string; kind: Reference["kind"]; images: { file: string; caption: string }[]; facts: PageFacts | null; error: string | null }[] }`.
  - `normalizeImage(ffmpeg: string, input: string, output: string): Promise<void>`: longest edge at most 1568 px; PNG output keeps alpha (`-pix_fmt rgba`), screenshots and frames are JPEG.
  - `withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T>`: `ensureBrowser()` from `@remotion/renderer`, then `puppeteer.launch({ executablePath: status.path, headless: true })`.
  - `gatherWebsite(browser, url, dir, timeoutSeconds)`: desktop 1440×900 screenshot, one screen further down, phone 390×844 screenshot (JPEG), then `PAGE_SAMPLER` + `summarizeFacts`. Captions: `"<host>, desktop, top"` etc.
  - `gatherGithub(ref, dir, deps: { fetch: typeof fetch; gatherWebsite })`: `GET https://api.github.com/repos/<owner>/<repo>` (with `Authorization: Bearer $GITHUB_TOKEN` when set), the README via `GET …/readme` with `Accept: application/vnd.github.raw`, `readmeImages`, the owner avatar; when `homepage` is set, the website result is merged in.
  - `gatherReel(url, dir, tools)`: download into the style dir, `sampleFrames` with `maxFrames = reelFrames`.
  - `gatherAll(sources: string[], paths: StylePaths, config): Promise<References>`: each source in turn, errors caught per source into `error`; throws `None of the references could be used:\n- <source>: <error>` when no reference has an image. SVG images are rasterised by opening them in the browser.
- [ ] **Step 1: Write the failing tests** (skip when ffmpeg or the Chrome Headless Shell is missing):
  - `"reads a page's real colours and fonts"`: `gatherAll(["tests/fixtures/brand.html"])` → facts include `#635bff` in `variables` and `colors`, `fonts.body` is `"Space Mono"`, and three screenshots exist.
  - `"keeps a logo's transparency"`: the normalised logo probes as `rgba` and stays PNG.
  - `"uses a repo's homepage and README images, not GitHub's page"`: `gatherGithub` with a fake `fetch` returning `{ homepage: "file://…/brand.html", owner: { avatar_url: "…/avatar.png" } }` and a README with one badge and one logo → the logo and avatar are fetched, the badge isn't, and website facts are merged.
  - `"carries on when one reference fails"`: `["https://127.0.0.1:9/nothing", "tests/fixtures/brand.html"]` → the first has `error`, the second has images; with only the failing source it throws, naming it.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement and `npm install puppeteer-core@25.12.0 -w reelcut --save-exact`. **Step 4:** Run → PASS. Stage.

### Task 7: The styler (one Claude request)

**Files:**
- Create: `reelcut/src/style/Styler.ts`, `reelcut/src/style/prompt.ts`, `reelcut/src/style/claude.ts`, `reelcut/src/style/mock.ts`
- Test: `reelcut/tests/stylePrompt.test.ts`

**Interfaces:**
- Consumes: `References`, `StyleSchema`.
- Produces:
  - `StylerInput = { references: References; images: { caption: string; mediaType: "image/jpeg" | "image/png"; data: Buffer }[]; retry?: { previous: unknown; problems: string[] } }`, `Styler { style(input): Promise<{ raw: unknown; output: unknown }> }`.
  - `styleSystemPrompt(): string`: what a style is for (animated explainer graphics over a talking-head reel), how to read each kind of reference (page facts beat pixels for colours and fonts; a reel's frames show its graphics' look, not the person; logos suggest the accent), that fonts must be Google Fonts family names (pick the closest when the reference uses another), the contrast minimums, and the restraint default. Ends with the style's JSON schema from `z.toJSONSchema(StyleSchema)`.
  - `buildStyleMessages(input): BetaMessageParam[]`: one text block per reference (source, kind, facts as JSON, error when present), each image as an image block preceded by its caption, then `"Make the style."`; on retry, the previous output as the assistant turn and `That style breaks these rules:\n- …\n\nReturn the whole style again with these fixed.`
  - `ClaudeStyleSchema`: `StyleSchema`'s shape with plain `z.string()` for colours and fonts and no numeric bounds (the API grammar stays small; `styleProblems` validates).
  - `createClaudeStyler(model = claudeModel()): Styler`, `createMockStyler(outputs: unknown[], calls: StylerInput[]): Styler`.
- [ ] **Step 1: Write the failing tests:** messages contain one image block per image with the right media type, the facts JSON for the fixture page, and the retry turn lists the problems; the system prompt contains `"Google Fonts"` and the JSON schema's `"headlineCase"`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. Stage.

### Task 8: The style pipeline and its commands

**Files:**
- Create: `reelcut/src/style/pipeline/context.ts`, `reelcut/src/style/pipeline/stages.ts` (gather, derive, sheet), `reelcut/src/style/pipeline/runner.ts`, `reelcut/src/style/sheet.ts`
- Modify: `reelcut/src/cli/index.ts`, `reelcut/src/render/remotion.ts` (export a `renderSheet`)
- Test: `reelcut/tests/style.e2e.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 5, 6, 7; `createPipeline` from `@reel/shared/pipeline/runner.ts`.
- Produces:
  - `StyleContext extends BaseContext { paths: StylePaths; config: ReelcutConfig; styler: () => Styler; sheet: () => SheetRenderer }`, `SheetRenderer { render(style: Style, output: string): Promise<void> }` (Remotion `renderStill` of `StyleSheet`).
  - Stages: **gather** `[sources] → [references]`; **derive** `[references] → [styleRaw, style]`, one request plus one retry on `errors` or `contrast`, then failing with `The style still breaks these rules after a retry:\n- …` and removing `style.json`; **sheet** `[style] → [sheet]`.
  - `initStyle(ctx, sources: string[])` writes `sources.json` with `writeIfChanged`.
  - CLI: `reelcut style create <name> --from <reference...> [--force]` runs the three stages; `reelcut style sheet <name>` forces the sheet stage after a hand edit. Both print the sheet path.
- [ ] **Step 1: Write the failing tests** (mock styler, fake sheet renderer, fixture page as the source):
  - `"makes a style from references"`: `style.json` equals the mock's style, `style.raw.json` holds one attempt, `sheet.png` exists.
  - `"retries once with the problems, then fails"`: first output has font `"Interr"`, second is valid → two calls, the second input's `retry.problems[0]` mentions `did you mean "Inter"`; when both are bad the stage fails and `style.json` doesn't exist.
  - `"keeps a hand-edited style until the references change"`: edit `style.json`, rerun → derive skipped, sheet re-runs; change `--from` → derive re-runs.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run `npx vitest run reelcut/tests` and `npm run typecheck` → PASS. Stage.

### Task 9: Real styles, docs, and showing the result

**Files:**
- Modify: `reelcut/docs/design.md` (milestone status, the schema as built, commands), memory status line.

- [ ] **Step 1:** `reelcut style create stripe --from https://stripe.com`, `reelcut style create remotion --from https://github.com/remotion-dev/remotion`, `reelcut style create kallaway --from https://www.instagram.com/p/DWysLjODhfW/`. Read each `references.json` and `style.json`; open each `sheet.png`.
- [ ] **Step 2:** For each style, `reelcut run https://www.instagram.com/p/DZdNqU3vaF8/ --style <name>` (only render runs) and copy `final.mp4` to `final.<name>.mp4`; extract the same three stills (speaker + emphasis, split, full) from each.
- [ ] **Step 3:** Update `design.md`: milestone 5 built and awaiting sign-off, plus anything the build changed in the spec. Run the full suite and typecheck one last time. Stage.
- [ ] **Step 4:** Show the user the sheets and stills side by side and stop for sign-off.
