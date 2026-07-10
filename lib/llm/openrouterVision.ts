import { z } from "zod";
import type { CreativePlan, ReactionAsset } from "@/lib/types";
import {
  inferReactionVisualCategoryFromTitle,
  REACTION_VISUAL_CATEGORY_PRIORITY,
  titleSignalsDisallowedVisual
} from "@/lib/assets/reactionVisualCategory";
import { logger } from "@/lib/utils/logger";

const MAX_VISION_CANDIDATES = 8;
const VISION_TIMEOUT_MS = 30_000;

type VisionRerankResult = {
  ranked: ReactionAsset[] | null;
  overallReason: string;
};

const visionRankingSchema = z.object({
  reasoning: z.string().min(1).max(300),
  scores: z.array(
    z.object({
      id: z.string().min(1),
      score: z.number().min(0).max(1),
      visualCategory: z.enum(["real_human", "animated_figure", "generic"]),
      usable: z.boolean(),
      reason: z.string().min(1).max(180)
    })
  ).min(1)
});

type VisionRanking = z.infer<typeof visionRankingSchema>;

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string;
  };
};

export async function rerankReactionCandidatesWithVision(
  plan: CreativePlan,
  candidates: ReactionAsset[]
): Promise<VisionRerankResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ranked: null, overallReason: "Qwen VL skipped: OPENROUTER_API_KEY is not configured" };
  }

  const visionCandidates = selectDiverseVisionCandidates(candidates);
  if (visionCandidates.length < 2) {
    return { ranked: null, overallReason: "Qwen VL skipped: fewer than two previewable candidates" };
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: buildPrompt(plan, visionCandidates)
    }
  ];

  for (const candidate of visionCandidates) {
    content.push({
      type: "text",
      text: `Candidate ${candidate.id}. Title: ${candidate.title ?? "untitled"}. Tags: ${candidate.tags.join(", ")}.`
    });
    content.push({
      type: "image_url",
      image_url: { url: visionImageUrl(candidate) }
    });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(process.env.NEXT_PUBLIC_APP_URL ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL } : {}),
        ...(process.env.OPENROUTER_APP_TITLE ? { "X-OpenRouter-Title": process.env.OPENROUTER_APP_TITLE } : {})
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_VISION_MODEL || "qwen/qwen3-vl-30b-a3b-instruct",
        temperature: 0,
        max_tokens: 2000,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "reaction_ranking",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reasoning: { type: "string" },
                scores: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      score: { type: "number" },
                      visualCategory: {
                        type: "string",
                        enum: ["real_human", "animated_figure", "generic"]
                      },
                      usable: { type: "boolean" },
                      reason: { type: "string" }
                    },
                    required: ["id", "score", "visualCategory", "usable", "reason"]
                  }
                }
              },
              required: ["reasoning", "scores"]
            }
          }
        },
        messages: [
          {
            role: "user",
            content
          }
        ]
      }),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS)
    });

    const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;
    if (!response.ok) {
      logger.warn("OpenRouter vision rerank failed; keeping heuristic order", {
        status: response.status,
        detail: payload.error?.code ?? payload.error?.message ?? "unknown"
      });
      return {
        ranked: null,
        overallReason: `Qwen VL failed with HTTP ${response.status}; heuristic reaction ranking used`
      };
    }

    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) {
      logger.info("OpenRouter vision rerank returned empty content; keeping heuristic order");
      return { ranked: null, overallReason: "Qwen VL returned empty content; heuristic reaction ranking used" };
    }

    const parsed = visionRankingSchema.parse(JSON.parse(raw)) as VisionRanking;
    const candidateIds = new Set(visionCandidates.map((candidate) => candidate.id));
    const scoreById = new Map<string, VisionRanking["scores"][number]>();
    for (const score of parsed.scores) {
      if (candidateIds.has(score.id) && !scoreById.has(score.id)) {
        scoreById.set(score.id, score);
      }
    }
    if (scoreById.size !== visionCandidates.length) {
      logger.warn("OpenRouter vision rerank returned an incomplete candidate classification; keeping heuristic order", {
        expected: visionCandidates.length,
        received: scoreById.size
      });
      return {
        ranked: null,
        overallReason: `Qwen VL returned ${scoreById.size}/${visionCandidates.length} candidate classifications; heuristic reaction ranking used`
      };
    }

    const heuristicPosition = new Map(candidates.map((candidate, index) => [candidate.id, index]));
    const ranked = candidates.map((candidate) => {
      const scored = scoreById.get(candidate.id);
      const titleCategory = inferReactionVisualCategoryFromTitle(candidate.title);
      const visualCategory = scored?.visualCategory === "real_human" && titleCategory && titleCategory !== "real_human"
        ? titleCategory
        : scored?.visualCategory;
      return scored
        ? {
            ...candidate,
            visualCategory,
            visionScore: scored.score,
            visionReason: visualCategory !== scored.visualCategory
              ? `${scored.reason} Provider title corrected category to ${visualCategory}.`
              : scored.reason
          }
        : candidate;
    }).sort((a, b) => {
      const aScore = scoreById.get(a.id);
      const bScore = scoreById.get(b.id);
      if (aScore && bScore) {
        const categoryDifference = REACTION_VISUAL_CATEGORY_PRIORITY[b.visualCategory ?? bScore.visualCategory]
          - REACTION_VISUAL_CATEGORY_PRIORITY[a.visualCategory ?? aScore.visualCategory];
        if (categoryDifference !== 0) return categoryDifference;
        if (bScore.score !== aScore.score) return bScore.score - aScore.score;
      } else if (aScore || bScore) {
        return aScore ? -1 : 1;
      }
      return (heuristicPosition.get(a.id) ?? Number.MAX_SAFE_INTEGER)
        - (heuristicPosition.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    });

    const visuallyAccepted = ranked.filter((candidate) => {
      const score = scoreById.get(candidate.id);
      return score?.usable === true && !titleSignalsDisallowedVisual(candidate.title);
    });
    return {
      ranked: visuallyAccepted,
      overallReason: `Qwen VL reviewed ${scoreById.size} visual candidates using human > animated > generic priority. ${parsed.reasoning}`
    };
  } catch (error) {
    logger.warn("OpenRouter vision rerank threw; keeping heuristic order", {
      error: error instanceof Error ? error.message : "unknown"
    });
    const detail = error instanceof Error ? error.message : "unknown error";
    return {
      ranked: null,
      overallReason: `Qwen VL failed: ${detail}; heuristic reaction ranking used`
    };
  }
}

