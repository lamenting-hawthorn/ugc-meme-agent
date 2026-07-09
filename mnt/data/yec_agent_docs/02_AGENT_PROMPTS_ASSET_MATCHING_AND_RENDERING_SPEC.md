# YEC Founding Engineer Task — Agent Prompts, Asset Matching, and Rendering Spec

## Purpose of this document

This file gives the AI coding agent detailed instructions for the intelligence layer: prompts, structured outputs, asset scoring, GIPHY usage, and rendering behavior.

The most difficult part of this project is matching:

- the product pain point;
- the meme caption;
- the reaction GIF/video;
- the audio mood;
- the background;
- the layout.

The system should solve this with structured planning and deterministic infrastructure, not with random LLM choices.

---

# 1. Core principle

The LLM should produce structured JSON.

The LLM should not directly render video.

The LLM should not directly choose final asset files unless it is choosing from a provided candidate list.

Correct split:

```text
LLM = product understanding + creative plan
GIPHY/API = candidate source
Asset matcher = scoring + validation
Renderer = deterministic composition
Quality checker = validation
```

---

# 2. Product understanding prompt

Use this prompt after extracting website metadata and visible text.

## System prompt

```text
You are a product and meme-ad strategist for short-form UGC videos.
Your job is to understand a startup/product from a user message and website metadata.
Return only valid JSON.
Do not write generic marketing copy.
Focus on the user's painful old workflow and the emotional contrast created by the product.
```

## User prompt template

```text
User message:
{{USER_MESSAGE}}

Product URL:
{{PRODUCT_URL}}

Website title:
{{TITLE}}

Website description:
{{DESCRIPTION}}

Extracted website text:
{{PAGE_TEXT}}

Return a JSON object with:
- productName
- productUrl
- category
- oneLineSummary
- targetUser
- userPain
- oldWorkflow
- productBenefit
- emotionalBeforeState
- emotionalAfterState
- memeAngles

Rules:
- Be specific.
- Do not invent unsupported features.
- If website content is limited, infer cautiously from the user message.
- emotionalBeforeState must be one of: confused, stressed, annoyed, bored, overwhelmed, embarrassed.
- emotionalAfterState must be one of: relieved, confident, smug, happy, calm.
```

## Expected output example

```json
{
  "productName": "calai.app",
  "productUrl": "https://calai.app",
  "category": "calorie tracking / fitness",
  "oneLineSummary": "CalAI helps users track calories and macros with less manual effort.",
  "targetUser": "people who want to track food, calories, and macros without doing manual calculations",
  "userPain": "manual calorie and macro logging is tedious and confusing",
  "oldWorkflow": "guessing calories, searching foods, and manually logging every item",
  "productBenefit": "handles calorie and macro tracking more automatically",
  "emotionalBeforeState": "confused",
  "emotionalAfterState": "relieved",
  "memeAngles": [
    "pretending to understand macros",
    "still logging calories manually",
    "food math feels like tax season"
  ]
}
```

---

# 3. Creative planning prompt

Use this after product understanding.

## System prompt

```text
You are a creative director for TikTok/Reels meme ads.
You create short UGC-style meme video plans.
The final video has one static background, one reaction GIF/video, one meme caption, and one music track.
Return only valid JSON.
The caption must feel native to social media and should not sound like corporate marketing.
```

## User prompt template

```text
Product understanding:
{{PRODUCT_UNDERSTANDING_JSON}}

Available meme formats:
- me-when
- pov
- before-after
- pretending-to-know
- manual-vs-automated
- realization

Available reaction moods:
- confused
- panic
- shocked
- relief
- smug
- crying
- celebrating

Available audio moods:
- funny
- dramatic
- chill
- chaotic
- victory

Available background categories:
- room
- office
- sky
- phone
- gradient
- lifestyle

Create one strong creative plan.
Return JSON with:
- caption
- memeFormat
- humorStyle
- reactionMood
- audioMood
- backgroundCategory
- backgroundMood
- durationSec
- template
- giphyQueries

Rules:
- Caption should be lowercase except brand/product names.
- Caption should be short enough for 2 to 4 lines.
- Caption should include the product name/domain naturally.
- Avoid generic ad words.
- Use a meme-native structure.
- template must be top-caption-bottom-reaction.
- durationSec should be between 7 and 9.
- giphyQueries should be reaction-oriented, not product-oriented.
```

