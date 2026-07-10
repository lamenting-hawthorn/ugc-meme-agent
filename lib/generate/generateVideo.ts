import { analyzeProduct } from "@/lib/llm/productAnalyzer";
import { buildRenderPlan } from "@/lib/render/buildRenderPlan";
import { createJobId } from "@/lib/utils/ids";
import { extractFirstUrl } from "@/lib/scraping/extractUrl";
import { fetchProductPage } from "@/lib/scraping/fetchProductPage";
import { logger } from "@/lib/utils/logger";
import { planCreative } from "@/lib/llm/creativePlanner";
import { renderVideo } from "@/lib/render/renderVideo";
import { selectAssets } from "@/lib/assets/matcher";
import { hydrateVideoSkill, resolveVideoSkill } from "@/lib/skills/reactionAppUgc";
import type { CreativePlan, GenerateVideoRequest, GenerateVideoResponse, SelectedAssets } from "@/lib/types";
import { loadManifest } from "@/lib/assets/manifest";
import { scoreAudio, scoreBackground, scoreReaction } from "@/lib/assets/scoring";

export async function generateVideo(
  request: GenerateVideoRequest,
  onProgress?: (stage: string) => void
): Promise<GenerateVideoResponse> {
  const jobId = createJobId();
  const progress: string[] = [];
  const startedAt = Date.now();
  const productUrl = extractFirstUrl(request.message) ?? request.previousContext?.productUnderstanding?.productUrl;
  if (!productUrl) {
    return { status: "error", error: "No product URL found. Send a URL plus one line about what it does." };
  }
  if (isGenericWebsite(productUrl)) {
    return {
      status: "error",
      error: "That looks like a general website, not a product URL. Send the startup or product page you want turned into an ad."
    };
  }

  try {
    const mark = (message: string) => {
      progress.push(message);
      logger.info("Generation progress", { jobId, stage: message, elapsedMs: Date.now() - startedAt });
      onProgress?.(message);
    };

    let productUnderstanding = request.previousContext?.productUnderstanding;
    let creativePlan: CreativePlan | undefined;

    // "try another GIF" path: reuse the previous caption and audio — only
    // re-select the reaction so the cut stays the same joke with a new visual.
    if (request.regenerateReactionOnly && request.previousContext?.lastCreativePlan) {
      creativePlan = request.previousContext.lastCreativePlan;
      if (!productUnderstanding) {
        mark("Reading product page...");
        const page = await fetchProductPage(productUrl);
        mark("Understanding the product...");
        productUnderstanding = await analyzeProduct(request.message, productUrl, page, request.previousContext?.conversationMemory);
      }
      mark("Swapping reaction clip...");
    } else {
      mark("Reading product page...");
      const page = await fetchProductPage(productUrl);
      if (!page.fetchOk) mark("Product page unavailable, continuing from message...");

      mark("Understanding the product...");
      productUnderstanding =
        request.previousContext?.productUnderstanding && !extractFirstUrl(request.message)
          ? request.previousContext.productUnderstanding
          : await analyzeProduct(request.message, productUrl, page, request.previousContext?.conversationMemory);

      mark("Writing meme caption...");
      const appliedSkill = await hydrateVideoSkill(resolveVideoSkill(request.message, productUnderstanding) ?? {
        id: "reaction-app-ugc-shorts",
        instructions: "",
        targetDurationSec: 10,
        durationRangeSec: { min: 7, max: 15 }
      });
      creativePlan = await planCreative(
        productUnderstanding,
        request.vibeOverride,
        request.previousContext?.conversationMemory,
        appliedSkill
      );
    }

    const llmProvider = productUnderstanding?.source === "openrouter" || creativePlan.source === "openrouter"
      ? "openrouter"
      : productUnderstanding?.source === "deepseek" || creativePlan.source === "deepseek"
        ? "deepseek"
        : "deterministic";

    mark("Searching reaction clips...");
    mark("Matching audio and background...");

    const excludeIds: string[] = [];
    if (request.previousContext?.lastReactionAssetId) {
      excludeIds.push(request.previousContext.lastReactionAssetId);
    }

    let selectedAssets = await selectAssets(creativePlan, excludeIds);

    // If the winner is still the excluded reaction (e.g. only one candidate
    // was available) and a runner-up exists, swap them.
    if (
      request.previousContext?.lastReactionAssetId &&
      selectedAssets.reaction.id === request.previousContext.lastReactionAssetId &&
      selectedAssets.runnerUpReaction
    ) {
      const previousReaction = selectedAssets.reaction;
      selectedAssets.reaction = selectedAssets.runnerUpReaction;
      selectedAssets.runnerUpReaction = previousReaction;
      selectedAssets.reasons = [
        `Swapped in ${selectedAssets.reaction.id} to avoid repeating the previous cut`,
        ...selectedAssets.reasons
      ];
    }

    mark("Rendering video...");
    let renderPlan = buildRenderPlan(creativePlan, selectedAssets);
    let rendered: { videoUrl: string; posterUrl: string } | null = null;

    try {
      rendered = await renderVideo(jobId, renderPlan);
    } catch (renderError) {
      mark("Render failed once, retrying with simpler local assets...");
      logger.warn("Initial render failed; retrying with known-good local assets", {
        jobId,
        error: renderError instanceof Error ? renderError.message : "unknown"
      });
      selectedAssets = buildLocalFallbackAssets(creativePlan);
      renderPlan = buildRenderPlan(creativePlan, selectedAssets);
      rendered = await renderVideo(jobId, renderPlan);
    }

    mark("Checking output...");
    mark("Done.");

    const fallbackUsed =
      (creativePlan.source !== "deepseek" && creativePlan.source !== "openrouter") ||
      selectedAssets.reaction.source === "local" ||
      selectedAssets.audio.source === "local" ||
      selectedAssets.background.source === "local";

    return {
      status: "success",
      jobId,
      videoUrl: rendered.videoUrl,
      posterUrl: rendered.posterUrl,
      caption: creativePlan.caption,
      productUnderstanding: productUnderstanding ?? undefined,
      creativePlan,
      selectedAssets,
      progress,
      fallbackUsed,
      llmProvider,
      appliedSkillId: "reaction-app-ugc-shorts"
    };
  } catch (error) {
    logger.error("Generation failed", { jobId, error: error instanceof Error ? error.message : "unknown" });
    const errorMessage = error instanceof Error && /human reaction|reaction candidate/.test(error.message)
      ? "I couldn't find a usable human reaction clip. Check GIPHY_API_KEY and try again."
      : "I had trouble rendering that version. Try again with a product URL and a shorter product description.";
    return {
      status: "error",
      jobId,
      progress,
      error: errorMessage
    };
  }
}