function buildPrompt(plan: CreativePlan, candidates: ReactionAsset[]): string {
  return [
    "You are ranking reaction stickers/GIFs for a short meme ad.",
    `Caption: ${plan.caption}`,
    `Target mood: ${plan.reactionMood}`,
    `Humor style: ${plan.humorStyle}`,
    `Template: ${plan.template}`,
    "Classify every candidate into exactly one visualCategory:",
    "- real_human: a clearly visible real person, live-action face/body, celebrity, or photographic human cutout.",
    "- animated_figure: a cartoon, anime, illustrated, 3D, emoji-like, or otherwise animated human/humanoid character with a readable reaction.",
    "- generic: animals, objects, shapes, text, logos, effects, abstract art, or anything without a real or animated reaction figure.",
    "The selection hierarchy is strict: real_human first, animated_figure only when no usable real_human exists, and generic only when neither higher tier exists.",
    "Within the same category, score caption/emotion fit, expression clarity at small size, clean silhouette, and overlay suitability from 0 to 1.",
    "Set usable=false for blank/corrupt media, unsafe content, logos, watermarks, promotional stickers, any embedded words/captions, large opaque cards or blobs, or visuals whose subject cannot be understood.",
    "A real person plus embedded promotional text is unusable. Inspect the animation across frames; text that appears after the first frame still makes it unusable. A clean random object without text remains a usable generic fallback.",
    "Classify and score every supplied candidate. The application—not you—will choose the winner by enforcing the category hierarchy before score.",
    "Keep the overall reasoning under 20 words and each candidate reason under 12 words so the complete JSON fits in the response budget.",
    `You must score only these candidate ids: ${candidates.map((candidate) => candidate.id).join(", ")}`
  ].join("\n");
}

function visionImageUrl(candidate: ReactionAsset): string {
  if (candidate.type === "gif" && /^https?:\/\//.test(candidate.filePathOrUrl)) {
    return candidate.filePathOrUrl;
  }
  return candidate.previewImageUrl!;
}

function selectDiverseVisionCandidates(candidates: ReactionAsset[]): ReactionAsset[] {
  const eligible = candidates.filter(
    (candidate) => candidate.previewImageUrl && /^https?:\/\//.test(candidate.previewImageUrl)
  );
  const byQuery = new Map<string, ReactionAsset[]>();
  for (const candidate of eligible) {
    const query = candidate.queryUsed?.trim().toLowerCase() || candidate.id;
    const group = byQuery.get(query) ?? [];
    group.push(candidate);
    byQuery.set(query, group);
  }

  const selected: ReactionAsset[] = [];
  for (let position = 0; selected.length < MAX_VISION_CANDIDATES; position += 1) {
    let added = false;
    for (const group of byQuery.values()) {
      const candidate = group[position];
      if (!candidate) continue;
      selected.push(candidate);
      added = true;
      if (selected.length === MAX_VISION_CANDIDATES) break;
    }
    if (!added) break;
  }
  return selected;
}
