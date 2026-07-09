import { analyzeProduct } from "@/lib/llm/productAnalyzer";
import { buildRenderPlan } from "@/lib/render/buildRenderPlan";
import { createJobId } from "@/lib/utils/ids";
import { extractFirstUrl } from "@/lib/scraping/extractUrl";
import { fetchProductPage } from "@/lib/scraping/fetchProductPage";
import { logger } from "@/lib/utils/logger";
import { planCreative } from "@/lib/llm/creativePlanner";
import { renderVideo } from "@/lib/render/renderVideo";
import { selectAssets } from "@/lib/assets/matcher";
import type { GenerateVideoRequest, GenerateVideoResponse } from "@/lib/types";

export async function generateVideo(request: GenerateVideoRequest): Promise<GenerateVideoResponse> {
  const jobId = createJobId();
  const progress: string[] = [];
  const productUrl = extractFirstUrl(request.message) ?? request.previousContext?.productUnderstanding?.productUrl;
  if (!productUrl) {
    return { status: "error", error: "No product URL found. Send a URL plus one line about what it does." };
  }

  try {
    progress.push("Reading product page...");
    const page = await fetchProductPage(productUrl);
    if (!page.fetchOk) progress.push("Product page unavailable, continuing from message...");

    progress.push("Understanding the product...");
    const productUnderstanding =
      request.previousContext?.productUnderstanding && !extractFirstUrl(request.message)
        ? request.previousContext.productUnderstanding
        : await analyzeProduct(request.message, productUrl, page, request.previousContext?.conversationMemory);

    progress.push("Writing meme caption...");
    const creativePlan = await planCreative(
      productUnderstanding,
      request.vibeOverride,
      request.previousContext?.conversationMemory
    );
    const llmProvider =
      productUnderstanding.source === "deepseek" || creativePlan.source === "deepseek" ? "deepseek" : "deterministic";

    progress.push("Searching reaction clips...");
    progress.push("Matching audio and background...");
    const selectedAssets = await selectAssets(creativePlan);
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

    progress.push("Rendering video...");
    const renderPlan = buildRenderPlan(creativePlan, selectedAssets);
    const rendered = await renderVideo(jobId, renderPlan);

    progress.push("Checking output...");
    progress.push("Done.");

    const fallbackUsed =
      creativePlan.source !== "deepseek" ||
      !page.fetchOk ||
      selectedAssets.reaction.source === "local" ||
      selectedAssets.audio.source === "local" ||
      selectedAssets.background.source === "local";

    return {
      status: "success",
      jobId,
      videoUrl: rendered.videoUrl,
      posterUrl: rendered.posterUrl,
      caption: creativePlan.caption,
      productUnderstanding,
      creativePlan,
      selectedAssets,
      progress,
      fallbackUsed,
      llmProvider
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
