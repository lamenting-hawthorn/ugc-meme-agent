import { formatConversationMemory } from "@/lib/chat/memory";
import type { ConversationMemoryEntry, CreativePlan, ProductUnderstanding, VibeOverride } from "@/lib/types";
import { callDeepSeekJsonDetailed } from "@/lib/llm/deepseek";
import {
  buildDistinctFallbackCaption,
  lacksConcreteProductAnchor,
  previousGeneratedCaptions,
  wasCaptionPreviouslyUsed
} from "@/lib/llm/captionPolicy";
import { creativePlanSchema } from "@/lib/llm/schemas";
import type { AppliedVideoSkill } from "@/lib/skills/reactionAppUgc";
import { logger } from "@/lib/utils/logger";

export async function planCreative(
  product: ProductUnderstanding,
  vibeOverride?: VibeOverride,
  conversationMemory?: ConversationMemoryEntry[],
  skill?: AppliedVideoSkill | null
): Promise<CreativePlan> {
  const llmResult = await planWithDeepSeek(product, vibeOverride, conversationMemory, skill);
  const plan = llmResult ?? planDeterministically(product, vibeOverride, conversationMemory, skill);
  const productAlignedPlan = ensureProductMention(plan, product);
  const repeatedCaption = wasCaptionPreviouslyUsed(productAlignedPlan.caption, conversationMemory);
  const genericCaption = lacksConcreteProductAnchor(productAlignedPlan.caption, product);
  if (!repeatedCaption && !genericCaption) {
    return productAlignedPlan;
  }

  const replacementCaption = buildDistinctFallbackCaption(product, vibeOverride, conversationMemory);
  logger.info("Replaced creative caption that failed deterministic policy", {
    repeatedCaption,
    genericCaption,
    originalCaption: productAlignedPlan.caption,
    replacementCaption
  });
  return ensureProductMention({ ...productAlignedPlan, caption: replacementCaption }, product);
}

