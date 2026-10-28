# reel-cut

Turn a vertical talking-head video into an edited, Instagram-ready Reel.

reel-cut transcribes what you say, asks Claude to plan on-screen visuals that land on the right words, and renders the result with [Remotion](https://www.remotion.dev): animated stats, checklists, comparisons, logos and captions, drawn in a style you choose.

It comes as a command-line tool and as agent skills, so you can hand Claude Code a video and ask for the edit you want in plain English.

## Install

You need Node 22+, FFmpeg (`brew install ffmpeg` or `apt install ffmpeg`), and yt-dlp if you want to edit reels from a URL (`brew install yt-dlp` or `pip install yt-dlp`). You also need an [Anthropic API key](https://console.anthropic.com) and an [ElevenLabs API key](https://elevenlabs.io), set in your shell or in a `.env` file in the folder you work in:

```sh
ANTHROPIC_API_KEY=...
ELEVENLABS_API_KEY=...
```

### In Claude Code

As a plugin:

```
/plugin install reel-cut --marketplace JDLegaspi/reel-cut
```

Or as skills, which also work in Cursor, Codex and other agents:

```sh
npx skills add JDLegaspi/reel-cut
```

Then ask: *"Turn ~/Movies/take3.mov into a reel, and make the revenue bit a big animated stat."*

### On the command line

```sh
npx @jose.legaspi/reel-cut doctor
npx @jose.legaspi/reel-cut run ./my-video.mp4
```

`doctor` checks that FFmpeg, yt-dlp and your keys are set up.

## Usage

```sh
npx @jose.legaspi/reel-cut run <video file or reel URL> [options]
npx @jose.legaspi/reel-cut run intro.mov part2.mov outro.mov [options]
```

Give it several clips you recorded separately and it stitches them together in the order you list them, cleaning up each one. If a later clip says a line again, it keeps the better version and drops the other. A clip with no speech is kept whole.

The finished video lands in `reel-cut/projects/<name>/final.mp4` under the current folder. The project name defaults to the (first) file name, or `ig-<shortcode>` for Instagram URLs.

| Option | Does |
| --- | --- |
| `--style <name>` | Draws the visuals in a style made with `reel-cut style create` |
| `--isolate-voice` | Cleans up the voice with ElevenLabs voice isolation, removing background noise and room echo. Off by default because it is expensive; the agent skill only uses it when you ask |
| `--aggressive` | Also cuts natural fillers ("um", "like") inside good sentences |
| `--retake-word <word>` | A word you say to mark a redo (default `again`) |
| `--no-face` | Treats the input as a voiceover with no one on camera; the spoken words fill the screen between visuals |
| `--speaker-crop top-half\|bottom-half\|x,y,w,h` | Frames the part of the video that shows the speaker |
| `--force` | Reruns every stage |

Other commands:

```sh
npx @jose.legaspi/reel-cut templates                 # every visual template and the props it takes
npx @jose.legaspi/reel-cut stage render my-video     # rerun one stage
npx @jose.legaspi/reel-cut studio my-video           # preview the edit in Remotion Studio
```

## How it works

`reel-cut run` is a Make-style pipeline. Each stage writes files to the project folder and only reruns when its inputs change.

| Stage | Does |
| --- | --- |
| download | Fetches a reel URL with yt-dlp (skipped for local files) |
| ingest | Normalises each clip to 1080×1920 H.264 and stitches them together in order |
| clean | Extracts the voice track, through ElevenLabs voice isolation with `--isolate-voice` |
| transcribe | Word-level transcript with ElevenLabs Scribe |
| retakes | Claude keeps the best take of each line and drops false starts and stray fillers, into `cuts.json` |
| cut | Plays the kept words in order, shortens long pauses and evens out loudness, into `cut.mp4` |
| frames | Samples frames, so Claude can see the video and spell names correctly |
| plan | Claude picks templates and timings, checked against timing and content rules |
| render | Renders `final.mp4` with Remotion |

Every intermediate file is plain JSON. Edit `visual_plan.json` by hand, run `reel-cut stage render <name>`, and only the render reruns. Fix misheard names for captions and visuals in `spellings.json`. `cuts.json` lists what plays in `keep` (word ranges, in play order) and what was left out, with reasons, in `removed`. Change `keep` and run `reel-cut run` again with the same options to change the edit.

## Styles

A style is a small JSON file of colours, fonts and shapes. reel-cut can make one from references: websites, GitHub repos, reels, and image, video or HTML files.

```sh
npx @jose.legaspi/reel-cut style create acme --from https://acme.com ./logo.png
npx @jose.legaspi/reel-cut run ./my-video.mp4 --style acme
```

A style also sets the layout: you can sit in a rounded card under split visuals, and have one-word captions with key words highlighted. Each style comes with `sheet.png`, a preview of every template in it. After editing `style.json` by hand, redraw it with `reel-cut style sheet <name>`.

## Configuration

Put a `reel-cut.config.json` in the folder you work in to override any default from [`reelcut/reelcut.config.ts`](reelcut/reelcut.config.ts). The most useful is a list of names you say, so transcription spells them right:

```json
{
  "transcription": { "keyterms": ["Acme", "Jane Doe"] },
  "download": { "cookiesFromBrowser": "chrome" }
}
```

`cookiesFromBrowser` lets yt-dlp download reels that need an Instagram login. Set `ANTHROPIC_MODEL` to use a different Claude model.

## Development

```sh
git clone https://github.com/JDLegaspi/reel-cut.git
cd reel-cut
npm install
npm test
npm run typecheck
npm run reelcut -- run ./my-video.mp4
```

The design and its decisions are written up in [`reelcut/docs/design.md`](reelcut/docs/design.md).

## Licence

MIT. reel-cut renders with Remotion, which has its own [licence](https://www.remotion.dev/license): it is free for individuals and small companies, and larger companies need a Remotion company licence.

## Roadmap

- A desktop extension for the Claude app
