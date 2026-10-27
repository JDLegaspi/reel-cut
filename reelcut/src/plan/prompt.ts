import type Anthropic from "@anthropic-ai/sdk";
import { frameBlocks } from "@reel/shared/claude.ts";
import type { FrameImage } from "@reel/shared/frames/frames.ts";
import type { Transcript, Word } from "@reel/shared/schemas/transcript.ts";
import { splitIntoLines } from "@reel/shared/transcribe/lines.ts";
import type { Brand } from "../schemas/brands.ts";
import type { PlannerOutput } from "../schemas/visualPlan.ts";
import { templateCatalog } from "./catalog.ts";
import type { VisualRules } from "./rules.ts";
import { toClaudePlan } from "./schema.ts";

const VOICE_ONLY_WORDING: [string, string][] = [
  [
    "You edit a vertical talking-head video (an Instagram Reel) into a fast, visual explainer. You plan where the edit cuts away from the speaker to animated visuals that illustrate what they are saying.",
    "You edit a vertical voiceover video (an Instagram Reel) into a fast, visual explainer. There is no one on camera. You plan where the edit cuts away from the spoken words to animated visuals that illustrate what the voice is saying.",
  ],
  [
    "- The speaker alone, full screen. This is any time not covered by a segment. Punch it up with emphasis: one to three of the speaker's own words shown huge on screen as they say them.",
    "- The spoken words alone: the words being spoken, shown large on the backdrop, a phrase at a time. This is any time not covered by a segment. Use emphasis to pick the one to three words in a phrase that matter most; they are drawn in the accent colour.",
  ],
  ["while the speaker carries on in the bottom half", "while the spoken words carry on in the bottom half"],
  ["while the speaker's voice carries on", "while the voice carries on"],
  ["what the speaker is talking about", "what the voice is talking about"],
  ["never the speaker's sentence", "never the spoken sentence"],
  ["short stretches of the speaker", "short stretches of the spoken words"],
  ["on the speaker, with emphasis", "on the spoken words, with emphasis"],
  ["Show only what the speaker says.", "Show only what the voice says."],
  ["if the speaker doesn't say it", "if the voice doesn't say it"],
  [
    "atWord must fall on a speaker shot, outside every segment. Pick stressed or important words, at most one per speaker stretch.",
    "atWord must fall on the spoken words, outside every segment. Pick stressed or important words, at most one per stretch of spoken words.",
  ],
  ["keep the speaker on screen for at least", "leave the spoken words on screen for at least"],
  ["A shorter glimpse of the speaker looks like a mistake.", "A shorter gap looks like a mistake."],
];

function voiceOnly(prompt: string): string {
  return VOICE_ONLY_WORDING.reduce((text, [from, to]) => {
    if (!text.includes(from)) throw new Error(`voice-only wording is out of date: "${from}" is not in the prompt`);
    return text.replaceAll(from, to);
  }, prompt);
}

export function planSystemPrompt(rules: VisualRules, face = true): string {
  const prompt = talkingHeadPrompt(rules);
  return face ? prompt : voiceOnly(prompt);
}