## Expected output example

```json
{
  "caption": "me pretending i know my macros so i just open calai.app and let it handle it",
  "memeFormat": "pretending-to-know",
  "humorStyle": "relatable",
  "reactionMood": "confused",
  "audioMood": "funny",
  "backgroundCategory": "room",
  "backgroundMood": "clean",
  "durationSec": 8,
  "template": "top-caption-bottom-reaction",
  "giphyQueries": [
    "confused reaction",
    "pretending to understand reaction",
    "math confusion sticker",
    "panic calculating",
    "confused sticker transparent"
  ]
}
```

---

# 4. Caption style guide

The caption is the most important creative element.

## Good caption patterns

```text
me when i’m still doing {{oldWorkflow}} manually instead of using {{product}}
```

```text
me pretending i understand {{problem}} so i just open {{product}} and let it handle it
```

```text
pov: you’re still doing {{painfulTask}} like it’s 2016
```

```text
me after realizing {{product}} does {{benefit}} before i panic
```

```text
how i act after automating {{annoyingWorkflow}} with {{product}}
```

## Good CalAI examples

```text
me pretending i know my macros so i just open calai.app and let it handle it
```

```text
me when i’m still logging calories manually instead of using calai.app
```

```text
pov: you’re still calculating dinner macros like it’s a tax return
```

```text
me after calai.app does the food math before i start guessing
```

## Bad captions

```text
calai is an innovative ai-powered calorie tracking solution
```

```text
unlock your nutrition journey with seamless calorie intelligence
```

```text
the future of macro tracking is here
```

Bad captions sound like ads. Good captions sound like someone posted them.

---

# 5. GIPHY usage spec

GIPHY should be used as an external reaction asset supplier.

Do not treat GIPHY as the whole asset library.

The app’s own asset intelligence layer decides which GIPHY result fits.

## Query generation

Do not search product keywords first.

Bad GIPHY queries:

```text
calorie tracking app
fitness app startup
macro calculator
```

Good GIPHY queries:

```text
confused reaction
pretending to understand
panic calculating
math confusion sticker
side eye reaction
relieved reaction
shocked sticker transparent
```

## Candidate fetching

Fetch candidates from multiple queries.

Suggested limit:

- 5–10 results per query;
- 5–8 queries per creative plan;
- deduplicate by GIPHY ID.

Prefer results that provide MP4 renditions.

Prefer sticker/transparent-style results where possible.

## Content safety

Filter out candidates with unsafe ratings if provided.

Allowed ratings for demo:

- g;
- pg;
- pg-13 if visually safe.

Avoid:

- explicit sexual content;
- hate symbols;
- violent gore;
- offensive political content;
- visually unreadable clips.

---

# 6. Candidate ranking prompt

Optional: use the LLM to rank GIPHY candidates after deterministic filters.

Only use this after candidates are fetched and basic validation passes.

## System prompt

```text
You rank reaction GIFs for meme-ad fit.
You are given a caption, target emotion, audio mood, and candidate GIF titles/queries.
Rank candidates by how well they fit the caption and meme emotion.
Return only valid JSON.
```

## User prompt template

```text
Caption:
{{CAPTION}}

Product category:
{{CATEGORY}}

Target reaction mood:
{{REACTION_MOOD}}

Audio mood:
{{AUDIO_MOOD}}

Candidates:
{{CANDIDATE_LIST}}

Return JSON:
{
  "ranked": [
    { "id": "...", "score": 0.0-1.0, "reason": "short reason" }
  ]
}

Rules:
- Prefer reaction clips that express the target emotion.
- Prefer meme-native reactions.
- Avoid candidates that are too literal or product-like.
- Keep reasons short.
```

The deterministic scorer should still have the final say.

---

# 7. Deterministic asset scoring

Use deterministic scoring for reliability.

## Overall scoring

```ts
const totalScore =
  moodMatch * 0.35 +
  energyMatch * 0.20 +
  semanticMatch * 0.20 +
  layoutCompatibility * 0.15 +
  trendOrSourceBoost * 0.10;
```

## Mood matching

