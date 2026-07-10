# UGC Meme Agent

> Turn a product URL and a user pain point into a short, vertical reaction video.

UGC Meme Agent is a production-minded Next.js prototype for generating 7–15 second UGC-style meme videos. It combines structured creative planning, product-page context, ranked media selection, deterministic FFmpeg rendering, and graceful fallbacks so a demo remains useful when optional providers are unavailable.

A chat-based UGC meme video generator for startups. It reads a product URL, understands the user pain point, writes a short meme caption, matches reaction/audio/background assets, renders a vertical MP4, and returns it in chat.

The system separates creative reasoning from deterministic rendering. The LLM produces structured product and creative plans when an OpenRouter or DeepSeek key is present; by default it now prefers the OpenRouter Qwen VL model for both structured text generation and vision reranking. The deterministic fallback keeps the demo working without external APIs. The asset intelligence layer scores compatible reactions, audio, and backgrounds before FFmpeg composes the final clip.

The video planner now auto-loads the installed `reaction-app-ugc-shorts` skill and uses it as the source of truth for reaction-style UGC outputs. The checked-in source skill lives at [`reaction-app-ugc-shorts/SKILL.md`](./reaction-app-ugc-shorts/SKILL.md), and Codex can also install it into `~/.codex/skills/reaction-app-ugc-shorts/`.

## Run Locally

```bash
npm install
npm run seed-assets
npm run dev
```

Open `http://localhost:3000`.

## Why this is interesting

- Product-aware captions instead of generic copy.
- Structured plans validated before they reach the renderer.
- Local assets and deterministic fallbacks for reliable demos.
- SSRF-aware product URL validation, bounded redirects, timeouts, and render budgets.
- Optional OpenRouter vision reranking for reaction quality.

## Cost and API highlights

