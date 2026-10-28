---
name: reel-cut
description: Use when the user wants a vertical talking-head video, voiceover or Instagram/TikTok reel edited into a reel with animated visuals, or wants to change a visual, timing or look in a reel-cut project (visual_plan.json, final.mp4).
---

# reel-cut

`npx -y @jose.legaspi/reel-cut` edits a vertical video in stages: clean the voice and transcribe (ElevenLabs), cut retakes and pauses, plan visuals (Claude), render (Remotion). Every stage writes files to `reel-cut/projects/<name>/` under the current folder and only reruns when its inputs change, so hand edits survive.

## Before the first run

1. Run `npx -y @jose.legaspi/reel-cut doctor`. For anything missing, tell the user its hint. API keys go in `.env` in the current folder or the shell; never invent one.
2. If the speaker says names (company, product, people), write them to `reel-cut.config.json` so they're transcribed with the right spelling:
   ```json
   { "transcription": { "keyterms": ["Acme", "Jane Doe"] } }
   ```

## Make the reel

Run `npx -y @jose.legaspi/reel-cut run <video file or reel URL> [options]` in the background: it takes minutes and calls paid APIs. Wait for it to finish rather than polling.

For several clips recorded separately, pass them in the order they should play: `npx -y @jose.legaspi/reel-cut run intro.mov part2.mov outro.mov`. They're stitched together in that order and each is cleaned up; a line said again in a later clip keeps only its better version. Clips must be local files.

| Option | Use when |
| --- | --- |
| `--name <project>` | Picking the project name (default: file name, or `ig-<id>` for Instagram) |
| `--style <name>` | Drawing visuals in a style made with the reel-style skill |
| `--no-face` | The video is a voiceover with nobody on camera |
| `--isolate-voice` | Only when the user explicitly asks to isolate the voice or remove echo or background noise |
| `--aggressive` | The user wants "um", "like" and similar cut even inside good sentences |
| `--speaker-crop top-half\|bottom-half\|x,y,w,h` | The speaker fills only part of the 1080×1920 frame, e.g. a repost with overlays. Check `frames/` first |
| `--force` | Rerunning every stage. Re-bills both APIs and discards hand edits |

Never add `--isolate-voice` on your own, even if the audio sounds echoey: ElevenLabs voice isolation is billed separately and costs far more than the rest of the run. If echo or noise is a problem, tell the user the flag exists and let them decide.

The result is `reel-cut/projects/<name>/final.mp4`. Before calling it done, check it with `ffprobe` and look at a few frames (`ffmpeg -ss <seconds> -i final.mp4 -frames:v 1 frame.png`).

To rerun later with `run`, repeat the same input and flags, since a changed flag reruns the stages that depend on it. Passing a different `--style` only re-renders.

## Check the words

Before planning, read `transcript.cut.json` for misheard names and write fixes to `spellings.json`. Captions show every word, and visuals take names from it. Changing it re-plans and re-renders, without re-cutting.

## Change the edit

| File | Holds |
| --- | --- |
| `cuts.json` | `keep`: word ranges (`fromWord`/`toWord`, inclusive, numbered as in `transcript.json`) in the order they play; `removed`: what was left out and why |
| `clips.json` | Where each clip starts and ends in `source.mp4`, in seconds |
| `spellings.json` | Optional fixes for misheard words, used by the plan and the captions: `{ "version": 1, "spellings": { "Next-JS": "nextjs", "red it": "read it" } }`. A fix keeps the number of words |
| `transcript.cut.json` | The words left after the cut, numbered by `i`, with start and end seconds in `cut.mp4` |
| `visual_plan.json` | `segments`: `template`, `layout` (`split` or `full`), `startWord`/`endWord` (word `i`), `props`, `reveals`; plus `emphasis` words |
| `style.json` | The project's style, as `base` plus `overrides` |

1. Find the word numbers for the moment in `transcript.cut.json` (not `transcript.json`: the plan counts words after the cut).
2. Run `npx -y @jose.legaspi/reel-cut templates` to see every template and the props it takes.
3. Edit the segment in `visual_plan.json`.
4. Run `npx -y @jose.legaspi/reel-cut stage render <name>` in the background. The render checks the plan first and names each problem, so fix those and run it again.

To put back something the cut left out, cut more, or change the order, edit `keep` in `cuts.json` and run `run` again with the same inputs and flags. Word numbers in the plan change, so the plan is redone too.

To have Claude plan from scratch instead, run `npx -y @jose.legaspi/reel-cut stage plan <name> --force`. That overwrites `visual_plan.json`.

`npx -y @jose.legaspi/reel-cut studio <name>` opens a live preview in the browser. Run it in the background.

## Common mistakes

- Using seconds in `visual_plan.json`. Segments are placed by word number.
- Props that don't match what was said. Numbers and labels on screen must match the speaker's words, e.g. `800000` for "eight hundred thousand".
- Applying a plan edit with `run --force` or `stage plan`. Both replace the edit; `stage render` is enough.
- Running a render in the foreground. It outlasts the default command timeout.
