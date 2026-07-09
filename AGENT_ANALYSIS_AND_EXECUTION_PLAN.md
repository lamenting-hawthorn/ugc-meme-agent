# AGENT_ANALYSIS_AND_EXECUTION_PLAN

## 1. Assessment Understanding

This assessment is testing whether the engineer can turn an ambiguous AI-product brief into a small, polished, working product with good taste and maintainable architecture.

The company is not asking for a generic AI video generator. The real requirement is a chat-first creative assembly system:

- A clean conversational UX that behaves naturally for greetings, questions, product submissions, and follow-up edits.
- Product understanding from a user message and optionally a product URL.
- Meme-native creative judgment: captions should sound like short-form social content, not SaaS ad copy.
- Asset selection across background, reaction GIF/video, and audio.
- Deterministic video rendering into a vertical MP4.
- End-to-end polish: progress states, fallback paths, preview in chat, README quality, and a demo that keeps working when external APIs fail.

The core distinction:

- AI-generated video means the model directly synthesizes visual motion or scenes. That is slower, less deterministic, expensive, and outside the examples.
- AI-organized / AI-assembled UGC video means the LLM creates a structured creative brief, while code retrieves assets, scores them, builds a render plan, and composes the final video. This is the right product for the assessment because it is faster, more reliable, easier to debug, and closer to the provided examples.

The product should feel like:

> ChatGPT for automatically making meme-style startup ads.

It should not feel like:

> A half-built video editor or cinematic AI generation platform.

The company is really testing founder-level product engineering judgment:

- Can the engineer identify the smallest useful product, not just the largest possible AI system?
- Can they separate creative reasoning from deterministic execution?
- Can they make the result feel socially native instead of technically impressive but culturally off?
- Can they build a demo that still works when scraping, GIPHY, or rendering has a bad day?
- Can they explain the architecture clearly enough that another engineer could maintain it?

## 2. Product Bar

Good means the app reliably turns a startup/product URL into a short, funny, relevant vertical meme ad and returns it inside chat.

The evaluator will likely care about:

- Whether the app works end to end.
- Whether the video is actually relevant to the product.
- Whether the caption feels social-native instead of generic.
- Whether the chat flow is clear and polished.
- Whether the architecture separates LLM reasoning from deterministic rendering.
- Whether failures are handled gracefully.
- Whether the README explains tradeoffs and setup clearly.

Impressive:

- The app shows believable progress states while generating.
- The caption names a real user pain, not a generic benefit.
- GIPHY is used as a candidate source, not as random final selection.
- There are local fallback assets, so the demo survives GIPHY or network failure.
- The renderer produces a real MP4 with caption, background, reaction overlay, and audio.
- Regeneration works with commands like "make it funnier", "less cringe", or "try another GIF".

Overbuilt:

- Multi-scene cinematic storyboards.
- Avatar generation, lip sync, or voiceover.
- A timeline editor.
- Product demo screen recording.
- Complex account systems before the first render works.
- A full production media licensing pipeline in the MVP.

Underbuilt:

- Only returning a caption or mock video.
- Random GIF search without scoring.
- No audio.
- No local fallbacks.
- Chat that only works for one hardcoded prompt.
- A fragile renderer with no validation.
- Captions that sound like "revolutionize your workflow".

A real-product demo should feel fast, deterministic, and coherent. The user should paste a URL, see the system think through the job, and receive a playable video without needing to understand implementation details.

Minimum demo proof should include 3-5 tested product examples, at least one fallback path exercised, and a README that explains the LLM/code split. The evaluator should not have to infer whether the core path works.

## 3. Core User Flow

1. User lands on app.
   - Show a chat interface, not a marketing landing page.
   - Assistant prompt: "Send me your product URL and I'll turn it into a short UGC-style meme ad."

2. User chats naturally.
   - Greeting -> friendly short response.
   - Capability question -> explain product briefly.
   - No URL -> ask for product URL or one-line product description.

3. User gives product URL/message.
   - Extract first URL.
   - Normalize missing scheme to `https://`.
   - Preserve user-provided product description as context.

4. System understands product.
   - Fetch product page with timeout.
   - Extract title, meta description, Open Graph fields, visible text, and obvious hero copy.
   - Fall back to user message if scraping fails.
   - Generate structured `ProductUnderstanding`.

