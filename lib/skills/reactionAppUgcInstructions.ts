export const REACTION_APP_UGC_SKILL_INSTRUCTIONS = `# Reaction-App UGC Shorts

Create a one-joke, reaction-first vertical video. Sell the feeling of relief, surprise, or avoidance-not the feature list.

## Workflow

1. Define one user truth: an annoying manual behavior, anxious moment, or small win that the app changes.
2. Write one caption that states the joke and includes the product name naturally.
3. Choose a reaction that can be understood with audio muted.
4. Generate or shoot one continuous, 7-15 second vertical take. Prefer a single subject and a single visual escalation.
5. Add the fixed caption, audio, and subtle motion treatment. Export and run the QA gate.

If the request includes reference media, analyze it before writing: sample frames at one-second intervals, note duration, framing, text, action, and the change at the ending. Do not copy a reference actor, voice, music track, or exact line.

## Format Contract

- Deliver 1080x1920 (9:16), H.264/AAC MP4; use 30 or 60 fps.
- Target 8-12 seconds. Use 15 seconds only when the gag needs setup and payoff.
- Keep exactly one protagonist in a waist-up or chest-up composition. Make the face and reaction easy to read on a phone.
- Use one familiar, slightly cinematic setting with depth: kitchen, couch, desk, cafe, elevator, or street. Keep it uncluttered.
- Use one continuous shot. Do not add explainer screens, app UI demos, logo end cards, or a conventional CTA unless the user explicitly requests them.
- Keep the caption visible for the whole clip. Center it in the upper safe region, clear of platform UI and the subject's eyes.
- Use white, bold rounded sans-serif type with a thin black outline/shadow. Use sentence-style lowercase unless a proper noun needs capitalization. Limit to 2-4 short lines.

Read references/style-system.md for the observed reference pattern, caption templates, and prompt recipe.

## Writing the Gag

Write the premise from the viewer's point of view. The app is the unexpected cause or escape hatch-not a feature claim.

Use this grammar:

\`\`\`text
me when [ordinary frustrating behavior] instead of [using product]
when you're just [normal action] but [product] [unexpectedly solves/reveals thing]
me acting like [I understand/control problem] so I just [use product] and let it handle it
\`\`\`

Good: \`me when i'm still logging calories manually instead of using calai.app\`

Avoid: \`CalAI makes calorie tracking easy. Download now.\`

Keep claims supportable. Do not imply diagnosis, guaranteed results, or capabilities the product does not have.

## Shot and Motion Direction

Start with the character already in the situation. Reserve the first 0.5 seconds for immediate recognition, then make the reaction evolve:

- Relief: tense posture -> quiet realization -> relaxed grin or exhale.
- Caught out: casual behavior -> looks off camera -> freezes or slowly backs away.
- Overconfident: performs certainty -> pauses -> gives a knowingly absurd look.
- Escalation: normal environment -> one controlled change (lights dim, phone buzzes, door opens, object enters frame) -> hold the expression for the final second.

Use restrained camera motion: locked-off, a slow push-in, or a small handheld drift. Avoid fast cuts, busy B-roll, lip-syncing to copy, exaggerated acting, and multiple competing gags.

## AI Video Prompt Recipe

Specify identity-neutral casting, physical behavior, lighting, lens/framing, and one timed event. Do not ask a video model to render the caption; add it during editing.

\`\`\`text
Vertical 9:16 social video, 10 seconds, a believable [adult/person] framed chest-up in a [specific lived-in setting], [wardrobe]. Natural cinematic light, shallow depth of field, locked camera with a subtle slow push-in. They begin [normal action], then at 4 seconds [single reaction/event], ending with [held readable expression]. Casual UGC realism, natural facial motion, no text, no logos, no interface, no cuts.
\`\`\`

Generate 2-4 variants. Select the one with the clearest face, stable anatomy, legible reaction, and simplest background; regenerate rather than trying to hide severe artifacts.

## Audio

Make the visual work on mute. Add one quiet, licensed or original audio layer only if it improves the joke: room tone, a small sting, an approved trend sound, or understated music. Never reuse audio from a reference video without rights.

## QA Gate

Before delivery, verify all of the following:

- First frame communicates the situation; the payoff is clear by the final two seconds.
- Caption is accurate, readable at phone size, stays on screen, and does not cover eyes or platform-safe areas.
- There is only one idea, one subject, one shot, and one dominant reaction.
- No accidental captions, watermark, malformed hands/face, flicker, or brand-confusing imagery remain.
- Product mention feels like part of the meme, not a pitch; any claim is true.
- Video is 9:16, 7-15 seconds, and audio is optional rather than required for comprehension.`;