```ts
function scoreMood(target: string, candidate: string): number {
  if (target === candidate) return 1.0;

  const related: Record<string, string[]> = {
    confused: ["panic", "shocked"],
    panic: ["confused", "crying", "shocked"],
    shocked: ["confused", "panic"],
    relief: ["smug", "celebrating"],
    smug: ["relief", "celebrating"],
    crying: ["panic", "confused"],
    celebrating: ["relief", "smug"]
  };

  return related[target]?.includes(candidate) ? 0.6 : 0.15;
}
```

## Energy matching

```ts
function scoreEnergy(target: string, candidate: string): number {
  if (target === candidate) return 1.0;
  if (
    (target === "medium" && candidate !== "medium") ||
    (candidate === "medium" && target !== "medium")
  ) return 0.65;
  return 0.25;
}
```

## Layout compatibility

For GIPHY/reaction candidates:

- portrait or square is better than very wide;
- transparent/sticker-like is better;
- MP4/WebM is better than raw GIF;
- minimum width/height should be usable;
- avoid tiny or blurry candidates.

```ts
function scoreLayout(candidate: GiphyCandidate): number {
  let score = 0.5;

  if (candidate.mp4Url) score += 0.2;
  if (candidate.isStickerLike) score += 0.2;

  const ratio = candidate.width / candidate.height;
  if (ratio > 0.6 && ratio < 1.6) score += 0.1;
  if (candidate.width < 180 || candidate.height < 180) score -= 0.3;

  return Math.max(0, Math.min(1, score));
}
```

---

# 8. Audio matching

For the assessment, use a small curated local audio library.

Do not depend on live TikTok audio APIs.

Each audio file should have metadata:

```ts
type AudioAsset = {
  id: string;
  filePath: string;
  mood: "funny" | "dramatic" | "chill" | "chaotic" | "victory";
  energy: "low" | "medium" | "high";
  durationSec: number;
  hasBeatDrop: boolean;
  beatDropAtSec?: number;
  tags: string[];
};
```

## Mood mapping

```ts
const audioMoodMap = {
  confused: ["funny", "dramatic"],
  panic: ["chaotic", "dramatic"],
  shocked: ["dramatic", "funny"],
  relief: ["victory", "chill", "funny"],
  smug: ["victory", "funny"],
  crying: ["dramatic", "funny"],
  celebrating: ["victory", "chaotic"]
};
```

## Timing

For MVP:

- audio starts at 0.0 seconds;
- reaction starts at 0.2 seconds;
- caption is visible throughout;
- duration is 7–9 seconds.

Optional improvement:

- if audio has `beatDropAtSec`, start or scale the reaction at the beat drop.

---

# 9. Background matching

For the assessment, backgrounds can be simple.

Good options:

- modern room;
- office;
- sky gradient;
- phone mockup;
- abstract gradient;
- lifestyle interior.

Background must not distract from caption and reaction.

Metadata:

```ts
type BackgroundAsset = {
  id: string;
  filePath: string;
  type: "image" | "video";
  category: "room" | "office" | "sky" | "phone" | "gradient" | "lifestyle";
  mood: "clean" | "premium" | "neutral" | "dramatic" | "funny";
  busyTopArea: boolean;
  busyCenterArea: boolean;
  safeTextZone: "top" | "middle" | "bottom";
  tags: string[];
};
```

Rules:

- prefer backgrounds with safe top area;
- avoid busy top area because caption is placed there;
- if no category match, use clean/neutral background;
- product category does not need perfect background match.

The background is atmosphere, not the story.

---

# 10. Render behavior

The final video should be one scene.

Layer order:

```text
1. background image/video
2. reaction GIF/video
3. caption text
4. audio/music
```

The examples have caption above the reaction. Keep caption on top visually.

## Default render settings

```ts
const renderDefaults = {
  width: 512,
  height: 910,
  fps: 30,
  durationSec: 8,
};
```

## Text styling

```ts
const captionStyle = {
  fontFamily: "Inter, Arial, Helvetica, sans-serif",
  fontWeight: 800,
  color: "white",
  WebkitTextStroke: "4px black",
  textAlign: "center",
  lineHeight: 1.1,
  fontSize: 28,
  maxWidth: 430,
};
```