5. System generates meme/video plan.
   - LLM returns structured `CreativePlan`.
   - Validate enum values, duration, caption length, and required fields.
   - If invalid, repair or regenerate once.

6. System selects background/GIF/audio.
   - Fetch GIPHY candidates from reaction-oriented queries.
   - Filter unsafe or unusable assets.
   - Score GIPHY candidates plus local fallbacks.
   - Select audio and background from local manifest.

7. System renders video.
   - Build deterministic `RenderPlan`.
   - Render vertical MP4.
   - Validate output exists, duration is sane, aspect ratio is vertical, and audio exists.

8. System returns video in chat.
   - Show generated caption.
   - Show video preview.
   - Provide video URL/download link.

9. User can regenerate/change vibe.
   - "make it funnier" -> reuse product understanding, change humor/audio/reaction targets.
   - "make it dramatic" -> dramatic audio, shocked reaction.
   - "try another GIF" -> keep caption/audio and select next reaction.
   - "less cringe" -> lower-energy caption and reaction, cleaner background.

Loading/progress states:

- Reading product page...
- Understanding the product...
- Finding the pain point...
- Writing meme caption...
- Searching reaction clips...
- Matching audio and background...
- Rendering video...
- Checking output...
- Done.

Failure states:

- Product page unavailable, continuing from message.
- GIPHY unavailable, using fallback reaction.
- Render failed once, retrying simpler template.
- Render failed after retry, return creative plan and ask to retry.

## 4. System Architecture

Recommended architecture: a Next.js TypeScript app with API routes/server actions for orchestration, Remotion for composition, local JSON manifests for assets, and local output storage for MVP.

Frontend:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Chat UI with message list, composer, progress events, video preview, and regenerate controls.
- Keep first screen as the usable app.

Backend/API routes:

- `POST /api/chat`: routes messages, handles small talk/capability questions, calls generation when needed, preserves session context.
- `POST /api/generate-video`: full generation pipeline. This can be called internally by chat.
- `GET /api/jobs/:id`: optional if rendering is async.

LLM planning layer:

- `productAnalyzer.ts`: turns message + scraped metadata into structured product understanding.
- `creativePlanner.ts`: turns product understanding into structured creative plan.
- JSON schema validation should sit between LLM output and code.

Product URL parser:

- Extract first URL from free text.
- Support `https://example.com`, `http://example.com`, `www.example.com`, and `example.com`.
- Normalize to HTTPS unless explicitly HTTP.
- Use a timeout and size limit when fetching.

GIPHY integration:

- Use GIPHY only as an external supplier of reaction candidates.
- Search reaction-oriented queries from the creative plan.
- Prefer MP4/WebM renditions over raw GIF.
- Deduplicate by GIPHY ID.
- Filter by rating and minimum dimensions.

Audio asset handling:

- Use a small local curated library for MVP.
- Avoid live TikTok/trending audio APIs.
- Tag each track by mood, energy, duration, and beat drop.
- In README, note licensing requirements for production.

Background asset handling:

- Use local background images or short loops.
- Tag each by category, mood, and safe text zones.
- Prefer clean top area because the caption is top-centered.

Asset metadata layer:

- `assets/manifest.json` stores reaction fallbacks, audio tracks, backgrounds, and template metadata.
- Load through typed helpers instead of reading ad hoc JSON everywhere.

Asset matcher/scorer:

- Combines creative plan, candidate metadata, and layout constraints.
- Scores mood, energy, semantic fit, layout compatibility, and freshness/source boost.
- Returns selected assets with reasons for debugging.

Video renderer:

- Build a deterministic render plan.
- Render one vertical scene.
- Validate after render.

Storage/output URL:

- MVP: write MP4 to `public/generated`.
- Deployed version: S3/R2/Supabase Storage with signed or public URLs.

Job/status handling:

- MVP can stream/poll progress in memory if the app runs on a long-lived Node process.
- If deployed to serverless, move render work to a background job or separate worker.
- Store job state in SQLite or a JSON store for assessment simplicity.

Fallback paths:

- Scrape failure -> use user message.
- LLM failure -> show helpful retry error, optionally use deterministic sample plan for known demo mode.
- GIPHY failure -> local reaction fallback.
- Asset mismatch -> nearest mood fallback.
- Render failure -> retry with known-good local assets and shorter caption.

