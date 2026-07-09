# UGC Meme Agent

A chat-based UGC meme video generator for startups. It reads a product URL, understands the user pain point, writes a short meme caption, matches reaction/audio/background assets, renders a vertical MP4, and returns it in chat.

The system separates creative reasoning from deterministic rendering. The LLM produces structured product and creative plans when `DEEPSEEK_API_KEY` is present; the deterministic fallback keeps the demo working without external APIs. The asset intelligence layer scores compatible reactions, audio, and backgrounds before FFmpeg composes the final clip.

## Run Locally

```bash
npm install
npm run seed-assets
npm run dev
```

Open `http://localhost:3000`.

Example prompt:

```text
I'm building CalAI, a calorie-tracking app. Here's the site: calai.app
```

## Environment

Copy `.env.example` to `.env.local`.

```text
DEEPSEEK_API_KEY=    # optional; deterministic fallback runs without it
DEEPSEEK_BASE_URL=https://api.deepseek.com/
DEEPSEEK_MODEL=deepseek-v4-flash
GIPHY_API_KEY=       # optional; local reaction fallbacks run without it
PEXELS_API_KEY=      # optional; local backgrounds remain the fallback
FREESOUND_API_KEY=   # optional; local audio remains the fallback
OPENROUTER_API_KEY=  # optional; vision reranks remote GIPHY candidates when available
OPENROUTER_VISION_MODEL=qwen/qwen3-vl-30b-a3b-thinking
OPENROUTER_APP_TITLE=
NEXT_PUBLIC_APP_URL=http://localhost:3000
STORAGE_MODE=local
```

Add all API keys in `.env.local` at the repo root. This app reads them server-side only.

## Architecture

- `app/api/chat` handles small talk, capability questions, generation, and follow-up vibe changes.
- `lib/scraping` extracts and validates product URLs, then fetches public metadata with a timeout.
- `lib/llm` creates schema-validated product understanding and creative plans.
- `lib/assets` loads the local manifest, searches GIPHY `gifs` and `stickers`, optionally reranks top remote reaction candidates with an OpenRouter-hosted vision model, pulls remote Pexels backgrounds and Freesound previews when configured, caches provider responses on disk, and scores assets.
- `lib/render` builds a deterministic render plan, creates a caption overlay, renders with FFmpeg, and validates the MP4 with `ffprobe`.
- `public/generated` stores local demo output.

## Demo Guarantees

The app is designed to keep working when external services fail:

- If scraping fails, it continues from the user message.
- If OpenAI is missing or unavailable, deterministic planning is used.
- If GIPHY is missing or unavailable, local reaction assets are used.
- If OpenRouter vision reranking is missing or unavailable, heuristic reaction ranking is used.
- If Pexels is missing or unavailable, local backgrounds are used.
- If Freesound is missing or unavailable, local audio is used.
- Rendered outputs are checked for duration, audio, and vertical aspect ratio.

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
