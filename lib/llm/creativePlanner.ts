import { formatConversationMemory } from "@/lib/chat/memory";
import type { ConversationMemoryEntry, CreativePlan, ProductUnderstanding, VibeOverride } from "@/lib/types";
import { callDeepSeekJsonDetailed } from "@/lib/llm/deepseek";
import { creativePlanSchema } from "@/lib/llm/schemas";
import { logger } from "@/lib/utils/logger";

export async function planCreative(
  product: ProductUnderstanding,
  vibeOverride?: VibeOverride,
  conversationMemory?: ConversationMemoryEntry[]
): Promise<CreativePlan> {
  const llmResult = await planWithDeepSeek(product, vibeOverride, conversationMemory);
  if (llmResult) return llmResult;
  return planDeterministically(product, vibeOverride, conversationMemory);
}

async function planWithDeepSeek(
  product: ProductUnderstanding,
  vibeOverride?: VibeOverride,
  conversationMemory?: ConversationMemoryEntry[]
): Promise<CreativePlan | null> {
  try {
    const result = await callDeepSeekJsonDetailed([
      {
        role: "system",
        content:
          "You are a creative director for TikTok/Reels meme ads. Return only valid JSON. The final video has one background, one human reaction clip, one caption, and one music track. Write like a real post, not an ad: lowercase, specific, self-aware, and instantly understandable without narration. Use one of these proven formats: 'me when [relatable situation] and [product payoff]', 'pov: [painful old workflow] until [product payoff]', or '[manual behavior] / [using product]'. Make the product the punchline, not the hero. Keep captions 45-110 characters when possible, never more than 2 ideas, and avoid hashtags, emojis, claims, or corporate words like revolutionize, seamless, unlock, future, powerful. Do not name a specific meme or celebrity. Use these exact enum values: reactionMood = confused | panic | shocked | relief | smug | crying | celebrating; audioMood = funny | dramatic | chill | chaotic | victory; memeFormat = me-when | pov | before-after | pretending-to-know | manual-vs-automated | realization; humorStyle = relatable | absurd | dry | genz | dramatic; backgroundCategory = room | office | sky | phone | gradient | lifestyle; backgroundMood = clean | premium | neutral | dramatic | funny."
      },
      {
        role: "user",
        content: [
          vibeOverride ? `Vibe override: ${vibeOverride}` : "",
          `Product understanding: ${JSON.stringify(product)}`,
          formatConversationMemory(conversationMemory),
          `Caption variant index: ${(conversationMemory ?? []).filter((entry) => entry.type === "generation_request" || entry.type === "result_summary").length % 4}`,
          "Return caption, memeFormat, humorStyle, reactionMood, audioMood, backgroundCategory, backgroundMood, durationSec, template, giphyQueries.",
          "Example JSON shape:",
          JSON.stringify({
            caption: "me when i'm still logging calories manually instead of using calai.app",
            memeFormat: "pretending-to-know",
            humorStyle: "relatable",
            reactionMood: "confused",
            audioMood: "funny",
            backgroundCategory: "room",
            backgroundMood: "clean",
            durationSec: 8,
            template: "top-caption-bottom-reaction",
            giphyQueries: ["confused reaction", "pretending to understand reaction", "panic calculating"]
          })
        ]
          .filter(Boolean)
          .join("\n")
      }
    ]);
    if (!result.ok) {
      logger.warn("DeepSeek creative planning unavailable; using deterministic fallback", {
        reason: result.reason,
        detail: result.detail
      });
      return null;
    }
    const parsed = parseCreativePlan(result.content);
    if (!parsed) return null;
    return { ...parsed, source: "deepseek" };
  } catch (error) {
    logger.warn("DeepSeek creative planning returned invalid JSON; using deterministic fallback", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

function parseCreativePlan(content: string): CreativePlan | null {
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
  const result = creativePlanSchema.safeParse(repaired);
  if (!result.success) throw result.error;

  logger.info("Normalized DeepSeek creative enum aliases", {
    reactionMood: String(raw.reactionMood),
    audioMood: String(raw.audioMood)
  });
  return result.data;
}

function normalizeEnum(value: unknown, aliases: Record<string, string>): unknown {
  if (typeof value !== "string") return value;
  return aliases[value.toLowerCase()] ?? value;
}

function planDeterministically(
  product: ProductUnderstanding,
  vibeOverride?: VibeOverride,
  conversationMemory?: ConversationMemoryEntry[]
): CreativePlan {
  const productName = product.productName || new URL(product.productUrl).hostname;
  const dramatic = vibeOverride === "dramatic";
  const funny = vibeOverride === "funny";
  const lowerEnergy = vibeOverride === "less-cringe" || vibeOverride === "premium";
  const genz = vibeOverride === "genz" || vibeOverride === "chaotic";
  const memoryText = (conversationMemory ?? []).map((entry) => entry.summary.toLowerCase()).join(" ");
  const wantsHumanReaction = /real human|real person|celebrity|meme reaction|not abstract|not scribble|use a person/.test(memoryText);
  const wantsSafeCaption = /text cut|caption cut|cropped text|safe margin|wrap text/.test(memoryText);
  const generationCount = (conversationMemory ?? []).filter((entry) => entry.type === "generation_request" || entry.type === "result_summary").length;

  const caption = buildCaption(productName, product, vibeOverride, wantsSafeCaption, generationCount);
  const reactionMood = dramatic ? "shocked" : funny ? "celebrating" : lowerEnergy ? "relief" : genz ? "panic" : "confused";

  return creativePlanSchema.parse({
    caption,
    memeFormat: lowerEnergy ? "realization" : generationCount % 3 === 1 ? "pov" : generationCount % 3 === 2 ? "manual-vs-automated" : "pretending-to-know",
    humorStyle: dramatic ? "dramatic" : genz ? "genz" : lowerEnergy ? "dry" : "relatable",
    reactionMood,
    audioMood: dramatic ? "dramatic" : lowerEnergy ? "chill" : genz ? "chaotic" : "funny",
    backgroundCategory: product.category.includes("developer") ? "office" : "room",
    backgroundMood: lowerEnergy ? "premium" : "clean",
    durationSec: 8,
    template: "top-caption-bottom-reaction",
    giphyQueries: [
      wantsHumanReaction ? `${reactionMood} person reaction` : `${reactionMood} reaction`,
      wantsHumanReaction ? `${reactionMood} celebrity meme` : `${reactionMood} sticker`,
      "pretending to understand reaction",
      "panic calculating",
      "side eye reaction"
    ],
    source: "deterministic"
  });
}

function buildCaption(
  productName: string,
  product: ProductUnderstanding,
  vibeOverride?: VibeOverride,
  wantsSafeCaption?: boolean,
  generationCount = 0
): string {
  const oldWorkflow = product.oldWorkflow.replace(/\.$/, "").toLowerCase();
  const benefit = product.productBenefit.replace(/\.$/, "").toLowerCase();
  const shortName = new URL(product.productUrl).hostname.replace(/^www\./, "").toLowerCase();
  const manualWorkflow = memeWorkflow(product);

  if (vibeOverride === "dramatic") {
    return `pov: ${oldWorkflow} until ${shortName} enters the chat`;
  }
  if (vibeOverride === "funny") {
    return `me when ${shortName} does the boring part and i take the credit`;
  }
  if (vibeOverride === "less-cringe" || vibeOverride === "premium") {
    return `me after realizing ${shortName} can ${benefit}`;
  }
  if (vibeOverride === "chaotic" || vibeOverride === "genz") {
    return `me fighting ${oldWorkflow} like it owes me money / ${shortName} watching`;
  }
  if (wantsSafeCaption) {
    return `${oldWorkflow} / ${shortName} doing it in one tap`;
  }
  const variants = [
    `me when i'm still ${manualWorkflow} instead of using ${shortName}`,
    `me acting like i know what i'm doing so i just open ${shortName} and let it handle it`,
    `pov: ${oldWorkflow} until ${shortName} enters the chat`,
    `${manualWorkflow} manually / ${shortName} doing the boring part`
  ];
  return variants[generationCount % variants.length];
}

function memeWorkflow(product: ProductUnderstanding): string {
  const category = product.category.toLowerCase();
  if (category.includes("fitness") || category.includes("nutrition")) return "logging calories manually";
  if (category.includes("calendar") || category.includes("scheduling")) return "sending five messages to find one time";
  if (category.includes("finance") || category.includes("operations")) return "copying numbers between spreadsheets";
  if (category.includes("developer")) return "rewriting the same boilerplate again";
  if (category.includes("sales") || category.includes("crm")) return "updating every lead by hand";
  if (category.includes("creative")) return "opening twelve tabs to make one post";
  return product.userPain.replace(/\.$/, "").replace(/^manual /, "").toLowerCase();
}