Error handling:

- User-facing errors should be calm and actionable.
- Internal logs should include job ID, stage, fallback used, and sanitized error.
- Do not log API keys or raw secrets.

## 5. Asset Intelligence Layer

This is the product's differentiator. The output quality depends less on having many assets and more on choosing compatible assets.

The matcher should align:

- Caption mood: what emotion the joke is built around.
- GIF/reaction mood: the visible human/reaction expression.
- Audio mood: the emotional rhythm of the clip.
- Background style: atmosphere that does not fight the caption or reaction.
- Layout compatibility: safe text zone, reaction shape, transparency, scale, and resolution.

GIPHY should be treated as an external asset supplier, not the full asset library. GIPHY can return noisy, irrelevant, low-resolution, unsafe, or awkwardly cropped results. The app needs its own metadata, scoring, validation, and local fallbacks. Otherwise the system is just "LLM picks a random GIF", which will fail too often.

GIF/reaction metadata:

```ts
type ReactionAsset = {
  id: string;
  source: "giphy" | "local";
  filePathOrUrl: string;
  type: "gif" | "mp4" | "webm";
  mood: "confused" | "panic" | "shocked" | "relief" | "smug" | "crying" | "celebrating";
  energy: "low" | "medium" | "high";
  action: "thinking" | "dancing" | "crying" | "staring" | "celebrating" | "pointing";
  hasTransparentBackground: boolean;
  width: number;
  height: number;
  durationSec?: number;
  loopable: boolean;
  preferredPosition: "bottom-center" | "center" | "bottom-right";
  preferredScale: number;
  rating?: "g" | "pg" | "pg-13";
  tags: string[];
};
```

Audio metadata:

```ts
type AudioAsset = {
  id: string;
  filePath: string;
  mood: "funny" | "dramatic" | "chill" | "chaotic" | "victory";
  energy: "low" | "medium" | "high";
  bpm?: number;
  durationSec: number;
  hasBeatDrop: boolean;
  beatDropAtSec?: number;
  license: "demo-local" | "royalty-free" | "licensed";
  tags: string[];
};
```

Background metadata:

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

Template metadata:

```ts
type TemplateAsset = {
  id: "top-caption-bottom-reaction";
  width: number;
  height: number;
  fps: number;
  captionZone: { x: number; y: number; width: number; height: number };
  reactionZone: { x: number; y: number; width: number; height: number };
  maxCaptionChars: number;
  preferredLineCount: [number, number];
};
```

Scoring logic:

```ts
totalScore =
  moodMatch * 0.35 +
  energyMatch * 0.20 +
  semanticMatch * 0.20 +
  layoutCompatibility * 0.15 +
  trendOrSourceBoost * 0.10;
```

Practical MVP scoring:

- Exact mood match: `1.0`; related mood: `0.6`; mismatch: `0.15`.
- Exact energy match: `1.0`; adjacent energy: `0.65`; mismatch: `0.25`.
- Semantic match: overlap between caption/product pain terms, query terms, tags, and candidate title.
- Layout compatibility: MP4/WebM, reasonable aspect ratio, adequate dimensions, sticker/transparent boost, safe caption area.
- Trend/source boost: GIPHY candidate gets slight freshness boost; local fallback gets reliability boost.

The matcher should return both the winner and runner-up assets. This makes "try another GIF" cheap and avoids refetching when not necessary.

## 6. Agent/LLM Responsibilities

The LLM should handle judgment and language:

- Product understanding.
- Pain point extraction.
- Old workflow vs product benefit.
- Emotional before/after state.
- Meme angle generation.
- Caption generation.
- Creative plan generation.
- Vibe/mood selection.
- Optional ranking of already-filtered GIPHY candidates.

The deterministic code should handle execution:

- URL extraction.
- Page fetching and parsing.
- Schema validation.
- Asset retrieval.
- Asset scoring and matching.
- Layout decisions.
- Caption line breaking and font sizing.
- Rendering.
- Output validation.
- Storage.
- Retry/fallback behavior.
- Job status updates.

The LLM must not directly "make the video." It should output structured JSON only. The key contracts are:

