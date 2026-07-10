import { z } from "zod";
import type { CreativePlan, ReactionAsset } from "@/lib/types";
import { logger } from "@/lib/utils/logger";

const visionRankingSchema = z.object({
  winnerId: z.string().min(1),
  reasoning: z.string().min(1).max(300),
  scores: z.array(
    z.object({
      id: z.string().min(1),
      score: z.number().min(0).max(1),
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
): Promise<{ ranked: ReactionAsset[]; overallReason?: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const visionCandidates = candidates
    .filter((candidate) => candidate.previewImageUrl && /^https?:\/\//.test(candidate.previewImageUrl))
    .slice(0, 4);
  if (visionCandidates.length < 2) return null;

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
        model: process.env.OPENROUTER_VISION_MODEL || "qwen/qwen3-vl-30b-a3b-thinking",
        temperature: 0.1,
        max_tokens: 500,
        reasoning: {
          effort: "medium"
        },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "reaction_ranking",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                winnerId: { type: "string" },
                reasoning: { type: "string" },
                scores: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      score: { type: "number" },
                      reason: { type: "string" }
                    },
                    required: ["id", "score", "reason"]
                  }
                }
              },
              required: ["winnerId", "reasoning", "scores"]
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
      signal: AbortSignal.timeout(9000)
    });

    const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;
    if (!response.ok) {
      logger.warn("OpenRouter vision rerank failed; keeping heuristic order", {
        status: response.status,
        detail: payload.error?.code ?? payload.error?.message ?? "unknown"
      });
      return null;
    }

    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) {
      logger.info("OpenRouter vision rerank returned empty content; keeping heuristic order");
      return null;
    }

    const parsed = visionRankingSchema.parse(JSON.parse(raw)) as VisionRanking;
    const scoreById = new Map(parsed.scores.map((item) => [item.id, item]));
    const ranked = [...candidates].sort((a, b) => {
      const aScore = scoreById.get(a.id)?.score ?? -1;
      const bScore = scoreById.get(b.id)?.score ?? -1;
      return bScore - aScore;
    }).map((candidate) => {
      const scored = scoreById.get(candidate.id);
      return scored
        ? { ...candidate, visionScore: scored.score, visionReason: scored.reason }
        : candidate;
    });

    const visuallyAccepted = ranked.filter((candidate) => {
      const score = scoreById.get(candidate.id)?.score;
      return score === undefined || score >= 0.55;
    });
    return {
      ranked: visuallyAccepted,
      overallReason: `Qwen VL reviewed ${visionCandidates.length} visual candidates. ${parsed.reasoning}`
    };
  } catch (error) {
    logger.warn("OpenRouter vision rerank threw; keeping heuristic order", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

function buildPrompt(plan: CreativePlan, candidates: ReactionAsset[]): string {
  return [
    "You are ranking reaction stickers/GIFs for a short meme ad.",
    `Caption: ${plan.caption}`,
    `Target mood: ${plan.reactionMood}`,
    `Humor style: ${plan.humorStyle}`,
    `Template: ${plan.template}`,
    "Caption fit is the primary constraint: choose the candidate whose visible expression/action makes the caption feel funny and intentional, not merely a visually attractive reaction.",
    "Choose the candidate that best matches the emotion, reads clearly at small size, and works as an overlay on a vertical short-form video.",
    "Strongly prefer a real human face, person, or recognizable meme-style reaction shot.",
    "Reject abstract scribbles, icons, logos, text-only stickers, objects, geometric shapes, and rectangular cards with no clear person.",
    "Prefer expressive faces/poses, uncluttered silhouettes, and reactions that immediately support the joke.",
    `You must score only these candidate ids: ${candidates.map((candidate) => candidate.id).join(", ")}`
  ].join("\n");
}

function visionImageUrl(candidate: ReactionAsset): string {
  // GIPHY stickers are often WebP with transparency. Send the actual WebP
  // when available; the still preview can flatten the alpha and hide the
  // sticker's real silhouette from Qwen VL.
  if (candidate.hasTransparentBackground && candidate.type === "gif" && /^https?:\/\//.test(candidate.filePathOrUrl)) {
    return candidate.filePathOrUrl;
  }
  return candidate.previewImageUrl!;
}