function buildLocalFallbackAssets(plan: CreativePlan): SelectedAssets {
  const manifest = loadManifest();
  const reaction = [...manifest.reactions].sort((a, b) => scoreReaction(plan, b) - scoreReaction(plan, a))[0];
  const runnerUpReaction = [...manifest.reactions]
    .sort((a, b) => scoreReaction(plan, b) - scoreReaction(plan, a))
    .find((r) => r.id !== reaction.id);
  const audio = [...manifest.audio].sort((a, b) => scoreAudio(plan, b) - scoreAudio(plan, a))[0];
  const background = [...manifest.backgrounds].sort((a, b) => scoreBackground(plan, b) - scoreBackground(plan, a))[0];

  return {
    background,
    reaction,
    audio,
    runnerUpReaction,
    reasons: [
      "Render retry: using known-good local background, reaction and audio",
      runnerUpReaction ? `Runner-up ${runnerUpReaction.id} available` : "No runner-up",
      `${audio.id} matched ${plan.audioMood}`,
      `${background.id} kept the top caption zone clean`,
      "Vision rerank skipped; local fallback"
    ]
  };
}

function isGenericWebsite(productUrl: string): boolean {
  const host = new URL(productUrl).hostname.replace(/^www\./, "").toLowerCase();
  return new Set([
    "google.com",
    "youtube.com",
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "linkedin.com",
    "tiktok.com",
    "reddit.com",
    "apple.com",
    "microsoft.com",
    "amazon.com"
  ]).has(host);
}