```ts
type ProductUnderstanding = {
  productName: string;
  productUrl: string;
  category: string;
  oneLineSummary: string;
  targetUser: string;
  userPain: string;
  oldWorkflow: string;
  productBenefit: string;
  emotionalBeforeState: "confused" | "stressed" | "annoyed" | "bored" | "overwhelmed" | "embarrassed";
  emotionalAfterState: "relieved" | "confident" | "smug" | "happy" | "calm";
  memeAngles: string[];
};
```

```ts
type CreativePlan = {
  caption: string;
  memeFormat: "me-when" | "pov" | "before-after" | "pretending-to-know" | "manual-vs-automated" | "realization";
  humorStyle: "relatable" | "absurd" | "dry" | "genz" | "dramatic";
  reactionMood: "confused" | "panic" | "shocked" | "relief" | "smug" | "crying" | "celebrating";
  audioMood: "funny" | "dramatic" | "chill" | "chaotic" | "victory";
  backgroundCategory: "room" | "office" | "sky" | "phone" | "gradient" | "lifestyle";
  backgroundMood: "clean" | "premium" | "neutral" | "dramatic" | "funny";
  durationSec: number;
  template: "top-caption-bottom-reaction";
  giphyQueries: string[];
};
```

All LLM outputs should be parsed, validated, and rejected or repaired before they affect rendering.

## 7. Rendering Strategy

FFmpeg and Remotion can both work, but they optimize for different problems.

FFmpeg:

- Strengths: fast, mature, reliable for transcoding, audio mixing, clipping, probing, and format conversion.
- Weaknesses: painful text layout, harder template iteration, harder debugging for visual composition, awkward for React app developers.
- Best role here: validation, fallback processing, probing output duration/audio streams, and possible lower-level render fallback.

Remotion:

- Strengths: React/TypeScript composition, easy text layout, easier background/reaction layering, easier template iteration, good fit with Next.js mental model.
- Weaknesses: heavier runtime, deployment needs more care, serverless rendering can be awkward without a worker.
- Best role here: primary composition engine for the assessment.

Recommendation: use Remotion as the primary renderer and FFmpeg/ffprobe for validation and fallback media inspection.

Exact rendering pipeline:

1. Build `CreativePlan`.
2. Select assets.
3. Build deterministic `RenderPlan`.
4. Render Remotion composition `MemeVideo`.
5. Use vertical output defaults: `512x910`, `30fps`, `7-9s`.
6. Layer background, reaction video/GIF, caption text, and audio.
7. Write MP4 to `public/generated/{jobId}.mp4`.
8. Run `ffprobe` validation when available.
9. Return `/generated/{jobId}.mp4` to chat.

Default template:

- Background fills frame.
- Reaction bottom-center, starts at `0.2s`, loops or trims to duration.
- Caption top-center, white bold sans-serif with black stroke.
- Audio starts at `0.0s`, trimmed to output duration.

Use one reliable template first. Variation should come from caption, assets, and mood, not template complexity.

## 8. MVP Scope

The best MVP is the smallest end-to-end product that creates a real playable video.

Must-have:

- Next.js chat UI.
- Natural replies for greeting/capability/no-URL cases.
- URL extraction and normalization.
- Product page metadata/text extraction with timeout.
- LLM product understanding JSON.
- LLM creative plan JSON.
- Local asset manifest for backgrounds, audio, and fallback reactions.
- Deterministic asset matcher.
- Remotion render to vertical MP4.
- Video preview returned inside chat.
- Progress states.
- Local fallback behavior for scraper/GIPHY/render issues.
- README with setup, architecture, and demo notes.

Nice-to-have:

- GIPHY candidate search and scoring.
- Regeneration with previous product context.
- "Try another GIF" using runner-up candidates.
- Simple job status endpoint.
- Output validation with ffprobe.
- 3-5 saved example prompts in README.
- Deployed demo.

Do not build in MVP:

- Timeline editor.
- Multi-scene video builder.
- Avatar/lip sync.
- Voiceover.
- Live TikTok audio integration.
- User accounts.
- Payments.
- Complex analytics.
- Production licensing workflow.
- Multi-template layout system before the first template is excellent.

MVP milestone sequence:

1. Chat message -> mocked plan -> local assets -> rendered MP4 -> chat preview.
2. Real URL extraction/scraping -> LLM JSON -> same renderer.
3. Asset scoring -> local fallback robustness.
4. GIPHY integration.
5. Regeneration/polish/deploy.

