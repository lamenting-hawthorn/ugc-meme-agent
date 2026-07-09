# YEC Founding Engineer Task — Project Context and Product Spec

## Purpose of this document

This file gives the AI coding agent the full product context, assessment expectations, and creative direction. It should be read before implementation starts.

The task is to build a polished technical-assessment project for a founding engineer role. The bar is not “quick hackathon demo.” The bar is a small but real product with strong judgment, clean architecture, and a reliable end-to-end flow.

---

# 1. Assessment summary

The assessment asks for a simple web app with a chat interface.

A user can type a message such as:

> “I’m building CalAI, a calorie-tracking app. Here’s the site: calai.app”

The app should:

1. Understand the product from the message and URL.
2. Read the product URL and extract useful context.
3. Generate a short UGC-style meme marketing video.
4. Return the final video URL back inside the same chat.
5. Handle normal conversation naturally, like ChatGPT.

If the user just says “hi,” the app should respond naturally.

If the user asks “What can you do?”, the app should explain that it can generate short UGC-style marketing videos from a product URL.

The preferred stack is any JavaScript stack, especially something like Next.js.

---

# 2. What the output video should look like

The assessment examples show a very specific video format.

Do not build a cinematic AI video generator. Build an AI-organized meme/UGC video assembler.

The video format is:

1. Static or almost-static background.
2. Meme/celebrity/reaction GIF or short video layered on top.
3. White bold text overlay with black outline.
4. Popular/trending-style music.
5. Vertical short-form aspect ratio.
6. Around 5–10 seconds, but the examples can be slightly longer.

The examples are not product demos. They are meme ads.

The core experience should feel like:

> “ChatGPT for automatically making meme-style startup ads.”

Not:

> “A full professional video editor.”

---

# 3. Observations from the uploaded example videos

Two example videos were provided in the assessment context.

## Video structure

Both videos are vertical short-form clips.

They use:

- static or simple background;
- foreground human reaction cutout/GIF/video;
- meme-style caption at the top;
- music as the main audio layer;
- no voiceover;
- no multi-scene storyboard;
- no complex product walkthrough.

## Technical characteristics observed

The examples are approximately:

- vertical format;
- 512 × 910 style export;
- 30 fps;
- 10–12 seconds;
- compressed MP4;
- music/audio attached.

The quality is not cinematic. The quality is meme-native.

This matters because the build should optimize for speed, reliability, and meme fit rather than high-end VFX.

## Creative grammar

The examples use captions like:

> “me acting like i know my macros so i just open calai.app and let it handle it”

and:

> “me when i’m still logging calories manually instead of using calai.app”

These are not normal ad captions. They are internet-native meme captions.

The app should generate text using formats like:

- “me when [pain point] instead of using [product]”
- “me pretending i understand [problem] so i just use [product]”
- “pov: you’re still doing [old painful workflow] manually”
- “me after realizing [product] does [benefit] for me”
- “when [annoying task] takes 2 seconds with [product]”
- “my brain after discovering [product]”
- “how i act after automating [pain point] with [product]”

---

# 4. What matters most in the assessment

The assessment likely evaluates:

1. Whether the app works end to end.
2. Whether the generated video feels funny and clever.
3. Whether the output is relevant to current social-media/meme style.
4. Whether the chat experience is clean and robust.
5. Whether the technical choices are thoughtful.
6. Whether the architecture can grow into a real product.

The hidden requirement is product taste.

A technically complex app with cringe captions is worse than a simple reliable app that makes funny, native-feeling clips.

---

# 5. Core product principle

The system should not let the LLM directly “make a video.”

The correct split is:

- LLM/agent = creative reasoning and structured planning.
- Asset matcher = deterministic selection and scoring.
- Renderer = deterministic video composition.
- Evaluator = checks output quality.

Use this mental model:

> Agent creates a creative brief. Asset system matches assets. Renderer composes. Evaluator checks.

Avoid this anti-pattern:

> Agent randomly picks GIF/audio/text and hopes it works.

---

# 6. Recommended MVP scope

Build this:

- Chat interface.
- URL extraction from user message.
- Product metadata scraper.
- LLM product understanding.
- Meme caption generator.
- GIPHY-based reaction candidate search.
- Local fallback reaction assets.
- Local music/audio asset library.
- Static background library.
- Asset scoring/matching engine.
- Remotion or FFmpeg renderer.
- Video output URL returned in chat.
- Regenerate or “try another vibe” support.

Do not build this for the initial assessment:

- Full AI video generation.
- Avatar generation.
- Lip sync.
- Timeline editor.
- Multi-scene cinematic ad creation.
- Product demo screen recording.
- Complex motion graphics.

The examples are one-scene meme videos. Keep the core product focused.

---

# 7. User experience requirements

## Main chat flow

1. User opens app.
2. Bot says something simple like:

   > “Send me your product URL and I’ll turn it into a short UGC-style meme ad.”

3. User sends a product description and URL.
4. Chat shows progress updates:

   - Reading product page...
   - Finding the pain point...
   - Writing meme caption...
   - Picking reaction clip...
   - Rendering video...
   - Done.

5. App returns a video preview and link.
6. User can ask:

   - “make it funnier”
   - “try another GIF”
   - “make it more Gen Z”
   - “make it less cringe”
   - “make it dramatic”
   - “generate another version”

## Non-generation chat flow

If user says “hi,” respond naturally.

If user asks what the app does, answer briefly.

If user sends no URL, ask for a product URL.

If the site cannot be scraped, ask the user for a short product description or use the description in the message.

---

# 8. Product positioning

For the README and demo, describe the product as:

> A chat-based UGC meme video generator for startups. It reads a product URL, understands the user pain point, writes a short meme caption, picks a matching reaction GIF and audio, renders the clip, and returns it in chat.

A strong README sentence:

> The system separates creative reasoning from deterministic rendering. The LLM produces a structured creative plan, while an asset intelligence layer scores compatible GIFs, audio, and backgrounds before a renderer composes the final MP4.

---

# 9. Legal and production note

The examples use recognizable internet/celebrity reaction clips.

For demo purposes, GIPHY or curated meme assets are acceptable.

For production, the app should use:

- licensed creator clips;
- approved GIPHY usage paths;
- royalty-free reaction packs;
- internally generated UGC assets;
- clear attribution and content-use compliance.

Add this note in the README:

> For demo purposes, GIPHY is used as a dynamic reaction asset source. For production/commercial rendering, this should use licensed asset packs, approved GIPHY terms, or creator-licensed UGC media.

---

# 10. Definition of a good final submission

A good final submission should have:

- clean chat UI;
- reliable generation flow;
- at least 3–5 tested product examples;
- generated MP4 preview in UI;
- strong meme captions;
- good fallback behavior;
- simple but clean architecture;
- clear README with setup and architecture explanation;
- deployed demo URL;
- GitHub repo URL.

The demo must work even if external APIs fail. Keep local fallbacks.

