import type Anthropic from "@anthropic-ai/sdk";
import type { Word } from "@reel/shared/schemas/transcript.ts";
import { splitIntoLines } from "@reel/shared/transcribe/lines.ts";
import type { TimeSpan } from "../cut/segments.ts";
import type { RetakeOutput } from "./RetakeFinder.ts";

export function retakeSystemPrompt(opts: { retakeWord: string; aggressive: boolean }): string {
  const fillers = opts.aggressive
    ? `Also remove natural fillers inside good sentences ("um", "uh", "like", "you know", "basically") when the sentence reads cleanly without them (kind "filler").`
    : `Keep natural fillers inside good sentences; remove only fillers that stand alone between sentences or open a sentence before the speaker gets going (kind "filler").`;

  return `You edit the raw recording of someone talking to camera for an Instagram Reel. Whenever they stumbled, they started the line again. Your job is to pick which words to keep so that they play as one clean, confident take of their script.

You get the transcript with every word numbered. Lines break at sentence ends and pauses, and long pauses are marked. Long pauses are shortened automatically, so never remove words only because of a pause.

The recording may be several clips the speaker recorded separately and stitched together, each starting with a "--- clip N ---" line. Keep the clips in the order given: each is usually a different part of the video, and the speaker chose the order. Clean up each clip the same way as one long recording. Only when a later clip says again something an earlier clip already said, keep the better version where the earlier one was and leave the other out; never use two versions of the same part. A clip that is nothing but a failed attempt can be left out entirely.

Remove:
- Retakes: when a sentence or idea is said more than once, keep the best complete attempt (usually the last) and remove the earlier attempts (kind "retake"). Attempts can stop mid-word, run into the next attempt with no pause, or differ in wording; compare meaning, not exact words.
- The retake word: the speaker may say "${opts.retakeWord}" to mark a redo. When they use it that way, remove the word and the abandoned attempt before it (kind "retake-word"). Keep it when it is part of a sentence.
- False starts and stutters: repeated words, cut-off words and restarts inside a sentence ("I- I think", "the the") — keep one clean version (kind "false-start").
- Talking to themselves rather than to the viewer: "wait", "hold on", "let me say that again", "okay", counting in, or checking the camera (kind "other").
- ${fillers}

Never:
- Remove a sentence or idea that is said only once, or the only complete version of one.
- Leave a sentence cut in half: what remains must read as complete, grammatical sentences in the speaker's own words.
- Cut a sentence in two places when one range will do.

Read the words you keep, in order, before answering: they should flow as one natural script from start to finish.

Answer with keep: the ranges of words to play, in the order they should play. fromWord and toWord are word numbers and inclusive. Within a range the words play in their recorded order, so end a range wherever you leave words out. The ranges run in recorded order, except where a later clip's better version of a line takes the earlier version's place.

Also answer with removed: every range you left out, with its kind and one short reason. For a retake, say which word the kept version starts on.`;
}

function numberedLines(words: Word[]): string[] {
  const lines = splitIntoLines(words);
  return lines.flatMap((line, k) => {
    const text = `[${line[0]!.start.toFixed(1)}s] ${line.map((word) => `${word.i}:${word.text}`).join(" ")}`;
    const next = lines[k + 1]?.[0];
    const pause = next ? next.start - line.at(-1)!.end : 0;
    return pause >= 0.8 ? [text, `(pause ${pause.toFixed(1)}s)`] : [text];
  });
}

export function numberedTranscript(words: Word[], clips: TimeSpan[] = []): string {
  if (clips.length < 2) return numberedLines(words).join("\n");
  return clips
    .flatMap((clip, k) => {
      const inClip = words.filter((word) => word.start >= clip.start && (word.start < clip.end || k === clips.length - 1));
      return [`--- clip ${k + 1} ---`, ...numberedLines(inClip)];
    })
    .join("\n");
}

export function buildRetakeMessages(input: {
  words: Word[];
  clips: TimeSpan[];
  retry?: { previous: RetakeOutput; errors: string[] };
}): Anthropic.Beta.BetaMessageParam[] {
  const transcript = input.words.length > 0 ? numberedTranscript(input.words, input.clips) : "(no speech)";
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `<transcript>\n${transcript}\n</transcript>\n\nPick the words to keep, in the order they should play.` },
  ];
  if (input.retry) {
    messages.push(
      { role: "assistant", content: JSON.stringify(input.retry.previous) },
      {
        role: "user",
        content: `That answer has these problems:\n${input.retry.errors.map((error) => `- ${error}`).join("\n")}\n\nReturn the whole answer again with these fixed.`,
      },
    );
  }
  return messages;
}