- **100 GIPHY API calls per hour on a free beta key.** GIPHY's default beta keys are rate-limited to 100 searches/API calls per hour; the app caches provider results and falls back to local assets when the limit is reached. See [GIPHY's API documentation](https://developers.giphy.com/docs/api/).
- **Very low LLM cost.** The default OpenRouter Qwen3 VL model is priced at **$0.13 input / $0.52 output per 1M tokens**. DeepSeek is priced at **$0.435 per 1M input tokens on cache miss / $0.87 per 1M output tokens**. These rates make normal structured planning and vision reranking extremely inexpensive; for example, 4,000 input + 1,000 output tokens is about **$0.00104 with the VLM** or **$0.00261 with DeepSeek** per call, before any additional calls or media-provider charges. See [OpenRouter pricing](https://openrouter.ai/qwen/qwen3-vl-30b-a3b-thinking) and [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing).

The **100 calls/hour limit applies to GIPHY’s free beta API key—not to the LLMs**. These pricing figures are usage rates, not a spending guarantee; actual cost depends on prompt length, reasoning output, number of planning/reranking calls, cache hits, provider routing, and separately billed media APIs. Set provider-side budgets and monitor production usage before opening the endpoint to untrusted traffic.

Example prompt:

```text
I'm building CalAI, a calorie-tracking app. Here's the site: calai.app
```

## Configuration

Copy `.env.example` to `.env.local`.

```text
LLM_PROVIDER=openrouter  # optional; openrouter (default) or deepseek
DEEPSEEK_API_KEY=    # optional fallback provider for structured text generation
DEEPSEEK_BASE_URL=https://api.deepseek.com/
DEEPSEEK_MODEL=deepseek-v4-pro
GIPHY_API_KEY=       # optional; local reaction fallbacks run without it
PEXELS_API_KEY=      # optional; local backgrounds remain the fallback
FREESOUND_API_KEY=   # optional; local audio remains the fallback
OPENROUTER_API_KEY=  # optional; preferred provider for structured text + vision
OPENROUTER_TEXT_MODEL=qwen/qwen3-vl-30b-a3b-thinking
OPENROUTER_VISION_MODEL=qwen/qwen3-vl-30b-a3b-instruct
OPENROUTER_APP_TITLE=
NEXT_PUBLIC_APP_URL=http://localhost:3000
STORAGE_MODE=local
```

Copy `.env.example` to `.env.local` and add only the providers you need. API keys are read server-side; do not expose them through `NEXT_PUBLIC_*` variables or commit `.env.local`.

## Architecture

- `app/api/chat` handles small talk, capability questions, generation, and follow-up vibe changes.
- `lib/scraping` extracts and validates product URLs, then fetches public metadata with a timeout.
- `lib/llm` creates schema-validated product understanding and creative plans.
- `lib/skills` resolves installed reusable skills and injects their instructions into generation at runtime.
- `lib/assets` loads the local manifest, searches GIPHY `gifs` and `stickers`, and optionally uses an OpenRouter-hosted Qwen VL model to classify the top remote reactions. Selection follows a strict visual hierarchy: real-human stickers first, animated figures second, and generic/random stickers only as fallback. It also pulls remote Pexels backgrounds and Freesound previews when configured, caches provider responses on disk, and scores assets.
- `lib/render` builds a deterministic render plan, creates a caption overlay (SVG → PNG via sharp), renders with FFmpeg, and validates the MP4 with `ffprobe`.
- `public/generated` stores local demo output.

### Request flow

1. The chat route identifies generation, regeneration, and conversational requests.
2. Product URLs are validated as public HTTP(S) destinations before fetches and redirects.
3. The planner produces a bounded, structured creative plan with product identity checks.
4. Asset providers are queried concurrently, ranked, and reduced to a render-safe selection.
5. FFmpeg renders a vertical clip; output validation checks duration, audio, and dimensions.

## Chat Features

- **Live progress streaming**: Generation requests stream stage updates via NDJSON so the user sees "Reading product page...", "Writing meme caption...", "Rendering video..." in real time.
- **Regeneration**: "make it funnier", "make it dramatic", and "less cringe" reuse the previous product understanding with a new vibe.
- **Try another GIF**: "try another gif" preserves the caption and audio, only re-selecting a different reaction clip — same joke, new visual.
- **Render retry**: If the first render fails, the system retries once with known-good local background, reaction, and audio before surfacing an error.

## Demo Guarantees

The app is designed to keep working when external services fail:

- If scraping fails, it continues from the user message.
- If OpenRouter and DeepSeek are both missing or unavailable, deterministic planning is used.
- If GIPHY is missing or unavailable, local reaction assets are used.
- If OpenRouter vision reranking is missing or unavailable, heuristic reaction ranking is used.
- If Pexels is missing or unavailable, local backgrounds are used.
- If Freesound is missing or unavailable, local audio is used.
- Rendered outputs are checked for duration, audio, and vertical aspect ratio.

These are resilience guarantees for the demo path, not a claim that every third-party provider or arbitrary remote asset will succeed.

For demo purposes, GIPHY can be used as a dynamic reaction asset source. For production/commercial rendering, this should use licensed asset packs, approved GIPHY terms, or creator-licensed UGC media.

## GIPHY Integration Note

This repo uses the GIPHY REST API directly on the server rather than a browser SDK. That fits the current architecture better because the asset search already happens inside `lib/assets`, keeps the API key off the client, avoids an extra dependency, and makes it easier to normalize `gif` and `sticker` results into the app's own scoring pipeline.

## Provider Notes

- Pexels is used for remote image/video background candidates. The repo caches Pexels search responses under `.cache/asset-provider`.
- Freesound is used for dynamic audio preview candidates. This currently consumes preview MP3 URLs for selection/rendering and still falls back to local tracks when remote search fails or returns weak results.

## Validation

```bash
npm run build
npm audit --omit=dev --audit-level=moderate
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of json public/generated/<job>.mp4
```

## Deployment

The app is compatible with a Node-capable deployment such as Vercel. For serverless deployment, set `STORAGE_MODE=blob` and provide `BLOB_READ_WRITE_TOKEN`; local filesystem output is intended for development only. Configure provider keys and `NEXT_PUBLIC_APP_URL` in the deployment environment, then run:

```bash
npm ci
npm test
npm run lint
npm run build
```

## Scope and limitations

- This is a generation workflow, not a content-moderation or brand-safety system.
- Remote media usage must comply with provider and creator licensing terms. Use licensed asset packs for commercial production.
- Product-page extraction is best-effort and does not bypass authentication or client-rendered application state.
- The current tests cover policy, URL safety, and generation-budget behavior; browser and provider-contract coverage remain follow-ups.

## License

No open-source license has been declared yet. Treat this repository as “all rights reserved” until a license is added.