async function planWithDeepSeek(
  product: ProductUnderstanding,
  vibeOverride?: VibeOverride,
  conversationMemory?: ConversationMemoryEntry[],
  skill?: AppliedVideoSkill | null
): Promise<CreativePlan | null> {
  try {
    const result = await callDeepSeekJsonDetailed(
      [
        {
          role: "system",
          content:
            [
              "You are a creative director for TikTok/Reels meme ads. Return only valid JSON.",
              "The final video has one background, one human reaction clip, one caption, and one music track.",
              "Write like a real post, not an ad: lowercase, specific, self-aware, and instantly understandable without narration.",
              "Use one of these proven formats: 'me when [relatable situation] and [product payoff]', 'pov: [painful old workflow] until [product payoff]', or '[manual behavior] / [using product]'.",
              "Make the product the punchline, not the hero.",
              "Anchor the joke to one concrete capability or old workflow stated in the product understanding. Generic productivity clichés such as 'too many tabs' are forbidden unless the product specifically manages browsers or tabs.",
              "For broad platforms, choose one specific wedge—such as shipping an app with payments, creating marketing drafts, answering support, or connecting analytics—instead of vaguely saying it does everything.",
              "Keep captions 45-110 characters when possible, never more than 2 ideas, and avoid hashtags, emojis, claims, or corporate words like revolutionize, seamless, unlock, future, powerful.",
              "Do not name a specific meme or celebrity.",
              "The caption must be a complete standalone meme line, must explicitly mention the product/site, and must not end with a dangling word such as and, but, still, because, or until.",
              "Use these exact enum values: reactionMood = confused | panic | shocked | relief | smug | crying | celebrating; audioMood = funny | dramatic | chill | chaotic | victory; memeFormat = me-when | pov | before-after | pretending-to-know | manual-vs-automated | realization; humorStyle = relatable | absurd | dry | genz | dramatic; backgroundCategory = room | office | sky | phone | gradient | lifestyle; backgroundMood = clean | premium | neutral | dramatic | funny.",
              skill
                ? `Installed skill to follow as source of truth:\nSkill ID: ${skill.id}\n${skill.instructions}`
                : ""
            ].filter(Boolean).join("\n\n")
        },
        {
          role: "user",
          content: [
            vibeOverride ? `Vibe override: ${vibeOverride}` : "",
            `Product understanding: ${JSON.stringify(product)}`,
            `Caption identity requirement: explicitly include the exact site host ${productHost(product)} or the product name ${product.productName}.`,
            `Previous generated captions that must not be repeated: ${previousGeneratedCaptions(conversationMemory).join(" | ") || "none"}.`,
            formatConversationMemory(conversationMemory),
            `Caption variant index: ${(conversationMemory ?? []).filter((entry) => entry.type === "generation_request" || entry.type === "result_summary").length % 4}`,
            skill ? `Applied skill ID: ${skill.id}` : "",
            skill ? `Preferred duration: ${skill.targetDurationSec} seconds. Allowed range: ${skill.durationRangeSec.min}-${skill.durationRangeSec.max} seconds.` : "",
            "Return caption, memeFormat, humorStyle, reactionMood, audioMood, backgroundCategory, backgroundMood, durationSec, template, giphyQueries, appliedSkillId.",
            "Example JSON shape:",
            JSON.stringify({
              caption: "me when i'm still logging calories manually instead of using calai.app",
              memeFormat: "pretending-to-know",
              humorStyle: "relatable",
              reactionMood: "confused",
              audioMood: "funny",
              backgroundCategory: "room",
              backgroundMood: "clean",
              durationSec: 10,
              template: "top-caption-bottom-reaction",
              giphyQueries: ["confused reaction", "pretending to understand reaction", "panic calculating"],
              appliedSkillId: "reaction-app-ugc-shorts"
            })
          ]
            .filter(Boolean)
            .join("\n")
        }
      ],
      { timeoutMs: 8_000 }
    );
    if (!result.ok) {
      logger.warn("Structured creative planning unavailable; using deterministic fallback", {
        provider: result.provider,
        model: result.model,
        reason: result.reason,
        detail: result.detail,
        elapsedMs: result.elapsedMs
      });
      return null;
    }
    return { ...parseCreativePlan(result.content), source: result.provider };
  } catch (error) {
    logger.warn("Structured creative planning returned invalid JSON; using deterministic fallback", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

function parseCreativePlan(content: string): CreativePlan {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const direct = creativePlanSchema.safeParse(raw);
  if (direct.success) return direct.data;

  const repaired = {
    ...raw,
    reactionMood: normalizeEnum(raw.reactionMood, {
      frustrated: "panic",
      overwhelmed: "panic",
      stressed: "panic",
      annoyed: "confused"
    }),
    audioMood: normalizeEnum(raw.audioMood, {
      quirky: "funny",
      energetic: "chaotic",
      calm: "chill",
      triumphant: "victory"
    })
  };
  const result = creativePlanSchema.parse(repaired);
  logger.info("Normalized structured creative enum aliases", {
    reactionMood: String(raw.reactionMood),
    audioMood: String(raw.audioMood)
  });
  return result;
}

function normalizeEnum(value: unknown, aliases: Record<string, string>): unknown {
  if (typeof value !== "string") return value;
  return aliases[value.toLowerCase()] ?? value;
}

function ensureProductMention(plan: CreativePlan, product: ProductUnderstanding): CreativePlan {
  const host = productHost(product);
  const caption = plan.caption.trim();
  const lowerCaption = caption.toLowerCase();
  if (lowerCaption.includes(host)) {
    return plan;
  }

  const withoutTrailingPunctuation = caption.replace(/[.!?]+$/, "");
  const completeCaption = /\b(and|or|but|still|because|until|so|to)$/i.test(withoutTrailingPunctuation)
    ? `${withoutTrailingPunctuation.replace(/\s+(and|or|but|still|because|until|so|to)$/i, "")} and still not knowing how to use ${host}`
    : `${withoutTrailingPunctuation} / still figuring out ${host}`;
  const repairedCaption = completeCaption.length <= 145
    ? completeCaption
    : `me after trying everything and still not knowing how to use ${host}`;

  logger.info("Repaired creative caption to include product identity", {
    host,
    originalLength: caption.length,
    repairedLength: repairedCaption.length
  });
  return { ...plan, caption: repairedCaption };
}

function productHost(product: ProductUnderstanding): string {
  return new URL(product.productUrl).hostname.replace(/^www\./, "").toLowerCase();
}

function planDeterministically(
  product: ProductUnderstanding,
  vibeOverride?: VibeOverride,
  conversationMemory?: ConversationMemoryEntry[],
  skill?: AppliedVideoSkill | null
): CreativePlan {
  const dramatic = vibeOverride === "dramatic";
  const funny = vibeOverride === "funny";
  const lowerEnergy = vibeOverride === "less-cringe" || vibeOverride === "premium";
  const genz = vibeOverride === "genz" || vibeOverride === "chaotic";
  const memoryText = (conversationMemory ?? []).map((entry) => entry.summary.toLowerCase()).join(" ");
  const wantsSafeCaption = /text cut|caption cut|cropped text|safe margin|wrap text/.test(memoryText);
  const generationCount = (conversationMemory ?? []).filter((entry) => entry.type === "generation_request" || entry.type === "result_summary").length;

  const caption = wantsSafeCaption
    ? `${product.oldWorkflow.replace(/\.$/, "").toLowerCase()} / ${productHost(product)} doing it in one place`
    : buildDistinctFallbackCaption(product, vibeOverride, conversationMemory);
  const reactionMood = dramatic ? "shocked" : funny ? "celebrating" : lowerEnergy ? "relief" : genz ? "panic" : "confused";

  return creativePlanSchema.parse({
    caption,
    memeFormat: lowerEnergy ? "realization" : generationCount % 3 === 1 ? "pov" : generationCount % 3 === 2 ? "manual-vs-automated" : "pretending-to-know",
    humorStyle: dramatic ? "dramatic" : genz ? "genz" : lowerEnergy ? "dry" : "relatable",
    reactionMood,
    audioMood: dramatic ? "dramatic" : lowerEnergy ? "chill" : genz ? "chaotic" : "funny",
    backgroundCategory: product.category.includes("developer") ? "office" : "room",
    backgroundMood: lowerEnergy ? "premium" : "clean",
    durationSec: chooseDuration(vibeOverride, skill),
    template: "top-caption-bottom-reaction",
    giphyQueries: [
      `${reactionMood} real human sticker`,
      `${reactionMood} celebrity reaction`,
      "pretending to understand reaction",
      "panic calculating",
      "side eye reaction"
    ],
    source: "deterministic",
    appliedSkillId: skill?.id
  });
}

function chooseDuration(vibeOverride?: VibeOverride, skill?: AppliedVideoSkill | null): number {
  if (!skill) return 8;
  if (vibeOverride === "dramatic") return 12;
  if (vibeOverride === "less-cringe" || vibeOverride === "premium") return 9;
  return skill.targetDurationSec;
}