## 9. Production-Grade Improvements

After MVP, production quality would require:

- Asset ingestion pipeline: import, transcode, tag, dedupe, moderate, and validate reaction/background/audio assets.
- Licensed asset library: creator-licensed UGC clips, royalty-free audio, approved GIPHY usage paths, rights metadata, attribution policy.
- Better metadata: embeddings, visual classifiers, mood/energy labels, crop safety, transparency detection, face/action tags.
- Analytics: generation success rate, render latency, regeneration rate, asset usage, video completion/download events.
- Auto-evaluation: caption cringe checks, product relevance checks, asset-layout checks, moderation scores, render validation.
- Job queue: BullMQ, Inngest, Trigger.dev, Temporal, or a managed queue for async rendering.
- CDN/storage: S3/R2/Supabase Storage plus CDN caching and cleanup policies.
- Moderation/safety: URL/domain filtering, text moderation, unsafe GIF filtering, brand safety, likeness/copyright controls.
- Observability: structured logs, job traces, error rates by stage, renderer metrics, external API failure counters.
- Caching: product scrape cache, GIPHY candidate cache, asset scoring cache, rendered output cache by plan hash.
- Async rendering: worker process or containerized renderer outside serverless request limits.
- User accounts/history: saved products, previous generations, favorites, downloads, team workspaces.
- Review workflow: approve captions/assets before export for brand-sensitive users.
- Higher-res exports: optional `1080x1920` renders after MVP reliability is proven.

## 10. Risks and Failure Modes

GIPHY returns irrelevant GIFs.

- Fallback: filter by rating, dimensions, title/query relevance, mood, and format; use local fallback if score is below threshold.

Product website cannot be scraped.

- Fallback: continue from the user message if enough context exists; otherwise ask for one-line product description.

Audio licensing issues.

- Fallback: use demo-local or royalty-free tracks only; clearly document production licensing requirements.

Video rendering fails.

- Fallback: retry once with known-good local background, local reaction, shorter caption, and known-good audio.

Captions are cringe or generic.

- Fallback: enforce prompt rules, ban generic ad words, validate length, regenerate once with "less cringe" constraints.

Output looks too templated.

- Fallback: vary caption angle, reaction mood, audio mood, and background while keeping one reliable layout.

Serverless timeout.

- Fallback: render in a background worker or deploy to a Node server/container for the assessment.

Assets do not fit layout.

- Fallback: score layout compatibility, prefer transparent/sticker-like assets, clamp scale, and use safe text zones.

Final file too large.

- Fallback: cap duration, use MP4 over raw GIF, compress output, target `512x910` for MVP.

Legal/copyright/likeness issues.

- Fallback: demo-only GIPHY usage note, production licensed assets, moderation, attribution, and opt-out/blocked content lists.

LLM returns malformed JSON.

- Fallback: schema validation, JSON repair, one retry, then friendly failure.

Caption too long.

- Fallback: deterministic line breaking and font reduction; if still too long, regenerate shorter caption.

External API keys missing.

- Fallback: run demo with local mocked/curated assets and clear setup warning.

Unsafe or offensive GIF result.

- Fallback: rating filter, blocked terms, optional moderation, and local fallback.

## 11. Suggested Tech Stack

Frontend framework: Next.js with TypeScript.

- Matches the preferred JavaScript stack.
- Supports colocated UI and API routes.
- Easy deployment and good demo ergonomics.

Styling: Tailwind CSS.

- Fast to build a polished chat UI.
- Low overhead for assessment scope.

Backend: Next.js API routes or server actions.

- Enough for orchestration.
- Keeps project compact.
- Can later split renderer into worker.

Renderer: Remotion primary, FFmpeg/ffprobe secondary.

- Remotion makes text/reaction/background layout much easier.
- FFmpeg remains useful for validation and media probing.

Database or state: JSON files or SQLite for MVP.

- JSON/in-memory is enough for local demo.
- SQLite is a good upgrade if job persistence/history is needed.

Storage: local `public/generated` for MVP.

- Fastest reliable path for local/demo.
- Upgrade to S3/R2/Supabase Storage for deployment.

Job handling: simple in-process job store for MVP; queue later.

- Avoid queue complexity until render flow works.
- Use BullMQ/Inngest/Trigger.dev if deployment constraints require async work.

LLM provider: OpenAI or Claude-compatible API.