function talkingHeadPrompt(rules: VisualRules): string {
  const catalog = templateCatalog();
  return `You edit a vertical talking-head video (an Instagram Reel) into a fast, visual explainer. You plan where the edit cuts away from the speaker to animated visuals that illustrate what they are saying.

You get the video's duration, a transcript in which every word is numbered, and frames sampled from the video with their times.

The edit is made of three kinds of shot:
- The speaker alone, full screen. This is any time not covered by a segment. Punch it up with emphasis: one to three of the speaker's own words shown huge on screen as they say them.
- split: an animated visual fills the top half of the screen while the speaker carries on in the bottom half. This is the workhorse; use it for most visuals.
- full: an animated visual fills the whole screen while the speaker's voice carries on, for the moments that hit hardest: a big number, a punchline, a reveal.

A segment covers the words from startWord to endWord, inclusive, with one layout and one template. Its visual appears just before startWord is spoken and stays until the word after endWord begins, or until the video ends if endWord is the last word.

What makes a good edit:
- Illustrate, don't caption. Each visual shows what the speaker is talking about as a picture: an app as a phone screen, money as a counter, growth as a curve, a choice as two sides, a process as connected steps, platforms as their logos, a company as its website, an idea as a big icon. Words on a visual are short labels, never the speaker's sentence.
- Be literal. When the speaker describes several things of a kind (projects, worktrees, teams, apps, clients), show that many, grouped the way they describe them (Groups for things that each hold several more), instead of one icon or an arrow between two icons.
- Vary the visuals. No template may be used for more than a quarter of the visuals; the plan is sent back if one is. Concept (one big icon) is the fallback, not the default, and Flow is only for steps the speaker walks through in order.
- Full visuals carry the biggest moments, so make each a concrete picture of the specific thing described: the phone showing the ad, the website, the product, the number. Never a generic chart or word for an adjective like successful, fast or very good; use Growth only when the speaker describes a change over time.
- Companies. When the speaker introduces a company that has a website in the brands list, show the website with Website; for a company's or platform's logo, use Logos.
- Keep it moving. Change shot every two to four seconds; segments can run back to back with different templates. Most of the video should be visuals, mostly split with some full, cut between short stretches of the speaker. Keep the opening hook and the closing call to action on the speaker, with emphasis.
- Show only what the speaker says. Every name, number and claim on a visual must come from the words in or right around its segment. Icons and drawings may illustrate an idea but must not add facts. Transcripts often mishear the names of people, products and titles, and the video's own on-screen text (captions, overlays) often spells them correctly: when the two disagree, use the on-screen spelling. Use the frames only for spelling. Never put something on a visual because it appears on screen if the speaker doesn't say it.
- Time each element to the word that introduces it.

Templates. Each segment names one of these and gives its props as a JSON object, written as text, that matches the template's props schema. Icon props take lucide icon names in kebab-case, such as chef-hat, dollar-sign, trending-up, smartphone, bookmark, lock, target, users, rocket, sparkles, video, heart.
${catalog}
A number on a visual, including inside its labels, must be said in its segment ("forty" counts as 40); a visual that shows any other number is rejected.

Reveals. All of a template's elements appear when its segment starts, except those you list in reveals: each reveal names an element's key and the number of the word it appears on. Reveal words must be inside the segment and in spoken order. Reveal an element on the word that introduces it, so the visual builds in step with the speech.

Emphasis. Each emphasis is { atWord, text }: text is the word or words spoken from atWord on (one to three words, as in the transcript, any capitalisation, with a misheard name in its on-screen spelling), and atWord must fall on a speaker shot, outside every segment. Pick stressed or important words, at most one per speaker stretch.

Timing rules. The plan is checked against these and sent back if it breaks them:
- Segments are in spoken order and don't overlap.
- Each segment is on screen for at least ${rules.minSegmentSeconds}s.
- Between two segments, either put them back to back (the next startWord is the previous endWord + 1) or keep the speaker on screen for at least ${rules.minFaceSeconds}s. A shorter glimpse of the speaker looks like a mistake.

rationale: one sentence on why this moment needs this visual.`;
}

export function indexedTranscript(words: Word[]): string[] {
  return splitIntoLines(words).map(
    (line) => `[${line[0]!.start.toFixed(1)}s] ${line.map((word) => `${word.i}:${word.text}`).join(" ")}`,
  );
}

function brandList(brands: Brand[]): string {
  const listed = brands
    .filter((brand) => brand.site || brand.logo)
    .map((brand) => `${brand.name} (${[brand.site && "website", brand.logo && "logo"].filter(Boolean).join(", ")})`);
  return `Brands list, companies you can show beyond the built-in logos: ${listed.join(", ") || "none"}`;
}

export function buildPlanMessages(input: {
  transcript: Transcript;
  frames: FrameImage[];
  brands?: Brand[];
  retry?: { previous: PlannerOutput; errors: string[] };
}): Anthropic.Beta.BetaMessageParam[] {
  const { transcript, frames, retry } = input;
  const lines = indexedTranscript(transcript.words);
  const header = [
    `Duration: ${transcript.duration.toFixed(1)}s`,
    brandList(input.brands ?? []),
    "",
    "<transcript>",
    lines.length > 0 ? lines.join("\n") : "(no speech)",
    "</transcript>",
    "",
    `${frames.length} frames follow, each labelled with its time in seconds.`,
  ].join("\n");

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: header },
        ...frameBlocks(frames),
        { type: "text", text: "Plan the visuals for this video." },
      ],
    },
  ];
  if (retry) {
    messages.push(
      { role: "assistant", content: JSON.stringify(toClaudePlan(retry.previous)) },
      {
        role: "user",
        content: `That plan breaks these rules:\n${retry.errors.map((error) => `- ${error}`).join("\n")}\n\nReturn the whole plan again with these fixed.`,
      },
    );
  }
  return messages;
}