## Text line breaking

Use deterministic line breaking.

Rules:

- 2–4 lines preferred;
- max 26–32 characters per line depending on font size;
- do not break product domain awkwardly;
- reduce font size if caption is too long;
- reject or regenerate caption if too long.

---

# 11. Regeneration behavior

After a video is generated, support follow-up requests.

## User says “make it funnier”

Reuse product understanding.

Generate new creative plan with:

```json
{
  "humorStyle": "absurd",
  "audioMood": "funny",
  "reactionMood": "panic"
}
```

## User says “make it dramatic”

Use:

```json
{
  "humorStyle": "dramatic",
  "audioMood": "dramatic",
  "reactionMood": "shocked"
}
```

## User says “try another GIF”

Keep caption and audio.

Fetch/rank new GIPHY candidates or use next-best candidate.

## User says “less cringe”

Use:

- more understated caption;
- less Gen Z slang;
- cleaner background;
- lower-energy reaction;
- chill/funny audio.

---

# 12. Error handling

The demo should not break.

## Product page fails

Reply:

```text
I couldn't read the site directly, but I can still make the video from your message. Give me one line about what the product does, or I can use what you already wrote.
```

If message has enough info, continue.

## GIPHY fails

Use local fallback reaction.

Do not show a scary error to the user.

Internal log:

```text
GIPHY fetch failed. Using fallback reaction: confused-1.webm
```

## Render fails

Retry once with:

- local fallback reaction;
- local fallback background;
- shorter caption;
- known-good audio.

If still failing, show:

```text
I had trouble rendering that version. I saved the creative plan and can try again with a simpler template.
```

---

# 13. Example full generation flow

User:

```text
I'm building CalAI, a calorie-tracking app. Here's the site: calai.app
```

Product understanding:

```json
{
  "productName": "calai.app",
  "category": "fitness / calorie tracking",
  "userPain": "manual calorie and macro logging is annoying and confusing",
  "oldWorkflow": "guessing calories and manually entering food items",
  "productBenefit": "handles calorie and macro tracking more automatically",
  "emotionalBeforeState": "confused",
  "emotionalAfterState": "relieved"
}
```

Creative plan:

```json
{
  "caption": "me pretending i know my macros so i just open calai.app and let it handle it",
  "memeFormat": "pretending-to-know",
  "humorStyle": "relatable",
  "reactionMood": "confused",
  "audioMood": "funny",
  "backgroundCategory": "room",
  "backgroundMood": "clean",
  "durationSec": 8,
  "template": "top-caption-bottom-reaction",
  "giphyQueries": [
    "confused reaction",
    "pretending to understand reaction",
    "math confusion sticker",
    "panic calculating",
    "confused sticker transparent"
  ]
}
```

Asset match:

```json
{
  "background": "room-clean-01.jpg",
  "reaction": "giphy:confused-reaction-selected.mp4",
  "audio": "funny-medium-01.mp3"
}
```

Render output:

```json
{
  "videoUrl": "/generated/calai-8s-confused-funny.mp4",
  "caption": "me pretending i know my macros so i just open calai.app and let it handle it"
}
```

Chat reply:

```text
Done — made a meme-style UGC video for CalAI.
```

Then show video preview.

---

# 14. README architecture paragraph

Use this in the final README:

```text
This project separates creative reasoning from deterministic rendering. The LLM reads the product URL and creates a structured creative plan containing the meme caption, target emotion, GIF search queries, audio mood, and layout template. GIPHY is used as a dynamic reaction-asset supplier, while the app maintains its own asset intelligence layer for mood tagging, candidate ranking, layout compatibility, and fallback rendering. The final video is composed with a fixed vertical meme template, which keeps the output reliable while still allowing creative variation.
```

---

# 15. Final instruction to coding agent

Build the smallest version that works end to end first.

The first milestone is:

```text
Chat message with product URL
→ product understanding JSON
→ creative plan JSON
→ local assets selected
→ vertical MP4 rendered
→ video shown in chat
```

After that:

```text
Add GIPHY candidates
→ add scoring
→ add regeneration
→ polish UI
→ deploy
```

Do not start with complex infra before the first render works.

The assessment will reward a working, funny, polished product more than a large unfinished architecture.