- Must support reliable structured JSON.
- Use strict schemas where available.

GIPHY usage: GIPHY API as reaction candidate source.

- Search multiple reaction-oriented queries.
- Prefer MP4 renditions.
- Always keep local fallbacks.

Deployment: Vercel for UI plus worker/container if rendering exceeds serverless limits; Render/Fly/Railway are simpler if everything runs in one Node process.

- For assessment speed, a single Node-capable deployment is often more practical than forcing video rendering into serverless.

Recommended file structure:

```text
app/
  page.tsx
  api/
    chat/route.ts
    generate-video/route.ts
components/
  Chat.tsx
  MessageBubble.tsx
  VideoPreview.tsx
lib/
  llm/
    productAnalyzer.ts
    creativePlanner.ts
    prompts.ts
  scraping/
    extractUrl.ts
    fetchProductPage.ts
    parseMetadata.ts
  assets/
    manifest.ts
    giphy.ts
    matcher.ts
    scoring.ts
  render/
    buildRenderPlan.ts
    renderVideo.ts
    validateOutput.ts
  jobs/
    jobStore.ts
  utils/
    ids.ts
    logger.ts
remotion/
  MemeVideo.tsx
  Root.tsx
assets/
  manifest.json
  backgrounds/
  audio/
  reactions-fallback/
public/
  generated/
```

## 12. Implementation Plan

Phase 1: Working shell.

- Create Next.js TypeScript app.
- Build the chat UI.
- Add message routing for greeting, capability, no URL, and generation request.
- Add fake progress states.
- Return a mocked video URL.
- Output: a usable chat shell with believable flow.

Phase 2: Product understanding.

- Implement URL extraction and normalization.
- Fetch product page with timeout and safe size limits.
- Parse metadata and visible text.
- Add LLM product analysis prompt.
- Validate `ProductUnderstanding`.
- Output: user URL -> structured product understanding.

Phase 3: Creative planning.

- Add creative plan prompt.
- Validate `CreativePlan` with enums and duration bounds.
- Add caption quality checks for length and banned generic words.
- Output: product understanding -> meme-native creative plan.

Phase 4: Local deterministic renderer.

- Add local background, reaction, and audio assets.
- Create `assets/manifest.json`.
- Build `buildRenderPlan`.
- Implement Remotion `MemeVideo`.
- Render MP4 to `public/generated`.
- Output: local assets -> real vertical MP4.

Phase 5: Asset matching.

- Implement mood, energy, semantic, layout, and source/freshness scoring.
- Select background/audio/reaction from manifest.
- Keep runner-up assets for regeneration.
- Add fallback thresholds.
- Output: creative plan -> selected compatible assets.

Phase 6: GIPHY integration.

- Add GIPHY API client.
- Fetch 5-10 candidates per query.
- Deduplicate by GIPHY ID.
- Filter rating, dimensions, and missing MP4.
- Convert candidates into scorer input.
- Fall back locally if score is weak or API fails.
- Output: dynamic reaction candidates with deterministic final choice.

Phase 7: Regeneration controls.

- Preserve previous product understanding and creative plan.
- Implement "make it funnier", "make it dramatic", "less cringe", and "try another GIF".
- Re-render with updated plan/assets.
- Output: iterative chat experience.

Phase 8: Quality and reliability pass.

- Add render validation with ffprobe if available.
- Add retry path with known-good local assets.
- Add structured logs with job IDs.
- Add user-safe errors.
- Test 3-5 product examples.
- Output: demo that survives common failures.

Phase 9: README and deployment.

- Document setup, env vars, architecture, LLM/code responsibility split, asset licensing note, and fallback behavior.
- Include example prompts and expected flow.
- Deploy with rendering constraints accounted for.
- Output: assessment-ready submission with repo URL, demo URL, and clear explanation.

Recommended first milestone:

```text
Chat message with product URL
-> product understanding JSON
-> creative plan JSON
-> local assets selected
-> vertical MP4 rendered
-> video shown in chat
```

Only after this works should the implementation add GIPHY, richer scoring, regeneration polish, and deployment hardening.

Execution guardrail: do not start with cloud storage, queues, accounts, or multi-template complexity. The first build should prove the full loop with local assets and one reliable template; the later phases should improve creative variety and resilience without changing the core contract.
