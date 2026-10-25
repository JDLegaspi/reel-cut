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
npx reel-cut doctor
npx reel-cut run ./my-video.mp4
```

`doctor` checks that FFmpeg, yt-dlp and your keys are set up.

## Usage

```sh
npx reel-cut run <video file or reel URL> [options]
```

The finished video lands in `reel-cut/projects/<name>/final.mp4` under the current folder. The project name defaults to the file name, or `ig-<shortcode>` for Instagram URLs.

| Option | Does |
| --- | --- |
| `--style <name>` | Draws the visuals in a style made with `reel-cut style create` |
| `--no-face` | Treats the input as a voiceover with no one on camera; the spoken words fill the screen between visuals |
| `--speaker-crop top-half\|bottom-half\|x,y,w,h` | Frames the part of the video that shows the speaker |
| `--force` | Reruns every stage |

Other commands:

```sh
npx reel-cut templates                 # every visual template and the props it takes
npx reel-cut stage render my-video     # rerun one stage
npx reel-cut studio my-video           # preview the edit in Remotion Studio
```

## How it works

`reel-cut run` is a Make-style pipeline. Each stage writes files to the project folder and only reruns when its inputs change.

| Stage | Does |
| --- | --- |
| download | Fetches a reel URL with yt-dlp (skipped for local files) |
| ingest | Normalises the video to 1080×1920 H.264 and extracts the audio |
| transcribe | Word-level transcript with ElevenLabs Scribe |
| frames | Samples frames, so Claude can see the video and spell names correctly |
| plan | Claude picks templates and timings, checked against timing and content rules |
| render | Renders `final.mp4` with Remotion |

Every intermediate file is plain JSON. Edit `visual_plan.json` by hand, run `reel-cut stage render <name>`, and only the render reruns.

## Styles

A style is a small JSON file of colours, fonts and shapes. reel-cut can make one from references: websites, GitHub repos, reels, and image, video or HTML files.

```sh
npx reel-cut style create acme --from https://acme.com ./logo.png
npx reel-cut run ./my-video.mp4 --style acme
```

Each style comes with `sheet.png`, a preview of every template in it. After editing `style.json` by hand, redraw it with `reel-cut style sheet <name>`.

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

- Retake and filler removal
- A desktop extension for the Claude app
